import { useMemo } from 'react'
import { Settings, Lock } from 'lucide-react'
import StatusIndicator from './StatusIndicator'
import MochiLogo from './MochiLogo'
import bunnyLogo from '../assets/bunny-logo.png'
import generalIcon from '../assets/Presentation.webm'
import codeIcon from '../assets/Responsive_Design.webm'
import mockIcon from '../assets/Idea.webm'
import type { UserApiKeys } from '../../../shared/types'

const HYPE_PHRASES = [
  "You're gonna smash it!",
  "You've got this!",
  "Do the power stance!",
  "They're lucky to have you!",
  "You're more prepared than you think.",
  "Breathe. You know your stuff.",
  "Walk in like you own the place.",
  "This is your moment — take it!",
  "Every expert was once a beginner.",
  "Confidence is your superpower.",
  "You've done hard things before.",
  "Today's the day. Let's go!",
  "Trust the prep, trust yourself.",
  "Nerves mean you care. That's good.",
  "You belong in that room.",
  "Channel your inner 10x engineer.",
  "Smile — they want you to succeed too.",
  "You're ready. You've always been ready.",
  "Big energy only from here.",
  "Go show them what you're made of!",
]

export type InterviewMode = 'general' | 'code' | 'mock'

interface Props {
  onSelect: (mode: InterviewMode) => void
  onSettings: () => void
  onLogout: () => void
  apiUrl: string
  cvName: string
  jobDescName: string
  manualContext: string
  apiKeys?: UserApiKeys
}

function hasAnyLlmKey(apiKeys?: UserApiKeys): boolean {
  if (!apiKeys) return false
  return !!(
    apiKeys.anthropicApiKey ||
    apiKeys.geminiApiKey ||
    apiKeys.openaiApiKey ||
    apiKeys.qwenApiKey ||
    (apiKeys.customProvider?.baseUrl && apiKeys.customProvider?.model)
  )
}

export default function ServiceSelection({
  onSelect,
  onSettings,
  onLogout,
  apiUrl,
  cvName,
  jobDescName,
  manualContext,
  apiKeys,
}: Props) {
  const hasKey = hasAnyLlmKey(apiKeys)
  const hypePhrase = useMemo(
    () => HYPE_PHRASES[Math.floor(Math.random() * HYPE_PHRASES.length)],
    []
  )

  const contextItems = [
    cvName && 'Resume',
    jobDescName && 'Job Desc',
    manualContext.trim() && 'Notes'
  ].filter(Boolean) as string[]

  return (
    <div className="h-full flex flex-col bg-gray-900/85 rounded-2xl backdrop-blur-sm border border-white/10 overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="drag-region px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="no-drag">
            {apiUrl && <StatusIndicator apiUrl={apiUrl} />}
          </div>
          <span className="text-sm font-semibold text-white">Mooch</span>
          <div className="no-drag flex items-center gap-2">
            <button
              onClick={onSettings}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <img src={bunnyLogo} alt="Mooch" className="h-8 w-8 ml-1" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-3 overflow-y-auto">
        {/* Context indicator */}
        {contextItems.length > 0 ? (
          <button
            onClick={onSettings}
            className="text-left text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 hover:bg-emerald-500/15 transition-colors cursor-pointer"
          >
            Context loaded: {contextItems.join(' · ')} ✓
          </button>
        ) : (
          <button
            onClick={onSettings}
            className="text-left text-xs text-gray-500 bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors cursor-pointer"
          >
            + Add resume, job description, or context
          </button>
        )}

        <div className="flex justify-center py-2">
          <MochiLogo className="h-36 w-36" />
        </div>

        <p className="text-sm text-gray-300 font-semibold text-center">{hypePhrase}</p>

        <ModeCard
          title="General Interview"
          description="Auto-detect questions via passive listening. Supports manual recording too."
          videoSrc={generalIcon}
          borderColor="border-purple-500/30 hover:border-purple-500/60"
          bgHover="hover:bg-purple-500/10"
          modelRequirement="Any LLM key"
          unavailable={!hasKey}
          onClick={() => onSelect('general')}
        />
        <ModeCard
          title="Code Interview"
          description="All general features plus code snapshot analysis — capture windows or screen areas."
          videoSrc={codeIcon}
          borderColor="border-blue-500/30 hover:border-blue-500/60"
          bgHover="hover:bg-blue-500/10"
          modelRequirement="Any LLM key"
          unavailable={!hasKey}
          onClick={() => onSelect('code')}
        />
        <ModeCard
          title="Mock Interview"
          description="Continuous voice practice — speak freely, get AI answers with text-to-speech."
          videoSrc={mockIcon}
          borderColor="border-green-500/30 hover:border-green-500/60"
          bgHover="hover:bg-green-500/10"
          modelRequirement="Any LLM key + Browser voice"
          unavailable={!hasKey}
          onClick={() => onSelect('mock')}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between">
        <span className="text-[10px] text-gray-600">Mooch</span>
        <button
          onClick={onLogout}
          title="Sign out"
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors cursor-pointer"
        >
          ⏻
        </button>
      </div>
    </div>
  )
}

function ModeCard({
  title,
  description,
  videoSrc,
  borderColor,
  bgHover,
  modelRequirement,
  unavailable,
  onClick
}: {
  title: string
  description: string
  videoSrc: string
  borderColor: string
  bgHover: string
  modelRequirement: string
  unavailable?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border bg-white/5 transition-all duration-150 cursor-pointer ${borderColor} ${bgHover} ${unavailable ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center h-14 w-14 rounded-xl bg-white flex-shrink-0">
          <video
            src={videoSrc}
            autoPlay
            muted
            playsInline
            className="h-12 w-12"
          />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{description}</div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              data-testid="model-requirement"
              className="text-[10px] text-gray-500 bg-gray-800 border border-white/10 px-1.5 py-0.5 rounded-full"
            >
              {modelRequirement}
            </span>
            {unavailable && (
              <span
                data-testid="feature-unavailable"
                className="flex items-center gap-1 text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full"
              >
                <Lock size={9} />
                No API key
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
