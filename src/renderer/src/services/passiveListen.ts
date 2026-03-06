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

  private speechChunks: Blob[] = []
  private initChunk: Blob | null = null  // WebM init segment (first MediaRecorder chunk)
  private isSpeaking = false
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private vadInterval: ReturnType<typeof setInterval> | null = null
  private speechStartTime = 0

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
    if (this.isActive) return
    this.onTranscriptCb = callbacks.onTranscript
    this.onDetectedCb = callbacks.onDetected
    this.onStatusCb = callbacks.onStatus
    this.onErrorCb = callbacks.onError
    this.isActive = true

    try {
      const stream = await this._getStream(callbacks.audioSource ?? 'system')
      this.stream = stream

      // Set up Web Audio analyser for VAD
      this.audioContext = new AudioContext()
      const source = this.audioContext.createMediaStreamSource(stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      source.connect(this.analyser)

      // Start MediaRecorder continuously — chunks arrive every 250 ms
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size === 0) return
        if (!this.initChunk) {
          // First chunk is always the WebM init segment — save it so we can
          // prepend it to every speech blob (without it the file is invalid).
          this.initChunk = e.data
          return
        }
        if (this.isSpeaking) {
          this.speechChunks.push(e.data)
        }
      }
      this.mediaRecorder.start(250)

      this._startVAD()
      callbacks.onStatus('listening')
    } catch (err) {
      this.isActive = false
      this._cleanup()
      callbacks.onError(
        err instanceof Error ? err.message : 'Failed to start passive listen'
      )
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
      return navigator.mediaDevices.getUserMedia({ audio: true })
    }

    const sourceId = await window.electronAPI.getDesktopSourceId()
    if (!sourceId) throw new Error('No screen source available for system audio')

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
    return new MediaStream(fullStream.getAudioTracks())
  }

  private _startVAD(): void {
    if (!this.analyser) return
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    this.vadInterval = setInterval(() => {
      if (!this.isActive || !this.analyser) return

      this.analyser.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length

      if (avg > this.SPEECH_THRESHOLD) {
        if (!this.isSpeaking) {
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
        this.silenceTimer = setTimeout(() => {
          this.silenceTimer = null
          const duration = Date.now() - this.speechStartTime
          if (duration >= this.MIN_SPEECH_MS && this.speechChunks.length > 0) {
            const chunks = [...this.speechChunks]
            this.speechChunks = []
            this.isSpeaking = false
            this._processChunks(chunks)
          } else {
            this.speechChunks = []
            this.isSpeaking = false
          }
        }, this.SILENCE_DELAY_MS)
      }
    }, 100)
  }

  private async _processChunks(chunks: Blob[]): Promise<void> {
    this.onStatusCb?.('processing')
    try {
      const allChunks = this.initChunk ? [this.initChunk, ...chunks] : chunks
      const blob = new Blob(allChunks, { type: 'audio/webm;codecs=opus' })
      if (blob.size < 2000) {
        // Too small to be meaningful speech
        return
      }
      const buffer = await blob.arrayBuffer()
      const text = await window.electronAPI.transcribeAudio(buffer)
      if (text.trim() && this.isActive) {
        this.onTranscriptCb?.(text)
        await this.onDetectedCb?.(text)
      }
    } catch (err) {
      if (this.isActive) {
        this.onErrorCb?.(err instanceof Error ? err.message : 'Transcription failed')
      }
    } finally {
      if (this.isActive) {
        this.onStatusCb?.('listening')
      }
    }
  }

  private _cleanup(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.vadInterval) {
      clearInterval(this.vadInterval)
      this.vadInterval = null
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop() } catch { /* ignore */ }
    }
    this.mediaRecorder = null
    this.speechChunks = []
    this.initChunk = null
    this.isSpeaking = false
    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => { /* ignore */ })
      this.audioContext = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
  }
}
