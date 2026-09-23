import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useState } from 'react'
import SettingsScreen from './SettingsScreen'

const mockLoadTextFile = vi.fn()
const mockFetchJobUrl = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()

  ;(window as any).electronAPI = {
    getApiKeys: vi.fn().mockResolvedValue({}),
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
    setAudioDevice: vi.fn().mockResolvedValue(undefined),
    listCustomProviderModels: vi.fn().mockResolvedValue([]),
    getInterviewProviders: vi.fn().mockResolvedValue({ llm: null, tts: null, stt: null }),
    loadTextFile: mockLoadTextFile,
    fetchJobUrl: mockFetchJobUrl,
  }

  Object.defineProperty(navigator, 'mediaDevices', {
    value: { enumerateDevices: vi.fn().mockResolvedValue([]) },
    writable: true,
  })
})

/** Holds the context state the way App does, and exposes it for assertions. */
let latest = { cv: '', cvName: '', jobDesc: '', jobDescName: '' }

function Harness() {
  const [cv, setCv] = useState('')
  const [cvName, setCvName] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [jobDescName, setJobDescName] = useState('')
  latest = { cv, cvName, jobDesc, jobDescName }
  return (
    <SettingsScreen
      onBack={vi.fn()}
      cv={cv}
      cvName={cvName}
      jobDesc={jobDesc}
      jobDescName={jobDescName}
      manualContext=""
      onCvChange={(text, name) => { setCv(text); setCvName(name) }}
      onJobDescChange={(text, name) => { setJobDesc(text); setJobDescName(name) }}
      onManualContextChange={vi.fn()}
    />
  )
}

describe('Interview context in settings', () => {
  it('paste resume text in settings', async () => {
    mockLoadTextFile.mockResolvedValue({ name: 'cv.pdf', content: 'CV from file' })
    render(<Harness />)

    // Loading a file still works
    fireEvent.click(screen.getByText(/Load resume file/i))
    await waitFor(() => expect(latest.cv).toBe('CV from file'))
    expect(latest.cvName).toBe('cv.pdf')

    // Clearing it and typing the resume instead
    fireEvent.click(screen.getByTitle('Clear resume'))
    fireEvent.change(screen.getByPlaceholderText(/paste your resume/i), { target: { value: 'Ten years of TypeScript' } })
    expect(latest.cv).toBe('Ten years of TypeScript')
    expect(latest.cvName).toBe('')
  })

  it('paste job description text in settings', async () => {
    mockLoadTextFile.mockResolvedValue({ name: 'jd.txt', content: 'JD from file' })
    render(<Harness />)

    fireEvent.click(screen.getByText(/Load job description file/i))
    await waitFor(() => expect(latest.jobDesc).toBe('JD from file'))
    expect(latest.jobDescName).toBe('jd.txt')

    fireEvent.click(screen.getByTitle('Clear job description'))
    const box = screen.getByPlaceholderText(/paste the job description/i)
    fireEvent.paste(box, { clipboardData: { getData: () => 'Senior engineer, remote' } })
    fireEvent.change(box, { target: { value: 'Senior engineer, remote' } })
    expect(latest.jobDesc).toBe('Senior engineer, remote')
    expect(latest.jobDescName).toBe('')
    expect(mockFetchJobUrl).not.toHaveBeenCalled()
  })

  it('paste a job link in settings to fill the job description', async () => {
    mockFetchJobUrl.mockResolvedValueOnce('Staff Engineer\nAcme · London\n\nBuild things.')
    render(<Harness />)

    const box = screen.getByPlaceholderText(/paste the job description/i)
    fireEvent.paste(box, { clipboardData: { getData: () => 'https://jobs.ashbyhq.com/acme/123' } })

    expect(mockFetchJobUrl).toHaveBeenCalledWith('https://jobs.ashbyhq.com/acme/123')
    await waitFor(() => expect(latest.jobDesc).toBe('Staff Engineer\nAcme · London\n\nBuild things.'))

    // A failed fetch shows the error next to the box
    mockFetchJobUrl.mockRejectedValueOnce(new Error("Error invoking remote method 'fetch-job-url': Error: Could not find a job description on that page"))
    fireEvent.paste(box, { clipboardData: { getData: () => 'https://boards.greenhouse.io/acme/jobs/1' } })
    expect(await screen.findByText('Could not find a job description on that page')).toBeTruthy()
  })
})
