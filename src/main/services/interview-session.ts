import fs from 'fs'
import path from 'path'
import os from 'os'
import type { InterviewSession, InterviewSessionMetadata, InterviewFeedback } from '../../shared/types'

const SESSIONS_DIR = path.join(os.homedir(), '.mooch', 'interview-sessions')

export class InterviewSessionManager {
  constructor() {
    this.ensureSessionsDirectory()
  }

  private ensureSessionsDirectory() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    }
  }

  private getSessionPath(sessionId: string): string {
    return path.join(SESSIONS_DIR, `interview-${sessionId}`)
  }

  private createSessionId(): string {
    return new Date().toISOString().replace(/[:.]/g, '-')
  }

  async createSession(jobDescription: string, resume: string): Promise<InterviewSessionMetadata> {
    const sessionId = this.createSessionId()
    const sessionPath = this.getSessionPath(sessionId)

    // Create directories
    fs.mkdirSync(sessionPath, { recursive: true })
    fs.mkdirSync(path.join(sessionPath, 'audio'), { recursive: true })
    fs.mkdirSync(path.join(sessionPath, 'feedback'), { recursive: true })

    const metadata: InterviewSessionMetadata = {
      sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      jobTitle: this.extractJobTitle(jobDescription),
      isComplete: false,
      totalTurns: 0,
    }

    // Save job description and resume
    fs.writeFileSync(path.join(sessionPath, 'job-description.txt'), jobDescription)
    fs.writeFileSync(path.join(sessionPath, 'resume.txt'), resume)

    // Save metadata
    fs.writeFileSync(path.join(sessionPath, 'session.json'), JSON.stringify(metadata, null, 2))

    // Initialize transcript
    fs.writeFileSync(path.join(sessionPath, 'transcript.md'), `# Interview Session\n\n**Job Title**: ${metadata.jobTitle}\n\n`)

    return metadata
  }

  async listSessions(): Promise<InterviewSessionMetadata[]> {
    this.ensureSessionsDirectory()

    if (!fs.existsSync(SESSIONS_DIR)) {
      return []
    }

    const entries = fs.readdirSync(SESSIONS_DIR)
    const sessions: InterviewSessionMetadata[] = []

    for (const entry of entries) {
      const sessionPath = path.join(SESSIONS_DIR, entry)
      const metadataPath = path.join(sessionPath, 'session.json')

      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
          sessions.push(metadata)
        } catch (error) {
          console.error(`Failed to read session metadata for ${entry}:`, error)
        }
      }
    }

    // Sort by creation date (newest first)
    return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async getSession(sessionId: string): Promise<InterviewSession | null> {
    const sessionPath = this.getSessionPath(sessionId)

    if (!fs.existsSync(sessionPath)) {
      return null
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(sessionPath, 'session.json'), 'utf-8'))
      const jobDescription = fs.readFileSync(path.join(sessionPath, 'job-description.txt'), 'utf-8')
      const resume = fs.readFileSync(path.join(sessionPath, 'resume.txt'), 'utf-8')
      const transcript = fs.readFileSync(path.join(sessionPath, 'transcript.md'), 'utf-8')

      // Load feedback files
      const feedbackDir = path.join(sessionPath, 'feedback')
      const feedback: InterviewFeedback[] = []

      if (fs.existsSync(feedbackDir)) {
        const feedbackFiles = fs.readdirSync(feedbackDir).filter((f) => f.endsWith('.json'))
        for (const file of feedbackFiles) {
          const feedbackData = JSON.parse(fs.readFileSync(path.join(feedbackDir, file), 'utf-8'))
          feedback.push(feedbackData)
        }
      }

      // Sort feedback by turn
      feedback.sort((a, b) => a.turn - b.turn)

      return {
        metadata,
        jobDescription,
        resume,
        transcript,
        feedback,
      }
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error)
      return null
    }
  }

  async saveFeedback(sessionId: string, feedback: InterviewFeedback): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId)
    const feedbackPath = path.join(sessionPath, 'feedback', `turn-${feedback.turn}.json`)

    fs.writeFileSync(feedbackPath, JSON.stringify(feedback, null, 2))

    // Update metadata
    const metadataPath = path.join(sessionPath, 'session.json')
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    metadata.updatedAt = new Date().toISOString()
    metadata.totalTurns = Math.max(metadata.totalTurns, feedback.turn)
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  }

  async saveTranscript(sessionId: string, transcript: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId)
    const transcriptPath = path.join(sessionPath, 'transcript.md')

    fs.writeFileSync(transcriptPath, transcript)

    // Update updatedAt
    const metadataPath = path.join(sessionPath, 'session.json')
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    metadata.updatedAt = new Date().toISOString()
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  }

  async saveAudio(sessionId: string, turn: number, audioBuffer: Buffer): Promise<string> {
    const sessionPath = this.getSessionPath(sessionId)
    const audioPath = path.join(sessionPath, 'audio', `user-turn-${turn}.wav`)

    fs.writeFileSync(audioPath, audioBuffer)

    return audioPath
  }

  async markComplete(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId)
    const metadataPath = path.join(sessionPath, 'session.json')

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    metadata.isComplete = true
    metadata.updatedAt = new Date().toISOString()

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  }

  private extractJobTitle(jobDescription: string): string {
    // Try to extract job title from the first line or look for common patterns
    const lines = jobDescription.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length > 0) {
        return trimmed.replace(/^#+\s*/, '').substring(0, 100)
      }
    }
    return 'Untitled Interview'
  }
}

export const sessionManager = new InterviewSessionManager()
