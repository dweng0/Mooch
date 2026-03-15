import OpenAI from 'openai'
import { buildSystemPrompt } from '../../../config/systemPrompt'
import type { UserContext, CustomProviderConfig } from '../../shared/types'

export async function getCustomAnswer(
  question: string,
  context: UserContext,
  config: CustomProviderConfig
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey || 'no-key',
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true,
  })

  const response = await client.chat.completions.create({
    model: config.model,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: buildSystemPrompt(context) },
      { role: 'user', content: `Interview question: "${question}"\n\nProvide a concise, impressive answer.` }
    ]
  })

  return response.choices[0]?.message?.content ?? ''
}

export async function analyzeCodeSnapshotCustom(
  imageBase64: string,
  config: CustomProviderConfig,
  context?: string
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey || 'no-key',
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true,
  })

  const response = await client.chat.completions.create({
    model: config.model,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${imageBase64}` }
        },
        {
          type: 'text',
          text: context
            ? `Analyze this code screenshot. Context: ${context}\n\nProvide a concise explanation.`
            : 'Analyze this code screenshot and provide a concise explanation of what you see.'
        }
      ]
    }]
  })

  return response.choices[0]?.message?.content ?? ''
}

export async function testCustomProvider(
  config: CustomProviderConfig
): Promise<{ reasoning: boolean; stt: boolean }> {
  const client = new OpenAI({
    apiKey: config.apiKey || 'no-key',
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true,
  })

  let reasoning = false
  let stt = false

  // Test reasoning capability
  try {
    try {
      // Try to list models first
      await client.models.list()
      reasoning = true
    } catch {
      // Fall back to minimal chat.completions
      await client.chat.completions.create({
        model: config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      })
      reasoning = true
    }
  } catch {
    reasoning = false
  }

  // Test STT capability (if enabled)
  if (config.sttEnabled) {
    try {
      // Send empty buffer to test audio.transcriptions endpoint
      const emptyFile = new File([new ArrayBuffer(0)], 'test.webm', { type: 'audio/webm' })
      await client.audio.transcriptions.create({
        model: config.sttModel || 'whisper-1',
        file: emptyFile,
        response_format: 'text'
      })
      stt = true
    } catch (error: any) {
      // Treat HTTP 400/415/422 as endpoint reachability pass (bad audio is acceptable)
      const status = error?.status
      if (status && [400, 415, 422].includes(status)) {
        stt = true
      } else {
        stt = false
      }
    }
  }

  return { reasoning, stt }
}
