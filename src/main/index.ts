import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, session, shell, screen, nativeImage } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import { WASP_API_URL, WEBSITE_URL } from './config'
import { loadSession, clearSession, initAuthWebSocket, disconnectAuthWebSocket, getOAuthUrl } from './services/auth'
import { fetchSubscriptionStatus, transcribeAudio, getAnswer, analyzeCodeSnapshot, loginWithEmail } from './services/api-client'
import { loadApiKeys, saveApiKeys, clearApiKey } from './services/api-keys'
import type { OAuthProvider, AIProvider, UserContext, CropRect } from '../shared/types'
import type { DesktopCapturerSource } from 'electron'

let mainWindow: BrowserWindow | null = null
let areaSelectionWindow: BrowserWindow | null = null
let areaSelectionResolve: ((rect: CropRect | null) => void) | null = null

// Cache window sources to prevent ID changes between get-window-sources and capture-window
let cachedWindowSources: DesktopCapturerSource[] = []
let cacheTimestamp = 0
const CACHE_DURATION_MS = 30000 // 30 seconds

function createWindow(): void {
  const { width: screenWidth, height: screenHeight } =
    require('electron').screen.getPrimaryDisplay().workAreaSize

  const winWidth = 500
  const winHeight = 640

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenWidth - winWidth - 16,
    y: screenHeight - winHeight - 16,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---------------------------------------------------------------------------
// Auth IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('login', async (_event, email: string, password: string) => {
  try {
    await loginWithEmail(email, password)
    // Return initial subscription status immediately after login
    const status = await fetchSubscriptionStatus()
    return status.ok ? status.data : null
  } catch (err) {
    // Re-throw with a clean message (avoid Electron's "error invoking remote method" wrapper)
    throw new Error(err instanceof Error ? err.message : 'Login failed')
  }
})

ipcMain.handle('logout', async () => {
  clearSession()
})

ipcMain.handle('open-oauth', async (_event, provider: OAuthProvider) => {
  try {
    // Check if the user is already logged in
    const existingSession = loadSession();
    if (existingSession) {
      // When an already logged-in user clicks OAuth, we should send status back to clear the wait state
      // This prevents the stuck spinner issue mentioned
      
      // Fetch current status to send back
      const status = await fetchSubscriptionStatus();
      if (status.ok) {
        // User is already logged in with valid subscription
        mainWindow?.webContents.send('auth:status', {
          loggedIn: true,
          ...status.data,
        });
      }
      
      // Send success notification to clear the waiting state in UI
      // Since we don't have user details easily accessible here, we send generic success
      mainWindow?.webContents.send('oauth:success', {
        loggedIn: true,
        email: null, // We don't have easy access to email here
        username: null, // We don't have easy access to username here
      });
      
      // The UI will handle this as 'already logged in' and stop waiting
      return;
    }
  
    // Initialize WebSocket connection for receiving auth notifications
    initAuthWebSocket((sessionToken, user) => {
      console.log('[Main] OAuth success via WebSocket for user:', user.email)
      
      // Notify the renderer process
      mainWindow?.webContents.send('oauth:success', {
        loggedIn: true,
        email: user.email,
        username: user.username,
      })
      
      // Fetch subscription status and update the renderer
      fetchSubscriptionStatus().then(status => {
        if (status.ok) {
          mainWindow?.webContents.send('auth:status', {
            loggedIn: true,
            ...status.data,
          })
        }
      })
    })
    
    // Get the OAuth URL with pairing code
    const oauthUrl = getOAuthUrl(provider)
    
    // Open the OAuth URL in the default browser
    await shell.openExternal(oauthUrl)
  } catch (error) {
    console.error('[Main] Error in OAuth flow:', error);
    
    // Notify the renderer of failure to clear the waiting state
    mainWindow?.webContents.send('oauth:success', {
      loggedIn: false,
      email: null,
      username: null,
    });
  }
})

// ---------------------------------------------------------------------------
// API Key IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('get-api-keys', async () => {
  return loadApiKeys()
})

ipcMain.handle('set-api-key', async (_event, provider: 'anthropic' | 'gemini' | 'openai', apiKey: string) => {
  const keys = loadApiKeys()
  if (provider === 'anthropic') {
    keys.anthropicApiKey = apiKey
  } else if (provider === 'gemini') {
    keys.geminiApiKey = apiKey
  } else if (provider === 'openai') {
    keys.openaiApiKey = apiKey
  }
  saveApiKeys(keys)
})

ipcMain.handle('clear-api-key', async (_event, provider: 'anthropic' | 'gemini' | 'openai') => {
  clearApiKey(provider)
})

ipcMain.handle('get-auth-status', async () => {
  const session = loadSession()
  if (!session) return { loggedIn: false }

  const status = await fetchSubscriptionStatus()
  if (!status.ok) {
    if (status.status === 401) clearSession()
    return { loggedIn: status.status !== 401, subscriptionStatus: null }
  }
  return { loggedIn: true, ...status.data }
})

ipcMain.handle('open-subscribe', async () => {
  // Open pricing page for new users to subscribe
  shell.openExternal(`${WEBSITE_URL}/pricing#pricing`)
})

ipcMain.handle('open-manage-subscription', async () => {
  shell.openExternal(`${WEBSITE_URL}/account`)
})

ipcMain.handle('open-external-url', async (_event, url: string) => {
  shell.openExternal(url)
})

// ---------------------------------------------------------------------------
// Copilot IPC handlers (proxy to backend)
// ---------------------------------------------------------------------------

ipcMain.handle('transcribe-audio', async (_event, buffer: ArrayBuffer) => {
  return transcribeAudio(buffer)
})

ipcMain.handle('get-answer', async (_event, question: string, provider: AIProvider, context: UserContext) => {
  return getAnswer(question, provider, context)
})

ipcMain.handle('get-available-providers', async () => {
  const status = await fetchSubscriptionStatus()
  if (!status.ok) return []
  return status.data.availableProviders
})

ipcMain.handle('analyze-code-snapshot', async (_event, imageBase64: string, context?: string) => {
  return analyzeCodeSnapshot(imageBase64, context)
})

ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    })

    if (sources.length === 0) {
      throw new Error('No screen sources available')
    }

    // Get the primary screen and return as PNG base64
    const thumbnail = sources[0].thumbnail
    return thumbnail.toPNG().toString('base64')
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Screen capture failed')
  }
})

ipcMain.handle('get-window-sources', async () => {
  try {
    console.log('[get-window-sources] Fetching available windows...')
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 320, height: 180 }
    })

    console.log(`[get-window-sources] Found ${sources.length} windows:`)
    sources.forEach((source, idx) => {
      console.log(`  [${idx}] id="${source.id}", name="${source.name}"`)
    })

    // Cache the sources for use in capture-window
    cachedWindowSources = sources
    cacheTimestamp = Date.now()
    console.log('[get-window-sources] Cached window sources for 30 seconds')

    const result = sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toPNG().toString('base64')
    }))

    console.log('[get-window-sources] Returning window list to renderer')
    return result
  } catch (err) {
    console.error('[get-window-sources] Error:', err)
    throw new Error(err instanceof Error ? err.message : 'Failed to get window sources')
  }
})

ipcMain.handle('capture-window', async (_event, sourceId: string) => {
  try {
    console.log(`[capture-window] Attempting to capture window with id="${sourceId}"`)

    // Check if we have a recent cache
    const cacheAge = Date.now() - cacheTimestamp
    const useCache = cachedWindowSources.length > 0 && cacheAge < CACHE_DURATION_MS

    if (useCache) {
      console.log(`[capture-window] Using cached window sources (age: ${Math.round(cacheAge / 1000)}s)`)
      console.log(`[capture-window] Cached sources (${cachedWindowSources.length} windows):`)
      cachedWindowSources.forEach((source, idx) => {
        const match = source.id === sourceId ? ' ← MATCH' : ''
        console.log(`  [${idx}] id="${source.id}", name="${source.name}"${match}`)
      })

      // Try to find in cache first
      const cachedSource = cachedWindowSources.find(s => s.id === sourceId)
      if (cachedSource) {
        console.log(`[capture-window] Found window in cache: "${cachedSource.name}"`)
        console.log('[capture-window] Re-capturing with high resolution...')

        // Re-capture the window with high resolution using the same source
        const highResSources = await desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: 1920, height: 1080 }
        })

        // Find by name since ID might change
        const highResSource = highResSources.find(s =>
          s.name === cachedSource.name && s.display_id === cachedSource.display_id
        )

        if (highResSource) {
          console.log('[capture-window] Successfully re-captured window in high resolution')
          const imageData = highResSource.thumbnail.toPNG().toString('base64')
          console.log(`[capture-window] Captured ${imageData.length} bytes, returning to renderer`)
          return imageData
        }

        console.log('[capture-window] Window not found in fresh capture, falling back to cached thumbnail')
        // Fallback: use the cached thumbnail (lower res, but better than nothing)
        const imageData = cachedSource.thumbnail.toPNG().toString('base64')
        return imageData
      }
    } else {
      console.log('[capture-window] Cache is stale or empty, fetching fresh window list...')
    }

    // Fallback to direct fetch if cache miss or stale
    console.log('[capture-window] Fetching current window list...')
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 1920, height: 1080 }
    })

    console.log(`[capture-window] Found ${sources.length} windows:`)
    sources.forEach((source, idx) => {
      const match = source.id === sourceId ? ' ← MATCH' : ''
      console.log(`  [${idx}] id="${source.id}", name="${source.name}"${match}`)
    })

    const source = sources.find(s => s.id === sourceId)
    if (!source) {
      console.error(`[capture-window] ERROR: Window with id="${sourceId}" not found!`)
      console.error('[capture-window] Available window IDs:')
      sources.forEach(s => console.error(`  - "${s.id}" (${s.name})`))
      throw new Error('Window not found')
    }

    console.log(`[capture-window] Successfully found window: "${source.name}"`)
    console.log('[capture-window] Capturing high-res thumbnail...')
    const imageData = source.thumbnail.toPNG().toString('base64')
    console.log(`[capture-window] Captured ${imageData.length} bytes, returning to renderer`)

    return imageData
  } catch (err) {
    console.error('[capture-window] Error:', err)
    throw new Error(err instanceof Error ? err.message : 'Window capture failed')
  }
})

ipcMain.handle('start-area-selection', async () => {
  try {
    console.log('[start-area-selection] Opening area selection overlay')

    // Get primary display bounds
    const primaryDisplay = screen.getPrimaryDisplay()
    const { x, y, width, height } = primaryDisplay.bounds

    // Create transparent overlay window
    areaSelectionWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      fullscreen: false,
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    // Load the area selector HTML
    if (process.env['ELECTRON_RENDERER_URL']) {
      areaSelectionWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/area-selector.html')
    } else {
      areaSelectionWindow.loadFile(join(__dirname, '../renderer/area-selector.html'))
    }

    // Return a promise that resolves when user completes selection
    return new Promise<CropRect | null>((resolve) => {
      areaSelectionResolve = resolve

      // If window is closed without selection, resolve with null
      areaSelectionWindow?.on('closed', () => {
        if (areaSelectionResolve) {
          areaSelectionResolve(null)
          areaSelectionResolve = null
        }
        areaSelectionWindow = null
      })
    })
  } catch (err) {
    console.error('[start-area-selection] Error:', err)
    throw new Error(err instanceof Error ? err.message : 'Failed to start area selection')
  }
})

ipcMain.handle('complete-area-selection', (_event, rect: CropRect | null) => {
  console.log('[complete-area-selection] Area selection completed:', rect)
  if (areaSelectionResolve) {
    areaSelectionResolve(rect)
    areaSelectionResolve = null
  }
  if (areaSelectionWindow) {
    areaSelectionWindow.close()
    areaSelectionWindow = null
  }
})

ipcMain.handle('capture-screen-area', async (_event, rect: CropRect) => {
  try {
    console.log('[capture-screen-area] Capturing screen area:', rect)

    // Capture full screen
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 3840, height: 2160 } // High resolution
    })

    if (sources.length === 0) {
      throw new Error('No screen sources available')
    }

    const fullScreenImage = sources[0].thumbnail

    // Get the actual screen dimensions
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds
    const scaleFactor = primaryDisplay.scaleFactor

    // Calculate the crop rectangle with scale factor
    const cropRect = {
      x: Math.round(rect.x * scaleFactor),
      y: Math.round(rect.y * scaleFactor),
      width: Math.round(rect.width * scaleFactor),
      height: Math.round(rect.height * scaleFactor)
    }

    console.log('[capture-screen-area] Screen size:', screenWidth, 'x', screenHeight)
    console.log('[capture-screen-area] Scale factor:', scaleFactor)
    console.log('[capture-screen-area] Original rect:', rect)
    console.log('[capture-screen-area] Scaled crop rect:', cropRect)

    // Crop the image
    const croppedImage = fullScreenImage.crop(cropRect)

    // Return as PNG base64
    return croppedImage.toPNG().toString('base64')
  } catch (err) {
    console.error('[capture-screen-area] Error:', err)
    throw new Error(err instanceof Error ? err.message : 'Screen area capture failed')
  }
})

// ---------------------------------------------------------------------------
// Utility IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('load-text-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Text files', extensions: ['md', 'txt', 'pdf'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const content = readFileSync(filePath, 'utf-8')
  const name = filePath.split(/[\\/]/).pop() ?? ''
  return { name, content }
})

ipcMain.handle('get-desktop-source-id', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources[0]?.id ?? ''
  } catch (err) {
    // User denied screen recording permission
    throw new Error('Screen recording permission denied. Please allow screen recording in your system settings to use system audio.')
  }
})

ipcMain.handle('get-api-url', async () => {
  return WASP_API_URL
})

ipcMain.handle('restart-app', () => {
  app.relaunch()
  app.exit(0)
})

ipcMain.handle('quit-app', () => {
  app.quit()
})

ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

// ---------------------------------------------------------------------------
// Global push-to-talk hotkey (Ctrl+Shift+Space)
// ---------------------------------------------------------------------------

function setupHotkey(): void {
  let held = false

  uIOhook.on('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.keycode === UiohookKey.Space && !held) {
      held = true
      mainWindow?.webContents.send('hotkey-record-start')
    }
  })

  uIOhook.on('keyup', (e) => {
    if (e.keycode === UiohookKey.Space && held) {
      held = false
      mainWindow?.webContents.send('hotkey-record-stop')
    }
  })

  uIOhook.start()
}

// Required on Linux for Web Speech API (SpeechRecognition)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-speech-dispatcher')
}

// Catch unhandled errors to prevent app crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in main process:', error)
  // Don't exit - let the app continue running
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in main process:', reason)
  // Don't exit - let the app continue running
})

app.whenReady().then(() => {
  // Allow microphone access for Web Speech API (SpeechRecognition)
  // Without this handler, Electron silently denies the permission request
  // and the audio pipeline fails with "OnSizeReceived failed error-2"
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media'
  })

  createWindow()
  setupHotkey()
})

app.on('will-quit', () => {
  uIOhook.stop()
})

app.on('window-all-closed', () => {
  app.quit()
})
