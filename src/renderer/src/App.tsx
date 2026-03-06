import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, ChevronDown, Info, Power } from 'lucide-react'
import TranscriptPanel from './components/TranscriptPanel'
import AnswerPanel from './components/AnswerPanel'
import LoginScreen from './components/LoginScreen'
import SubscribeScreen from './components/SubscribeScreen'
import ServiceSelection, { type InterviewMode } from './components/ServiceSelection'
import SettingsScreen from './components/SettingsScreen'
import WindowPicker from './components/WindowPicker'
import StatusIndicator from './components/StatusIndicator'
import CaptureVoiceModal from './components/CaptureVoiceModal'
import { AudioRecorder } from './services/recorder'
import { LiveInterviewService } from './services/liveInterview'
import { PassiveListenService } from './services/passiveListen'
import type { AIProvider, AudioSource, TextSize, UserApiKeys, UserContext, WindowSource } from '../../shared/types'
import bunnyLogo from './assets/bunny-logo.png'
import iconPassiveSys from './assets/Explore.webm'
import iconPassiveMic from './assets/Innovation.webm'
import iconMic from './assets/Movie.webm'
import iconSystem from './assets/Visual.webm'
import iconWindow from './assets/Web_Development.webm'
import iconArea from './assets/Photo_Editor.webm'
import iconMock from './assets/Rocket.webm'

type AppStatus = 'idle' | 'recording' | 'transcribing' | 'thinking'
type MockStatus = 'off' | 'listening' | 'thinking' | 'speaking'
type PassiveStatus = 'off' | 'listening' | 'processing'
type AuthState = 'loading' | 'logged-out' | 'no-subscription' | 'active'
type AppView = 'select' | 'settings' | InterviewMode
type CodeSnapshotState = 'idle' | 'selecting-window' | 'awaiting-voice' | 'analyzing'

export default function App() {

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [loadedApiKeys, setLoadedApiKeys] = useState<UserApiKeys>({})
  const [transcriptionsUsed, setTranscriptionsUsed] = useState(0)
  const [transcriptionLimit, setTranscriptionLimit] = useState<number | null>(null)
  const [snapshotsUsed, setSnapshotsUsed] = useState(0)
  const [snapshotLimit, setSnapshotLimit] = useState<number | null>(null)
  const [hasCodeSnapshot, setHasCodeSnapshot] = useState(false)
  const [apiUrl, setApiUrl] = useState('')

  // Load API keys and derive available providers from them (for BYOK users).
  // Respects the provider preference stored in localStorage by SubscribeScreen.
  const loadApiKeyState = async () => {
    const keys = await window.electronAPI.getApiKeys()
    setLoadedApiKeys(keys)

    const derived: AIProvider[] = []
    if (keys.anthropicApiKey) derived.push('claude')
    if (keys.geminiApiKey) derived.push('gemini')
    if (keys.openaiApiKey) derived.push('openai')
    if (keys.qwenApiKey) derived.push('qwen')
    if (keys.customProvider?.baseUrl && keys.customProvider?.model) derived.push('custom')

    setHasApiKey(derived.length > 0)

    if (derived.length > 0) {
      setProviders(derived)
      // Honour stored provider preference (set by SubscribeScreen)
      const storedByok = localStorage.getItem('byok_provider')
      const preferredProvider: AIProvider | null =
        storedByok === 'anthropic' ? 'claude' :
        storedByok === 'gemini' ? 'gemini' :
        storedByok === 'openai' ? 'openai' :
        storedByok === 'qwen' ? 'qwen' :
        storedByok === 'custom' ? 'custom' :
        null
      const preferred = preferredProvider && derived.includes(preferredProvider)
        ? preferredProvider
        : derived[0]
      setSelectedProvider(preferred)
    }

    return derived
  }

  useEffect(() => {
    window.electronAPI.getApiUrl().then((url) => {
      console.log('[App] API URL from main process:', url)
      setApiUrl(url)
    })
    window.electronAPI.getAppVersion().then(setAppVersion)
    window.electronAPI.getAuthStatus().then(async (status) => {
      if (!status.loggedIn) {
        setAuthState('logged-out')
      } else if (!status.isActive) {
        // Logged in but no subscription — check for own API keys
        await loadApiKeyState()
        setAuthState('no-subscription')
      } else {
        setAuthState('active')
        setProviders(status.availableProviders ?? [])
        const first = status.availableProviders?.[0]
        if (first) setSelectedProvider(first)
        setTranscriptionsUsed(status.transcriptionsUsed ?? 0)
        setTranscriptionLimit(status.transcriptionLimit ?? null)
        setSnapshotsUsed(status.snapshotsUsed ?? 0)
        setSnapshotLimit(status.snapshotLimit ?? null)
        setHasCodeSnapshot(status.hasCodeSnapshot ?? false)
      }
    }).catch(() => setAuthState('logged-out'))
  }, [])

  // ── WebSocket OAuth events ─────────────────────────────────────────────────
  useEffect(() => {
    // Listen for OAuth success via WebSocket
    const cleanupOAuthSuccess = window.electronAPI.onOAuthSuccess((user) => {
      console.log('[App] Received OAuth success via WebSocket for:', user.email)
    })

    // Listen for auth status updates after OAuth
    const cleanupAuthStatus = window.electronAPI.onAuthStatusUpdate((status) => {
      console.log('[App] Received auth status update:', status)
      if (status.loggedIn) {
        if (status.isActive) {
          setAuthState('active')
          setProviders(status.availableProviders ?? [])
          const first = status.availableProviders?.[0]
          if (first) setSelectedProvider(first)
          setTranscriptionsUsed(status.transcriptionsUsed ?? 0)
          setTranscriptionLimit(status.transcriptionLimit ?? null)
          setSnapshotsUsed(status.snapshotsUsed ?? 0)
          setSnapshotLimit(status.snapshotLimit ?? null)
          setHasCodeSnapshot(status.hasCodeSnapshot ?? false)
        } else {
          setAuthState('no-subscription')
        }
      }
    })

    return () => {
      cleanupOAuthSuccess()
      cleanupAuthStatus()
    }
  }, [])

  // Check auth status periodically (every 10 seconds) to detect OAuth login completion
  useEffect(() => {
    if (authState === 'logged-out') {
      // Only poll when we're logged out to detect when user has logged in from browser
      const interval = setInterval(async () => {
        try {
          const status = await window.electronAPI.getAuthStatus();
          if (status.loggedIn) {
            if (status.isActive) {
              setAuthState('active');
              setProviders(status.availableProviders ?? []);
              const first = status.availableProviders?.[0];
              if (first) setSelectedProvider(first);
              setTranscriptionsUsed(status.transcriptionsUsed ?? 0);
              setTranscriptionLimit(status.transcriptionLimit ?? null);
              setSnapshotsUsed(status.snapshotsUsed ?? 0);
              setSnapshotLimit(status.snapshotLimit ?? null);
              setHasCodeSnapshot(status.hasCodeSnapshot ?? false);
            } else {
              setAuthState('no-subscription');
            }
          }
        } catch (err) {
          // ignore errors during polling - user may not have internet, etc.
          console.debug('Auth status check failed:', err);
        }
      }, 10000); // Check every 10 seconds

      // Cleanup
      return () => {
        clearInterval(interval);
      };    
    }
  }, [authState]);

  // Check auth status when the app window becomes visible (e.g. after completing OAuth in browser)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const status = await window.electronAPI.getAuthStatus();
          if (!status.loggedIn) {
            if (authState !== 'logged-out') {
              setAuthState('logged-out');
            }
          } else if (!status.isActive) {
            if (authState !== 'no-subscription') {
              setAuthState('no-subscription');
            }
          } else {
            if (authState !== 'active') {
              setAuthState('active');
            }
            setProviders(status.availableProviders ?? []);
            const first = status.availableProviders?.[0];
            if (first) setSelectedProvider(first);
            setTranscriptionsUsed(status.transcriptionsUsed ?? 0);
            setTranscriptionLimit(status.transcriptionLimit ?? null);
            setSnapshotsUsed(status.snapshotsUsed ?? 0);
            setSnapshotLimit(status.snapshotLimit ?? null);
            setHasCodeSnapshot(status.hasCodeSnapshot ?? false);
          }
        } catch (err) {
          console.error('Failed to refresh auth status:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also add focus event as a fallback
    const handleFocus = async () => {
      try {
        const status = await window.electronAPI.getAuthStatus();
        if (!status.loggedIn) {
          if (authState !== 'logged-out') {
            setAuthState('logged-out');
          }
        } else if (!status.isActive) {
          if (authState !== 'no-subscription') {
            setAuthState('no-subscription');
          }
        } else {
          if (authState !== 'active') {
            setAuthState('active');
          }
          setProviders(status.availableProviders ?? []);
          const first = status.availableProviders?.[0];
          if (first) setSelectedProvider(first);
          setTranscriptionsUsed(status.transcriptionsUsed ?? 0);
          setTranscriptionLimit(status.transcriptionLimit ?? null);
          setSnapshotsUsed(status.snapshotsUsed ?? 0);
          setSnapshotLimit(status.snapshotLimit ?? null);
          setHasCodeSnapshot(status.hasCodeSnapshot ?? false);
        }
      } catch (err) {
        console.error('Failed to refresh auth status on focus:', err);
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [authState]);

  const handleLogin = async (email: string, password: string) => {
    const status = await window.electronAPI.login(email, password)
    if (!status) throw new Error('Login failed — could not reach server')
    if (!status.isActive) {
      setAuthState('no-subscription')
    } else {
      setProviders(status.availableProviders ?? [])
      const first = status.availableProviders?.[0]
      if (first) setSelectedProvider(first)
      setTranscriptionsUsed(status.transcriptionsUsed ?? 0)
      setTranscriptionLimit(status.transcriptionLimit ?? null)
      setSnapshotsUsed(status.snapshotsUsed ?? 0)
      setSnapshotLimit(status.snapshotLimit ?? null)
      setHasCodeSnapshot(status.hasCodeSnapshot ?? false)
      setAuthState('active')
    }
  }

  // Called from SubscribeScreen when user saves their own API key
  const handleApiKeySet = async () => {
    const derived = await loadApiKeyState()
    if (derived.length > 0) {
      // Key is valid and saved — let them into the app
    }
  }

  const handleLogout = async () => {
    await window.electronAPI.logout()
    setAppView('select')
    setAuthState('logged-out')
  }

  // Re-check subscription when user returns to the app (e.g. after subscribing in browser)
  const handleRefreshSubscription = async () => {
    const status = await window.electronAPI.getAuthStatus()
    if (!status.loggedIn) {
      setAuthState('logged-out')
    } else if (!status.isActive) {
      setAuthState('no-subscription')
    } else {
      setProviders(status.availableProviders ?? [])
      const first = status.availableProviders?.[0]
      if (first) setSelectedProvider(first)
      setTranscriptionsUsed(status.transcriptionsUsed ?? 0)
      setTranscriptionLimit(status.transcriptionLimit ?? null)
      setSnapshotsUsed(status.snapshotsUsed ?? 0)
      setSnapshotLimit(status.snapshotLimit ?? null)
      setHasCodeSnapshot(status.hasCodeSnapshot ?? false)
      setAuthState('active')
    }
  }

  // Refresh usage counters after operations
  const refreshUsageCounters = async () => {
    try {
      const status = await window.electronAPI.getAuthStatus()
      if (status.isActive) {
        setTranscriptionsUsed(status.transcriptionsUsed ?? 0)
        setSnapshotsUsed(status.snapshotsUsed ?? 0)
      }
    } catch (err) {
      console.error('[refreshUsageCounters] Failed to refresh:', err)
    }
  }

  // ── App navigation state ───────────────────────────────────────────────────
  const [appView, setAppView] = useState<AppView>('select')

  // ── Copilot state ──────────────────────────────────────────────────────────
  const recorderRef = useRef(new AudioRecorder())
  const [status, setStatus] = useState<AppStatus>('idle')
  const statusRef = useRef(status)
  statusRef.current = status

  const [transcript, setTranscript] = useState('')
  const [answer, setAnswer] = useState('')
  const [answerHistory, setAnswerHistory] = useState<string[]>([])
  const [error, setError] = useState('')
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('claude')
  const selectedProviderRef = useRef(selectedProvider)
  selectedProviderRef.current = selectedProvider

  const [textSize, setTextSize] = useState<TextSize>('large')
  const [audioSource, setAudioSource] = useState<AudioSource>('system')
  const [logoMenuOpen, setLogoMenuOpen] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [showAbout, setShowAbout] = useState(false)
  const logoMenuRef = useRef<HTMLDivElement>(null)
  const audioSourceRef = useRef(audioSource)
  audioSourceRef.current = audioSource

  // ── Passive listen state ───────────────────────────────────────────────────
  const passiveServiceRef = useRef(new PassiveListenService())
  const [passiveStatus, setPassiveStatus] = useState<PassiveStatus>('off')
  const [passiveSource, setPassiveSource] = useState<'microphone' | 'system'>('system')
  const passiveStatusRef = useRef(passiveStatus)
  passiveStatusRef.current = passiveStatus

  // ── Mock interview (live) state ────────────────────────────────────────────
  const liveServiceRef = useRef(new LiveInterviewService())
  const [mockStatus, setMockStatus] = useState<MockStatus>('off')
  const mockStatusRef = useRef(mockStatus)
  mockStatusRef.current = mockStatus
  const answerRef = useRef(answer)
  answerRef.current = answer

  const [cv, setCv] = useState('')
  const [cvName, setCvName] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [jobDescName, setJobDescName] = useState('')
  const [manualContext, setManualContext] = useState('')
  const cvRef = useRef(cv)
  cvRef.current = cv
  const jobDescRef = useRef(jobDesc)
  jobDescRef.current = jobDesc
  const manualContextRef = useRef(manualContext)
  manualContextRef.current = manualContext

  const getUserContext = (): UserContext => ({
    cv: cvRef.current,
    jobDescription: jobDescRef.current,
    manualContext: manualContextRef.current
  })

  const startMockMode = useCallback(() => {
    if (mockStatusRef.current !== 'off') return
    if (!liveServiceRef.current.isAvailable) {
      setError('Speech recognition is not supported in this environment.')
      return
    }
    setError('')
    setTranscript('')
    setAnswer('')
    setMockStatus('listening')

    liveServiceRef.current.start(
      (interim) => setTranscript(interim),
      async (question) => {
        setTranscript(question)
        liveServiceRef.current.pauseListening()
        setMockStatus('thinking')
        try {
          const result = await window.electronAPI.getAnswer(
            question,
            selectedProviderRef.current,
            getUserContext()
          )
          if (answerRef.current.trim()) {
            setAnswerHistory((prev) => [answerRef.current, ...prev])
          }
          setAnswer(result)
          setMockStatus('speaking')
          liveServiceRef.current.speak(result, () => {
            if (mockStatusRef.current === 'speaking') {
              setMockStatus('listening')
              liveServiceRef.current.resumeListening()
            }
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Something went wrong'
          if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('401')) {
            setAuthState('logged-out')
          }
          setError(msg)
          setMockStatus('listening')
          liveServiceRef.current.resumeListening()
        }
      }
    )
  }, [])

  const stopMockMode = useCallback(() => {
    liveServiceRef.current.stop()
    liveServiceRef.current.stopSpeaking()
    setMockStatus('off')
  }, [])

  // Clean up mock mode on unmount
  useEffect(() => {
    return () => {
      liveServiceRef.current.stop()
      liveServiceRef.current.stopSpeaking()
    }
  }, [])

  const startPassiveListen = useCallback(async (audioSource: 'microphone' | 'system' = 'system') => {
    if (passiveStatusRef.current !== 'off') return
    setPassiveSource(audioSource)
    setError('')
    await passiveServiceRef.current.start({
      audioSource,
      onTranscript: (text) => setTranscript(text),
      onDetected: async (text) => {
        try {
          const result = await window.electronAPI.getAnswer(
            text,
            selectedProviderRef.current,
            getUserContext()
          )
          if (answerRef.current.trim()) {
            setAnswerHistory((prev) => [answerRef.current, ...prev])
          }
          setAnswer(result)
          refreshUsageCounters()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Something went wrong'
          if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('401')) {
            setAuthState('logged-out')
          }
          setError(msg)
        }
      },
      onStatus: (s) => setPassiveStatus(s),
      onError: (msg) => {
        setError(msg)
        setPassiveStatus('off')
      }
    })
  }, [])

  const stopPassiveListen = useCallback(() => {
    passiveServiceRef.current.stop()
    setPassiveStatus('off')
  }, [])

  // Clean up passive listen on unmount
  useEffect(() => {
    return () => {
      passiveServiceRef.current.stop()
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (statusRef.current !== 'idle') return
    setError('')
    try {
      setTranscript('')
      setAnswer('')
      await recorderRef.current.start(audioSourceRef.current)
      setStatus('recording')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }, [])

  const stopRecording = useCallback(async () => {
    if (statusRef.current !== 'recording') return
    try {
      const buffer = await recorderRef.current.stop()
      setStatus('transcribing')

      const text = await window.electronAPI.transcribeAudio(buffer)
      setTranscript(text)
      setStatus('thinking')

      const result = await window.electronAPI.getAnswer(
        text,
        selectedProviderRef.current,
        getUserContext()
      )

      // Add current answer to history if it exists
      if (answer.trim()) {
        setAnswerHistory(prev => [answer, ...prev])
      }

      setAnswer(result)
      setStatus('idle')

      // Refresh usage counters after successful transcription
      refreshUsageCounters()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      // If session expired mid-session, force re-login
      if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('401')) {
        setAuthState('logged-out')
      }
      setError(msg)
      setStatus('idle')
    }
  }, [])

  useEffect(() => {
    const cleanupStart = window.electronAPI.onHotkeyRecordStart(() => {
      startRecording().catch(err => {
        console.error('Hotkey recording failed:', err)
        setError(err instanceof Error ? err.message : 'Recording failed')
      })
    })
    const cleanupStop = window.electronAPI.onHotkeyRecordStop(() => {
      stopRecording().catch(err => {
        console.error('Hotkey stop failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to stop recording')
      })
    })
    return () => { cleanupStart(); cleanupStop() }
  }, [startRecording, stopRecording])

  useEffect(() => {
    if (!logoMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (logoMenuRef.current && !logoMenuRef.current.contains(e.target as Node)) {
        setLogoMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [logoMenuOpen])

  const handleLoadCV = async () => {
    const result = await window.electronAPI.loadTextFile()
    if (result) { setCv(result.content); setCvName(result.name) }
  }

  const handleLoadJobDesc = async () => {
    const result = await window.electronAPI.loadTextFile()
    if (result) { setJobDesc(result.content); setJobDescName(result.name) }
  }

  const [codeSnapshotState, setCodeSnapshotState] = useState<CodeSnapshotState>('idle')
  const [windowSources, setWindowSources] = useState<WindowSource[]>([])
  const [capturedImage, setCapturedImage] = useState<string>('')

  const handleCodeSnapshot = async () => {
    if (codeSnapshotState !== 'idle' || status !== 'idle') return
    console.log('[handleCodeSnapshot] Starting code snapshot flow')
    setError('')

    try {
      console.log('[handleCodeSnapshot] Setting state to selecting-window')
      setCodeSnapshotState('selecting-window')
      console.log('[handleCodeSnapshot] Requesting window sources from main process...')
      const sources = await window.electronAPI.getWindowSources()
      console.log(`[handleCodeSnapshot] Received ${sources.length} window sources:`)
      sources.forEach((src, idx) => {
        console.log(`  [${idx}] id="${src.id}", name="${src.name}"`)
      })
      setWindowSources(sources)
      console.log('[handleCodeSnapshot] Window picker should now be visible')
    } catch (err) {
      console.error('[handleCodeSnapshot] Error getting windows:', err)
      setError(err instanceof Error ? err.message : 'Failed to get windows')
      setCodeSnapshotState('idle')
    }
  }

  const handleAreaSelection = async () => {
    if (codeSnapshotState !== 'idle' || status !== 'idle') return
    console.log('[handleAreaSelection] Starting area selection flow')
    setError('')

    try {
      console.log('[handleAreaSelection] Setting state to selecting-window')
      setCodeSnapshotState('selecting-window')
      console.log('[handleAreaSelection] Opening area selection overlay...')

      const rect = await window.electronAPI.startAreaSelection()

      if (!rect) {
        console.log('[handleAreaSelection] Area selection cancelled')
        setCodeSnapshotState('idle')
        return
      }

      console.log('[handleAreaSelection] Area selected:', rect)
      console.log('[handleAreaSelection] Capturing screen area...')
      const imageBase64 = await window.electronAPI.captureScreenArea(rect)
      console.log(`[handleAreaSelection] Successfully captured area (${imageBase64.length} bytes)`)

      console.log('[handleAreaSelection] Showing voice modal')
      setCapturedImage(imageBase64)
      setCodeSnapshotState('awaiting-voice')
    } catch (err) {
      console.error('[handleAreaSelection] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to capture and analyze area')
      setCodeSnapshotState('idle')
    }
  }

  const handleWindowSelect = async (sourceId: string) => {
    console.log(`[handleWindowSelect] User selected window with id="${sourceId}"`)
    try {
      console.log('[handleWindowSelect] Requesting window capture from main process...')
      const imageBase64 = await window.electronAPI.captureWindow(sourceId)
      console.log(`[handleWindowSelect] Successfully captured window (${imageBase64.length} bytes)`)
      setWindowSources([]) // Close window picker

      console.log('[handleWindowSelect] Showing voice modal')
      setCapturedImage(imageBase64)
      setCodeSnapshotState('awaiting-voice')
    } catch (err) {
      console.error('[handleWindowSelect] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to capture and analyze window')
      setCodeSnapshotState('idle')
      setWindowSources([])
    }
  }

  const handleCancelCodeSnapshot = () => {
    console.log('[handleCancelCodeSnapshot] User cancelled code snapshot')
    setCodeSnapshotState('idle')
    setWindowSources([])
    setCapturedImage('')
  }

  const handleVoiceSubmit = async (audioBuffer: ArrayBuffer | null) => {
    try {
      console.log('[handleVoiceSubmit] Processing submission with audio:', audioBuffer !== null)
      setCodeSnapshotState('analyzing')

      let context: string | undefined = undefined

      if (audioBuffer) {
        try {
          console.log('[handleVoiceSubmit] Transcribing audio context...')
          context = await window.electronAPI.transcribeAudio(audioBuffer)
          console.log('[handleVoiceSubmit] Audio transcribed:', context)
        } catch (transcribeErr) {
          const errMsg = transcribeErr instanceof Error ? transcribeErr.message : ''
          if (errMsg.toLowerCase().includes('limit') || errMsg.toLowerCase().includes('429')) {
            console.log('[handleVoiceSubmit] Transcription limit reached, proceeding without audio context')
          } else {
            throw transcribeErr
          }
        }
      }

      console.log('[handleVoiceSubmit] Analyzing code snapshot...')
      const explanation = await window.electronAPI.analyzeCodeSnapshot(capturedImage, context)
      console.log('[handleVoiceSubmit] Analysis complete')

      if (answer.trim()) {
        setAnswerHistory(prev => [answer, ...prev])
      }

      setAnswer(explanation)
      setCodeSnapshotState('idle')
      setCapturedImage('')

      refreshUsageCounters()
    } catch (err) {
      console.error('[handleVoiceSubmit] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze snapshot')
      setCodeSnapshotState('idle')
      setCapturedImage('')
    }
  }

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const stopAllServices = useCallback(() => {
    if (statusRef.current === 'recording') {
      recorderRef.current.stop().catch(() => {})
      setStatus('idle')
    }
    stopMockMode()
    stopPassiveListen()
    setCodeSnapshotState('idle')
    setWindowSources([])
    setCapturedImage('')
    setError('')
  }, [stopMockMode, stopPassiveListen])

  const handleSelectMode = useCallback((mode: InterviewMode) => {
    setTranscript('')
    setAnswer('')
    setAnswerHistory([])
    setError('')
    setAppView(mode)
  }, [])

  const handleBackToSelect = useCallback(() => {
    stopAllServices()
    setTranscript('')
    setAnswer('')
    setAnswerHistory([])
    setAppView('select')
  }, [stopAllServices])

  // ── Render auth screens ────────────────────────────────────────────────────

  if (authState === 'loading') {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900/85 rounded-2xl backdrop-blur-sm border border-white/10 shadow-2xl">
        <p className="text-xs text-gray-500">Connecting...</p>
      </div>
    )
  }

  // No login required - skip the login screen entirely
  // When authState is 'logged-out', go directly to the main interface
  if (authState === 'logged-out') {
    // Directly set to active state with no providers to show main app without login
    setProviders([])
    setSelectedProvider('claude' as any)
    setAuthState('no-subscription')
    return <ServiceSelection
      onSelect={handleSelectMode}
      onSettings={() => setAppView('settings')}
      onLogout={handleLogout}
      apiUrl={apiUrl}
      cvName={cvName}
      jobDescName={jobDescName}
      manualContext={manualContext}
      apiKeys={loadedApiKeys}
    />
  }

  if (authState === 'no-subscription' && !hasApiKey) {
    return <SubscribeScreen onLogout={handleLogout} onRefresh={handleRefreshSubscription} onApiKeySet={handleApiKeySet} />
  }

  // ── Service selection ──────────────────────────────────────────────────────

  if (appView === 'select') {
    return (
      <ServiceSelection
        onSelect={handleSelectMode}
        onSettings={() => setAppView('settings')}
        onLogout={handleLogout}
        apiUrl={apiUrl}
        cvName={cvName}
        jobDescName={jobDescName}
        manualContext={manualContext}
        apiKeys={loadedApiKeys}
      />
    )
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  if (appView === 'settings') {
    return (
      <SettingsScreen
        onBack={() => {
          // Refresh subscription status to pick up any new API keys
          handleRefreshSubscription().catch(() => {})
          setAppView('select')
        }}
        cvName={cvName}
        jobDescName={jobDescName}
        manualContext={manualContext}
        onLoadCV={handleLoadCV}
        onLoadJobDesc={handleLoadJobDesc}
        onClearCV={() => { setCv(''); setCvName('') }}
        onClearJobDesc={() => { setJobDesc(''); setJobDescName('') }}
        onManualContextChange={setManualContext}
      />
    )
  }

  // ── Mode UI (general | code | mock) ───────────────────────────────────────

  const modeLabel = appView === 'general' ? 'General Interview'
    : appView === 'code' ? 'Code Interview'
    : 'Mock Interview'

  const isGeneralOrCode = appView === 'general' || appView === 'code'

  return (
    <div className="h-full flex flex-col bg-gray-900/85 rounded-2xl backdrop-blur-sm border border-white/10 overflow-hidden shadow-2xl">
      {/* Draggable title bar */}
      <div className="drag-region px-4 py-3 border-b border-white/10">
        {/* Top row: back + status | controls + logo */}
        <div className="flex items-center justify-between mb-3">
          <div className="no-drag flex items-center gap-2">
            <button
              onClick={handleBackToSelect}
              className="p-1 text-gray-400 hover:text-gray-200 hover:bg-white/10 rounded transition-colors cursor-pointer"
              title="Back to mode selection"
            >
              <ArrowLeft size={14} />
            </button>
            <span className="text-xs font-semibold text-gray-300">{modeLabel}</span>
            {apiUrl && <StatusIndicator apiUrl={apiUrl} />}
            {status !== 'idle' && (
              <span className="text-xs text-gray-400 capitalize">{status}...</span>
            )}
            {status === 'idle' && mockStatus !== 'off' && (
              <span className="text-xs text-green-400 capitalize">{mockStatus}...</span>
            )}
            {status === 'idle' && mockStatus === 'off' && passiveStatus !== 'off' && (
              <span className="text-xs text-purple-400 capitalize">
                {passiveSource === 'microphone' ? 'mic' : 'sys'} {passiveStatus === 'processing' ? 'processing...' : 'listening...'}
              </span>
            )}
          </div>

          <div className="no-drag flex items-center gap-2">
            {authState === 'no-subscription' && (
              <button
                onClick={() => window.electronAPI.openSubscribe()}
                className="text-xs px-2 py-1 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40 transition-colors cursor-pointer whitespace-nowrap"
              >
                Want more features? Sign up
              </button>
            )}
            <select
              value={textSize}
              onChange={(e) => setTextSize(e.target.value as TextSize)}
              className="bg-gray-800 text-gray-300 text-xs rounded-md px-2 py-1.5 border border-white/10 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="small">S</option>
              <option value="medium">M</option>
              <option value="large">L</option>
              <option value="extra-large">XL</option>
            </select>

            {providers.length > 1 ? (
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as AIProvider)}
                className="bg-gray-800 text-gray-300 text-xs rounded-md px-2 py-1.5 border border-white/10 outline-none focus:border-blue-500 cursor-pointer"
              >
                {providers.map((p) => (
                  <option key={p} value={p}>
                    {p === 'claude' ? 'Claude' : p === 'gemini' ? 'Gemini' : p === 'qwen' ? 'Qwen' : p === 'custom' ? 'Custom' : 'OpenAI'}
                  </option>
                ))}
              </select>
            ) : providers.length === 1 ? (
              <span className="text-xs text-gray-500">
                {providers[0] === 'claude' ? 'Claude' : providers[0] === 'gemini' ? 'Gemini' : providers[0] === 'qwen' ? 'Qwen' : providers[0] === 'custom' ? 'Custom' : 'OpenAI'}
              </span>
            ) : null}

            {/* Logo dropdown */}
            <div ref={logoMenuRef} className="relative ml-1">
              <button
                onClick={() => setLogoMenuOpen(o => !o)}
                className="flex items-center gap-0.5 p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                title="Menu"
              >
                <img src={bunnyLogo} alt="Mooch" className="h-7 w-7" />
                <ChevronDown size={10} className="text-gray-400" />
              </button>

              {logoMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => { setLogoMenuOpen(false); setShowAbout(true) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <Info size={13} />
                    About
                  </button>
                  <button
                    onClick={() => window.electronAPI.quitApp()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <Power size={13} />
                    Quit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* About modal */}
        {showAbout && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAbout(false)}>
            <div className="bg-gray-800 border border-white/10 rounded-xl p-6 shadow-2xl text-center w-56" onClick={e => e.stopPropagation()}>
              <img src={bunnyLogo} alt="Mooch" className="h-14 w-14 mx-auto mb-3" />
              <p className="text-white font-semibold text-sm">Interview Co-Pilot</p>
              <p className="text-gray-400 text-xs mt-1">Version {appVersion}</p>
              <button
                onClick={() => setShowAbout(false)}
                className="mt-4 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Mode buttons */}
        <div className="no-drag flex items-end gap-2 flex-wrap">

          {/* General + Code: passive listen buttons */}
          {isGeneralOrCode && (
            <>
              <button
                onClick={() => passiveStatus === 'off' || passiveSource !== 'system' ? startPassiveListen('system') : stopPassiveListen()}
                disabled={
                  status === 'recording' ||
                  status === 'transcribing' ||
                  status === 'thinking' ||
                  mockStatus !== 'off' ||
                  codeSnapshotState !== 'idle' ||
                  (passiveStatus !== 'off' && passiveSource !== 'system') ||
                  (transcriptionLimit !== null && transcriptionsUsed >= transcriptionLimit && passiveStatus === 'off')
                }
                className={`
                  min-w-[64px] px-2 py-2 rounded-xl font-medium transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                  ${passiveStatus !== 'off' && passiveSource === 'system'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                  }
                `}
                title="Passively listen to system audio and auto-answer detected questions"
              >
                <span className="flex flex-col items-center gap-1">
                  <span className="flex items-center justify-center h-10 w-10 rounded-lg bg-white"><video src={iconPassiveSys} autoPlay muted playsInline className="h-9 w-9" /></span>
                  <span className="text-[11px] leading-tight">
                    {(passiveStatus === 'off' || passiveSource !== 'system') && 'Passive Sys'}
                    {passiveStatus === 'listening' && passiveSource === 'system' && 'Listening...'}
                    {passiveStatus === 'processing' && passiveSource === 'system' && 'Processing...'}
                  </span>
                </span>
              </button>

              <button
                onClick={() => passiveStatus === 'off' || passiveSource !== 'microphone' ? startPassiveListen('microphone') : stopPassiveListen()}
                disabled={
                  status === 'recording' ||
                  status === 'transcribing' ||
                  status === 'thinking' ||
                  mockStatus !== 'off' ||
                  codeSnapshotState !== 'idle' ||
                  (passiveStatus !== 'off' && passiveSource !== 'microphone') ||
                  (transcriptionLimit !== null && transcriptionsUsed >= transcriptionLimit && passiveStatus === 'off')
                }
                className={`
                  min-w-[64px] px-2 py-2 rounded-xl font-medium transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                  ${passiveStatus !== 'off' && passiveSource === 'microphone'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                  }
                `}
                title="Passively listen to microphone and auto-answer detected questions"
              >
                <span className="flex flex-col items-center gap-1">
                  <span className="flex items-center justify-center h-10 w-10 rounded-lg bg-white"><video src={iconPassiveMic} autoPlay muted playsInline className="h-9 w-9" /></span>
                  <span className="text-[11px] leading-tight">
                    {(passiveStatus === 'off' || passiveSource !== 'microphone') && 'Passive Mic'}
                    {passiveStatus === 'listening' && passiveSource === 'microphone' && 'Listening...'}
                    {passiveStatus === 'processing' && passiveSource === 'microphone' && 'Processing...'}
                  </span>
                </span>
              </button>

              <button
                onClick={() => {
                  if (status === 'recording' && audioSource === 'microphone') {
                    stopRecording()
                  } else if (status === 'idle') {
                    setAudioSource('microphone')
                    setError('')
                    startRecording()
                  }
                }}
                disabled={
                  mockStatus !== 'off' ||
                  passiveStatus !== 'off' ||
                  status === 'transcribing' ||
                  status === 'thinking' ||
                  (status === 'recording' && audioSource !== 'microphone') ||
                  (transcriptionLimit !== null && transcriptionsUsed >= transcriptionLimit && status !== 'recording')
                }
                className={`
                  min-w-[64px] px-2 py-2 rounded-xl font-medium transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                  ${audioSource === 'microphone' && status === 'recording'
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25'
                    : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
                  }
                `}
                title="Record from microphone"
              >
                <span className="flex flex-col items-center gap-1">
                  <span className="flex items-center justify-center h-10 w-10 rounded-lg bg-white"><video src={iconMic} autoPlay muted playsInline className="h-9 w-9" /></span>
                  <span className="text-[11px] leading-tight">
                    {audioSource === 'microphone' && status === 'recording' ? 'Stop' : 'Mic'}
                  </span>
                </span>
              </button>

              <button
                onClick={() => {
                  if (status === 'recording' && audioSource === 'system') {
                    stopRecording()
                  } else if (status === 'idle') {
                    setAudioSource('system')
                    setError('')
                    startRecording()
                  }
                }}
                disabled={
                  mockStatus !== 'off' ||
                  passiveStatus !== 'off' ||
                  status === 'transcribing' ||
                  status === 'thinking' ||
                  (status === 'recording' && audioSource !== 'system') ||
                  (transcriptionLimit !== null && transcriptionsUsed >= transcriptionLimit && status !== 'recording')
                }
                className={`
                  min-w-[64px] px-2 py-2 rounded-xl font-medium transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                  ${audioSource === 'system' && status === 'recording'
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25'
                    : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
                  }
                `}
                title="Record system audio"
              >
                <span className="flex flex-col items-center gap-1">
                  <span className="flex items-center justify-center h-10 w-10 rounded-lg bg-white"><video src={iconSystem} autoPlay muted playsInline className="h-9 w-9" /></span>
                  <span className="text-[11px] leading-tight">
                    {audioSource === 'system' && status === 'recording' ? 'Stop' : 'System'}
                  </span>
                </span>
              </button>
            </>
          )}

          {/* Code only: snapshot buttons */}
          {appView === 'code' && hasCodeSnapshot && (
            <>
              <button
                onClick={handleCodeSnapshot}
                disabled={
                  codeSnapshotState !== 'idle' ||
                  status !== 'idle' ||
                  (snapshotLimit !== null && snapshotsUsed >= snapshotLimit)
                }
                className="min-w-[64px] px-2 py-2 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                title="Capture window screenshot"
              >
                <span className="flex flex-col items-center gap-1">
                  <span className="flex items-center justify-center h-10 w-10 rounded-lg bg-white"><video src={iconWindow} autoPlay muted playsInline className="h-9 w-9" /></span>
                  <span className="text-[11px] leading-tight">
                    {codeSnapshotState === 'selecting-window' && windowSources.length > 0 && 'Select...'}
                    {codeSnapshotState === 'analyzing' && 'Analyzing...'}
                    {codeSnapshotState === 'idle' && 'Window'}
                  </span>
                </span>
              </button>

              <button
                onClick={handleAreaSelection}
                disabled={
                  codeSnapshotState !== 'idle' ||
                  status !== 'idle' ||
                  (snapshotLimit !== null && snapshotsUsed >= snapshotLimit)
                }
                className="min-w-[64px] px-2 py-2 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                title="Select screen area to capture"
              >
                <span className="flex flex-col items-center gap-1">
                  <span className="flex items-center justify-center h-10 w-10 rounded-lg bg-white"><video src={iconArea} autoPlay muted playsInline className="h-9 w-9" /></span>
                  <span className="text-[11px] leading-tight">
                    {codeSnapshotState === 'selecting-window' && windowSources.length === 0 && 'Selecting...'}
                    {codeSnapshotState === 'analyzing' && 'Analyzing...'}
                    {codeSnapshotState === 'idle' && 'Area'}
                  </span>
                </span>
              </button>
            </>
          )}

          {/* Mock interview button */}
          {appView === 'mock' && (
            <button
              onClick={() => mockStatus === 'off' ? startMockMode() : stopMockMode()}
              disabled={
                status === 'recording' ||
                status === 'transcribing' ||
                status === 'thinking' ||
                passiveStatus !== 'off' ||
                codeSnapshotState !== 'idle'
              }
              className={`
                min-w-[64px] px-2 py-2 rounded-xl font-medium transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                ${mockStatus !== 'off'
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/25'
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/25'
                }
              `}
              title="Continuous mock interview mode"
            >
              <span className="flex flex-col items-center gap-1">
                <span className="flex items-center justify-center h-10 w-10 rounded-lg bg-white"><video src={iconMock} autoPlay muted playsInline className="h-9 w-9" /></span>
                <span className="text-[11px] leading-tight">
                  {mockStatus === 'off' && 'Start Mock'}
                  {mockStatus === 'listening' && 'Listening...'}
                  {mockStatus === 'thinking' && 'Thinking...'}
                  {mockStatus === 'speaking' && 'Speaking...'}
                </span>
              </span>
            </button>
          )}
        </div>

        {/* Usage counters */}
        <div className="no-drag mt-2 flex items-center gap-3 justify-center">
          {transcriptionLimit !== null && (
            <span className="text-[10px] text-gray-500">
              {transcriptionsUsed}/{transcriptionLimit} transcriptions
            </span>
          )}
          {appView === 'code' && hasCodeSnapshot && snapshotLimit !== null && (
            <span className="text-[10px] text-gray-500">
              {snapshotsUsed}/{snapshotLimit} snapshots
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/20 border-b border-red-500/30">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Upgrade notification when user hits limit */}
      {(
        (transcriptionLimit !== null && transcriptionsUsed >= transcriptionLimit) ||
        (appView === 'code' && snapshotLimit !== null && snapshotsUsed >= snapshotLimit)
      ) && (
        <div className="px-4 py-2 bg-yellow-500/20 border-b border-yellow-500/30">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-yellow-400">
              {transcriptionLimit !== null && transcriptionsUsed >= transcriptionLimit
                ? 'You\'ve reached your transcription limit.'
                : 'You\'ve reached your snapshot limit.'}
            </p>
            <button
              onClick={() => window.electronAPI.openManageSubscription()}
              className="px-3 py-1 text-xs font-medium bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              Upgrade Plan
            </button>
          </div>
        </div>
      )}

      <TranscriptPanel transcript={transcript} status={status} />
      <AnswerPanel
        answer={answer}
        answerHistory={answerHistory}
        status={status}
        textSize={textSize}
        passiveProcessing={passiveStatus === 'processing'}
      />

      <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between">
        {isGeneralOrCode ? (
          <p className="text-[10px] text-gray-500 flex-1 text-center">
            Hold <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Ctrl+Shift+Space</kbd> to record
          </p>
        ) : (
          <p className="text-[10px] text-gray-500 flex-1 text-center">
            Speak naturally — AI answers after each question
          </p>
        )}
        <button
          onClick={handleLogout}
          title="Sign out"
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors cursor-pointer"
        >
          ⏻
        </button>
      </div>

      {/* Window Picker Modal */}
      {windowSources.length > 0 && (
        <WindowPicker
          windows={windowSources}
          onSelect={handleWindowSelect}
          onCancel={handleCancelCodeSnapshot}
        />
      )}

      {/* Capture Voice Modal */}
      {codeSnapshotState === 'awaiting-voice' && capturedImage && (
        <CaptureVoiceModal
          onSubmit={handleVoiceSubmit}
          onCancel={handleCancelCodeSnapshot}
        />
      )}
    </div>
  )
}
