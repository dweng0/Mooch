import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import * as http from 'http'

// Mock dependencies before importing the module
vi.mock('./ai-provider', () => ({
  getAvailableProviders: vi.fn(() => ['claude']),
  getAnswer: vi.fn(async () => 'mock answer'),
}))

vi.mock('./api-keys', () => ({
  loadApiKeys: vi.fn(() => ({
    anthropicApiKey: 'sk-test',
  })),
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '0.1.0' },
}))

import { LocalBridgeApi } from './local-bridge-api'
import { getAvailableProviders } from './ai-provider'

function request(
  method: string,
  path: string,
  body?: object,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Mooch-Client': 'chrome-extension',
      ...extraHeaders,
    }
    // Remove headers with empty values so they are truly absent
    for (const key of Object.keys(headers)) {
      if (headers[key] === '') delete headers[key]
    }

    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: 62544,
      path,
      method,
      headers,
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode!, body: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode!, body: data })
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

describe('Local Bridge API', () => {
  let api: LocalBridgeApi

  beforeAll(async () => {
    api = new LocalBridgeApi()
    await api.start()
  })

  afterAll(async () => {
    await api.stop()
  })

  beforeEach(() => {
    // Reset mocks and session state between tests
    vi.mocked(getAvailableProviders).mockReturnValue(['claude'])
    api.setActiveSession(null)
  })

  // Scenario: expose local HTTP API for extension communication
  describe('expose local HTTP API for extension communication', () => {
    it('should start a local HTTP server bound to 127.0.0.1 on port 62544', async () => {
      const res = await request('GET', '/health')
      expect(res.status).toBe(200)
    })

    it('should expose a GET /health endpoint that returns status, version, activeSession', async () => {
      const res = await request('GET', '/health')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('status', 'ok')
      expect(res.body).toHaveProperty('version')
      expect(res.body).toHaveProperty('activeSession')
    })
  })

  // Scenario: accept hint requests from chrome extension
  describe('accept hint requests from chrome extension', () => {
    it('should accept POST /api/hint and return a hint', async () => {
      const res = await request('POST', '/api/hint', {
        code: 'function add(a, b) { return a + b; }',
        pageTitle: 'LeetCode - Two Sum',
        language: 'javascript',
        hintStyle: 'gentle',
      })
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('hint')
      expect(typeof res.body.hint).toBe('string')
    })

    it('should return 503 when no provider is configured', async () => {
      vi.mocked(getAvailableProviders).mockReturnValueOnce([])

      const res = await request('POST', '/api/hint', {
        code: 'x = 1',
        pageTitle: 'Test',
      })
      expect(res.status).toBe(503)
      expect(res.body).toHaveProperty('error')
    })
  })

  // Scenario: expose provider configuration via API
  describe('expose provider configuration via API', () => {
    it('should return provider list without secrets', async () => {
      const res = await request('GET', '/api/providers')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('providers')
      expect(Array.isArray(res.body.providers)).toBe(true)
      expect(res.body.providers.length).toBeGreaterThan(0)
      const provider = res.body.providers[0]
      expect(provider).toHaveProperty('name')
      expect(provider).toHaveProperty('type')
      expect(provider).toHaveProperty('configured')
      // Must not expose secrets
      expect(JSON.stringify(res.body)).not.toContain('sk-test')
    })
  })

  // Scenario: accept code analysis requests from chrome extension
  describe('accept code analysis requests from chrome extension', () => {
    it('should accept POST /api/analyze and return analysis', async () => {
      const res = await request('POST', '/api/analyze', {
        code: 'for (int i = 0; i < n; i++) { sum += arr[i]; }',
        context: 'array traversal',
      })
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('analysis')
      expect(typeof res.body.analysis).toBe('string')
    })

    it('should return 503 when no provider is configured', async () => {
      vi.mocked(getAvailableProviders).mockReturnValueOnce([])

      const res = await request('POST', '/api/analyze', {
        code: 'x = 1',
      })
      expect(res.status).toBe(503)
      expect(res.body).toHaveProperty('error')
    })
  })

  // Scenario: include active interview context in hint requests
  describe('include active interview context in hint requests', () => {
    it('should reflect activeSession in /health when interview is active', async () => {
      api.setActiveSession('session-123')
      const res = await request('GET', '/health')
      expect(res.body.activeSession).toBe('session-123')
    })

    it('should show null activeSession when no interview is active', async () => {
      const res = await request('GET', '/health')
      expect(res.body.activeSession).toBeNull()
    })
  })

  // Scenario: restrict local API to localhost only
  describe('restrict local API to localhost only', () => {
    it('should reject requests without X-Mooch-Client header', async () => {
      const res = await request('GET', '/health', undefined, {
        'X-Mooch-Client': '', // empty = will be removed, so header is absent
      })
      expect(res.status).toBe(403)
    })

    it('should accept requests with valid X-Mooch-Client header', async () => {
      const res = await request('GET', '/health')
      expect(res.status).toBe(200)
    })
  })
})
