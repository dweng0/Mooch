import OpenAI from 'openai'
import { buildSystemPrompt } from '../../../config/systemPrompt'
import type { UserContext } from '../../shared/types'
import { loadApiKeys } from './api-keys'

const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'qwen-max'

function getClient(): OpenAI {
  const apiKey = loadApiKeys().qwenApiKey
  if (!apiKey) {
    throw new Error('Qwen (DashScope) API key is not configured. Add it in Settings.')
  }
  return new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL })
}

/**
 * Generates an interview answer using the Qwen (DashScope) API.
 * @param question - The interview question to answer.
 * @param context - User context including CV, job description, and manual context.
 * @returns The generated answer text.
 */
export async function getQwenAnswer(question: string, context: UserContext): Promise<string> {
  const client = getClient()
  const keys = loadApiKeys()

  const response = await client.chat.completions.create({
    model: keys.qwenModel || DEFAULT_MODEL,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: buildSystemPrompt(context) },
      { role: 'user', content: `Interview question: "${question}"\n\nProvide a concise, impressive answer.` }
    ]
  })

  return response.choices[0]?.message?.content ?? ''
}

/**
 * Analyzes a code screenshot image using the Qwen vision-language model.
 * @param imageBase64 - Base64-encoded PNG image of the code.
 * @param context - Optional context to guide the analysis.
 * @returns The AI-generated explanation of the code.
 */
export async function analyzeCodeSnapshotQwen(imageBase64: string, context?: string): Promise<string> {
  const client = getClient()
  const keys = loadApiKeys()

  const response = await client.chat.completions.create({
    model: keys.qwenModel || 'qwen-vl-max',
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
