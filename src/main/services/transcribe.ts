import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  if (process.env['OPENAI_API_KEY']) {
    return transcribeWithWhisper(audioBuffer)
  }
  if (process.env['GEMINI_API_KEY']) {
    return transcribeWithGemini(audioBuffer)
  }
  throw new Error('No transcription API key available (need OPENAI_API_KEY or GEMINI_API_KEY)')
}

async function transcribeWithWhisper(audioBuffer: Buffer): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] })
  const file = new File([audioBuffer], 'recording.webm', { type: 'audio/webm' })

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'text'
  })

  return response as unknown as string
}

async function transcribeWithGemini(audioBuffer: Buffer): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env['GEMINI_API_KEY']!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'audio/webm',
        data: audioBuffer.toString('base64')
      }
    },
    'Transcribe this audio exactly as spoken. Return only the transcription, nothing else.'
  ])

  return result.response.text()
}
