import * as http from 'http'
import { app } from 'electron'
import { getAvailableProviders, getAnswer } from './ai-provider'
import { loadApiKeys } from './api-keys'
import type { AIProvider } from '../../shared/types'

const PORT = 62544
const HOST = '127.0.0.1'

// Map provider names to their type for the /api/providers response
const PROVIDER_TYPES: Record<string, string> = {
  claude: 'anthropic',
  gemini: 'openai-compatible',
  openai: 'openai-compatible',
  qwen: 'openai-compatible',
  custom: 'openai-compatible',
}

export interface ExtensionState {
  connected: boolean
  lastSeen: number
  code?: string
  pageTitle?: string
  language?: string | null
}

export interface BridgeHintEntry {
  hint: string
  timestamp: number
  pageTitle?: string
  language?: string | null
}

export class LocalBridgeApi {
  private server: http.Server | null = null
  private activeSession: string | null = null
  private extensionState: ExtensionState = { connected: false, lastSeen: 0 }
  private hintHistory: BridgeHintEntry[] = []
  private onExtensionUpdate?: (state: ExtensionState) => void
  private onHintGenerated?: (entry: BridgeHintEntry) => void

  setActiveSession(sessionId: string | null): void {
    this.activeSession = sessionId
  }

  getExtensionState(): ExtensionState {
    return { ...this.extensionState }
  }

  getHintHistory(): BridgeHintEntry[] {
    return [...this.hintHistory]
  }

  setOnExtensionUpdate(cb: (state: ExtensionState) => void): void {
    this.onExtensionUpdate = cb
  }

  setOnHintGenerated(cb: (entry: BridgeHintEntry) => void): void {
    this.onHintGenerated = cb
  }

  async start(): Promise<void> {
    if (this.server) return

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res)
    })

    return new Promise((resolve, reject) => {
      this.server!.listen(PORT, HOST, () => {
        console.log(`[Bridge API] Listening on ${HOST}:${PORT}`)
        resolve()
      })
      this.server!.on('error', reject)
    })
  }

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
    res.setHeader('Access-Control-Allow-Origin', 'chrome-extension://*')
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

    // Track extension connection
    this.extensionState = { ...this.extensionState, connected: true, lastSeen: Date.now() }
    this.onExtensionUpdate?.(this.extensionState)

    const url = req.url || ''
    const method = req.method || 'GET'

    if (method === 'GET' && url === '/health') {
      this.handleHealth(res)
    } else if (method === 'GET' && url === '/api/providers') {
      this.handleProviders(res)
    } else if (method === 'POST' && url === '/api/hint') {
      this.readBody(req).then((body) => this.handleHint(res, body))
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

  private async handleHint(res: http.ServerResponse, body: any): Promise<void> {
    const providers = getAvailableProviders()
    if (providers.length === 0) {
      this.json(res, 503, { error: 'no provider configured' })
      return
    }

    try {
      const { code, pageTitle, language, metadata, hintStyle } = body
      const style = hintStyle || 'gentle'

      // Build prompt
      let prompt = `You are a coding interview hint assistant. Provide a ${style} hint for the following code challenge.\n\n`
      prompt += `Page: ${pageTitle || 'Unknown'}\n`
      if (language) prompt += `Language: ${language}\n`
      if (metadata?.difficulty) prompt += `Difficulty: ${metadata.difficulty}\n`
      if (metadata?.tags) prompt += `Tags: ${metadata.tags.join(', ')}\n`
      if (metadata?.constraints) prompt += `Constraints: ${metadata.constraints}\n`
      prompt += `\nCode:\n${code}\n`

      // If there's an active interview session, append context
      const context: any = { cv: '', jobDescription: '', manualContext: '' }
      if (this.activeSession) {
        const keys = loadApiKeys()
        // Session context will be appended by the orchestrator
        context.manualContext = `Active interview session: ${this.activeSession}`
      }

      const hint = await getAnswer(prompt, providers[0], context)

      // Track in extension state and hint history
      this.extensionState = {
        ...this.extensionState,
        code,
        pageTitle: pageTitle || undefined,
        language: language || null,
      }
      const entry: BridgeHintEntry = { hint, timestamp: Date.now(), pageTitle, language }
      this.hintHistory.unshift(entry)
      this.onExtensionUpdate?.(this.extensionState)
      this.onHintGenerated?.(entry)

      this.json(res, 200, { hint })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      this.json(res, 500, { error: message })
    }
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
