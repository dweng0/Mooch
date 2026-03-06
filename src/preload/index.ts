import { contextBridge, ipcRenderer } from 'electron'
import type { AIProvider, UserContext, AuthStatus, WindowSource, CropRect, UserApiKeys, OAuthProvider, OAuthUser, CustomProviderConfig } from '../shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login: (email: string, password: string): Promise<AuthStatus | null> => {
    return ipcRenderer.invoke('login', email, password)
  },
  logout: (): Promise<void> => {
    return ipcRenderer.invoke('logout')
  },
  getAuthStatus: (): Promise<AuthStatus> => {
    return ipcRenderer.invoke('get-auth-status')
  },
  openSubscribe: (): Promise<void> => {
    return ipcRenderer.invoke('open-subscribe')
  },
  openManageSubscription: (): Promise<void> => {
    return ipcRenderer.invoke('open-manage-subscription')
  },
  openExternalUrl: (url: string): Promise<void> => {
    return ipcRenderer.invoke('open-external-url', url)
  },
  openOAuth: (provider: OAuthProvider): Promise<void> => {
    return ipcRenderer.invoke('open-oauth', provider)
  },

  // ── Copilot ───────────────────────────────────────────────────────────────
  transcribeAudio: (buffer: ArrayBuffer): Promise<string> => {
    return ipcRenderer.invoke('transcribe-audio', buffer)
  },
  getAnswer: (question: string, provider: AIProvider, context: UserContext): Promise<string> => {
    return ipcRenderer.invoke('get-answer', question, provider, context)
  },
  getAvailableProviders: (): Promise<AIProvider[]> => {
    return ipcRenderer.invoke('get-available-providers')
  },
  analyzeCodeSnapshot: (imageBase64: string, context?: string): Promise<string> => {
    return ipcRenderer.invoke('analyze-code-snapshot', imageBase64, context)
  },
  captureScreen: (): Promise<string> => {
    return ipcRenderer.invoke('capture-screen')
  },
  getWindowSources: (): Promise<WindowSource[]> => {
    return ipcRenderer.invoke('get-window-sources')
  },
  captureWindow: (sourceId: string): Promise<string> => {
    return ipcRenderer.invoke('capture-window', sourceId)
  },
  startAreaSelection: (): Promise<CropRect | null> => {
    return ipcRenderer.invoke('start-area-selection')
  },
  captureScreenArea: (rect: CropRect): Promise<string> => {
    return ipcRenderer.invoke('capture-screen-area', rect)
  },
  completeAreaSelection: (rect: CropRect | null): Promise<void> => {
    return ipcRenderer.invoke('complete-area-selection', rect)
  },

  // ── Utilities ─────────────────────────────────────────────────────────────
  getDesktopSourceId: (): Promise<string> => {
    return ipcRenderer.invoke('get-desktop-source-id')
  },
  loadTextFile: (): Promise<{ name: string; content: string } | null> => {
    return ipcRenderer.invoke('load-text-file')
  },
  getApiUrl: (): Promise<string> => {
    return ipcRenderer.invoke('get-api-url')
  },
  restartApp: (): Promise<void> => {
    return ipcRenderer.invoke('restart-app')
  },
  quitApp: (): Promise<void> => {
    return ipcRenderer.invoke('quit-app')
  },
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('get-app-version')
  },

  // ── API Keys ───────────────────────────────────────────────────────────────
  getApiKeys: (): Promise<UserApiKeys> => {
    return ipcRenderer.invoke('get-api-keys')
  },
  setApiKey: (provider: 'anthropic' | 'gemini' | 'openai' | 'qwen', apiKey: string): Promise<void> => {
    return ipcRenderer.invoke('set-api-key', provider, apiKey)
  },
  clearApiKey: (provider: 'anthropic' | 'gemini' | 'openai' | 'qwen'): Promise<void> => {
    return ipcRenderer.invoke('clear-api-key', provider)
  },
  setQwenModel: (model: string): Promise<void> => {
    return ipcRenderer.invoke('set-qwen-model', model)
  },
  setCustomProvider: (config: CustomProviderConfig): Promise<void> => {
    return ipcRenderer.invoke('set-custom-provider', config)
  },
  clearCustomProvider: (): Promise<void> => {
    return ipcRenderer.invoke('clear-custom-provider')
  },

  // ── Hotkey events ─────────────────────────────────────────────────────────
  onHotkeyRecordStart: (callback: () => void) => {
    ipcRenderer.on('hotkey-record-start', callback)
    return () => { ipcRenderer.removeListener('hotkey-record-start', callback) }
  },
  onHotkeyRecordStop: (callback: () => void) => {
    ipcRenderer.on('hotkey-record-stop', callback)
    return () => { ipcRenderer.removeListener('hotkey-record-stop', callback) }
  },

  // ── OAuth events (via WebSocket) ──────────────────────────────────────────
  onOAuthSuccess: (callback: (user: OAuthUser) => void) => {
    const handler = (_event: any, user: OAuthUser) => callback(user)
    ipcRenderer.on('oauth:success', handler)
    return () => { ipcRenderer.removeListener('oauth:success', handler) }
  },
  onAuthStatusUpdate: (callback: (status: AuthStatus) => void) => {
    const handler = (_event: any, status: AuthStatus) => callback(status)
    ipcRenderer.on('auth:status', handler)
    return () => { ipcRenderer.removeListener('auth:status', handler) }
  }
})
