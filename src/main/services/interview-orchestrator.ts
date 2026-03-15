import type { AIProvider, InterviewTurn } from '../../shared/types'
import { TTSProviderManager, type TTSConfig } from './tts-provider'
import { InterviewSessionManager } from './interview-session'
import { buildInterviewerSystemPrompt, buildInterviewerOpenerMessage } from '../../../config/systemPrompt'
import { loadApiKeys } from './api-keys'
import OpenAI from 'openai'

const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'qwen-max'

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

export class InterviewOrchestrator {
  private currentSessionId: string | null = null
  private sessionManager: InterviewSessionManager
  private ttsManager: TTSProviderManager
  private config: InterviewConfig | null = null
  private currentTurn: number = 0
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []

  constructor(sessionManager: InterviewSessionManager, ttsManager: TTSProviderManager) {
    this.sessionManager = sessionManager
    this.ttsManager = ttsManager
  }

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

  async processUserResponse(userText: string, audioPath?: string): Promise<InterviewTurn> {
    if (!this.config || !this.currentSessionId) {
      throw new Error('Interview not started')
    }

    this.currentTurn++

    try {
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
        userResponseText: userText,
        feedback,
      })

      // Add LLM response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: nextQuestion,
      })

      // Try to synthesize LLM response with TTS (degrade gracefully if fails)
      try {
        await this.ttsManager.synthesize(nextQuestion)
      } catch (error) {
        console.warn(`TTS synthesis failed, continuing without audio: ${error}`)
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

  async generateOpener(): Promise<string> {
    if (!this.config) {
      throw new Error('Interview not configured')
    }

    const systemPrompt = buildInterviewerSystemPrompt(this.config.jobDescription, this.config.resume)
    const userMessage = buildInterviewerOpenerMessage(this.config.jobDescription)
    const client = this.createLLMClient()

    console.log('[Interview] Generating opener', {
      model: this.getModelName(),
      userMessage: userMessage.substring(0, 100),
      systemPromptStart: systemPrompt.substring(0, 80),
    })

    try {
      const response = await client.chat.completions.create({
        model: this.getModelName(),
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })

      const question = response.choices[0]?.message?.content ?? ''
      console.log('[Interview] Generated opener:', question.substring(0, 150))

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

      // Try to parse as JSON (for turns > 0)
      if (this.currentTurn > 0) {
        try {
          const parsed = JSON.parse(content)
          if (parsed.next_question && parsed.feedback) {
            return {
              nextQuestion: parsed.next_question,
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

  getCurrentTurn(): number {
    return this.currentTurn
  }

  getConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return [...this.conversationHistory]
  }
}
