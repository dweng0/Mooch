import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '../../../config/systemPrompt'
import type { UserContext } from '../../shared/types'

export async function getClaudeAnswer(question: string, context: UserContext): Promise<string> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
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
