import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { loadApiKeys } from './api-keys'
import type { CustomProviderConfig } from '../../shared/types'

const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'

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
  const client = new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL })
  const file = new File([audioBuffer], 'recording.webm', { type: 'audio/webm' })

  const response = await client.audio.transcriptions.create({
    model: 'fun-asr-realtime-2025-11-07',
    file,
    response_format: 'text'
  })

  return response as unknown as string
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
