import { safeStorage, app } from 'electron'
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import type { UserApiKeys } from '../../shared/types'

function getApiKeysPath(): string {
  return join(app.getPath('userData'), 'interview-copilot', '.apikeys')
}

/**
 * Persist user API keys to disk.
 * Encrypted via OS keychain when available; falls back to plain JSON otherwise.
 */
export function saveApiKeys(apiKeys: UserApiKeys): void {
  const path = getApiKeysPath()
  mkdirSync(dirname(path), { recursive: true })
  const data = JSON.stringify(apiKeys)
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(data)
    writeFileSync(path + '.enc', encrypted)
    // Remove legacy plain file if we've upgraded to encrypted
    try { if (existsSync(path)) unlinkSync(path) } catch { /* ignore */ }
  } else {
    writeFileSync(path, data, 'utf-8')
  }
}

/**
 * Load the stored API keys, or return empty object if not present / unreadable.
 */
export function loadApiKeys(): UserApiKeys {
  try {
    const encPath = getApiKeysPath() + '.enc'
    const plainPath = getApiKeysPath()
    if (safeStorage.isEncryptionAvailable() && existsSync(encPath)) {
      const encrypted = readFileSync(encPath)
      const decrypted = safeStorage.decryptString(encrypted)
      return JSON.parse(decrypted) as UserApiKeys
    }
    if (existsSync(plainPath)) {
      const data = readFileSync(plainPath, 'utf-8')
      return JSON.parse(data) as UserApiKeys
    }
    return {}
  } catch {
    return {}
  }
}

/**
 * Delete the stored API keys.
 */
export function clearApiKeys(): void {
  try {
    const path = getApiKeysPath()
    if (existsSync(path)) unlinkSync(path)
  } catch {
    // best-effort
  }
}

/**
 * Clear a specific API key.
 */
export function clearApiKey(provider: 'anthropic' | 'gemini' | 'openai' | 'qwen'): void {
  const keys = loadApiKeys()
  if (provider === 'anthropic') {
    delete keys.anthropicApiKey
  } else if (provider === 'gemini') {
    delete keys.geminiApiKey
  } else if (provider === 'openai') {
    delete keys.openaiApiKey
  } else if (provider === 'qwen') {
    delete keys.qwenApiKey
    delete keys.qwenModel
  }
  saveApiKeys(keys)
}
