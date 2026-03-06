import type { AIProvider, UserContext } from '../../shared/types'
import { getClaudeAnswer } from './claude'
import { getGeminiAnswer } from './gemini'

export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = []
  if (process.env['ANTHROPIC_API_KEY']) providers.push('claude')
  if (process.env['GEMINI_API_KEY']) providers.push('gemini')
  return providers
}

export async function getAnswer(question: string, provider: AIProvider, context: UserContext): Promise<string> {
  switch (provider) {
    case 'claude':
      return getClaudeAnswer(question, context)
    case 'gemini':
      return getGeminiAnswer(question, context)
    default:
      throw new Error(`Unknown AI provider: ${provider}`)
  }
}
