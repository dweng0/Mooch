import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import React from 'react'
import VsCodeInterviewScreen from './VsCodeInterviewScreen'

const noop = () => {}

function makeElectronAPI(overrides = {}) {
  return {
    bridgeStart: vi.fn().mockResolvedValue(undefined),
    bridgeStop: vi.fn().mockResolvedValue(undefined),
    bridgeStatus: vi.fn().mockResolvedValue({ connected: false, lastSeen: 0, clientType: 'unknown' }),
    bridgeHintHistory: vi.fn().mockResolvedValue([]),
    onBridgeExtensionUpdate: vi.fn().mockReturnValue(noop),
    onBridgeHintGenerated: vi.fn().mockReturnValue(noop),
    openExternalUrl: vi.fn(),
    getAvailableProviders: vi.fn().mockResolvedValue(['claude']),
    ...overrides,
  }
}

describe('vscode interview mode', () => {
  beforeEach(() => {
    ;(global as any).window.electronAPI = makeElectronAPI()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  // ── Scenario: launch VS Code interview mode ───────────────────────────────

  describe('launch VS Code interview mode', () => {
    it('starts bridge API server when VS Code interview screen mounts', async () => {
      render(React.createElement(VsCodeInterviewScreen, { onBack: vi.fn() }))
      await waitFor(() => {
        expect((global as any).window.electronAPI.bridgeStart).toHaveBeenCalled()
      })
    })

    it('shows waiting state for VS Code extension on mount', async () => {
      render(React.createElement(VsCodeInterviewScreen, { onBack: vi.fn() }))
      await waitFor(() => {
        expect(screen.getByText('Waiting for Mooch VS Code extension...')).toBeTruthy()
      })
    })

    it('shows link to install VS Code extension', async () => {
      render(React.createElement(VsCodeInterviewScreen, { onBack: vi.fn() }))
      await waitFor(() => {
        expect(screen.getByText('Install VS Code Extension')).toBeTruthy()
      })
    })
  })

  // ── Scenario: VS Code extension connects to bridge ────────────────────────

  describe('VS Code extension connects to bridge', () => {
    it('transitions to connected status when VS Code extension sends update', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      let bridgeStatusCalled = false
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => {
        triggerExtensionUpdate = cb
        return noop
      })
      const bridgeStatus = vi.fn().mockImplementation(() => {
        bridgeStatusCalled = true
        return { connected: true, lastSeen: Date.now(), clientType: 'vscode-extension' }
      })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate, bridgeStatus })

      render(React.createElement(VsCodeInterviewScreen, { onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByText('Waiting for Mooch VS Code extension...')).toBeTruthy()
      })

      act(() => {
        triggerExtensionUpdate({ clientType: 'vscode-extension', code: 'def solve():', pageTitle: 'problem.py', language: 'Python' })
      })

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeTruthy()
      })
    })

    it('does not connect when a chrome-extension client sends an update', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => {
        triggerExtensionUpdate = cb
        return noop
      })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate })

      render(React.createElement(VsCodeInterviewScreen, { onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByText('Waiting for Mooch VS Code extension...')).toBeTruthy()
      })

      act(() => {
        triggerExtensionUpdate({ clientType: 'chrome-extension', code: 'function foo() {}', pageTitle: 'LeetCode', language: 'JavaScript' })
      })

      // Should still be in waiting state, not connected
      await waitFor(() => {
        expect(screen.getByText('Waiting for Mooch VS Code extension...')).toBeTruthy()
      })
    })

    it('shows file name and language when VS Code extension is connected', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => {
        triggerExtensionUpdate = cb
        return noop
      })
      const bridgeStatus = vi.fn().mockResolvedValue({ connected: true, lastSeen: Date.now(), clientType: 'vscode-extension' })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate, bridgeStatus })

      render(React.createElement(VsCodeInterviewScreen, { onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByText('Waiting for Mooch VS Code extension...')).toBeTruthy()
      })

      act(() => {
        triggerExtensionUpdate({ clientType: 'vscode-extension', code: 'def solve():', pageTitle: 'solution.py', language: 'Python' })
      })

      await waitFor(() => {
        expect(screen.getAllByText('solution.py').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Python').length).toBeGreaterThan(0)
      })
    })
  })
})
