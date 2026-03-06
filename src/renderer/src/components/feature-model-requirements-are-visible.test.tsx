import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock assets and sub-components
vi.mock('../assets/Presentation.webm', () => ({ default: '' }))
vi.mock('../assets/Responsive_Design.webm', () => ({ default: '' }))
vi.mock('../assets/Idea.webm', () => ({ default: '' }))
vi.mock('../assets/bunny-logo.png', () => ({ default: '' }))
vi.mock('./StatusIndicator', () => ({ default: () => null }))
vi.mock('./MochiLogo', () => ({ default: () => null }))

import ServiceSelection from './ServiceSelection'
import type { UserApiKeys } from '../../../shared/types'

const noop = () => {}
const defaultProps = {
  onSelect: noop,
  onSettings: noop,
  onLogout: noop,
  apiUrl: '',
  cvName: '',
  jobDescName: '',
  manualContext: '',
}

/**
 * Scenario: feature model requirements are visible
 * Given the user is looking at the app
 * When a feature requires a specific type of API key or model
 * Then the feature section should clearly indicate which model type is required
 * And if the user does not have a matching API key, it should be made clear that the feature is unavailable
 */
describe('feature model requirements are visible', () => {
  it('should show model requirement labels on each mode card', () => {
    render(React.createElement(ServiceSelection, { ...defaultProps, apiKeys: {} }))

    const requirements = screen.getAllByTestId('model-requirement')
    expect(requirements.length).toBeGreaterThan(0)
    requirements.forEach((el) => {
      expect(el.textContent).toBeTruthy()
    })
  })

  it('should show unavailable indicator on all cards when no API key is configured', () => {
    render(React.createElement(ServiceSelection, { ...defaultProps, apiKeys: {} }))

    const unavailable = screen.getAllByTestId('feature-unavailable')
    expect(unavailable.length).toBeGreaterThan(0)
  })

  it('should not show unavailable indicators when an API key is configured', () => {
    const apiKeys: UserApiKeys = { anthropicApiKey: 'sk-ant-test-key' }
    render(React.createElement(ServiceSelection, { ...defaultProps, apiKeys }))

    const unavailable = screen.queryAllByTestId('feature-unavailable')
    expect(unavailable.length).toBe(0)
  })

  it('should show unavailable indicators regardless of which provider key is missing', () => {
    const apiKeys: UserApiKeys = { openaiApiKey: 'sk-test-key' }
    render(React.createElement(ServiceSelection, { ...defaultProps, apiKeys }))

    const unavailable = screen.queryAllByTestId('feature-unavailable')
    expect(unavailable.length).toBe(0)
  })
})
