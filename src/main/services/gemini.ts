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

  try {
    const result = await model.generateContent(
      `Interview question: "${question}"\n\nProvide a concise, impressive answer.`
    )

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
