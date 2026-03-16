import handWritingIcon from '../assets/proposed_images/Hands_General_WEBM/Hand_Writting.webm'

interface TranscriptPanelProps {
  transcript: string
  status: string
}

export default function TranscriptPanel({ transcript, status }: TranscriptPanelProps) {
  return (
    <div className="flex-none px-4 py-3 border-b border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <video src={handWritingIcon} autoPlay loop muted playsInline className="h-8 w-8 flex-shrink-0" />
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Transcript
        </h2>
      </div>
      {status === 'transcribing' ? (
        <p className="text-sm text-yellow-400 animate-pulse">Transcribing...</p>
      ) : transcript ? (
        <p className="text-sm text-gray-200 leading-relaxed">{transcript}</p>
      ) : (
        <p className="text-sm text-gray-500 italic">Record a question to see the transcript</p>
      )}
    </div>
  )
}
