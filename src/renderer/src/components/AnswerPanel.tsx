import type { TextSize } from '../../../shared/types'
import deepLearningIcon from '../assets/proposed_images/Deep_Learning.webm'

const SIZE_CLASSES: Record<TextSize, string> = {
  small: 'text-base',
  medium: 'text-xl',
  large: 'text-2xl',
  'extra-large': 'text-3xl'
}

interface AnswerPanelProps {
  answer: string
  answerHistory: string[]
  status: string
  textSize: TextSize
  passiveProcessing?: boolean
}

/** Displays the current AI-generated answer and a scrollable history of previous answers. */
export default function AnswerPanel({ answer, answerHistory, status, textSize, passiveProcessing }: AnswerPanelProps) {
  const sizeClass = SIZE_CLASSES[textSize]

  return (
    <div className="flex-1 min-h-0 px-4 py-3 overflow-y-auto">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4 mb-3">
        <div className="flex flex-col items-center mb-3">
          <video src={deepLearningIcon} autoPlay muted playsInline className="h-32 w-32 flex-shrink-0" />
          <h2 className="text-xl font-semibold text-gray-800 mt-2">
            Suggested Answer
          </h2>
          {passiveProcessing && (
            <span className="text-xs text-gray-500 animate-pulse mt-1">● transcribing...</span>
          )}
        </div>
      {status === 'thinking' || status === 'analyzing' ? (
        <p className={`${sizeClass} text-blue-400 animate-pulse`}>Thinking...</p>
      ) : answer ? (
        <>
          {/* Latest Answer */}
          <div className={`${sizeClass} text-gray-700 leading-relaxed whitespace-pre-wrap font-medium mb-4 opacity-50`}>
            {answer}
          </div>

          {/* Answer History (newest first, already ordered) */}
          {answerHistory.length > 0 && (
            <div className="space-y-4 mt-6">
              {answerHistory.map((historicalAnswer, index) => (
                <div key={index}>
                  <div className="border-t border-gray-700 pt-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Previous Answer
                    </h3>
                    <div className={`${sizeClass} text-gray-500 leading-relaxed whitespace-pre-wrap opacity-75`}>
                      {historicalAnswer}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className={`${sizeClass} text-gray-500 italic`}>Answer will appear here</p>
      )}
      </div>
    </div>
  )
}
