import * as http from 'http'
import { app } from 'electron'
import { getAvailableProviders, getAnswer } from './ai-provider'
import { loadApiKeys } from './api-keys'
import type { AIProvider } from '../../shared/types'

const DEFAULT_PORT = 62544
const HOST = '127.0.0.1'

// Map provider names to their type for the /api/providers response
const PROVIDER_TYPES: Record<string, string> = {
  claude: 'anthropic',
  gemini: 'openai-compatible',
  openai: 'openai-compatible',
  qwen: 'openai-compatible',
  custom: 'openai-compatible',
}

/** The type of client that has connected to the bridge. */
export type BridgeClientType = 'chrome-extension' | 'vscode-extension' | 'unknown'

/** A file entry from the VS Code workspace for multi-file context. */
export interface OpenFileEntry {
  filePath: string
  fileName: string
  language: string
  code?: string
}

/** Tracks the connection state and current context of the browser extension. */
export interface ExtensionState {
  connected: boolean
  lastSeen: number
  clientType: BridgeClientType
  code?: string
  pageTitle?: string
  language?: string | null
  manualContext?: string
  filePath?: string
  fileTree?: string[]
  openFiles?: OpenFileEntry[]
}

/** A generated hint entry with the AI answer and explanation for a coding problem. */
export interface BridgeHintEntry {
  answer: string
  explanation: string
  timestamp: number
  pageTitle?: string
  language?: string | null
}

/** Local HTTP API server that bridges the browser extension with the Electron app's AI providers. */
export class LocalBridgeApi {
  private server: http.Server | null = null
  private activeSession: string | null = null
  private extensionState: ExtensionState = { connected: false, lastSeen: 0, clientType: 'unknown' }
  private hintHistory: BridgeHintEntry[] = []
  private onExtensionUpdate?: (state: ExtensionState) => void
  private onHintGenerated?: (entry: BridgeHintEntry) => void

  /**
   * Sets the active interview session ID for contextual hint generation.
   * @param sessionId - The session ID, or null to clear.
   */
  setActiveSession(sessionId: string | null): void {
    this.activeSession = sessionId
  }

  /**
   * Returns a copy of the current browser extension connection state.
   * @returns The current extension state.
   */
  getExtensionState(): ExtensionState {
    return { ...this.extensionState }
  }

  /**
   * Returns a copy of the hint history log.
   * @returns An array of previously generated hint entries.
   */
  getHintHistory(): BridgeHintEntry[] {
    return [...this.hintHistory]
  }

  /**
   * Registers a callback to be invoked when the extension state changes.
   * @param cb - The callback function receiving the updated extension state.
   */
  setOnExtensionUpdate(cb: (state: ExtensionState) => void): void {
    this.onExtensionUpdate = cb
  }

  /**
   * Registers a callback to be invoked when a new hint is generated.
   * @param cb - The callback function receiving the generated hint entry.
   */
  setOnHintGenerated(cb: (entry: BridgeHintEntry) => void): void {
    this.onHintGenerated = cb
  }

  /**
   * Starts the local HTTP server on localhost, trying alternative ports if the default is in use.
   */
  async start(): Promise<void> {
    if (this.server) return

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res)
    })

    // Try starting on the default port, then try alternatives if it's in use
    const portsToTry = [DEFAULT_PORT, DEFAULT_PORT + 1, DEFAULT_PORT + 2, DEFAULT_PORT + 3, DEFAULT_PORT + 4]
    
    return new Promise((resolve, reject) => {
      const tryNextPort = (portIndex: number) => {
        if (portIndex >= portsToTry.length) {
          // All ports tried, reject with error
          reject(new Error(`Could not start Bridge API server on any of the attempted ports: ${portsToTry.join(', ')}`))
          return
        }

        const port = portsToTry[portIndex]
        
        this.server!.once('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`[Bridge API] Port ${port} already in use, trying next port...`)
            tryNextPort(portIndex + 1)
          } else {
            reject(err)
          }
        })

        this.server!.listen(port, HOST, () => {
          console.log(`[Bridge API] Listening on ${HOST}:${port}`)
          resolve()
        })
      }

      tryNextPort(0)
    })
  }

  /**
   * Stops the local HTTP server.
   */
  async stop(): Promise<void> {
    if (!this.server) return
    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null
        resolve()
      })
    })
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // CORS headers for chrome extension
    // Use the request origin if it's a chrome-extension, otherwise allow all localhost
    const origin = req.headers['origin'] || ''
    if (origin.startsWith('chrome-extension://') || origin === '') {
      res.setHeader('Access-Control-Allow-Origin', origin || '*')
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*')
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Mooch-Client')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Require X-Mooch-Client header
    const clientHeader = req.headers['x-mooch-client']
    if (!clientHeader) {
      this.json(res, 403, { error: 'Forbidden: missing X-Mooch-Client header' })
      return
    }

    // Derive client type from header value
    const rawClient = Array.isArray(clientHeader) ? clientHeader[0] : clientHeader
    const clientType: BridgeClientType =
      rawClient === 'chrome-extension' ? 'chrome-extension'
      : rawClient === 'vscode-extension' ? 'vscode-extension'
      : 'unknown'

    // Track extension connection
    this.extensionState = { ...this.extensionState, connected: true, lastSeen: Date.now(), clientType }
    this.onExtensionUpdate?.(this.extensionState)

    const url = req.url || ''
    const method = req.method || 'GET'

    if (method === 'GET' && url === '/health') {
      this.handleHealth(res)
    } else if (method === 'GET' && url === '/api/providers') {
      this.handleProviders(res)
    } else if (method === 'POST' && url === '/api/hint') {
      this.readBody(req).then((body) => this.handleHint(res, body))
    } else if (method === 'POST' && url === '/api/sync') {
      this.readBody(req).then((body) => this.handleSync(res, body))
    } else if (method === 'POST' && url === '/api/analyze') {
      this.readBody(req).then((body) => this.handleAnalyze(res, body))
    } else {
      this.json(res, 404, { error: 'Not found' })
    }
  }

  private handleHealth(res: http.ServerResponse): void {
    let version = '0.0.0'
    try {
      version = app.getVersion()
    } catch {
      // app may not be available in test
    }
    this.json(res, 200, {
      status: 'ok',
      version,
      activeSession: this.activeSession,
    })
  }

  private handleProviders(res: http.ServerResponse): void {
    const available = getAvailableProviders()
    const providers = available.map((name) => ({
      name,
      type: PROVIDER_TYPES[name] || 'openai-compatible',
      configured: true,
    }))
    this.json(res, 200, { providers })
  }

  /**
   * Generates a hint for the given code, fires onHintGenerated, and returns the result.
   * Can be called directly from the main process as well as via the HTTP endpoint.
   */
  async generateHint(body: {
    code: string
    pageTitle?: string
    language?: string | null
    userContext?: string
    manualContext?: string
    metadata?: { difficulty?: string; tags?: string[]; constraints?: string }
  }): Promise<{ answer: string; explanation: string }> {
    const providers = getAvailableProviders()
    if (providers.length === 0) throw new Error('no provider configured')

    const { code, pageTitle, language, metadata, userContext, manualContext: ctx } = body

    let prompt = `You are a coding interview assistant. Given a coding challenge and the user's current code, provide:\n`
    prompt += `1. A complete, correct solution to the problem\n`
    prompt += `2. An explanation of why the solution works and the key insights\n\n`
    prompt += `You MUST respond in this exact format:\n`
    prompt += `---ANSWER---\n<the complete working code solution>\n---EXPLANATION---\n<explanation of why this works, key patterns used, time/space complexity>\n\n`
    prompt += `Page: ${pageTitle || 'Unknown'}\n`
    if (language) prompt += `Language: ${language}\n`
    if (metadata?.difficulty) prompt += `Difficulty: ${metadata.difficulty}\n`
    if (metadata?.tags) prompt += `Tags: ${metadata.tags.join(', ')}\n`
    if (metadata?.constraints) prompt += `Constraints: ${metadata.constraints}\n`
    if (userContext) prompt += `\nThe interviewer asked: ${userContext}\nTailor your answer to address this question while still providing a complete solution.\n`
    if (ctx) prompt += `\nAdditional context from user: ${ctx}\n`
    prompt += `\nUser's current code:\n${code}\n`

    const context: any = { cv: '', jobDescription: '', manualContext: '' }
    if (this.activeSession) context.manualContext = `Active interview session: ${this.activeSession}`

    const raw = await getAnswer(prompt, providers[0], context)

    let answer = raw
    let explanation = ''
    const answerMatch = raw.indexOf('---ANSWER---')
    const explMatch = raw.indexOf('---EXPLANATION---')
    if (answerMatch !== -1 && explMatch !== -1) {
      answer = raw.substring(answerMatch + '---ANSWER---'.length, explMatch).trim()
      explanation = raw.substring(explMatch + '---EXPLANATION---'.length).trim()
    }

    this.extensionState = { ...this.extensionState, code, pageTitle: pageTitle || undefined, language: language || null, manualContext: ctx }
    const entry: BridgeHintEntry = { answer, explanation, timestamp: Date.now(), pageTitle, language }
    this.hintHistory.unshift(entry)
    this.onExtensionUpdate?.(this.extensionState)
    this.onHintGenerated?.(entry)

    return { answer, explanation }
  }

  private async handleHint(res: http.ServerResponse, body: any): Promise<void> {
    const providers = getAvailableProviders()
    if (providers.length === 0) {
      this.json(res, 503, { error: 'no provider configured' })
      return
    }
    try {
      const { answer, explanation } = await this.generateHint(body)
      this.json(res, 200, { hint: answer, answer, explanation })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      this.json(res, 500, { error: message })
    }
  }

  private handleSync(res: http.ServerResponse, body: any): void {
    const { code, pageTitle, language, manualContext, filePath, fileTree, openFiles } = body || {}
    this.extensionState = {
      ...this.extensionState,
      code: code ?? this.extensionState.code,
      pageTitle: pageTitle ?? this.extensionState.pageTitle,
      language: language ?? this.extensionState.language,
      manualContext: manualContext ?? this.extensionState.manualContext,
      filePath: filePath ?? this.extensionState.filePath,
      fileTree: Array.isArray(fileTree) ? fileTree : this.extensionState.fileTree,
      openFiles: Array.isArray(openFiles) ? openFiles : this.extensionState.openFiles,
    }
    this.onExtensionUpdate?.(this.extensionState)
    this.json(res, 200, { ok: true })
  }

  private async handleAnalyze(res: http.ServerResponse, body: any): Promise<void> {
    const providers = getAvailableProviders()
    if (providers.length === 0) {
      this.json(res, 503, { error: 'no provider configured' })
      return
    }

    try {
      const { code, context: codeContext } = body
      let prompt = 'Analyze the following code and provide insights on its correctness, efficiency, and potential improvements.\n\n'
      if (codeContext) prompt += `Context: ${codeContext}\n\n`
      prompt += `Code:\n${code}\n`

      const analysis = await getAnswer(prompt, providers[0], { cv: '', jobDescription: '', manualContext: '' })
      this.json(res, 200, { analysis })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      this.json(res, 500, { error: message })
    }
  }

  private json(res: http.ServerResponse, status: number, data: object): void {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  private readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      let data = ''
      req.on('data', (chunk) => (data += chunk))
      req.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve({})
        }
      })
    })
  }
}

// Export the default port for external reference if needed
export { DEFAULT_PORT };
