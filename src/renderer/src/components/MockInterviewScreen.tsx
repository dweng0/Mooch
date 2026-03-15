import { useState, useEffect } from 'react'
import { ArrowLeft, Upload, Play, Square, RotateCcw } from 'lucide-react'

interface MockInterviewScreenProps {
  onBack: () => void
}

interface InterviewSession {
  sessionId: string
  createdAt: string
  jobTitle: string
  isComplete: boolean
  totalTurns: number
}

interface InterviewFeedback {
  turn: number
  rating: 'excellent' | 'good' | 'solid' | 'fair' | 'weak'
  comment: string
}

type MockScreenView = 'setup' | 'sessions' | 'interview' | 'review'

export default function MockInterviewScreen({ onBack }: MockInterviewScreenProps) {
  const [view, setView] = useState<MockScreenView>('sessions')
  const [sessions, setSessions] = useState<InterviewSession[]>([])
  const [currentSession, setCurrentSession] = useState<InterviewSession | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [resume, setResume] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentTurn, setCurrentTurn] = useState(0)
  const [currentFeedback, setCurrentFeedback] = useState<InterviewFeedback | null>(null)

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      // In production, this would call the electron API to load sessions from the main process
      // For now, we'll use localStorage as a fallback
      const stored = localStorage.getItem('mock_interview_sessions')
      if (stored) {
        setSessions(JSON.parse(stored))
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
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
      // Create session via electron API (would be implemented in main process)
      const sessionId = new Date().toISOString().replace(/[:.]/g, '-')
      const newSession: InterviewSession = {
        sessionId,
        createdAt: new Date().toISOString(),
        jobTitle: jobDescription.split('\n')[0],
        isComplete: false,
        totalTurns: 0,
      }

      // Update sessions list
      const updated = [newSession, ...sessions]
      setSessions(updated)
      localStorage.setItem('mock_interview_sessions', JSON.stringify(updated))

      // Start interview
      setCurrentSession(newSession)
      setCurrentTurn(0)
      setView('interview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setIsLoading(false)
    }
  }

  const resumeSession = (session: InterviewSession) => {
    setCurrentSession(session)
    setCurrentTurn(session.totalTurns)
    setView('interview')
  }

  const endInterview = async (complete: boolean) => {
    if (!currentSession) return

    try {
      // Update session
      const updated = sessions.map((s) =>
        s.sessionId === currentSession.sessionId
          ? { ...s, isComplete: complete, totalTurns: currentTurn }
          : s
      )
      setSessions(updated)
      localStorage.setItem('mock_interview_sessions', JSON.stringify(updated))

      setView('sessions')
      setCurrentSession(null)
      setCurrentTurn(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session')
    }
  }

  const reviewSession = (session: InterviewSession) => {
    setCurrentSession(session)
    setView('review')
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Setup View: Create New Session */}
        {view === 'setup' && (
          <div className="p-6 max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">Prepare for Your Interview</h2>

            <div className="space-y-4">
              {/* Job Description Input */}
              <div>
                <label className="block text-sm font-medium mb-2">Job Description</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                  placeholder="Paste the job description..."
                />
              </div>

              {/* Resume Input */}
              <div>
                <label className="block text-sm font-medium mb-2">Your Resume</label>
                <textarea
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                  placeholder="Paste your resume..."
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-200">
                  {error}
                </div>
              )}

              {/* Actions */}
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

        {/* Sessions View: List and Manage */}
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
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <Play size={16} />
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
                      {!session.isComplete && (
                        <button
                          onClick={() => resumeSession(session)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors flex items-center gap-1"
                        >
                          <RotateCcw size={14} />
                          Resume
                        </button>
                      )}
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

        {/* Interview View: Live Interview */}
        {view === 'interview' && currentSession && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">{currentSession.jobTitle}</h2>

            <div className="bg-gray-800 rounded-lg p-6 space-y-6">
              {/* Status */}
              <div>
                <p className="text-sm text-gray-400">Turn {currentTurn + 1}</p>
                <p className="text-2xl font-bold text-green-400">Ready to Practice</p>
              </div>

              {/* Current Feedback */}
              {currentFeedback && (
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`font-semibold ${
                      currentFeedback.rating === 'excellent' ? 'text-green-400' :
                      currentFeedback.rating === 'good' ? 'text-green-400' :
                      currentFeedback.rating === 'solid' ? 'text-yellow-400' :
                      'text-orange-400'
                    }`}>
                      {currentFeedback.rating.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-300">{currentFeedback.comment}</p>
                </div>
              )}

              {/* Controls */}
              <div className="flex gap-3">
                <button
                  onClick={() => endInterview(true)}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  Next Question
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
        )}

        {/* Review View: Review Session */}
        {view === 'review' && currentSession && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Review: {currentSession.jobTitle}</h2>

            <div className="bg-gray-800 rounded-lg p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400">Date</p>
                  <p className="font-semibold">{new Date(currentSession.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <p className="font-semibold">{currentSession.isComplete ? '✓ Completed' : 'In Progress'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total Turns</p>
                  <p className="font-semibold">{currentSession.totalTurns}</p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
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
    </div>
  )
}
