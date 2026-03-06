import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildSystemPrompt } from '../../../config/systemPrompt'
import type { UserContext } from '../../shared/types'
import { loadApiKeys } from './api-keys'

export async function getGeminiAnswer(question: string, context: UserContext): Promise<string> {
  const apiKey = loadApiKeys().geminiApiKey
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Add it in Settings.')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: buildSystemPrompt(context)
  })

  const result = await model.generateContent(
    `Interview question: "${question}"\n\nProvide a concise, impressive answer.`
  )

  return result.response.text()
}
