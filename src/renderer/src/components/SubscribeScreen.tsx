import { useState, useEffect } from 'react'
import { KeyRound, Check, ChevronDown } from 'lucide-react'

type ByokProvider = 'anthropic' | 'gemini' | 'openai'

interface Props {
  onLogout: () => void
  onRefresh: () => void
  onApiKeySet: () => void
}

const PROVIDERS: { key: ByokProvider; label: string; prefix: string }[] = [
  { key: 'anthropic', label: 'Anthropic (Claude)', prefix: 'sk-ant-' },
  { key: 'gemini',    label: 'Google (Gemini)',    prefix: 'AIzaSy' },
  { key: 'openai',    label: 'OpenAI',             prefix: 'sk-'    },
]

const STORAGE_KEY = 'byok_provider'

function detectProvider(key: string): ByokProvider | null {
  if (key.startsWith('sk-ant-')) return 'anthropic'
  if (key.startsWith('AIzaSy')) return 'gemini'
  if (key.startsWith('sk-')) return 'openai'
  return null
}

export default function SubscribeScreen({ onLogout, onRefresh, onApiKeySet }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState<ByokProvider>('anthropic')
  const [autoDetected, setAutoDetected] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // Restore previously selected provider from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ByokProvider | null
    if (stored && PROVIDERS.some((p) => p.key === stored)) {
      setProvider(stored)
    }
  }, [])

  const handleKeyChange = (value: string) => {
    setApiKey(value)
    setError('')
    setSaved(false)
    const detected = detectProvider(value)
    if (detected) {
      setProvider(detected)
      setAutoDetected(true)
    } else {
      setAutoDetected(false)
    }
  }

  const handleProviderChange = (value: ByokProvider) => {
    setProvider(value)
    setAutoDetected(false) // user overrode, so clear the "auto" label
  }

  const handleSave = async () => {
    const trimmed = apiKey.trim()
    if (!trimmed) return

    setSaving(true)
    setError('')
    try {
      await window.electronAPI.setApiKey(provider, trimmed)
      localStorage.setItem(STORAGE_KEY, provider)
      setSaved(true)
      onApiKeySet()
    } catch (err) {
      console.error('[SubscribeScreen] setApiKey failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to save key. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-900/85 rounded-2xl backdrop-blur-sm border border-white/10 overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="drag-region px-4 py-3 border-b border-white/10">
        <h1 className="text-sm font-semibold text-white text-center">Mooch</h1>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 py-4 gap-5">
        {/* Subscribe option */}
        <div className="w-full">
          <button
            onClick={() => window.electronAPI.openSubscribe()}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg px-3 py-2.5 transition-colors cursor-pointer"
          >
            View Pricing Plans
          </button>
          <button
            onClick={onRefresh}
            className="w-full mt-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors cursor-pointer"
          >
            Already subscribed? Click to refresh
          </button>
        </div>

        {/* Divider */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-gray-500">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Own API key */}
        <div className="w-full">
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
            <KeyRound size={12} />
            Use your own API key
          </p>

          {/* Provider dropdown */}
          <div className="relative mb-2">
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as ByokProvider)}
              className="w-full appearance-none bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2.5 border border-white/10 outline-none focus:border-blue-500 cursor-pointer pr-8"
            >
              {PROVIDERS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            {autoDetected && (
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 pointer-events-none">
                auto
              </span>
            )}
          </div>

          {/* Key input + Save */}
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={PROVIDERS.find((p) => p.key === provider)?.prefix + '...'}
              className="flex-1 bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2.5 border border-white/10 outline-none focus:border-blue-500 placeholder-gray-600"
            />
            <button
              onClick={handleSave}
              disabled={!apiKey.trim() || saving}
              className="flex-shrink-0 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {saving ? (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : saved ? (
                <Check size={12} />
              ) : (
                'Save'
              )}
            </button>
          </div>

          {error && <p className="text-[10px] text-red-400 mt-1.5">{error}</p>}

          <p className="text-[10px] text-gray-600 mt-2">
            Provider is auto-detected from your key. Your key is encrypted and stored locally — never sent to our servers except to make AI requests on your behalf.
          </p>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-white/10 text-center">
        <button
          onClick={onLogout}
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
