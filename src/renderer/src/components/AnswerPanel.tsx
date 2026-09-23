import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { TextSize } from '../../../shared/types'
import deepLearningIcon from '../assets/proposed_images/Deep_Learning.webm'

/** Root font size per setting; Markdown headings, lists etc. scale from it. */
const FONT_SIZES: Record<TextSize, string> = {
  small: '1rem',
  medium: '1.25rem',
  large: '1.5rem',
  'extra-large': '1.875rem'
}

const PROSE =
  'prose max-w-none leading-relaxed text-gray-900 prose-p:text-gray-900 prose-li:text-gray-900 ' +
  'prose-strong:text-black prose-headings:text-black prose-code:text-gray-900 prose-p:my-2'

interface AnswerPanelProps {
  answer: string
  answerHistory: string[]
  status: string
  textSize: TextSize
  passiveProcessing?: boolean
}

/** Renders an answer as Markdown (bold, lists, headings, tables, code). */
function MarkdownAnswer({ text, fontSize, muted = false }: { text: string; fontSize: string; muted?: boolean }) {
  return (
    <div className={`${PROSE} ${muted ? 'opacity-70' : ''}`} style={{ fontSize }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

/**
 * Displays the current AI-generated answer and a scrollable history of previous answers.
 * Shows the illustration only while idle; once an answer is on its way it drops it to save space.
 */
export default function AnswerPanel({ answer, answerHistory, status, textSize, passiveProcessing }: AnswerPanelProps) {
  const fontSize = FONT_SIZES[textSize]
  const thinking = status === 'thinking' || status === 'analyzing'
  const idle = !thinking && !answer && answerHistory.length === 0

  return (
    <div className="flex-1 min-h-0 px-4 py-2 overflow-y-auto">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 mb-3">
        {idle ? (
          <div className="flex flex-col items-center mb-3">
            <video src={deepLearningIcon} autoPlay muted playsInline className="h-32 w-32 flex-shrink-0" />
            <h2 className="text-xl font-semibold text-gray-800 mt-2">Suggested Answer</h2>
          </div>
        ) : (
          <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Suggested Answer</h2>
        )}
        {passiveProcessing && (
          <span className="block text-xs text-gray-500 animate-pulse mb-1">● transcribing...</span>
        )}

        {thinking ? (
          <p className="text-blue-500 animate-pulse" style={{ fontSize }}>Thinking...</p>
        ) : answer ? (
          <MarkdownAnswer text={answer} fontSize={fontSize} />
        ) : idle ? (
          <p className="text-gray-500 italic" style={{ fontSize }}>Answer will appear here</p>
        ) : null}

        {/* Answer History (newest first, already ordered) */}
        {!thinking && answerHistory.length > 0 && (
          <div className="space-y-4 mt-6">
            {answerHistory.map((historicalAnswer, index) => (
              <div key={index} className="border-t border-gray-200 pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Previous Answer</h3>
                <MarkdownAnswer text={historicalAnswer} fontSize={fontSize} muted />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
