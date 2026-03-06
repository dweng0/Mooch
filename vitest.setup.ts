import { vi } from 'vitest'
import { Buffer } from 'buffer'

// Make Buffer available globally (for Node.js compatibility in tests)
;(global as any).Buffer = Buffer

// Mock Electron APIs
global.window = global.window || {}

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(),
    enumerateDevices: vi.fn(),
  },
  writable: true,
})

// Mock MediaRecorder with proper function implementation
global.MediaRecorder = function (stream: any, options: any) {
  this.start = vi.fn()
  this.stop = vi.fn()
  this.pause = vi.fn()
  this.resume = vi.fn()
  this.ondataavailable = null
  this.onstop = null
  this.onerror = null
  this.state = 'inactive'
  this.stream = stream
} as any

// Add isTypeSupported static method
;(global.MediaRecorder as any).isTypeSupported = vi.fn(() => true)

// Mock Blob with proper function implementation
global.Blob = function (chunks: any[], options: any) {
  this.size = chunks.reduce((acc: number, chunk: any) => {
    if (chunk instanceof Uint8Array || chunk instanceof ArrayBuffer) {
      return acc + (chunk.byteLength || chunk.length)
    }
    return acc + (chunk.size || 0)
  }, 0)
  this.type = options?.type || ''
  this.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(this.size))
} as any

// Mock electronAPI
;(global as any).electronAPI = {
  getDesktopSourceId: vi.fn(),
  captureScreen: vi.fn(),
  captureWindow: vi.fn(),
  getWindowSources: vi.fn(),
  startAreaSelection: vi.fn(),
  captureScreenArea: vi.fn(),
  transcribeAudio: vi.fn(),
  getAnswer: vi.fn(),
  analyzeCodeSnapshot: vi.fn(),
}
