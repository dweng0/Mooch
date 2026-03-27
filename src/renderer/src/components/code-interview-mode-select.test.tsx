import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import CodeInterviewModeSelect from './CodeInterviewModeSelect'

describe('code interview mode select', () => {
  // ── Scenario: code interview sub-menu navigation ─────────────────────────

  describe('code interview sub-menu navigation', () => {
    it('renders both mode buttons', () => {
      render(React.createElement(CodeInterviewModeSelect, {
        onBack: vi.fn(),
        onBrowserBased: vi.fn(),
        onVsCodeBased: vi.fn(),
      }))
      expect(screen.getByText('Browser Based')).toBeTruthy()
      expect(screen.getByText('VS Code Based')).toBeTruthy()
    })

    it('calls onBrowserBased when Browser Based button is clicked', () => {
      const onBrowserBased = vi.fn()
      render(React.createElement(CodeInterviewModeSelect, {
        onBack: vi.fn(),
        onBrowserBased,
        onVsCodeBased: vi.fn(),
      }))
      fireEvent.click(screen.getByText('Browser Based'))
      expect(onBrowserBased).toHaveBeenCalledOnce()
    })

    it('calls onVsCodeBased when VS Code Based button is clicked', () => {
      const onVsCodeBased = vi.fn()
      render(React.createElement(CodeInterviewModeSelect, {
        onBack: vi.fn(),
        onBrowserBased: vi.fn(),
        onVsCodeBased,
      }))
      fireEvent.click(screen.getByText('VS Code Based'))
      expect(onVsCodeBased).toHaveBeenCalledOnce()
    })

    it('calls onBack when back button is clicked', () => {
      const onBack = vi.fn()
      render(React.createElement(CodeInterviewModeSelect, {
        onBack,
        onBrowserBased: vi.fn(),
        onVsCodeBased: vi.fn(),
      }))
      fireEvent.click(screen.getByTitle('Back to mode selection'))
      expect(onBack).toHaveBeenCalledOnce()
    })
  })
})
