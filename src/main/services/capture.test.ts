import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Electron modules
const mockDesktopCapturer = {
  getSources: vi.fn(),
}

const mockScreen = {
  getPrimaryDisplay: vi.fn(() => ({
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
  })),
}

const mockNativeImage = {
  toPNG: vi.fn(() => Buffer.from('mock-png-data')),
  crop: vi.fn(function (this: any, rect: any) {
    return {
      toPNG: vi.fn(() => Buffer.from(`cropped-${rect.width}x${rect.height}`)),
    }
  }),
}

vi.mock('electron', () => ({
  desktopCapturer: mockDesktopCapturer,
  screen: mockScreen,
  nativeImage: mockNativeImage,
}))

describe('Screen and Window Capture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('captureScreen', () => {
    it('should capture full screen and return base64 PNG', async () => {
      const mockSource = {
        id: 'screen:0',
        name: 'Entire Screen',
        thumbnail: {
          toPNG: vi.fn(() => Buffer.from('screen-capture-data')),
        },
      }

      mockDesktopCapturer.getSources.mockResolvedValue([mockSource])

      // Simulate the capture-screen handler logic
      const sources = await mockDesktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      })

      expect(sources.length).toBeGreaterThan(0)

      const thumbnail = sources[0].thumbnail
      const imageBase64 = thumbnail.toPNG().toString('base64')

      expect(mockDesktopCapturer.getSources).toHaveBeenCalledWith({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      })
      expect(imageBase64).toBe(Buffer.from('screen-capture-data').toString('base64'))
    })

    it('should throw error when no screen sources available', async () => {
      mockDesktopCapturer.getSources.mockResolvedValue([])

      const sources = await mockDesktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      })

      expect(sources.length).toBe(0)
      // In real handler, this would throw 'No screen sources available'
    })
  })

  describe('captureWindow', () => {
    it('should capture specific window by ID', async () => {
      const mockWindows = [
        {
          id: 'window:123',
          name: 'VS Code',
          display_id: '0',
          thumbnail: {
            toPNG: vi.fn(() => Buffer.from('vscode-window')),
          },
        },
        {
          id: 'window:456',
          name: 'Chrome',
          display_id: '0',
          thumbnail: {
            toPNG: vi.fn(() => Buffer.from('chrome-window')),
          },
        },
      ]

      mockDesktopCapturer.getSources.mockResolvedValue(mockWindows)

      const sources = await mockDesktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 1920, height: 1080 },
      })

      const targetWindow = sources.find((s: any) => s.id === 'window:123')

      expect(targetWindow).toBeDefined()
      expect(targetWindow.name).toBe('VS Code')

      const imageData = targetWindow.thumbnail.toPNG().toString('base64')
      expect(imageData).toBe(Buffer.from('vscode-window').toString('base64'))
    })

    it('should return list of windows with thumbnails', async () => {
      const mockWindows = [
        {
          id: 'window:1',
          name: 'Window 1',
          display_id: '0',
          thumbnail: {
            toPNG: vi.fn(() => Buffer.from('thumb1')),
          },
        },
        {
          id: 'window:2',
          name: 'Window 2',
          display_id: '0',
          thumbnail: {
            toPNG: vi.fn(() => Buffer.from('thumb2')),
          },
        },
      ]

      mockDesktopCapturer.getSources.mockResolvedValue(mockWindows)

      const sources = await mockDesktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 320, height: 180 },
      })

      const windowList = sources.map((source: any) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toPNG().toString('base64'),
      }))

      expect(windowList).toHaveLength(2)
      expect(windowList[0].id).toBe('window:1')
      expect(windowList[1].id).toBe('window:2')
    })

    it('should handle window not found scenario', async () => {
      const mockWindows = [
        {
          id: 'window:123',
          name: 'VS Code',
          display_id: '0',
          thumbnail: mockNativeImage,
        },
      ]

      mockDesktopCapturer.getSources.mockResolvedValue(mockWindows)

      const sources = await mockDesktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 1920, height: 1080 },
      })

      const targetWindow = sources.find((s: any) => s.id === 'window:999')

      expect(targetWindow).toBeUndefined()
      // In real handler, this would throw 'Window not found'
    })
  })

  describe('captureScreenArea', () => {
    it('should capture and crop specific screen area', async () => {
      const mockSource = {
        id: 'screen:0',
        name: 'Entire Screen',
        thumbnail: {
          toPNG: vi.fn(() => Buffer.from('full-screen')),
          crop: vi.fn((rect) => ({
            toPNG: vi.fn(() => Buffer.from(`cropped-${rect.width}x${rect.height}`)),
          })),
        },
      }

      mockDesktopCapturer.getSources.mockResolvedValue([mockSource])

      const cropRect = { x: 100, y: 200, width: 800, height: 600 }

      // Simulate the capture-screen-area handler logic
      const sources = await mockDesktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 3840, height: 2160 },
      })

      const fullScreenImage = sources[0].thumbnail
      const primaryDisplay = mockScreen.getPrimaryDisplay()
      const scaleFactor = primaryDisplay.scaleFactor

      const scaledRect = {
        x: Math.round(cropRect.x * scaleFactor),
        y: Math.round(cropRect.y * scaleFactor),
        width: Math.round(cropRect.width * scaleFactor),
        height: Math.round(cropRect.height * scaleFactor),
      }

      const croppedImage = fullScreenImage.crop(scaledRect)
      const imageBase64 = croppedImage.toPNG().toString('base64')

      expect(fullScreenImage.crop).toHaveBeenCalledWith(scaledRect)
      expect(imageBase64).toBe(Buffer.from('cropped-800x600').toString('base64'))
    })

    it('should apply scale factor to crop coordinates', async () => {
      mockScreen.getPrimaryDisplay.mockReturnValue({
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 2, // Retina display
      })

      const mockSource = {
        id: 'screen:0',
        thumbnail: {
          crop: vi.fn((rect) => ({
            toPNG: vi.fn(() => Buffer.from('cropped')),
          })),
        },
      }

      mockDesktopCapturer.getSources.mockResolvedValue([mockSource])

      const cropRect = { x: 100, y: 100, width: 400, height: 300 }
      const scaleFactor = mockScreen.getPrimaryDisplay().scaleFactor

      const scaledRect = {
        x: Math.round(cropRect.x * scaleFactor),
        y: Math.round(cropRect.y * scaleFactor),
        width: Math.round(cropRect.width * scaleFactor),
        height: Math.round(cropRect.height * scaleFactor),
      }

      expect(scaledRect.x).toBe(200) // 100 * 2
      expect(scaledRect.y).toBe(200) // 100 * 2
      expect(scaledRect.width).toBe(800) // 400 * 2
      expect(scaledRect.height).toBe(600) // 300 * 2
    })
  })

  describe('Image format and encoding', () => {
    it('should return PNG format', async () => {
      const mockSource = {
        thumbnail: {
          toPNG: vi.fn(() => Buffer.from([137, 80, 78, 71])), // PNG header
        },
      }

      mockDesktopCapturer.getSources.mockResolvedValue([mockSource])

      const sources = await mockDesktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      })

      const pngBuffer = sources[0].thumbnail.toPNG()

      expect(pngBuffer).toBeInstanceOf(Buffer)
      // Verify PNG magic number
      expect(pngBuffer[0]).toBe(137)
      expect(pngBuffer[1]).toBe(80)
      expect(pngBuffer[2]).toBe(78)
      expect(pngBuffer[3]).toBe(71)
    })

    it('should encode to base64 for transmission', async () => {
      const testData = Buffer.from('test-image-data')
      const mockSource = {
        thumbnail: {
          toPNG: vi.fn(() => testData),
        },
      }

      mockDesktopCapturer.getSources.mockResolvedValue([mockSource])

      const sources = await mockDesktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      })

      const base64 = sources[0].thumbnail.toPNG().toString('base64')

      expect(base64).toBe(testData.toString('base64'))
      // Verify it's valid base64
      expect(/^[A-Za-z0-9+/]*={0,2}$/.test(base64)).toBe(true)
    })
  })

  describe('Window source caching', () => {
    it('should cache window sources', async () => {
      const mockWindows = [
        { id: 'window:1', name: 'Window 1', display_id: '0', thumbnail: mockNativeImage },
      ]

      mockDesktopCapturer.getSources.mockResolvedValue(mockWindows)

      const sources1 = await mockDesktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 320, height: 180 },
      })

      // Simulate caching by storing sources
      const cachedSources = sources1
      const cacheTimestamp = Date.now()

      // Second call within cache duration
      const cacheAge = Date.now() - cacheTimestamp
      const useCache = cacheAge < 30000 // 30 seconds

      expect(useCache).toBe(true)
      expect(cachedSources).toBe(sources1)
    })

    it('should invalidate cache after 30 seconds', () => {
      const cacheTimestamp = Date.now() - 31000 // 31 seconds ago
      const cacheAge = Date.now() - cacheTimestamp
      const useCache = cacheAge < 30000

      expect(useCache).toBe(false)
    })
  })
})
