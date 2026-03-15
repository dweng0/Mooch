import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Mic, MicOff, Volume2, Square, RotateCcw, X, Trash2 } from 'lucide-react'
import type { InterviewSessionMetadata, InterviewSession, InterviewStatus, InterviewTurn } from '../../../shared/types'

interface MockInterviewScreenProps {
  onBack: () => void
}

type MockScreenView = 'setup' | 'sessions' | 'interview' | 'review'

// Import the proven working implementation
import { LiveInterviewService } from '../services/liveInterview'

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
  const [currentQuestionAudio, setCurrentQuestionAudio] = useState<ArrayBuffer | null>(null)
  const [reviewSession, setReviewSession] = useState<InterviewSession | null>(null)
  const [expandedFeedback, setExpandedFeedback] = useState<Set<number>>(new Set())
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const liveServiceRef = useRef(new LiveInterviewService())

  // Load sessions on mount
  useEffect(() => {
    loadSessions()

    // Cleanup when component unmounts
    return () => {
      console.log('[MockInterview] Component unmounting, cleaning up liveService')
      liveServiceRef.current.stop()
      liveServiceRef.current.stopSpeaking()
    }
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

  const loadSessionForReview = async (session: InterviewSessionMetadata) => {
    try {
      setIsLoading(true)
      const fullSession = await window.electronAPI.interviewGetSession(session.sessionId)
      if (fullSession) {
        setReviewSession(fullSession)
        setView('review')
      }
    } catch (err) {
      console.error('Failed to load session for review:', err)
      setError('Failed to load session for review')
    } finally {
      setIsLoading(false)
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

  const playAudioBuffer = async (buffer: ArrayBuffer) => {
    try {
      const blob = new Blob([buffer], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      if (audioRef.current) {
        audioRef.current.src = url
        audioRef.current.play()
        await new Promise(resolve => {
          if (audioRef.current) audioRef.current.onended = resolve
        })
      }
    } catch (err) {
      console.error('Error playing audio:', err)
    }
  }

  const speakQuestion = async (text: string) => {
    setStatus('thinking')
    console.log('[MockInterview] Starting to speak question')

    try {
      // Extract just the question text (in case it's still JSON)
      let questionToSpeak = text
      if (typeof questionToSpeak === 'string' && questionToSpeak.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(questionToSpeak)
          questionToSpeak = parsed.next_question || questionToSpeak
          console.log('[MockInterview] Extracted question from JSON')
        } catch {
          console.warn('[MockInterview] Failed to parse question JSON, using original')
        }
      }

      // Request TTS synthesis
      setStatus('formulating')
      console.log('[MockInterview] Requesting TTS synthesis')
      const buffer = await window.electronAPI.interviewSynthesize(questionToSpeak)

      if (buffer) {
        // Store the buffer for later replay
        setCurrentQuestionAudio(buffer)
        console.log('[MockInterview] TTS synthesis complete, playing audio')

        // Play the audio
        setStatus('speaking')
        await playAudioBuffer(buffer)
      } else {
        // Fallback to browser TTS
        console.log('[MockInterview] No TTS buffer, using browser speech synthesis')
        setCurrentQuestionAudio(null)
        setStatus('speaking')
        await new Promise(resolve => {
          liveServiceRef.current.speak(questionToSpeak, () => resolve(null))
        })
      }
    } catch (err) {
      console.error('[MockInterview] TTS failed:', err)
      setCurrentQuestionAudio(null)
      setStatus('speaking')
      await new Promise(resolve => {
        liveServiceRef.current.speak(text, () => resolve(null))
      })
    }

    // Ready for user to click record
    setStatus('idle')
    setFinalTranscript('')
    setInterimTranscript('')
  }

  const replayQuestion = async () => {
    if (currentQuestionAudio) {
      // Replay the stored audio without making a new TTS request
      await playAudioBuffer(currentQuestionAudio)
    } else {
      // Fallback if no audio is stored
      console.warn('No stored audio, falling back to browser TTS')
      await new Promise(resolve => {
        liveServiceRef.current.speak(currentQuestion, () => resolve(null))
      })
    }
  }

  const startRecording = () => {
    console.log('[MockInterview] Starting recording')
    setStatus('listening')
    setFinalTranscript('')
    setInterimTranscript('')

    liveServiceRef.current.start(
      (text) => setInterimTranscript(text),
      (text) => {
        console.log('[MockInterview] Recording complete, text:', text)
        setFinalTranscript(text)
        liveServiceRef.current.stop()
      }
    )
  }

  const handleUserAnswer = async (text: string) => {
    if (!currentSession) return

    setStatus('processing')
    setFinalTranscript(text)
    setCurrentQuestionAudio(null) // Clear old audio buffer for new question

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

  const deleteSession = async (sessionId: string) => {
    try {
      await window.electronAPI.interviewDeleteSession(sessionId)
      setDeleteConfirmId(null)
      // Reload sessions
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session')
      setDeleteConfirmId(null)
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
      <div className="border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Mock Interview</h1>
        </div>
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title="Close interview"
        >
          <X size={20} />
        </button>
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
                      {deleteConfirmId === session.sessionId ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteSession(session.sessionId)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors text-white font-medium"
                          >
                            Confirm Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => loadSessionForReview(session)}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(session.sessionId)}
                            className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded text-sm transition-colors flex items-center gap-1"
                            title="Delete this session and all associated audio files"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Interview View */}
        {view === 'interview' && currentSession && (
          <div className="p-6 w-full h-full">
            <h2 className="text-lg font-semibold mb-4">{currentSession.jobTitle}</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Interview Area */}
              <div className="lg:col-span-2">
                <div className="bg-gray-800 rounded-lg p-6 space-y-6">
                  {/* Question Display */}
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 min-h-24">
                    <p className="text-sm text-gray-400 mb-2">Question</p>
                    <p className="text-lg leading-relaxed font-medium">{currentQuestion}</p>
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
                      <>
                        <button
                          onClick={() => {
                            liveServiceRef.current.stop()
                            setStatus('processing')
                            handleUserAnswer(finalTranscript || interimTranscript)
                          }}
                          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                          disabled={!finalTranscript && !interimTranscript}
                        >
                          <Mic size={16} />
                          Submit Answer
                        </button>
                        <button
                          onClick={() => {
                            liveServiceRef.current.stop()
                            setStatus('idle')
                            setFinalTranscript('')
                            setInterimTranscript('')
                          }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <MicOff size={16} />
                          Clear
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={startRecording}
                          className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                          disabled={status !== 'idle'}
                        >
                          <Mic size={16} />
                          Record Answer
                        </button>
                        <button
                          onClick={() => replayQuestion()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          disabled={!currentQuestionAudio && status === 'responding'}
                        >
                          <Volume2 size={16} />
                          Replay
                        </button>
                      </>
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

        {/* Review View - Chat Thread Interface */}
        {view === 'review' && reviewSession && (
          <div className="p-6 w-full h-full overflow-y-auto">
            <h2 className="text-lg font-semibold mb-6">Review: {reviewSession.metadata.jobTitle}</h2>

            {/* Chat Thread */}
            <div className="space-y-6 max-w-3xl mx-auto">
              {reviewSession.feedback.map((feedback, idx) => (
                <div key={idx} className="space-y-4">
                  {/* Interviewer Question - Left */}
                  <div className="flex justify-start">
                    <div className="bg-blue-600 text-white rounded-lg p-4 max-w-sm">
                      <p className="text-sm font-semibold text-blue-100 mb-2">Question {idx + 1}</p>
                      <p className="text-sm leading-relaxed mb-3">{feedback.llmQuestion || 'Question'}</p>
                      <button
                        onClick={async () => {
                          try {
                            const audioBuffer = await window.electronAPI.interviewGetAudio(
                              reviewSession.metadata.sessionId,
                              feedback.turn - 1,
                              'question'
                            )
                            if (audioBuffer) {
                              const blob = new Blob([audioBuffer], { type: 'audio/wav' })
                              const url = URL.createObjectURL(blob)
                              if (audioRef.current) {
                                audioRef.current.src = url
                                audioRef.current.play()
                              }
                            }
                          } catch (err) {
                            console.error('Failed to play audio:', err)
                          }
                        }}
                        className="flex items-center gap-2 text-xs bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded transition-colors"
                      >
                        <Volume2 size={14} />
                        Play Audio
                      </button>
                    </div>
                  </div>

                  {/* User Response - Right */}
                  <div className="flex justify-end">
                    <div className="bg-gray-700 text-white rounded-lg p-4 max-w-sm space-y-3">
                      <p className="text-sm">{feedback.userResponseText || 'User response'}</p>

                      {/* Expandable Feedback Badges */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedFeedback)
                            if (newExpanded.has(idx)) {
                              newExpanded.delete(idx)
                            } else {
                              newExpanded.add(idx)
                            }
                            setExpandedFeedback(newExpanded)
                          }}
                          className={`text-xs px-3 py-1 rounded font-semibold transition-all ${
                            getFeedbackColor(feedback.feedback?.rating || 'solid').replace('border', 'bg').replace('text', 'text')
                          }`}
                        >
                          {feedback.feedback?.rating?.toUpperCase()}
                        </button>
                      </div>

                      {/* Expanded Feedback */}
                      {expandedFeedback.has(idx) && (
                        <div className="mt-3 pt-3 border-t border-gray-600 space-y-2 text-xs">
                          <p><span className="font-semibold">Comment:</span> {feedback.feedback?.comment}</p>
                          {feedback.feedback?.context && (
                            <>
                              <p><span className="font-semibold">Job Requirement:</span> {feedback.feedback.context.jobRequirement}</p>
                              <p><span className="font-semibold">Resume Skill:</span> {feedback.feedback.context.resumeSkill}</p>
                            </>
                          )}

                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Back Button */}
            <div className="flex justify-center mt-8">
              <button
                onClick={() => {
                  setReviewSession(null)
                  setView('sessions')
                }}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                ← Back to Sessions
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio element for TTS playback */}
      <audio ref={audioRef} className="hidden" />
    </div>
  )
}
