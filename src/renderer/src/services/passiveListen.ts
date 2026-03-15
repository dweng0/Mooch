type OnTranscriptCb = (text: string) => void
type OnDetectedCb = (text: string) => Promise<void>
type OnStatusCb = (status: 'listening' | 'processing') => void
type OnErrorCb = (error: string) => void

/**
 * PassiveListenService — continuously monitors audio for speech,
 * transcribes each detected utterance, and fires onDetected so the caller
 * can fetch an AI answer. Supports both microphone and system audio sources.
 *
 * Flow:
 *   start audio stream (mic or system)
 *   → AudioContext analyser for VAD (volume threshold)
 *   → MediaRecorder (always running, 250 ms timeslice)
 *   → collect chunks while speaking
 *   → silence for SILENCE_DELAY_MS → process segment
 *   → transcribe → onDetected(text)
 */
export class PassiveListenService {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private isActive = false
  private isStarting = false

  private speechChunks: Blob[] = []
  private initChunk: Blob | null = null  // WebM init segment (first MediaRecorder chunk)
  private isSpeaking = false
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private vadInterval: ReturnType<typeof setInterval> | null = null
  private speechStartTime = 0
  private processingSegment = false

  // Tunable constants
  private readonly SILENCE_DELAY_MS = 1500
  private readonly SPEECH_THRESHOLD = 10   // 0-255 average frequency magnitude
  private readonly MIN_SPEECH_MS = 800     // ignore segments shorter than this

  private onTranscriptCb: OnTranscriptCb | null = null
  private onDetectedCb: OnDetectedCb | null = null
  private onStatusCb: OnStatusCb | null = null
  private onErrorCb: OnErrorCb | null = null

  get isRunning(): boolean {
    return this.isActive
  }

  async start(callbacks: {
    onTranscript: OnTranscriptCb
    onDetected: OnDetectedCb
    onStatus: OnStatusCb
    onError: OnErrorCb
    audioSource?: 'microphone' | 'system'
  }): Promise<void> {
    console.log('[PassiveListen] ===== START CALLED =====')
    console.log('[PassiveListen] isActive:', this.isActive, 'isStarting:', this.isStarting)

    if (this.isActive) {
      console.log('[PassiveListen] Already active, returning')
      return
    }
    if (this.isStarting) {
      console.warn('[PassiveListen] Start already in progress, ignoring duplicate call')
      return
    }

    this.isStarting = true
    this.onTranscriptCb = callbacks.onTranscript
    this.onDetectedCb = callbacks.onDetected
    this.onStatusCb = callbacks.onStatus
    this.onErrorCb = callbacks.onError

    try {
      const audioSource = callbacks.audioSource ?? 'system'
      console.log('[PassiveListen] Audio source:', audioSource)

      const stream = await this._getStream(audioSource)
      this.stream = stream
      console.log('[PassiveListen] Stream obtained, tracks:', stream.getTracks().length)

      // Set up Web Audio analyser for VAD
      this.audioContext = new AudioContext()
      const source = this.audioContext.createMediaStreamSource(stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      source.connect(this.analyser)
      console.log('[PassiveListen] Audio context and analyser configured')

      // Start MediaRecorder continuously — chunks arrive every 250 ms
      // Check what mime types are supported
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ]
      let selectedMimeType = 'audio/webm;codecs=opus'
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          console.log('[PassiveListen] Using supported mime type:', mimeType)
          break
        }
      }

      console.log('[PassiveListen] Creating MediaRecorder with mimeType:', selectedMimeType)
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType
      })

      this.mediaRecorder.ondataavailable = (e) => {
        try {
          if (e.data.size === 0) {
            console.log('[PassiveListen] Empty data chunk, skipping')
            return
          }
          if (!this.initChunk) {
            // First chunk is always the init segment — save it so we can
            // prepend it to every speech blob (without it the file is invalid).
            this.initChunk = e.data
            console.log('[PassiveListen] Captured init chunk:', this.initChunk.size, 'bytes')
            return
          }
          if (this.isSpeaking) {
            this.speechChunks.push(e.data)
            console.log(`[PassiveListen] Added speech chunk: ${e.data.size} bytes (total chunks: ${this.speechChunks.length})`)
          }
        } catch (err) {
          console.error('[PassiveListen] Error in ondataavailable:', err)
        }
      }

      this.mediaRecorder.onerror = (e) => {
        console.error('[PassiveListen] MediaRecorder error:', e.error)
        if (this.isActive) {
          this.onErrorCb?.(`MediaRecorder error: ${e.error}`)
          // Stop on error to prevent repeated error events
          this.stop()
        }
      }

      this.mediaRecorder.start(250)
      console.log('[PassiveListen] MediaRecorder started with 250ms timeslice')

      this.isActive = true
      this._startVAD()
      callbacks.onStatus('listening')
    } catch (err) {
      console.error('[PassiveListen] Failed to start:', err)
      this.isActive = false
      this._cleanup()
      callbacks.onError(
        err instanceof Error ? err.message : 'Failed to start passive listen'
      )
    } finally {
      this.isStarting = false
    }
  }

  stop(): void {
    this.isActive = false
    this._cleanup()
    this.onTranscriptCb = null
    this.onDetectedCb = null
    this.onStatusCb = null
    this.onErrorCb = null
  }

  private async _getStream(audioSource: 'microphone' | 'system'): Promise<MediaStream> {
    if (audioSource === 'microphone') {
      try {
        console.log('[PassiveListen] ===== MICROPHONE REQUEST START =====')
        console.log('[PassiveListen] Requesting microphone with simple constraints')

        // Use simple constraints - no echo cancellation, no noise suppression
        // These can cause issues in some systems
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true
        })

        console.log('[PassiveListen] ===== MICROPHONE STREAM OBTAINED =====')
        console.log('[PassiveListen] Stream active:', stream.active)
        console.log('[PassiveListen] Audio tracks:', stream.getAudioTracks().length)

        stream.getAudioTracks().forEach((track, idx) => {
          console.log(`[PassiveListen] Track ${idx}: ${track.label || 'unnamed'}, enabled=${track.enabled}, state=${track.readyState}`)
        })

        return stream
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        const errName = (err as any)?.name
        console.error('[PassiveListen] ===== MICROPHONE ERROR =====')
        console.error('[PassiveListen] Error name:', errName)
        console.error('[PassiveListen] Error message:', errMsg)
        console.error('[PassiveListen] Full error:', err)
        throw new Error(`Microphone: ${errName || 'Unknown'} - ${errMsg}`)
      }
    }

    try {
      console.log('[PassiveListen] Getting desktop source for system audio...')
      const sourceId = await window.electronAPI.getDesktopSourceId()
      if (!sourceId) throw new Error('No screen source available for system audio')

      console.log('[PassiveListen] Got desktop source, requesting media...')
      const fullStream = await navigator.mediaDevices.getUserMedia({
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

      fullStream.getVideoTracks().forEach((t) => t.stop())
      const audioStream = new MediaStream(fullStream.getAudioTracks())
      console.log('[PassiveListen] System audio stream obtained')
      return audioStream
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[PassiveListen] System audio access failed:', errMsg)
      throw new Error(`System audio access failed: ${errMsg}`)
    }
  }

  private _startVAD(): void {
    if (!this.analyser) return
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    this.vadInterval = setInterval(() => {
      try {
        if (!this.isActive || !this.analyser) {
          // Service stopped, clear interval will happen in cleanup
          return
        }

        this.analyser!.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length

        if (avg > this.SPEECH_THRESHOLD) {
          if (!this.isSpeaking) {
            console.log('[PassiveListen] Speech detected, starting recording')
            this.isSpeaking = true
            this.speechStartTime = Date.now()
            this.speechChunks = []
          }
          // Reset silence countdown on every active frame
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer)
            this.silenceTimer = null
          }
        } else if (this.isSpeaking && !this.silenceTimer) {
          // Start silence countdown
          console.log('[PassiveListen] Silence detected, starting countdown...')
          this.silenceTimer = setTimeout(() => {
            this.silenceTimer = null
            const duration = Date.now() - this.speechStartTime
            console.log(`[PassiveListen] Silence timeout - duration: ${duration}ms, chunks: ${this.speechChunks.length}`)
            if (duration >= this.MIN_SPEECH_MS && this.speechChunks.length > 0) {
              const chunks = [...this.speechChunks]
              this.speechChunks = []
              this.isSpeaking = false
              console.log('[PassiveListen] Processing speech segment...')
              this._processChunks(chunks)
            } else {
              this.speechChunks = []
              this.isSpeaking = false
              console.log('[PassiveListen] Segment too short, discarding')
            }
          }, this.SILENCE_DELAY_MS)
        }
      } catch (err) {
        console.error('[PassiveListen] VAD error:', err)
      }
    }, 100)
  }

  private async _processChunks(chunks: Blob[]): Promise<void> {
    // Prevent concurrent segment processing which could cause stream issues
    if (this.processingSegment) {
      console.log('[PassiveListen] Already processing a segment, skipping')
      return
    }

    this.processingSegment = true
    this.onStatusCb?.('processing')
    try {
      const allChunks = this.initChunk ? [this.initChunk, ...chunks] : chunks
      const blob = new Blob(allChunks, { type: 'audio/webm;codecs=opus' })

      console.log(`[PassiveListen] Processing ${chunks.length} chunks`)
      console.log(`[PassiveListen] Init chunk: ${this.initChunk?.size || 0} bytes`)
      console.log(`[PassiveListen] Total blob size: ${blob.size} bytes`)
      chunks.forEach((c, i) => {
        console.log(`[PassiveListen] Chunk ${i}: ${c.size} bytes`)
      })

      if (blob.size < 2000) {
        // Too small to be meaningful speech
        console.log(`[PassiveListen] Blob too small (${blob.size} < 2000), skipping`)
        return
      }

      const buffer = await blob.arrayBuffer()
      console.log(`[PassiveListen] Converted to ArrayBuffer: ${buffer.byteLength} bytes`)

      // Log first 16 bytes to verify WebM header
      const headerView = new Uint8Array(buffer, 0, 16)
      console.log(`[PassiveListen] First 16 bytes: ${Array.from(headerView).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)

      console.log('[PassiveListen] Calling transcribeAudio...')
      const text = await window.electronAPI.transcribeAudio(buffer)
      console.log('[PassiveListen] Transcription returned:', text)

      if (text.trim() && this.isActive) {
        this.onTranscriptCb?.(text)
        await this.onDetectedCb?.(text)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Transcription failed'
      console.error('[PassiveListen] Processing error:', errMsg)
      if (this.isActive) {
        this.onErrorCb?.(errMsg)
      }
    } finally {
      this.processingSegment = false
      if (this.isActive) {
        this.onStatusCb?.('listening')
      }
    }
  }

  private _cleanup(): void {
    console.log('[PassiveListen] Cleaning up resources...')

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.vadInterval) {
      clearInterval(this.vadInterval)
      this.vadInterval = null
    }

    // Stop MediaRecorder
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop()
          console.log('[PassiveListen] MediaRecorder stopped')
        } catch (err) {
          console.warn('[PassiveListen] Error stopping MediaRecorder:', err)
        }
      }
      this.mediaRecorder = null
    }

    this.speechChunks = []
    this.initChunk = null
    this.isSpeaking = false
    this.processingSegment = false

    // Disconnect analyser
    if (this.analyser) {
      try {
        this.analyser.disconnect()
      } catch (err) {
        console.warn('[PassiveListen] Error disconnecting analyser:', err)
      }
      this.analyser = null
    }

    // Close audio context
    if (this.audioContext) {
      try {
        this.audioContext.close()
        console.log('[PassiveListen] AudioContext closed')
      } catch (err) {
        console.warn('[PassiveListen] Error closing AudioContext:', err)
      }
      this.audioContext = null
    }

    // Stop all tracks
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => {
          console.log(`[PassiveListen] Stopping track: ${track.kind}`)
          track.stop()
        })
      } catch (err) {
        console.warn('[PassiveListen] Error stopping tracks:', err)
      }
      this.stream = null
    }

    console.log('[PassiveListen] Cleanup complete')
  }
}
