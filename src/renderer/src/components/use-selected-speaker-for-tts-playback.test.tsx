import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import userEvent from '@testing-library/user-event'

// Mock the LocalInterviewService
vi.mock('../services/localInterview', () => ({
  LocalInterviewService: class {
    start() {}
    stop() {}
    stopSpeaking() {}
    speak() {}
  },
}))

// Mock window.electronAPI
const mockGetApiKeys = vi.fn()
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
  getApiKeys: mockGetApiKeys,
} as any

// Mock HTMLAudioElement with setSinkId support
const MockHTMLAudioElement = vi.fn(() => {
  return {
    src: '',
    played: false,
    setSinkId: vi.fn().mockResolvedValue(undefined),
    play() {
      this.played = true;
      return Promise.resolve();
    }
  };
});

import MockInterviewScreen from './MockInterviewScreen'

/**
 * Scenario: use selected speaker for TTS playback
 * Test name: use_selected_speaker_for_tts_playback
 * Given the user has selected a specific speaker in settings
 * When TTS audio is played back during interview review or live interview
 * Then the audio should be routed to the selected speaker device
 */
describe('use selected speaker for TTS playback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock the global HTMLAudioElement constructor
    global.HTMLAudioElement = MockHTMLAudioElement as any
    global.window.HTMLAudioElement = MockHTMLAudioElement as any
  })

  it('should route TTS playback to the selected speaker device during interview review', async () => {
    // Setup: User has selected a specific speaker device
    mockGetApiKeys.mockResolvedValue({ 
      audioOutputDeviceId: 'speaker2',
      openaiApiKey: 'test-key' // Ensure LLM is configured
    })
    
    const mockSession = {
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
    ;(global.window.electronAPI.interviewGetAudio as any).mockResolvedValue(new ArrayBuffer(1024))

    render(React.createElement(MockInterviewScreen, { onBack: vi.fn() }))

    // Wait for component to load
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Click Review button
    const reviewButton = screen.getByText('Review')
    await userEvent.click(reviewButton)

    await new Promise((resolve) => setTimeout(resolve, 100))

    // Find and click the "Play Audio" button for user response
    const playAudioButton = screen.getByText(/Play Audio/i)
    await userEvent.click(playAudioButton)

    // Wait for audio to play
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Verify that an HTMLAudioElement was created
    expect(global.HTMLAudioElement).toHaveBeenCalled()
    
    // Get the created audio instance
    const audioInstance = (global.HTMLAudioElement as any).mock.instances[0]
    
    // Verify that setSinkId was called with the selected speaker device ID
    expect(audioInstance.setSinkId).toHaveBeenCalledWith('speaker2')
    
    // Verify that play was called
    expect(audioInstance.played).toBe(true)
  })

  it('should handle case when no speaker is selected (use default output)', async () => {
    // Setup: No speaker selected (empty deviceId)
    mockGetApiKeys.mockResolvedValue({ 
      openaiApiKey: 'test-key'
    })
    
    const mockSession = {
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
    ;(global.window.electronAPI.interviewGetAudio as any).mockResolvedValue(new ArrayBuffer(1024))

    render(React.createElement(MockInterviewScreen, { onBack: vi.fn() }))

    await new Promise((resolve) => setTimeout(resolve, 100))

    const reviewButton = screen.getByText('Review')
    await userEvent.click(reviewButton)

    await new Promise((resolve) => setTimeout(resolve, 100))

    const playAudioButton = screen.getByText(/Play Audio/i)
    await userEvent.click(playAudioButton)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const audioInstance = (global.HTMLAudioElement as any).mock.instances[0]
    
    // setSinkId should not be called when no device is selected
    expect(audioInstance.setSinkId).not.toHaveBeenCalled()
    expect(audioInstance.played).toBe(true)
  })

  it('should gracefully handle setSinkId errors and fall back to default output', async () => {
    // Setup: Mock setSinkId to throw an error
    mockGetApiKeys.mockResolvedValue({ 
      audioOutputDeviceId: 'invalid-speaker',
      openaiApiKey: 'test-key'
    })
    
    // Create a mock Audio function that throws on setSinkId
    const MockAudioWithError = vi.fn(() => {
      return {
        src: '',
        played: false,
        setSinkId: vi.fn().mockRejectedValue(new Error('NotSupportedError')),
        play() {
          this.played = true;
          return Promise.resolve();
        }
      };
    });
    
    global.HTMLAudioElement = MockAudioWithError as any
    global.window.HTMLAudioElement = MockAudioWithError as any

    const mockSession = {
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
    ;(global.window.electronAPI.interviewGetAudio as any).mockResolvedValue(new ArrayBuffer(1024))

    render(React.createElement(MockInterviewScreen, { onBack: vi.fn() }))

    await new Promise((resolve) => setTimeout(resolve, 100))

    const reviewButton = screen.getByText('Review')
    await userEvent.click(reviewButton)

    await new Promise((resolve) => setTimeout(resolve, 100))

    const playAudioButton = screen.getByText(/Play Audio/i)
    await userEvent.click(playAudioButton)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const audioInstance = (global.HTMLAudioElement as any).mock.instances[0]
    
    // setSinkId should be attempted but fail gracefully
    expect(audioInstance.setSinkId).toHaveBeenCalledWith('invalid-speaker')
    expect(audioInstance.played).toBe(true)
  })
})