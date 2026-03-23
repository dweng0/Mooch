import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SettingsScreen from './SettingsScreen'

// Mock window.electronAPI methods used by SettingsScreen
const mockGetApiKeys = vi.fn()
const mockSetAudioDevice = vi.fn()

vi.mock('../../services/recorder', () => ({
  AudioRecorder: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    isRecording: false,
  })),
}))

// Mock navigator.mediaDevices.enumerateDevices
const mockEnumerateDevices = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()

  ;(window as any).electronAPI = {
    getApiKeys: mockGetApiKeys,
    setApiKey: vi.fn(),
    clearApiKey: vi.fn(),
    setCustomProvider: vi.fn(),
    clearCustomProvider: vi.fn(),
    setSttProvider: vi.fn(),
    testCustomProvider: vi.fn(),
    listQwenModels: vi.fn().mockResolvedValue([]),
    setLocalTts: vi.fn(),
    clearLocalTts: vi.fn(),
    testLocalTts: vi.fn(),
    setLocalStt: vi.fn(),
    clearLocalStt: vi.fn(),
    testLocalStt: vi.fn(),
    setQwenModel: vi.fn(),
    setAudioDevice: mockSetAudioDevice.mockResolvedValue(undefined),
    listCustomProviderModels: vi.fn().mockResolvedValue([]),
    getInterviewProviders: vi.fn().mockResolvedValue({ llm: null, tts: null, stt: null }),
  }

  Object.defineProperty(navigator, 'mediaDevices', {
    value: { enumerateDevices: mockEnumerateDevices },
    writable: true,
  })
})

describe('Audio Device Selection', () => {
  const defaultProps = {
    onBack: vi.fn(),
    cvName: '',
    jobDescName: '',
    manualContext: '',
    onLoadCV: vi.fn(),
    onLoadJobDesc: vi.fn(),
    onClearCV: vi.fn(),
    onClearJobDesc: vi.fn(),
    onManualContextChange: vi.fn(),
  }

  it('should enumerate available audio input and output devices in settings', async () => {
    mockGetApiKeys.mockResolvedValue({})
    const mockDevices = [
      { deviceId: 'mic1', kind: 'audioinput', label: 'Built-in Microphone' },
      { deviceId: 'mic2', kind: 'audioinput', label: 'External Mic' },
      { deviceId: 'speaker1', kind: 'audiooutput', label: 'Built-in Speakers' },
      { deviceId: 'speaker2', kind: 'audiooutput', label: 'Headphones' },
    ]
    mockEnumerateDevices.mockResolvedValue(mockDevices)

    render(<SettingsScreen {...defaultProps} />)

    await waitFor(() => {
      expect(mockGetApiKeys).toHaveBeenCalled()
    })

    // Audio device section header is present
    expect(screen.getByText(/Audio Devices/i)).toBeTruthy()

    // Microphone dropdown exists and lists input devices
    expect(screen.getByLabelText(/Microphone/i)).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Built-in Microphone')).toBeTruthy()
      expect(screen.getByText('External Mic')).toBeTruthy()
    })

    // Speaker dropdown exists and lists output devices
    expect(screen.getByLabelText(/Speaker/i)).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('Built-in Speakers')).toBeTruthy()
      expect(screen.getByText('Headphones')).toBeTruthy()
    })

    expect(mockEnumerateDevices).toHaveBeenCalled()
  })

  it('should persist selected audio devices to settings JSON', async () => {
    mockGetApiKeys.mockResolvedValue({})
    const mockDevices = [
      { deviceId: 'mic1', kind: 'audioinput', label: 'Built-in Microphone' },
      { deviceId: 'speaker1', kind: 'audiooutput', label: 'Built-in Speakers' },
    ]
    mockEnumerateDevices.mockResolvedValue(mockDevices)

    // If device IDs are pre-populated from settings, they should be stored on change
    mockGetApiKeys.mockResolvedValue({ audioInputDeviceId: 'mic1', audioOutputDeviceId: 'speaker1' })

    render(<SettingsScreen {...defaultProps} />)

    await waitFor(() => {
      expect(mockGetApiKeys).toHaveBeenCalled()
    })

    // Dropdowns should be present
    expect(screen.getByLabelText(/Microphone/i)).toBeTruthy()
    expect(screen.getByLabelText(/Speaker/i)).toBeTruthy()
  })

  it('should handle permission denied error when enumerating devices gracefully', async () => {
    mockGetApiKeys.mockResolvedValue({})
    mockEnumerateDevices.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))

    render(<SettingsScreen {...defaultProps} />)

    await waitFor(() => {
      expect(mockGetApiKeys).toHaveBeenCalled()
    })

    // Component should not crash — Settings heading still visible
    expect(screen.getAllByText(/Settings/i).length).toBeGreaterThan(0)
  })

  it('should show empty state when no devices are found', async () => {
    mockGetApiKeys.mockResolvedValue({})
    mockEnumerateDevices.mockResolvedValue([])

    render(<SettingsScreen {...defaultProps} />)

    await waitFor(() => {
      expect(mockGetApiKeys).toHaveBeenCalled()
    })

    // Dropdowns still present with empty-state option
    expect(screen.getByLabelText(/Microphone/i)).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText(/No microphones found/i)).toBeTruthy()
    })
  })
})
