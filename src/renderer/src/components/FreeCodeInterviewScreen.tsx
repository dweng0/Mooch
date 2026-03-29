import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, CheckCircle2, Circle, Loader2, ChevronRight, ChevronDown,
  Mic, Headphones, Plug, MessageSquare, Trash2, Code2,
} from 'lucide-react'
import { AudioRecorder } from '../services/recorder'
import { PassiveListenService } from '../services/passiveListen'
import type { FreeCodeSessionData, FreeCodeFeature, FreeCodeSubStep, FreeCodeAsideEntry } from '../../../shared/types'
import codeIcon from '../assets/freecode.webm'

interface Props {
  onBack: () => void
}

type ViewMode = 'select' | 'generating' | 'active'
type RecordStatus = 'idle' | 'recording' | 'transcribing' | 'thinking'
type PassiveStatus = 'off' | 'listening' | 'processing'

const DISCONNECT_TIMEOUT = 60000
const POLL_INTERVAL = 3000

export default function FreeCodeInterviewScreen({ onBack }: Props) {
  const [view, setView] = useState<ViewMode>('select')
  const [sessions, setSessions] = useState<FreeCodeSessionData[]>([])
  const [session, setSession] = useState<FreeCodeSessionData | null>(null)
  const [features, setFeatures] = useState<FreeCodeFeature[]>([])
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set())
  const [expandedSubSteps, setExpandedSubSteps] = useState<Set<string>>(new Set())
  const [loadingFeature, setLoadingFeature] = useState<string | null>(null)
  const [loadingSubStep, setLoadingSubStep] = useState<string | null>(null)
  const [asideHistory, setAsideHistory] = useState<FreeCodeAsideEntry[]>([])
  const [asideExpanded, setAsideExpanded] = useState(true)

  // Setup form
  const [task, setTask] = useState('')
  const [language, setLanguage] = useState('')
  const [framework, setFramework] = useState('')
  const [error, setError] = useState<string | null>(null)

  // VS Code connection
  const [vsCodeConnected, setVsCodeConnected] = useState(false)
  const [vsCodeState, setVsCodeState] = useState<{ code?: string; pageTitle?: string; language?: string | null; openFiles?: Array<{ filePath: string; fileName: string; language: string; code?: string }> }>({})

  // Audio (ASIDE)
  const [recordStatus, setRecordStatus] = useState<RecordStatus>('idle')
  const [audioSource, setAudioSource] = useState<'microphone' | 'system'>('microphone')
  const [passiveStatus, setPassiveStatus] = useState<PassiveStatus>('off')
  const [passiveSource, setPassiveSource] = useState<'microphone' | 'system'>('system')
  const [qaError, setQaError] = useState<string | null>(null)

  // Refs for closures
  const sessionRef = useRef(session)
  sessionRef.current = session
  const vsCodeStateRef = useRef(vsCodeState)
  vsCodeStateRef.current = vsCodeState
  const recordStatusRef = useRef<RecordStatus>('idle')
  recordStatusRef.current = recordStatus
  const passiveStatusRef = useRef<PassiveStatus>('off')
  passiveStatusRef.current = passiveStatus
  const expandedFeaturesRef = useRef(expandedFeatures)
  expandedFeaturesRef.current = expandedFeatures
  const featuresRef = useRef(features)
  featuresRef.current = features

  const freeCodeVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (freeCodeVideoRef.current) {
        freeCodeVideoRef.current.currentTime = 2
        freeCodeVideoRef.current.play()
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const recorderRef = useRef(new AudioRecorder())
  const passiveServiceRef = useRef(new PassiveListenService())
  const checkProgressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevCodeRef = useRef<string | undefined>()
  const missCountRef = useRef(0)

  // Bridge lifecycle
  useEffect(() => {
    window.electronAPI.bridgeStart().catch(() => {})
    return () => {
      window.electronAPI.bridgeStop()
      passiveServiceRef.current.stop()
    }
  }, [])

  // Poll VS Code connection
  useEffect(() => {
    const poll = async () => {
      try {
        const s = await window.electronAPI.bridgeStatus()
        const connected = s.connected && s.clientType === 'vscode-extension' && Date.now() - s.lastSeen < DISCONNECT_TIMEOUT
        if (connected) {
          missCountRef.current = 0
          setVsCodeConnected(true)
        } else if (vsCodeConnected) {
          missCountRef.current += 1
          if (missCountRef.current >= 5) {
            missCountRef.current = 0
            setVsCodeConnected(false)
          }
        }
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [vsCodeConnected])

  // Listen for VS Code extension updates
  useEffect(() => {
    const unsub = window.electronAPI.onBridgeExtensionUpdate((state: any) => {
      if (state.clientType !== 'vscode-extension') return
      setVsCodeConnected(true)
      setVsCodeState({ code: state.code, pageTitle: state.pageTitle, language: state.language, openFiles: state.openFiles })

      if (state.code && state.code !== prevCodeRef.current && sessionRef.current) {
        prevCodeRef.current = state.code
        if (checkProgressTimerRef.current) clearTimeout(checkProgressTimerRef.current)
        checkProgressTimerRef.current = setTimeout(() => {
          runCheckProgress(state.code, state.pageTitle || 'unknown')
        }, 2000)
      }
    })
    return () => {
      unsub()
      if (checkProgressTimerRef.current) clearTimeout(checkProgressTimerRef.current)
    }
  }, [])

  // Load saved sessions on mount
  useEffect(() => {
    window.electronAPI.freeCodeListSessions().then(setSessions).catch(() => {})
  }, [])

  const runCheckProgress = async (code: string, filename: string) => {
    const sess = sessionRef.current
    if (!sess) return
    try {
      const { completedIds } = await window.electronAPI.freeCodeCheckProgress(sess.sessionId, code, filename, vsCodeStateRef.current.openFiles)
      if (completedIds.length === 0) return

      setFeatures(prev => applyCompletedIds(prev, completedIds))
      setSession(prev => {
        if (!prev) return prev
        const updated = { ...prev, features: applyCompletedIds(prev.features, completedIds) }
        window.electronAPI.freeCodeSaveSession(updated).catch(() => {})
        return updated
      })
    } catch { /* ignore progress check errors */ }
  }

  const applyCompletedIds = (feats: FreeCodeFeature[], completedIds: string[]): FreeCodeFeature[] => {
    return feats.map(f => {
      if (!f.subSteps) return f
      const updatedSubs = f.subSteps.map(s =>
        completedIds.includes(s.id) ? { ...s, status: 'done' as const } : s
      )
      const allDone = updatedSubs.length > 0 && updatedSubs.every(s => s.status === 'done')
      return { ...f, subSteps: updatedSubs, status: allDone ? 'done' as const : f.status }
    })
  }

  const getActiveFeatureTitle = () => {
    const ids = [...expandedFeaturesRef.current]
    if (ids.length === 0) return undefined
    return featuresRef.current.find(f => f.id === ids[ids.length - 1])?.title
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  const handleGeneratePlan = async () => {
    if (!task.trim()) return
    setError(null)
    setView('generating')
    try {
      const sess = await window.electronAPI.freeCodeCreateSession(task.trim(), language.trim() || undefined, framework.trim() || undefined)
      const newFeatures = await window.electronAPI.freeCodeGeneratePlan(sess.sessionId)
      const updatedSession = { ...sess, features: newFeatures }
      setSession(updatedSession)
      setFeatures(newFeatures)
      setAsideHistory([])
      setSessions(prev => [updatedSession, ...prev])
      setView('active')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan')
      setView('select')
    }
  }

  const handleLoadSession = (sess: FreeCodeSessionData) => {
    setSession(sess)
    setFeatures(sess.features)
    setAsideHistory(sess.asideHistory)
    setExpandedFeatures(new Set())
    setExpandedSubSteps(new Set())
    setView('active')
  }

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    await window.electronAPI.freeCodeDeleteSession(sessionId)
    setSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    if (session?.sessionId === sessionId) {
      setSession(null)
      setView('select')
    }
  }

  // ── Plan interaction ───────────────────────────────────────────────────────

  const handleToggleFeature = async (featureId: string) => {
    const isExpanded = expandedFeatures.has(featureId)

    if (isExpanded) {
      setExpandedFeatures(prev => { const s = new Set(prev); s.delete(featureId); return s })
      return
    }

    setExpandedFeatures(prev => new Set([...prev, featureId]))

    const feature = features.find(f => f.id === featureId)
    if (feature && !feature.subSteps) {
      setLoadingFeature(featureId)
      try {
        const subSteps = await window.electronAPI.freeCodeExpandFeature(session!.sessionId, featureId)
        setFeatures(prev => prev.map(f => f.id === featureId ? { ...f, subSteps } : f))
        setSession(prev => {
          if (!prev) return prev
          const updated = { ...prev, features: prev.features.map(f => f.id === featureId ? { ...f, subSteps } : f) }
          window.electronAPI.freeCodeSaveSession(updated).catch(() => {})
          return updated
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load steps')
        setExpandedFeatures(prev => { const s = new Set(prev); s.delete(featureId); return s })
      } finally {
        setLoadingFeature(null)
      }
    }
  }

  const handleToggleSubStep = async (featureId: string, subStepId: string) => {
    const key = `${featureId}:${subStepId}`
    const isExpanded = expandedSubSteps.has(key)

    if (isExpanded) {
      setExpandedSubSteps(prev => { const s = new Set(prev); s.delete(key); return s })
      return
    }

    setExpandedSubSteps(prev => new Set([...prev, key]))

    const feature = features.find(f => f.id === featureId)
    const subStep = feature?.subSteps?.find(s => s.id === subStepId)
    if (feature && subStep && !subStep.code) {
      setLoadingSubStep(subStepId)
      try {
        const detail = await window.electronAPI.freeCodeExpandSubStep(session!.sessionId, featureId, subStepId)
        setFeatures(prev => prev.map(f => {
          if (f.id !== featureId) return f
          return { ...f, subSteps: f.subSteps?.map(s => s.id === subStepId ? { ...s, ...detail } : s) }
        }))
        setSession(prev => {
          if (!prev) return prev
          const updated = {
            ...prev,
            features: prev.features.map(f => {
              if (f.id !== featureId) return f
              return { ...f, subSteps: f.subSteps?.map(s => s.id === subStepId ? { ...s, ...detail } : s) }
            })
          }
          window.electronAPI.freeCodeSaveSession(updated).catch(() => {})
          return updated
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load step detail')
        setExpandedSubSteps(prev => { const s = new Set(prev); s.delete(key); return s })
      } finally {
        setLoadingSubStep(null)
      }
    }
  }

  // ── Manual step toggle ─────────────────────────────────────────────────────

  const handleManualToggleStep = (featureId: string, subStepId: string) => {
    const toggle = (feats: FreeCodeFeature[]): FreeCodeFeature[] =>
      feats.map(f => {
        if (f.id !== featureId || !f.subSteps) return f
        const updatedSubs = f.subSteps.map(s =>
          s.id === subStepId ? { ...s, status: (s.status === 'done' ? 'todo' : 'done') as const } : s
        )
        const allDone = updatedSubs.length > 0 && updatedSubs.every(s => s.status === 'done')
        return { ...f, subSteps: updatedSubs, status: allDone ? 'done' as const : 'todo' as const }
      })

    setFeatures(toggle)
    setSession(prev => {
      if (!prev) return prev
      const updated = { ...prev, features: toggle(prev.features) }
      window.electronAPI.freeCodeSaveSession(updated).catch(() => {})
      return updated
    })
  }

  // ── Audio (ASIDE) ──────────────────────────────────────────────────────────

  const addAsideEntry = useCallback((entry: FreeCodeAsideEntry) => {
    setAsideHistory(prev => [entry, ...prev])
    setSession(prev => {
      if (!prev) return prev
      return { ...prev, asideHistory: [entry, ...(prev.asideHistory || [])] }
    })
    setAsideExpanded(true)
  }, [])

  const startRecording = useCallback(async (source: 'microphone' | 'system') => {
    if (recordStatusRef.current !== 'idle') return
    setQaError(null)
    setAudioSource(source)
    try {
      await recorderRef.current.start(source)
      setRecordStatus('recording')
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Audio access denied')
    }
  }, [])

  const stopRecording = useCallback(async () => {
    if (recordStatusRef.current !== 'recording') return
    try {
      const buffer = await recorderRef.current.stop()
      setRecordStatus('transcribing')
      const question = await window.electronAPI.transcribeAudio(buffer)
      setRecordStatus('thinking')

      const sess = sessionRef.current
      if (!sess) { setRecordStatus('idle'); return }

      const vsCode = vsCodeStateRef.current
      const entry = await window.electronAPI.freeCodeAsideAnswer(
        sess.sessionId, question, vsCode.code, vsCode.pageTitle, getActiveFeatureTitle(), vsCode.openFiles
      )
      addAsideEntry(entry)
      setRecordStatus('idle')
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Something went wrong')
      setRecordStatus('idle')
    }
  }, [addAsideEntry])

  const startPassiveListen = useCallback(async (source: 'microphone' | 'system') => {
    if (passiveStatusRef.current !== 'off') return
    setPassiveSource(source)
    setQaError(null)
    await passiveServiceRef.current.start({
      audioSource: source,
      onTranscript: () => {},
      onDetected: async (text) => {
        const sess = sessionRef.current
        if (!sess) return
        try {
          const vsCode = vsCodeStateRef.current
          const entry = await window.electronAPI.freeCodeAsideAnswer(
            sess.sessionId, text, vsCode.code, vsCode.pageTitle, getActiveFeatureTitle(), vsCode.openFiles
          )
          addAsideEntry(entry)
        } catch (err) {
          setQaError(err instanceof Error ? err.message : 'Something went wrong')
        }
      },
      onStatus: (s) => setPassiveStatus(s),
      onError: (msg) => { setQaError(msg); setPassiveStatus('off') },
    })
  }, [addAsideEntry])

  const stopPassiveListen = useCallback(() => {
    passiveServiceRef.current.stop()
    setPassiveStatus('off')
  }, [])

  const handleBack = useCallback(() => {
    passiveServiceRef.current.stop()
    window.electronAPI.bridgeStop()
    onBack()
  }, [onBack])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="drag-region px-4 py-3 border-b border-gray-200 flex-none">
        <div className="flex items-center justify-between">
          <div className="no-drag flex items-center gap-2">
            <button
              onClick={handleBack}
              className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-gray-700">Code Interview — Free Code</span>
            <VsCodeDot connected={vsCodeConnected} />
          </div>
          {view === 'active' && (
            <div className="no-drag flex items-center gap-1.5">
              <AudioButtons
                recordStatus={recordStatus}
                audioSource={audioSource}
                passiveStatus={passiveStatus}
                passiveSource={passiveSource}
                onStart={startRecording}
                onStop={stopRecording}
                onPassiveStart={startPassiveListen}
                onPassiveStop={stopPassiveListen}
              />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Select / Setup view ── */}
        {(view === 'select' || view === 'generating') && (
          <div className="px-4 py-4 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-5">
              <div className="flex flex-col items-center mb-5">
                <video ref={freeCodeVideoRef} src={codeIcon} muted playsInline className="h-24 w-24" />
                <h2 className="text-xl font-bold text-gray-800 mt-2">Free Code Interview</h2>
                <p className="text-sm text-gray-500 text-center mt-1">Describe what you need to build and Mooch will generate a step-by-step plan</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Task *</label>
                  <textarea
                    value={task}
                    onChange={e => setTask(e.target.value)}
                    placeholder="e.g. Build a todo list app from scratch"
                    disabled={view === 'generating'}
                    className="w-full text-base text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none min-h-[80px] placeholder-gray-400 disabled:opacity-50"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-600 mb-1 block">Language <span className="text-gray-400">(optional)</span></label>
                    <input
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      placeholder="e.g. TypeScript"
                      disabled={view === 'generating'}
                      className="w-full text-base text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 disabled:opacity-50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-600 mb-1 block">Framework <span className="text-gray-400">(optional)</span></label>
                    <input
                      value={framework}
                      onChange={e => setFramework(e.target.value)}
                      placeholder="e.g. React"
                      disabled={view === 'generating'}
                      className="w-full text-base text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 disabled:opacity-50"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                <button
                  onClick={handleGeneratePlan}
                  disabled={!task.trim() || view === 'generating'}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-base font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {view === 'generating' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generating plan...
                    </>
                  ) : (
                    <>
                      <Code2 size={16} />
                      Generate Plan
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Previous sessions */}
            {sessions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Previous Sessions</p>
                {sessions.map(s => (
                  <button
                    key={s.sessionId}
                    onClick={() => handleLoadSession(s)}
                    className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-medium text-gray-800 truncate">{s.task}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {s.language ? `${s.language}${s.framework ? ` · ${s.framework}` : ''} · ` : ''}
                          {s.features.length} features · {new Date(s.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={e => handleDeleteSession(e, s.sessionId)}
                        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete session"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Active plan view ── */}
        {view === 'active' && session && (
          <div className="pb-4">
            {/* Session header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-800 truncate">{session.task}</p>
                  {(session.language || session.framework) && (
                    <p className="text-xs text-gray-400">
                      {[session.language, session.framework].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setSession(null); setView('select') }}
                  className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors"
                >
                  New Session
                </button>
              </div>

              {/* Progress bar */}
              <ProgressBar features={features} />
            </div>

            {qaError && (
              <div className="mx-4 mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{qaError}</div>
            )}

            {/* ASIDE section — pinned at top for visibility during interview */}
            {asideHistory.length > 0 && (
              <div className="px-4 pt-3">
                <button
                  onClick={() => setAsideExpanded(p => !p)}
                  className="flex items-center gap-2 w-full text-left mb-2"
                >
                  <div className="flex-1 border-t border-indigo-200" />
                  <span className="flex items-center gap-1 text-xs font-semibold text-indigo-500 uppercase tracking-wider">
                    <MessageSquare size={12} />
                    ASIDE ({asideHistory.length})
                  </span>
                  <div className="flex-1 border-t border-indigo-200" />
                  {asideExpanded ? <ChevronDown size={12} className="text-indigo-400" /> : <ChevronRight size={12} className="text-indigo-400" />}
                </button>

                {asideExpanded && (
                  <div className="space-y-2 mb-3">
                    {asideHistory.map(entry => (
                      <div key={entry.id} className="bg-indigo-50/50 rounded-xl border border-indigo-100 px-4 py-3">
                        {entry.activeFeatureTitle && (
                          <p className="text-xs text-indigo-400 mb-1">During: {entry.activeFeatureTitle}</p>
                        )}
                        <p className="text-sm font-medium text-indigo-800 mb-2 italic">&ldquo;{entry.question}&rdquo;</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{entry.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Features */}
            <div className="px-4 pt-3 space-y-2">
              {features.map((feature, i) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  index={i}
                  isExpanded={expandedFeatures.has(feature.id)}
                  isLoading={loadingFeature === feature.id}
                  onToggle={() => handleToggleFeature(feature.id)}
                  onManualToggleStep={handleManualToggleStep}
                  expandedSubSteps={expandedSubSteps}
                  loadingSubStep={loadingSubStep}
                  onToggleSubStep={handleToggleSubStep}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VsCodeDot({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1 text-xs text-gray-400">
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      {connected ? 'VS Code' : 'No VS Code'}
    </span>
  )
}

function ProgressBar({ features }: { features: FreeCodeFeature[] }) {
  const total = features.length
  if (total === 0) return null
  const done = features.filter(f => f.status === 'done').length
  const pct = Math.round((done / total) * 100)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-500 flex-shrink-0">{done}/{total}</span>
    </div>
  )
}

function StatusIcon({ status, size = 16 }: { status: 'todo' | 'in-progress' | 'done'; size?: number }) {
  if (status === 'done') return <CheckCircle2 size={size} className="text-emerald-500 flex-shrink-0" />
  if (status === 'in-progress') return <Circle size={size} className="text-blue-500 flex-shrink-0 animate-pulse" />
  return <Circle size={size} className="text-gray-300 flex-shrink-0" />
}

function FeatureCard({
  feature, index, isExpanded, isLoading, onToggle, onManualToggleStep,
  expandedSubSteps, loadingSubStep, onToggleSubStep,
}: {
  feature: FreeCodeFeature
  index: number
  isExpanded: boolean
  isLoading: boolean
  onToggle: () => void
  onManualToggleStep: (featureId: string, subStepId: string) => void
  expandedSubSteps: Set<string>
  loadingSubStep: string | null
  onToggleSubStep: (featureId: string, subStepId: string) => void
}) {
  return (
    <div className={`rounded-xl border transition-colors ${
      feature.status === 'done' ? 'border-emerald-200 bg-emerald-50/30'
      : isExpanded ? 'border-blue-200 bg-blue-50/20'
      : 'border-gray-200 bg-white'
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left"
      >
        <StatusIcon status={feature.status} size={18} />
        <span className="text-xs font-bold text-gray-400 flex-shrink-0">F{index + 1}</span>
        <span className="text-base font-medium text-gray-800 flex-1 min-w-0">{feature.title}</span>
        {isLoading ? (
          <Loader2 size={15} className="text-blue-400 animate-spin flex-shrink-0" />
        ) : isExpanded ? (
          <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-sm text-gray-500 italic border-l-2 border-blue-200 pl-3 ml-6">{feature.reasoning}</p>

          {isLoading && (
            <div className="flex items-center gap-2 pl-6 py-2">
              <Loader2 size={14} className="text-blue-400 animate-spin" />
              <span className="text-sm text-gray-400">Loading implementation steps...</span>
            </div>
          )}

          {!isLoading && feature.subSteps && feature.subSteps.map((sub, si) => (
            <SubStepCard
              key={sub.id}
              subStep={sub}
              index={si}
              featureId={feature.id}
              isExpanded={expandedSubSteps.has(`${feature.id}:${sub.id}`)}
              isLoading={loadingSubStep === sub.id}
              onToggle={() => onToggleSubStep(feature.id, sub.id)}
              onManualToggle={() => onManualToggleStep(feature.id, sub.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SubStepCard({
  subStep, index, featureId, isExpanded, isLoading, onToggle, onManualToggle,
}: {
  subStep: FreeCodeSubStep
  index: number
  featureId: string
  isExpanded: boolean
  isLoading: boolean
  onToggle: () => void
  onManualToggle: () => void
}) {
  return (
    <div className={`ml-5 rounded-lg border transition-colors ${
      subStep.status === 'done' ? 'border-emerald-200 bg-emerald-50/40'
      : isExpanded ? 'border-blue-200 bg-blue-50/30'
      : 'border-gray-100 bg-gray-50/50'
    }`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Clickable status icon for manual toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onManualToggle() }}
          className="cursor-pointer hover:scale-110 transition-transform"
          title={subStep.status === 'done' ? 'Mark as incomplete' : 'Mark as complete'}
        >
          <StatusIcon status={subStep.status} />
        </button>
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <span className="text-xs text-gray-400 flex-shrink-0">{index + 1}.</span>
          <span className="text-sm font-medium text-gray-700 flex-1 min-w-0">{subStep.title}</span>
          {isLoading ? (
            <Loader2 size={13} className="text-blue-400 animate-spin flex-shrink-0" />
          ) : isExpanded ? (
            <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight size={13} className="text-gray-400 flex-shrink-0" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-gray-100 pt-2">
          <p className="text-sm text-gray-500 italic">{subStep.reasoning}</p>

          {isLoading && (
            <div className="flex items-center gap-2 py-1">
              <Loader2 size={13} className="text-blue-400 animate-spin" />
              <span className="text-sm text-gray-400">Loading code & rationale...</span>
            </div>
          )}

          {!isLoading && subStep.code && (
            <>
              <div className="rounded-lg border border-emerald-200 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border-b border-emerald-200">
                  <Code2 size={12} className="text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700 uppercase">Code</span>
                </div>
                <pre className="p-3 text-sm text-gray-800 bg-white overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">{subStep.code}</pre>
              </div>

              {subStep.decisionProcess && (
                <div className="rounded-lg border border-amber-200 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-200">
                    <span className="text-xs font-semibold text-amber-700 uppercase">Decision Process</span>
                  </div>
                  <div className="p-3 text-sm text-gray-700 bg-amber-50/20 leading-relaxed whitespace-pre-wrap">{subStep.decisionProcess}</div>
                </div>
              )}
            </>
          )}

          {!isLoading && !subStep.code && (
            <p className="text-sm text-gray-400 italic">Click to load code and decision process</p>
          )}
        </div>
      )}
    </div>
  )
}

function AudioButtons({
  recordStatus, audioSource, passiveStatus, passiveSource,
  onStart, onStop, onPassiveStart, onPassiveStop,
}: {
  recordStatus: RecordStatus
  audioSource: 'microphone' | 'system'
  passiveStatus: PassiveStatus
  passiveSource: 'microphone' | 'system'
  onStart: (source: 'microphone' | 'system') => void
  onStop: () => void
  onPassiveStart: (source: 'microphone' | 'system') => void
  onPassiveStop: () => void
}) {
  const busy = recordStatus === 'transcribing' || recordStatus === 'thinking'
  const activeRecording = recordStatus === 'recording'
  const passiveOff = passiveStatus === 'off'

  const base = 'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-w-[48px]'
  const idle = 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200'
  const active = 'bg-gray-300 hover:bg-gray-400 text-gray-900 shadow border border-gray-400'
  const iconBox = 'flex items-center justify-center h-7 w-7 rounded-md bg-white'

  return (
    <>
      {/* Passive group */}
      <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-1 py-0.5 bg-gray-50">
        <span className="text-[9px] font-semibold text-gray-400 uppercase px-1">Auto</span>
        <button
          onClick={() => passiveOff || passiveSource !== 'system' ? onPassiveStart('system') : onPassiveStop()}
          disabled={busy || activeRecording || (!passiveOff && passiveSource !== 'system')}
          className={`${base} ${passiveStatus !== 'off' && passiveSource === 'system' ? active : idle}`}
          title="Auto-listen to system audio"
        >
          <span className={iconBox}><Headphones size={16} className="text-gray-800" /></span>
          <span className="text-[10px] leading-tight">
            {passiveStatus === 'listening' && passiveSource === 'system' ? 'On'
              : passiveStatus === 'processing' && passiveSource === 'system' ? '...'
              : 'Sys'}
          </span>
        </button>

        <button
          onClick={() => passiveOff || passiveSource !== 'microphone' ? onPassiveStart('microphone') : onPassiveStop()}
          disabled={busy || activeRecording || (!passiveOff && passiveSource !== 'microphone')}
          className={`${base} ${passiveStatus !== 'off' && passiveSource === 'microphone' ? active : idle}`}
          title="Auto-listen to microphone"
        >
          <span className={iconBox}><Mic size={16} className="text-gray-800" /></span>
          <span className="text-[10px] leading-tight">
            {passiveStatus === 'listening' && passiveSource === 'microphone' ? 'On'
              : passiveStatus === 'processing' && passiveSource === 'microphone' ? '...'
              : 'Mic'}
          </span>
        </button>
      </div>

      {/* Manual group */}
      <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-1 py-0.5 bg-gray-50">
        <span className="text-[9px] font-semibold text-gray-400 uppercase px-1">Ask</span>
        <button
          onClick={() => activeRecording && audioSource === 'microphone' ? onStop() : onStart('microphone')}
          disabled={busy || !passiveOff || (activeRecording && audioSource !== 'microphone')}
          className={`${base} ${activeRecording && audioSource === 'microphone' ? active : idle}`}
          title="Record microphone question"
        >
          <span className={iconBox}><Mic size={16} className="text-gray-800" /></span>
          <span className="text-[10px] leading-tight">
            {busy && audioSource === 'microphone' ? (recordStatus === 'transcribing' ? 'Transcribing…' : 'Thinking…')
              : activeRecording && audioSource === 'microphone' ? 'Stop'
              : 'Mic'}
          </span>
        </button>

        <button
          onClick={() => activeRecording && audioSource === 'system' ? onStop() : onStart('system')}
          disabled={busy || !passiveOff || (activeRecording && audioSource !== 'system')}
          className={`${base} ${activeRecording && audioSource === 'system' ? active : idle}`}
          title="Record system audio question"
        >
          <span className={iconBox}><Headphones size={16} className="text-gray-800" /></span>
          <span className="text-[10px] leading-tight">
            {busy && audioSource === 'system' ? (recordStatus === 'transcribing' ? 'Transcribing…' : 'Thinking…')
              : activeRecording && audioSource === 'system' ? 'Stop'
              : 'Sys'}
          </span>
        </button>
      </div>
    </>
  )
}
