/**
 * Represents the available AI providers supported by the application.
 */
export type AIProvider = 'claude' | 'gemini' | 'openai' | 'qwen' | 'custom'

/**
 * A single hotkey binding: a main key plus modifier flags.
 * The key name matches the UiohookKey enum (e.g. "Space", "A", "F1").
 */
export interface HotkeyBinding {
  /** Key name, e.g. "Space", "A", "F1". */
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

/**
 * All four configurable recording hotkeys.
 */
export interface HotkeyConfig {
  /** Push-to-talk: record from microphone while held. */
  activeMic: HotkeyBinding
  /** Push-to-talk: record from system audio while held. */
  activeSystem: HotkeyBinding
  /** Toggle passive listening on the microphone. */
  passiveMic: HotkeyBinding
  /** Toggle passive listening on system audio. */
  passiveSystem: HotkeyBinding
}

/** Default hotkey bindings shipped with the app. */
export const DEFAULT_HOTKEY_CONFIG: HotkeyConfig = {
  activeMic:     { key: 'Space', ctrl: true, shift: true, alt: false, meta: false },
  activeSystem:  { key: 'Space', ctrl: true, shift: false, alt: true,  meta: false },
  passiveMic:    { key: 'M',     ctrl: true, shift: true, alt: false, meta: false },
  passiveSystem: { key: 'S',     ctrl: true, shift: true, alt: false, meta: false },
}

/**
 * Represents the available audio sources for recording.
 */
export type AudioSource = 'microphone' | 'system'

/**
 * Represents the available text size options for UI elements.
 */
export type TextSize = 'small' | 'medium' | 'large' | 'extra-large'

/**
 * Represents the available OAuth providers for authentication.
 */
export type OAuthProvider = 'google' | 'github' | 'discord'

/**
 * Represents the available TTS (Text-to-Speech) providers.
 */
export type TTSProvider = 'cosyvoice' | 'openai' | 'elevenlabs' | 'local'

/**
 * Represents an OAuth user with login status and profile information.
 */
export interface OAuthUser {
  /** Whether the user is currently logged in. */
  loggedIn: boolean
  /** The user's email address, or null if not available. */
  email: string | null
  /** The user's username, or null if not available. */
  username: string | null
}

/**
 * Represents the user context used for AI-powered responses, including CV, job description, and manual context.
 */
export interface UserContext {
  /** The user's curriculum vitae or resume content. */
  cv: string
  /** The job description for the interview. */
  jobDescription: string
  /** Additional manual context provided by the user. */
  manualContext: string
}

/**
 * Configuration for a custom OpenAI-compatible provider.
 */
export interface CustomProviderConfig {
  /** The base URL of the custom provider API. */
  baseUrl: string
  /** The API key for authentication. */
  apiKey: string
  /** The model name to use with this provider. */
  model: string
  /** Optional label to display for this provider in the UI. */
  label?: string
  /** Whether STT (Speech-to-Text) is enabled for this provider. */
  sttEnabled?: boolean
  /** Optional STT model name to use with this provider. */
  sttModel?: string
}

/**
 * Stores all user API keys and provider configurations.
 */
export interface UserApiKeys {
  /** Anthropic API key for Claude models. */
  anthropicApiKey?: string
  /** Google Gemini API key. */
  geminiApiKey?: string
  /** OpenAI API key for GPT models and Whisper STT. */
  openaiApiKey?: string
  /** Qwen API key for Alibaba Cloud models. */
  qwenApiKey?: string
  /** Qwen model name to use. */
  qwenModel?: string
  /** Configuration for a custom OpenAI-compatible provider. */
  customProvider?: CustomProviderConfig
  /** Preferred STT provider for speech-to-text transcription. */
  preferredSttProvider?: 'openai' | 'gemini' | 'qwen' | 'custom' | 'local'
  /** CosyVoice API key for TTS synthesis. */
  cosyvoiceApiKey?: string
  /** Local TTS endpoint URL. */
  localTtsUrl?: string
  /** Local TTS model name. */
  localTtsModel?: string
  /** Local STT endpoint URL. */
  localSttUrl?: string
  /** Local STT model name. */
  localSttModel?: string
  /** Preferred audio input (microphone) device ID. */
  audioInputDeviceId?: string
  /** Preferred audio output (speaker) device ID. */
  audioOutputDeviceId?: string
}

/**
 * Feedback data for a single interview turn, including rating and contextual analysis.
 */
export interface InterviewFeedback {
  /** The turn number in the interview sequence. */
  turn: number
  /** ISO timestamp when the feedback was generated. */
  timestamp: string
  /** Path to the audio file containing the user's response. */
  audioFile: string
  /** Optional path to the audio file containing the interviewer's question. */
  questionAudioFile?: string
  /** The interview question asked by the LLM. */
  llmQuestion: string
  /** The transcribed text of the user's spoken response. */
  userResponseText: string
  /** The LLM-generated feedback on the user's response. */
  feedback: {
    /** Rating of the response quality. */
    rating: 'excellent' | 'good' | 'solid' | 'fair' | 'weak'
    /** Detailed comment explaining the rating. */
    comment: string
    /** Contextual information about the feedback. */
    context?: {
      /** Job requirement that was addressed or missed. */
      jobRequirement?: string
      /** Resume skill that was demonstrated or referenced. */
      resumeSkill?: string
      /** General conversation flow notes. */
      conversationNote?: string
    }
  }
}

/**
 * Metadata for an interview session, including creation time and completion status.
 */
export interface InterviewSessionMetadata {
  /** Unique identifier for the session. */
  sessionId: string
  /** ISO timestamp when the session was created. */
  createdAt: string
  /** ISO timestamp when the session was last updated. */
  updatedAt: string
  /** Extracted job title from the job description. */
  jobTitle: string
  /** Whether the interview session is complete. */
  isComplete: boolean
  /** Total number of turns in the interview. */
  totalTurns: number
  /** Average rating across all turns (1-5 scale). */
  averageRating?: number
}

/**
 * Summary of an interview session with performance metrics and improvement areas.
 */
export interface InterviewSummary {
  /** Average rating across all turns (1-5 scale). */
  averageRating: number // 1–5
  /** List of areas where the candidate can improve. */
  areasOfImprovement: string[]
  /** List of areas where the candidate performed well. */
  areasOfStrength: string[]
}

/**
 * Complete interview session data including metadata, content, and feedback.
 */
export interface InterviewSession {
  /** Session metadata including ID, timestamps, and status. */
  metadata: InterviewSessionMetadata
  /** Full job description provided at session creation. */
  jobDescription: string
  /** Full resume/CV content provided at session creation. */
  resume: string
  /** Complete conversation transcript in markdown format. */
  transcript: string
  /** Array of feedback objects for each interview turn. */
  feedback: InterviewFeedback[]
  /** Optional performance summary generated after completion. */
  summary?: InterviewSummary
}

/**
 * Data for a single turn in an ongoing interview session.
 */
export interface InterviewTurn {
  /** The turn number in the interview sequence. */
  turn: number
  /** The transcribed text of the user's spoken response. */
  userText: string
  /** The interview question generated by the LLM. */
  llmQuestion: string
  /** The LLM-generated feedback on the user's response. */
  llmFeedback: {
    /** Rating of the response quality. */
    rating: 'excellent' | 'good' | 'solid' | 'fair' | 'weak'
    /** Detailed comment explaining the rating. */
    comment: string
    /** Contextual information about the feedback. */
    context?: { 
      /** Job requirement that was addressed or missed. */
      jobRequirement?: string; 
      /** Resume skill that was demonstrated or referenced. */
      resumeSkill?: string; 
      /** General conversation flow notes. */
      conversationNote?: string 
    }
  }
}

/**
 * Represents the current status of an interview session.
 */
export type InterviewStatus = 'idle' | 'analyzing' | 'questioning' | 'thinking' | 'formulating' | 'speaking' | 'responding' | 'listening' | 'processing' | 'complete'

/**
 * Represents a window source available for screen capture.
 */
export interface WindowSource {
  /** Unique identifier for the window source. */
  id: string
  /** Display name of the window. */
  name: string
  /** Base64-encoded PNG thumbnail of the window. */
  thumbnail: string // base64 PNG
}

/**
 * Represents a rectangular crop area for screen capture.
 */
export interface CropRect {
  /** X coordinate of the top-left corner. */
  x: number
  /** Y coordinate of the top-left corner. */
  y: number
  /** Width of the rectangle. */
  width: number
  /** Height of the rectangle. */
  height: number
}

/**
 * Authentication and subscription status from the backend.
 */
export interface AuthStatus {
  /** Whether the user is currently logged in. */
  loggedIn: boolean
  /** Whether the user's subscription is active. */
  isActive?: boolean
  /** Current subscription status string. */
  subscriptionStatus?: string | null
  /** Current subscription plan name. */
  subscriptionPlan?: string | null
  /** List of AI providers available to this user. */
  availableProviders?: AIProvider[]
  /** Number of transcriptions used in the current period. */
  transcriptionsUsed?: number
  /** Maximum number of transcriptions allowed (null for unlimited). */
  transcriptionLimit?: number | null
  /** Number of code snapshots used in the current period. */
  snapshotsUsed?: number
  /** Maximum number of code snapshots allowed (null for unlimited). */
  snapshotLimit?: number | null
  /** Whether the user has access to code snapshot analysis. */
  hasCodeSnapshot?: boolean
}

/**
 * Electron API interface exposed to the renderer process via contextBridge.
 */
export interface ElectronAPI {
  // Auth
  /** Returns the current authentication status. */
  getAuthStatus: () => Promise<AuthStatus>
  /** Opens the subscription page in the default browser. */
  openSubscribe: () => Promise<void>
  /** Opens the subscription management page in the default browser. */
  openManageSubscription: () => Promise<void>
  /** Opens an external URL in the default browser. */
  openExternalUrl: (url: string) => Promise<void>
  /** Registers a callback for OAuth success events. */
  onOAuthSuccess: (callback: (user: OAuthUser) => void) => () => void
  /** Registers a callback for auth status update events. */
  onAuthStatusUpdate: (callback: (status: AuthStatus) => void) => () => void
  // Copilot
  /** Transcribes an audio buffer to text using speech-to-text. */
  transcribeAudio: (buffer: ArrayBuffer) => Promise<string>
  /** Sends a question to an AI provider and returns the answer. */
  getAnswer: (question: string, provider: AIProvider, context: UserContext) => Promise<string>
  /** Returns the list of AI providers currently available. */
  getAvailableProviders: () => Promise<AIProvider[]>
  /** Resolves the best available LLM, TTS, and STT providers for an interview session. */
  getInterviewProviders: (preferredLlm?: string) => Promise<{ llm: string | null; tts: string | null; stt: string | null }>
  /** Analyzes a code screenshot using vision AI and returns observations. */
  analyzeCodeSnapshot: (imageBase64: string, context?: string) => Promise<string>
  /** Captures the entire screen and returns a base64-encoded image. */
  captureScreen: () => Promise<string>
  /** Returns the list of available window sources for screen capture. */
  getWindowSources: () => Promise<WindowSource[]>
  /** Captures a specific window by its source ID and returns a base64-encoded image. */
  captureWindow: (sourceId: string) => Promise<string>
  /** Opens the area-selection overlay and returns the selected crop rectangle. */
  startAreaSelection: () => Promise<CropRect | null>
  /** Captures a rectangular area of the screen and returns a base64-encoded image. */
  captureScreenArea: (rect: CropRect) => Promise<string>
  /** Completes the area selection process with the given crop rectangle. */
  completeAreaSelection: (rect: CropRect | null) => Promise<void>
  // Utilities
  /** Returns the desktop source ID for screen capture. */
  getDesktopSourceId: () => Promise<string>
  /** Opens a file dialog and returns the selected text file's name and content. */
  loadTextFile: () => Promise<{ name: string; content: string } | null>
  /** Restarts the Electron application. */
  restartApp: () => Promise<void>
  /** Quits the Electron application. */
  quitApp: () => Promise<void>
  /** Returns the current application version string. */
  getAppVersion: () => Promise<string>
  /** Returns the configured API base URL. */
  getApiUrl: () => Promise<string>
  // API Keys
  /** Returns all stored user API keys. */
  getApiKeys: () => Promise<UserApiKeys>
  /** Stores an API key for the specified provider. */
  setApiKey: (provider: 'anthropic' | 'gemini' | 'openai' | 'qwen' | 'cosyvoice', apiKey: string) => Promise<void>
  /** Removes the stored API key for the specified provider. */
  clearApiKey: (provider: 'anthropic' | 'gemini' | 'openai' | 'qwen' | 'cosyvoice') => Promise<void>
  /** Sets the model name to use with the Qwen provider. */
  setLocalTts: (url: string, model?: string) => Promise<void>
  /** Removes the local TTS configuration. */
  clearLocalTts: () => Promise<void>
  /** Tests a local TTS endpoint and returns synthesized audio on success. */
  testLocalTts: (url: string, model?: string) => Promise<ArrayBuffer | null>
  /** Configures a local STT endpoint URL and optional model. */
  setLocalStt: (url: string, model?: string) => Promise<void>
  /** Removes the local STT configuration. */
  clearLocalStt: () => Promise<void>
  /** Tests a local STT endpoint and returns a status message. */
  testLocalStt: (url: string, model?: string) => Promise<{ ok: boolean; message: string }>
  /** Sets the model name to use with the Qwen provider. */
  setQwenModel: (model: string) => Promise<void>
  /** Lists available models from the Qwen provider. */
  listQwenModels: (region?: string) => Promise<string[]>
  // Custom provider
  /** Saves a custom OpenAI-compatible provider configuration. */
  setCustomProvider: (config: CustomProviderConfig) => Promise<void>
  /** Removes the custom provider configuration. */
  clearCustomProvider: () => Promise<void>
  /** Sets the preferred speech-to-text provider. */
  setSttProvider: (provider: 'openai' | 'gemini' | 'qwen' | 'custom' | 'local' | null) => Promise<void>
  /** Saves the preferred audio input or output device ID. */
  setAudioDevice: (type: 'input' | 'output', deviceId: string) => Promise<void>
  /** Tests a custom provider configuration for reasoning and STT support. */
  testCustomProvider: (config: CustomProviderConfig) => Promise<{ reasoning: boolean; stt: boolean }>
  // Hotkeys
  /** Registers a callback for when the record hotkey is pressed. */
  onHotkeyRecordStart: (callback: () => void) => () => void
  /** Registers a callback for when the record hotkey is released. */
  onHotkeyRecordStop: (callback: () => void) => () => void
  // Interview
  /** Creates a new mock interview session from a job description and resume. */
  interviewCreateSession: (jobDescription: string, resume: string) => Promise<InterviewSessionMetadata>
  /** Returns metadata for all stored interview sessions. */
  interviewListSessions: () => Promise<InterviewSessionMetadata[]>
  /** Returns the full interview session data for a given session ID. */
  interviewGetSession: (sessionId: string) => Promise<InterviewSession | null>
  /** Generates the opening question for an interview session. */
  interviewGenerateOpener: (sessionId: string) => Promise<string>
  /** Processes a user's answer and returns the next interview turn. */
  interviewProcessTurn: (sessionId: string, userText: string) => Promise<InterviewTurn>
  /** Ends an interview session, optionally marking it as complete. */
  interviewEndSession: (sessionId: string, isComplete: boolean) => Promise<void>
  /** Deletes a single interview session by ID. */
  interviewDeleteSession: (sessionId: string) => Promise<void>
  /** Deletes all stored interview sessions. */
  interviewDeleteAllSessions: () => Promise<void>
  /** Synthesizes text to speech audio for interview playback. */
  interviewSynthesize: (text: string) => Promise<ArrayBuffer | null>
  /** Retrieves stored audio for a specific interview turn. */
  interviewGetAudio: (sessionId: string, turn: number, type: 'question' | 'response') => Promise<ArrayBuffer | null>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}