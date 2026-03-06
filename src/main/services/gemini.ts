import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildSystemPrompt } from '../../../config/systemPrompt'
import type { UserContext } from '../../shared/types'

export async function getGeminiAnswer(question: string, context: UserContext): Promise<string> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
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
