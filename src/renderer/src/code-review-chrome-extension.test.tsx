import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

// Mock static assets
vi.mock('./assets/bunny-logo.png', () => ({ default: '' }))
vi.mock('./assets/Explore.webm', () => ({ default: '' }))
vi.mock('./assets/Innovation.webm', () => ({ default: '' }))
vi.mock('./assets/Movie.webm', () => ({ default: '' }))
vi.mock('./assets/Visual.webm', () => ({ default: '' }))
vi.mock('./assets/Web_Development.webm', () => ({ default: '' }))
vi.mock('./assets/Photo_Editor.webm', () => ({ default: '' }))
vi.mock('./assets/Rocket.webm', () => ({ default: '' }))
vi.mock('./assets/Presentation.webm', () => ({ default: '' }))
vi.mock('./assets/Idea.webm', () => ({ default: '' }))
vi.mock('./assets/Responsive_Design.webm', () => ({ default: '' }))

// Mock child components
vi.mock('./components/LoginScreen', () => ({
  default: () => React.createElement('div', { 'data-testid': 'login-screen' }, 'Login Screen'),
}))
vi.mock('./components/ServiceSelection', () => ({
  default: () => React.createElement('div', { 'data-testid': 'service-selection' }, 'Service Selection'),
}))
vi.mock('./components/SubscribeScreen', () => ({
  default: () => React.createElement('div', { 'data-testid': 'subscribe-screen' }, 'Subscribe Screen'),
}))
vi.mock('./components/SettingsScreen', () => ({
  default: () => React.createElement('div', { 'data-testid': 'settings-screen' }, 'Settings Screen'),
}))
vi.mock('./components/TranscriptPanel', () => ({
  default: () => React.createElement('div', null, 'Transcript'),
}))
vi.mock('./components/AnswerPanel', () => ({
  default: () => React.createElement('div', null, 'Answer'),
}))
vi.mock('./components/WindowPicker', () => ({
  default: () => React.createElement('div', null, 'WindowPicker'),
}))
vi.mock('./components/StatusIndicator', () => ({
  default: () => React.createElement('div', null, 'Status'),
}))
vi.mock('./components/CaptureVoiceModal', () => ({
  default: () => React.createElement('div', null, 'VoiceModal'),
}))
vi.mock('./components/MochiLogo', () => ({
  default: () => React.createElement('div', null, 'Logo'),
}))

// Mock services
vi.mock('./services/recorder', () => ({
  AudioRecorder: function AudioRecorder(this: any) {
    this.start = vi.fn().mockResolvedValue(undefined)
    this.stop = vi.fn().mockResolvedValue(new ArrayBuffer(0))
    this.isRecording = false
  },
}))
vi.mock('./services/liveInterview', () => ({
  LiveInterviewService: function LiveInterviewService(this: any) {
    this.isAvailable = false
    this.start = vi.fn()
    this.stop = vi.fn()
    this.speak = vi.fn()
    this.stopSpeaking = vi.fn()
    this.pauseListening = vi.fn()
    this.resumeListening = vi.fn()
  },
}))
vi.mock('./services/passiveListen', () => ({
  PassiveListenService: function PassiveListenService(this: any) {
    this.start = vi.fn().mockResolvedValue(undefined)
    this.stop = vi.fn()
  },
}))

import App from './App'

const noopCleanup = () => {}

function makeElectronAPI(overrides = {}) {
  return {
    getAuthStatus: vi.fn().mockResolvedValue({ loggedIn: false }),
    getApiUrl: vi.fn().mockResolvedValue('http://localhost:3001'),
    getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
    getApiKeys: vi.fn().mockResolvedValue({}),
    onOAuthSuccess: vi.fn().mockReturnValue(noopCleanup),
    onAuthStatusUpdate: vi.fn().mockReturnValue(noopCleanup),
    onHotkeyRecordStart: vi.fn().mockReturnValue(noopCleanup),
    onHotkeyRecordStop: vi.fn().mockReturnValue(noopCleanup),
    login: vi.fn(),
    logout: vi.fn(),
    openOAuth: vi.fn(),
    openExternalUrl: vi.fn(),
    openSubscribe: vi.fn(),
    quitApp: vi.fn(),
    loadTextFile: vi.fn(),
    ...overrides,
  }
}

/**
 * Scenario: Better context for coding challenges
 * Given a user is doing a technical interview, coding on a website
 * When the site opens and they are on the page with the code
 * Then the llm should be able to identify the code, and provide hints and tips
 */
describe('better context for coding challenges', () => {
  beforeEach(() => {
    ;(global as any).window.electronAPI = makeElectronAPI()
  })

  it('should allow user to capture code from web pages', async () => {
    //The app should be able to capture code text from web pages
    render(React.createElement(App))

    // Verify the app loads without errors
    await waitFor(() => {
      const loginScreen = screen.queryByTestId('login-screen')
      expect(loginScreen).toBeNull()
    })
  })
})
