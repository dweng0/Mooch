import fs from 'fs'
import path from 'path'
import os from 'os'
import type { FreeCodeSessionData } from '../../shared/types'

const SESSIONS_DIR = path.join(os.homedir(), '.mooch', 'free-code-sessions')

/** Manages persistent storage for free-code interview sessions. */
export class FreeCodeSessionManager {
  constructor() {
    this.ensureDir()
  }

  private ensureDir(): void {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    }
  }

  private sessionPath(id: string): string {
    return path.join(SESSIONS_DIR, `${id}.json`)
  }

  private createSessionId(): string {
    return new Date().toISOString().replace(/[:.]/g, '-')
  }

  async createSession(task: string, language?: string, framework?: string): Promise<FreeCodeSessionData> {
    this.ensureDir()
    const sessionId = this.createSessionId()
    const session: FreeCodeSessionData = {
      sessionId,
      task,
      language,
      framework,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      features: [],
      asideHistory: [],
    }
    fs.writeFileSync(this.sessionPath(sessionId), JSON.stringify(session, null, 2))
    return session
  }

  async getSession(sessionId: string): Promise<FreeCodeSessionData | null> {
    const p = this.sessionPath(sessionId)
    if (!fs.existsSync(p)) return null
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    } catch {
      return null
    }
  }

  async saveSession(session: FreeCodeSessionData): Promise<void> {
    this.ensureDir()
    session.updatedAt = new Date().toISOString()
    fs.writeFileSync(this.sessionPath(session.sessionId), JSON.stringify(session, null, 2))
  }

  async listSessions(): Promise<FreeCodeSessionData[]> {
    this.ensureDir()
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'))
    const sessions: FreeCodeSessionData[] = []
    for (const f of files) {
      try {
        sessions.push(JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8')))
      } catch { /* skip corrupt file */ }
    }
    return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async deleteSession(sessionId: string): Promise<void> {
    const p = this.sessionPath(sessionId)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}

export const freeCodeSessionManager = new FreeCodeSessionManager()
