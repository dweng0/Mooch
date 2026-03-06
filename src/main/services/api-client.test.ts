import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AIProvider, UserContext } from '../../shared/types'

// Mock the config module
vi.mock('../config', () => ({
  WASP_API_URL: 'http://localhost:3001',
  WEBSITE_URL: 'http://localhost:3000',
}))

// Mock the auth module - functions must be defined inline for hoisting
vi.mock('./auth', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}))

// Import after mocks are set up
import {
  loginWithEmail,
  transcribeAudio,
  getAnswer,
  analyzeCodeSnapshot,
  fetchSubscriptionStatus,
} from './api-client'
import { loadSession, saveSession, clearSession } from './auth'

// Get the mocked functions
const mockLoadSession = vi.mocked(loadSession)
const mockSaveSession = vi.mocked(saveSession)
const mockClearSession = vi.mocked(clearSession)

describe('API Client - Data Packaging', () => {
  let mockFetch: any

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authentication', () => {
    it('should package login credentials correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ sessionId: 'test-session-123' }),
      })

      await loginWithEmail('test@example.com', 'password123')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/auth/email/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
        })
      )
    })

    it('should save session ID after successful login', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ sessionId: 'session-abc-123' }),
      })

      await loginWithEmail('user@test.com', 'pass')

      expect(mockSaveSession).toHaveBeenCalledWith('session-abc-123')
    })

    it('should include Authorization header in authenticated requests', async () => {
      mockLoadSession.mockReturnValue('test-session-token')
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ isActive: true }),
      })

      await fetchSubscriptionStatus()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-session-token',
          }),
        })
      )
    })
  })

  describe('Audio Transcription', () => {
    beforeEach(() => {
      mockLoadSession.mockReturnValue('valid-session')
    })

    it('should package audio buffer as base64', async () => {
      const audioData = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00])
      const audioBuffer = audioData.buffer

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ transcript: 'Hello world' }),
      })

      await transcribeAudio(audioBuffer)

      const expectedBase64 = Buffer.from(audioBuffer).toString('base64')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/copilot/transcribe',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-session',
          }),
          body: JSON.stringify({ audio: expectedBase64, apiKeys: {} }),
        })
      )
    })

    it('should correctly encode various audio buffer sizes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ transcript: 'test' }),
      })

      // Test small buffer
      const smallBuffer = new Uint8Array([1, 2, 3]).buffer
      await transcribeAudio(smallBuffer)
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ audio: Buffer.from(smallBuffer).toString('base64'), apiKeys: {} }),
        })
      )

      // Test larger buffer
      const largeBuffer = new Uint8Array(1000).fill(255).buffer
      await transcribeAudio(largeBuffer)
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ audio: Buffer.from(largeBuffer).toString('base64'), apiKeys: {} }),
        })
      )
    })

    it('should return transcript from response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ transcript: 'This is the transcribed text' }),
      })

      const result = await transcribeAudio(new ArrayBuffer(100))

      expect(result).toBe('This is the transcribed text')
    })
  })

  describe('Code Snapshot Analysis', () => {
    beforeEach(() => {
      mockLoadSession.mockReturnValue('valid-session')
    })

    it('should package snapshot image as base64 with context', async () => {
      const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const context = 'Help me understand this React component'

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ explanation: 'This is a React component that...' }),
      })

      await analyzeCodeSnapshot(imageBase64, context)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/copilot/code-snapshot',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-session',
          }),
          body: JSON.stringify({
            image: imageBase64,
            context: context,
            apiKeys: {},
          }),
        })
      )
    })

    it('should package snapshot without context', async () => {
      const imageBase64 = 'base64encodedimage'

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ explanation: 'Explanation' }),
      })

      await analyzeCodeSnapshot(imageBase64)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            image: imageBase64,
            context: undefined,
            apiKeys: {},
          }),
        })
      )
    })

    it('should return explanation from response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ explanation: 'This code implements a binary search tree' }),
      })

      const result = await analyzeCodeSnapshot('imagedata')

      expect(result).toBe('This code implements a binary search tree')
    })
  })

  describe('Question Answering', () => {
    beforeEach(() => {
      mockLoadSession.mockReturnValue('valid-session')
    })

    it('should package question with provider and context', async () => {
      const question = 'What is a closure in JavaScript?'
      const provider: AIProvider = 'openai'
      const context: UserContext = {
        textFiles: [
          { name: 'notes.md', content: 'JavaScript closure notes...' },
        ],
        audioTranscript: 'User asked about closures',
        codeSnapshot: {
          imageBase64: 'code-image-base64',
          context: 'Function example',
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ answer: 'A closure is...' }),
      })

      await getAnswer(question, provider, context)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/copilot/answer',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-session',
          }),
          body: JSON.stringify({
            question,
            provider,
            context,
            apiKeys: {},
          }),
        })
      )
    })

    it('should package context with multiple text files', async () => {
      const context: UserContext = {
        textFiles: [
          { name: 'file1.txt', content: 'Content 1' },
          { name: 'file2.md', content: 'Content 2' },
          { name: 'file3.pdf', content: 'PDF content' },
        ],
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ answer: 'Answer' }),
      })

      await getAnswer('Question', 'anthropic', context)

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      expect(body.context.textFiles).toHaveLength(3)
      expect(body.context.textFiles[0].name).toBe('file1.txt')
      expect(body.context.textFiles[1].name).toBe('file2.md')
      expect(body.context.textFiles[2].name).toBe('file3.pdf')
    })

    it('should package empty context', async () => {
      const context: UserContext = {}

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ answer: 'Answer' }),
      })

      await getAnswer('Question', 'google', context)

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      expect(body.context).toEqual({})
    })

    it('should package all context fields correctly', async () => {
      const context: UserContext = {
        textFiles: [{ name: 'doc.txt', content: 'Documentation' }],
        audioTranscript: 'Spoken context',
        codeSnapshot: {
          imageBase64: 'snapshot-image-data',
          context: 'Snapshot description',
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ answer: 'Answer' }),
      })

      await getAnswer('Question', 'openai', context)

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      expect(body.context.textFiles).toBeDefined()
      expect(body.context.audioTranscript).toBe('Spoken context')
      expect(body.context.codeSnapshot).toBeDefined()
      expect(body.context.codeSnapshot.imageBase64).toBe('snapshot-image-data')
      expect(body.context.codeSnapshot.context).toBe('Snapshot description')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockLoadSession.mockReturnValue('valid-session')
    })

    it('should clear session on 401 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ message: 'Unauthorized' }),
      })

      await expect(transcribeAudio(new ArrayBuffer(10))).rejects.toThrow()
      expect(mockClearSession).toHaveBeenCalled()
    })

    it('should throw error with message from response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ message: 'Invalid audio format' }),
      })

      await expect(transcribeAudio(new ArrayBuffer(10))).rejects.toThrow('Invalid audio format')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(transcribeAudio(new ArrayBuffer(10))).rejects.toThrow('Network error')
    })
  })

  describe('Data Serialization', () => {
    it('should properly serialize complex nested objects', async () => {
      mockLoadSession.mockReturnValue('session')
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ answer: 'test' }),
      })

      const complexContext: UserContext = {
        textFiles: [
          {
            name: 'test.md',
            content: 'Line 1\nLine 2\n"Quotes"\n\'Apostrophes\'\n\tTabs',
          },
        ],
        audioTranscript: 'Special chars: \n\r\t',
      }

      await getAnswer('Test', 'openai', complexContext)

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      // Verify special characters are properly serialized
      expect(body.context.textFiles[0].content).toContain('Line 1\nLine 2')
      expect(body.context.audioTranscript).toContain('Special chars')
    })

    it('should handle binary data in base64 encoding', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ transcript: 'test' }),
      })

      // Create binary data with various byte values
      const binaryData = new Uint8Array([0, 127, 128, 255])
      await transcribeAudio(binaryData.buffer)

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)

      // Verify base64 encoding
      const decoded = Buffer.from(body.audio, 'base64')
      expect(decoded).toEqual(Buffer.from(binaryData))
    })
  })
})
