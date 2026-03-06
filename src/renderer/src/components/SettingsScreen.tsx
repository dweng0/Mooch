import { useState, useEffect } from 'react'
import { ArrowLeft, FileText, KeyRound, X, Eye, EyeOff, Check, Trash2, Star } from 'lucide-react'
import type { UserApiKeys } from '../../shared/types'

const BYOK_STORAGE_KEY = 'byok_provider'

interface Props {
  onBack: () => void
  cvName: string
  jobDescName: string
  manualContext: string
  onLoadCV: () => void
  onLoadJobDesc: () => void
  onClearCV: () => void
  onClearJobDesc: () => void
  onManualContextChange: (value: string) => void
}

type Provider = 'anthropic' | 'gemini' | 'openai'

interface ProviderConfig {
  key: Provider
  label: string
  placeholder: string
}

const PROVIDERS: ProviderConfig[] = [
  { key: 'anthropic', label: 'Claude (Anthropic)', placeholder: 'sk-ant-api03-...' },
  { key: 'gemini', label: 'Gemini (Google)', placeholder: 'AIzaSy...' },
  { key: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
]

const PROVIDER_KEY_MAP: Record<Provider, keyof UserApiKeys> = {
  anthropic: 'anthropicApiKey',
  gemini: 'geminiApiKey',
  openai: 'openaiApiKey',
}

export default function SettingsScreen({
  onBack,
  cvName,
  jobDescName,
  manualContext,
  onLoadCV,
  onLoadJobDesc,
  onClearCV,
  onClearJobDesc,
  onManualContextChange
}: Props) {
  const [apiKeys, setApiKeys] = useState<UserApiKeys>({})
  const [preferredProvider, setPreferredProvider] = useState<Provider | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Record<Provider, boolean>>({
    anthropic: false,
    gemini: false,
    openai: false,
  })
  const [inputValues, setInputValues] = useState<Record<Provider, string>>({
    anthropic: '',
    gemini: '',
    openai: '',
  })
  const [saving, setSaving] = useState<Record<Provider, boolean>>({
    anthropic: false,
    gemini: false,
    openai: false,
  })

  // Load API keys on mount
  useEffect(() => {
    const stored = localStorage.getItem(BYOK_STORAGE_KEY) as Provider | null
    window.electronAPI.getApiKeys().then((keys) => {
      setApiKeys(keys)
      setInputValues({
        anthropic: keys.anthropicApiKey || '',
        gemini: keys.geminiApiKey || '',
        openai: keys.openaiApiKey || '',
      })
      // Restore stored preference if that provider still has a key
      if (stored && keys[PROVIDER_KEY_MAP[stored]]) {
        setPreferredProvider(stored)
      } else {
        // Default to first available
        const first = (['anthropic', 'gemini', 'openai'] as Provider[]).find(
          (p) => keys[PROVIDER_KEY_MAP[p]]
        )
        setPreferredProvider(first ?? null)
      }
    })
  }, [])

  const handlePreferredProviderChange = (provider: Provider) => {
    setPreferredProvider(provider)
    localStorage.setItem(BYOK_STORAGE_KEY, provider)
  }

  const toggleVisibility = (provider: Provider) => {
    setVisibleKeys(prev => ({ ...prev, [provider]: !prev[provider] }))
  }

  const handleInputChange = (provider: Provider, value: string) => {
    setInputValues(prev => ({ ...prev, [provider]: value }))
  }

  const handleSave = async (provider: Provider) => {
    const value = inputValues[provider].trim()
    if (!value) return

    setSaving(prev => ({ ...prev, [provider]: true }))
    try {
      await window.electronAPI.setApiKey(provider, value)
      setApiKeys(prev => ({ ...prev, [`${provider}ApiKey`]: value }))
    } finally {
      setSaving(prev => ({ ...prev, [provider]: false }))
    }
  }

  const handleClear = async (provider: Provider) => {
    setSaving(prev => ({ ...prev, [provider]: true }))
    try {
      await window.electronAPI.clearApiKey(provider)
      setApiKeys(prev => {
        const updated = { ...prev }
        delete updated[`${provider}ApiKey`]
        return updated
      })
      setInputValues(prev => ({ ...prev, [provider]: '' }))
      // If this was the preferred provider, fall back to another available key
      if (preferredProvider === provider) {
        const remaining = (['anthropic', 'gemini', 'openai'] as Provider[]).filter(
          (p) => p !== provider && !!apiKeys[PROVIDER_KEY_MAP[p]]
        )
        const next = remaining[0] ?? null
        setPreferredProvider(next)
        if (next) localStorage.setItem(BYOK_STORAGE_KEY, next)
        else localStorage.removeItem(BYOK_STORAGE_KEY)
      }
    } finally {
      setSaving(prev => ({ ...prev, [provider]: false }))
    }
  }

  const hasKeySet = (provider: Provider) => !!apiKeys[PROVIDER_KEY_MAP[provider]]

  return (
    <div className="h-full flex flex-col bg-gray-900/85 rounded-2xl backdrop-blur-sm border border-white/10 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="drag-region px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="no-drag p-1.5 text-gray-400 hover:text-gray-200 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-white">Settings</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-5 overflow-y-auto">
        {/* Resume / CV */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Resume / CV</h3>
          {cvName ? (
            <div className="flex items-center justify-between bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <FileText size={14} />
                <span className="truncate max-w-[200px]">{cvName}</span>
              </div>
              <button
                onClick={onClearCV}
                className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer ml-2"
                title="Remove resume"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={onLoadCV}
              className="w-full flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
            >
              <FileText size={14} />
              Load resume file (.txt, .pdf, .docx)
            </button>
          )}
        </section>

        {/* Job Description */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Job Description</h3>
          {jobDescName ? (
            <div className="flex items-center justify-between bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <FileText size={14} />
                <span className="truncate max-w-[200px]">{jobDescName}</span>
              </div>
              <button
                onClick={onClearJobDesc}
                className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer ml-2"
                title="Remove job description"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={onLoadJobDesc}
              className="w-full flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
            >
              <FileText size={14} />
              Load job description file
            </button>
          )}
        </section>

        {/* Additional Context */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Additional Context</h3>
          <textarea
            value={manualContext}
            onChange={(e) => onManualContextChange(e.target.value)}
            placeholder="Add context (e.g., 'Senior TypeScript role, 5 years experience')"
            rows={4}
            className="w-full bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2.5 border border-white/10 outline-none focus:border-blue-500 placeholder-gray-500 resize-none"
          />
        </section>

        <p className="text-[10px] text-gray-600 text-center">
          Context is sent with every AI request to personalize answers.
        </p>

        {/* API Keys */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">API Keys</h3>
          <p className="text-[10px] text-gray-500 mb-3">
            Add your own API keys to use your own accounts. Your keys are stored securely on your device.
          </p>
          <div className="flex flex-col gap-2">
            {PROVIDERS.map((provider) => (
              <div
                key={provider.key}
                className={`rounded-lg border overflow-hidden ${
                  hasKeySet(provider.key)
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'bg-gray-800/60 border-white/10'
                }`}
              >
                <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <KeyRound size={13} className={hasKeySet(provider.key) ? 'text-emerald-400' : 'text-gray-500'} />
                    <span className={`text-xs truncate ${hasKeySet(provider.key) ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {provider.label}
                    </span>
                    {hasKeySet(provider.key) && (
                      <span className="flex-shrink-0 text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                        Set
                      </span>
                    )}
                  </div>
                  {hasKeySet(provider.key) && (
                    <button
                      onClick={() => handleClear(provider.key)}
                      disabled={saving[provider.key]}
                      className="flex-shrink-0 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove API key"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="px-3 pb-3 flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={visibleKeys[provider.key] ? 'text' : 'password'}
                      value={inputValues[provider.key]}
                      onChange={(e) => handleInputChange(provider.key, e.target.value)}
                      placeholder={hasKeySet(provider.key) ? '••••••••••••••••••••' : provider.placeholder}
                      className="w-full bg-gray-900/60 text-gray-300 text-xs rounded-md px-2.5 py-2 border border-white/10 outline-none focus:border-blue-500 placeholder-gray-600"
                    />
                    <button
                      onClick={() => toggleVisibility(provider.key)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                      title={visibleKeys[provider.key] ? 'Hide' : 'Show'}
                    >
                      {visibleKeys[provider.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleSave(provider.key)}
                    disabled={!inputValues[provider.key].trim() || saving[provider.key] || inputValues[provider.key] === apiKeys[`${provider.key}ApiKey`]}
                    className="flex-shrink-0 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {saving[provider.key] ? (
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Preferred provider selector — shown when any key is set */}
          {PROVIDERS.filter((p) => hasKeySet(p.key)).length > 0 && (
            <div className="mt-3 rounded-lg border border-white/10 bg-gray-800/60 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-2">
                <Star size={13} className="text-yellow-400" />
                <span className="text-xs text-gray-300 font-medium">Preferred provider</span>
              </div>
              <div className="flex gap-2">
                {PROVIDERS.filter((p) => hasKeySet(p.key)).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handlePreferredProviderChange(p.key)}
                    className={`flex-1 py-1.5 text-xs rounded-md border transition-colors cursor-pointer ${
                      preferredProvider === p.key
                        ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-300'
                        : 'bg-gray-900/60 border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20'
                    }`}
                  >
                    {p.label.split(' ')[0]}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-1.5">This provider will be used for AI responses.</p>
            </div>
          )}
          <p className="text-[10px] text-gray-600 mt-2">
            Your API keys are encrypted and stored locally. They are never sent to our servers except to make AI requests on your behalf.
          </p>
        </section>
      </div>
    </div>
  )
}
