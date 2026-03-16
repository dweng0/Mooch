import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Mic, MicOff, Volume2, Send, X, Trash2, Circle, Lightbulb, MessageCircle, Maximize2, Minimize2 } from 'lucide-react'
import type { InterviewSessionMetadata, InterviewSession, InterviewStatus, InterviewTurn } from '../../../shared/types'

interface MockInterviewScreenProps {
  onBack: () => void
}

type MockScreenView = 'setup' | 'sessions' | 'interview' | 'review'

type ChatMessage =
  | { role: 'interviewer'; text: string; audioBuffer?: ArrayBuffer | null; status: 'loading' | 'done'; feedback?: InterviewTurn['llmFeedback'] }
  | { role: 'user'; text: string; feedback?: InterviewTurn['llmFeedback'] }

// Import the proven working implementation
import { LocalInterviewService } from '../services/localInterview'

function PulsingDots() {
  return (
    <div className="flex gap-1 py-1">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  )
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [interimTranscript, setInterimTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [reviewSession, setReviewSession] = useState<InterviewSession | null>(null)
  const [expandedFeedback, setExpandedFeedback] = useState<Set<number>>(new Set())
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const localServiceRef = useRef(new LocalInterviewService())
  const recordingMessageAddedRef = useRef(false)

  // Load sessions on mount
  useEffect(() => {
    loadSessions()

    // Cleanup when component unmounts
    return () => {
      console.log('[MockInterview] Component unmounting, cleaning up localService')
      localServiceRef.current.stop()
    }
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

      setMessages([])
      setFinalTranscript('')
      setInterimTranscript('')

      // Add loading message
      setMessages([{ role: 'interviewer', text: '', status: 'loading' }])

      // Play the first question
      const audioBuffer = await speakQuestion(opener)

      // Update message with the spoken question
      setMessages([{ role: 'interviewer', text: opener, status: 'done', audioBuffer }])
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

  const speakQuestion = async (text: string): Promise<ArrayBuffer | null> => {
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
        console.log('[MockInterview] TTS synthesis complete, playing audio')

        // Play the audio
        setStatus('speaking')
        await playAudioBuffer(buffer)
        setStatus('idle')
        setFinalTranscript('')
        setInterimTranscript('')
        return buffer
      } else {
        // Fallback to browser TTS
        console.log('[MockInterview] No TTS buffer, using browser speech synthesis')
        setStatus('speaking')
        await new Promise(resolve => {
          localServiceRef.current.speak(questionToSpeak, () => resolve(null))
        })
        setStatus('idle')
        setFinalTranscript('')
        setInterimTranscript('')
        return null
      }
    } catch (err) {
      console.error('[MockInterview] TTS failed:', err)
      setStatus('speaking')
      await new Promise(resolve => {
        localServiceRef.current.speak(text, () => resolve(null))
      })
      setStatus('idle')
      setFinalTranscript('')
      setInterimTranscript('')
      return null
    }
  }

  const replayQuestion = async () => {
    // Find the last interviewer message
    const lastQuestion = messages.findLast(m => m.role === 'interviewer' && m.status === 'done')
    if (lastQuestion && lastQuestion.role === 'interviewer' && lastQuestion.audioBuffer) {
      await playAudioBuffer(lastQuestion.audioBuffer)
    } else if (lastQuestion && lastQuestion.role === 'interviewer') {
      // Fallback if no audio is stored
      console.warn('No stored audio, falling back to browser TTS')
      await new Promise(resolve => {
        localServiceRef.current.speak(lastQuestion.text, () => resolve(null))
      })
    }
  }

  const startRecording = () => {
    console.log('[MockInterview] Starting recording')
    setStatus('listening')
    setFinalTranscript('')
    setInterimTranscript('')
    recordingMessageAddedRef.current = true

    // Add a placeholder user message with pulsing dots
    setMessages(prev => [...prev, { role: 'user', text: '' }])

    localServiceRef.current.start(
      (text) => {
        setInterimTranscript(text)
        // Only update message if we have actual meaningful transcript (not "(recording...)" or similar)
        if (text && !text.toLowerCase().includes('recording')) {
          setMessages(prev => {
            const newMessages = [...prev]
            const lastMsg = newMessages[newMessages.length - 1]
            if (lastMsg && lastMsg.role === 'user') {
              lastMsg.text = text
            }
            return newMessages
          })
        }
      },
      (text) => {
        console.log('[MockInterview] Recording complete, text:', text)
        setFinalTranscript(text)
        setInterimTranscript(text)
        // Update the last message with final transcript
        setMessages(prev => {
          const newMessages = [...prev]
          const lastMsg = newMessages[newMessages.length - 1]
          if (lastMsg && lastMsg.role === 'user') {
            lastMsg.text = text
          }
          return newMessages
        })
        localServiceRef.current.stop()

        // Auto-submit the recorded answer
        handleUserAnswer(text)
      },
      { audioSource: 'microphone', mode: 'active' }
    )
  }

  const handleUserAnswer = async (text: string) => {
    if (!currentSession) return

    setStatus('processing')

    try {
      // Add user message only if it wasn't added during recording
      if (!recordingMessageAddedRef.current) {
        setMessages(prev => [...prev, { role: 'user', text }])
      }
      recordingMessageAddedRef.current = false
      setFinalTranscript('')
      setInterimTranscript('')

      // Process the turn
      const turn = await window.electronAPI.interviewProcessTurn(currentSession.sessionId, text)

      // Update the user message with feedback
      setMessages(prev => {
        const newMessages = [...prev]
        const lastUserMsg = newMessages.findLast(m => m.role === 'user')
        if (lastUserMsg && lastUserMsg.role === 'user') {
          lastUserMsg.feedback = turn.llmFeedback
        }
        return newMessages
      })

      // Add loading message for next question
      setMessages(prev => [...prev, { role: 'interviewer', text: '', status: 'loading' }])

      // Speak the next question
      const audioBuffer = await speakQuestion(turn.llmQuestion)

      // Update the loading message with the question, audio, and feedback (AI's thinking)
      setMessages(prev => {
        const newMessages = [...prev]
        const lastMsg = newMessages[newMessages.length - 1]
        if (lastMsg && lastMsg.role === 'interviewer') {
          lastMsg.text = turn.llmQuestion
          lastMsg.status = 'done'
          lastMsg.audioBuffer = audioBuffer ?? undefined
          lastMsg.feedback = turn.llmFeedback // Show feedback as AI's thinking
        }
        return newMessages
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process answer')
      setStatus('idle')
    }
  }

  const endInterview = async (complete: boolean) => {
    if (!currentSession) return

    try {
      localServiceRef.current.stop()
      localServiceRef.current.stopSpeaking()
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

  const deleteAllSessions = async () => {
    try {
      await window.electronAPI.interviewDeleteAllSessions()
      setDeleteAllConfirm(false)
      // Reload sessions
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete all sessions')
      setDeleteAllConfirm(false)
    }
  }

  const getStatusMessage = (): string => {
    switch (status) {
      case 'idle': return ''
      case 'analyzing': return 'Analyzing your CV...'
      case 'questioning': return 'Crafting first question...'
      case 'thinking': return 'Thinking...'
      case 'formulating': return 'Formulating question...'
      case 'speaking': return 'Speaking...'
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
    <div className="relative h-full">
      <div className={`h-full flex flex-col bg-gray-900 text-white ${isMaximized ? 'absolute inset-0' : ''}`}>
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title={isMaximized ? 'Restore window' : 'Maximize window'}
          >
            {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Close interview"
          >
            <X size={20} />
          </button>
        </div>
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
              <div className="flex gap-2">
                {sessions.length > 0 && !deleteAllConfirm && (
                  <button
                    onClick={() => setDeleteAllConfirm(true)}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg transition-colors text-sm"
                    title="Delete all interview sessions"
                  >
                    Delete All Sessions
                  </button>
                )}
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
            </div>

            {deleteAllConfirm && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
                <p className="text-red-200 mb-4">Are you sure you want to delete all sessions? This action cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteAllSessions()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    Confirm Delete All
                  </button>
                  <button
                    onClick={() => setDeleteAllConfirm(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

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

        {/* Interview View - Chat Interface */}
        {view === 'interview' && currentSession && (
          <div className="flex flex-col h-full">
            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, idx) => (
                <div key={idx} className={`flex ${message.role === 'interviewer' ? 'justify-start' : 'justify-end'}`}>
                  {message.role === 'interviewer' ? (
                    <div className="flex items-end gap-2 max-w-[80%]">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs shrink-0 font-semibold">
                        AI
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
                          {message.status === 'loading' ? (
                            <PulsingDots />
                          ) : (
                            <p className="text-sm">{message.text}</p>
                          )}
                        </div>
                        {message.status === 'done' && (
                          <div className="flex items-center gap-2">
                            {message.audioBuffer && (
                              <button
                                onClick={() => playAudioBuffer(message.audioBuffer!)}
                                className="flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded transition-colors"
                              >
                                <Volume2 size={12} />
                                Play
                              </button>
                            )}
                            {/* AI Thinking Icons */}
                            {message.feedback && (
                              <div className="flex items-center gap-1">
                                {/* Rating indicator */}
                                <div title={`Thinking: ${message.feedback.rating}`}>
                                  <Circle
                                    size={14}
                                    className={`fill-current ${
                                      message.feedback.rating === 'excellent' || message.feedback.rating === 'good'
                                        ? 'text-green-400'
                                        : message.feedback.rating === 'solid'
                                        ? 'text-yellow-400'
                                        : 'text-red-400'
                                    }`}
                                  />
                                </div>
                                {/* Thinking/Comment icon */}
                                <div title={message.feedback.comment}>
                                  <Lightbulb size={14} className="text-blue-400 hover:text-blue-300 cursor-help" />
                                </div>
                                {/* Context note icon */}
                                {message.feedback.context?.conversationNote && (
                                  <div title={message.feedback.context.conversationNote}>
                                    <MessageCircle size={14} className="text-purple-400 hover:text-purple-300 cursor-help" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-2 max-w-[80%]">
                      <div className="bg-blue-600 rounded-2xl rounded-br-sm px-4 py-3">
                        {message.text === '' ? (
                          <PulsingDots />
                        ) : (
                          <p className="text-sm">{message.text}</p>
                        )}
                      </div>
                      {message.feedback && (
                        <div className="flex flex-col gap-2">
                          <div className={`text-xs px-3 py-2 rounded-xl ${getFeedbackColor(message.feedback.rating)}`}>
                            <span className="font-semibold uppercase">{message.feedback.rating}</span>
                          </div>
                          {/* Icons row for feedback details */}
                          <div className="flex items-center gap-2">
                            {/* Rating indicator */}
                            <div title={message.feedback.rating}>
                              <Circle
                                size={16}
                                className={`fill-current ${
                                  message.feedback.rating === 'excellent' || message.feedback.rating === 'good'
                                    ? 'text-green-400'
                                    : message.feedback.rating === 'solid'
                                    ? 'text-yellow-400'
                                    : 'text-red-400'
                                }`}
                              />
                            </div>
                            {/* Thinking/Comment icon */}
                            <div title={message.feedback.comment}>
                              <Lightbulb size={16} className="text-blue-400 hover:text-blue-300 cursor-help" />
                            </div>
                            {/* Context note icon */}
                            {message.feedback.context?.conversationNote && (
                              <div title={message.feedback.context.conversationNote}>
                                <MessageCircle size={16} className="text-purple-400 hover:text-purple-300 cursor-help" />
                              </div>
                            )}
                            {/* Job requirement icon */}
                            {message.feedback.context?.jobRequirement && (
                              <div title={message.feedback.context.jobRequirement}>
                                <Circle size={16} className="text-orange-400 hover:text-orange-300 cursor-help opacity-75" />
                              </div>
                            )}
                            {/* Resume skill icon */}
                            {message.feedback.context?.resumeSkill && (
                              <div title={message.feedback.context.resumeSkill}>
                                <Circle size={16} className="text-cyan-400 hover:text-cyan-300 cursor-help opacity-75" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Bar */}
            <div className="border-t border-gray-700 p-3 space-y-2">
              <div className="flex items-end gap-2">
                <textarea
                  value={finalTranscript}
                  onChange={(e) => setFinalTranscript(e.target.value)}
                  placeholder="Type a message..."
                  disabled={status !== 'idle' && status !== 'listening'}
                  className="flex-1 bg-gray-800 rounded-2xl px-4 py-3 text-sm resize-none max-h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (finalTranscript.trim()) {
                        handleUserAnswer(finalTranscript)
                      }
                    }
                  }}
                />
                {status === 'listening' ? (
                  <button
                    onClick={() => {
                      localServiceRef.current.stop()
                    }}
                    className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition-colors flex-shrink-0 animate-pulse"
                    title="Stop recording"
                  >
                    <MicOff size={20} />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (finalTranscript.trim()) {
                        handleUserAnswer(finalTranscript)
                      } else {
                        startRecording()
                      }
                    }}
                    disabled={status !== 'idle'}
                    className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
                    title={finalTranscript.trim() ? 'Send message' : 'Record answer'}
                  >
                    {finalTranscript.trim() ? <Send size={20} /> : <Mic size={20} />}
                  </button>
                )}
              </div>

              {/* End Interview Buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => replayQuestion()}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors flex items-center gap-1"
                >
                  <Volume2 size={14} />
                  Replay
                </button>
                <button
                  onClick={() => endInterview(true)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                >
                  Complete
                </button>
                <button
                  onClick={() => endInterview(false)}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                >
                  End
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review View - Chat Thread Interface */}
        {view === 'review' && reviewSession && (
          <div className="flex flex-col h-full">
            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <h2 className="text-lg font-semibold mb-6">Review: {reviewSession.metadata.jobTitle}</h2>

              {reviewSession.feedback.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="mb-4">No interview responses to review yet.</p>
                  <p className="text-sm">This may happen if the interview was ended before any questions were answered.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviewSession.feedback.map((feedback, idx) => (
                    <div key={idx} className="space-y-4">
                      {/* Interviewer Question - Left */}
                      <div className="flex justify-start">
                        <div className="flex items-end gap-2 max-w-[80%]">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs shrink-0 font-semibold">
                            AI
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
                              <p className="text-sm">{feedback.llmQuestion || 'Question'}</p>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const audioBuffer = await window.electronAPI.interviewGetAudio(
                                    reviewSession.metadata.sessionId,
                                    feedback.turn - 1,
                                    'question'
                                  )
                                  if (audioBuffer) {
                                    await playAudioBuffer(audioBuffer)
                                  } else {
                                    console.warn('No audio buffer available for this question')
                                  }
                                } catch (err) {
                                  console.error('Failed to play audio:', err)
                                }
                              }}
                              className="flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded transition-colors w-fit"
                            >
                              <Volume2 size={12} />
                              Play
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* User Response - Right */}
                      <div className="flex justify-end">
                        <div className="flex flex-col items-end gap-2 max-w-[80%]">
                          <div className="bg-blue-600 rounded-2xl rounded-br-sm px-4 py-3">
                            <p className="text-sm">{feedback.userResponseText || 'User response'}</p>
                          </div>
                          {feedback.feedback && (
                            <div className="flex flex-col gap-2">
                              <div className={`text-xs px-3 py-2 rounded-xl ${getFeedbackColor(feedback.feedback.rating)}`}>
                                <span className="font-semibold uppercase">{feedback.feedback.rating}</span>
                              </div>
                              {/* Icons row for feedback details */}
                              <div className="flex items-center gap-2">
                                {/* Rating indicator */}
                                <div title={feedback.feedback.rating}>
                                  <Circle
                                    size={16}
                                    className={`fill-current ${
                                      feedback.feedback.rating === 'excellent' || feedback.feedback.rating === 'good'
                                        ? 'text-green-400'
                                        : feedback.feedback.rating === 'solid'
                                        ? 'text-yellow-400'
                                        : 'text-red-400'
                                    }`}
                                  />
                                </div>
                                {/* Thinking/Comment icon */}
                                <div title={feedback.feedback.comment}>
                                  <Lightbulb size={16} className="text-blue-400 hover:text-blue-300 cursor-help" />
                                </div>
                                {/* Context note icon */}
                                {feedback.feedback.context?.conversationNote && (
                                  <div title={feedback.feedback.context.conversationNote}>
                                    <MessageCircle size={16} className="text-purple-400 hover:text-purple-300 cursor-help" />
                                  </div>
                                )}
                                {/* Job requirement icon */}
                                {feedback.feedback.context?.jobRequirement && (
                                  <div title={feedback.feedback.context.jobRequirement}>
                                    <Circle size={16} className="text-orange-400 hover:text-orange-300 cursor-help opacity-75" />
                                  </div>
                                )}
                                {/* Resume skill icon */}
                                {feedback.feedback.context?.resumeSkill && (
                                  <div title={feedback.feedback.context.resumeSkill}>
                                    <Circle size={16} className="text-cyan-400 hover:text-cyan-300 cursor-help opacity-75" />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {/* Audio playback button for user response */}
                          <button
                            onClick={async () => {
                              try {
                                const audioBuffer = await window.electronAPI.interviewGetAudio(
                                  reviewSession.metadata.sessionId,
                                  feedback.turn - 1,
                                  'response'
                                )
                                if (audioBuffer) {
                                  await playAudioBuffer(audioBuffer)
                                } else {
                                  console.warn('No audio buffer for this response')
                                }
                              } catch (err) {
                                console.error('Failed to play audio:', err)
                              }
                            }}
                            className="flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded transition-colors w-fit"
                          >
                            <Volume2 size={12} />
                            Play Audio
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Back Button */}
            <div className="border-t border-gray-700 p-3 flex justify-center">
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
    </div>
  )
}
