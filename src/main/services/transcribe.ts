import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { loadApiKeys } from './api-keys'

const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const keys = loadApiKeys()
  if (keys.openaiApiKey) {
    return transcribeWithWhisper(audioBuffer, keys.openaiApiKey)
  }
  if (keys.geminiApiKey) {
    return transcribeWithGemini(audioBuffer, keys.geminiApiKey)
  }
  if (keys.qwenApiKey) {
    return transcribeWithQwen(audioBuffer, keys.qwenApiKey)
  }
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
  const client = new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL })
  const file = new File([audioBuffer], 'recording.webm', { type: 'audio/webm' })

  const response = await client.audio.transcriptions.create({
    model: 'fun-asr-realtime-2025-11-07',
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
