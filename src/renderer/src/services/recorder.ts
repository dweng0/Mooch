import type { AudioSource } from '../../../shared/types'

/** Manages audio recording from microphone or system audio sources using the MediaRecorder API. */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []

  /**
   * Starts recording audio from the specified source.
   * @param source - The audio source to record from ('microphone' or 'system').
   * @param inputDeviceId - Optional preferred microphone device ID; falls back to OS default.
   * @returns A promise that resolves when recording has started.
   */
  async start(source: AudioSource, inputDeviceId?: string): Promise<void> {
    console.log(`[AudioRecorder] start() called with source: "${source}", deviceId: "${inputDeviceId ?? 'default'}"`)
    console.log(`[AudioRecorder] About to call ${source === 'microphone' ? 'getMicStream' : 'getSystemAudioStream'}`)
    const stream =
      source === 'microphone' ? await this.getMicStream(inputDeviceId) : await this.getSystemAudioStream()

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

  /**
   * Stops the current recording and returns the captured audio data.
   * @returns A promise that resolves with the recorded audio as an ArrayBuffer.
   */
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

  /** Whether the recorder is currently capturing audio. */
  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  /**
   * Requests microphone access and returns the audio stream.
   * @returns A promise that resolves with the microphone MediaStream.
   */
  private async getMicStream(deviceId?: string): Promise<MediaStream> {
    console.log('[AudioRecorder] getMicStream() - Requesting microphone access via getUserMedia (no screen access needed)')
    console.log('[AudioRecorder] Checking navigator.mediaDevices availability:', {
      mediaDevices: !!navigator.mediaDevices,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    })

    const tryGetStream = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('[AudioRecorder] ✓ Microphone stream obtained successfully!', {
        id: stream.id,
        active: stream.active,
        trackCount: stream.getTracks().length
      })
      return stream
    }

    try {
      const audioConstraint = deviceId
        ? { deviceId: { exact: deviceId } }
        : true
      console.log('[AudioRecorder] Calling getUserMedia with constraint:', audioConstraint)
      try {
        return await tryGetStream({ audio: audioConstraint })
      } catch (deviceErr) {
        if (deviceId) {
          // Preferred device unavailable — fall back to OS default
          console.warn('[AudioRecorder] Preferred device unavailable, falling back to default mic:', deviceErr)
          return await tryGetStream({ audio: true })
        }
        throw deviceErr
      }
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

  /**
   * Captures system audio via Electron's desktop capturer.
   * @returns A promise that resolves with an audio-only MediaStream from the desktop source.
   */
  private async getSystemAudioStream(): Promise<MediaStream> {
    console.log('[AudioRecorder] getSystemAudioStream() called - this will request screen access!')
    try {
      const sourceId = await window.electronAPI.getDesktopSourceId()
      console.log('[AudioRecorder] Got desktop source ID for system audio')
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
