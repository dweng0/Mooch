export type AIProvider = 'claude' | 'gemini' | 'openai' | 'qwen' | 'custom'
export type AudioSource = 'microphone' | 'system'
export type TextSize = 'small' | 'medium' | 'large' | 'extra-large'
export type OAuthProvider = 'google' | 'github' | 'discord'
export type TTSProvider = 'cosyvoice' | 'openai' | 'elevenlabs' | 'local'

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

export interface CustomProviderConfig {
  baseUrl: string
  apiKey: string
  model: string
  label?: string
  sttEnabled?: boolean
  sttModel?: string
}

export interface UserApiKeys {
  anthropicApiKey?: string
  geminiApiKey?: string
  openaiApiKey?: string
  qwenApiKey?: string
  qwenModel?: string
  customProvider?: CustomProviderConfig
  preferredSttProvider?: 'openai' | 'gemini' | 'qwen' | 'custom' | 'local'
  cosyvoiceApiKey?: string
  localTtsUrl?: string
  localTtsModel?: string
  localSttUrl?: string
  localSttModel?: string
}

export interface InterviewFeedback {
  turn: number
  timestamp: string
  audioFile: string
  questionAudioFile?: string
  llmQuestion: string
  userResponseText: string
  feedback: {
    rating: 'excellent' | 'good' | 'solid' | 'fair' | 'weak'
    comment: string
    context?: {
      jobRequirement?: string
      resumeSkill?: string
      conversationNote?: string
    }
  }
}

export interface InterviewSessionMetadata {
  sessionId: string
  createdAt: string
  updatedAt: string
  jobTitle: string
  isComplete: boolean
  totalTurns: number
}

export interface InterviewSession {
  metadata: InterviewSessionMetadata
  jobDescription: string
  resume: string
  transcript: string
  feedback: InterviewFeedback[]
}

export interface InterviewTurn {
  turn: number
  userText: string
  llmQuestion: string
  llmFeedback: {
    rating: 'excellent' | 'good' | 'solid' | 'fair' | 'weak'
    comment: string
    context?: { jobRequirement?: string; resumeSkill?: string; conversationNote?: string }
  }
}

export type InterviewStatus = 'idle' | 'analyzing' | 'questioning' | 'thinking' | 'formulating' | 'speaking' | 'responding' | 'listening' | 'processing' | 'complete'

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
  setApiKey: (provider: 'anthropic' | 'gemini' | 'openai' | 'qwen' | 'cosyvoice', apiKey: string) => Promise<void>
  clearApiKey: (provider: 'anthropic' | 'gemini' | 'openai' | 'qwen' | 'cosyvoice') => Promise<void>
  setLocalTts: (url: string, model?: string) => Promise<void>
  clearLocalTts: () => Promise<void>
  testLocalTts: (url: string, model?: string) => Promise<ArrayBuffer | null>
  setLocalStt: (url: string, model?: string) => Promise<void>
  clearLocalStt: () => Promise<void>
  testLocalStt: (url: string, model?: string) => Promise<{ ok: boolean; message: string }>
  setQwenModel: (model: string) => Promise<void>
  // Custom provider
  setCustomProvider: (config: CustomProviderConfig) => Promise<void>
  clearCustomProvider: () => Promise<void>
  setSttProvider: (provider: 'openai' | 'gemini' | 'qwen' | 'custom' | 'local' | null) => Promise<void>
  testCustomProvider: (config: CustomProviderConfig) => Promise<{ reasoning: boolean; stt: boolean }>
  // Hotkeys
  onHotkeyRecordStart: (callback: () => void) => () => void
  onHotkeyRecordStop: (callback: () => void) => () => void
  // Interview
  interviewCreateSession: (jobDescription: string, resume: string) => Promise<InterviewSessionMetadata>
  interviewListSessions: () => Promise<InterviewSessionMetadata[]>
  interviewGetSession: (sessionId: string) => Promise<InterviewSession | null>
  interviewGenerateOpener: (sessionId: string) => Promise<string>
  interviewProcessTurn: (sessionId: string, userText: string) => Promise<InterviewTurn>
  interviewEndSession: (sessionId: string, isComplete: boolean) => Promise<void>
  interviewDeleteSession: (sessionId: string) => Promise<void>
  interviewDeleteAllSessions: () => Promise<void>
  interviewSynthesize: (text: string) => Promise<ArrayBuffer | null>
  interviewGetAudio: (sessionId: string, turn: number, type: 'question' | 'response') => Promise<ArrayBuffer | null>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
