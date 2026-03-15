import type { TTSProvider } from '../../shared/types'

export interface TTSConfig {
  provider: TTSProvider
  apiKey?: string
  model?: string
  voice?: string
  speed?: number
  pitch?: number
}

export interface TTSResponse {
  audioUrl?: string
  audioBuffer?: Buffer
  mimeType: string
}

export class TTSProviderManager {
  private config: TTSConfig | null = null

  setConfig(config: TTSConfig): void {
    if (!config.provider) {
      throw new Error('TTS provider is required')
    }
    this.config = config
  }

  getConfig(): TTSConfig | null {
    return this.config
  }

  async synthesize(text: string): Promise<TTSResponse> {
    if (!this.config) {
      throw new Error('TTS provider not configured')
    }

    switch (this.config.provider) {
      case 'cosyvoice':
        return this.synthesizeWithCosyvoice(text)
      case 'openai':
        return this.synthesizeWithOpenAI(text)
      case 'elevenlabs':
        return this.synthesizeWithElevenLabs(text)
      default:
        throw new Error(`Unknown TTS provider: ${this.config.provider}`)
    }
  }

  private async synthesizeWithCosyvoice(text: string): Promise<TTSResponse> {
    if (!this.config?.apiKey) {
      throw new Error('Cosyvoice API key is required')
    }

    // Cosyvoice implementation placeholder
    // In production, this would call the Cosyvoice API
    try {
      const response = await fetch('https://api.cosyvoice.cn/v1/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          text,
          voice: this.config.voice || 'default',
          speed: this.config.speed || 1.0,
          pitch: this.config.pitch || 1.0,
        }),
      })

      if (!response.ok) {
        throw new Error(`Cosyvoice API error: ${response.statusText}`)
      }

      const audioBuffer = await response.arrayBuffer()

      return {
        audioBuffer: Buffer.from(audioBuffer),
        mimeType: 'audio/wav',
      }
    } catch (error) {
      throw new Error(`Failed to synthesize with Cosyvoice: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async synthesizeWithOpenAI(text: string): Promise<TTSResponse> {
    if (!this.config?.apiKey) {
      throw new Error('OpenAI API key is required')
    }

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'tts-1',
          input: text,
          voice: this.config.voice || 'alloy',
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const audioBuffer = await response.arrayBuffer()

      return {
        audioBuffer: Buffer.from(audioBuffer),
        mimeType: 'audio/mpeg',
      }
    } catch (error) {
      throw new Error(`Failed to synthesize with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async synthesizeWithElevenLabs(text: string): Promise<TTSResponse> {
    if (!this.config?.apiKey) {
      throw new Error('ElevenLabs API key is required')
    }

    try {
      const voiceId = this.config.voice || '21m00Tcm4TlvDq8ikWAM'
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: this.config.model || 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`)
      }

      const audioBuffer = await response.arrayBuffer()

      return {
        audioBuffer: Buffer.from(audioBuffer),
        mimeType: 'audio/mpeg',
      }
    } catch (error) {
      throw new Error(`Failed to synthesize with ElevenLabs: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.config) {
      return false
    }

    try {
      // Test with a short phrase
      await this.synthesize('Test')
      return true
    } catch {
      return false
    }
  }
}

export const ttsManager = new TTSProviderManager()
