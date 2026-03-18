import { useMemo, useRef, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { Tooltip } from 'react-tooltip'
import StatusIndicator from './StatusIndicator'
import MochiLogo from './MochiLogo'
import bunnyLogo from '../assets/bunny-logo.png'
import generalIcon from '../assets/proposed_images/User_Analysis.webm'
import codeIcon from '../assets/proposed_images/Statistics.webm'
import mockIcon from '../assets/proposed_images/Problem_Solving.webm'
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

function hasAnyStt(apiKeys?: UserApiKeys): boolean {
  if (!apiKeys) return false
  return !!(
    apiKeys.openaiApiKey ||
    apiKeys.geminiApiKey ||
    apiKeys.qwenApiKey ||
    apiKeys.customProvider?.sttEnabled ||
    apiKeys.localSttUrl
  )
}

function hasAnyTts(apiKeys?: UserApiKeys): boolean {
  if (!apiKeys) return false
  return !!(apiKeys.cosyvoiceApiKey || apiKeys.localTtsUrl)
}

export type BadgeSpec = {
  tooltipId: string
  /** shown when hasKeys=true */
  activeLabel: string
  activeTooltip: string
  /** shown when hasKeys=false and required=true → amber warning */
  missingLabel: string
  missingTooltip: string
  /** if false, shows a neutral gray badge instead of amber when !hasKeys */
  required: boolean
  hasKeys: boolean
}

export default function ServiceSelection({
  onSelect,
  onSettings,
  apiUrl,
  cvName,
  jobDescName,
  manualContext,
  apiKeys,
}: Props) {
  const hasKey = hasAnyLlmKey(apiKeys)
  const hasStt = hasAnyStt(apiKeys)
  const hasTts = hasAnyTts(apiKeys)
  const hasVoice = hasStt && hasTts
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
    <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="drag-region px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="no-drag">
            {apiUrl && <StatusIndicator apiUrl={apiUrl} />}
          </div>
          <span className="text-4xl font-semibold text-gray-900" style={{ fontFamily: 'Technulsoft, sans-serif' }}>Mooch</span>
          <div className="no-drag flex items-center gap-2">
            <button
              onClick={onSettings}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-3">
        {/* Context indicator */}
        {contextItems.length > 0 ? (
          <button
            onClick={onSettings}
            className="text-left text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            Context loaded: {contextItems.join(' · ')} ✓
          </button>
        ) : (
          <button
            onClick={onSettings}
            className="text-left text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            + Add resume, job description, or context
          </button>
        )}

        <div className="flex justify-center py-2">
          <MochiLogo className="h-48 w-48" />
        </div>

        <p className="text-lg text-gray-700 font-semibold text-center">{hypePhrase}</p>

        <ModeCard
          title="General Interview"
          videoSrc={generalIcon}
          borderColor="border-purple-300 hover:border-purple-500"
          onSettings={onSettings}
          badges={[{
            tooltipId: 'req-general-llm',
            activeLabel: 'Any LLM key',
            activeTooltip: 'You have set API keys that allow you to do this',
            missingLabel: 'No API key',
            missingTooltip: 'Requires an LLM key (Anthropic, OpenAI, Gemini, or Qwen)',
            required: true,
            hasKeys: hasKey,
          }]}
          delay={0}
          onClick={() => onSelect('general')}
        />
        <ModeCard
          title="Code Interview"
          videoSrc={codeIcon}
          borderColor="border-blue-300 hover:border-blue-500"
          onSettings={onSettings}
          badges={[{
            tooltipId: 'req-code-llm',
            activeLabel: 'Any LLM key',
            activeTooltip: 'You have set API keys that allow you to do this',
            missingLabel: 'No API key',
            missingTooltip: 'Requires an LLM key (Anthropic, OpenAI, Gemini, or Qwen)',
            required: true,
            hasKeys: hasKey,
          }]}
          delay={120}
          onClick={() => onSelect('code')}
        />
        <ModeCard
          title="Mock Interview"
          videoSrc={mockIcon}
          borderColor="border-green-300 hover:border-green-500"
          onSettings={onSettings}
          badges={[
            {
              tooltipId: 'req-mock-llm',
              activeLabel: 'Any LLM key',
              activeTooltip: 'You have set API keys that allow you to do this',
              missingLabel: 'No API key',
              missingTooltip: 'Requires an LLM key (Anthropic, OpenAI, Gemini, or Qwen)',
              required: true,
              hasKeys: hasKey,
            },
            {
              tooltipId: 'req-mock-voice',
              activeLabel: 'STT + TTS',
              activeTooltip: 'You have set STT and TTS keys for voice',
              missingLabel: 'Browser voice',
              missingTooltip: 'No STT/TTS keys set — browser built-in voice will be used instead',
              required: false,
              hasKeys: hasVoice,
            },
          ]}
          delay={240}
          onClick={() => onSelect('mock')}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">Mooch</span>
      </div>
    </div>
  )
}

function ModeCard({
  title,
  videoSrc,
  borderColor,
  badges,
  onSettings,
  delay,
  comingSoon,
  onClick
}: {
  title: string
  videoSrc: string
  borderColor: string
  badges: BadgeSpec[]
  onSettings: () => void
  delay: number
  comingSoon?: boolean
  onClick: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const allRequiredMet = badges.filter(b => b.required).every(b => b.hasKeys)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 2
        videoRef.current.play()
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <button
      onClick={comingSoon ? undefined : !allRequiredMet ? onSettings : onClick}
      style={{ animation: `fadeInUp 0.4s ease both`, animationDelay: `${delay}ms` }}
      className={`w-full text-left px-4 py-3 rounded-xl border bg-white transition-colors duration-150 ${comingSoon ? 'opacity-60 cursor-not-allowed' : `cursor-pointer ${borderColor}`}`}
    >
      <div className="flex items-center gap-4">
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          playsInline
          className="h-32 w-32 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-3xl font-semibold text-gray-900">{title}</div>
          <div className="flex items-center gap-1.5 mt-2">
            {comingSoon ? (
              <span className="text-xs text-blue-500 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                Coming soon
              </span>
            ) : (
              <>
                {badges.map(badge => (
                  badge.hasKeys ? (
                    <span
                      key={badge.tooltipId}
                      data-tooltip-id={badge.tooltipId}
                      data-testid="model-requirement"
                      className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      {badge.activeLabel}
                      <Tooltip id={badge.tooltipId} content={badge.activeTooltip} place="bottom" />
                    </span>
                  ) : badge.required ? (
                    <span
                      key={badge.tooltipId}
                      data-tooltip-id={badge.tooltipId}
                      data-testid="feature-unavailable"
                      className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"
                    >
                      {badge.missingLabel}
                      <Tooltip id={badge.tooltipId} content={badge.missingTooltip} place="bottom" />
                    </span>
                  ) : (
                    <span
                      key={badge.tooltipId}
                      data-tooltip-id={badge.tooltipId}
                      data-testid="model-requirement"
                      className="text-xs text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full"
                    >
                      {badge.missingLabel}
                      <Tooltip id={badge.tooltipId} content={badge.missingTooltip} place="bottom" />
                    </span>
                  )
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
