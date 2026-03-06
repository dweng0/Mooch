import OpenAI from 'openai'
import { Readable } from 'stream'

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const apiKey = process.env['OPENAI_API_KEY']
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const openai = new OpenAI({ apiKey })

  // Convert Buffer to a File-like object for the API
  const file = new File([audioBuffer], 'recording.webm', { type: 'audio/webm' })

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'text'
  })

  return response as unknown as string
}
