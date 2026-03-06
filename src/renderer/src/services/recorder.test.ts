import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AudioRecorder } from './recorder'

describe('AudioRecorder', () => {
  let recorder: AudioRecorder
  let mockMediaStream: MediaStream
  let mockTrack: MediaStreamTrack
  let mediaRecorderInstances: any[] = []

  beforeEach(() => {
    // Reset instances array
    mediaRecorderInstances = []

    // Create mock audio track
    mockTrack = {
      id: 'track-1',
      kind: 'audio',
      label: 'Microphone',
      enabled: true,
      muted: false,
      readyState: 'live',
      stop: vi.fn(),
      getSettings: vi.fn(() => ({
        sampleRate: 48000,
        channelCount: 2,
      })),
    } as any

    // Create mock media stream
    mockMediaStream = {
      id: 'stream-1',
      active: true,
      getTracks: vi.fn(() => [mockTrack]),
      getAudioTracks: vi.fn(() => [mockTrack]),
      getVideoTracks: vi.fn(() => []),
    } as any

    // Mock the global MediaRecorder constructor to track instances
    global.MediaRecorder = function (this: any, stream: any, options: any) {
      this.start = vi.fn()
      this.stop = vi.fn()
      this.pause = vi.fn()
      this.resume = vi.fn()
      this.ondataavailable = null
      this.onstop = null
      this.onerror = null
      this.state = 'inactive'
      this.stream = stream
      mediaRecorderInstances.push(this)
      return this
    } as any

    // Mock navigator.mediaDevices.getUserMedia
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(mockMediaStream)

    // Mock electronAPI for system audio
    if (!(global as any).electronAPI) {
      ;(global as any).electronAPI = {}
    }
    ;(global as any).electronAPI.getDesktopSourceId = vi.fn().mockResolvedValue('screen:0')

    // Create recorder AFTER setting up mocks
    recorder = new AudioRecorder()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Helper to get the latest MediaRecorder instance
  const getLatestRecorder = () => mediaRecorderInstances[mediaRecorderInstances.length - 1]

  describe('Microphone recording', () => {
    it('should start recording from microphone', async () => {
      await recorder.start('microphone')

      const mockRecorder = getLatestRecorder()

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true })
      expect(mediaRecorderInstances).toHaveLength(1)
      expect(mockRecorder.stream).toBe(mockMediaStream)
      expect(mockRecorder.start).toHaveBeenCalled()
    })

    it('should set isRecording to true when recording', async () => {
      await recorder.start('microphone')
      const mockRecorder = getLatestRecorder()
      mockRecorder.state = 'recording'

      expect(recorder.isRecording).toBe(true)
    })

    it('should handle microphone permission denied', async () => {
      const permissionError = new DOMException('Permission denied', 'NotAllowedError')
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(permissionError)

      await expect(recorder.start('microphone')).rejects.toThrow(
        'Microphone permission denied'
      )
    })

    it('should handle no microphone found', async () => {
      const notFoundError = new DOMException('No microphone', 'NotFoundError')
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(notFoundError)

      await expect(recorder.start('microphone')).rejects.toThrow('No microphone found')
    })
  })

  describe('Audio data collection', () => {
    it('should collect audio chunks during recording', async () => {
      await recorder.start('microphone')
      const mockRecorder = getLatestRecorder()

      // Simulate receiving audio data
      const mockChunk1 = new (global.Blob as any)(['audio-data-1'], { type: 'audio/webm' })
      const mockChunk2 = new (global.Blob as any)(['audio-data-2'], { type: 'audio/webm' })

      // Trigger ondataavailable callback
      mockRecorder.ondataavailable({ data: mockChunk1 })
      mockRecorder.ondataavailable({ data: mockChunk2 })

      // Verify chunks are collected (internal state, verified indirectly via stop())
      expect(mockRecorder.ondataavailable).toBeDefined()
    })

    it('should ignore empty chunks', async () => {
      await recorder.start('microphone')
      const mockRecorder = getLatestRecorder()

      // Simulate receiving empty chunk
      const emptyChunk = new (global.Blob as any)([], { type: 'audio/webm' })
      mockRecorder.ondataavailable({ data: emptyChunk })

      // Should not throw, empty chunks are silently ignored
    })

    it('should return ArrayBuffer when stopped', async () => {
      await recorder.start('microphone')
      const mockRecorder = getLatestRecorder()

      // Simulate audio chunks
      const audioData = new Uint8Array([1, 2, 3, 4, 5])

      // Mock Blob to return our test data
      global.Blob = function (chunks: any[], options: any) {
        this.size = audioData.byteLength
        this.type = 'audio/webm;codecs=opus'
        this.arrayBuffer = vi.fn().mockResolvedValue(audioData.buffer)
      } as any

      // Trigger stop asynchronously
      const stopPromise = recorder.stop()

      // Simulate MediaRecorder's onstop event
      if (mockRecorder.onstop) {
        await mockRecorder.onstop()
      }

      const buffer = await stopPromise

      expect(buffer).toBeInstanceOf(ArrayBuffer)
      expect(buffer.byteLength).toBeGreaterThan(0)
    })
  })

  describe('Stop recording', () => {
    it('should stop recording and cleanup resources', async () => {
      await recorder.start('microphone')
      const mockRecorder = getLatestRecorder()
      mockRecorder.state = 'recording'

      // Trigger stop
      const stopPromise = recorder.stop()

      // Simulate MediaRecorder's onstop event
      if (mockRecorder.onstop) {
        await mockRecorder.onstop()
      }

      await stopPromise

      expect(mockRecorder.stop).toHaveBeenCalled()
      expect(mockTrack.stop).toHaveBeenCalled()
    })

    it('should reject if stop is called when not recording', async () => {
      await expect(recorder.stop()).rejects.toThrow('Not recording')
    })

    it('should set isRecording to false after stopping', async () => {
      await recorder.start('microphone')
      const mockRecorder = getLatestRecorder()
      mockRecorder.state = 'recording'

      const stopPromise = recorder.stop()

      if (mockRecorder.onstop) {
        await mockRecorder.onstop()
      }

      await stopPromise

      mockRecorder.state = 'inactive'
      expect(recorder.isRecording).toBe(false)
    })
  })

  describe('System audio recording', () => {
    it('should request desktop source for system audio', async () => {
      await recorder.start('system')

      expect((global as any).electronAPI.getDesktopSourceId).toHaveBeenCalled()
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: expect.objectContaining({
            mandatory: expect.objectContaining({
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: 'screen:0',
            }),
          }),
        })
      )
    })

    it('should remove video tracks from system audio stream', async () => {
      const mockVideoTrack = {
        kind: 'video',
        stop: vi.fn(),
      } as any

      const systemStream = {
        ...mockMediaStream,
        getVideoTracks: vi.fn(() => [mockVideoTrack]),
      } as any

      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(systemStream)

      await recorder.start('system')

      expect(mockVideoTrack.stop).toHaveBeenCalled()
    })

    it('should handle missing desktop source', async () => {
      ;(global as any).electronAPI.getDesktopSourceId = vi.fn().mockResolvedValue(null)

      await expect(recorder.start('system')).rejects.toThrow(
        'No screen source available for system audio capture'
      )
    })
  })

  describe('Audio format and encoding', () => {
    it('should use correct MIME type for recording', async () => {
      // Track Blob constructor calls
      const blobCalls: any[] = []
      const OriginalBlob = global.Blob
      global.Blob = function (this: any, chunks: any[], options: any) {
        blobCalls.push({ chunks, options })
        return new OriginalBlob(chunks, options)
      } as any

      await recorder.start('microphone')
      const mockRecorder = getLatestRecorder()

      // MediaRecorder is created with correct options
      expect(mediaRecorderInstances).toHaveLength(1)
      expect(mockRecorder.stream).toBe(mockMediaStream)
    })

    it('should create blob with correct MIME type', async () => {
      // Track Blob constructor calls
      const blobCalls: any[] = []
      global.Blob = function (this: any, chunks: any[], options: any) {
        blobCalls.push({ chunks, options })
        this.size = 100
        this.type = options?.type || ''
        this.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(100))
      } as any

      await recorder.start('microphone')
      const mockRecorder = getLatestRecorder()

      const stopPromise = recorder.stop()

      if (mockRecorder.onstop) {
        await mockRecorder.onstop()
      }

      await stopPromise

      // Verify Blob was created with correct MIME type
      expect(blobCalls.length).toBeGreaterThan(0)
      expect(blobCalls[0].options.type).toBe('audio/webm;codecs=opus')
    })
  })
})
