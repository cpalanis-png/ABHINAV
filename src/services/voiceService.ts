/**
 * Service to manage Web Speech API for voice recognition (Speech-to-Text)
 * and voice synthesis (Text-to-Speech) with English and Tamil support.
 */

export interface ListeningCallbacks {
  onStart?: () => void;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: any) => void;
  onEnd?: () => void;
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

class VoiceService {
  private recognition: any = null;
  private isListeningActive = false;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private lastSpokenText = '';
  private lastSpeakOptions: SpeakOptions = {};

  public isRecognitionSupported(): boolean {
    return typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  public isSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public isMediaRecorderSupported(): boolean {
    return typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined';
  }

  public startListening(callbacks: ListeningCallbacks, lang = 'en-US'): boolean {
    if (!this.isRecognitionSupported()) {
      callbacks.onError(new Error('Speech recognition is not supported in this browser environment.'));
      return false;
    }

    this.stopListening();

    try {
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = lang;

      this.recognition.onstart = () => {
        this.isListeningActive = true;
        if (callbacks.onStart) callbacks.onStart();
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        callbacks.onResult(text, Boolean(finalTranscript));
      };

      this.recognition.onerror = (event: any) => {
        this.isListeningActive = false;
        callbacks.onError(event.error || event);
      };

      this.recognition.onend = () => {
        this.isListeningActive = false;
        if (callbacks.onEnd) callbacks.onEnd();
      };

      this.recognition.start();
      return true;
    } catch (err) {
      callbacks.onError(err);
      return false;
    }
  }

  public stopListening(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    this.stopAudioRecording();
    this.isListeningActive = false;
  }

  /**
   * Android WebView fallback: records audio through MediaRecorder and transcribes via backend Gemini endpoint
   */
  public async startAudioRecording(
    onStart?: () => void,
    onError?: (err: any) => void
  ): Promise<boolean> {
    if (!this.isMediaRecorderSupported()) {
      onError?.(new Error('Audio recording hardware is not supported on this device.'));
      return false;
    }

    try {
      this.stopAudioRecording();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;
      this.recordedChunks = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      recorder.onstart = () => {
        this.isListeningActive = true;
        onStart?.();
      };

      recorder.start(250);
      return true;
    } catch (err) {
      onError?.(err);
      return false;
    }
  }

  public async stopAudioRecordingAndTranscribe(
    lang = 'en-US'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve('');
        return;
      }

      const recorder = this.mediaRecorder;
      recorder.onstop = async () => {
        try {
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(this.recordedChunks, { type: mimeType });
          this.recordedChunks = [];

          if (blob.size < 100) {
            resolve('');
            return;
          }

          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Data = (reader.result as string).split(',')[1];
              const res = await fetch('/api/voice/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioBase64: base64Data,
                  mimeType,
                  language: lang
                })
              });

              if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                reject(new Error(errJson.error || 'Server audio transcription failed'));
                return;
              }

              const json = await res.json();
              resolve(json.transcript || '');
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error('Failed to read recorded audio'));
          reader.readAsDataURL(blob);
        } catch (err) {
          reject(err);
        } finally {
          this.stopAudioRecording();
        }
      };

      try {
        recorder.stop();
      } catch {
        resolve('');
      }
    });
  }

  private stopAudioRecording(): void {
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch {}
      this.mediaRecorder = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.mediaStream = null;
    }
    this.isListeningActive = false;
  }

  public speak(text: string, options: SpeakOptions = {}): boolean {
    if (!this.isSynthesisSupported()) {
      if (options.onError) options.onError('Speech synthesis is not supported.');
      return false;
    }

    this.stopSpeaking();
    this.lastSpokenText = text;
    this.lastSpeakOptions = { ...options };

    // Strip markdown characters before speech
    const cleanText = text
      .replace(/\*+/g, '')
      .replace(/#+/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/`/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;

    // Detect Tamil language
    const isTamil = /[\u0B80-\u0BFF]/.test(cleanText);
    const targetLang = options.lang || (isTamil ? 'ta-IN' : 'en-US');
    utterance.lang = targetLang;

    // Voice Selection
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const matchedVoice = voices.find((v) =>
        v.lang.toLowerCase().includes(targetLang.toLowerCase()) ||
        (isTamil && v.name.toLowerCase().includes('tamil'))
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
    }

    utterance.onstart = () => {
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = (e) => {
      if (options.onError) options.onError(e);
    };

    window.speechSynthesis.speak(utterance);
    return true;
  }

  public repeatLastSpoken(): boolean {
    if (!this.lastSpokenText) return false;
    return this.speak(this.lastSpokenText, this.lastSpeakOptions);
  }

  public getLastSpokenText(): string {
    return this.lastSpokenText;
  }

  public stopSpeaking(): void {
    if (this.isSynthesisSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.isSynthesisSupported()) {
      return window.speechSynthesis.getVoices();
    }
    return [];
  }

  public isListening(): boolean {
    return this.isListeningActive;
  }
}

export const voiceService = new VoiceService();
