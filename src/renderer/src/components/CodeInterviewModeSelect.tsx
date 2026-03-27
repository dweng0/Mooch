import { ArrowLeft } from 'lucide-react'
import { ModeCard } from './ServiceSelection'
import codeIcon from '../assets/proposed_images/Statistics.webm'

interface Props {
  onBack: () => void
  onBrowserBased: () => void
  onVsCodeBased: () => void
}

/** Sub-menu screen that lets the user choose between browser-extension and VS Code code interview modes. */
export default function CodeInterviewModeSelect({ onBack, onBrowserBased, onVsCodeBased }: Props) {
  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="drag-region px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2 no-drag">
          <button
            onClick={onBack}
            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors cursor-pointer"
            title="Back to mode selection"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-gray-700">Code Interview</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
          <div className="flex flex-col items-center">
            <video src={codeIcon} autoPlay muted playsInline className="h-32 w-32 flex-shrink-0" />
            <h2 className="text-xl font-semibold text-gray-800 mt-2">Code Interview</h2>
          </div>
        </div>
        <ModeCard
          title="Browser Based"
          videoSrc={codeIcon}
          borderColor="border-blue-300 hover:border-blue-500"
          onSettings={onBack}
          badges={[]}
          delay={0}
          onClick={onBrowserBased}
          data-testid="browser-based-btn"
        />
        <ModeCard
          title="VS Code Based"
          videoSrc={codeIcon}
          borderColor="border-violet-300 hover:border-violet-500"
          onSettings={onBack}
          badges={[]}
          delay={120}
          onClick={onVsCodeBased}
          data-testid="vscode-based-btn"
        />
      </div>
    </div>
  )
}
