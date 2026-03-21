import type { AIProvider, InterviewTurn, InterviewSummary } from '../../shared/types'
import { TTSProviderManager, type TTSConfig } from './tts-provider'
import { InterviewSessionManager } from './interview-session'
import { buildInterviewerSystemPrompt, buildInterviewerOpenerMessage, buildInterviewSummaryPrompt } from '../../../config/systemPrompt'
import { loadApiKeys } from './api-keys'
import OpenAI from 'openai'

const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'qwen-max'
const MAX_HISTORY_ENTRIES = 30

/** Configuration required to start an interview session. */
export interface InterviewConfig {
  sessionId: string
  llmProvider: AIProvider
  ttsConfig?: TTSConfig
  jobDescription: string
  resume: string
}

const TTS_VOICES = ['Cherry', 'Ethan', 'Kai', 'Ryan', 'Aiden', 'Jennifer']

function getRandomVoice(): string {
  return TTS_VOICES[Math.floor(Math.random() * TTS_VOICES.length)]
}

/** Orchestrates real-time voice interviews, managing LLM interactions, TTS, and session state. */
export class InterviewOrchestrator {
  private currentSessionId: string | null = null
  private sessionManager: InterviewSessionManager
  private ttsManager: TTSProviderManager
  private config: InterviewConfig | null = null
  private currentTurn: number = 0
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []

  /**
   * Creates a new interview orchestrator.
   * @param sessionManager - The session manager for persisting interview data.
   * @param ttsManager - The TTS provider manager for speech synthesis.
   */
  constructor(sessionManager: InterviewSessionManager, ttsManager: TTSProviderManager) {
    this.sessionManager = sessionManager
    this.ttsManager = ttsManager
  }

  /**
   * Initializes a new real-time voice interview session with the given configuration.
   * @param config - The interview configuration including session ID, LLM provider, and TTS settings.
   */
  async startRealTimeVoiceInterview(config: InterviewConfig): Promise<void> {
    this.config = config
    this.currentSessionId = config.sessionId
    this.currentTurn = 0
    this.conversationHistory = []

    console.log('[Interview] Starting interview session:', {
      sessionId: config.sessionId,
      llmProvider: config.llmProvider,
      hasTtsConfig: !!config.ttsConfig,
      ttsProvider: config.ttsConfig?.provider,
    })

    // Initialize TTS if configured (optional)
    if (config.ttsConfig) {
      try {
        this.ttsManager.setConfig(config.ttsConfig)
        console.log('[Interview] TTS configured successfully:', config.ttsConfig.provider)
      } catch (error) {
        console.warn('[Interview] Failed to initialize TTS:', error)
      }
    } else {
      console.warn('[Interview] TTS provider not configured - will use browser fallback for speech')
    }
  }

  /**
   * Processes a user's response, generates feedback and the next interview question.
   * @param userText - The transcribed text of the user's spoken response.
   * @param audioPath - Optional path to the saved audio file.
   * @returns The interview turn data including the next question and feedback.
   */
  async processUserResponse(userText: string, audioPath?: string): Promise<InterviewTurn> {
    if (!this.config || !this.currentSessionId) {
      throw new Error('Interview not started')
    }

    this.currentTurn++

    try {
      // Get the question that was asked (the last assistant message in history)
      const questionAsked = this.conversationHistory.length > 0
        ? this.conversationHistory[this.conversationHistory.length - 1].content
        : 'Opening Question'

      // Add user response to history
      this.conversationHistory.push({
        role: 'user',
        content: userText,
      })

      // Generate LLM response with feedback
      const { nextQuestion, feedback } = await this.generateLLMResponse(userText)

      // Save feedback to session
      await this.sessionManager.saveFeedback(this.currentSessionId, {
        turn: this.currentTurn,
        timestamp: new Date().toISOString(),
        audioFile: audioPath || `user-turn-${this.currentTurn}.wav`,
        llmQuestion: questionAsked,
        userResponseText: userText,
        feedback,
      })

      // Add LLM response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: nextQuestion,
      })

      // Trim history to rolling window to keep memory usage bounded
      if (this.conversationHistory.length > MAX_HISTORY_ENTRIES) {
        this.conversationHistory = this.conversationHistory.slice(-MAX_HISTORY_ENTRIES)
      }

      // Update transcript
      const transcript = await this.buildTranscript()
      await this.sessionManager.saveTranscript(this.currentSessionId, transcript)

      return {
        turn: this.currentTurn,
        userText,
        llmQuestion: nextQuestion,
        llmFeedback: feedback,
      }
    } catch (error) {
      // Save whatever progress we can on error
      try {
        const currentTranscript = await this.buildTranscript()
        await this.sessionManager.saveTranscript(this.currentSessionId, currentTranscript)
      } catch (saveError) {
        console.error('Failed to save transcript on error:', saveError)
      }

      throw error
    }
  }

  /**
   * Returns the current active session ID.
   * @returns The session ID, or null if no interview is active.
   */
  getSessionId(): string | null {
    return this.currentSessionId
  }

  /**
   * Saves the TTS-generated question audio for the current turn.
   * @param audioBuffer - The raw audio data to save.
   */
  async saveQuestionAudio(audioBuffer: Buffer): Promise<void> {
    if (!this.currentSessionId) {
      console.warn('[Interview] No active session, cannot save question audio')
      return
    }

    try {
      await this.sessionManager.saveQuestionAudio(this.currentSessionId, this.currentTurn, audioBuffer)
      console.log(`[Interview] Saved question audio for turn ${this.currentTurn}`)
    } catch (error) {
      console.error('[Interview] Failed to save question audio:', error)
      throw error
    }
  }

  /**
   * Saves the user's recorded audio for the current turn.
   * @param audioBuffer - The raw audio data to save.
   */
  async saveUserAudio(audioBuffer: Buffer): Promise<void> {
    if (!this.currentSessionId) {
      console.warn('[Interview] No active session, cannot save user audio')
      return
    }

    try {
      await this.sessionManager.saveAudio(this.currentSessionId, this.currentTurn, audioBuffer)
      console.log(`[Interview] Saved user audio for turn ${this.currentTurn}`)
    } catch (error) {
      console.error('[Interview] Failed to save user audio:', error)
      throw error
    }
  }


  /**
   * Ends the current interview session and resets orchestrator state.
   * @param isComplete - Whether the interview completed normally (defaults to true).
   */
  async endInterview(isComplete: boolean = true): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('No active interview')
    }

    if (isComplete) {
      await this.sessionManager.markComplete(this.currentSessionId)
    }

    // Reset state
    this.currentSessionId = null
    this.currentTurn = 0
    this.conversationHistory = []
    this.config = null
  }

  /**
   * Generates an AI-powered summary of the interview with ratings, strengths, and improvement areas.
   * @param sessionId - The session to generate a summary for.
   * @returns The interview summary with average rating and feedback areas.
   */
  async generateSummary(sessionId: string): Promise<InterviewSummary> {
    const session = await this.sessionManager.getSession(sessionId)
    if (!session) throw new Error('Session not found')

    const ratingScore: Record<string, number> = { excellent: 5, good: 4, solid: 3, fair: 2, weak: 1 }
    const scores = session.feedback.map(f => ratingScore[f.feedback?.rating] ?? 3)
    const averageRating = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 3

    const turns = session.feedback.map(f => ({
      question: f.llmQuestion,
      response: f.userResponseText,
      rating: f.feedback?.rating ?? 'solid',
      comment: f.feedback?.comment ?? '',
    }))

    const prompt = buildInterviewSummaryPrompt(session.jobDescription, turns)
    const client = this.createLLMClient()

    const response = await client.chat.completions.create({
      model: this.getModelName(),
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.choices[0]?.message?.content ?? ''
    let areasOfImprovement: string[] = []
    let areasOfStrength: string[] = []

    try {
      const parsed = JSON.parse(content)
      areasOfImprovement = parsed.areasOfImprovement ?? []
      areasOfStrength = parsed.areasOfStrength ?? []
    } catch {
      console.error('[Interview] Failed to parse summary response:', content)
    }

    const summary: InterviewSummary = { averageRating, areasOfImprovement, areasOfStrength }
    await this.sessionManager.saveSummary(sessionId, summary)
    return summary
  }

  /**
   * Generates the opening interview question based on the job description and resume.
   * @returns The opening question text.
   */
  async generateOpener(): Promise<string> {
    if (!this.config) {
      throw new Error('Interview not configured')
    }

    const systemPrompt = buildInterviewerSystemPrompt(this.config.jobDescription, this.config.resume)
    const userMessage = buildInterviewerOpenerMessage(this.config.jobDescription)
    const client = this.createLLMClient()

    console.log('[Interview] Generating opener', { model: this.getModelName() })

    try {
      const response = await client.chat.completions.create({
        model: this.getModelName(),
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })

      let question = response.choices[0]?.message?.content ?? ''
      console.log('[Interview] Generated opener:', question.substring(0, 150))

      // Try to parse as JSON if needed (in case the LLM returns JSON format)
      if (question.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(question)
          question = parsed.next_question || question
          console.log('[Interview] Extracted question from JSON opener')
        } catch {
          // Keep original if parsing fails
          console.log('[Interview] Failed to parse JSON opener, keeping original')
        }
      }

      this.conversationHistory.push({
        role: 'assistant',
        content: question,
      })
      return question
    } catch (error) {
      console.error('[Interview] Failed to generate opener:', error)
      throw error
    }
  }

  private async generateLLMResponse(userText: string): Promise<{ nextQuestion: string; feedback: InterviewTurn['llmFeedback'] }> {
    if (!this.config) {
      throw new Error('Interview not configured')
    }

    const systemPrompt = buildInterviewerSystemPrompt(this.config.jobDescription, this.config.resume)
    const client = this.createLLMClient()

    try {
      const response = await client.chat.completions.create({
        model: this.getModelName(),
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.conversationHistory,
          { role: 'user', content: userText }
        ]
      })

      const content = response.choices[0]?.message?.content ?? ''
      console.log('[Interview] Raw LLM response (turn', this.currentTurn, '):', content.substring(0, 200))

      // Try to parse as JSON (for turns > 0)
      if (this.currentTurn > 0) {
        try {
          const parsed = JSON.parse(content)
          console.log('[Interview] Successfully parsed JSON response')
          if (parsed.next_question && parsed.feedback) {
            // Extract the question text, handling case where it might be nested JSON
            let questionText = parsed.next_question
            console.log('[Interview] next_question type:', typeof questionText, 'length:', questionText?.length)

            // If next_question is a JSON string, parse it
            if (typeof questionText === 'string' && questionText.trim().startsWith('{')) {
              console.log('[Interview] next_question appears to be JSON, attempting nested parse')
              try {
                const nestedParsed = JSON.parse(questionText)
                questionText = nestedParsed.next_question || questionText
                console.log('[Interview] Successfully extracted nested question')
              } catch {
                // Keep original if parsing fails
                console.log('[Interview] Failed to parse nested JSON, keeping original')
              }
            }

            console.log('[Interview] Final extracted question:', questionText.substring(0, 100))

            return {
              nextQuestion: questionText,
              feedback: {
                rating: parsed.feedback.rating || 'solid',
                comment: parsed.feedback.comment || '',
                context: parsed.feedback.context,
              }
            }
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON response, treating as plain question:', parseError)
        }
      }

      // Fallback: treat entire response as the question with default feedback
      console.log('[Interview] Using fallback - returning raw content as question')
      return {
        nextQuestion: content,
        feedback: {
          rating: 'solid' as const,
          comment: 'Response noted. Moving forward.',
          context: {
            jobRequirement: 'Technical assessment',
            resumeSkill: 'Demonstrated experience',
            conversationNote: 'Candidate engaging with question',
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate LLM response:', error)
      throw error
    }
  }

  private createLLMClient(): OpenAI {
    const keys = loadApiKeys()

    // Prefer Qwen (DashScope) since it supports OpenAI-compatible API
    if (keys.qwenApiKey) {
      return new OpenAI({
        apiKey: keys.qwenApiKey,
        baseURL: DASHSCOPE_BASE_URL,
        dangerouslyAllowBrowser: true,
      })
    }

    // Fallback to other providers via OpenAI SDK
    if (keys.customProvider?.baseUrl && keys.customProvider?.apiKey) {
      return new OpenAI({
        apiKey: keys.customProvider.apiKey,
        baseURL: keys.customProvider.baseUrl,
        dangerouslyAllowBrowser: true,
      })
    }

    if (keys.openaiApiKey) {
      return new OpenAI({ apiKey: keys.openaiApiKey })
    }

    throw new Error('No LLM provider configured. Please set an API key in Settings.')
  }

  private getModelName(): string {
    const keys = loadApiKeys()
    return keys.qwenModel || DEFAULT_MODEL
  }

  private async buildTranscript(): Promise<string> {
    if (!this.config) {
      return ''
    }

    let transcript = `# Interview Session

**Job Title**: ${this.config.jobDescription.split('\n')[0]}
**Candidate Resume**: ${this.config.resume.split('\n')[0]}

## Conversation

`

    for (const message of this.conversationHistory) {
      if (message.role === 'user') {
        transcript += `**Candidate**: ${message.content}\n\n`
      } else {
        transcript += `**Interviewer**: ${message.content}\n\n`
      }
    }

    return transcript
  }

  /**
   * Returns the current turn number in the interview.
   * @returns The current turn number.
   */
  getCurrentTurn(): number {
    return this.currentTurn
  }

  /**
   * Returns a copy of the conversation history.
   * @returns An array of conversation messages with role and content.
   */
  getConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return [...this.conversationHistory]
  }
}
