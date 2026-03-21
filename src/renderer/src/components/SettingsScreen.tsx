import { useState, useEffect } from 'react'
import { ArrowLeft, FileText, KeyRound, X, Eye, EyeOff, Check, Trash2, Star } from 'lucide-react'
import type { UserApiKeys, CustomProviderConfig } from '../../shared/types'
import itDepartmentIcon from '../assets/proposed_images/IT_Department.webm'

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

type Provider = 'anthropic' | 'gemini' | 'openai' | 'qwen'

interface ProviderConfig {
  key: Provider
  label: string
  placeholder: string
}

const PROVIDERS: ProviderConfig[] = [
  { key: 'anthropic', label: 'Claude (Anthropic)', placeholder: 'sk-ant-api03-...' },
  { key: 'gemini', label: 'Gemini (Google)', placeholder: 'AIzaSy...' },
  { key: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { key: 'qwen', label: 'Qwen (Alibaba)', placeholder: 'sk-...' },
]

const PROVIDER_KEY_MAP: Record<Provider, keyof UserApiKeys> = {
  anthropic: 'anthropicApiKey',
  gemini: 'geminiApiKey',
  openai: 'openaiApiKey',
  qwen: 'qwenApiKey',
}

const QWEN_MODELS = [
  { value: 'qwen-max', label: 'Qwen Max (best quality)' },
  { value: 'qwen-plus', label: 'Qwen Plus (balanced)' },
  { value: 'qwen-turbo', label: 'Qwen Turbo (fast)' },
  { value: 'qwen3-235b-a22b', label: 'Qwen3 235B' },
  { value: 'qwen3-72b', label: 'Qwen3 72B' },
  { value: 'qwen3-30b-a3b', label: 'Qwen3 30B' },
  { value: 'qwen3-14b', label: 'Qwen3 14B' },
]

const PRECONFIGURED_PROVIDERS: Record<string, { label: string; baseUrl: string }> = {
  ollama: { label: 'Ollama', baseUrl: 'http://localhost:11434/v1' },
  lmstudio: { label: 'LM Studio', baseUrl: 'http://localhost:1234/v1' },
  custom: { label: 'Custom', baseUrl: '' },
}

const EMPTY_CUSTOM: CustomProviderConfig = { baseUrl: '', apiKey: '', model: '', label: '', sttEnabled: false, sttModel: '' }

/** Settings screen for managing API keys, context documents, and custom provider configuration. */
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
  const [preferredProvider, setPreferredProvider] = useState<Provider | 'custom' | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Record<Provider, boolean>>({
    anthropic: false,
    gemini: false,
    openai: false,
    qwen: false,
  })
  const [inputValues, setInputValues] = useState<Record<Provider, string>>({
    anthropic: '',
    gemini: '',
    openai: '',
    qwen: '',
  })
  const [saving, setSaving] = useState<Record<Provider, boolean>>({
    anthropic: false,
    gemini: false,
    openai: false,
    qwen: false,
  })
  const [qwenModel, setQwenModel] = useState('qwen-max')
  const [customInput, setCustomInput] = useState<CustomProviderConfig>(EMPTY_CUSTOM)
  const [customSaving, setCustomSaving] = useState(false)
  const [customVisible, setCustomVisible] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('custom')
  const [sttProvider, setSttProvider] = useState<'openai' | 'gemini' | 'qwen' | 'custom' | 'local' | null>(null)
  const [testResult, setTestResult] = useState<{ reasoning: boolean; stt: boolean } | null>(null)
  const [testing, setTesting] = useState(false)
  const [unreachableWarning, setUnreachableWarning] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [cosyvoiceInput, setCosyvoiceInput] = useState('')
  const [cosyvoiceVisible, setCosyvoiceVisible] = useState(false)
  const [cosyvoiceSaving, setCosyvoiceSaving] = useState(false)
  const [localTtsUrl, setLocalTtsUrl] = useState('')
  const [localTtsModel, setLocalTtsModel] = useState('')
  const [localTtsSaving, setLocalTtsSaving] = useState(false)
  const [localSttUrl, setLocalSttUrl] = useState('')
  const [localSttModel, setLocalSttModel] = useState('')
  const [localSttSaving, setLocalSttSaving] = useState(false)
  const [localTtsTesting, setLocalTtsTesting] = useState(false)
  const [localTtsTestResult, setLocalTtsTestResult] = useState<'ok' | 'fail' | null>(null)
  const [localSttTesting, setLocalSttTesting] = useState(false)
  const [localSttTestResult, setLocalSttTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Load API keys on mount
  useEffect(() => {
    const stored = localStorage.getItem(BYOK_STORAGE_KEY) as Provider | 'custom' | null
    window.electronAPI.getApiKeys().then((keys) => {
      setApiKeys(keys)
      setInputValues({
        anthropic: keys.anthropicApiKey || '',
        gemini: keys.geminiApiKey || '',
        openai: keys.openaiApiKey || '',
        qwen: keys.qwenApiKey || '',
      })
      if (keys.cosyvoiceApiKey) setCosyvoiceInput(keys.cosyvoiceApiKey)
      if (keys.localTtsUrl) setLocalTtsUrl(keys.localTtsUrl)
      if (keys.localTtsModel) setLocalTtsModel(keys.localTtsModel)
      if (keys.localSttUrl) setLocalSttUrl(keys.localSttUrl)
      if (keys.localSttModel) setLocalSttModel(keys.localSttModel)
      if (keys.qwenModel) setQwenModel(keys.qwenModel)
      if (keys.customProvider) {
        setCustomInput({ ...EMPTY_CUSTOM, ...keys.customProvider })
      }
      if (keys.preferredSttProvider) {
        setSttProvider(keys.preferredSttProvider)
      }
      // Restore stored preference if that provider still has a key
      if (stored === 'custom' && keys.customProvider?.baseUrl && keys.customProvider?.model) {
        setPreferredProvider('custom')
      } else if (stored && stored !== 'custom' && keys[PROVIDER_KEY_MAP[stored]]) {
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

  const handlePreferredProviderChange = (provider: Provider | 'custom') => {
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

  const hasCustomSet = !!(apiKeys.customProvider?.baseUrl && apiKeys.customProvider?.model)

  const handleSaveCustom = async () => {
    if (!customInput.baseUrl.trim() || !customInput.model.trim()) return
    setCustomSaving(true)
    try {
      await window.electronAPI.setCustomProvider({
        baseUrl: customInput.baseUrl.trim(),
        apiKey: customInput.apiKey.trim(),
        model: customInput.model.trim(),
        label: customInput.label?.trim() || undefined,
        sttEnabled: customInput.sttEnabled,
        sttModel: customInput.sttModel,
      })
      setApiKeys(prev => ({ ...prev, customProvider: customInput }))
    } finally {
      setCustomSaving(false)
    }
  }

  const handleClearCustom = async () => {
    setCustomSaving(true)
    try {
      await window.electronAPI.clearCustomProvider()
      setApiKeys(prev => { const u = { ...prev }; delete u.customProvider; return u })
      setCustomInput(EMPTY_CUSTOM)
      // Clear preferred provider if it was set to custom
      if (preferredProvider === 'custom') {
        setPreferredProvider(null)
        localStorage.removeItem(BYOK_STORAGE_KEY)
      }
      // Clear STT provider if it was set to custom
      if (sttProvider === 'custom') {
        setSttProvider(null)
        await window.electronAPI.setSttProvider(null)
      }
    } finally {
      setCustomSaving(false)
    }
  }

  const handleSaveCosyvoice = async () => {
    const value = cosyvoiceInput.trim()
    if (!value) return
    setCosyvoiceSaving(true)
    try {
      await window.electronAPI.setApiKey('cosyvoice', value)
      setApiKeys(prev => ({ ...prev, cosyvoiceApiKey: value }))
      console.log('Cosyvoice API key saved successfully')
    } catch (error) {
      console.error('Failed to save Cosyvoice key:', error)
    } finally {
      setCosyvoiceSaving(false)
    }
  }

  const handleClearCosyvoice = async () => {
    setCosyvoiceSaving(true)
    try {
      await window.electronAPI.clearApiKey('cosyvoice')
      setApiKeys(prev => {
        const updated = { ...prev }
        delete updated.cosyvoiceApiKey
        return updated
      })
      setCosyvoiceInput('')
      console.log('Cosyvoice API key cleared')
    } catch (error) {
      console.error('Failed to clear Cosyvoice key:', error)
    } finally {
      setCosyvoiceSaving(false)
    }
  }

  const hasCosyvoiceSet = !!apiKeys.cosyvoiceApiKey

  const handleSaveLocalTts = async () => {
    const url = localTtsUrl.trim()
    if (!url) return
    setLocalTtsSaving(true)
    try {
      await window.electronAPI.setLocalTts(url, localTtsModel.trim() || undefined)
      setApiKeys(prev => ({ ...prev, localTtsUrl: url, localTtsModel: localTtsModel.trim() || undefined }))
    } catch (error) {
      console.error('Failed to save local TTS:', error)
    } finally {
      setLocalTtsSaving(false)
    }
  }

  const handleClearLocalTts = async () => {
    setLocalTtsSaving(true)
    try {
      await window.electronAPI.clearLocalTts()
      setApiKeys(prev => { const u = { ...prev }; delete u.localTtsUrl; delete u.localTtsModel; return u })
      setLocalTtsUrl('')
      setLocalTtsModel('')
    } catch (error) {
      console.error('Failed to clear local TTS:', error)
    } finally {
      setLocalTtsSaving(false)
    }
  }

  const handleSaveLocalStt = async () => {
    const url = localSttUrl.trim()
    if (!url) return
    setLocalSttSaving(true)
    try {
      const model = localSttModel.trim() || undefined
      await window.electronAPI.setLocalStt(url, model)
      setApiKeys(prev => ({ ...prev, localSttUrl: url, localSttModel: model }))
    } catch (error) {
      console.error('Failed to save local STT:', error)
    } finally {
      setLocalSttSaving(false)
    }
  }

  const handleClearLocalStt = async () => {
    setLocalSttSaving(true)
    try {
      await window.electronAPI.clearLocalStt()
      setApiKeys(prev => { const u = { ...prev }; delete u.localSttUrl; delete u.localSttModel; return u })
      setLocalSttUrl('')
      setLocalSttModel('')
      if (sttProvider === 'local') {
        setSttProvider(null)
        await window.electronAPI.setSttProvider(null)
      }
    } catch (error) {
      console.error('Failed to clear local STT:', error)
    } finally {
      setLocalSttSaving(false)
    }
  }

  const handleTestLocalTts = async () => {
    const url = localTtsUrl.trim()
    if (!url) return
    setLocalTtsTesting(true)
    setLocalTtsTestResult(null)
    try {
      const buffer = await window.electronAPI.testLocalTts(url, localTtsModel.trim() || undefined)
      if (buffer) {
        setLocalTtsTestResult('ok')
        // Play the returned audio so the user can hear it
        const blob = new Blob([buffer], { type: 'audio/mpeg' })
        const audioUrl = URL.createObjectURL(blob)
        const audio = new Audio(audioUrl)
        audio.onended = () => URL.revokeObjectURL(audioUrl)
        await audio.play()
      } else {
        setLocalTtsTestResult('fail')
      }
    } catch {
      setLocalTtsTestResult('fail')
    } finally {
      setLocalTtsTesting(false)
    }
  }

  const handleTestLocalStt = async () => {
    const url = localSttUrl.trim()
    if (!url) return
    setLocalSttTesting(true)
    setLocalSttTestResult(null)
    try {
      const result = await window.electronAPI.testLocalStt(url, localSttModel.trim() || undefined)
      setLocalSttTestResult(result)
    } catch (error) {
      setLocalSttTestResult({ ok: false, message: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setLocalSttTesting(false)
    }
  }

  const isLocalHttpsUrl = (url: string) =>
    /^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url.trim())

  const hasLocalTtsSet = !!apiKeys.localTtsUrl
  const hasLocalSttSet = !!apiKeys.localSttUrl

  const fetchModels = async (baseUrl: string) => {
    setFetchingModels(true)
    setAvailableModels([])
    try {
      const ids = await window.electronAPI.listCustomProviderModels(baseUrl)
      setAvailableModels(ids)
    } catch {
      // silently ignore — user can still type manually
    } finally {
      setFetchingModels(false)
    }
  }

  const handleProviderChange = (providerKey: string) => {
    setSelectedProvider(providerKey)
    setUnreachableWarning(false)
    setAvailableModels([])

    if (providerKey === 'custom') {
      setCustomInput(EMPTY_CUSTOM)
    } else {
      const config = PRECONFIGURED_PROVIDERS[providerKey]
      if (config) {
        setCustomInput(prev => ({
          ...prev,
          baseUrl: config.baseUrl,
          label: config.label,
          apiKey: '',
          model: '',
        }))
        if (config.baseUrl) fetchModels(config.baseUrl)
      }
    }
  }

  return (
    <div className="h-full flex flex-col bg-white/90 rounded-2xl backdrop-blur-sm border border-gray-200 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="drag-region px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="no-drag p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-900">Settings</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-5 overflow-y-auto">
        {/* Header panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
          <div className="flex flex-col items-center">
            <video src={itDepartmentIcon} autoPlay muted playsInline className="h-32 w-32 flex-shrink-0" />
            <h2 className="text-xl font-semibold text-gray-800 mt-2">Settings</h2>
          </div>
        </div>

        {/* Resume / CV */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resume / CV</h3>
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
              className="w-full flex items-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <FileText size={14} />
              Load resume file (.txt, .pdf, .docx)
            </button>
          )}
        </div>

        {/* Job Description */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Job Description</h3>
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
              className="w-full flex items-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
            >
              <FileText size={14} />
              Load job description file
            </button>
          )}
        </div>

        {/* Additional Context */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Additional Context</h3>
          <textarea
            value={manualContext}
            onChange={(e) => onManualContextChange(e.target.value)}
            placeholder="Add context (e.g., 'Senior TypeScript role, 5 years experience')"
            rows={4}
            className="w-full bg-gray-100 text-gray-700 text-xs rounded-lg px-3 py-2.5 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400 resize-none"
          />
          <p className="text-[10px] text-gray-500 mt-2">
            Context is sent with every AI request to personalize answers.
          </p>
        </div>

        {/* API Keys */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">API Keys</h3>
          <p className="text-[10px] text-gray-500 mb-3">
            Add your own API keys to use your own accounts. Your keys are stored securely on your device.
          </p>
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-3">
            <span className="text-amber-400 text-[10px] leading-relaxed">
              Tested and working with Gemini and Alibaba (Qwen + TTS) API keys — more provider support coming soon.
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {PROVIDERS.map((provider) => (
              <div
                key={provider.key}
                className={`rounded-lg border overflow-hidden ${
                  hasKeySet(provider.key)
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'bg-gray-100 border-gray-200'
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
                      className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400"
                    />
                    <button
                      onClick={() => toggleVisibility(provider.key)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                      title={visibleKeys[provider.key] ? 'Hide' : 'Show'}
                    >
                      {visibleKeys[provider.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleSave(provider.key)}
                    disabled={!inputValues[provider.key].trim() || saving[provider.key] || inputValues[provider.key] === apiKeys[`${provider.key}ApiKey`]}
                    className="flex-shrink-0 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {saving[provider.key] ? (
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    Save
                  </button>
                </div>
                {provider.key === 'qwen' && hasKeySet('qwen') && (
                  <div className="px-3 pb-3">
                    <select
                      value={qwenModel}
                      onChange={async (e) => {
                        setQwenModel(e.target.value)
                        await window.electronAPI.setQwenModel(e.target.value)
                      }}
                      className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {QWEN_MODELS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            Your API keys are encrypted and stored locally.
          </p>
        </div>


        {/* Cosyvoice TTS */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Text-to-Speech (TTS)</h3>
          <p className="text-[10px] text-gray-500 mb-3">
            Add your Cosyvoice (Alibaba DashScope) API key for high-quality interview audio.
          </p>
          <div className={`rounded-lg border overflow-hidden ${
            hasCosyvoiceSet
              ? 'bg-emerald-500/5 border-emerald-500/30'
              : 'bg-gray-100 border-gray-200'
          }`}>
            <div className="px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound size={13} className={hasCosyvoiceSet ? 'text-emerald-400' : 'text-gray-500'} />
                <span className={`text-xs truncate ${hasCosyvoiceSet ? 'text-emerald-400' : 'text-gray-400'}`}>
                  Cosyvoice (DashScope)
                </span>
                {hasCosyvoiceSet && (
                  <span className="flex-shrink-0 text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                    Set
                  </span>
                )}
              </div>
              {hasCosyvoiceSet && (
                <button
                  onClick={handleClearCosyvoice}
                  disabled={cosyvoiceSaving}
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
                  type={cosyvoiceVisible ? 'text' : 'password'}
                  value={cosyvoiceInput}
                  onChange={(e) => setCosyvoiceInput(e.target.value)}
                  placeholder={hasCosyvoiceSet ? '••••••••••••••••••••' : 'sk-...'}
                  className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400"
                />
                <button
                  onClick={() => setCosyvoiceVisible(!cosyvoiceVisible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                  title={cosyvoiceVisible ? 'Hide' : 'Show'}
                >
                  {cosyvoiceVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <button
                onClick={handleSaveCosyvoice}
                disabled={!cosyvoiceInput.trim() || cosyvoiceSaving || cosyvoiceInput === apiKeys.cosyvoiceApiKey}
                className="flex-shrink-0 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1"
              >
                {cosyvoiceSaving ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check size={12} />
                )}
                Save
              </button>
            </div>
          </div>
          {/* Local TTS */}
          <div className={`mt-3 rounded-lg border overflow-hidden ${
            hasLocalTtsSet
              ? 'bg-emerald-500/5 border-emerald-500/30'
              : 'bg-gray-100 border-gray-200'
          }`}>
            <div className="px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound size={13} className={hasLocalTtsSet ? 'text-emerald-400' : 'text-gray-500'} />
                <span className={`text-xs truncate ${hasLocalTtsSet ? 'text-emerald-400' : 'text-gray-400'}`}>
                  Local TTS (OpenAI-compatible)
                </span>
                {hasLocalTtsSet && (
                  <span className="flex-shrink-0 text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                    Set
                  </span>
                )}
              </div>
              {hasLocalTtsSet && (
                <button
                  onClick={handleClearLocalTts}
                  disabled={localTtsSaving}
                  className="flex-shrink-0 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                  title="Remove local TTS"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="px-3 pb-3 flex flex-col gap-2">
              <input
                type="text"
                value={localTtsUrl}
                onChange={(e) => setLocalTtsUrl(e.target.value)}
                placeholder="http://localhost:8880/v1"
                className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400"
              />
              {isLocalHttpsUrl(localTtsUrl) && (
                <p className="text-[10px] text-yellow-500">⚠ Local servers typically use http://, not https://</p>
              )}
              <input
                type="text"
                value={localTtsModel}
                onChange={(e) => setLocalTtsModel(e.target.value)}
                placeholder="Model (optional, e.g. kokoro)"
                className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400"
              />
              <div className="flex gap-2 self-end">
                <button
                  onClick={handleTestLocalTts}
                  disabled={!localTtsUrl.trim() || localTtsTesting}
                  className="px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1"
                  title="Send a test phrase and play back the audio"
                >
                  {localTtsTesting ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <>🔊</>}
                  Test
                </button>
                <button
                  onClick={handleSaveLocalTts}
                  disabled={!localTtsUrl.trim() || localTtsSaving || (localTtsUrl === apiKeys.localTtsUrl && localTtsModel === (apiKeys.localTtsModel || ''))}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1"
                >
                  {localTtsSaving ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  Save
                </button>
              </div>
              {localTtsTestResult && (
                <div className={`px-2.5 py-2 rounded-md text-xs ${
                  localTtsTestResult === 'ok'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}>
                  {localTtsTestResult === 'ok' ? '✓ Audio received — listen for playback' : '✗ No response from TTS server'}
                </div>
              )}
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            Local TTS takes priority over Cosyvoice when set. Try <span className="text-gray-500">Kokoro-FastAPI</span> on port 8880. Include <code className="text-gray-500">/v1</code> in the URL.
          </p>
        </div>


        {/* Custom / OpenAI-compatible provider */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Custom Provider</h3>
          <p className="text-[10px] text-gray-500 mb-3">
            Any OpenAI-compatible API — Groq, OpenRouter, Ollama, Together AI, etc.
          </p>
          {/* Provider selector dropdown */}
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-100 px-3 py-2.5">
            <label className="text-xs text-gray-500 mb-2 block font-medium">Select Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 cursor-pointer"
            >
              {Object.entries(PRECONFIGURED_PROVIDERS).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
          <div className={`rounded-lg border overflow-hidden ${hasCustomSet ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-gray-100 border-gray-200'}`}>
            <div className="px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound size={13} className={hasCustomSet ? 'text-emerald-400' : 'text-gray-500'} />
                <span className={`text-xs truncate ${hasCustomSet ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {customInput.label?.trim() || 'Custom'}
                </span>
                {hasCustomSet && (
                  <span className="flex-shrink-0 text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Set</span>
                )}
              </div>
              {hasCustomSet && (
                <button onClick={handleClearCustom} disabled={customSaving} className="flex-shrink-0 text-gray-500 hover:text-red-400 transition-colors cursor-pointer" title="Remove">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="px-3 pb-3 flex flex-col gap-2">
              <input
                type="text"
                value={customInput.baseUrl}
                onChange={(e) => setCustomInput(prev => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="Base URL (e.g. https://api.groq.com/openai/v1)"
                className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400"
              />
              <div className="relative">
                <input
                  type={customVisible ? 'text' : 'password'}
                  value={customInput.apiKey}
                  onChange={(e) => setCustomInput(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="API key (leave empty for Ollama)"
                  className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400"
                />
                <button onClick={() => setCustomVisible(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                  {customVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              {availableModels.length > 0 ? (
                <select
                  value={customInput.model}
                  onChange={(e) => setCustomInput(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Select a model…</option>
                  {availableModels.map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={customInput.model}
                  onChange={(e) => setCustomInput(prev => ({ ...prev, model: e.target.value }))}
                  placeholder={fetchingModels ? 'Fetching models…' : 'Model (e.g. qwen/qwen3-70b, llama-3.3-70b-versatile)'}
                  disabled={fetchingModels}
                  className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400 disabled:opacity-50"
                />
              )}
              <label className="flex items-center gap-2 px-2.5 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customInput.sttEnabled || false}
                  onChange={(e) => setCustomInput(prev => ({ ...prev, sttEnabled: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-blue-500"
                />
                <span className="text-xs text-gray-700">Supports transcription (STT)</span>
              </label>
              {customInput.sttEnabled && (
                <input
                  type="text"
                  value={customInput.sttModel || ''}
                  onChange={(e) => setCustomInput(prev => ({ ...prev, sttModel: e.target.value }))}
                  placeholder="STT model (e.g. whisper-1)"
                  className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400"
                />
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customInput.label || ''}
                  onChange={(e) => setCustomInput(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Label (optional, e.g. Groq / Qwen)"
                  className="flex-1 bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400"
                />
                <button
                  onClick={async () => {
                    setTesting(true)
                    setUnreachableWarning(false)
                    try {
                      const result = await window.electronAPI.testCustomProvider(customInput)
                      setTestResult(result)
                      if (!result.reasoning) {
                        setUnreachableWarning(true)
                      }
                    } catch (error) {
                      setTestResult({ reasoning: false, stt: false })
                      setUnreachableWarning(true)
                    } finally {
                      setTesting(false)
                    }
                  }}
                  disabled={!customInput.baseUrl.trim() || !customInput.model.trim() || testing}
                  className="flex-shrink-0 px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1"
                  title="Test provider connectivity"
                >
                  {testing ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>🧪</>
                  )}
                  Test
                </button>
                <button
                  onClick={handleSaveCustom}
                  disabled={!customInput.baseUrl.trim() || !customInput.model.trim() || customSaving}
                  className="flex-shrink-0 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1"
                >
                  {customSaving ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  Save
                </button>
              </div>
              {testResult && (
                <div className={`px-2.5 py-2 rounded-md text-xs ${
                  testResult.reasoning && (customInput.sttEnabled ? testResult.stt : true)
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}>
                  Reasoning: {testResult.reasoning ? '✓ OK' : '✗ Failed'} {customInput.sttEnabled && (
                    <>
                      / STT: {testResult.stt ? '✓ OK' : '✗ Failed'}
                    </>
                  )}
                </div>
              )}
              {!testResult && unreachableWarning && (
                <div className="px-2.5 py-2 rounded-md text-xs bg-red-500/10 text-red-400 border border-red-500/30">
                  ⚠ Provider is unreachable. Please check the URL and try again.
                </div>
              )}
            </div>
          </div>

          {/* Preferred provider selector — shown when any standard key or custom provider is set */}
          {(PROVIDERS.filter((p) => hasKeySet(p.key)).length > 0 || hasCustomSet) && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-100 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-2">
                <Star size={13} className="text-yellow-400" />
                <span className="text-xs text-gray-700 font-medium">Preferred provider</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.filter((p) => hasKeySet(p.key)).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handlePreferredProviderChange(p.key)}
                    className={`flex-1 py-1.5 text-xs rounded-md border transition-colors cursor-pointer ${
                      preferredProvider === p.key
                        ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-600'
                        : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    {p.label.split(' ')[0]}
                  </button>
                ))}
                {hasCustomSet && (
                  <button
                    onClick={() => handlePreferredProviderChange('custom')}
                    className={`flex-1 py-1.5 text-xs rounded-md border transition-colors cursor-pointer ${
                      preferredProvider === 'custom'
                        ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-600'
                        : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    {customInput.label?.trim() || 'Custom'}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5">This provider will be used for AI responses.</p>
            </div>
          )}
        </div>


        {/* Local STT */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Local STT</h3>
          <p className="text-[10px] text-gray-500 mb-3">
            Point to a local Whisper server (OpenAI-compatible <code className="text-gray-500">/v1/audio/transcriptions</code>).
          </p>
          <div className={`rounded-lg border overflow-hidden ${
            hasLocalSttSet
              ? 'bg-emerald-500/5 border-emerald-500/30'
              : 'bg-gray-100 border-gray-200'
          }`}>
            <div className="px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound size={13} className={hasLocalSttSet ? 'text-emerald-400' : 'text-gray-500'} />
                <span className={`text-xs truncate ${hasLocalSttSet ? 'text-emerald-400' : 'text-gray-400'}`}>
                  Local Whisper / STT
                </span>
                {hasLocalSttSet && (
                  <span className="flex-shrink-0 text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                    Set
                  </span>
                )}
              </div>
              {hasLocalSttSet && (
                <button
                  onClick={handleClearLocalStt}
                  disabled={localSttSaving}
                  className="flex-shrink-0 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                  title="Remove local STT"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="px-3 pb-3 flex flex-col gap-2">
              <input
                type="text"
                value={localSttUrl}
                onChange={(e) => setLocalSttUrl(e.target.value)}
                placeholder="http://localhost:8000/v1"
                className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400"
              />
              {isLocalHttpsUrl(localSttUrl) && (
                <p className="text-[10px] text-yellow-500">⚠ Local servers typically use http://, not https://</p>
              )}
              <input
                type="text"
                value={localSttModel}
                onChange={(e) => setLocalSttModel(e.target.value)}
                placeholder="Model (optional, e.g. Systran/faster-whisper-small)"
                className="w-full bg-white text-gray-700 text-xs rounded-md px-2.5 py-2 border border-gray-200 outline-none focus:border-blue-500 placeholder-gray-400"
              />
              <div className="flex gap-2 self-end">
                <button
                  onClick={handleTestLocalStt}
                  disabled={!localSttUrl.trim() || localSttTesting}
                  className="px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1"
                  title="Send a silent audio clip and check for a response"
                >
                  {localSttTesting ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <>🧪</>}
                  Test
                </button>
                <button
                  onClick={handleSaveLocalStt}
                  disabled={!localSttUrl.trim() || localSttSaving || (localSttUrl === apiKeys.localSttUrl && localSttModel === (apiKeys.localSttModel || ''))}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1"
                >
                  {localSttSaving ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  Save
                </button>
              </div>
              {localSttTestResult && (
                <div className={`px-2.5 py-2 rounded-md text-xs ${
                  localSttTestResult.ok
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}>
                  {localSttTestResult.ok ? '✓ STT server responded successfully' : `✗ ${localSttTestResult.message}`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STT Provider Preference */}
        {(() => {
          const sttProviders = [
            { key: 'openai' as const, label: 'OpenAI', enabled: !!apiKeys.openaiApiKey },
            { key: 'gemini' as const, label: 'Gemini', enabled: !!apiKeys.geminiApiKey },
            { key: 'qwen' as const, label: 'Qwen', enabled: !!apiKeys.qwenApiKey },
            { key: 'custom' as const, label: customInput.label || 'Custom', enabled: customInput.sttEnabled && !!customInput.baseUrl },
            { key: 'local' as const, label: 'Local', enabled: !!apiKeys.localSttUrl }
          ].filter(p => p.enabled)

          return sttProviders.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preferred STT Provider</h3>
              <div className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2.5">
                <div className="flex flex-wrap gap-2 mb-2">
                  {sttProviders.map((p) => (
                    <button
                      key={p.key}
                      onClick={async () => {
                        setSttProvider(p.key)
                        await window.electronAPI.setSttProvider(p.key)
                      }}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors cursor-pointer ${
                        sttProvider === p.key
                          ? 'bg-blue-500/15 border-blue-500/50 text-blue-600'
                          : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500">Falls back automatically if unavailable.</p>
              </div>
            </div>
          ) : null
        })()}
      </div>
    </div>
  )
}
