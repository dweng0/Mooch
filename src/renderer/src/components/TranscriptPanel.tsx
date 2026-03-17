import machineLearningIcon from '../assets/proposed_images/Machine_Learning.webm'

interface TranscriptPanelProps {
  transcript: string
  status: string
}

export default function TranscriptPanel({ transcript, status }: TranscriptPanelProps) {
  return (
    <div className="flex-none px-4 py-3 border-b border-gray-200">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <div className="flex flex-col items-center mb-3">
          <video
            src={machineLearningIcon}
            autoPlay
            muted
            playsInline
            className="h-32 w-32 flex-shrink-0"
          />
          <h2 className="text-xl font-semibold text-gray-800 mt-2">
            Transcript
          </h2>
        </div>
        {status === 'transcribing' ? (
          <p className="text-sm text-yellow-600 animate-pulse">Transcribing...</p>
        ) : transcript ? (
          <p className="text-sm text-gray-700 leading-relaxed">{transcript}</p>
        ) : (
          <p className="text-sm text-gray-500 italic">Record a question to see the transcript</p>
        )}
      </div>
    </div>
  )
}
