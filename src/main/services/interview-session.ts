import fs from 'fs'
import path from 'path'
import os from 'os'
import type { InterviewSession, InterviewSessionMetadata, InterviewFeedback, InterviewSummary } from '../../shared/types'

const SESSIONS_DIR = path.join(os.homedir(), '.mooch', 'interview-sessions')

/** Manages persistent storage and retrieval of interview sessions on disk. */
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

  /**
   * Creates a new interview session with its directory structure and metadata.
   * @param jobDescription - The job description for the interview.
   * @param resume - The candidate's resume text.
   * @returns The metadata for the newly created session.
   */
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

  /**
   * Lists all saved interview sessions sorted by creation date (newest first).
   * @returns An array of session metadata objects.
   */
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

  /**
   * Loads a complete interview session including transcript, feedback, and summary.
   * @param sessionId - The unique session identifier.
   * @returns The full session data, or null if not found.
   */
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

      const summaryPath = path.join(sessionPath, 'summary.json')
      const summary: InterviewSummary | undefined = fs.existsSync(summaryPath)
        ? JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
        : undefined

      return {
        metadata,
        jobDescription,
        resume,
        transcript,
        feedback,
        summary,
      }
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error)
      return null
    }
  }

  /**
   * Saves feedback for a specific turn in an interview session.
   * @param sessionId - The session to save feedback for.
   * @param feedback - The feedback data including rating and comments.
   */
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

  /**
   * Saves the overall interview summary and caches the average rating in metadata.
   * @param sessionId - The session to save the summary for.
   * @param summary - The interview summary with ratings and areas of improvement.
   */
  async saveSummary(sessionId: string, summary: InterviewSummary): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId)
    fs.writeFileSync(path.join(sessionPath, 'summary.json'), JSON.stringify(summary, null, 2))
    // Cache averageRating in session metadata for quick listing
    const metadataPath = path.join(sessionPath, 'session.json')
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    metadata.averageRating = summary.averageRating
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  }

  /**
   * Saves or updates the interview transcript markdown file.
   * @param sessionId - The session to save the transcript for.
   * @param transcript - The full transcript content in markdown format.
   */
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

  /**
   * Saves a user's audio recording for a specific interview turn.
   * @param sessionId - The session to save audio for.
   * @param turn - The turn number.
   * @param audioBuffer - The raw audio data to save.
   * @returns The file path where the audio was saved.
   */
  async saveAudio(sessionId: string, turn: number, audioBuffer: Buffer): Promise<string> {
    const sessionPath = this.getSessionPath(sessionId)
    const audioPath = path.join(sessionPath, 'audio', `user-turn-${turn}.wav`)

    fs.writeFileSync(audioPath, audioBuffer)

    return audioPath
  }

  /**
   * Saves the TTS-generated question audio for a specific interview turn.
   * @param sessionId - The session to save audio for.
   * @param turn - The turn number.
   * @param audioBuffer - The raw audio data to save.
   * @returns The file path where the audio was saved.
   */
  async saveQuestionAudio(sessionId: string, turn: number, audioBuffer: Buffer): Promise<string> {
    const sessionPath = this.getSessionPath(sessionId)
    const audioPath = path.join(sessionPath, 'audio', `question-turn-${turn}.wav`)

    fs.writeFileSync(audioPath, audioBuffer)

    return audioPath
  }

  /**
   * Marks an interview session as complete in its metadata.
   * @param sessionId - The session to mark as complete.
   */
  async markComplete(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId)
    const metadataPath = path.join(sessionPath, 'session.json')

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    metadata.isComplete = true
    metadata.updatedAt = new Date().toISOString()

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  }

  /**
   * Deletes an interview session and all its associated files.
   * @param sessionId - The session to delete.
   */
  async deleteSession(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId)

    if (fs.existsSync(sessionPath)) {
      // Recursively delete the entire session directory and all files
      fs.rmSync(sessionPath, { recursive: true, force: true })
    }
  }

  /**
   * Deletes all saved interview sessions.
   */
  async deleteAllSessions(): Promise<void> {
    console.log('[SessionManager] Starting delete all sessions')
    const sessions = await this.listSessions()
    console.log('[SessionManager] Found', sessions.length, 'sessions to delete')
    for (const session of sessions) {
      console.log('[SessionManager] Deleting session:', session.sessionId)
      await this.deleteSession(session.sessionId)
    }
    console.log('[SessionManager] Delete all sessions completed')
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

/** Singleton interview session manager instance used across the application. */
export const sessionManager = new InterviewSessionManager()
