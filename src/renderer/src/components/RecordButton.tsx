import { Circle, Square } from 'lucide-react'

interface RecordButtonProps {
  isRecording: boolean
  disabled: boolean
  onToggle: () => void
}

export default function RecordButton({ isRecording, disabled, onToggle }: RecordButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`
        px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
        ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
        }
      `}
    >
      <span className="flex items-center gap-2">
        {isRecording ? <Square size={16} fill="white" /> : <Circle size={16} />}
        {isRecording ? 'Stop' : 'Record'}
      </span>
    </button>
  )
}
