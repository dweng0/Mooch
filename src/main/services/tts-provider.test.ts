import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TTSProviderManager, type TTSConfig } from './tts-provider'

describe('TTS Provider Manager', () => {
  let manager: TTSProviderManager

  beforeEach(() => {
    manager = new TTSProviderManager()
    vi.clearAllMocks()
  })

  describe('Configure Cosyvoice TTS provider', () => {
    it('configure cosyvoice tts provider - accepts configuration', async () => {
      const config: TTSConfig = {
        provider: 'cosyvoice',
        apiKey: 'test-key-123',
        voice: 'default',
        speed: 1.0,
      }

      manager.setConfig(config)

      expect(manager.getConfig()).toEqual(config)
    })

    it('should store Cosyvoice API key securely', async () => {
      const config: TTSConfig = {
        provider: 'cosyvoice',
        apiKey: 'secret-cosyvoice-key',
      }

      manager.setConfig(config)
      const stored = manager.getConfig()

      expect(stored?.apiKey).toBe('secret-cosyvoice-key')
      expect(stored?.provider).toBe('cosyvoice')
    })

    it('should validate provider is specified', async () => {
      const invalidConfig: any = {
        apiKey: 'test-key',
      }

      expect(() => manager.setConfig(invalidConfig)).toThrow('TTS provider is required')
    })

    it('should allow optional voice and speed settings', async () => {
      const config: TTSConfig = {
        provider: 'cosyvoice',
        apiKey: 'key',
        voice: 'female',
        speed: 1.5,
      }

      manager.setConfig(config)
      const stored = manager.getConfig()

      expect(stored?.voice).toBe('female')
      expect(stored?.speed).toBe(1.5)
    })
  })

  describe('Modular TTS architecture for future providers', () => {
    it('modular tts architecture for future providers - supports multiple providers', async () => {
      const providers: Array<'cosyvoice' | 'openai' | 'elevenlabs'> = ['cosyvoice', 'openai', 'elevenlabs']

      for (const provider of providers) {
        const config: TTSConfig = {
          provider,
          apiKey: `test-key-for-${provider}`,
        }

        manager.setConfig(config)
        expect(manager.getConfig()?.provider).toBe(provider)
      }
    })

    it('should allow switching between TTS providers', async () => {
      const cosyConfig: TTSConfig = {
        provider: 'cosyvoice',
        apiKey: 'cosy-key',
      }

      manager.setConfig(cosyConfig)
      expect(manager.getConfig()?.provider).toBe('cosyvoice')

      const openaiConfig: TTSConfig = {
        provider: 'openai',
        apiKey: 'openai-key',
      }

      manager.setConfig(openaiConfig)
      expect(manager.getConfig()?.provider).toBe('openai')
    })

    it('should support provider-specific configuration options', async () => {
      const cosyConfig: TTSConfig = {
        provider: 'cosyvoice',
        apiKey: 'key',
        voice: 'cosyvoice-voice-id',
        speed: 0.8,
        pitch: 1.2,
      }

      manager.setConfig(cosyConfig)

      const config = manager.getConfig()
      expect(config?.voice).toBe('cosyvoice-voice-id')
      expect(config?.speed).toBe(0.8)
      expect(config?.pitch).toBe(1.2)
    })

    it('should throw error when provider not configured for synthesis', async () => {
      await expect(manager.synthesize('Hello')).rejects.toThrow('TTS provider not configured')
    })

    it('should throw error for unknown provider', async () => {
      const invalidConfig: any = {
        provider: 'unknown-provider',
        apiKey: 'key',
      }

      manager.setConfig(invalidConfig)

      await expect(manager.synthesize('Hello')).rejects.toThrow('Unknown TTS provider')
    })
  })

  describe('TTS Synthesis', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    it('should require API key for Cosyvoice synthesis', async () => {
      const config: TTSConfig = {
        provider: 'cosyvoice',
      }

      manager.setConfig(config)

      await expect(manager.synthesize('Hello')).rejects.toThrow('Cosyvoice API key is required')
    })

    it('should handle synthesis errors gracefully', async () => {
      const config: TTSConfig = {
        provider: 'cosyvoice',
        apiKey: 'test-key',
      }

      manager.setConfig(config)

      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(manager.synthesize('Hello')).rejects.toThrow('Failed to synthesize with Cosyvoice')
    })

    it('should return audio buffer on successful synthesis', async () => {
      const config: TTSConfig = {
        provider: 'cosyvoice',
        apiKey: 'test-key',
      }

      manager.setConfig(config)

      const mockFetch = vi.mocked(global.fetch)
      const audioBase64 = Buffer.from('fake-audio-data').toString('base64')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          output: {
            audio: audioBase64,
          },
        }),
      } as any)

      const result = await manager.synthesize('Hello')

      expect(result.audioBuffer).toBeDefined()
      expect(result.mimeType).toBe('audio/wav')
    })

    it('should include text in synthesis request', async () => {
      const config: TTSConfig = {
        provider: 'cosyvoice',
        apiKey: 'test-key',
      }

      manager.setConfig(config)

      const mockFetch = vi.mocked(global.fetch)
      const audioBase64 = Buffer.from('fake-audio-data').toString('base64')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          output: {
            audio: audioBase64,
          },
        }),
      } as any)

      await manager.synthesize('Test text for synthesis')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Test text for synthesis'),
        })
      )
    })
  })

  describe('Connection Testing', () => {
    it('should test provider connectivity', async () => {
      const config: TTSConfig = {
        provider: 'cosyvoice',
        apiKey: 'test-key',
      }

      manager.setConfig(config)

      const mockFetch = vi.mocked(global.fetch)
      const audioBase64 = Buffer.from('fake-audio-data').toString('base64')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          output: {
            audio: audioBase64,
          },
        }),
      } as any)

      const connected = await manager.testConnection()

      expect(connected).toBe(true)
    })

    it('should return false when provider not configured', async () => {
      const connected = await manager.testConnection()

      expect(connected).toBe(false)
    })

    it('should return false on connection failure', async () => {
      const config: TTSConfig = {
        provider: 'cosyvoice',
        apiKey: 'test-key',
      }

      manager.setConfig(config)

      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'))

      const connected = await manager.testConnection()

      expect(connected).toBe(false)
    })
  })
})
