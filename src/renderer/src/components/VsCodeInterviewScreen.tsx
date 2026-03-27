import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowLeft, Plug, PlugZap, ExternalLink, Code, CheckCircle, Lightbulb, Mic, Headphones } from 'lucide-react'
import { AudioRecorder } from '../services/recorder'
import { PassiveListenService } from '../services/passiveListen'
import machineLearningIcon from '../assets/proposed_images/Machine_Learning.webm'
import deepLearningIcon from '../assets/proposed_images/Deep_Learning.webm'
import codeIcon from '../assets/proposed_images/Statistics.webm'

interface HintEntry {
  answer: string
  explanation: string
  timestamp: number
  pageTitle?: string
  language?: string | null
}

interface QASnapshot {
  transcript: string
  hint: HintEntry
  code?: string
  pageTitle?: string
  language?: string | null
}

interface Props {
  onBack: () => void
}

type ConnectionStatus = 'starting' | 'waiting' | 'connected' | 'disconnected'
type RecordStatus = 'idle' | 'recording' | 'transcribing' | 'thinking'
type PassiveStatus = 'off' | 'listening' | 'processing'

const VSCODE_EXTENSION_URL = 'https://marketplace.visualstudio.com/items?itemName=mooch.mooch-vscode'
const POLL_INTERVAL = 3000
const DISCONNECT_TIMEOUT = 60000
const DISCONNECT_MISSES = 5

/** Code interview screen connecting to the Mooch VS Code extension, with mic Q&A. */
export default function VsCodeInterviewScreen({ onBack }: Props) {
  const [status, setStatus] = useState<ConnectionStatus>('starting')
  const [extensionState, setExtensionState] = useState<{
    code?: string; pageTitle?: string; language?: string | null; manualContext?: string
  }>({})
  // hintHistory[0] is always the current answer
  const [hintHistory, setHintHistory] = useState<HintEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // transcript persists across code syncs — only replaced when user asks a new question
  const [transcript, setTranscript] = useState('')
  const [recordStatus, setRecordStatus] = useState<RecordStatus>('idle')
  const [audioSource, setAudioSource] = useState<'microphone' | 'system'>('microphone')
  const [passiveStatus, setPassiveStatus] = useState<PassiveStatus>('off')
  const [passiveSource, setPassiveSource] = useState<'microphone' | 'system'>('system')
  const [qaHistory, setQaHistory] = useState<QASnapshot[]>([])
  const [qaError, setQaError] = useState<string | null>(null)
  const [manualContext, setManualContext] = useState('')

  const missCountRef = useRef(0)
  const recorderRef = useRef(new AudioRecorder())
  const passiveServiceRef = useRef(new PassiveListenService())
  const recordStatusRef = useRef<RecordStatus>('idle')
  recordStatusRef.current = recordStatus
  const extensionStateRef = useRef(extensionState)
  extensionStateRef.current = extensionState
  const transcriptRef = useRef(transcript)
  transcriptRef.current = transcript
  const hintHistoryRef = useRef(hintHistory)
  hintHistoryRef.current = hintHistory

  // Bridge lifecycle
  useEffect(() => {
    let mounted = true
    window.electronAPI.bridgeStart()
      .then(() => { if (mounted) setStatus('waiting') })
      .catch((err: unknown) => { if (mounted) setError(`Failed to start bridge: ${err}`) })
    return () => { mounted = false; window.electronAPI.bridgeStop() }
  }, [])

  // Poll for VS Code extension connection
  const statusRef = useRef(status)
  statusRef.current = status
  useEffect(() => {
    if (status === 'starting') return
    async function poll() {
      try {
        const s = await window.electronAPI.bridgeStatus()
        const isOurs = s.connected && s.clientType === 'vscode-extension' && Date.now() - s.lastSeen < DISCONNECT_TIMEOUT
        if (isOurs) {
          missCountRef.current = 0
          setStatus('connected')
        } else if (statusRef.current === 'connected') {
          missCountRef.current += 1
          if (missCountRef.current >= DISCONNECT_MISSES) {
            missCountRef.current = 0
            setStatus('disconnected')
          }
        }
      } catch { /* ignore */ }
    }
    poll()
    pollRef.current = setInterval(poll, POLL_INTERVAL)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Real-time updates — code panel only, never clears transcript
  useEffect(() => {
    const unsub1 = window.electronAPI.onBridgeExtensionUpdate((state: any) => {
      if (state.clientType === 'vscode-extension') {
        setStatus('connected')
        setExtensionState({ code: state.code, pageTitle: state.pageTitle, language: state.language, manualContext: state.manualContext })
      }
    })
    const unsub2 = window.electronAPI.onBridgeHintGenerated((entry: HintEntry) => {
      setHintHistory(prev => [entry, ...prev])
    })
    return () => { unsub1(); unsub2() }
  }, [])

  useEffect(() => {
    if (status === 'connected') window.electronAPI.bridgeHintHistory().then(setHintHistory)
  }, [status])

  // ── Recording ─────────────────────────────────────────────────────────────

  const startRecording = useCallback(async (source: 'microphone' | 'system' = 'microphone') => {
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

  const startPassiveListen = useCallback(async (source: 'microphone' | 'system') => {
    if (passiveStatus !== 'off') return
    setPassiveSource(source)
    setQaError(null)
    await passiveServiceRef.current.start({
      audioSource: source,
      onTranscript: (text) => setTranscript(text),
      onDetected: async (text) => {
        setTranscript(text)
        const snap = extensionStateRef.current
        try {
          await window.electronAPI.bridgeGenerateHint({
            code: snap.code || '',
            pageTitle: snap.pageTitle,
            language: snap.language,
            userContext: text,
            manualContext,
          })
        } catch (err) {
          setQaError(err instanceof Error ? err.message : 'Something went wrong')
        }
      },
      onStatus: (s) => setPassiveStatus(s),
      onError: (msg) => { setQaError(msg); setPassiveStatus('off') },
    })
  }, [passiveStatus])

  const stopPassiveListen = useCallback(() => {
    passiveServiceRef.current.stop()
    setPassiveStatus('off')
  }, [])

  const stopRecording = useCallback(async () => {
    if (recordStatusRef.current !== 'recording') return
    try {
      const buffer = await recorderRef.current.stop()
      setRecordStatus('transcribing')

      const question = await window.electronAPI.transcribeAudio(buffer)

      // Snapshot the current Q&A before overwriting with new question
      const prevTranscript = transcriptRef.current
      const prevHint = hintHistoryRef.current[0]
      if (prevTranscript && prevHint) {
        const snap = extensionStateRef.current
        setQaHistory(prev => [{
          transcript: prevTranscript,
          hint: prevHint,
          code: snap.code,
          pageTitle: snap.pageTitle,
          language: snap.language,
        }, ...prev])
      }

      setTranscript(question)
      setRecordStatus('thinking')

      // Generate a new hint with the question as context — fires onBridgeHintGenerated
      const snap = extensionStateRef.current
      await window.electronAPI.bridgeGenerateHint({
        code: snap.code || '',
        pageTitle: snap.pageTitle,
        language: snap.language,
        userContext: question,
        manualContext,
      })

      setRecordStatus('idle')
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Something went wrong')
      setRecordStatus('idle')
    }
  }, [])

  const handleBack = useCallback(() => {
    passiveServiceRef.current.stop()
    window.electronAPI.bridgeStop()
    onBack()
  }, [onBack])

  const currentHint = hintHistory[0] || null

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="drag-region px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="no-drag flex items-center gap-2">
            <button onClick={handleBack} className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors cursor-pointer" title="Back to mode selection">
              <ArrowLeft size={14} />
            </button>
            <span className="text-xs font-semibold text-gray-700">Code Interview — VS Code</span>
            <StatusDot status={status} />
          </div>
          {status === 'connected' && (
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
        {error && <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        {(status === 'starting' || status === 'waiting') && <WaitingView status={status} />}

        {status === 'disconnected' && (
          <div className="text-center py-8 px-4">
            <PlugZap size={32} className="mx-auto mb-3 text-amber-500" />
            <p className="text-sm text-gray-700 font-medium mb-1">Connection lost</p>
            <p className="text-xs text-gray-500">The VS Code extension stopped responding. Waiting for reconnection...</p>
          </div>
        )}

        {status === 'connected' && (
          <>
            {qaError && <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{qaError}</div>}

            {/* Current file header */}
            <div className="flex-none px-4 py-2 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold text-xs">
                    {extensionState.pageTitle ? extensionState.pageTitle.split('.').pop()?.toUpperCase() : 'FILE'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-900 truncate">
                    {extensionState.pageTitle || 'No file open'}
                  </p>
                  {extensionState.language && (
                    <p className="text-[10px] text-blue-600">{extensionState.language}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Transcript — context for the answer */}
            <div className="flex-none px-4 py-3 border-b border-gray-200">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
                <div className="flex flex-col items-center mb-3">
                  <video src={machineLearningIcon} autoPlay muted playsInline className="h-32 w-32 flex-shrink-0" />
                  <h2 className="text-xl font-semibold text-gray-800 mt-2">Transcript</h2>
                </div>
                {recordStatus === 'transcribing' ? (
                  <p className="text-sm text-yellow-600 animate-pulse">Transcribing...</p>
                ) : transcript ? (
                  <p className="text-sm text-gray-700 leading-relaxed">{transcript}</p>
                ) : (
                  <p className="text-sm text-gray-500 italic">Press Ask to record an interviewer question — it'll be used as context for the answer</p>
                )}
              </div>
            </div>

            {/* Manual Context Input */}
            <div className="flex-none px-4 py-3 border-b border-gray-200">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
                <div className="flex flex-col items-center mb-3">
                  <div className="h-8 w-8 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-xs">+</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 mt-2">Manual Context</h2>
                </div>
                <textarea
                  value={manualContext}
                  onChange={(e) => setManualContext(e.target.value)}
                  placeholder="Add any additional context or instructions for the interviewer..."
                  className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[80px] placeholder-gray-400"
                />
                {manualContext && (
                  <p className="text-[10px] text-gray-500 mt-2 text-right">
                    Context will be included in the answer generation
                  </p>
                )}
              </div>
            </div>

            {/* Answer — always code-formatted hint */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
                <div className="flex flex-col items-center mb-3">
                  <video src={deepLearningIcon} autoPlay muted playsInline className="h-32 w-32 flex-shrink-0" />
                  <h2 className="text-xl font-semibold text-gray-800 mt-2">Suggested Answer</h2>
                </div>
                {recordStatus === 'thinking' ? (
                  <p className="text-base text-blue-400 animate-pulse">Thinking...</p>
                ) : currentHint ? (
                  <>
                    <div className="rounded-lg border border-emerald-200 overflow-hidden mb-4">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border-b border-emerald-200">
                        <CheckCircle size={12} className="text-emerald-600" />
                        <span className="text-[10px] font-medium text-emerald-700 uppercase">Answer</span>
                      </div>
                      <pre className="p-3 text-sm text-gray-800 bg-emerald-50/30 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">{currentHint.answer}</pre>
                    </div>
                    {currentHint.explanation && (
                      <div className="rounded-lg border border-amber-200 overflow-hidden">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-200">
                          <Lightbulb size={12} className="text-amber-600" />
                          <span className="text-[10px] font-medium text-amber-700 uppercase">Why This Works</span>
                        </div>
                        <div className="p-3 text-xs text-gray-700 bg-amber-50/30 whitespace-pre-wrap leading-relaxed">{currentHint.explanation}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-base text-gray-500 italic">Answer will appear here once your code is analysed</p>
                )}
              </div>
            </div>

            {/* Current code panel */}
            <CodePanel code={extensionState.code} pageTitle={extensionState.pageTitle} language={extensionState.language} />

            {/* Previous questions */}
            {qaHistory.map((entry, i) => (
              <div key={i}>
                <Divider label="Previous Question" />
                <div className="px-4 pb-3 space-y-3">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Question</p>
                    <p className="text-sm text-gray-700 leading-relaxed italic">"{entry.transcript}"</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border-b border-emerald-200">
                      <CheckCircle size={12} className="text-emerald-600" />
                      <span className="text-[10px] font-medium text-emerald-700 uppercase">Answer</span>
                    </div>
                    <pre className="p-3 text-sm text-gray-700 bg-emerald-50/30 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">{entry.hint.answer}</pre>
                    {entry.hint.explanation && (
                      <div className="rounded-lg border border-amber-200 overflow-hidden mt-3">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-200">
                          <Lightbulb size={12} className="text-amber-600" />
                          <span className="text-[10px] font-medium text-amber-700 uppercase">Why This Works</span>
                        </div>
                        <div className="p-3 text-xs text-gray-700 bg-amber-50/30 whitespace-pre-wrap leading-relaxed">{entry.hint.explanation}</div>
                      </div>
                    )}
                  </div>
                  <CodePanel code={entry.code} pageTitle={entry.pageTitle} language={entry.language} faded />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ConnectionStatus }) {
  const colors = { starting: 'bg-gray-400', waiting: 'bg-amber-400 animate-pulse', connected: 'bg-emerald-500', disconnected: 'bg-red-400' }
  const labels = { starting: 'Starting...', waiting: 'Waiting for VS Code extension', connected: 'Connected', disconnected: 'Disconnected' }
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
      <span className={`h-2 w-2 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
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

  const btnBase = 'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-w-[52px]'
  const btnIdle = 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200'
  const btnActive = 'bg-gray-300 hover:bg-gray-400 text-gray-900 shadow border border-gray-400'

  const iconBox = 'flex items-center justify-center h-7 w-7 rounded-md bg-white'

  return (
    <>
      {/* Passive Sys */}
      <button
        onClick={() => passiveOff || passiveSource !== 'system' ? onPassiveStart('system') : onPassiveStop()}
        disabled={busy || activeRecording || (!passiveOff && passiveSource !== 'system')}
        className={`${btnBase} ${passiveStatus !== 'off' && passiveSource === 'system' ? btnActive : btnIdle}`}
        title="Passively listen to system audio"
      >
        <span className={iconBox}><Headphones size={16} className="text-gray-800" /></span>
        <span className="text-[10px] leading-tight">
          {passiveStatus === 'listening' && passiveSource === 'system' ? 'Listening…'
            : passiveStatus === 'processing' && passiveSource === 'system' ? 'Processing…'
            : 'Passive Sys'}
        </span>
      </button>

      {/* Passive Mic */}
      <button
        onClick={() => passiveOff || passiveSource !== 'microphone' ? onPassiveStart('microphone') : onPassiveStop()}
        disabled={busy || activeRecording || (!passiveOff && passiveSource !== 'microphone')}
        className={`${btnBase} ${passiveStatus !== 'off' && passiveSource === 'microphone' ? btnActive : btnIdle}`}
        title="Passively listen to microphone"
      >
        <span className={iconBox}><Mic size={16} className="text-gray-800" /></span>
        <span className="text-[10px] leading-tight">
          {passiveStatus === 'listening' && passiveSource === 'microphone' ? 'Listening…'
            : passiveStatus === 'processing' && passiveSource === 'microphone' ? 'Processing…'
            : 'Passive Mic'}
        </span>
      </button>

      {/* Mic */}
      <button
        onClick={() => activeRecording && audioSource === 'microphone' ? onStop() : onStart('microphone')}
        disabled={busy || !passiveOff || (activeRecording && audioSource !== 'microphone')}
        className={`${btnBase} ${activeRecording && audioSource === 'microphone' ? btnActive : btnIdle}`}
        title="Record from microphone"
      >
        <span className={iconBox}><Mic size={16} className="text-gray-800" /></span>
        <span className="text-[10px] leading-tight">
          {busy && audioSource === 'microphone' ? (recordStatus === 'transcribing' ? 'Transcribing…' : 'Thinking…')
            : activeRecording && audioSource === 'microphone' ? 'Stop'
            : 'Mic'}
        </span>
      </button>

      {/* System */}
      <button
        onClick={() => activeRecording && audioSource === 'system' ? onStop() : onStart('system')}
        disabled={busy || !passiveOff || (activeRecording && audioSource !== 'system')}
        className={`${btnBase} ${activeRecording && audioSource === 'system' ? btnActive : btnIdle}`}
        title="Record system audio"
      >
        <span className={iconBox}><Headphones size={16} className="text-gray-800" /></span>
        <span className="text-[10px] leading-tight">
          {busy && audioSource === 'system' ? (recordStatus === 'transcribing' ? 'Transcribing…' : 'Thinking…')
            : activeRecording && audioSource === 'system' ? 'Stop'
            : 'System'}
        </span>
      </button>
    </>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 border-t border-gray-300" />
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{label}</span>
      <div className="flex-1 border-t border-gray-300" />
    </div>
  )
}

function CodePanel({ code, pageTitle, language, faded }: {
  code?: string; pageTitle?: string; language?: string | null; faded?: boolean
}) {
  if (!code) return null
  return (
    <div className={`px-4 py-3 border-b border-gray-200 ${faded ? 'opacity-60' : ''}`}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
          <video src={codeIcon} autoPlay muted playsInline className="h-8 w-8 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-800">{pageTitle || 'Code'}</p>
            {language && <span className="text-[10px] text-gray-500">{language}</span>}
          </div>
        </div>
        <pre className="p-4 text-xs text-gray-700 bg-gray-50 overflow-x-auto max-h-40 overflow-y-auto font-mono leading-relaxed">
          {code.slice(0, 2000)}{code.length > 2000 && '\n... (truncated)'}
        </pre>
      </div>
    </div>
  )
}

function WaitingView({ status }: { status: 'starting' | 'waiting' }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="relative mx-auto w-16 h-16 mb-4">
        <Plug size={32} className="absolute inset-0 m-auto text-violet-500" />
        {status === 'waiting' && (
          <div className="absolute inset-0 rounded-full border-2 border-violet-300 border-t-violet-500 animate-spin" />
        )}
      </div>
      <h2 className="text-lg font-semibold text-gray-800 mb-2">
        {status === 'starting' ? 'Starting bridge server...' : 'Waiting for Mooch VS Code extension...'}
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
        Install the Mooch extension for VS Code, then open a coding problem file. The extension will connect automatically.
      </p>
      <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.openExternalUrl(VSCODE_EXTENSION_URL) }}
        className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 transition-colors">
        <ExternalLink size={14} />
        Install VS Code Extension
      </a>
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg text-left max-w-xs mx-auto">
        <p className="text-xs font-medium text-gray-700 mb-2">How it works:</p>
        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
          <li>Install the Mooch extension in VS Code</li>
          <li>Open a code file — a hint appears automatically</li>
          <li>Press <strong>Ask</strong> to record an interviewer question</li>
          <li>The answer updates, tailored to both your code and the question</li>
          <li>Previous Q&amp;A stays below for reference</li>
        </ol>
      </div>
    </div>
  )
}
