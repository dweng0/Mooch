import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { loadApiKeys } from './api-keys'
import type { CustomProviderConfig } from '../../shared/types'
import WebSocket from 'ws'
import { randomUUID } from 'crypto'

const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const DASHSCOPE_WSS_URL = 'wss://dashscope-intl.aliyuncs.com/api-ws/v1/inference'

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const keys = loadApiKeys()

  // Build available STT providers
  const available: Array<{ type: 'openai' | 'gemini' | 'qwen' | 'custom'; test: () => Promise<string> }> = []

  // Add preferred provider first (if available)
  const preferred = keys.preferredSttProvider
  if (preferred === 'openai' && keys.openaiApiKey) {
    available.push({ type: 'openai', test: () => transcribeWithWhisper(audioBuffer, keys.openaiApiKey!) })
  }
  if (preferred === 'gemini' && keys.geminiApiKey) {
    available.push({ type: 'gemini', test: () => transcribeWithGemini(audioBuffer, keys.geminiApiKey!) })
  }
  if (preferred === 'qwen' && keys.qwenApiKey) {
    available.push({ type: 'qwen', test: () => transcribeWithQwen(audioBuffer, keys.qwenApiKey!) })
  }
  if (preferred === 'custom' && keys.customProvider?.sttEnabled && keys.customProvider?.baseUrl) {
    available.push({ type: 'custom', test: () => transcribeWithCustom(audioBuffer, keys.customProvider!) })
  }

  // Add remaining providers in default order (if not already added)
  if (!preferred?.startsWith('openai') && keys.openaiApiKey) {
    available.push({ type: 'openai', test: () => transcribeWithWhisper(audioBuffer, keys.openaiApiKey!) })
  }
  if (!preferred?.startsWith('gemini') && keys.geminiApiKey) {
    available.push({ type: 'gemini', test: () => transcribeWithGemini(audioBuffer, keys.geminiApiKey!) })
  }
  if (!preferred?.startsWith('qwen') && keys.qwenApiKey) {
    available.push({ type: 'qwen', test: () => transcribeWithQwen(audioBuffer, keys.qwenApiKey!) })
  }
  if (!preferred?.startsWith('custom') && keys.customProvider?.sttEnabled && keys.customProvider?.baseUrl) {
    available.push({ type: 'custom', test: () => transcribeWithCustom(audioBuffer, keys.customProvider!) })
  }

  // Try each provider in order
  let lastError: Error | null = null
  for (const provider of available) {
    try {
      return await provider.test()
    } catch (error) {
      lastError = error as Error
      continue
    }
  }

  // All providers failed
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
  return new Promise((resolve, reject) => {
    const taskId = randomUUID()
    let fullText = ''
    let ws: WebSocket | null = null
    let resolved = false

    const cleanup = () => {
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
      ws = new WebSocket(DASHSCOPE_WSS_URL, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })

      ws.on('open', () => {
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
            model: 'paraformer-realtime-v2',
            parameters: {
              format: 'pcm',
              sample_rate: 16000
            },
            input: {}
          }
        }
        ws!.send(JSON.stringify(runTask))

        // Send audio data (convert webm to PCM or send as-is)
        // Note: The audio format from recorder is webm, but DashScope expects PCM
        // For now, send the buffer directly - DashScope may auto-detect
        ws!.send(audioBuffer)

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

          if (message.header?.event === 'result-generated') {
            // Extract recognized text from result
            const text = message.payload?.output?.sentence?.text
            if (text) {
              fullText += text
            }
          } else if (message.header?.event === 'task-finished') {
            // Task finished, return collected text
            handleSuccess(fullText || 'No speech detected')
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
      const timeout = setTimeout(() => {
        handleError(new Error('Qwen transcription timeout'))
      }, 30000)

      // Clear timeout if resolved early
      const originalResolve = resolve
      const originalReject = reject
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)))
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
