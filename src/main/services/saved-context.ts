import { app } from 'electron'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import type { SavedContext } from '../../shared/types'

function getSavedContextPath(): string {
  return join(app.getPath('userData'), 'interview-copilot', 'context.json')
}

/**
 * Load the CV, job description and extra context saved from Settings.
 * @returns The saved context, or null if nothing has been saved or it is unreadable.
 */
export function loadSavedContext(): SavedContext | null {
  try {
    const path = getSavedContextPath()
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf-8')) as SavedContext
  } catch {
    return null
  }
}

/**
 * Persist the CV, job description and extra context so they survive restarts.
 * @param context - The context to save.
 */
export function saveContext(context: SavedContext): void {
  const path = getSavedContextPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(context), 'utf-8')
}
