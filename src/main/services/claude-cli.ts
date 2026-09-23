import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { writeFileSync, unlinkSync, appendFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadApiKeys } from './api-keys'

/** Debug log file for Claude CLI runs, so failures can be inspected after the fact. */
export const CLAUDE_DEBUG_LOG = join(tmpdir(), 'mooch-claude-debug.log')

/**
 * Logs to the console and appends a timestamped line to CLAUDE_DEBUG_LOG.
 * @param level - Console level to use.
 * @param message - The message to log.
 */
export function claudeDebugLog(level: 'log' | 'error', message: string): void {
  console[level](message)
  try { appendFileSync(CLAUDE_DEBUG_LOG, `${new Date().toISOString()} ${message}\n`) } catch { /* best-effort */ }
}

/**
 * Whether a long-lived Claude Code token (from `claude setup-token`) is configured.
 * @returns True when CLAUDE_CODE_OAUTH_TOKEN is set.
 */
export function hasClaudeCodeToken(): boolean {
  return !!process.env.CLAUDE_CODE_OAUTH_TOKEN
}

/**
 * Whether Claude requests should go through the CLI: a Claude Code token is set
 * and no Anthropic API key is stored (an API key takes precedence).
 * @returns True when requests should be routed through `claude -p`.
 */
export function shouldUseClaudeCli(): boolean {
  return hasClaudeCodeToken() && !loadApiKeys().anthropicApiKey
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
  // --setting-sources '' keeps the user's own Claude Code hooks, CLAUDE.md and
  // plugins out of the app's answers.
  const args = ['-p', '--no-session-persistence', '--setting-sources', '', '--model', model, '--tools', tools.join(',')]
  if (tools.length > 0) args.push('--allowedTools', tools.join(','))

  // The system prompt carries the CV and job description, which can exceed the
  // 128KB per-argument limit (spawn fails with E2BIG), so pass it as a file.
  let systemPath: string | undefined
  if (system) {
    systemPath = join(tmpdir(), `mooch-claude-system-${randomUUID()}.txt`)
    writeFileSync(systemPath, system)
    args.push('--system-prompt-file', systemPath)
  }
  const cleanup = (): void => {
    if (systemPath) try { unlinkSync(systemPath) } catch { /* best-effort */ }
  }

  // An API key in the environment would take precedence over the OAuth token.
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY

  const id = randomUUID().slice(0, 8)
  const started = Date.now()
  claudeDebugLog('log',
    `[ClaudeCLI ${id}] start model=${model} tools=[${tools.join(',')}] prompt=${prompt.length} chars ` +
      `system=${system?.length ?? 0} chars`
  )

  return new Promise<string>((resolve, reject) => {
    const child = spawn('claude', args, { env, cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      claudeDebugLog('error', `[ClaudeCLI ${id}] timed out after ${timeoutMs}ms; stderr: ${stderr.trim().slice(0, 2000)}`)
      child.kill('SIGKILL')
      reject(new Error(`Claude Code CLI timed out after ${timeoutMs / 1000}s`))
    }, timeoutMs)

    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.stdin.on('error', (err) => claudeDebugLog('error', `[ClaudeCLI ${id}] stdin error: ${err.message}`))
    child.on('error', (err) => {
      clearTimeout(timer)
      claudeDebugLog('error', `[ClaudeCLI ${id}] spawn failed: ${err.message} (PATH=${env.PATH})`)
      reject(new Error(`Could not run the claude CLI (is it installed and on PATH?): ${err.message}`))
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      const ms = Date.now() - started
      if (code === 0) {
        claudeDebugLog('log', `[ClaudeCLI ${id}] ok in ${ms}ms, ${stdout.length} chars`)
        resolve(stdout.trim())
        return
      }
      claudeDebugLog('error',
        `[ClaudeCLI ${id}] exited code=${code} signal=${signal} after ${ms}ms\n` +
          `  stderr: ${stderr.trim().slice(0, 2000)}\n  stdout: ${stdout.trim().slice(0, 2000)}`
      )
      reject(new Error(`Claude Code CLI exited with ${code ?? signal}: ${(stderr || stdout).trim().slice(0, 500)}`))
    })
    child.stdin.end(prompt)
  }).finally(cleanup)
}
