import OpenAI from 'openai'
import { loadApiKeys } from './api-keys'

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const apiKey = loadApiKeys().openaiApiKey
  if (!apiKey) {
    throw new Error(
      'Transcription requires an OpenAI API key (for Whisper). ' +
      'Add one in Settings, or get a free key from Groq (groq.com) and configure it as a Custom Provider.'
    )
  }

  const openai = new OpenAI({ apiKey })
  const file = new File([audioBuffer], 'recording.webm', { type: 'audio/webm' })

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'text'
  })

  return response as unknown as string
}
