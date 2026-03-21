import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildSystemPrompt } from '../../../config/systemPrompt'
import type { UserContext } from '../../shared/types'
import { loadApiKeys } from './api-keys'

/**
 * Generates an interview answer using the Google Gemini API.
 * @param question - The interview question to answer.
 * @param context - User context including CV, job description, and manual context.
 * @returns The generated answer text.
 */
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
