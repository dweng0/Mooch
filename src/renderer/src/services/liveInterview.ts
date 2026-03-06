type OnInterimCallback = (text: string) => void
type OnQuestionCallback = (question: string) => void

// Web Speech API types (not always in TS lib depending on target)
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

export class LiveInterviewService {
  private recognition: SpeechRecognitionLike | null = null
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private accumulatedText: string = ''
  private isActive: boolean = false
  private silenceDelay: number

  private onInterimCb: OnInterimCallback | null = null
  private onQuestionCb: OnQuestionCallback | null = null

  constructor(silenceDelay = 2000) {
    this.silenceDelay = silenceDelay
  }

  get isAvailable(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  }

  start(onInterim: OnInterimCallback, onQuestion: OnQuestionCallback): void {
    if (this.isActive) return
    this.onInterimCb = onInterim
    this.onQuestionCb = onQuestion
    this.isActive = true
    this.accumulatedText = ''
    this._startRecognition()
  }

  /** Temporarily stop the mic (e.g. while TTS is playing) without exiting mock mode. */
  pauseListening(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.recognition) {
      const r = this.recognition
      r.onend = null
      this.recognition = null
      try { r.stop() } catch { /* ignore */ }
    }
  }

  /** Restart mic after a pause. */
  resumeListening(): void {
    if (this.isActive && !this.recognition) {
      this.accumulatedText = ''
      this._startRecognition()
    }
  }

  stop(): void {
    this.isActive = false
    this.pauseListening()
    this.onInterimCb = null
    this.onQuestionCb = null
  }

  speak(text: string, onEnd?: () => void): void {
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

  private _startRecognition(): void {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      console.error('[MockInterview] SpeechRecognition not available')
      return
    }

    const recognition: SpeechRecognitionLike = new SpeechRec()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          this.accumulatedText += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }

      this.onInterimCb?.(this.accumulatedText + interim)

      // Reset silence timer on every new speech segment
      if (this.silenceTimer) clearTimeout(this.silenceTimer)
      if (this.accumulatedText.trim()) {
        this.silenceTimer = setTimeout(() => {
          const question = this.accumulatedText.trim()
          this.accumulatedText = ''
          this.onQuestionCb?.(question)
        }, this.silenceDelay)
      }
    }

    recognition.onerror = (event: any) => {
      // 'no-speech' is normal; 'aborted' fires when we call stop() manually
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.error('[MockInterview] Recognition error:', event.error)
    }

    recognition.onend = () => {
      this.recognition = null
      if (this.isActive) {
        setTimeout(() => {
          if (this.isActive && !this.recognition) this._startRecognition()
        }, 150)
      }
    }

    this.recognition = recognition
    recognition.start()
  }
}
