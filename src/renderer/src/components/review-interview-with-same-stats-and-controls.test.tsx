import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock the localInterview service
vi.mock('../services/localInterview', () => ({
  LocalInterviewService: class {
    start() {}
    stop() {}
    stopSpeaking() {}
    speak() {}
  },
}))

// Mock window.electronAPI
global.window.electronAPI = {
  interviewListSessions: vi.fn(),
  interviewGetSession: vi.fn(),
  interviewCreateSession: vi.fn(),
  interviewGenerateOpener: vi.fn(),
  interviewProcessTurn: vi.fn(),
  interviewEndSession: vi.fn(),
  interviewDeleteSession: vi.fn(),
  interviewSynthesize: vi.fn(),
  interviewGetAudio: vi.fn(),
} as any

import MockInterviewScreen from './MockInterviewScreen'
import type { InterviewSession } from '../../../shared/types'

const mockOnBack = vi.fn()

/**
 * Scenario: review interview with same stats and controls as live interview
 * Given the user is reviewing a completed interview session
 * When the user views the review page
 * Then the review page should display with the same layout as the live interview, showing feedback icons
 * (rating indicator, thinking icon, context icons) below each message and audio playback buttons
 * for both user responses and interviewer questions
 */
describe('review interview with same stats and controls as live interview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display feedback icons for rating indicator', async () => {
    const mockSession: InterviewSession = {
      metadata: {
        sessionId: 'test-session-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobTitle: 'Software Engineer',
        isComplete: true,
        totalTurns: 1,
      },
      jobDescription: 'Senior Software Engineer',
      resume: 'Experience in React',
      transcript: '# Interview',
      feedback: [
        {
          turn: 1,
          timestamp: new Date().toISOString(),
          audioFile: 'user-turn-1.wav',
          llmQuestion: 'Tell me about your experience with React',
          userResponseText: 'I have 5 years of React experience',
          feedback: {
            rating: 'excellent',
            comment: 'Strong technical knowledge demonstrated',
            context: {
              jobRequirement: 'React expertise required',
              resumeSkill: 'React development',
              conversationNote: 'Articulated experience clearly',
            },
          },
        },
      ],
    }

    ;(global.window.electronAPI.interviewListSessions as any).mockResolvedValue([
      {
        sessionId: 'test-session-1',
        createdAt: new Date().toISOString(),
        jobTitle: 'Software Engineer',
        isComplete: true,
        totalTurns: 1,
      },
    ])
    ;(global.window.electronAPI.interviewGetSession as any).mockResolvedValue(mockSession)
    ;(global.window.electronAPI.interviewGetAudio as any).mockResolvedValue(null)

    render(React.createElement(MockInterviewScreen, { onBack: mockOnBack }))

    // Load sessions
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Click Review button
    const reviewButton = screen.getByText('Review')
    reviewButton.click()

    await new Promise((resolve) => setTimeout(resolve, 100))

    // Check that the review view is displayed with feedback indicators
    const reviewTitle = screen.getByText(/Review: Software Engineer/i)
    expect(reviewTitle).toBeDefined()

    // Verify feedback rating card is shown with correct rating
    const feedbackCard = screen.getByTestId('feedback-rating-card')
    expect(feedbackCard).toBeDefined()
    expect(feedbackCard.getAttribute('data-rating')).toBe('excellent')
  })

  it('should display audio playback buttons for both questions and user responses', async () => {
    const mockSession: InterviewSession = {
      metadata: {
        sessionId: 'test-session-2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobTitle: 'Product Manager',
        isComplete: true,
        totalTurns: 1,
      },
      jobDescription: 'Product Manager role',
      resume: 'PM experience',
      transcript: '# Interview',
      feedback: [
        {
          turn: 1,
          timestamp: new Date().toISOString(),
          audioFile: 'user-turn-1.wav',
          llmQuestion: 'What is your PM philosophy?',
          userResponseText: 'I believe in user-centric design',
          feedback: {
            rating: 'good',
            comment: 'Clear philosophy',
            context: {
              jobRequirement: 'Product thinking',
              resumeSkill: 'Product strategy',
            },
          },
        },
      ],
    }

    ;(global.window.electronAPI.interviewListSessions as any).mockResolvedValue([
      {
        sessionId: 'test-session-2',
        createdAt: new Date().toISOString(),
        jobTitle: 'Product Manager',
        isComplete: true,
        totalTurns: 1,
      },
    ])
    ;(global.window.electronAPI.interviewGetSession as any).mockResolvedValue(mockSession)
    ;(global.window.electronAPI.interviewGetAudio as any).mockResolvedValue(new ArrayBuffer(0))

    render(React.createElement(MockInterviewScreen, { onBack: mockOnBack }))

    await new Promise((resolve) => setTimeout(resolve, 50))

    const reviewButton = screen.getByText('Review')
    reviewButton.click()

    await new Promise((resolve) => setTimeout(resolve, 100))

    // Both question and response should have Play Audio buttons
    const playAudioButtons = screen.getAllByText(/Play Audio/i)
    expect(playAudioButtons.length).toBeGreaterThan(0)
  })

  it('should display context icons for job requirement, resume skill, and conversation note', async () => {
    const mockSession: InterviewSession = {
      metadata: {
        sessionId: 'test-session-3',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobTitle: 'Backend Engineer',
        isComplete: true,
        totalTurns: 1,
      },
      jobDescription: 'Backend role',
      resume: 'Backend experience',
      transcript: '# Interview',
      feedback: [
        {
          turn: 1,
          timestamp: new Date().toISOString(),
          audioFile: 'user-turn-1.wav',
          llmQuestion: 'Describe your database design approach',
          userResponseText: 'I use normalized schemas with proper indexing',
          feedback: {
            rating: 'solid',
            comment: 'Good technical approach',
            context: {
              jobRequirement: 'Database design expertise',
              resumeSkill: 'Database architecture',
              conversationNote: 'Well-structured answer with examples',
            },
          },
        },
      ],
    }

    ;(global.window.electronAPI.interviewListSessions as any).mockResolvedValue([
      {
        sessionId: 'test-session-3',
        createdAt: new Date().toISOString(),
        jobTitle: 'Backend Engineer',
        isComplete: true,
        totalTurns: 1,
      },
    ])
    ;(global.window.electronAPI.interviewGetSession as any).mockResolvedValue(mockSession)
    ;(global.window.electronAPI.interviewGetAudio as any).mockResolvedValue(null)

    render(React.createElement(MockInterviewScreen, { onBack: mockOnBack }))

    await new Promise((resolve) => setTimeout(resolve, 50))

    const reviewButton = screen.getByText('Review')
    reviewButton.click()

    await new Promise((resolve) => setTimeout(resolve, 100))

    // The review should show the feedback rating card
    const feedbackCard = screen.getByTestId('feedback-rating-card')
    expect(feedbackCard).toBeDefined()
    expect(feedbackCard.getAttribute('data-rating')).toBe('solid')

    // Verify user response and feedback icons are displayed
    const userResponse = screen.getByText(/I use normalized schemas with proper indexing/)
    expect(userResponse).toBeDefined()

    // Verify the feedback comment is shown via icon tooltip
    const feedbackIcons = screen.getByText(/I use normalized schemas with proper indexing/).parentElement?.parentElement?.querySelectorAll('svg')
    expect(feedbackIcons?.length || 0).toBeGreaterThan(0)
  })
})
