import machineLearningIcon from '../assets/proposed_images/Machine_Learning.webm'

interface TranscriptPanelProps {
  transcript: string
  status: string
}

/**
 * Displays the current audio transcript or a transcribing status indicator.
 * Shows the illustration only while idle; once transcribing starts it collapses
 * to a compact strip so the answer gets the space.
 */
export default function TranscriptPanel({ transcript, status }: TranscriptPanelProps) {
  const transcribing = status === 'transcribing'

  if (!transcript && !transcribing) {
    return (
      <div className="flex-none px-4 py-3 border-b border-gray-200">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <div className="flex flex-col items-center mb-3">
            <video src={machineLearningIcon} autoPlay muted playsInline className="h-32 w-32 flex-shrink-0" />
            <h2 className="text-xl font-semibold text-gray-800 mt-2">Transcript</h2>
          </div>
          <p className="text-sm text-gray-500 italic">Record a question to see the transcript</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-none px-4 pt-2 pb-1">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-3 py-2">
        <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Transcript</h2>
        <div className="max-h-20 overflow-y-auto">
          {transcribing ? (
            <p className="text-sm text-yellow-600 animate-pulse">Transcribing...</p>
          ) : (
            <p className="text-sm text-gray-900 leading-relaxed">{transcript}</p>
          )}
        </div>
      </div>
    </div>
  )
}
