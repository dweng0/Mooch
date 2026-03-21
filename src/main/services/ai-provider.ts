import type { AIProvider, UserContext } from '../../shared/types'
import { loadApiKeys } from './api-keys'
import { getClaudeAnswer } from './claude'
import { getGeminiAnswer } from './gemini'
import { getQwenAnswer } from './qwen'
import { getCustomAnswer } from './openai-compat'

/**
 * Returns the list of AI providers that have valid API keys configured.
 * @returns An array of available AI provider identifiers.
 */
export function getAvailableProviders(): AIProvider[] {
  const keys = loadApiKeys()
  const providers: AIProvider[] = []
  if (keys.anthropicApiKey) providers.push('claude')
  if (keys.geminiApiKey) providers.push('gemini')
  if (keys.openaiApiKey) providers.push('openai')
  if (keys.qwenApiKey) providers.push('qwen')
  if (keys.customProvider?.baseUrl && keys.customProvider?.model) providers.push('custom')
  return providers
}

/**
 * Routes a question to the specified AI provider and returns the generated answer.
 * @param question - The interview question to answer.
 * @param provider - The AI provider to use for generating the answer.
 * @param context - User context including CV, job description, and manual context.
 * @returns The generated answer text.
 */
export async function getAnswer(question: string, provider: AIProvider, context: UserContext): Promise<string> {
  switch (provider) {
    case 'claude':
      return getClaudeAnswer(question, context)
    case 'gemini':
      return getGeminiAnswer(question, context)
    case 'qwen':
      return getQwenAnswer(question, context)
    case 'custom': {
      const config = loadApiKeys().customProvider
      if (!config?.baseUrl || !config?.model) {
        throw new Error('Custom provider is not configured. Add it in Settings.')
      }
      return getCustomAnswer(question, context, config)
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`)
  }
}
