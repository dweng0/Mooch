import { useState, useRef } from 'react'
import { Mic, X } from 'lucide-react'
import { AudioRecorder } from '../services/recorder'

interface Props {
  onSubmit: (audioBuffer: ArrayBuffer | null) => void
  onCancel: () => void
}

export default function CaptureVoiceModal({ onSubmit, onCancel }: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [hasRecording, setHasRecording] = useState(false)
  const recorderRef = useRef(new AudioRecorder())
  const audioBufferRef = useRef<ArrayBuffer | null>(null)

  const handleStartRecording = async () => {
    console.log('[CaptureVoiceModal] Microphone button clicked - starting recording')
    try {
      console.log('[CaptureVoiceModal] Calling recorder.start("microphone")')
      await recorderRef.current.start('microphone')
      console.log('[CaptureVoiceModal] Recording started successfully')
      setIsRecording(true)
    } catch (err) {
      console.error('[CaptureVoiceModal] Failed to start recording:', err)
      alert(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }

  const handleStopRecording = async () => {
    try {
      const buffer = await recorderRef.current.stop()
      audioBufferRef.current = buffer
      setIsRecording(false)
      setHasRecording(true)
    } catch (err) {
      console.error('Failed to stop recording:', err)
      setIsRecording(false)
    }
  }

  const handleSubmit = () => {
    onSubmit(audioBufferRef.current)
  }

  const handleSkip = () => {
    onSubmit(null)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-2xl border border-white/10 p-8 shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Add Voice Context</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
            title="Cancel"
          >
            <X size={24} />
          </button>
        </div>

        <p className="text-gray-300 text-center mb-8">
          Now say out loud what you have to do
        </p>

        <div className="flex flex-col items-center gap-6">
          {!isRecording && !hasRecording && (
            <button
              onClick={handleStartRecording}
              className="w-32 h-32 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/50 transition-all duration-200 flex items-center justify-center"
              title="Start recording"
            >
              <Mic size={48} />
            </button>
          )}

          {isRecording && (
            <button
              onClick={handleStopRecording}
              className="w-32 h-32 rounded-full bg-red-700 hover:bg-red-800 text-white shadow-lg shadow-red-500/50 transition-all duration-200 flex items-center justify-center animate-pulse"
              title="Stop recording"
            >
              <Mic size={48} />
            </button>
          )}

          {hasRecording && !isRecording && (
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-green-500 text-white shadow-lg shadow-green-500/50 flex items-center justify-center mb-4">
                <Mic size={48} />
              </div>
              <p className="text-green-400 text-sm">Recording saved</p>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <button
              onClick={handleSkip}
              disabled={isRecording}
              className="flex-1 px-6 py-3 rounded-lg font-medium text-base transition-all duration-200 bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={isRecording}
              className="flex-1 px-6 py-3 rounded-lg font-medium text-base transition-all duration-200 bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
            >
              {hasRecording ? 'Submit' : 'Submit without audio'}
            </button>
          </div>
        </div>

        {isRecording && (
          <p className="text-gray-400 text-sm text-center mt-4">
            Recording... Click the microphone to stop
          </p>
        )}
      </div>
    </div>
  )
}
