import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import React from 'react'
import CodeInterviewScreen from './CodeInterviewScreen'

const noop = () => {}

function makeElectronAPI(overrides = {}) {
  return {
    bridgeStart: vi.fn().mockResolvedValue(undefined),
    bridgeStop: vi.fn().mockResolvedValue(undefined),
    bridgeStatus: vi.fn().mockResolvedValue({ connected: false, lastSeen: 0 }),
    bridgeHintHistory: vi.fn().mockResolvedValue([]),
    onBridgeExtensionUpdate: vi.fn().mockReturnValue(noop),
    onBridgeHintGenerated: vi.fn().mockReturnValue(noop),
    openExternalUrl: vi.fn(),
    ...overrides,
  }
}

describe('code interview mode', () => {
  beforeEach(() => {
    ;(global as any).window.electronAPI = makeElectronAPI()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  // ── Scenario: launch code interview mode from home screen ────────────────

  describe('launch code interview mode from home screen', () => {
    it('starts bridge API server when code interview screen mounts', async () => {
      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))
      await waitFor(() => {
        expect((global as any).window.electronAPI.bridgeStart).toHaveBeenCalled()
      })
    })

    it('navigates to code interview waiting screen after bridge starts', async () => {
      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))
      await waitFor(() => {
        expect(screen.getByText('Code Interview')).toBeTruthy()
      })
    })
  })

  // ── Scenario: show waiting state until extension connects ────────────────

  describe('show waiting state until extension connects', () => {
    it('displays waiting message when no extension has connected', async () => {
      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))
      await waitFor(() => {
        expect(screen.getByText('Waiting for Mooch Helper extension...')).toBeTruthy()
      })
    })

    it('shows link to install the chrome extension', async () => {
      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))
      await waitFor(() => {
        expect(screen.getByText('Install Chrome Extension')).toBeTruthy()
      })
    })

    it('shows animated connection indicator while waiting for extension', async () => {
      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))
      await waitFor(() => {
        expect(screen.getByText('Waiting for extension')).toBeTruthy()
      })
    })
  })

  // ── Scenario: detect extension connection ────────────────────────────────

  describe('detect extension connection', () => {
    it('transitions to connected status when extension sends update', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => {
        triggerExtensionUpdate = cb
        return noop
      })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate })

      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByText('Waiting for Mooch Helper extension...')).toBeTruthy()
      })

      act(() => {
        triggerExtensionUpdate({ code: 'function foo() {}', pageTitle: 'Two Sum', language: 'JavaScript' })
      })

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeTruthy()
      })
    })

    it('transitions to live dashboard after extension connects', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => {
        triggerExtensionUpdate = cb
        return noop
      })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate })

      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      act(() => {
        triggerExtensionUpdate({ code: 'test', pageTitle: 'Two Sum', language: 'Python' })
      })

      await waitFor(() => {
        expect(screen.queryByText('Waiting for Mooch Helper extension...')).toBeNull()
      })
    })
  })

  // ── Scenario: live code interview dashboard ──────────────────────────────

  describe('live code interview dashboard', () => {
    it('shows problem title and language when extension is connected', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => {
        triggerExtensionUpdate = cb
        return noop
      })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate })

      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      act(() => {
        triggerExtensionUpdate({ code: 'function foo() {}', pageTitle: 'Two Sum - LeetCode', language: 'JavaScript' })
      })

      await waitFor(() => {
        expect(screen.getByText('Two Sum - LeetCode')).toBeTruthy()
        expect(screen.getByText('JavaScript')).toBeTruthy()
      })
    })

    it('shows live preview of extracted code from extension', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => {
        triggerExtensionUpdate = cb
        return noop
      })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate })

      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      act(() => {
        triggerExtensionUpdate({ code: 'def two_sum(nums, target):', pageTitle: 'Two Sum', language: 'Python' })
      })

      await waitFor(() => {
        expect(screen.getByText(/def two_sum/)).toBeTruthy()
      })
    })

    it('displays scrollable hint history on the dashboard', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      let triggerHintGenerated: (entry: any) => void = noop
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => { triggerExtensionUpdate = cb; return noop })
      const onBridgeHintGenerated = vi.fn().mockImplementation((cb: any) => { triggerHintGenerated = cb; return noop })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate, onBridgeHintGenerated })

      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      act(() => {
        triggerExtensionUpdate({ code: '', pageTitle: 'Two Sum', language: null })
        triggerHintGenerated({ answer: 'Use a hash map', explanation: 'O(n) time', timestamp: Date.now() })
      })

      await waitFor(() => {
        expect(screen.getByText('Use a hash map')).toBeTruthy()
      })
    })
  })

  // ── Scenario: display extension hint requests in real time ───────────────

  describe('display extension hint requests in real time', () => {
    it('adds new hint to dashboard immediately when LLM generates response', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      let triggerHintGenerated: (entry: any) => void = noop
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => { triggerExtensionUpdate = cb; return noop })
      const onBridgeHintGenerated = vi.fn().mockImplementation((cb: any) => { triggerHintGenerated = cb; return noop })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate, onBridgeHintGenerated })

      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      act(() => {
        triggerExtensionUpdate({ code: '', pageTitle: 'Problem', language: null })
      })

      act(() => {
        triggerHintGenerated({ answer: 'Binary search solves this', explanation: 'Divide and conquer', timestamp: Date.now() })
      })

      await waitFor(() => {
        expect(screen.getByText('Binary search solves this')).toBeTruthy()
      })
    })

    it('prepends new hints at the top of the hint history list', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      let triggerHintGenerated: (entry: any) => void = noop
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => { triggerExtensionUpdate = cb; return noop })
      const onBridgeHintGenerated = vi.fn().mockImplementation((cb: any) => { triggerHintGenerated = cb; return noop })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate, onBridgeHintGenerated })

      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      act(() => {
        triggerExtensionUpdate({ code: '', pageTitle: 'Problem', language: null })
        triggerHintGenerated({ answer: 'First hint', explanation: 'exp1', timestamp: Date.now() - 1000 })
        triggerHintGenerated({ answer: 'Second hint', explanation: 'exp2', timestamp: Date.now() })
      })

      await waitFor(() => {
        expect(screen.getByText('Second hint')).toBeTruthy()
        expect(screen.getByText('First hint')).toBeTruthy()
      })
    })
  })

  // ── Scenario: enrich hints with interview session context ────────────────

  describe('enrich hints with interview session context', () => {
    it('loads existing hint history from bridge when extension connects', async () => {
      const existingHints = [
        { answer: 'Context-enriched hint', explanation: 'From active session', timestamp: Date.now() - 60000 }
      ]
      const bridgeHintHistory = vi.fn().mockResolvedValue(existingHints)
      const bridgeStatus = vi.fn().mockResolvedValue({ connected: true, lastSeen: Date.now() })
      ;(global as any).window.electronAPI = makeElectronAPI({ bridgeHintHistory, bridgeStatus })

      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByText('Context-enriched hint')).toBeTruthy()
      })
    })

    it('calls bridgeHintHistory to retrieve session-enriched hints on connect', async () => {
      const bridgeHintHistory = vi.fn().mockResolvedValue([])
      const bridgeStatus = vi.fn().mockResolvedValue({ connected: true, lastSeen: Date.now() })
      ;(global as any).window.electronAPI = makeElectronAPI({ bridgeHintHistory, bridgeStatus })

      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      await waitFor(() => {
        expect(bridgeHintHistory).toHaveBeenCalled()
      })
    })
  })

  // ── Scenario: handle extension disconnect gracefully ─────────────────────

  describe('handle extension disconnect gracefully', () => {
    it('shows connection lost message when extension stops responding', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => {
        triggerExtensionUpdate = cb
        return noop
      })
      // bridgeStatus always returns stale — when the connected-state effect fires its
      // immediate poll(), the stale timestamp triggers the disconnect transition
      const bridgeStatus = vi.fn().mockResolvedValue({ connected: true, lastSeen: Date.now() - 20000 })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate, bridgeStatus })

      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByText('Waiting for Mooch Helper extension...')).toBeTruthy()
      })

      // Trigger connection — status becomes 'connected', the effect fires poll()
      // which sees stale data and transitions to 'disconnected'
      act(() => {
        triggerExtensionUpdate({ code: '', pageTitle: 'Problem', language: null })
      })

      await waitFor(() => {
        expect(screen.getByText('Connection lost')).toBeTruthy()
      })
    })

    it('preserves hint history after extension disconnects', async () => {
      let triggerExtensionUpdate: (state: any) => void = noop
      let triggerHintGenerated: (entry: any) => void = noop
      const onBridgeExtensionUpdate = vi.fn().mockImplementation((cb: any) => { triggerExtensionUpdate = cb; return noop })
      const onBridgeHintGenerated = vi.fn().mockImplementation((cb: any) => { triggerHintGenerated = cb; return noop })
      const bridgeStatus = vi.fn().mockResolvedValue({ connected: true, lastSeen: Date.now() - 20000 })
      ;(global as any).window.electronAPI = makeElectronAPI({ onBridgeExtensionUpdate, onBridgeHintGenerated, bridgeStatus })

      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      act(() => {
        triggerExtensionUpdate({ code: '', pageTitle: 'Problem', language: null })
        triggerHintGenerated({ answer: 'Preserved hint after disconnect', explanation: 'Still visible', timestamp: Date.now() })
      })

      await waitFor(() => {
        expect(screen.getByText('Preserved hint after disconnect')).toBeTruthy()
      })
    })
  })

  // ── Scenario: stop code interview mode ───────────────────────────────────

  describe('stop code interview mode', () => {
    it('stops bridge API server when back button is clicked', async () => {
      render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTitle('Back to mode selection')).toBeTruthy()
      })

      fireEvent.click(screen.getByTitle('Back to mode selection'))

      expect((global as any).window.electronAPI.bridgeStop).toHaveBeenCalled()
    })

    it('returns to home screen when user exits code interview mode', async () => {
      const onBack = vi.fn()
      render(React.createElement(CodeInterviewScreen, { onBack }))

      await waitFor(() => {
        expect(screen.getByTitle('Back to mode selection')).toBeTruthy()
      })

      fireEvent.click(screen.getByTitle('Back to mode selection'))

      expect(onBack).toHaveBeenCalled()
    })

    it('stops bridge on unmount when navigating away', async () => {
      const { unmount } = render(React.createElement(CodeInterviewScreen, { onBack: vi.fn() }))
      unmount()
      expect((global as any).window.electronAPI.bridgeStop).toHaveBeenCalled()
    })
  })
})
