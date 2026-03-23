import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Mic, MicOff, Volume2, Send, X, Trash2, Star, Brain, Briefcase, FileText, TrendingUp, Maximize2, Minimize2 } from 'lucide-react'
import { Tooltip } from 'react-tooltip'
import handTargetIcon from '../assets/proposed_images/Hands_General_WEBM/Hand_Holding_Target.webm'
import reachGoalIcon from '../assets/proposed_images/Reach_Goal.webm'
import determineProjectIcon from '../assets/proposed_images/Determine_Project.webm'
import handTimeIcon from '../assets/proposed_images/Hands_General_WEBM/Hand_Holding_Time.webm'
import lineGraphIcon from '../assets/proposed_images/08- Line Graph.webm'
import dataCollectionIcon from '../assets/proposed_images/Data_Collection.webm'
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

/** Full mock interview experience with voice-based Q&A, session management, and post-interview review. */
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
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [cvName, setCvName] = useState('')
  const [jobDescName, setJobDescName] = useState('')
  const [interviewProviders, setInterviewProviders] = useState<{ llm: string | null; tts: string | null; stt: string | null } | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioOutputDeviceIdRef = useRef<string | undefined>(undefined)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lineGraphRef = useRef<HTMLVideoElement>(null)
  const localServiceRef = useRef(new LocalInterviewService())
  const recordingMessageAddedRef = useRef(false)

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
    window.electronAPI.getApiKeys().then(keys => {
      audioOutputDeviceIdRef.current = keys.audioOutputDeviceId
    }).catch(() => {})

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

  useEffect(() => {
    if (view === 'setup') {
      const storedByok = localStorage.getItem('byok_provider')
      const preferred = storedByok === 'anthropic' ? 'claude'
        : storedByok === 'gemini' ? 'gemini'
        : storedByok === 'openai' ? 'openai'
        : storedByok === 'qwen' ? 'qwen'
        : storedByok === 'custom' ? 'custom'
        : undefined
      window.electronAPI.getInterviewProviders(preferred).then(setInterviewProviders).catch(() => {})
    }
  }, [view])

  useEffect(() => {
    if (view === 'review' && lineGraphRef.current) {
      lineGraphRef.current.currentTime = 2
      lineGraphRef.current.play()
    }
  }, [view])

  const loadSessions = async () => {
    try {
      const sessionList = await window.electronAPI.interviewListSessions()
      setSessions(sessionList)
    } catch (err) {
      console.error('Failed to load sessions:', err)
      setError('Failed to load sessions')
    }
  }

  const handleLoadCV = async () => {
    const result = await window.electronAPI.loadTextFile()
    if (result) {
      setResume(result.content)
      setCvName(result.name)
    }
  }

  const handleLoadJobDesc = async () => {
    const result = await window.electronAPI.loadTextFile()
    if (result) {
      setJobDescription(result.content)
      setJobDescName(result.name)
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
        // Route audio to the user's preferred output device when available
        if (audioOutputDeviceIdRef.current && typeof (audioRef.current as any).setSinkId === 'function') {
          try {
            await (audioRef.current as any).setSinkId(audioOutputDeviceIdRef.current)
          } catch {
            // Device no longer available — fall back to default output silently
          }
        }
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

      // Get the audio buffer from the recording (if available)
      const userAudioBuffer = localServiceRef.current.getLastAudioBuffer()

      // Process the turn and save audio
      const turn = await window.electronAPI.interviewProcessTurn(currentSession.sessionId, text, userAudioBuffer || undefined)

      // Clear the audio buffer after processing
      localServiceRef.current.clearLastAudioBuffer()

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

      if (complete) {
        setIsSummarizing(true)
        try {
          await window.electronAPI.interviewGenerateSummary(currentSession.sessionId)
        } catch (err) {
          console.error('Failed to generate summary:', err)
        } finally {
          setIsSummarizing(false)
        }
      }

      await loadSessions()
      setStatus('complete')
      setView('sessions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session')
      setIsSummarizing(false)
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
      console.log('[MockInterview] Starting delete all sessions')
      await window.electronAPI.interviewDeleteAllSessions()
      console.log('[MockInterview] Delete all sessions completed')
      setDeleteAllConfirm(false)
      // Reload sessions
      await loadSessions()
    } catch (err) {
      console.error('[MockInterview] Delete all sessions failed:', err)
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

  const ratingMeta = (rating: string): { color: string; label: string; stars: number } => {
    switch (rating) {
      case 'excellent': return { color: 'text-green-600', label: 'Excellent', stars: 5 }
      case 'good':      return { color: 'text-green-500', label: 'Good',      stars: 4 }
      case 'solid':     return { color: 'text-yellow-500', label: 'Solid',    stars: 3 }
      case 'fair':      return { color: 'text-orange-500', label: 'Fair',     stars: 2 }
      default:          return { color: 'text-red-500',    label: 'Weak',     stars: 1 }
    }
  }

  const FeedbackCard = ({ feedback, id }: { feedback: NonNullable<InterviewTurn['llmFeedback']>; id: string }) => {
    const meta = ratingMeta(feedback.rating)
    return (
      <div className="flex items-center gap-2 mt-1" data-testid="feedback-rating-card" data-rating={feedback.rating}>
        {/* Stars — rating strength */}
        <div
          data-tooltip-id={`fb-${id}-rating`}
          data-tooltip-content={`${meta.label} — ${feedback.comment}`}
          className={`flex gap-0.5 cursor-default ${meta.color}`}
        >
          {[1,2,3,4,5].map(n => (
            <Star key={n} size={11} className={n <= meta.stars ? `fill-current ${meta.color}` : 'text-gray-300'} />
          ))}
        </div>
        <Tooltip id={`fb-${id}-rating`} place="top" className="max-w-[220px] text-xs" />

        {/* Brain — assessment comment */}
        {feedback.comment && (
          <>
            <Brain
              size={13}
              className="text-blue-400 cursor-default"
              data-tooltip-id={`fb-${id}-comment`}
              data-tooltip-content={feedback.comment}
            />
            <Tooltip id={`fb-${id}-comment`} place="top" className="max-w-[220px] text-xs" />
          </>
        )}

        {/* Briefcase — job requirement */}
        {feedback.context?.jobRequirement && (
          <>
            <Briefcase
              size={13}
              className="text-orange-400 cursor-default"
              data-tooltip-id={`fb-${id}-job`}
              data-tooltip-content={feedback.context.jobRequirement}
            />
            <Tooltip id={`fb-${id}-job`} place="top" className="max-w-[220px] text-xs" />
          </>
        )}

        {/* FileText — resume skill */}
        {feedback.context?.resumeSkill && (
          <>
            <FileText
              size={13}
              className="text-cyan-400 cursor-default"
              data-tooltip-id={`fb-${id}-resume`}
              data-tooltip-content={feedback.context.resumeSkill}
            />
            <Tooltip id={`fb-${id}-resume`} place="top" className="max-w-[220px] text-xs" />
          </>
        )}

        {/* TrendingUp — conversation pattern */}
        {feedback.context?.conversationNote && (
          <>
            <TrendingUp
              size={13}
              className="text-purple-400 cursor-default"
              data-tooltip-id={`fb-${id}-pattern`}
              data-tooltip-content={feedback.context.conversationNote}
            />
            <Tooltip id={`fb-${id}-pattern`} place="top" className="max-w-[220px] text-xs" />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <div className={`h-full flex flex-col bg-white/95 text-gray-900 ${isMaximized ? 'absolute inset-0' : ''}`}>
        {/* Header */}
      <div className="border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Mock Interview</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={isMaximized ? 'Restore window' : 'Maximize window'}
          >
            {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close interview"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {status !== 'idle' && (
        <div className="bg-blue-900/30 border-b border-blue-700 px-4 py-2 text-sm text-blue-200 flex items-center gap-2">
          {status === 'listening' ? (
            <span className="inline-block animate-pulse">● </span>
          ) : (
            <video src={handTimeIcon} autoPlay loop muted playsInline className="h-8 w-8 flex-shrink-0" />
          )}
          {getStatusMessage()}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Setup View */}
        {view === 'setup' && (
          <div className="p-6 space-y-4">
            {/* Header panel */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
              <div className="flex flex-col items-center">
                <video src={determineProjectIcon} autoPlay muted playsInline className="h-32 w-32 flex-shrink-0" />
                <h2 className="text-xl font-semibold text-gray-800 mt-2">Prepare for Your Interview</h2>
                {interviewProviders && (
                  <div className="flex flex-wrap gap-2 mt-3 justify-center">
                    <span data-tooltip-id="mock-badge-llm" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 cursor-default">
                      <Brain size={12} />
                      LLM: {interviewProviders.llm === 'custom' ? 'Local' : interviewProviders.llm === 'openai' ? 'OpenAI' : interviewProviders.llm ? interviewProviders.llm.charAt(0).toUpperCase() + interviewProviders.llm.slice(1) : 'none'}
                    </span>
                    <Tooltip id="mock-badge-llm" content="Language model used for the interviewer" place="bottom" className="max-w-[220px] text-xs !rounded-lg" />
                    <span data-tooltip-id="mock-badge-stt" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200 cursor-default">
                      <Mic size={12} />
                      STT: {interviewProviders.stt === 'custom' || interviewProviders.stt === 'local' ? 'Local' : interviewProviders.stt === 'openai' ? 'OpenAI' : interviewProviders.stt ? interviewProviders.stt.charAt(0).toUpperCase() + interviewProviders.stt.slice(1) : 'none'}
                    </span>
                    <Tooltip id="mock-badge-stt" content="Speech-to-text provider used for transcription" place="bottom" className="max-w-[220px] text-xs !rounded-lg" />
                    <span data-tooltip-id="mock-badge-tts" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default">
                      <Volume2 size={12} />
                      TTS: {interviewProviders.tts === 'local' ? 'Local' : interviewProviders.tts === 'cosyvoice' ? 'CosyVoice' : interviewProviders.tts ? interviewProviders.tts.charAt(0).toUpperCase() + interviewProviders.tts.slice(1) : 'none'}
                    </span>
                    <Tooltip id="mock-badge-tts" content="Text-to-speech provider for the interviewer's voice" place="bottom" className="max-w-[220px] text-xs !rounded-lg" />
                  </div>
                )}
              </div>
            </div>

            {/* Inputs panel */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Resume / CV</label>
                {resume ? (
                  <div className="flex items-center justify-between bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-3 py-2.5 mb-3">
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <FileText size={14} />
                      <span className="truncate max-w-[200px]">{cvName || 'resume'}</span>
                    </div>
                    <button
                      onClick={() => { setResume(''); setCvName('') }}
                      className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer ml-2"
                      title="Clear resume"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLoadCV}
                    className="w-full flex items-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer mb-3"
                  >
                    <FileText size={14} />
                    Load resume file (.txt, .pdf, .docx)
                  </button>
                )}
                <textarea
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  className="w-full h-28 bg-gray-100 border border-gray-200 rounded-lg p-3 text-gray-900 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-400"
                  placeholder="Or paste your resume..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Job Description</label>
                {jobDescription ? (
                  <div className="flex items-center justify-between bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-3 py-2.5 mb-3">
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <FileText size={14} />
                      <span className="truncate max-w-[200px]">{jobDescName || 'job description'}</span>
                    </div>
                    <button
                      onClick={() => { setJobDescription(''); setJobDescName('') }}
                      className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer ml-2"
                      title="Clear job description"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLoadJobDesc}
                    className="w-full flex items-center gap-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer mb-3"
                  >
                    <FileText size={14} />
                    Load job description file
                  </button>
                )}
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full h-28 bg-gray-100 border border-gray-200 rounded-lg p-3 text-gray-900 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-400"
                  placeholder="Or paste the job description..."
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setView('sessions')}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors text-sm text-gray-700 cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={createSession}
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium cursor-pointer"
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
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4 mb-6">
              <div className="flex flex-col items-center mb-4">
                <video src={reachGoalIcon} autoPlay muted playsInline className="h-32 w-32 flex-shrink-0" />
                <h2 className="text-xl font-semibold text-gray-800 mt-2">Interview Sessions</h2>
              </div>
              <div className="flex gap-2 justify-center">
                {sessions.length > 0 && !deleteAllConfirm && (
                  <button
                    onClick={() => setDeleteAllConfirm(true)}
                    className="px-4 py-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-200 rounded-lg transition-colors text-sm cursor-pointer"
                    title="Delete all interview sessions"
                  >
                    Delete All Sessions
                  </button>
                )}
                <button
                  onClick={() => {
                    setJobDescription('')
                    setResume('')
                    setJobDescName('')
                    setCvName('')
                    setError('')
                    setView('setup')
                  }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer"
                >
                  New Interview
                </button>
              </div>
            </div>

            {deleteAllConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700 mb-4">Are you sure you want to delete all sessions? This action cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteAllSessions()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-medium text-white"
                  >
                    Confirm Delete All
                  </button>
                  <button
                    onClick={() => setDeleteAllConfirm(false)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors text-sm text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {sessions.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center flex flex-col items-center gap-4">
                <video src={dataCollectionIcon} autoPlay muted playsInline className="h-32 w-32" />
                <h3 className="text-xl font-semibold text-gray-800">No interview sessions yet</h3>
                <button
                  onClick={() => setView('setup')}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer"
                >
                  Create First Session
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-base">{session.jobTitle}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(session.createdAt).toLocaleDateString()} · {session.totalTurns} turns
                        </p>
                        {session.averageRating !== undefined && (
                          <div className="flex items-center gap-1 mt-1.5">
                            {[1,2,3,4,5].map(n => {
                              const meta = ratingMeta(
                                session.averageRating! >= 4.5 ? 'excellent'
                                : session.averageRating! >= 3.5 ? 'good'
                                : session.averageRating! >= 2.5 ? 'solid'
                                : session.averageRating! >= 1.5 ? 'fair'
                                : 'weak'
                              )
                              return <Star key={n} size={12} className={n <= Math.round(session.averageRating!) ? `fill-current ${meta.color}` : 'text-gray-300'} />
                            })}
                            <span className="text-xs text-gray-400 ml-1">{session.averageRating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      <span
                        className={`ml-3 shrink-0 px-2.5 py-1 text-xs font-medium rounded-full ${
                          session.isComplete
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {session.isComplete ? 'Completed' : 'In Progress'}
                      </span>
                    </div>

                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      {deleteConfirmId === session.sessionId ? (
                        <>
                          <button
                            onClick={() => deleteSession(session.sessionId)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors text-white font-medium"
                          >
                            Confirm Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors text-gray-700"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => loadSessionForReview(session)}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm transition-colors font-medium"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(session.sessionId)}
                            className="px-2 py-1.5 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-lg text-sm transition-colors flex items-center gap-1"
                            title="Delete this session"
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
                        <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 text-gray-900">
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
                                className="flex items-center gap-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors"
                              >
                                <Volume2 size={12} />
                                Play
                              </button>
                            )}
                            {/* Previous turn feedback shown under interviewer message */}
                            {message.feedback && <FeedbackCard feedback={message.feedback} id={`live-int-${idx}`} />}
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
                      {message.feedback && <FeedbackCard feedback={message.feedback} id={`live-usr-${idx}`} />}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Bar */}
            <div className="border-t border-gray-200 p-3 space-y-2">
              <div className="flex items-end gap-2">
                <textarea
                  value={finalTranscript}
                  onChange={(e) => setFinalTranscript(e.target.value)}
                  placeholder="Type a message..."
                  disabled={status !== 'idle' && status !== 'listening'}
                  className="flex-1 bg-gray-100 text-gray-900 rounded-2xl px-4 py-3 text-sm resize-none max-h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 placeholder-gray-400"
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
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors flex items-center gap-1"
                >
                  <Volume2 size={14} />
                  Replay
                </button>
                <button
                  onClick={() => endInterview(true)}
                  disabled={isSummarizing}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded text-sm transition-colors flex items-center gap-1"
                >
                  {isSummarizing ? 'Summarising...' : 'Complete'}
                </button>
                <button
                  onClick={() => endInterview(false)}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Review: {reviewSession.metadata.jobTitle}</h2>

              {reviewSession.summary && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
                  <div className="flex justify-center">
                    <video
                      ref={lineGraphRef}
                      src={lineGraphIcon}
                      muted
                      playsInline
                      className="h-32 w-32"
                    />
                  </div>
                  {/* Average stars */}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => {
                        const avg = reviewSession.summary!.averageRating
                        const meta = ratingMeta(avg >= 4.5 ? 'excellent' : avg >= 3.5 ? 'good' : avg >= 2.5 ? 'solid' : avg >= 1.5 ? 'fair' : 'weak')
                        return <Star key={n} size={14} className={n <= Math.round(avg) ? `fill-current ${meta.color}` : 'text-gray-300'} />
                      })}
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      {reviewSession.summary.averageRating.toFixed(1)} overall
                    </span>
                  </div>
                  {/* Areas of strength */}
                  {reviewSession.summary.areasOfStrength.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Strengths</p>
                      <ul className="space-y-1">
                        {reviewSession.summary.areasOfStrength.map((s, i) => (
                          <li key={i} className="text-sm text-gray-700 flex gap-2">
                            <span className="text-green-500 shrink-0">+</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Areas of improvement */}
                  {reviewSession.summary.areasOfImprovement.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">To Improve</p>
                      <ul className="space-y-1">
                        {reviewSession.summary.areasOfImprovement.map((s, i) => (
                          <li key={i} className="text-sm text-gray-700 flex gap-2">
                            <span className="text-orange-400 shrink-0">↑</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {reviewSession.feedback.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
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
                            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 text-gray-900">
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
                              className="flex items-center gap-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors w-fit"
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
                          {feedback.feedback && <FeedbackCard feedback={feedback.feedback} id={`review-${idx}`} />}
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
            <div className="border-t border-gray-200 p-3 flex justify-center">
              <button
                onClick={() => {
                  setReviewSession(null)
                  setView('sessions')
                }}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
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
