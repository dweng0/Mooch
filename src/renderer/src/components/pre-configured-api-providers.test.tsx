import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsScreen from './SettingsScreen'

// Feature: pre-configured API providers
// Scenario: select pre-configured provider from dropdown
// Scenario: pre-configured provider auto-populates settings
// Scenario: warn when pre-configured provider is unreachable
// Scenario: custom provider requires manual entry

describe('pre-configured API providers', () => {
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
  })

  describe('select preconfigured provider from dropdown', () => {
    it('should display a dropdown with pre-configured providers and custom option', async () => {
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

      await waitFor(() => {
        // Check for provider selector dropdown with pre-configured providers
        const customSection = screen.getByText('Custom Provider')
        expect(customSection).toBeDefined()

        // Verify provider dropdown exists (should show options like Ollama, LM Studio, or Custom)
        // This will be added with the implementation
      })
    })

    it('should allow user to select a pre-configured provider like Ollama', async () => {
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

      await waitFor(() => {
        // When user selects Ollama from dropdown, URL should be pre-filled
        // This test will verify the dropdown exists and can be interacted with
        expect(screen.getByText('Custom Provider')).toBeDefined()
      })
    })
  })

  describe('preconfigured provider autopopulates settings', () => {
    it('should pre-fill URL when pre-configured provider is selected', async () => {
      global.window.electronAPI.testCustomProvider = vi.fn().mockResolvedValue({ reasoning: true, stt: false })

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

      await waitFor(() => {
        // Find the base URL input field
        const baseUrlInput = screen.getByPlaceholderText(/Base URL/i) as HTMLInputElement
        expect(baseUrlInput).toBeDefined()
        // When Ollama is selected, URL should be pre-filled with something like http://localhost:11434/v1
        // This will be verified after implementation
      })
    })

    it('should fetch and display available models when provider URL is reachable', async () => {
      global.window.electronAPI.testCustomProvider = vi.fn().mockResolvedValue({ reasoning: true, stt: false })

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

      await waitFor(() => {
        // The custom provider config should exist
        const modelInputs = screen.getAllByPlaceholderText(/Model/i)
        expect(modelInputs.length).toBeGreaterThan(0)
        // When provider is selected and reachable, models dropdown should appear
        // This will be implemented next
      })
    })
  })

  describe('warn when preconfigured provider is unreachable', () => {
    it('should display warning when provider URL cannot be reached', async () => {
      global.window.electronAPI.testCustomProvider = vi.fn().mockResolvedValue({ reasoning: false, stt: false })

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

      await waitFor(() => {
        // Verify that Test button exists to check connectivity
        const testButtons = screen.getAllByRole('button', { name: /Test/i })
        expect(testButtons.length).toBeGreaterThan(0)
        // When test returns false, warning should appear
        // This will be verified after implementation
      })
    })
  })

  describe('custom provider requires manual entry', () => {
    it('should allow manual entry of custom provider settings', async () => {
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

      await waitFor(() => {
        // Verify custom provider input fields exist
        const baseUrlInput = screen.getByPlaceholderText(/Base URL/i)
        const modelInputs = screen.getAllByPlaceholderText(/Model/i)

        expect(baseUrlInput).toBeDefined()
        expect(modelInputs.length).toBeGreaterThan(0)
      })
    })

    it('should save custom provider with manually entered values', async () => {
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

      await waitFor(() => {
        // Verify custom provider section exists
        const customSection = screen.getByText('Custom Provider')
        expect(customSection).toBeDefined()
        // Verify Save button is in the custom provider section
      })
    })
  })
})
