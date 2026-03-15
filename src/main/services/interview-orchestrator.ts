import type { AIProvider } from '../../shared/types'
import { TTSProviderManager, type TTSConfig } from './tts-provider'
import { InterviewSessionManager } from './interview-session'

export interface InterviewConfig {
  sessionId: string
  llmProvider: AIProvider
  ttsConfig?: TTSConfig
  jobDescription: string
  resume: string
}

export interface InterviewTurn {
  turn: number
  userText: string
  userAudioPath?: string
  llmQuestion: string
  llmFeedback: {
    rating: 'excellent' | 'good' | 'solid' | 'fair' | 'weak'
    comment: string
    context?: {
      jobRequirement?: string
      resumeSkill?: string
      conversationNote?: string
    }
  }
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
    // Validate all required providers are configured
    const errors: string[] = []

    if (!config.ttsConfig) {
      errors.push('TTS provider not configured')
    }

    if (errors.length > 0) {
      throw new Error(`Cannot start interview: ${errors.join(', ')}`)
    }

    this.config = config
    this.currentSessionId = config.sessionId
    this.currentTurn = 0
    this.conversationHistory = []

    // Initialize TTS
    if (config.ttsConfig) {
      this.ttsManager.setConfig(config.ttsConfig)
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

      // Generate LLM question/response based on job description, resume, and conversation
      const llmQuestion = await this.generateLLMResponse(userText)

      // Provide feedback on user's response
      const feedback = await this.generateFeedback(userText, llmQuestion)

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
        content: llmQuestion,
      })

      // Try to synthesize LLM response with TTS (degrade gracefully if fails)
      let synthesisSucceeded = false
      try {
        await this.ttsManager.synthesize(llmQuestion)
        synthesisSucceeded = true
      } catch (error) {
        console.warn(`TTS synthesis failed, continuing without audio: ${error}`)
      }

      // Update transcript
      const transcript = await this.buildTranscript()
      await this.sessionManager.saveTranscript(this.currentSessionId, transcript)

      return {
        turn: this.currentTurn,
        userText,
        userAudioPath: audioPath,
        llmQuestion,
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

  private async generateLLMResponse(userText: string): Promise<string> {
    // In production, this would call the LLM API
    // For now, return a placeholder that a real implementation would replace
    return `Thank you for that response about "${userText.substring(0, 30)}...". That's a valuable insight. Next, I'd like to explore...`
  }

  private async generateFeedback(userText: string, llmQuestion: string): Promise<any> {
    // In production, this would use the LLM to generate contextual feedback
    // For now, return a basic structure that would be filled by the actual implementation
    return {
      rating: 'solid' as const,
      comment: 'Good answer with relevant examples',
      context: {
        jobRequirement: 'Communication skills',
        resumeSkill: 'Demonstrated in past roles',
        conversationNote: 'Response aligned well with question',
      },
    }
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
