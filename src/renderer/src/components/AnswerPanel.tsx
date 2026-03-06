import type { TextSize } from '../../../shared/types'

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

export default function AnswerPanel({ answer, answerHistory, status, textSize, passiveProcessing }: AnswerPanelProps) {
  const sizeClass = SIZE_CLASSES[textSize]

  return (
    <div className="flex-1 min-h-0 px-4 py-3 overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Suggested Answer
        </h2>
        {passiveProcessing && (
          <span className="text-xs text-purple-400 animate-pulse">● transcribing...</span>
        )}
      </div>
      {status === 'thinking' || status === 'analyzing' ? (
        <p className={`${sizeClass} text-blue-400 animate-pulse`}>Thinking...</p>
      ) : answer ? (
        <>
          {/* Latest Answer */}
          <div className={`${sizeClass} text-gray-100 leading-relaxed whitespace-pre-wrap font-medium mb-4`}>
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
                    <div className={`${sizeClass} text-gray-400 leading-relaxed whitespace-pre-wrap opacity-75`}>
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
  )
}
