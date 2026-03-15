import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { loadApiKeys } from './api-keys'
import type { CustomProviderConfig } from '../../shared/types'
import WebSocket from 'ws'
import { randomUUID } from 'crypto'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import { createWriteStream, unlinkSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Set ffmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic)
}

const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const DASHSCOPE_WSS_URL = 'wss://dashscope-intl.aliyuncs.com/api-ws/v1/inference'

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const keys = loadApiKeys()
  console.log('[STT] Starting transcription...')

  // Build available STT providers
  const available: Array<{ type: 'openai' | 'gemini' | 'qwen' | 'custom'; test: () => Promise<string> }> = []

  // Add preferred provider first (if available)
  const preferred = keys.preferredSttProvider
  console.log('[STT] Preferred provider:', preferred)

  if (preferred === 'openai' && keys.openaiApiKey) {
    console.log('[STT] Adding OpenAI (preferred)')
    available.push({ type: 'openai', test: () => transcribeWithWhisper(audioBuffer, keys.openaiApiKey!) })
  }
  if (preferred === 'gemini' && keys.geminiApiKey) {
    console.log('[STT] Adding Gemini (preferred)')
    available.push({ type: 'gemini', test: () => transcribeWithGemini(audioBuffer, keys.geminiApiKey!) })
  }
  if (preferred === 'qwen' && keys.qwenApiKey) {
    console.log('[STT] Adding Qwen (preferred)')
    available.push({ type: 'qwen', test: () => transcribeWithQwen(audioBuffer, keys.qwenApiKey!) })
  }
  if (preferred === 'custom' && keys.customProvider?.sttEnabled && keys.customProvider?.baseUrl) {
    console.log('[STT] Adding custom provider (preferred)')
    available.push({ type: 'custom', test: () => transcribeWithCustom(audioBuffer, keys.customProvider!) })
  }

  // Add remaining providers in default order (if not already added)
  if (!preferred?.startsWith('openai') && keys.openaiApiKey) {
    console.log('[STT] Adding OpenAI (fallback)')
    available.push({ type: 'openai', test: () => transcribeWithWhisper(audioBuffer, keys.openaiApiKey!) })
  }
  if (!preferred?.startsWith('gemini') && keys.geminiApiKey) {
    console.log('[STT] Adding Gemini (fallback)')
    available.push({ type: 'gemini', test: () => transcribeWithGemini(audioBuffer, keys.geminiApiKey!) })
  }
  if (!preferred?.startsWith('qwen') && keys.qwenApiKey) {
    console.log('[STT] Adding Qwen (fallback)')
    available.push({ type: 'qwen', test: () => transcribeWithQwen(audioBuffer, keys.qwenApiKey!) })
  }
  if (!preferred?.startsWith('custom') && keys.customProvider?.sttEnabled && keys.customProvider?.baseUrl) {
    console.log('[STT] Adding custom provider (fallback)')
    available.push({ type: 'custom', test: () => transcribeWithCustom(audioBuffer, keys.customProvider!) })
  }

  console.log('[STT] Available providers:', available.map(p => p.type))

  // Try each provider in order
  let lastError: Error | null = null
  for (const provider of available) {
    try {
      console.log(`[STT] Trying ${provider.type}...`)
      const result = await provider.test()
      console.log(`[STT] ✓ Success with ${provider.type}: "${result}"`)
      return result
    } catch (error) {
      lastError = error as Error
      console.error(`[STT] ✗ Failed with ${provider.type}:`, error instanceof Error ? error.message : String(error))
      continue
    }
  }

  // All providers failed
  console.error('[STT] All providers failed')
  if (lastError) throw lastError
  throw new Error('Transcription requires an OpenAI, Gemini, or Qwen API key. Add one in Settings.')
}

async function transcribeWithWhisper(audioBuffer: Buffer, apiKey: string): Promise<string> {
  const openai = new OpenAI({ apiKey })
  const file = new File([audioBuffer], 'recording.webm', { type: 'audio/webm' })

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'text'
  })

  return response as unknown as string
}

async function transcribeWithQwen(audioBuffer: Buffer, apiKey: string): Promise<string> {
  // Use REST API via MultiModalConversation endpoint with qwen3-asr-flash
  try {
    console.log('[Qwen] Converting WebM to base64 for REST API...')
    const audioBase64 = audioBuffer.toString('base64')
    console.log(`[Qwen] Base64 encoded: ${audioBase64.length} chars`)

    const endpoint = 'https://dashscope-intl.aliyuncs.com/api/v1/services/multimodal-generation/generation'

    const payload = {
      model: 'qwen3-asr-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'audio',
              audio: `data:audio/webm;base64,${audioBase64}`
            },
            {
              type: 'text',
              text: 'Please transcribe the audio and return only the transcribed text.'
            }
          ]
        }
      ]
    }

    console.log('[Qwen] Sending to REST API endpoint...')
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-OssResourceResolve': 'enable'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error(`[Qwen] HTTP ${response.status}: ${errorData}`)
      throw new Error(`Qwen API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json() as any
    console.log('[Qwen] Response received:', JSON.stringify(result, null, 2))

    // Extract transcription from response
    const text = result.output?.choices?.[0]?.message?.content?.[0]?.text ||
                 result.output?.text ||
                 'No speech detected'

    console.log(`[Qwen] ✓ Transcribed: "${text}"`)
    return text
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Qwen] ✗ REST API error:', msg)
    throw new Error(`Qwen transcription failed: ${msg}`)
  }
}

async function convertWebmToPcm(audioBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputFile = join(tmpdir(), `audio-${randomUUID()}.webm`)
    const outputFile = join(tmpdir(), `audio-${randomUUID()}.pcm`)

    console.log(`[FFmpeg] Input WebM size: ${audioBuffer.length} bytes`)
    console.log(`[FFmpeg] Input file: ${inputFile}`)
    console.log(`[FFmpeg] Output file: ${outputFile}`)

    try {
      // Write input buffer to temp file
      const writeStream = createWriteStream(inputFile)
      writeStream.write(audioBuffer)
      writeStream.end()

      writeStream.on('finish', () => {
        console.log('[FFmpeg] Input file written, starting conversion...')
        // Convert WebM to PCM using ffmpeg
        ffmpeg(inputFile)
          .audioCodec('pcm_s16le')
          .audioFrequency(16000)
          .audioChannels(1)
          .format('s16le')
          .on('start', (cmd: string) => {
            console.log('[FFmpeg] FFmpeg command:', cmd)
          })
          .on('progress', (progress: any) => {
            console.log(`[FFmpeg] Progress: ${progress.percent?.toFixed(1) || 0}%`)
          })
          .on('end', () => {
            try {
              const pcmBuffer = readFileSync(outputFile)
              console.log(`[FFmpeg] ✓ Conversion complete: ${pcmBuffer.length} bytes PCM`)
              // Cleanup temp files
              try { unlinkSync(inputFile) } catch (e) {}
              try { unlinkSync(outputFile) } catch (e) {}
              resolve(pcmBuffer)
            } catch (error) {
              console.error('[FFmpeg] Error reading output file:', error)
              try { unlinkSync(inputFile) } catch (e) {}
              try { unlinkSync(outputFile) } catch (e) {}
              reject(error)
            }
          })
          .on('error', (error: Error) => {
            console.error('[FFmpeg] ✗ Conversion error:', error.message)
            try { unlinkSync(inputFile) } catch (e) {}
            try { unlinkSync(outputFile) } catch (e) {}
            reject(new Error(`Audio conversion failed: ${error.message}`))
          })
          .save(outputFile)
      })

      writeStream.on('error', (error: Error) => {
        console.error('[FFmpeg] Error writing input file:', error.message)
        reject(error)
      })
    } catch (error) {
      console.error('[FFmpeg] Unexpected error:', error)
      reject(error)
    }
  })
}

async function transcribeWithCustom(audioBuffer: Buffer, config: CustomProviderConfig): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey || 'no-key',
    baseURL: config.baseUrl,
  })
  const file = new File([audioBuffer], 'recording.webm', { type: 'audio/webm' })

  const response = await client.audio.transcriptions.create({
    model: config.sttModel || 'whisper-1',
    file,
    response_format: 'text'
  })

  return response as unknown as string
}

async function transcribeWithGemini(audioBuffer: Buffer, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'audio/webm',
        data: audioBuffer.toString('base64')
      }
    },
    'Transcribe this audio exactly as spoken. Return only the transcription, nothing else.'
  ])

  return result.response.text()
}
