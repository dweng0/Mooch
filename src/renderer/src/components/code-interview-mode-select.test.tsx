import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import CodeInterviewModeSelect from './CodeInterviewModeSelect'

describe('code interview mode select', () => {
  // ── Scenario: code interview sub-menu navigation ─────────────────────────

  describe('code interview sub-menu navigation', () => {
    it('renders all mode buttons', () => {
      render(React.createElement(CodeInterviewModeSelect, {
        onBack: vi.fn(),
        onBrowserBased: vi.fn(),
        onVsCodeBased: vi.fn(),
        onFreeCode: vi.fn(),
      }))
      expect(screen.getByText('Browser Based')).toBeTruthy()
      expect(screen.getByText('VS Code Based')).toBeTruthy()
      expect(screen.getByText('Free Code')).toBeTruthy()
    })

    it('calls onBrowserBased when Browser Based button is clicked', () => {
      const onBrowserBased = vi.fn()
      render(React.createElement(CodeInterviewModeSelect, {
        onBack: vi.fn(),
        onBrowserBased,
        onVsCodeBased: vi.fn(),
        onFreeCode: vi.fn(),
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
        onFreeCode: vi.fn(),
      }))
      fireEvent.click(screen.getByText('VS Code Based'))
      expect(onVsCodeBased).toHaveBeenCalledOnce()
    })

    it('calls onFreeCode when Free Code button is clicked', () => {
      const onFreeCode = vi.fn()
      render(React.createElement(CodeInterviewModeSelect, {
        onBack: vi.fn(),
        onBrowserBased: vi.fn(),
        onVsCodeBased: vi.fn(),
        onFreeCode,
      }))
      fireEvent.click(screen.getByText('Free Code'))
      expect(onFreeCode).toHaveBeenCalledOnce()
    })

    it('calls onBack when back button is clicked', () => {
      const onBack = vi.fn()
      render(React.createElement(CodeInterviewModeSelect, {
        onBack,
        onBrowserBased: vi.fn(),
        onVsCodeBased: vi.fn(),
        onFreeCode: vi.fn(),
      }))
      fireEvent.click(screen.getByTitle('Back to mode selection'))
      expect(onBack).toHaveBeenCalledOnce()
    })
  })
})
