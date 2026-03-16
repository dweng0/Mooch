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
global.window = {
  ...global.window,
  electronAPI: {
    interviewListSessions: vi.fn(),
    interviewGetSession: vi.fn(),
    interviewCreateSession: vi.fn(),
    interviewGenerateOpener: vi.fn(),
    interviewProcessTurn: vi.fn(),
    interviewEndSession: vi.fn(),
    interviewDeleteSession: vi.fn(),
    interviewDeleteAllSessions: vi.fn(),
    interviewSynthesize: vi.fn(),
    interviewGetAudio: vi.fn(),
  },
}

import MockInterviewScreen from './MockInterviewScreen'
import type { InterviewSessionMetadata } from '../../../shared/types'

const mockOnBack = vi.fn()

/**
 * Scenario: delete all interview sessions
 * Given the user is on the mock interview sessions page
 * When the user clicks "Delete All Sessions"
 * Then the app should display a confirmation dialog
 * And when the user confirms the deletion
 * Then all interview sessions should be deleted and the sessions list should be empty
 */
describe('delete all interview sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display delete all sessions button when sessions exist', async () => {
    const mockSessions: InterviewSessionMetadata[] = [
      {
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobTitle: 'Software Engineer',
        isComplete: true,
        totalTurns: 1,
      },
      {
        sessionId: 'session-2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobTitle: 'Product Manager',
        isComplete: false,
        totalTurns: 2,
      },
    ]

    ;(global.window.electronAPI.interviewListSessions as any).mockResolvedValue(mockSessions)

    render(React.createElement(MockInterviewScreen, { onBack: mockOnBack }))

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Check that Delete All Sessions button is visible
    const deleteAllButton = screen.getByText('Delete All Sessions')
    expect(deleteAllButton).toBeDefined()
  })

  it('should show confirmation dialog when delete all sessions is clicked', async () => {
    const mockSessions: InterviewSessionMetadata[] = [
      {
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobTitle: 'Software Engineer',
        isComplete: true,
        totalTurns: 1,
      },
    ]

    ;(global.window.electronAPI.interviewListSessions as any).mockResolvedValue(mockSessions)

    render(React.createElement(MockInterviewScreen, { onBack: mockOnBack }))

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Click Delete All Sessions button
    const deleteAllButton = screen.getByText('Delete All Sessions')
    deleteAllButton.click()

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Check that confirmation message appears
    const confirmMessage = screen.getByText(/delete all sessions/i)
    expect(confirmMessage).toBeDefined()
  })

  it('should delete all sessions when confirmed', async () => {
    const mockSessions: InterviewSessionMetadata[] = [
      {
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobTitle: 'Software Engineer',
        isComplete: true,
        totalTurns: 1,
      },
      {
        sessionId: 'session-2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobTitle: 'Product Manager',
        isComplete: false,
        totalTurns: 2,
      },
    ]

    ;(global.window.electronAPI.interviewListSessions as any)
      .mockResolvedValueOnce(mockSessions) // Initial load
      .mockResolvedValueOnce([]) // After deletion
    ;(global.window.electronAPI.interviewDeleteAllSessions as any).mockResolvedValue(undefined)

    render(React.createElement(MockInterviewScreen, { onBack: mockOnBack }))

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Click Delete All Sessions button
    const deleteAllButton = screen.getByText('Delete All Sessions')
    deleteAllButton.click()

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Click Confirm Delete All button
    const confirmButton = screen.getByText('Confirm Delete All')
    confirmButton.click()

    await new Promise((resolve) => setTimeout(resolve, 100))

    // Verify deleteAllSessions was called
    expect(global.window.electronAPI.interviewDeleteAllSessions).toHaveBeenCalled()

    // After deletion, list should show "No interview sessions yet"
    const noSessionsMessage = screen.getByText('No interview sessions yet')
    expect(noSessionsMessage).toBeDefined()
  })

  it('should not delete sessions when confirmation is cancelled', async () => {
    const mockSessions: InterviewSessionMetadata[] = [
      {
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        jobTitle: 'Software Engineer',
        isComplete: true,
        totalTurns: 1,
      },
    ]

    ;(global.window.electronAPI.interviewListSessions as any).mockResolvedValue(mockSessions)

    render(React.createElement(MockInterviewScreen, { onBack: mockOnBack }))

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Click Delete All Sessions button
    const deleteAllButton = screen.getByText('Delete All Sessions')
    deleteAllButton.click()

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Click Cancel button
    const cancelButton = screen.getByText('Cancel')
    cancelButton.click()

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Verify deleteAllSessions was NOT called
    expect(global.window.electronAPI.interviewDeleteAllSessions).not.toHaveBeenCalled()

    // Session should still be visible
    const sessionText = screen.getByText('Software Engineer')
    expect(sessionText).toBeDefined()
  })

  it('should not show delete all button when no sessions exist', async () => {
    ;(global.window.electronAPI.interviewListSessions as any).mockResolvedValue([])

    render(React.createElement(MockInterviewScreen, { onBack: mockOnBack }))

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Delete All Sessions button should not be visible
    const deleteAllButton = screen.queryByText('Delete All Sessions')
    expect(deleteAllButton).toBeNull()
  })
})
