import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Mic, MicOff, Volume2, Square, RotateCcw } from 'lucide-react'
import type { InterviewSessionMetadata, InterviewSession, InterviewStatus, InterviewTurn } from '../../../shared/types'

interface MockInterviewScreenProps {
  onBack: () => void
}

type MockScreenView = 'setup' | 'sessions' | 'interview' | 'review'

// Simple Web Speech API wrapper
class LiveService {
  private recognition: any = null
  private isListening = false
  private transcript = ''
  private available: boolean = false

  constructor() {
    const SpeechRecognition = window.webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition()
        this.recognition.continuous = true
        this.recognition.interimResults = true
        this.recognition.lang = 'en-US'
        this.available = true
        console.log('[Speech API] Initialized successfully')
      } catch (error) {
        console.error('[Speech API] Failed to initialize:', error)
        this.available = false
      }
    } else {
      console.warn('[Speech API] Web Speech API not available on this browser/OS')
      this.available = false
    }
  }

  isAvailable(): boolean {
    return this.available && !!this.recognition
  }

  start(onInterim: (text: string) => void, onFinal: (text: string) => void) {
    if (!this.recognition) {
      console.error('[Speech API] Recognition not available')
      return
    }
    this.isListening = true
    this.transcript = ''

    this.recognition.onstart = () => {
      console.log('[Speech API] Listening started - microphone should be active')
    }

    this.recognition.onresult = (event: any) => {
      console.log('[Speech API] Got speech result, isFinal:', event.results[event.results.length - 1]?.isFinal)
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          this.transcript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }
      if (interimTranscript) {
        onInterim(interimTranscript)
      }
    }

    this.recognition.onerror = (event: any) => {
      console.error('[Speech API] Recognition error:', event.error)
      this.isListening = false
    }

    this.recognition.onend = () => {
      console.log('[Speech API] Listening ended')
      if (this.isListening && this.transcript) {
        onFinal(this.transcript.trim())
      }
    }

    try {
      console.log('[Speech API] Calling start()')
      this.recognition.start()
    } catch (error) {
      console.error('[Speech API] Failed to start:', error)
      this.isListening = false
    }
  }

  stop() {
    if (!this.recognition) return
    this.isListening = false
    this.recognition.stop()
  }

  pauseListening() {
    if (this.recognition && this.isListening) {
      this.recognition.abort()
      this.isListening = false
    }
  }

  resumeListening(onInterim: (text: string) => void, onFinal: (text: string) => void) {
    if (!this.isListening) {
      this.start(onInterim, onFinal)
    }
  }

  speak(text: string, onEnd: () => void) {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    utterance.onend = onEnd
    speechSynthesis.speak(utterance)
  }

  stopSpeaking() {
    speechSynthesis.cancel()
  }
}

export default function MockInterviewScreen({ onBack }: MockInterviewScreenProps) {
  const [view, setView] = useState<MockScreenView>('sessions')
  const [status, setStatus] = useState<InterviewStatus>('idle')
  const [sessions, setSessions] = useState<InterviewSessionMetadata[]>([])
  const [currentSession, setCurrentSession] = useState<InterviewSessionMetadata | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [resume, setResume] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [feedbackHistory, setFeedbackHistory] = useState<InterviewTurn['llmFeedback'][]>([])
  const [currentTurn, setCurrentTurn] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const liveServiceRef = useRef(new LiveService())

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const sessionList = await window.electronAPI.interviewListSessions()
      setSessions(sessionList)
    } catch (err) {
      console.error('Failed to load sessions:', err)
      setError('Failed to load sessions')
    }
  }

  const createSession = async () => {
    if (!jobDescription.trim()) {
      setError('Please enter a job description')
      return
    }
    if (!resume.trim()) {
      setError('Please enter your resume')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      setStatus('analyzing')
      const metadata = await window.electronAPI.interviewCreateSession(jobDescription, resume)
      setCurrentSession(metadata)

      setStatus('questioning')
      const opener = await window.electronAPI.interviewGenerateOpener(metadata.sessionId)
      setCurrentQuestion(opener)

      setCurrentTurn(0)
      setFeedbackHistory([])
      setFinalTranscript('')
      setInterimTranscript('')

      // Play the first question
      await speakQuestion(opener)
      setView('interview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
      setStatus('idle')
    } finally {
      setIsLoading(false)
    }
  }

  const speakQuestion = async (text: string) => {
    setStatus('responding')
    liveServiceRef.current.pauseListening()

    try {
      const buffer = await window.electronAPI.interviewSynthesize(text)
      if (buffer) {
        // Play via HTML audio element
        const blob = new Blob([buffer], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        if (audioRef.current) {
          audioRef.current.src = url
          audioRef.current.play()
          await new Promise(resolve => {
            if (audioRef.current) audioRef.current.onended = resolve
          })
        }
      } else {
        // Fallback to browser TTS
        await new Promise(resolve => {
          liveServiceRef.current.speak(text, () => resolve(null))
        })
      }
    } catch (err) {
      console.warn('TTS failed, using browser fallback:', err)
      await new Promise(resolve => {
        liveServiceRef.current.speak(text, () => resolve(null))
      })
    }

    // Start listening after speaking
    setStatus('listening')
    setFinalTranscript('')
    setInterimTranscript('')
    liveServiceRef.current.start(
      (interim) => setInterimTranscript(interim),
      (final) => handleUserAnswer(final)
    )
  }

  const handleUserAnswer = async (text: string) => {
    if (!currentSession) return

    setStatus('processing')
    liveServiceRef.current.pauseListening()
    setFinalTranscript(text)

    try {
      const turn = await window.electronAPI.interviewProcessTurn(currentSession.sessionId, text)
      setCurrentTurn(turn.turn)
      setFeedbackHistory(prev => [...prev, turn.llmFeedback])
      setCurrentQuestion(turn.llmQuestion)
      await speakQuestion(turn.llmQuestion)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process answer')
      setStatus('idle')
    }
  }

  const endInterview = async (complete: boolean) => {
    if (!currentSession) return

    try {
      liveServiceRef.current.stop()
      liveServiceRef.current.stopSpeaking()
      await window.electronAPI.interviewEndSession(currentSession.sessionId, complete)

      // Reload sessions
      await loadSessions()
      setStatus('complete')
      setView('sessions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session')
    }
  }

  const reviewSession = async (session: InterviewSessionMetadata) => {
    try {
      const fullSession = await window.electronAPI.interviewGetSession(session.sessionId)
      if (fullSession) {
        setCurrentSession(session)
        setFeedbackHistory(fullSession.feedback.map((f: any) => f.feedback))
        setView('review')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    }
  }

  const getStatusMessage = (): string => {
    switch (status) {
      case 'idle': return ''
      case 'analyzing': return 'Analyzing your CV...'
      case 'questioning': return 'Crafting first question...'
      case 'responding': return 'Interviewer speaking...'
      case 'listening': return 'Listening...'
      case 'processing': return 'Processing your response...'
      case 'complete': return 'Interview complete'
      default: return ''
    }
  }

  const getFeedbackColor = (rating: string): string => {
    if (rating === 'excellent' || rating === 'good') return 'bg-green-900/50 text-green-200'
    if (rating === 'solid') return 'bg-yellow-900/50 text-yellow-200'
    return 'bg-orange-900/50 text-orange-200'
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 p-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Mock Interview</h1>
      </div>

      {/* Status Bar */}
      {status !== 'idle' && (
        <div className="bg-blue-900/30 border-b border-blue-700 px-4 py-2 text-sm text-blue-200">
          {status === 'listening' && <span className="inline-block animate-pulse">● </span>}
          {getStatusMessage()}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Setup View */}
        {view === 'setup' && (
          <div className="p-6 max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">Prepare for Your Interview</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Job Description</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Paste the job description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Your Resume</label>
                <textarea
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Paste your resume..."
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-200">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setView('sessions')}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={createSession}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Start Interview'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sessions View */}
        {view === 'sessions' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">Interview Sessions</h2>
              <button
                onClick={() => {
                  setJobDescription('')
                  setResume('')
                  setError('')
                  setView('setup')
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-sm"
              >
                New Interview
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No interview sessions yet</p>
                <button
                  onClick={() => setView('setup')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Create First Session
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="bg-gray-800 rounded-lg p-4 flex justify-between items-center hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold">{session.jobTitle}</h3>
                      <p className="text-sm text-gray-400">
                        {new Date(session.createdAt).toLocaleDateString()} • {session.totalTurns} turns
                      </p>
                      <span
                        className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                          session.isComplete
                            ? 'bg-green-900/50 text-green-200'
                            : 'bg-yellow-900/50 text-yellow-200'
                        }`}
                      >
                        {session.isComplete ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => reviewSession(session)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Interview View */}
        {view === 'interview' && currentSession && (
          <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold mb-4">{currentSession.jobTitle}</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Interview Area */}
              <div className="lg:col-span-2">
                <div className="bg-gray-800 rounded-lg p-6 space-y-6">
                  {/* Raw LLM Response (for debugging) */}
                  {currentQuestion && (
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                      <p className="text-xs text-gray-500 mb-2 font-mono">Raw LLM Response:</p>
                      <div className="bg-black/30 rounded p-2 max-h-24 overflow-y-auto">
                        <p className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words">{currentQuestion}</p>
                      </div>
                    </div>
                  )}

                  {/* Question Display */}
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 min-h-24">
                    <p className="text-sm text-gray-400 mb-2">Current Question</p>
                    <p className="text-base leading-relaxed">{currentQuestion}</p>
                  </div>

                  {/* Transcript Display */}
                  <div className="space-y-3">
                    {interimTranscript && (
                      <div className="bg-blue-900/20 rounded-lg p-3 text-blue-200 italic border border-blue-700/30">
                        <p className="text-sm text-gray-400 mb-1">You (interim):</p>
                        {interimTranscript}
                      </div>
                    )}
                    {finalTranscript && (
                      <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                        <p className="text-sm text-gray-400 mb-1">You:</p>
                        {finalTranscript}
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex gap-3">
                    {status === 'listening' ? (
                      <button
                        onClick={() => {
                          liveServiceRef.current.stop()
                          setStatus('idle')
                        }}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <MicOff size={16} />
                        Stop Listening
                      </button>
                    ) : (
                      <button
                        onClick={() => speakQuestion(currentQuestion)}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        disabled={status !== 'idle'}
                      >
                        <Mic size={16} />
                        Speak Question Again
                      </button>
                    )}
                    <button
                      onClick={() => endInterview(true)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => endInterview(false)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Square size={16} />
                      End
                    </button>
                  </div>
                </div>
              </div>

              {/* Feedback Panel */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 max-h-96 overflow-y-auto">
                <p className="text-sm font-semibold text-gray-300 mb-4">Feedback</p>
                {feedbackHistory.length === 0 ? (
                  <p className="text-sm text-gray-400">Feedback will appear here</p>
                ) : (
                  <div className="space-y-3">
                    {feedbackHistory.map((feedback, idx) => (
                      <div key={idx} className={`rounded-lg p-3 border ${getFeedbackColor(feedback.rating)} border-opacity-30`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold uppercase">{feedback.rating}</span>
                        </div>
                        <p className="text-xs leading-relaxed">{feedback.comment}</p>
                        {feedback.context?.jobRequirement && (
                          <p className="text-xs text-gray-300 mt-2">
                            <span className="font-semibold">Req:</span> {feedback.context.jobRequirement}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Review View */}
        {view === 'review' && currentSession && (
          <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold mb-4">Review: {currentSession.jobTitle}</h2>

            <div className="bg-gray-800 rounded-lg p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 border-b border-gray-700 pb-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Date</p>
                  <p className="font-semibold">{new Date(currentSession.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Status</p>
                  <p className="font-semibold">{currentSession.isComplete ? '✓ Completed' : 'In Progress'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Total Turns</p>
                  <p className="font-semibold">{currentSession.totalTurns}</p>
                </div>
              </div>

              {/* Feedback Summary */}
              <div>
                <p className="text-sm font-semibold text-gray-300 mb-3">Feedback Summary</p>
                <div className="space-y-2">
                  {feedbackHistory.map((feedback, idx) => (
                    <div key={idx} className={`rounded-lg p-3 border ${getFeedbackColor(feedback.rating)}`}>
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold uppercase">Turn {idx + 1}: {feedback.rating}</span>
                      </div>
                      <p className="text-sm mt-1">{feedback.comment}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setView('sessions')}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Back to Sessions
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio element for TTS playback */}
      <audio ref={audioRef} className="hidden" />
    </div>
  )
}
