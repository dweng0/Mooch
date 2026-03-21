import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowLeft, Plug, PlugZap, ExternalLink, Code, Globe, CheckCircle, Lightbulb } from 'lucide-react'

interface HintEntry {
  answer: string
  explanation: string
  timestamp: number
  pageTitle?: string
  language?: string | null
}

interface Props {
  onBack: () => void
}

type ConnectionStatus = 'starting' | 'waiting' | 'connected' | 'disconnected'

const EXTENSION_REPO_URL = 'https://github.com/dweng0/moochiepoo'
const POLL_INTERVAL = 3000
const DISCONNECT_TIMEOUT = 15000

/** Code interview screen that connects to the Mooch Helper browser extension to provide hints for coding challenges. */
export default function CodeInterviewScreen({ onBack }: Props) {
  const [status, setStatus] = useState<ConnectionStatus>('starting')
  const [extensionState, setExtensionState] = useState<{
    code?: string
    pageTitle?: string
    language?: string | null
  }>({})
  const [hintHistory, setHintHistory] = useState<HintEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start bridge on mount
  useEffect(() => {
    let mounted = true

    async function startBridge() {
      try {
        await window.electronAPI.bridgeStart()
        if (mounted) setStatus('waiting')
      } catch (err) {
        if (mounted) setError(`Failed to start bridge: ${err}`)
      }
    }

    startBridge()

    return () => {
      mounted = false
      window.electronAPI.bridgeStop()
    }
  }, [])

  // Poll for status
  useEffect(() => {
    if (status === 'starting') return

    async function poll() {
      try {
        const s = await window.electronAPI.bridgeStatus()
        if (s.connected && Date.now() - s.lastSeen < DISCONNECT_TIMEOUT) {
          setStatus('connected')
          setExtensionState({ code: s.code, pageTitle: s.pageTitle, language: s.language })
        } else if (status === 'connected') {
          setStatus('disconnected')
        }
      } catch {
        // ignore
      }
    }

    poll()
    pollRef.current = setInterval(poll, POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [status])

  // Listen for real-time updates
  useEffect(() => {
    const unsub1 = window.electronAPI.onBridgeExtensionUpdate((state: any) => {
      setStatus('connected')
      setExtensionState({ code: state.code, pageTitle: state.pageTitle, language: state.language })
    })
    const unsub2 = window.electronAPI.onBridgeHintGenerated((entry: HintEntry) => {
      setHintHistory(prev => [entry, ...prev])
    })
    return () => { unsub1(); unsub2() }
  }, [])

  // Load existing hint history on connect
  useEffect(() => {
    if (status === 'connected') {
      window.electronAPI.bridgeHintHistory().then(setHintHistory)
    }
  }, [status])

  const handleBack = useCallback(() => {
    window.electronAPI.bridgeStop()
    onBack()
  }, [onBack])

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="drag-region px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="no-drag flex items-center gap-2">
            <button
              onClick={handleBack}
              className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors cursor-pointer"
              title="Back to mode selection"
            >
              <ArrowLeft size={14} />
            </button>
            <span className="text-xs font-semibold text-gray-700">Code Interview</span>
            <StatusDot status={status} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {(status === 'starting' || status === 'waiting') && (
          <WaitingView status={status} />
        )}

        {status === 'disconnected' && (
          <div className="text-center py-8">
            <PlugZap size={32} className="mx-auto mb-3 text-amber-500" />
            <p className="text-sm text-gray-700 font-medium mb-1">Connection lost</p>
            <p className="text-xs text-gray-500 mb-4">The extension stopped responding. Waiting for reconnection...</p>
            {hintHistory.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">Previous hints from this session:</p>
                <HintList hints={hintHistory} />
              </div>
            )}
          </div>
        )}

        {status === 'connected' && (
          <DashboardView extensionState={extensionState} hintHistory={hintHistory} />
        )}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const colors = {
    starting: 'bg-gray-400',
    waiting: 'bg-amber-400 animate-pulse',
    connected: 'bg-emerald-500',
    disconnected: 'bg-red-400',
  }
  const labels = {
    starting: 'Starting...',
    waiting: 'Waiting for extension',
    connected: 'Connected',
    disconnected: 'Disconnected',
  }

  return (
    <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
      <span className={`h-2 w-2 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  )
}

function WaitingView({ status }: { status: 'starting' | 'waiting' }) {
  return (
    <div className="text-center py-8">
      <div className="relative mx-auto w-16 h-16 mb-4">
        <Plug size={32} className="absolute inset-0 m-auto text-blue-500" />
        {status === 'waiting' && (
          <div className="absolute inset-0 rounded-full border-2 border-blue-300 border-t-blue-500 animate-spin" />
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-2">
        {status === 'starting' ? 'Starting bridge server...' : 'Waiting for Mooch Helper extension...'}
      </h2>

      <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
        Install the Mooch Helper Chrome extension, then open a coding challenge page. The extension will connect automatically.
      </p>

      <a
        href="#"
        onClick={(e) => {
          e.preventDefault()
          window.electronAPI.openExternalUrl(EXTENSION_REPO_URL)
        }}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
      >
        <ExternalLink size={14} />
        Install Chrome Extension
      </a>

      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg text-left max-w-xs mx-auto">
        <p className="text-xs font-medium text-gray-700 mb-2">How it works:</p>
        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
          <li>Install the Mooch Helper extension</li>
          <li>Navigate to LeetCode, HackerRank, etc.</li>
          <li>The extension auto-connects to this screen</li>
          <li>Click "Get Hint" in the extension popup</li>
          <li>Hints appear here with full context</li>
        </ol>
      </div>
    </div>
  )
}

function DashboardView({ extensionState, hintHistory }: {
  extensionState: { code?: string; pageTitle?: string; language?: string | null }
  hintHistory: HintEntry[]
}) {
  const latest = hintHistory[0] || null

  return (
    <div className="space-y-4">
      {/* Problem info */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={14} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-900">
            {extensionState.pageTitle || 'Connected'}
          </span>
        </div>
        {extensionState.language && (
          <span className="inline-block text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full mt-1">
            {extensionState.language}
          </span>
        )}
      </div>

      {/* Extracted Code */}
      {extensionState.code && (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border-b border-gray-200">
            <Code size={12} className="text-gray-500" />
            <span className="text-[10px] font-medium text-gray-500 uppercase">Extracted Code</span>
          </div>
          <pre className="p-3 text-xs text-gray-700 bg-gray-50 overflow-x-auto max-h-40 overflow-y-auto font-mono leading-relaxed">
            {extensionState.code.slice(0, 2000)}
            {extensionState.code.length > 2000 && '\n... (truncated)'}
          </pre>
        </div>
      )}

      {/* Answer */}
      {latest ? (
        <>
          <div className="rounded-lg border border-emerald-200 overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border-b border-emerald-200">
              <CheckCircle size={12} className="text-emerald-600" />
              <span className="text-[10px] font-medium text-emerald-700 uppercase">Answer</span>
              <span className="ml-auto text-[10px] text-emerald-500">
                {new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <pre className="p-3 text-xs text-gray-800 bg-emerald-50/30 overflow-x-auto max-h-60 overflow-y-auto font-mono leading-relaxed whitespace-pre-wrap">
              {latest.answer}
            </pre>
          </div>

          {/* Explanation */}
          {latest.explanation && (
            <div className="rounded-lg border border-amber-200 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-200">
                <Lightbulb size={12} className="text-amber-600" />
                <span className="text-[10px] font-medium text-amber-700 uppercase">Why This Works</span>
              </div>
              <div className="p-3 text-xs text-gray-700 bg-amber-50/30 whitespace-pre-wrap leading-relaxed">
                {latest.explanation}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-xs text-gray-400 italic">
            No answers yet. Click "Get Hint" in the extension popup.
          </p>
        </div>
      )}

      {/* Previous answers */}
      {hintHistory.length > 1 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Previous ({hintHistory.length - 1})
          </h3>
          <div className="space-y-3">
            {hintHistory.slice(1).map((entry, i) => (
              <div key={`${entry.timestamp}-${i}`} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-gray-400">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {entry.pageTitle && (
                    <span className="text-[10px] text-gray-400 truncate max-w-[200px]">
                      {entry.pageTitle}
                    </span>
                  )}
                </div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed font-mono mb-2">{entry.answer}</pre>
                {entry.explanation && (
                  <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed border-t border-gray-200 pt-2 mt-2">{entry.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
