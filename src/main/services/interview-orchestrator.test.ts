import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InterviewOrchestrator, type InterviewConfig } from './interview-orchestrator'
import { TTSProviderManager } from './tts-provider'
import type { InterviewSessionManager } from './interview-session'

// Mock the api-keys module
vi.mock('./api-keys', () => ({
  loadApiKeys: () => ({
    qwenApiKey: 'mock-qwen-key',
    qwenModel: 'qwen-max',
  }),
}))

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ next_question: 'What is your experience?', feedback: { rating: 'good', comment: 'Good start' } }) } }],
          }),
        },
      }
    }
  }
})

describe('Interview Orchestrator', () => {
  let orchestrator: InterviewOrchestrator
  let mockSessionManager: Partial<InterviewSessionManager>
  let mockTtsManager: Partial<TTSProviderManager>

  beforeEach(() => {
    mockSessionManager = {
      saveFeedback: vi.fn().mockResolvedValue(undefined),
      saveTranscript: vi.fn().mockResolvedValue(undefined),
      markComplete: vi.fn().mockResolvedValue(undefined),
    }

    mockTtsManager = {
      setConfig: vi.fn(),
      getConfig: vi.fn().mockReturnValue({ provider: 'cosyvoice', apiKey: 'test' }),
      synthesize: vi.fn().mockResolvedValue({ audioBuffer: Buffer.from('audio'), mimeType: 'audio/wav' }),
    }

    orchestrator = new InterviewOrchestrator(
      mockSessionManager as InterviewSessionManager,
      mockTtsManager as unknown as TTSProviderManager
    )
  })

  describe('Start real-time voice interview', () => {
    it('start real-time voice interview - initializes with required configuration', async () => {
      const config: InterviewConfig = {
        sessionId: 'session-123',
        llmProvider: 'openai',
        ttsConfig: {
          provider: 'cosyvoice',
          apiKey: 'test-key',
        },
        jobDescription: 'Senior Engineer',
        resume: 'John Doe - 10 years experience',
      }

      await orchestrator.startRealTimeVoiceInterview(config)

      expect(orchestrator.getCurrentTurn()).toBe(0)
      expect(mockTtsManager.setConfig).toHaveBeenCalledWith(config.ttsConfig)
    })

    it('should degrade gracefully if TTS provider not configured', async () => {
      const config: InterviewConfig = {
        sessionId: 'session-123',
        llmProvider: 'openai',
        jobDescription: 'Senior Engineer',
        resume: 'Resume',
      }

      // Should not throw - just warn
      await orchestrator.startRealTimeVoiceInterview(config)

      expect(orchestrator.getCurrentTurn()).toBe(0)
    })

    it('should initialize conversation history', async () => {
      const config: InterviewConfig = {
        sessionId: 'session-123',
        llmProvider: 'openai',
        ttsConfig: {
          provider: 'cosyvoice',
          apiKey: 'key',
        },
        jobDescription: 'Role',
        resume: 'Resume',
      }

      await orchestrator.startRealTimeVoiceInterview(config)

      expect(orchestrator.getConversationHistory()).toEqual([])
    })
  })

  describe('Process user responses', () => {
    beforeEach(async () => {
      const config: InterviewConfig = {
        sessionId: 'session-123',
        llmProvider: 'openai',
        ttsConfig: {
          provider: 'cosyvoice',
          apiKey: 'key',
        },
        jobDescription: 'Backend Engineer',
        resume: 'Experience with Node.js',
      }

      await orchestrator.startRealTimeVoiceInterview(config)
    })

    it('should process user response and generate turn', async () => {
      const response = await orchestrator.processUserResponse('I have 5 years of Node.js experience')

      expect(response.turn).toBe(1)
      expect(response.userText).toBe('I have 5 years of Node.js experience')
      expect(response.llmQuestion).toBeDefined()
      expect(response.llmFeedback).toBeDefined()
    })

    it('should save feedback to session', async () => {
      await orchestrator.processUserResponse('My answer')

      expect(mockSessionManager.saveFeedback).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          turn: 1,
          userResponseText: 'My answer',
          feedback: expect.objectContaining({
            rating: expect.any(String),
            comment: expect.any(String),
          }),
        })
      )
    })

    it('should save feedback with the question being responded to', async () => {
      // First, generate an opener to add a question to history
      await orchestrator.generateOpener()

      // Now process a response
      await orchestrator.processUserResponse('Test response')

      // Verify feedback was saved with the question being responded to
      expect(mockSessionManager.saveFeedback).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          turn: 1,
          llmQuestion: 'What is your experience?', // This is the question from the mock opener
          userResponseText: 'Test response',
        })
      )
    })

    it('should update transcript with each turn', async () => {
      await orchestrator.processUserResponse('First response')

      // Check that saveTranscript was called with the session ID and a transcript containing the response
      const calls = (mockSessionManager.saveTranscript as any).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      expect(calls[0][0]).toBe('session-123')
      expect(calls[0][1]).toContain('First response')
    })

    it('should maintain conversation history', async () => {
      await orchestrator.processUserResponse('First turn')
      await orchestrator.processUserResponse('Second turn')

      const history = orchestrator.getConversationHistory()
      expect(history).toHaveLength(4) // 2 user + 2 assistant
      expect(history[0].role).toBe('user')
      expect(history[0].content).toContain('First turn')
    })

    it('should increment turn counter', async () => {
      expect(orchestrator.getCurrentTurn()).toBe(0)

      await orchestrator.processUserResponse('Turn 1')
      expect(orchestrator.getCurrentTurn()).toBe(1)

      await orchestrator.processUserResponse('Turn 2')
      expect(orchestrator.getCurrentTurn()).toBe(2)
    })
  })

  describe('Degrade gracefully when TTS provider is unavailable', () => {
    beforeEach(async () => {
      const config: InterviewConfig = {
        sessionId: 'session-123',
        llmProvider: 'openai',
        ttsConfig: {
          provider: 'cosyvoice',
          apiKey: 'key',
        },
        jobDescription: 'Role',
        resume: 'Resume',
      }

      await orchestrator.startRealTimeVoiceInterview(config)
    })

    it('degrade gracefully when tts provider is unavailable - continue without audio', async () => {
      // Mock TTS failure
      const mockTts = mockTtsManager as any
      mockTts.synthesize.mockRejectedValueOnce(new Error('TTS API unreachable'))

      const response = await orchestrator.processUserResponse('My response')

      // Should still return the turn even though TTS failed
      expect(response.turn).toBe(1)
      expect(response.userText).toBe('My response')
      expect(response.llmQuestion).toBeDefined()
    })

    it('should save transcript even if TTS fails', async () => {
      const mockTts = mockTtsManager as any
      mockTts.synthesize.mockRejectedValueOnce(new Error('TTS API error'))

      await orchestrator.processUserResponse('Response text')

      expect(mockSessionManager.saveTranscript).toHaveBeenCalled()
    })

    it('should save feedback even if TTS fails', async () => {
      const mockTts = mockTtsManager as any
      mockTts.synthesize.mockRejectedValueOnce(new Error('TTS timeout'))

      await orchestrator.processUserResponse('User response')

      expect(mockSessionManager.saveFeedback).toHaveBeenCalled()
    })
  })

  describe('End interview', () => {
    beforeEach(async () => {
      const config: InterviewConfig = {
        sessionId: 'session-123',
        llmProvider: 'openai',
        ttsConfig: {
          provider: 'cosyvoice',
          apiKey: 'key',
        },
        jobDescription: 'Role',
        resume: 'Resume',
      }

      await orchestrator.startRealTimeVoiceInterview(config)
    })

    it('should mark interview as complete', async () => {
      await orchestrator.endInterview(true)

      expect(mockSessionManager.markComplete).toHaveBeenCalledWith('session-123')
    })

    it('should reset state after ending', async () => {
      await orchestrator.processUserResponse('Some response')
      expect(orchestrator.getCurrentTurn()).toBe(1)

      await orchestrator.endInterview()

      expect(orchestrator.getCurrentTurn()).toBe(0)
      expect(orchestrator.getConversationHistory()).toHaveLength(0)
    })
  })

  describe('Conversation history memory limits', () => {
    beforeEach(async () => {
      const config: InterviewConfig = {
        sessionId: 'session-123',
        llmProvider: 'openai',
        ttsConfig: {
          provider: 'cosyvoice',
          apiKey: 'key',
        },
        jobDescription: 'Role',
        resume: 'Resume',
      }

      await orchestrator.startRealTimeVoiceInterview(config)
    })

    it('conversation history bounded to rolling window - keeps at most 30 entries', async () => {
      // 16 turns × 2 messages (user + assistant) = 32 entries, which should be capped at 30
      for (let i = 1; i <= 16; i++) {
        await orchestrator.processUserResponse(`Turn ${i} response`)
      }

      const history = orchestrator.getConversationHistory()
      expect(history.length).toBeLessThanOrEqual(30)
    })

    it('memory usage stable over long interview sessions - history does not grow unboundedly', async () => {
      // Process many turns and verify history stays bounded
      for (let i = 1; i <= 40; i++) {
        await orchestrator.processUserResponse(`Response ${i}`)
      }

      const history = orchestrator.getConversationHistory()
      expect(history.length).toBeLessThanOrEqual(30)
      // Most recent entries should be present
      const lastEntry = history[history.length - 1]
      expect(lastEntry.role).toBe('assistant')
    })
  })

  describe('Error handling and recovery', () => {
    beforeEach(async () => {
      const config: InterviewConfig = {
        sessionId: 'session-123',
        llmProvider: 'openai',
        ttsConfig: {
          provider: 'cosyvoice',
          apiKey: 'key',
        },
        jobDescription: 'Role',
        resume: 'Resume',
      }

      await orchestrator.startRealTimeVoiceInterview(config)
    })

    it('should throw error if interview not started', async () => {
      const newOrchestrator = new InterviewOrchestrator(
        mockSessionManager as InterviewSessionManager,
        mockTtsManager as unknown as TTSProviderManager
      )

      await expect(newOrchestrator.processUserResponse('test')).rejects.toThrow('Interview not started')
    })

    it('graceful failure recovery during interview - saves transcript on error', async () => {
      const mockSession = mockSessionManager as any
      mockSession.saveFeedback.mockRejectedValueOnce(new Error('Database error'))

      // Should handle the error gracefully and still save transcript
      await expect(orchestrator.processUserResponse('Response')).rejects.toThrow()

      // Transcript should have been saved despite feedback error
      expect(mockSession.saveTranscript).toHaveBeenCalled()
    })
  })
})
