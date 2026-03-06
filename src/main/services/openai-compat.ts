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
