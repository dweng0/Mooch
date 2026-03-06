import { Settings } from 'lucide-react'
import StatusIndicator from './StatusIndicator'
import bunnyLogo from '../assets/bunny-logo.png'
import generalIcon from '../assets/Presentation.webm'
import codeIcon from '../assets/Responsive_Design.webm'
import mockIcon from '../assets/Idea.webm'

export type InterviewMode = 'general' | 'code' | 'mock'

interface Props {
  onSelect: (mode: InterviewMode) => void
  onSettings: () => void
  onLogout: () => void
  apiUrl: string
  cvName: string
  jobDescName: string
  manualContext: string
}

export default function ServiceSelection({
  onSelect,
  onSettings,
  onLogout,
  apiUrl,
  cvName,
  jobDescName,
  manualContext
}: Props) {
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

        <p className="text-xs text-gray-400 font-medium">Choose interview type</p>

        <ModeCard
          title="General Interview"
          description="Auto-detect questions via passive listening. Supports manual recording too."
          videoSrc={generalIcon}
          borderColor="border-purple-500/30 hover:border-purple-500/60"
          bgHover="hover:bg-purple-500/10"
          onClick={() => onSelect('general')}
        />
        <ModeCard
          title="Code Interview"
          description="All general features plus code snapshot analysis — capture windows or screen areas."
          videoSrc={codeIcon}
          borderColor="border-blue-500/30 hover:border-blue-500/60"
          bgHover="hover:bg-blue-500/10"
          onClick={() => onSelect('code')}
        />
        <ModeCard
          title="Mock Interview"
          description="Continuous voice practice — speak freely, get AI answers with text-to-speech."
          videoSrc={mockIcon}
          borderColor="border-green-500/30 hover:border-green-500/60"
          bgHover="hover:bg-green-500/10"
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
  onClick
}: {
  title: string
  description: string
  videoSrc: string
  borderColor: string
  bgHover: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border bg-white/5 transition-all duration-150 cursor-pointer ${borderColor} ${bgHover}`}
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
        <div>
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{description}</div>
        </div>
      </div>
    </button>
  )
}
