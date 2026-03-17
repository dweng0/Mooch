import { AudioRecorder } from './recorder'
import { PassiveListenService } from './passiveListen'
import type { AudioSource } from '../../../shared/types'

type OnInterimCallback = (text: string) => void
type OnFinalCallback = (text: string) => void

type ListeningMode = 'active' | 'passive'

/**
 * LocalInterviewService - Records audio locally and transcribes without relying on
 * the broken Web Speech API in Electron.
 *
 * Supports two modes:
 * - 'active': Manual recording with explicit start/stop button
 * - 'passive': Continuous listening, auto-detects speech and transcribes
 *
 * This avoids the "chunked_data_pipe_upload_data_stream" errors by not trying to
 * upload to Google's speech recognition servers.
 */
export class LocalInterviewService {
  private recorder: AudioRecorder | null = null
  private passiveService: PassiveListenService | null = null
  private isActive = false
  private mode: ListeningMode = 'active'
  private onInterimCb: OnInterimCallback | null = null
  private onFinalCb: OnFinalCallback | null = null
  private lastAudioBuffer: ArrayBuffer | null = null

  start(
    onInterim: OnInterimCallback,
    onFinal: OnFinalCallback,
    options: { audioSource?: AudioSource; mode?: ListeningMode } = {}
  ): void {
    if (this.isActive) return

    const audioSource = options.audioSource ?? 'microphone'
    const mode = options.mode ?? 'active'

    console.log('[LocalInterview] Starting in', mode, 'mode with source:', audioSource)
    this.onInterimCb = onInterim
    this.onFinalCb = onFinal
    this.isActive = true
    this.mode = mode

    if (mode === 'active') {
      this.startActiveRecording(audioSource)
    } else {
      this.startPassiveListening(audioSource)
    }
  }

  private startActiveRecording(audioSource: AudioSource): void {
    this.recorder = new AudioRecorder()

    this.recorder.start(audioSource).catch((err) => {
      console.error('[LocalInterview] Failed to start recording:', err)
      this.isActive = false
    })

    // Show interim "Recording..." message
    if (this.onInterimCb) {
      this.onInterimCb('(recording...)')
    }
  }

  private startPassiveListening(audioSource: AudioSource): void {
    this.passiveService = new PassiveListenService()

    this.passiveService
      .start({
        audioSource: audioSource === 'system' ? 'system' : 'microphone',
        onTranscript: (text) => {
          if (this.onInterimCb) {
            this.onInterimCb(text)
          }
        },
        onDetected: async (text) => {
          if (this.onFinalCb) {
            this.onFinalCb(text)
          }
        },
        onStatus: (status) => {
          console.log('[LocalInterview] Passive status:', status)
        },
        onError: (error) => {
          console.error('[LocalInterview] Passive error:', error)
        }
      })
      .catch((err) => {
        console.error('[LocalInterview] Failed to start passive listening:', err)
        this.isActive = false
      })
  }

  async stop(): Promise<void> {
    if (!this.isActive) {
      console.log('[LocalInterview] Not active, nothing to stop')
      return
    }

    console.log('[LocalInterview] Stopping in', this.mode, 'mode')
    this.isActive = false

    if (this.mode === 'active') {
      await this.stopActiveRecording()
    } else {
      this.stopPassiveListening()
    }
  }

  private async stopActiveRecording(): Promise<void> {
    if (!this.recorder) return

    try {
      const audioBuffer = await this.recorder.stop()
      console.log('[LocalInterview] Audio buffer obtained, size:', audioBuffer.byteLength, 'bytes')

      // Store the audio buffer for later use (e.g., saving to session)
      this.lastAudioBuffer = audioBuffer

      // Transcribe using the electronAPI (same as General Interview)
      console.log('[LocalInterview] Sending to transcription via electronAPI')
      const transcript = await window.electronAPI.transcribeAudio(audioBuffer)
      console.log('[LocalInterview] Transcription complete:', transcript.substring(0, 100))

      if (this.onFinalCb) {
        this.onFinalCb(transcript)
      }
    } catch (err) {
      console.error('[LocalInterview] Transcription failed:', err)
      if (this.onFinalCb) {
        this.onFinalCb('(transcription failed)')
      }
    }
  }

  private stopPassiveListening(): void {
    if (this.passiveService) {
      this.passiveService.stop()
      this.passiveService = null
    }
  }

  speak(text: string, onEnd?: () => void): void {
    console.log('[LocalInterview] Using browser speech synthesis as fallback')
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0
    if (onEnd) utterance.onend = onEnd
    window.speechSynthesis.speak(utterance)
  }

  stopSpeaking(): void {
    window.speechSynthesis.cancel()
  }

  getLastAudioBuffer(): ArrayBuffer | null {
    return this.lastAudioBuffer
  }

  clearLastAudioBuffer(): void {
    this.lastAudioBuffer = null
  }
}
