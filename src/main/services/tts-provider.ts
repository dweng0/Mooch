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

    const model = this.config.model || 'cosyvoice-v3-flash'
    const url = 'https://dashscope.aliyuncs.com/api/v1/services/tts/text-to-speech'

    console.log('[TTS] Cosyvoice synthesis request:', {
      url,
      model,
      apiKeyPrefix: this.config.apiKey.substring(0, 20),
      textLength: text.length,
      voice: this.config.voice || 'longxiao',
    })

    // Cosyvoice via Dashscope (Alibaba)
    try {
      const requestBody = {
        model,
        input: {
          text,
        },
        parameters: {
          voice: this.config.voice || 'longxiao',
          rate: this.config.speed ? Math.round(this.config.speed * 100) : 100,
          pitch: this.config.pitch ? Math.round(this.config.pitch * 100) : 100,
          format: 'wav',
        },
      }

      console.log('[TTS] Request body:', JSON.stringify(requestBody, null, 2))

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'false',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })

      console.log('[TTS] Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[TTS] API error response:', errorData)
        throw new Error(`Cosyvoice API error: ${errorData.message || response.statusText}`)
      }

      const result = await response.json()

      // Dashscope returns audio as base64 in the output field
      if (result.output?.audio) {
        const audioBuffer = Buffer.from(result.output.audio, 'base64')
        return {
          audioBuffer,
          mimeType: 'audio/wav',
        }
      }

      throw new Error('No audio data in Cosyvoice response')
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
