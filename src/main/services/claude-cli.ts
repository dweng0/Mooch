import { spawn } from 'child_process'

/** Whether a long-lived Claude Code token (from `claude setup-token`) is configured. */
export function hasClaudeCodeToken(): boolean {
  return !!process.env.CLAUDE_CODE_OAUTH_TOKEN
}

interface ClaudeCliOptions {
  /** System prompt that replaces Claude Code's default one. */
  system?: string
  /** Tools the CLI may use. Empty (default) disables all tools. */
  tools?: string[]
  /** Model alias or ID passed to `--model`. */
  model?: string
  timeoutMs?: number
}

/**
 * Runs a single prompt through the `claude` CLI in print mode, authenticated by
 * CLAUDE_CODE_OAUTH_TOKEN.
 * @param prompt - The user prompt, sent on stdin.
 * @param options - System prompt, allowed tools, model and timeout.
 * @returns The CLI's text output.
 */
export function runClaudeCli(prompt: string, options: ClaudeCliOptions = {}): Promise<string> {
  const { system, tools = [], model = 'sonnet', timeoutMs = 90_000 } = options
  const args = ['-p', '--no-session-persistence', '--model', model, '--tools', tools.join(',')]
  if (tools.length > 0) args.push('--allowedTools', tools.join(','))
  if (system) args.push('--system-prompt', system)

  // An API key in the environment would take precedence over the OAuth token.
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { env, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Claude Code CLI timed out'))
    }, timeoutMs)

    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Could not run the claude CLI (is it installed and on PATH?): ${err.message}`))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`Claude Code CLI exited with ${code}: ${(stderr || stdout).trim().slice(0, 500)}`))
    })
    child.stdin.end(prompt)
  })
}
