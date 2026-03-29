import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, session, shell, screen } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import * as fs from 'fs/promises'
import { PDFParse } from 'pdf-parse'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import { loadApiKeys, saveApiKeys, clearApiKey } from './services/api-keys'
import { transcribeAudio } from './services/transcribe'
import { getAnswer, getAvailableProviders } from './services/ai-provider'
import { analyzeCodeSnapshot } from './services/claude'
import { analyzeCodeSnapshotQwen } from './services/qwen'
import { analyzeCodeSnapshotCustom, testCustomProvider } from './services/openai-compat'
import { InterviewSessionManager } from './services/interview-session'
import { TTSProviderManager } from './services/tts-provider'
import { InterviewOrchestrator } from './services/interview-orchestrator'
import { LocalBridgeApi } from './services/local-bridge-api'
import { freeCodeSessionManager } from './services/free-code-session'
import type { AIProvider, UserContext, CropRect, CustomProviderConfig, FreeCodeSessionData } from '../shared/types'
import type { DesktopCapturerSource } from 'electron'

let mainWindow: BrowserWindow | null = null
let areaSelectionWindow: BrowserWindow | null = null
let areaSelectionResolve: ((rect: CropRect | null) => void) | null = null

// Cache window sources to prevent ID changes between get-window-sources and capture-window
let cachedWindowSources: DesktopCapturerSource[] = []
let cacheTimestamp = 0
const CACHE_DURATION_MS = 30000 // 30 seconds

// Interview services
const sessionManager = new InterviewSessionManager()
const ttsManager = new TTSProviderManager()

// Bridge API for Chrome extension
let bridgeApi: LocalBridgeApi | null = null
const interviewOrchestrator = new InterviewOrchestrator(sessionManager, ttsManager)

function createWindow(): void {
  const { width: screenWidth, height: screenHeight } =
    require('electron').screen.getPrimaryDisplay().workAreaSize

  const winWidth = 500
  const winHeight = 920

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenWidth - winWidth - 16,
    y: screenHeight - winHeight - 16,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---------------------------------------------------------------------------
// Auth IPC handlers (stubs — no backend, no login required)
// ---------------------------------------------------------------------------

ipcMain.handle('login', async () => { /* no-op */ })
ipcMain.handle('logout', async () => { /* no-op */ })
ipcMain.handle('open-oauth', async () => { /* no-op */ })

// ---------------------------------------------------------------------------
// Bridge API IPC handlers (Chrome extension integration)
// ---------------------------------------------------------------------------

ipcMain.handle('bridge-start', async () => {
  if (bridgeApi) return { ok: true }
  bridgeApi = new LocalBridgeApi()
  bridgeApi.setOnExtensionUpdate((state) => {
    mainWindow?.webContents.send('bridge-extension-update', state)
  })
  bridgeApi.setOnHintGenerated((entry) => {
    mainWindow?.webContents.send('bridge-hint-generated', entry)
  })
  await bridgeApi.start()
  return { ok: true }
})

ipcMain.handle('bridge-stop', async () => {
  if (bridgeApi) {
    await bridgeApi.stop()
    bridgeApi = null
  }
  return { ok: true }
})

ipcMain.handle('bridge-status', async () => {
  if (!bridgeApi) return { running: false, extensionConnected: false }
  const state = bridgeApi.getExtensionState()
  return { running: true, ...state }
})

ipcMain.handle('bridge-hint-history', async () => {
  if (!bridgeApi) return []
  return bridgeApi.getHintHistory()
})

ipcMain.handle('bridge-generate-hint', async (_event, body: {
  code: string; pageTitle?: string; language?: string | null; userContext?: string; manualContext?: string
}) => {
  if (!bridgeApi) throw new Error('Bridge is not running')
  return bridgeApi.generateHint(body)
})

// ---------------------------------------------------------------------------
// Free Code Interview IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('free-code-create-session', async (_e, task: string, language?: string, framework?: string) => {
  return freeCodeSessionManager.createSession(task, language, framework)
})

ipcMain.handle('free-code-generate-plan', async (_e, sessionId: string) => {
  const session = await freeCodeSessionManager.getSession(sessionId)
  if (!session) throw new Error('Session not found')

  const providers = getAvailableProviders()
  if (providers.length === 0) throw new Error('No AI provider configured')

  const langHint = session.language ? ` using ${session.language}` : ''
  const fwHint = session.framework ? ` with ${session.framework}` : ''
  const prompt = `You are a senior software engineer helping a candidate build "${session.task}" from scratch in a coding interview${langHint}${fwHint}.

Generate a feature-level build plan. Each feature should be a meaningful, self-contained piece of functionality that produces visible, working behavior. Order them the way a pragmatic developer actually codes: get something working end-to-end first, then layer on more features. Do NOT start with type definitions, interfaces, or data models in isolation — those should emerge inline as part of building real functionality. The first feature should produce something the user can see or interact with, even if rough.

Aim for 5-8 features.

Return ONLY valid JSON (no markdown code blocks, no extra text):
{
  "features": [
    {
      "id": "f1",
      "title": "Feature title",
      "reasoning": "Why this is built first and what it enables"
    }
  ]
}`

  const raw = await getAnswer(prompt, providers[0], { cv: '', jobDescription: '', manualContext: '' })
  let parsed: { features: Array<{ id: string; title: string; reasoning: string }> }
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(m ? m[0] : raw)
  } catch {
    throw new Error('Failed to parse plan from AI response')
  }

  session.features = parsed.features.map(f => ({ ...f, status: 'todo' as const }))
  await freeCodeSessionManager.saveSession(session)
  return session.features
})

ipcMain.handle('free-code-expand-feature', async (_e, sessionId: string, featureId: string) => {
  const session = await freeCodeSessionManager.getSession(sessionId)
  if (!session) throw new Error('Session not found')
  const feature = session.features.find(f => f.id === featureId)
  if (!feature) throw new Error('Feature not found')

  const providers = getAvailableProviders()
  if (providers.length === 0) throw new Error('No AI provider configured')

  const langHint = session.language ? `\nLanguage: ${session.language}` : ''
  const fwHint = session.framework ? `\nFramework: ${session.framework}` : ''
  const prompt = `You are a senior software engineer. Break down this feature into implementation steps in the order you would actually write the code.

Task: "${session.task}"${langHint}${fwHint}
Feature: "${feature.title}"
Why: ${feature.reasoning}

Each step should be a single unit of work (one function, one component, one handler, etc.). Lead with steps that produce working behavior — define types and interfaces inline as needed, not as separate upfront steps. A step like "Create Task interface" on its own is not useful; instead fold types into the step that first uses them (e.g. "Build the add-task form with Task type").

Return ONLY valid JSON (no markdown code blocks, no extra text):
{
  "subSteps": [
    {
      "id": "${featureId}-s1",
      "title": "Step title",
      "reasoning": "What this step achieves and why it is needed"
    }
  ]
}`

  const raw = await getAnswer(prompt, providers[0], { cv: '', jobDescription: '', manualContext: '' })
  let parsed: { subSteps: Array<{ id: string; title: string; reasoning: string }> }
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(m ? m[0] : raw)
  } catch {
    throw new Error('Failed to parse sub-steps from AI response')
  }

  const subSteps = parsed.subSteps.map(s => ({ ...s, featureId, status: 'todo' as const }))
  const fi = session.features.findIndex(f => f.id === featureId)
  session.features[fi] = { ...feature, subSteps }
  await freeCodeSessionManager.saveSession(session)
  return subSteps
})

ipcMain.handle('free-code-expand-substep', async (_e, sessionId: string, featureId: string, subStepId: string) => {
  const session = await freeCodeSessionManager.getSession(sessionId)
  if (!session) throw new Error('Session not found')
  const feature = session.features.find(f => f.id === featureId)
  const subStep = feature?.subSteps?.find(s => s.id === subStepId)
  if (!feature || !subStep) throw new Error('Step not found')

  const providers = getAvailableProviders()
  if (providers.length === 0) throw new Error('No AI provider configured')

  const langHint = session.language ? `\nLanguage: ${session.language}` : ''
  const fwHint = session.framework ? `\nFramework: ${session.framework}` : ''
  const prompt = `You are a senior software engineer. Provide the implementation code and decision rationale for this step.

Task: "${session.task}"${langHint}${fwHint}
Feature: "${feature.title}"
Step: "${subStep.title}"
Why: ${subStep.reasoning}

Return ONLY valid JSON (no markdown code blocks, no extra text):
{
  "code": "the complete code for this step",
  "decisionProcess": "detailed explanation: data structures chosen, algorithm rationale, edge cases, trade-offs"
}`

  const raw = await getAnswer(prompt, providers[0], { cv: '', jobDescription: '', manualContext: '' })
  let parsed: { code: string; decisionProcess: string }
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(m ? m[0] : raw)
  } catch {
    throw new Error('Failed to parse step detail from AI response')
  }

  const fi = session.features.findIndex(f => f.id === featureId)
  const si = session.features[fi].subSteps!.findIndex(s => s.id === subStepId)
  session.features[fi].subSteps![si] = { ...subStep, code: parsed.code, decisionProcess: parsed.decisionProcess }
  await freeCodeSessionManager.saveSession(session)
  return { code: parsed.code, decisionProcess: parsed.decisionProcess }
})

ipcMain.handle('free-code-check-progress', async (_e, sessionId: string, currentCode: string, filename: string, openFiles?: Array<{ filePath: string; fileName: string; language: string; code?: string }>) => {
  const session = await freeCodeSessionManager.getSession(sessionId)
  if (!session) return { completedIds: [] }

  const providers = getAvailableProviders()
  if (providers.length === 0) return { completedIds: [] }

  const pending: Array<{ id: string; title: string }> = []
  for (const f of session.features) {
    if (f.subSteps) {
      for (const s of f.subSteps) {
        if (s.status !== 'done') pending.push({ id: s.id, title: s.title })
      }
    }
  }
  if (pending.length === 0) return { completedIds: [] }

  // Build code context — include active file plus other open files up to a budget
  const CODE_BUDGET = 12000
  let codeContext = `Active file (${filename}):\n\`\`\`\n${currentCode}\n\`\`\``
  let used = codeContext.length

  if (openFiles && openFiles.length > 0) {
    for (const f of openFiles) {
      if (!f.code || f.fileName === filename) continue
      const block = `\n\nFile (${f.filePath || f.fileName}):\n\`\`\`\n${f.code}\n\`\`\``
      if (used + block.length > CODE_BUDGET) break
      codeContext += block
      used += block.length
    }
  }

  const list = pending.map(s => `- ${s.id}: ${s.title}`).join('\n')
  const prompt = `You are reviewing code to determine which implementation steps have been completed.

Task: "${session.task}"

${codeContext}

Pending steps:
${list}

Mark a step as completed if the code clearly implements its core logic. Be generous — partial implementations count.

Return ONLY valid JSON (no markdown code blocks, no extra text):
{
  "completedIds": ["step-id-1", "step-id-2"]
}`

  try {
    const raw = await getAnswer(prompt, providers[0], { cv: '', jobDescription: '', manualContext: '' })
    const m = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(m ? m[0] : raw)
    return { completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : [] }
  } catch {
    return { completedIds: [] }
  }
})

ipcMain.handle('free-code-aside-answer', async (_e, sessionId: string, question: string, currentCode?: string, filename?: string, activeFeatureTitle?: string, openFiles?: Array<{ filePath: string; fileName: string; language: string; code?: string }>) => {
  const session = await freeCodeSessionManager.getSession(sessionId)
  if (!session) throw new Error('Session not found')

  const providers = getAvailableProviders()
  if (providers.length === 0) throw new Error('No AI provider configured')

  const featureCtx = activeFeatureTitle ? ` and is currently working on the "${activeFeatureTitle}" feature` : ''
  let prompt = `You are a coding interview coach. The candidate is building "${session.task}"${featureCtx}.

An interviewer has just asked a question. Answer it concisely and helpfully, tailored to the build context.`

  if (currentCode) {
    const CODE_BUDGET = 8000
    let codeContext = `\n\nCurrent code in ${filename || 'editor'}:\n\`\`\`\n${currentCode}\n\`\`\``
    let used = codeContext.length

    if (openFiles && openFiles.length > 0) {
      for (const f of openFiles) {
        if (!f.code || f.fileName === filename) continue
        const block = `\n\nFile (${f.filePath || f.fileName}):\n\`\`\`\n${f.code}\n\`\`\``
        if (used + block.length > CODE_BUDGET) break
        codeContext += block
        used += block.length
      }
    }

    prompt += codeContext
  }

  prompt += `\n\nInterviewer's question: "${question}"\n\nReturn ONLY valid JSON (no markdown code blocks, no extra text):\n{\n  "answer": "your clear, concise answer"\n}`

  const raw = await getAnswer(prompt, providers[0], { cv: '', jobDescription: '', manualContext: '' })
  let answer: string
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(m ? m[0] : raw)
    answer = parsed.answer || raw
  } catch {
    answer = raw
  }

  const entry = {
    id: Date.now().toString(),
    question,
    answer,
    timestamp: new Date().toISOString(),
    activeFeatureTitle,
  }
  session.asideHistory.unshift(entry)
  await freeCodeSessionManager.saveSession(session)
  return entry
})

ipcMain.handle('free-code-list-sessions', async () => {
  return freeCodeSessionManager.listSessions()
})

ipcMain.handle('free-code-get-session', async (_e, sessionId: string) => {
  return freeCodeSessionManager.getSession(sessionId)
})

ipcMain.handle('free-code-delete-session', async (_e, sessionId: string) => {
  return freeCodeSessionManager.deleteSession(sessionId)
})

ipcMain.handle('free-code-save-session', async (_e, session: FreeCodeSessionData) => {
  return freeCodeSessionManager.saveSession(session)
})

// ---------------------------------------------------------------------------
// API Key IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('get-api-keys', async () => {
  return loadApiKeys()
})

ipcMain.handle('set-api-key', async (_event, provider: 'anthropic' | 'gemini' | 'openai' | 'qwen' | 'cosyvoice', apiKey: string) => {
  const keys = loadApiKeys()
  if (provider === 'anthropic') {
    keys.anthropicApiKey = apiKey
  } else if (provider === 'gemini') {
    keys.geminiApiKey = apiKey
  } else if (provider === 'openai') {
    keys.openaiApiKey = apiKey
  } else if (provider === 'qwen') {
    keys.qwenApiKey = apiKey
  } else if (provider === 'cosyvoice') {
    keys.cosyvoiceApiKey = apiKey
  }
  saveApiKeys(keys)
})

ipcMain.handle('clear-api-key', async (_event, provider: 'anthropic' | 'gemini' | 'openai' | 'qwen' | 'cosyvoice') => {
  const keys = loadApiKeys()
  if (provider === 'cosyvoice') {
    delete keys.cosyvoiceApiKey
    saveApiKeys(keys)
  } else {
    clearApiKey(provider)
  }
})

ipcMain.handle('set-qwen-model', async (_event, model: string) => {
  const keys = loadApiKeys()
  keys.qwenModel = model
  saveApiKeys(keys)
})

ipcMain.handle('list-qwen-models', async (_event, region: string = 'intl') => {
  try {
    const keys = loadApiKeys()
    if (!keys.qwenApiKey) {
      return []
    }
    
    // Determine the appropriate endpoint based on the region
    let baseUrl: string
    switch (region) {
      case 'china':
        baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        break
      case 'usa':
        baseUrl = 'https://dashscope-us-east-1.aliyuncs.com/compatible-mode/v1'
        break
      case 'intl':
      default:
        baseUrl = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
        break
    }
    
    // Try the OpenAI-compatible endpoint for models
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${keys.qwenApiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      console.error(`Failed to fetch Qwen models from ${baseUrl}: ${response.status} ${response.statusText}`)
      // Return an empty array - the frontend will show default models
      return []
    }
    
    const data = await response.json()
    // Check if the response has the expected structure
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((m: any) => m.id).filter(Boolean)
    } else {
      // If the response doesn't have the expected structure, return an empty array
      console.warn('Unexpected response structure when fetching Qwen models:', data)
      return []
    }
  } catch (error) {
    console.error('Error fetching Qwen models:', error)
    // Return an empty array - the frontend will show default models
    return []
  }
})

ipcMain.handle('set-custom-provider', async (_event, config: CustomProviderConfig) => {
  const keys = loadApiKeys()
  keys.customProvider = config
  saveApiKeys(keys)
})

ipcMain.handle('clear-custom-provider', async () => {
  const keys = loadApiKeys()
  delete keys.customProvider
  saveApiKeys(keys)
})

ipcMain.handle('set-local-tts', async (_event, url: string, model?: string) => {
  const keys = loadApiKeys()
  keys.localTtsUrl = url
  keys.localTtsModel = model || undefined
  saveApiKeys(keys)
})

ipcMain.handle('clear-local-tts', async () => {
  const keys = loadApiKeys()
  delete keys.localTtsUrl
  delete keys.localTtsModel
  saveApiKeys(keys)
})

ipcMain.handle('set-local-stt', async (_event, url: string, model?: string) => {
  const keys = loadApiKeys()
  keys.localSttUrl = url
  keys.localSttModel = model || undefined
  saveApiKeys(keys)
})

ipcMain.handle('clear-local-stt', async () => {
  const keys = loadApiKeys()
  delete keys.localSttUrl
  delete keys.localSttModel
  saveApiKeys(keys)
})

ipcMain.handle('test-local-tts', async (_event, url: string, model?: string): Promise<ArrayBuffer | null> => {
  const testManager = new TTSProviderManager()
  testManager.setConfig({ provider: 'local', baseUrl: url, model: model || undefined })
  try {
    const response = await testManager.synthesize('Hello, this is a test.')
    if (!response.audioBuffer) return null
    return response.audioBuffer.buffer.slice(response.audioBuffer.byteOffset, response.audioBuffer.byteOffset + response.audioBuffer.byteLength)
  } catch (error) {
    console.error('[TTS Test]', error instanceof Error ? error.message : error)
    return null
  }
})

ipcMain.handle('test-local-stt', async (_event, url: string, model?: string): Promise<{ ok: boolean; message: string }> => {
  // Build a minimal 0.1s silence WAV (16kHz mono 16-bit PCM)
  const sampleRate = 16000
  const numSamples = Math.floor(sampleRate * 0.1)
  const dataBytes = numSamples * 2 // 16-bit = 2 bytes per sample
  const wavBuffer = Buffer.alloc(44 + dataBytes)
  wavBuffer.write('RIFF', 0)
  wavBuffer.writeUInt32LE(36 + dataBytes, 4)
  wavBuffer.write('WAVE', 8)
  wavBuffer.write('fmt ', 12)
  wavBuffer.writeUInt32LE(16, 16)       // PCM chunk size
  wavBuffer.writeUInt16LE(1, 20)        // PCM format
  wavBuffer.writeUInt16LE(1, 22)        // mono
  wavBuffer.writeUInt32LE(sampleRate, 24)
  wavBuffer.writeUInt32LE(sampleRate * 2, 28) // byte rate
  wavBuffer.writeUInt16LE(2, 32)        // block align
  wavBuffer.writeUInt16LE(16, 34)       // bits per sample
  wavBuffer.write('data', 36)
  wavBuffer.writeUInt32LE(dataBytes, 40)
  // samples remain zero (silence)

  try {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey: 'no-key', baseURL: url, timeout: 30000 })
    const file = new File([wavBuffer], 'test.wav', { type: 'audio/wav' })
    await client.audio.transcriptions.create({ model: model || 'whisper-1', file, response_format: 'text' })
    return { ok: true, message: 'STT server responded successfully' }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const isTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')
    return { ok: false, message: isTimeout ? 'Timed out after 30s — model may still be loading, try again' : msg }
  }
})

ipcMain.handle('set-stt-provider', async (_event, provider: 'openai' | 'gemini' | 'qwen' | 'custom' | 'local' | null) => {
  const keys = loadApiKeys()
  keys.preferredSttProvider = provider ?? undefined
  saveApiKeys(keys)
})

ipcMain.handle('set-audio-device', async (_event, type: 'input' | 'output', deviceId: string) => {
  const keys = loadApiKeys()
  if (type === 'input') {
    keys.audioInputDeviceId = deviceId
  } else {
    keys.audioOutputDeviceId = deviceId
  }
  saveApiKeys(keys)
})

ipcMain.handle('test-custom-provider', async (_event, config: CustomProviderConfig) => {
  return testCustomProvider(config)
})

ipcMain.handle('list-custom-provider-models', async (_event, baseUrl: string) => {
  try {
    const res = await fetch(`${baseUrl}/models`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.data ?? []).map((m: { id: string }) => m.id).filter(Boolean)
  } catch {
    return []
  }
})

ipcMain.handle('get-auth-status', async () => {
  const availableProviders = getAvailableProviders()
  return {
    loggedIn: true,
    isActive: true,
    availableProviders,
    transcriptionsUsed: 0,
    transcriptionLimit: null,
    snapshotsUsed: 0,
    snapshotLimit: null,
    hasCodeSnapshot: availableProviders.includes('claude'),
  }
})

ipcMain.handle('open-subscribe', async () => { /* no-op */ })
ipcMain.handle('open-manage-subscription', async () => { /* no-op */ })

ipcMain.handle('open-external-url', async (_event, url: string) => {
  shell.openExternal(url)
})

// ---------------------------------------------------------------------------
// Interview IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('interview-create-session', async (_event, jobDescription: string, resume: string) => {
  const keys = loadApiKeys()
  console.log('[IPC] interview-create-session received', {
    hasCosyvoiceKey: !!keys.cosyvoiceApiKey,
    availableLlmProviders: getAvailableProviders(),
    hasCustomProvider: !!keys.customProvider?.baseUrl,
  })

  // Select a random voice for this session
  const voices = ['Cherry', 'Ethan', 'Kai', 'Ryan', 'Aiden', 'Jennifer']
  const randomVoice = voices[Math.floor(Math.random() * voices.length)]

  // Configure TTS — prefer local > cosyvoice
  let ttsConfig: Parameters<typeof ttsManager.setConfig>[0] | undefined
  if (keys.localTtsUrl) {
    console.log('[IPC] Configuring TTS with local provider:', keys.localTtsUrl)
    ttsConfig = { provider: 'local', baseUrl: keys.localTtsUrl, model: keys.localTtsModel }
  } else if (keys.cosyvoiceApiKey) {
    console.log('[IPC] Configuring TTS with Qwen3 TTS, voice:', randomVoice)
    ttsConfig = { provider: 'cosyvoice', apiKey: keys.cosyvoiceApiKey, model: 'qwen3-tts-flash', voice: randomVoice }
  } else {
    console.log('[IPC] No TTS configured, falling back to browser speech synthesis')
  }
  if (ttsConfig) ttsManager.setConfig(ttsConfig)

  // Create session (this will throw if no LLM provider is configured)
  const metadata = await sessionManager.createSession(jobDescription, resume)
  console.log('[IPC] Session created:', metadata.sessionId)

  // Start orchestrator with the session
  await interviewOrchestrator.startRealTimeVoiceInterview({
    sessionId: metadata.sessionId,
    llmProvider: getFirstProvider(keys),
    jobDescription,
    resume,
    ttsConfig
  })
  return metadata
})

ipcMain.handle('interview-list-sessions', async () => {
  return sessionManager.listSessions()
})

ipcMain.handle('interview-get-session', async (_event, sessionId: string) => {
  return sessionManager.getSession(sessionId)
})

ipcMain.handle('interview-generate-opener', async (_event, sessionId: string) => {
  return interviewOrchestrator.generateOpener()
})

ipcMain.handle('interview-process-turn', async (_event, sessionId: string, userText: string, audioBuffer?: ArrayBuffer) => {
  // Save user audio if provided
  if (audioBuffer) {
    try {
      await interviewOrchestrator.saveUserAudio(Buffer.from(audioBuffer))
      console.log('[Interview] Saved user audio for turn')
    } catch (err) {
      console.warn('[Interview] Failed to save user audio:', err)
      // Continue processing even if audio save fails
    }
  }
  return interviewOrchestrator.processUserResponse(userText)
})

ipcMain.handle('interview-end-session', async (_event, sessionId: string, isComplete: boolean) => {
  return interviewOrchestrator.endInterview(isComplete)
})

ipcMain.handle('interview-generate-summary', async (_event, sessionId: string) => {
  return interviewOrchestrator.generateSummary(sessionId)
})

ipcMain.handle('interview-delete-session', async (_event, sessionId: string) => {
  return sessionManager.deleteSession(sessionId)
})

ipcMain.handle('interview-delete-all-sessions', async () => {
  console.log('[Interview] Starting delete all sessions')
  try {
    await sessionManager.deleteAllSessions()
    console.log('[Interview] Delete all sessions completed')
  } catch (err) {
    console.error('[Interview] Delete all sessions failed:', err)
    throw err
  }
})

ipcMain.handle('interview-synthesize', async (_event, text: string) => {
  if (!ttsManager.getConfig()) {
    console.warn('[TTS IPC] No TTS config set')
    return null
  }
  try {
    console.log('[TTS IPC] Synthesizing text:', text.substring(0, 50) + '...')
    const response = await ttsManager.synthesize(text)
    if (!response.audioBuffer) {
      console.warn('[TTS IPC] No audio buffer in response')
      return null
    }
    console.log('[TTS IPC] Synthesis successful, returning buffer:', response.audioBuffer.length, 'bytes')

    // Save the question audio to the current session for later playback during review
    if (interviewOrchestrator.getSessionId()) {
      try {
        await interviewOrchestrator.saveQuestionAudio(response.audioBuffer)
        console.log('[TTS IPC] Saved question audio to session')
      } catch (saveError) {
        console.warn('[TTS IPC] Failed to save question audio:', saveError)
        // Don't fail the entire synthesis if saving fails
      }
    }

    return response.audioBuffer.buffer.slice(response.audioBuffer.byteOffset, response.audioBuffer.byteOffset + response.audioBuffer.byteLength)
  } catch (error) {
    console.error('[TTS IPC] Synthesis failed:', error instanceof Error ? error.message : error)
    if (error instanceof Error) {
      console.error('[TTS IPC] Stack:', error.stack)
    }
    return null
  }
})

ipcMain.handle('interview-get-audio', async (_event, sessionId: string, turn: number, type: 'question' | 'response') => {
  try {
    const fs = require('fs')
    const path = require('path')
    const os = require('os')

    const SESSIONS_DIR = path.join(os.homedir(), '.mooch', 'interview-sessions')
    const sessionPath = path.join(SESSIONS_DIR, `interview-${sessionId}`)
    const filename = type === 'question' ? `question-turn-${turn}.wav` : `user-turn-${turn}.wav`
    const audioPath = path.join(sessionPath, 'audio', filename)

    if (!fs.existsSync(audioPath)) {
      console.warn('[Interview Audio] File not found:', audioPath)
      return null
    }

    const audioBuffer = fs.readFileSync(audioPath)
    return audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength)
  } catch (error) {
    console.error('[Interview Audio] Failed to read audio:', error)
    return null
  }
})

// Helper to get the first available LLM provider
function getFirstProvider(keys: any): AIProvider {
  const available = getAvailableProviders()
  if (available.length === 0) {
    throw new Error('No LLM provider configured. Please set an API key in Settings.')
  }
  return available[0]
}

// ---------------------------------------------------------------------------
// Copilot IPC handlers (direct API calls)
// ---------------------------------------------------------------------------

ipcMain.handle('transcribe-audio', async (_event, buffer: ArrayBuffer) => {
  return transcribeAudio(Buffer.from(buffer))
})

ipcMain.handle('get-answer', async (_event, question: string, provider: AIProvider, context: UserContext) => {
  return getAnswer(question, provider, context)
})

ipcMain.handle('get-available-providers', async () => {
  return getAvailableProviders()
})

ipcMain.handle('get-interview-providers', async (_event, preferredLlm?: string) => {
  const keys = loadApiKeys()
  const available = getAvailableProviders()
  const llm = preferredLlm && available.includes(preferredLlm as AIProvider)
    ? preferredLlm
    : available.length > 0 ? available[0] : null

  let tts: string | null = null
  if (keys.localTtsUrl) tts = 'local'
  else if (keys.cosyvoiceApiKey) tts = 'cosyvoice'
  else tts = 'browser'

  let stt: string | null = null
  if (keys.preferredSttProvider) {
    stt = keys.preferredSttProvider
  } else if (keys.localSttUrl) {
    stt = 'local'
  } else if (keys.openaiApiKey) {
    stt = 'openai'
  } else if (keys.geminiApiKey) {
    stt = 'gemini'
  } else if (keys.qwenApiKey) {
    stt = 'qwen'
  } else if (keys.customProvider?.sttEnabled) {
    stt = 'custom'
  }

  return { llm, tts, stt }
})

ipcMain.handle('analyze-code-snapshot', async (_event, imageBase64: string, context?: string) => {
  const keys = loadApiKeys()
  if (keys.qwenApiKey) {
    return analyzeCodeSnapshotQwen(imageBase64, context)
  }
  if (keys.customProvider?.baseUrl && keys.customProvider?.model) {
    return analyzeCodeSnapshotCustom(imageBase64, keys.customProvider, context)
  }
  return analyzeCodeSnapshot(imageBase64, context)
})

ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    })

    if (sources.length === 0) {
      throw new Error('No screen sources available')
    }

    // Get the primary screen and return as PNG base64
    const thumbnail = sources[0].thumbnail
    return thumbnail.toPNG().toString('base64')
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Screen capture failed')
  }
})

ipcMain.handle('get-window-sources', async () => {
  try {
    console.log('[get-window-sources] Fetching available windows...')
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 320, height: 180 }
    })

    console.log(`[get-window-sources] Found ${sources.length} windows:`)
    sources.forEach((source, idx) => {
      console.log(`  [${idx}] id="${source.id}", name="${source.name}"`)
    })

    // Cache the sources for use in capture-window
    cachedWindowSources = sources
    cacheTimestamp = Date.now()
    console.log('[get-window-sources] Cached window sources for 30 seconds')

    const result = sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toPNG().toString('base64')
    }))

    console.log('[get-window-sources] Returning window list to renderer')
    return result
  } catch (err) {
    console.error('[get-window-sources] Error:', err)
    throw new Error(err instanceof Error ? err.message : 'Failed to get window sources')
  }
})

ipcMain.handle('capture-window', async (_event, sourceId: string) => {
  try {
    console.log(`[capture-window] Attempting to capture window with id="${sourceId}"`)

    // Check if we have a recent cache
    const cacheAge = Date.now() - cacheTimestamp
    const useCache = cachedWindowSources.length > 0 && cacheAge < CACHE_DURATION_MS

    if (useCache) {
      console.log(`[capture-window] Using cached window sources (age: ${Math.round(cacheAge / 1000)}s)`)
      console.log(`[capture-window] Cached sources (${cachedWindowSources.length} windows):`)
      cachedWindowSources.forEach((source, idx) => {
        const match = source.id === sourceId ? ' ← MATCH' : ''
        console.log(`  [${idx}] id="${source.id}", name="${source.name}"${match}`)
      })

      // Try to find in cache first
      const cachedSource = cachedWindowSources.find(s => s.id === sourceId)
      if (cachedSource) {
        console.log(`[capture-window] Found window in cache: "${cachedSource.name}"`)
        console.log('[capture-window] Re-capturing with high resolution...')

        // Re-capture the window with high resolution using the same source
        const highResSources = await desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: 1920, height: 1080 }
        })

        // Find by name since ID might change
        const highResSource = highResSources.find(s =>
          s.name === cachedSource.name && s.display_id === cachedSource.display_id
        )

        if (highResSource) {
          console.log('[capture-window] Successfully re-captured window in high resolution')
          const imageData = highResSource.thumbnail.toPNG().toString('base64')
          console.log(`[capture-window] Captured ${imageData.length} bytes, returning to renderer`)
          return imageData
        }

        console.log('[capture-window] Window not found in fresh capture, falling back to cached thumbnail')
        // Fallback: use the cached thumbnail (lower res, but better than nothing)
        const imageData = cachedSource.thumbnail.toPNG().toString('base64')
        return imageData
      }
    } else {
      console.log('[capture-window] Cache is stale or empty, fetching fresh window list...')
    }

    // Fallback to direct fetch if cache miss or stale
    console.log('[capture-window] Fetching current window list...')
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 1920, height: 1080 }
    })

    console.log(`[capture-window] Found ${sources.length} windows:`)
    sources.forEach((source, idx) => {
      const match = source.id === sourceId ? ' ← MATCH' : ''
      console.log(`  [${idx}] id="${source.id}", name="${source.name}"${match}`)
    })

    const source = sources.find(s => s.id === sourceId)
    if (!source) {
      console.error(`[capture-window] ERROR: Window with id="${sourceId}" not found!`)
      console.error('[capture-window] Available window IDs:')
      sources.forEach(s => console.error(`  - "${s.id}" (${s.name})`))
      throw new Error('Window not found')
    }

    console.log(`[capture-window] Successfully found window: "${source.name}"`)
    console.log('[capture-window] Capturing high-res thumbnail...')
    const imageData = source.thumbnail.toPNG().toString('base64')
    console.log(`[capture-window] Captured ${imageData.length} bytes, returning to renderer`)

    return imageData
  } catch (err) {
    console.error('[capture-window] Error:', err)
    throw new Error(err instanceof Error ? err.message : 'Window capture failed')
  }
})

ipcMain.handle('start-area-selection', async () => {
  try {
    console.log('[start-area-selection] Opening area selection overlay')

    // Get primary display bounds
    const primaryDisplay = screen.getPrimaryDisplay()
    const { x, y, width, height } = primaryDisplay.bounds

    // Create transparent overlay window
    areaSelectionWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      fullscreen: false,
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    // Load the area selector HTML
    if (process.env['ELECTRON_RENDERER_URL']) {
      areaSelectionWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/area-selector.html')
    } else {
      areaSelectionWindow.loadFile(join(__dirname, '../renderer/area-selector.html'))
    }

    // Return a promise that resolves when user completes selection
    return new Promise<CropRect | null>((resolve) => {
      areaSelectionResolve = resolve

      // If window is closed without selection, resolve with null
      areaSelectionWindow?.on('closed', () => {
        if (areaSelectionResolve) {
          areaSelectionResolve(null)
          areaSelectionResolve = null
        }
        areaSelectionWindow = null
      })
    })
  } catch (err) {
    console.error('[start-area-selection] Error:', err)
    throw new Error(err instanceof Error ? err.message : 'Failed to start area selection')
  }
})

ipcMain.handle('complete-area-selection', (_event, rect: CropRect | null) => {
  console.log('[complete-area-selection] Area selection completed:', rect)
  if (areaSelectionResolve) {
    areaSelectionResolve(rect)
    areaSelectionResolve = null
  }
  if (areaSelectionWindow) {
    areaSelectionWindow.close()
    areaSelectionWindow = null
  }
})

ipcMain.handle('capture-screen-area', async (_event, rect: CropRect) => {
  try {
    console.log('[capture-screen-area] Capturing screen area:', rect)

    // Capture full screen
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 3840, height: 2160 } // High resolution
    })

    if (sources.length === 0) {
      throw new Error('No screen sources available')
    }

    const fullScreenImage = sources[0].thumbnail

    // Get the actual screen dimensions
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds
    const scaleFactor = primaryDisplay.scaleFactor

    // Calculate the crop rectangle with scale factor
    const cropRect = {
      x: Math.round(rect.x * scaleFactor),
      y: Math.round(rect.y * scaleFactor),
      width: Math.round(rect.width * scaleFactor),
      height: Math.round(rect.height * scaleFactor)
    }

    console.log('[capture-screen-area] Screen size:', screenWidth, 'x', screenHeight)
    console.log('[capture-screen-area] Scale factor:', scaleFactor)
    console.log('[capture-screen-area] Original rect:', rect)
    console.log('[capture-screen-area] Scaled crop rect:', cropRect)

    // Crop the image
    const croppedImage = fullScreenImage.crop(cropRect)

    // Return as PNG base64
    return croppedImage.toPNG().toString('base64')
  } catch (err) {
    console.error('[capture-screen-area] Error:', err)
    throw new Error(err instanceof Error ? err.message : 'Screen area capture failed')
  }
})

// ---------------------------------------------------------------------------
// Utility IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('load-text-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Text files', extensions: ['md', 'txt', 'pdf'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const name = filePath.split(/[\\/]/).pop() ?? ''

  // Handle PDF files separately
  if (filePath.toLowerCase().endsWith('.pdf')) {
    try {
      const pdfBuffer = await fs.readFile(filePath)
      const parser = new PDFParse({ data: pdfBuffer })
      const data = await parser.getText()
      await parser.destroy()
      return { name, content: data.text }
    } catch (err) {
      console.error('Failed to parse PDF:', err)
      throw new Error('Failed to extract text from PDF')
    }
  }

  // For text files, read as UTF-8
  const content = readFileSync(filePath, 'utf-8')
  return { name, content }
})

ipcMain.handle('get-desktop-source-id', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources[0]?.id ?? ''
  } catch (err) {
    // User denied screen recording permission
    throw new Error('Screen recording permission denied. Please allow screen recording in your system settings to use system audio.')
  }
})

ipcMain.handle('get-api-url', async () => {
  return ''
})

ipcMain.handle('restart-app', () => {
  app.relaunch()
  app.exit(0)
})

ipcMain.handle('quit-app', () => {
  app.quit()
})

ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

// ---------------------------------------------------------------------------
// Global push-to-talk hotkey (Ctrl+Shift+Space)
// ---------------------------------------------------------------------------

function setupHotkey(): void {
  let held = false

  uIOhook.on('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.keycode === UiohookKey.Space && !held) {
      held = true
      mainWindow?.webContents.send('hotkey-record-start')
    }
  })

  uIOhook.on('keyup', (e) => {
    if (e.keycode === UiohookKey.Space && held) {
      held = false
      mainWindow?.webContents.send('hotkey-record-stop')
    }
  })

  uIOhook.start()
}

// Required on Linux for Web Speech API (SpeechRecognition)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-speech-dispatcher')
}

// Catch unhandled errors to prevent app crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in main process:', error)
  // Don't exit - let the app continue running
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in main process:', reason)
  // Don't exit - let the app continue running
})

app.whenReady().then(() => {
  // Allow microphone access for Web Speech API (SpeechRecognition)
  // Without this handler, Electron silently denies the permission request
  // and the audio pipeline fails with "OnSizeReceived failed error-2"
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media'
  })

  createWindow()
  setupHotkey()

  // Auto-start the local bridge API so the Chrome extension can probe it
  bridgeApi = new LocalBridgeApi()
  bridgeApi.setOnExtensionUpdate((state) => {
    mainWindow?.webContents.send('bridge-extension-update', state)
  })
  bridgeApi.setOnHintGenerated((entry) => {
    mainWindow?.webContents.send('bridge-hint-generated', entry)
  })
  bridgeApi.start().catch((err) => {
    console.error('[Bridge API] Failed to auto-start:', err)
  })
})

app.on('will-quit', () => {
  uIOhook.stop()
  if (bridgeApi) {
    bridgeApi.stop().catch(() => {})
  }
})

app.on('window-all-closed', () => {
  app.quit()
})
