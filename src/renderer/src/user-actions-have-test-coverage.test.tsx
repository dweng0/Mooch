import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

// Mock ServiceSelection to expose callbacks as clickable buttons
vi.mock('./components/ServiceSelection', () => ({
  default: ({ onSelect, onSettings }: any) =>
    React.createElement('div', { 'data-testid': 'service-selection' },
      React.createElement('button', { 'data-testid': 'select-general', onClick: () => onSelect('general') }, 'General'),
      React.createElement('button', { 'data-testid': 'select-mock', onClick: () => onSelect('mock') }, 'Mock'),
      React.createElement('button', { 'data-testid': 'go-settings', onClick: onSettings }, 'Settings'),
    ),
}))

vi.mock('./components/LoginScreen', () => ({
  default: () => React.createElement('div', { 'data-testid': 'login-screen' }, 'Login Screen'),
}))
vi.mock('./components/SubscribeScreen', () => ({
  default: () => React.createElement('div', { 'data-testid': 'subscribe-screen' }, 'Subscribe Screen'),
}))
vi.mock('./components/SettingsScreen', () => ({
  default: ({ onBack, onLoadCV, onLoadJobDesc }: any) =>
    React.createElement('div', { 'data-testid': 'settings-screen' },
      React.createElement('button', { 'data-testid': 'back-from-settings', onClick: onBack }, 'Back'),
      React.createElement('button', { 'data-testid': 'load-cv', onClick: onLoadCV }, 'Load CV'),
      React.createElement('button', { 'data-testid': 'load-job-desc', onClick: onLoadJobDesc }, 'Load Job Desc'),
    ),
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
    getAuthStatus: vi.fn().mockResolvedValue({ loggedIn: true, isActive: true, availableProviders: ['claude'] }),
    getApiUrl: vi.fn().mockResolvedValue('http://localhost:3001'),
    getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
    getApiKeys: vi.fn().mockResolvedValue({ claude: 'sk-test-key' }),
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
    loadTextFile: vi.fn().mockResolvedValue({ name: 'test.pdf', content: 'Test content' }),
    ...overrides,
  }
}

/**
 * Scenario: user actions have test coverage
 * Given the app is running
 * When the user performs any supported action
 * Then that action should have an automated test covering it
 */
describe('user actions have test coverage', () => {
  beforeEach(() => {
    ;(global as any).window.electronAPI = makeElectronAPI()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should allow user to select general interview mode', async () => {
    render(React.createElement(App))

    await waitFor(() => {
      expect(screen.queryByTestId('service-selection')).not.toBeNull()
    })

    fireEvent.click(screen.getByTestId('select-general'))

    await waitFor(() => {
      expect(screen.queryByTestId('service-selection')).toBeNull()
    })
  })

  it('should allow user to select mock interview mode', async () => {
    render(React.createElement(App))

    await waitFor(() => {
      expect(screen.queryByTestId('service-selection')).not.toBeNull()
    })

    fireEvent.click(screen.getByTestId('select-mock'))

    await waitFor(() => {
      expect(screen.queryByTestId('service-selection')).toBeNull()
    })
  })

  it('should allow user to navigate back to service selection from interview mode', async () => {
    render(React.createElement(App))

    await waitFor(() => {
      expect(screen.queryByTestId('service-selection')).not.toBeNull()
    })

    fireEvent.click(screen.getByTestId('select-general'))

    await waitFor(() => {
      expect(screen.getByTitle('Back to mode selection')).toBeTruthy()
    })

    fireEvent.click(screen.getByTitle('Back to mode selection'))

    await waitFor(() => {
      expect(screen.queryByTestId('service-selection')).not.toBeNull()
    })
  })

  it('should allow user to navigate to settings screen', async () => {
    render(React.createElement(App))

    await waitFor(() => {
      expect(screen.queryByTestId('service-selection')).not.toBeNull()
    })

    fireEvent.click(screen.getByTestId('go-settings'))

    await waitFor(() => {
      expect(screen.queryByTestId('settings-screen')).not.toBeNull()
    })
  })

  it('should allow user to navigate back from settings to service selection', async () => {
    render(React.createElement(App))

    await waitFor(() => {
      expect(screen.queryByTestId('service-selection')).not.toBeNull()
    })

    fireEvent.click(screen.getByTestId('go-settings'))
    await waitFor(() => {
      expect(screen.queryByTestId('settings-screen')).not.toBeNull()
    })

    fireEvent.click(screen.getByTestId('back-from-settings'))
    await waitFor(() => {
      expect(screen.queryByTestId('service-selection')).not.toBeNull()
    })
  })

  it('should allow user to load a CV from settings', async () => {
    const mockLoadTextFile = vi.fn().mockResolvedValue({ name: 'cv.pdf', content: 'My CV' })
    ;(global as any).window.electronAPI = makeElectronAPI({ loadTextFile: mockLoadTextFile })

    render(React.createElement(App))

    await waitFor(() => {
      expect(screen.queryByTestId('service-selection')).not.toBeNull()
    })

    fireEvent.click(screen.getByTestId('go-settings'))
    await waitFor(() => {
      expect(screen.queryByTestId('settings-screen')).not.toBeNull()
    })

    fireEvent.click(screen.getByTestId('load-cv'))

    await waitFor(() => {
      expect(mockLoadTextFile).toHaveBeenCalled()
    })
  })

  it('should allow user to load a job description from settings', async () => {
    const mockLoadTextFile = vi.fn().mockResolvedValue({ name: 'job.pdf', content: 'Job description' })
    ;(global as any).window.electronAPI = makeElectronAPI({ loadTextFile: mockLoadTextFile })

    render(React.createElement(App))

    await waitFor(() => {
      expect(screen.queryByTestId('service-selection')).not.toBeNull()
    })

    fireEvent.click(screen.getByTestId('go-settings'))
    await waitFor(() => {
      expect(screen.queryByTestId('settings-screen')).not.toBeNull()
    })

    fireEvent.click(screen.getByTestId('load-job-desc'))

    await waitFor(() => {
      expect(mockLoadTextFile).toHaveBeenCalled()
    })
  })
})
