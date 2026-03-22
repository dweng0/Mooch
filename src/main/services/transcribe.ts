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

/**
 * Transcribes audio using the best available STT provider, with automatic fallback.
 * @param audioBuffer - Raw audio data to transcribe.
 * @returns The transcribed text.
 */
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
  if (preferred === 'local' && keys.localSttUrl) {
    console.log('[STT] Adding local STT (preferred):', keys.localSttUrl)
    available.push({ type: 'custom', test: () => transcribeWithCustom(audioBuffer, { baseUrl: keys.localSttUrl!, apiKey: '', model: '', sttEnabled: true, sttModel: keys.localSttModel }) })
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
  if (preferred !== 'local' && keys.localSttUrl) {
    console.log('[STT] Adding local STT (fallback):', keys.localSttUrl)
    available.push({ type: 'custom', test: () => transcribeWithCustom(audioBuffer, { baseUrl: keys.localSttUrl!, apiKey: '', model: '', sttEnabled: true, sttModel: keys.localSttModel }) })
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
      
      // If this is a token limit error, we should stop trying other providers since they might face the same issue
      if (error.message && (error.message.includes('limit') || error.message.includes('429'))) {
        throw error;
      }
      continue
    }
  }

  // All providers failed
  console.error('[STT] All providers failed')
  if (lastError) {
    // Check if the error indicates a token limit issue
    if (lastError.message && (lastError.message.includes('limit') || lastError.message.includes('429'))) {
      throw new Error('Token limit exceeded. Please check your API usage and billing.');
    }
    throw lastError;
  }
  throw new Error('Transcription requires an OpenAI, Gemini, or Qwen API key. Add one in Settings.')
}

async function transcribeWithWhisper(audioBuffer: Buffer, apiKey: string): Promise<string> {
  const openai = new OpenAI({ apiKey })
  const file = new File([audioBuffer], 'recording.webm', { type: 'audio/webm' })

  try {
    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      response_format: 'text'
    })

    return response as unknown as string
  } catch (error: any) {
    // Check for specific error conditions and provide clearer messages
    if (error.status === 429) {
      throw new Error('Token limit exceeded. Please check your OpenAI API usage and billing.')
    } else if (error.status === 401) {
      throw new Error('Invalid API key. Please check your OpenAI API key in Settings.')
    } else if (error.status === 403) {
      throw new Error('Access forbidden. Please check your OpenAI API key permissions.')
    } else if (error.status === 500) {
      throw new Error('OpenAI server error. Please try again later.')
    } else if (error.status === 503) {
      throw new Error('OpenAI service temporarily unavailable. Please try again later.')
    } else {
      // For other errors, include the original message if available
      const errorMessage = error.message || 'Unknown error occurred with OpenAI Whisper API'
      throw new Error(`OpenAI Whisper API error: ${errorMessage}`)
    }
  }
}

async function transcribeWithQwen(audioBuffer: Buffer, apiKey: string): Promise<string> {
  // Convert WebM to PCM format expected by DashScope WebSocket API
  let pcmBuffer: Buffer
  try {
    console.log('[Qwen] Converting WebM to PCM...')
    pcmBuffer = await convertWebmToPcm(audioBuffer)
    console.log(`[Qwen] Conversion complete: ${pcmBuffer.length} bytes PCM`)
  } catch (error) {
    const msg = `Failed to convert audio format: ${error instanceof Error ? error.message : String(error)}`
    console.error('[Qwen]', msg)
    throw new Error(msg)
  }

  try {
    return new Promise((resolve, reject) => {
      const taskId = randomUUID()
      let fullText = ''
      let ws: WebSocket | null = null
      let resolved = false
      let timeout: NodeJS.Timeout | null = null

      const cleanup = () => {
        if (timeout) clearTimeout(timeout)
        if (ws) {
          try {
            ws.close()
          } catch (e) {
            // ignore
          }
        }
      }

      const handleError = (error: Error) => {
        if (!resolved) {
          resolved = true
          cleanup()
          reject(error)
        }
      }

      const handleSuccess = (text: string) => {
        if (!resolved) {
          resolved = true
          cleanup()
          resolve(text)
        }
      }

      try {
        console.log('[Qwen] Connecting to DashScope WebSocket...')
        ws = new WebSocket(DASHSCOPE_WSS_URL, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })

        ws.on('open', () => {
          console.log('[Qwen] WebSocket connected, sending task...')
          // Send run-task instruction
          const runTask = {
            header: {
              action: 'run-task',
              task_id: taskId,
              streaming: 'duplex'
            },
            payload: {
              task_group: 'audio',
              task: 'asr',
              function: 'recognition',
              model: 'fun-asr-realtime-2025-11-07',
              parameters: {
                format: 'pcm',
                sample_rate: 16000
              },
              input: {}
            }
          }
          ws!.send(JSON.stringify(runTask))

          // Send PCM audio data
          ws!.send(pcmBuffer)

          // Send finish-task instruction
          const finishTask = {
            header: {
              action: 'finish-task',
              task_id: taskId,
              streaming: 'duplex'
            },
            payload: {
              input: {}
            }
          }
          ws!.send(JSON.stringify(finishTask))
        })

        ws.on('message', (data: Buffer) => {
          try {
            // Try to parse as JSON (text message)
            const message = JSON.parse(data.toString())
            console.log(`[Qwen] Received event: ${message.header?.event}`)

            if (message.header?.event === 'task-started') {
              console.log('[Qwen] Task started successfully')
            } else if (message.header?.event === 'result-generated') {
              // Extract recognized text from result
              console.log('[Qwen] Result payload:', JSON.stringify(message.payload, null, 2))
              const text = message.payload?.output?.sentence?.text
              if (text) {
                console.log(`[Qwen] Transcribed: "${text}"`)
                fullText += text
              } else {
                console.log('[Qwen] No text in result-generated event')
              }
            } else if (message.header?.event === 'task-finished') {
              // Task finished, return collected text
              console.log(`[Qwen] Task finished, final text: "${fullText || 'No speech detected'}"`)
              handleSuccess(fullText || 'No speech detected')
            } else if (message.header?.event === 'task-failed') {
              // Task failed - error is in header, not payload
              const errorMsg = message.header?.error_message || message.payload?.error_message || 'Unknown error'
              console.error(`[Qwen] ✗ Task failed: ${errorMsg}`)
              if (process.env.DEBUG) {
                console.error('[Qwen] Full task-failed payload:', JSON.stringify(message, null, 2))
              }
              handleError(new Error(`Qwen task failed: ${errorMsg}`))
            }
          } catch (e) {
            // Not JSON, ignore (could be binary data)
          }
        })

        ws.on('error', (error: Error) => {
          handleError(new Error(`Qwen WSS connection error: ${error.message}`))
        })

        ws.on('close', () => {
          // If not already resolved, assume incomplete
          if (!resolved) {
            handleSuccess(fullText || 'No speech detected')
          }
        })

        // Timeout after 30 seconds
        timeout = setTimeout(() => {
          handleError(new Error('Qwen transcription timeout'))
        }, 30000)
      } catch (error) {
        handleError(error instanceof Error ? error : new Error(String(error)))
      }
    })
  } catch (error: any) {
    // Check for specific error conditions and provide clearer messages
    if (error.message && error.message.includes('429')) {
      throw new Error('Token limit exceeded. Please check your Qwen API usage and billing.')
    } else if (error.message && error.message.includes('401')) {
      throw new Error('Invalid API key. Please check your Qwen API key in Settings.')
    } else if (error.message && error.message.includes('403')) {
      throw new Error('Access forbidden. Please check your Qwen API key permissions.')
    } else if (error.message && error.message.includes('500')) {
      throw new Error('Qwen server error. Please try again later.')
    } else if (error.message && error.message.includes('503')) {
      throw new Error('Qwen service temporarily unavailable. Please try again later.')
    } else {
      // For other errors, include the original message if available
      const errorMessage = error.message || 'Unknown error occurred with Qwen API'
      throw new Error(`Qwen API error: ${errorMessage}`)
    }
  }
}

async function convertWebmToPcm(audioBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { ext } = detectAudioExtension(audioBuffer)
    const inputFile = join(tmpdir(), `audio-${randomUUID()}.${ext}`)
    const outputFile = join(tmpdir(), `audio-${randomUUID()}.pcm`)

    console.log(`[FFmpeg] Input audio size: ${audioBuffer.length} bytes`)
    console.log(`[FFmpeg] Detected format: ${ext}`)
    console.log(`[FFmpeg] Input file: ${inputFile}`)
    console.log(`[FFmpeg] Output file: ${outputFile}`)

    // Log first 16 bytes for debugging
    if (audioBuffer.length > 0) {
      console.log(`[FFmpeg] First 16 bytes: ${audioBuffer.slice(0, Math.min(16, audioBuffer.length)).toString('hex')}`)
    }

    try {
      // Write input buffer to temp file
      const writeStream = createWriteStream(inputFile)
      writeStream.write(audioBuffer)
      writeStream.end()

      writeStream.on('finish', () => {
        // Check file was actually written
        const fs = require('fs')
        const stats = fs.statSync(inputFile)
        console.log(`[FFmpeg] File written successfully: ${stats.size} bytes on disk`)

        // Small delay to ensure file is flushed
        setTimeout(() => {
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
        }, 50)
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

function detectAudioExtension(buffer: Buffer): { ext: string; mime: string } {
  if (buffer.length >= 4) {
    // WebM / MKV — EBML header
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return { ext: 'webm', mime: 'audio/webm' }
    }
    // RIFF / WAV
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      return { ext: 'wav', mime: 'audio/wav' }
    }
    // Ogg
    if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
      return { ext: 'ogg', mime: 'audio/ogg' }
    }
    // MP4 / M4A — ftyp box
    if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
      return { ext: 'mp4', mime: 'audio/mp4' }
    }
  }
  // Unknown container — let ffmpeg probe
  return { ext: 'audio', mime: 'audio/webm' }
}

async function transcribeWithCustom(audioBuffer: Buffer, config: CustomProviderConfig): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey || 'no-key',
    baseURL: config.baseUrl,
  })
  const { ext, mime } = detectAudioExtension(audioBuffer)
  const file = new File([audioBuffer], `recording.${ext}`, { type: mime })

  try {
    const response = await client.audio.transcriptions.create({
      model: config.sttModel || 'whisper-1',
      file,
      response_format: 'text'
    })

    return response as unknown as string
  } catch (error: any) {
    // Check for specific error conditions and provide clearer messages
    if (error.status === 429) {
      throw new Error('Token limit exceeded. Please check your custom provider API usage and billing.')
    } else if (error.status === 401) {
      throw new Error('Invalid API key. Please check your custom provider API key in Settings.')
    } else if (error.status === 403) {
      throw new Error('Access forbidden. Please check your custom provider API key permissions.')
    } else if (error.status === 500) {
      throw new Error('Custom provider server error. Please try again later.')
    } else if (error.status === 503) {
      throw new Error('Custom provider service temporarily unavailable. Please try again later.')
    } else {
      // For other errors, include the original message if available
      const errorMessage = error.message || 'Unknown error occurred with custom provider API'
      throw new Error(`Custom provider API error: ${errorMessage}`)
    }
  }
}

async function transcribeWithGemini(audioBuffer: Buffer, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  try {
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
  } catch (error: any) {
    // Check for specific error conditions and provide clearer messages
    if (error.message && error.message.includes('quota')) {
      throw new Error('Token limit exceeded. Please check your Gemini API usage and billing.')
    } else if (error.message && error.message.includes('API key')) {
      throw new Error('Invalid API key. Please check your Gemini API key in Settings.')
    } else if (error.status === 403) {
      throw new Error('Access forbidden. Please check your Gemini API key permissions.')
    } else if (error.status === 500) {
      throw new Error('Gemini server error. Please try again later.')
    } else if (error.status === 503) {
      throw new Error('Gemini service temporarily unavailable. Please try again later.')
    } else {
      // For other errors, include the original message if available
      const errorMessage = error.message || 'Unknown error occurred with Gemini API'
      throw new Error(`Gemini API error: ${errorMessage}`)
    }
  }
}
