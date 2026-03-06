export type AIProvider = 'claude' | 'gemini' | 'openai'
export type AudioSource = 'microphone' | 'system' 
export type TextSize = 'small' | 'medium' | 'large' | 'extra-large'
export type OAuthProvider = 'google' | 'github' | 'discord'

export interface OAuthUser {
  loggedIn: boolean
  email: string | null
  username: string | null
}

export interface UserContext {
  cv: string
  jobDescription: string
  manualContext: string
}

export interface UserApiKeys {
  anthropicApiKey?: string
  geminiApiKey?: string
  openaiApiKey?: string
}

export interface WindowSource {
  id: string
  name: string
  thumbnail: string // base64 PNG
}

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface AuthStatus {
  loggedIn: boolean
  isActive?: boolean
  subscriptionStatus?: string | null
  subscriptionPlan?: string | null
  availableProviders?: AIProvider[]
  transcriptionsUsed?: number
  transcriptionLimit?: number | null
  snapshotsUsed?: number
  snapshotLimit?: number | null
  hasCodeSnapshot?: boolean
}

export interface ElectronAPI {
  // Auth
  login: (email: string, password: string) => Promise<AuthStatus | null>
  logout: () => Promise<void>
  getAuthStatus: () => Promise<AuthStatus>
  openSubscribe: () => Promise<void>
  openManageSubscription: () => Promise<void>
  openExternalUrl: (url: string) => Promise<void>
  openOAuth: (provider: OAuthProvider) => Promise<void>
  onOAuthSuccess: (callback: (user: OAuthUser) => void) => () => void
  onAuthStatusUpdate: (callback: (status: AuthStatus) => void) => () => void
  // Copilot
  transcribeAudio: (buffer: ArrayBuffer) => Promise<string>
  getAnswer: (question: string, provider: AIProvider, context: UserContext) => Promise<string>
  getAvailableProviders: () => Promise<AIProvider[]>
  analyzeCodeSnapshot: (imageBase64: string, context?: string) => Promise<string>
  captureScreen: () => Promise<string>
  getWindowSources: () => Promise<WindowSource[]>
  captureWindow: (sourceId: string) => Promise<string>
  startAreaSelection: () => Promise<CropRect | null>
  captureScreenArea: (rect: CropRect) => Promise<string>
  completeAreaSelection: (rect: CropRect | null) => Promise<void>
  // Utilities
  getDesktopSourceId: () => Promise<string>
  loadTextFile: () => Promise<{ name: string; content: string } | null>
  restartApp: () => Promise<void>
  quitApp: () => Promise<void>
  getAppVersion: () => Promise<string>
  getApiUrl: () => Promise<string>
  // API Keys
  getApiKeys: () => Promise<UserApiKeys>
  setApiKey: (provider: 'anthropic' | 'gemini' | 'openai', apiKey: string) => Promise<void>
  clearApiKey: (provider: 'anthropic' | 'gemini' | 'openai') => Promise<void>
  // Hotkeys
  onHotkeyRecordStart: (callback: () => void) => () => void
  onHotkeyRecordStop: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
