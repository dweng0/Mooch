import type { TTSProvider } from '../../shared/types'

export interface TTSConfig {
  provider: TTSProvider
  apiKey?: string
  baseUrl?: string
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
  private cachedLocalVoice: string | null = null

  setConfig(config: TTSConfig): void {
    if (!config.provider) {
      throw new Error('TTS provider is required')
    }
    this.config = config
    this.cachedLocalVoice = null
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
      case 'local':
        return this.synthesizeWithLocal(text)
      default:
        throw new Error(`Unknown TTS provider: ${this.config.provider}`)
    }
  }

  private async synthesizeWithCosyvoice(text: string): Promise<TTSResponse> {
    if (!this.config?.apiKey) {
      throw new Error('Cosyvoice API key is required')
    }

    // Use Qwen3 TTS models via MultiModalConversation endpoint
    const model = this.config.model || 'qwen3-tts-flash'
    const url = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

    console.log('[TTS] Qwen3 TTS synthesis request:', {
      url,
      model,
      apiKeyPrefix: this.config.apiKey.substring(0, 20),
      textLength: text.length,
      voice: this.config.voice || 'Cherry',
    })

    // Qwen3 TTS via Dashscope MultiModalConversation endpoint
    try {
      const voice = this.config.voice || 'Cherry'
      const requestBody = {
        model,
        input: {
          text,
          voice,
          language_type: 'English',
        },
      }

      console.log('[TTS] Using voice:', voice)

      console.log('[TTS] Request body:', JSON.stringify(requestBody, null, 2))

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })

      console.log('[TTS] Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[TTS] API error response:', errorData)
        throw new Error(`Qwen3 TTS API error: ${errorData.message || response.statusText}`)
      }

      const result = await response.json()

      console.log('[TTS] Response structure:', {
        hasOutput: !!result.output,
        outputType: typeof result.output,
        outputKeys: result.output ? Object.keys(result.output) : null,
        hasAudio: !!result.output?.audio,
        audioType: typeof result.output?.audio,
      })

      // Dashscope returns audio as base64 in the output field
      if (result.output?.audio) {
        const audioData = result.output.audio

        console.log('[TTS] Audio data type:', typeof audioData)
        console.log('[TTS] Audio data keys:', audioData && typeof audioData === 'object' ? Object.keys(audioData) : 'N/A')
        console.log('[TTS] Full audio response:', JSON.stringify(audioData).substring(0, 500))

        // Handle case where audio might be an object with encoded data
        let audioBuffer
        if (typeof audioData === 'string') {
          // Base64 string
          console.log('[TTS] Handling as base64 string')
          audioBuffer = Buffer.from(audioData, 'base64')
        } else if (Buffer.isBuffer(audioData)) {
          console.log('[TTS] Already a Buffer')
          audioBuffer = audioData
        } else if (audioData.type === 'Buffer' && Array.isArray(audioData.data)) {
          // Handle Buffer serialization
          console.log('[TTS] Handling as Buffer object with data array')
          audioBuffer = Buffer.from(audioData.data)
        } else if (typeof audioData === 'object' && audioData.data) {
          // Object with data property (could be base64 string or array)
          console.log('[TTS] Handling as object with data property')
          if (typeof audioData.data === 'string') {
            audioBuffer = Buffer.from(audioData.data, 'base64')
          } else if (Array.isArray(audioData.data)) {
            audioBuffer = Buffer.from(audioData.data)
          } else {
            throw new Error(`Unexpected data property type: ${typeof audioData.data}`)
          }
        } else if (typeof audioData === 'object' && audioData.audio) {
          // Nested audio object
          console.log('[TTS] Handling as nested audio object')
          const nestedAudio = audioData.audio
          if (typeof nestedAudio === 'string') {
            audioBuffer = Buffer.from(nestedAudio, 'base64')
          } else if (Array.isArray(nestedAudio)) {
            audioBuffer = Buffer.from(nestedAudio)
          } else {
            throw new Error(`Cannot handle nested audio type: ${typeof nestedAudio}`)
          }
        } else if (typeof audioData === 'object' && audioData.url) {
          // Audio as URL
          console.log('[TTS] Audio is a URL, attempting to fetch')
          const response = await fetch(audioData.url)
          const buffer = await response.arrayBuffer()
          audioBuffer = Buffer.from(buffer)
        } else if (typeof audioData === 'object' && audioData.content) {
          // Audio as content field
          console.log('[TTS] Handling as content object')
          if (typeof audioData.content === 'string') {
            audioBuffer = Buffer.from(audioData.content, 'base64')
          } else {
            audioBuffer = Buffer.from(audioData.content)
          }
        } else if (typeof audioData === 'object') {
          // Try to stringify and parse as it might be the raw response
          const audioStr = JSON.stringify(audioData)
          console.log('[TTS] Unhandled object structure (first 500 chars):', audioStr.substring(0, 500))
          throw new Error(`Unhandled audio response structure. Keys: ${Object.keys(audioData).join(', ')}`)
        } else {
          throw new Error(`Unexpected audio data type: ${typeof audioData}`)
        }

        console.log('[TTS] Audio buffer created:', audioBuffer.length, 'bytes')
        return {
          audioBuffer,
          mimeType: 'audio/wav',
        }
      }

      throw new Error(`No audio data in response. Response keys: ${Object.keys(result).join(', ')}. Output keys: ${result.output ? Object.keys(result.output).join(', ') : 'N/A'}`)
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

  private async fetchRandomLocalVoice(baseUrl: string): Promise<string> {
    try {
      const res = await fetch(`${baseUrl}/v1/voices`)
      if (!res.ok) return 'alloy'
      const data = await res.json() as { voices?: { id: string }[] }
      const voices = data.voices?.map(v => v.id) ?? []
      if (voices.length === 0) return 'alloy'
      return voices[Math.floor(Math.random() * voices.length)]
    } catch {
      return 'alloy'
    }
  }

  private async synthesizeWithLocal(text: string): Promise<TTSResponse> {
    if (!this.config?.baseUrl) {
      throw new Error('Local TTS URL is required')
    }

    const base = this.config.baseUrl.replace(/\/$/, '')
    const url = `${base}/v1/audio/speech`
    if (!this.cachedLocalVoice) {
      this.cachedLocalVoice = this.config.voice || await this.fetchRandomLocalVoice(base)
    }
    const voice = this.cachedLocalVoice

    const body: Record<string, unknown> = {
      input: text,
      model: this.config.model || 'kokoro',
      voice,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Local TTS error ${response.status}: ${errText}`)
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'audio/mpeg'

    return { audioBuffer, mimeType: contentType }
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
