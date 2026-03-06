import type { AudioSource } from '../../../shared/types'

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []

  async start(source: AudioSource): Promise<void> {
    console.log(`[AudioRecorder] start() called with source: "${source}"`)
    const stream =
      source === 'microphone' ? await this.getMicStream() : await this.getSystemAudioStream()

    console.log('[AudioRecorder] Stream obtained:', {
      id: stream.id,
      active: stream.active,
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length
    })

    // Log details about audio tracks
    stream.getAudioTracks().forEach((track, index) => {
      console.log(`[AudioRecorder] Audio track ${index}:`, {
        id: track.id,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings()
      })
    })

    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    })
    this.chunks = []

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data)
        console.log(`[AudioRecorder] Data chunk received: ${e.data.size} bytes`)
      }
    }

    this.mediaRecorder.start()
    console.log('[AudioRecorder] MediaRecorder started')
  }

  stop(): Promise<ArrayBuffer> {
    console.log('[AudioRecorder] stop() called')
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        console.error('[AudioRecorder] Cannot stop - not recording')
        reject(new Error('Not recording'))
        return
      }

      this.mediaRecorder.onstop = async () => {
        console.log(`[AudioRecorder] MediaRecorder stopped - collected ${this.chunks.length} chunks`)
        const blob = new Blob(this.chunks, { type: 'audio/webm;codecs=opus' })
        const buffer = await blob.arrayBuffer()
        console.log(`[AudioRecorder] Created audio blob: ${blob.size} bytes, buffer: ${buffer.byteLength} bytes`)

        this.mediaRecorder?.stream.getTracks().forEach((t) => {
          console.log(`[AudioRecorder] Stopping track: ${t.kind} - ${t.label}`)
          t.stop()
        })
        this.mediaRecorder = null
        this.chunks = []

        resolve(buffer)
      }

      this.mediaRecorder.stop()
      console.log('[AudioRecorder] MediaRecorder.stop() triggered')
    })
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  private async getMicStream(): Promise<MediaStream> {
    console.log('[AudioRecorder] getMicStream() - Requesting microphone access via getUserMedia')
    console.log('[AudioRecorder] Checking navigator.mediaDevices availability:', {
      mediaDevices: !!navigator.mediaDevices,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    })

    try {
      console.log('[AudioRecorder] Calling navigator.mediaDevices.getUserMedia({ audio: true })')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('[AudioRecorder] ✓ Microphone stream obtained successfully!', {
        id: stream.id,
        active: stream.active,
        trackCount: stream.getTracks().length
      })
      return stream
    } catch (err) {
      console.error('[AudioRecorder] ✗ Failed to get microphone stream:', err)
      if (err instanceof DOMException) {
        console.error('[AudioRecorder] DOMException details:', {
          name: err.name,
          message: err.message,
          code: err.code
        })
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error('Microphone permission denied. Please allow microphone access in your system settings.')
        }
        if (err.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.')
        }
      }
      throw new Error('Failed to access microphone: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  private async getSystemAudioStream(): Promise<MediaStream> {
    try {
      const sourceId = await window.electronAPI.getDesktopSourceId()
      if (!sourceId) {
        throw new Error('No screen source available for system audio capture')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          }
        } as any,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 1,
            maxWidth: 1,
            minHeight: 1,
            maxHeight: 1
          }
        } as any
      })

      // We only need audio — drop the video tracks
      stream.getVideoTracks().forEach((t) => t.stop())
      return new MediaStream(stream.getAudioTracks())
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error('System audio permission denied. Please allow screen recording access in your system settings.')
        }
      }
      // Pass through error message if it's already user-friendly (from IPC handler)
      throw err instanceof Error ? err : new Error('Failed to capture system audio: ' + String(err))
    }
  }
}
