import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SettingsScreen from './SettingsScreen'

// Feature: audio device selection
// Scenario: enumerate available audio input and output devices in settings

describe('enumerate available audio input and output devices in settings', () => {
  beforeEach(() => {
    // Mock electronAPI
    global.window.electronAPI = {
      getApiKeys: vi.fn().mockResolvedValue({}),
      setApiKey: vi.fn().mockResolvedValue(undefined),
      clearApiKey: vi.fn().mockResolvedValue(undefined),
      setQwenModel: vi.fn().mockResolvedValue(undefined),
      setCustomProvider: vi.fn().mockResolvedValue(undefined),
      clearCustomProvider: vi.fn().mockResolvedValue(undefined),
      setSttProvider: vi.fn().mockResolvedValue(undefined),
      testCustomProvider: vi.fn().mockResolvedValue({ reasoning: true, stt: false }),
    } as any
    
    // Mock navigator.mediaDevices.enumerateDevices
    const mockAudioInputDevice = {
      deviceId: 'audio-input-1',
      kind: 'audioinput' as const,
      label: 'Test Microphone',
      groupId: 'group-1'
    }
    const mockAudioOutputDevice = {
      deviceId: 'audio-output-1', 
      kind: 'audiooutput' as const,
      label: 'Test Speaker',
      groupId: 'group-2'
    }
    
    global.navigator.mediaDevices.enumerateDevices = vi.fn().mockResolvedValue([
      mockAudioInputDevice,
      mockAudioOutputDevice
    ])
  })

  it('should list all available microphone (input) and speaker (output) devices when settings page loads', async () => {
    render(
      <SettingsScreen
        onBack={vi.fn()}
        cvName=""
        jobDescName=""
        manualContext=""
        onLoadCV={vi.fn()}
        onLoadJobDesc={vi.fn()}
        onClearCV={vi.fn()}
        onClearJobDesc={vi.fn()}
        onManualContextChange={vi.fn()}
      />
    )

    // Wait for the component to load and fetch devices
    await waitFor(() => {
      // Check that microphone devices are listed
      expect(screen.getByText('Test Microphone')).toBeDefined()
      
      // Check that speaker devices are listed  
      expect(screen.getByText('Test Speaker')).toBeDefined()
    })
  })

  it('should populate both lists using navigator.mediaDevices.enumerateDevices()', async () => {
    render(
      <SettingsScreen
        onBack={vi.fn()}
        cvName=""
        jobDescName=""
        manualContext=""
        onLoadCV={vi.fn()}
        onLoadJobDesc={vi.fn()}
        onClearCV={vi.fn()}
        onClearJobDesc={vi.fn()}
        onManualContextChange={vi.fn()}
      />
    )

    // Verify that enumerateDevices was called
    expect(navigator.mediaDevices.enumerateDevices).toHaveBeenCalled()
  })
})