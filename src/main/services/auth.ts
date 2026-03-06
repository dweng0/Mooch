import { safeStorage, app } from 'electron'
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { io, Socket } from 'socket.io-client'
import { WASP_API_URL } from '../config'

function getSessionPath(): string {
  return join(app.getPath('userData'), 'interview-copilot', '.session')
}

/**
 * Persist the raw Set-Cookie header string from the Wasp login response.
 * Encrypted at rest using the OS keychain via Electron safeStorage.
 */
export function saveSession(cookieHeader: string): void {
  const path = getSessionPath()
  mkdirSync(dirname(path), { recursive: true })
  const encrypted = safeStorage.encryptString(cookieHeader)
  writeFileSync(path, encrypted)
}

/**
 * Save session token directly (for WebSocket auth flow).
 * Stores the raw session ID, consistent with loginWithEmail.
 */
export function saveSessionToken(sessionToken: string): void {
  saveSession(sessionToken)
}

/**
 * Load the stored session cookie string, or null if not present / unreadable.
 */
export function loadSession(): string | null {
  try {
    const path = getSessionPath()
    if (!existsSync(path)) return null
    const encrypted = readFileSync(path)
    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
}

/**
 * Delete the stored session (logout).
 */
export function clearSession(): void {
  try {
    const path = getSessionPath()
    if (existsSync(path)) unlinkSync(path)
  } catch {
    // best-effort
  }
}

// WebSocket client for auth notifications
let socket: Socket | null = null
let currentPairingCode: string | null = null
let onAuthSuccessCallback: ((sessionToken: string, user: any) => void) | null = null

/**
 * Generate a random pairing code for OAuth
 */
function generatePairingCode(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Get the current pairing code (if any)
 */
export function getCurrentPairingCode(): string | null {
  return currentPairingCode
}

/**
 * Initialize WebSocket connection for OAuth notifications
 */
export function initAuthWebSocket(onAuthSuccess: (sessionToken: string, user: any) => void): void {
  // Clean up existing connection
  if (socket) {
    socket.disconnect()
    socket = null
  }

  onAuthSuccessCallback = onAuthSuccess
  currentPairingCode = generatePairingCode()

  // Connect to Wasp WebSocket server
  const wsUrl = WASP_API_URL.replace(/^http/, 'ws')
  console.log('[AuthWebSocket] Connecting to:', wsUrl)

  socket = io(wsUrl, {
    transports: ['websocket'],
    autoConnect: true,
  })

  socket.on('connect', () => {
    console.log('[AuthWebSocket] Connected with socket ID:', socket?.id)
    
    // Register this socket for OAuth notifications with the pairing code
    if (currentPairingCode) {
      socket?.emit('registerOAuthListener', currentPairingCode)
      console.log('[AuthWebSocket] Registered pairing code:', currentPairingCode)
    }
  })

  socket.on('oauth:success', (payload: { sessionToken: string; user: any }) => {
    console.log('[AuthWebSocket] Received OAuth success for user:', payload.user?.email)
    
    // Save the session
    saveSessionToken(payload.sessionToken)
    
    // Notify the callback
    if (onAuthSuccessCallback) {
      onAuthSuccessCallback(payload.sessionToken, payload.user)
    }
    
    // Clean up
    disconnectAuthWebSocket()
  })

  socket.on('disconnect', () => {
    console.log('[AuthWebSocket] Disconnected')
  })

  socket.on('connect_error', (error) => {
    console.error('[AuthWebSocket] Connection error:', error)
  })
}

/**
 * Disconnect the WebSocket
 */
export function disconnectAuthWebSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  currentPairingCode = null
  onAuthSuccessCallback = null
}

/**
 * Get the OAuth URL with pairing code for the given provider
 */
export function getOAuthUrl(provider: 'google' | 'github' | 'discord'): string {
  if (!currentPairingCode) {
    throw new Error('WebSocket not initialized. Call initAuthWebSocket first.')
  }
  
  // Pass the pairingCode as a query param so the server-side onBeforeOAuthRedirect
  // hook can capture it, keyed by the OAuth uniqueRequestId. After the user
  // authenticates, the onAfterLogin / onAfterSignup hook creates a session and
  // pushes it back to this Electron client via the WebSocket.
  return `${WASP_API_URL}/auth/${provider}/login?pairingCode=${encodeURIComponent(currentPairingCode)}`
}
