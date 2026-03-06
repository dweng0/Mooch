import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '../../../config/systemPrompt'
import type { UserContext } from '../../shared/types'
import { loadApiKeys } from './api-keys'

export async function getClaudeAnswer(question: string, context: UserContext): Promise<string> {
  const apiKey = loadApiKeys().anthropicApiKey
  if (!apiKey) {
    throw new Error('Anthropic API key is not configured. Add it in Settings.')
  }

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6-20250929',
    max_tokens: 1024,
    system: buildSystemPrompt(context),
    messages: [
      { role: 'user', content: `Interview question: "${question}"\n\nProvide a concise, impressive answer.` }
    ]
  })

  const block = response.content[0]
  if (block.type === 'text') {
    return block.text
  }

  throw new Error('Unexpected response format from Claude')
}

export async function analyzeCodeSnapshot(imageBase64: string, context?: string): Promise<string> {
  const apiKey = loadApiKeys().anthropicApiKey
  if (!apiKey) {
    throw new Error('Anthropic API key is not configured. Add it in Settings.')
  }

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6-20250929',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: imageBase64 }
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

  const block = response.content[0]
  if (block.type === 'text') {
    return block.text
  }

  throw new Error('Unexpected response format from Claude')
}
