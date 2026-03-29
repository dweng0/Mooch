import { contextBridge, ipcRenderer } from 'electron'
import type { AIProvider, UserContext, AuthStatus, WindowSource, CropRect, UserApiKeys, OAuthProvider, OAuthUser, CustomProviderConfig, InterviewSessionMetadata, InterviewSession, InterviewTurn, InterviewSummary, FreeCodeSessionData } from '../shared/types'

/** IPC bridge between the renderer process and the main process, exposed as window.electronAPI. */
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Auth ──────────────────────────────────────────────────────────────────
  /** Returns the current authentication status. */
  getAuthStatus: (): Promise<AuthStatus> => {
    return ipcRenderer.invoke('get-auth-status')
  },
  /** Opens the subscription page in the default browser. */
  openSubscribe: (): Promise<void> => {
    return ipcRenderer.invoke('open-subscribe')
  },
  /** Opens the subscription management page in the default browser. */
  openManageSubscription: (): Promise<void> => {
    return ipcRenderer.invoke('open-manage-subscription')
  },
  /** Opens an external URL in the default browser. */
  openExternalUrl: (url: string): Promise<void> => {
    return ipcRenderer.invoke('open-external-url', url)
  },

  // ── Copilot ───────────────────────────────────────────────────────────────
  /** Transcribes an audio buffer to text using speech-to-text. */
  transcribeAudio: (buffer: ArrayBuffer): Promise<string> => {
    return ipcRenderer.invoke('transcribe-audio', buffer)
  },
  /** Sends a question to an AI provider and returns the answer. */
  getAnswer: (question: string, provider: AIProvider, context: UserContext): Promise<string> => {
    return ipcRenderer.invoke('get-answer', question, provider, context)
  },
  /** Returns the list of AI providers currently available. */
  getAvailableProviders: (): Promise<AIProvider[]> => {
    return ipcRenderer.invoke('get-available-providers')
  },
  /** Resolves the best available LLM, TTS, and STT providers for an interview session. */
  getInterviewProviders: (preferredLlm?: string): Promise<{ llm: string | null; tts: string | null; stt: string | null }> => {
    return ipcRenderer.invoke('get-interview-providers', preferredLlm)
  },
  /** Analyzes a code screenshot using vision AI and returns observations. */
  analyzeCodeSnapshot: (imageBase64: string, context?: string): Promise<string> => {
    return ipcRenderer.invoke('analyze-code-snapshot', imageBase64, context)
  },
  /** Captures the entire screen and returns a base64-encoded image. */
  captureScreen: (): Promise<string> => {
    return ipcRenderer.invoke('capture-screen')
  },
  /** Returns the list of available window sources for screen capture. */
  getWindowSources: (): Promise<WindowSource[]> => {
    return ipcRenderer.invoke('get-window-sources')
  },
  /** Captures a specific window by its source ID and returns a base64-encoded image. */
  captureWindow: (sourceId: string): Promise<string> => {
    return ipcRenderer.invoke('capture-window', sourceId)
  },
  /** Opens the area-selection overlay and returns the selected crop rectangle. */
  startAreaSelection: (): Promise<CropRect | null> => {
    return ipcRenderer.invoke('start-area-selection')
  },
  /** Captures a rectangular area of the screen and returns a base64-encoded image. */
  captureScreenArea: (rect: CropRect): Promise<string> => {
    return ipcRenderer.invoke('capture-screen-area', rect)
  },
  /** Completes the area selection process with the given crop rectangle. */
  completeAreaSelection: (rect: CropRect | null): Promise<void> => {
    return ipcRenderer.invoke('complete-area-selection', rect)
  },

  // ── Utilities ─────────────────────────────────────────────────────────────
  /** Returns the desktop source ID for screen capture. */
  getDesktopSourceId: (): Promise<string> => {
    return ipcRenderer.invoke('get-desktop-source-id')
  },
  /** Opens a file dialog and returns the selected text file's name and content. */
  loadTextFile: (): Promise<{ name: string; content: string } | null> => {
    return ipcRenderer.invoke('load-text-file')
  },
  /** Returns the configured API base URL. */
  getApiUrl: (): Promise<string> => {
    return ipcRenderer.invoke('get-api-url')
  },
  /** Restarts the Electron application. */
  restartApp: (): Promise<void> => {
    return ipcRenderer.invoke('restart-app')
  },
  /** Quits the Electron application. */
  quitApp: (): Promise<void> => {
    return ipcRenderer.invoke('quit-app')
  },
  /** Returns the current application version string. */
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('get-app-version')
  },

  // ── API Keys ───────────────────────────────────────────────────────────────
  /** Returns all stored user API keys. */
  getApiKeys: (): Promise<UserApiKeys> => {
    return ipcRenderer.invoke('get-api-keys')
  },
  /** Stores an API key for the specified provider. */
  setApiKey: (provider: 'anthropic' | 'gemini' | 'openai' | 'qwen', apiKey: string): Promise<void> => {
    return ipcRenderer.invoke('set-api-key', provider, apiKey)
  },
  /** Removes the stored API key for the specified provider. */
  clearApiKey: (provider: 'anthropic' | 'gemini' | 'openai' | 'qwen'): Promise<void> => {
    return ipcRenderer.invoke('clear-api-key', provider)
  },
  /** Sets the model name to use with the Qwen provider. */
  setQwenModel: (model: string): Promise<void> => {
    return ipcRenderer.invoke('set-qwen-model', model)
  },
  /** Lists available models from the Qwen provider. */
  listQwenModels: (region?: string): Promise<string[]> => {
    return ipcRenderer.invoke('list-qwen-models', region)
  },
  /** Saves a custom OpenAI-compatible provider configuration. */
  setCustomProvider: (config: CustomProviderConfig): Promise<void> => {
    return ipcRenderer.invoke('set-custom-provider', config)
  },
  /** Removes the custom provider configuration. */
  clearCustomProvider: (): Promise<void> => {
    return ipcRenderer.invoke('clear-custom-provider')
  },
  /** Sets the preferred speech-to-text provider. */
  setSttProvider: (provider: 'openai' | 'gemini' | 'qwen' | 'custom' | 'local' | null): Promise<void> => {
    return ipcRenderer.invoke('set-stt-provider', provider)
  },
  /** Saves the preferred audio input or output device ID. */
  setAudioDevice: (type: 'input' | 'output', deviceId: string): Promise<void> => {
    return ipcRenderer.invoke('set-audio-device', type, deviceId)
  },
  /** Configures a local TTS endpoint URL and optional model. */
  setLocalTts: (url: string, model?: string): Promise<void> => {
    return ipcRenderer.invoke('set-local-tts', url, model)
  },
  /** Removes the local TTS configuration. */
  clearLocalTts: (): Promise<void> => {
    return ipcRenderer.invoke('clear-local-tts')
  },
  /** Tests a local TTS endpoint and returns synthesized audio on success. */
  testLocalTts: (url: string, model?: string): Promise<ArrayBuffer | null> => {
    return ipcRenderer.invoke('test-local-tts', url, model)
  },
  /** Configures a local STT endpoint URL and optional model. */
  setLocalStt: (url: string, model?: string): Promise<void> => {
    return ipcRenderer.invoke('set-local-stt', url, model)
  },
  /** Removes the local STT configuration. */
  clearLocalStt: (): Promise<void> => {
    return ipcRenderer.invoke('clear-local-stt')
  },
  /** Tests a local STT endpoint and returns a status message. */
  testLocalStt: (url: string, model?: string): Promise<{ ok: boolean; message: string }> => {
    return ipcRenderer.invoke('test-local-stt', url, model)
  },
  /** Tests a custom provider configuration for reasoning and STT support. */
  testCustomProvider: (config: CustomProviderConfig): Promise<{ reasoning: boolean; stt: boolean }> => {
    return ipcRenderer.invoke('test-custom-provider', config)
  },
  /** Lists available models from a custom provider's base URL. */
  listCustomProviderModels: (baseUrl: string): Promise<string[]> => {
    return ipcRenderer.invoke('list-custom-provider-models', baseUrl)
  },

  // ── Hotkey events ─────────────────────────────────────────────────────────
  /** Registers a callback for when the record hotkey is pressed. */
  onHotkeyRecordStart: (callback: () => void) => {
    ipcRenderer.on('hotkey-record-start', callback)
    return () => { ipcRenderer.removeListener('hotkey-record-start', callback) }
  },
  /** Registers a callback for when the record hotkey is released. */
  onHotkeyRecordStop: (callback: () => void) => {
    ipcRenderer.on('hotkey-record-stop', callback)
    return () => { ipcRenderer.removeListener('hotkey-record-stop', callback) }
  },

  /** Registers a callback for OAuth success events. */
  onOAuthSuccess: (callback: (user: OAuthUser) => void) => {
    const handler = (_event: any, user: OAuthUser) => callback(user)
    ipcRenderer.on('oauth:success', handler)
    return () => { ipcRenderer.removeListener('oauth:success', handler) }
  },

  /** Registers a callback for auth status update events. */
  onAuthStatusUpdate: (callback: (status: AuthStatus) => void) => {
    const handler = (_event: any, status: AuthStatus) => callback(status)
    ipcRenderer.on('auth:status', handler)
    return () => { ipcRenderer.removeListener('auth:status', handler) }
  },

  // ── Interview ─────────────────────────────────────────────────────────────
  /** Creates a new mock interview session from a job description and resume. */
  interviewCreateSession: (jobDescription: string, resume: string): Promise<InterviewSessionMetadata> => {
    return ipcRenderer.invoke('interview-create-session', jobDescription, resume)
  },
  /** Returns metadata for all stored interview sessions. */
  interviewListSessions: (): Promise<InterviewSessionMetadata[]> => {
    return ipcRenderer.invoke('interview-list-sessions')
  },
  /** Returns the full interview session data for a given session ID. */
  interviewGetSession: (sessionId: string): Promise<InterviewSession | null> => {
    return ipcRenderer.invoke('interview-get-session', sessionId)
  },
  /** Generates the opening question for an interview session. */
  interviewGenerateOpener: (sessionId: string): Promise<string> => {
    return ipcRenderer.invoke('interview-generate-opener', sessionId)
  },
  /** Processes a user's answer and returns the next interview turn. */
  interviewProcessTurn: (sessionId: string, userText: string, audioBuffer?: ArrayBuffer): Promise<InterviewTurn> => {
    return ipcRenderer.invoke('interview-process-turn', sessionId, userText, audioBuffer)
  },
  /** Ends an interview session, optionally marking it as complete. */
  interviewEndSession: (sessionId: string, isComplete: boolean): Promise<void> => {
    return ipcRenderer.invoke('interview-end-session', sessionId, isComplete)
  },
  /** Generates a performance summary for a completed interview session. */
  interviewGenerateSummary: (sessionId: string): Promise<InterviewSummary> => {
    return ipcRenderer.invoke('interview-generate-summary', sessionId)
  },
  /** Deletes a single interview session by ID. */
  interviewDeleteSession: (sessionId: string): Promise<void> => {
    return ipcRenderer.invoke('interview-delete-session', sessionId)
  },
  /** Synthesizes text to speech audio for interview playback. */
  interviewSynthesize: (text: string): Promise<ArrayBuffer | null> => {
    return ipcRenderer.invoke('interview-synthesize', text)
  },
  /** Retrieves stored audio for a specific interview turn. */
  interviewGetAudio: (sessionId: string, turn: number, type: 'question' | 'response'): Promise<ArrayBuffer | null> => {
    return ipcRenderer.invoke('interview-get-audio', sessionId, turn, type)
  },
  /** Deletes all stored interview sessions. */
  interviewDeleteAllSessions: (): Promise<void> => {
    return ipcRenderer.invoke('interview-delete-all-sessions')
  },

  // ── Bridge API (Chrome extension integration) ────────────────────────────
  /** Starts the WebSocket bridge server for Chrome extension communication. */
  bridgeStart: (): Promise<{ ok: boolean }> => {
    return ipcRenderer.invoke('bridge-start')
  },
  /** Stops the WebSocket bridge server. */
  bridgeStop: (): Promise<{ ok: boolean }> => {
    return ipcRenderer.invoke('bridge-stop')
  },
  /** Returns the current bridge connection status and metadata. */
  /** Generates a hint directly via the bridge (without going through the HTTP server). Fires onBridgeHintGenerated. */
  bridgeGenerateHint: (body: { code: string; pageTitle?: string; language?: string | null; userContext?: string; manualContext?: string }): Promise<{ answer: string; explanation: string }> => {
    return ipcRenderer.invoke('bridge-generate-hint', body)
  },
  bridgeStatus: (): Promise<{ running: boolean; connected: boolean; lastSeen: number; clientType: 'chrome-extension' | 'vscode-extension' | 'unknown'; code?: string; pageTitle?: string; language?: string | null; manualContext?: string }> => {
    return ipcRenderer.invoke('bridge-status')
  },
  /** Returns the history of hints generated via the bridge. */
  bridgeHintHistory: (): Promise<Array<{ hint: string; timestamp: number; pageTitle?: string; language?: string | null }>> => {
    return ipcRenderer.invoke('bridge-hint-history')
  },
  /** Registers a callback for bridge extension state updates. */
  onBridgeExtensionUpdate: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state)
    ipcRenderer.on('bridge-extension-update', handler)
    return () => { ipcRenderer.removeListener('bridge-extension-update', handler) }
  },
  /** Registers a callback for newly generated bridge hints. */
  onBridgeHintGenerated: (callback: (entry: any) => void) => {
    const handler = (_event: any, entry: any) => callback(entry)
    ipcRenderer.on('bridge-hint-generated', handler)
    return () => { ipcRenderer.removeListener('bridge-hint-generated', handler) }
  },

  // ── Free Code Interview ───────────────────────────────────────────────────
  freeCodeCreateSession: (task: string, language?: string, framework?: string): Promise<FreeCodeSessionData> =>
    ipcRenderer.invoke('free-code-create-session', task, language, framework),
  freeCodeGeneratePlan: (sessionId: string) =>
    ipcRenderer.invoke('free-code-generate-plan', sessionId),
  freeCodeExpandFeature: (sessionId: string, featureId: string) =>
    ipcRenderer.invoke('free-code-expand-feature', sessionId, featureId),
  freeCodeExpandSubStep: (sessionId: string, featureId: string, subStepId: string) =>
    ipcRenderer.invoke('free-code-expand-substep', sessionId, featureId, subStepId),
  freeCodeCheckProgress: (sessionId: string, currentCode: string, filename: string, openFiles?: Array<{ filePath: string; fileName: string; language: string; code?: string }>) =>
    ipcRenderer.invoke('free-code-check-progress', sessionId, currentCode, filename, openFiles),
  freeCodeAsideAnswer: (sessionId: string, question: string, currentCode?: string, filename?: string, activeFeatureTitle?: string, openFiles?: Array<{ filePath: string; fileName: string; language: string; code?: string }>) =>
    ipcRenderer.invoke('free-code-aside-answer', sessionId, question, currentCode, filename, activeFeatureTitle, openFiles),
  freeCodeListSessions: (): Promise<FreeCodeSessionData[]> =>
    ipcRenderer.invoke('free-code-list-sessions'),
  freeCodeGetSession: (sessionId: string): Promise<FreeCodeSessionData | null> =>
    ipcRenderer.invoke('free-code-get-session', sessionId),
  freeCodeDeleteSession: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('free-code-delete-session', sessionId),
  freeCodeSaveSession: (session: FreeCodeSessionData): Promise<void> =>
    ipcRenderer.invoke('free-code-save-session', session),
})
