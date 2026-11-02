import { permissionService } from './permissionService';

export interface VoiceSOSState {
  isSupported: boolean;
  isArmed: boolean;
  status: 'idle' | 'listening' | 'triggered' | 'error' | 'permission_denied' | 'unsupported';
  triggerPhrase: string;
  secondaryPhrases: string[];
  language: 'en-US' | 'ta-IN';
  lastHeardTranscript: string;
  lastTriggeredPhrase?: string;
  lastTriggeredAt?: string;
  errorMessage?: string;
}

type VoiceSOSListener = (state: VoiceSOSState) => void;
type VoiceSOSTriggerCallback = (detectedPhrase: string, fullTranscript: string) => void;

const STORAGE_KEY = 'smartshield_voice_sos_config_v1';

class VoiceSOSService {
  private state: VoiceSOSState;
  private listeners: Set<VoiceSOSListener> = new Set();
  private triggerCallback: VoiceSOSTriggerCallback | null = null;
  private recognition: any = null;
  private shouldRestart = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTriggerTimestamp = 0;

  constructor() {
    const isSupported =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    let savedPhrase = 'Smart Shield Help';
    let savedLang: 'en-US' | 'ta-IN' = 'en-US';
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.triggerPhrase && typeof parsed.triggerPhrase === 'string') {
          savedPhrase = parsed.triggerPhrase.trim() || 'Smart Shield Help';
        }
        if (parsed.language === 'ta-IN' || parsed.language === 'en-US') {
          savedLang = parsed.language;
        }
      }
    } catch {
      // ignore storage errors
    }

    const defaultSecondaryPhrases = [
      'send sos',
      'activate emergency',
      'i need emergency help',
      'call my emergency contacts',
      'smart shield emergency',
      'smart shield sos',
      'help me smart shield',
      'emergency sos',
      'trigger sos',
      'emergency help',
      // Tamil
      'sos அனுப்பு',
      'உடனடி உதவி',
      'காப்பாற்றுங்கள்',
      'அவசர உதவி',
      'எனக்கு உதவி வேண்டும்',
      'காப்பாத்துங்க',
      // Tanglish
      'emergency help venum',
      'sos activate pannu',
      'sos anupu',
      'kaapathunga'
    ];

    this.state = {
      isSupported,
      isArmed: false,
      status: isSupported ? 'idle' : 'unsupported',
      triggerPhrase: savedPhrase,
      secondaryPhrases: defaultSecondaryPhrases,
      language: savedLang,
      lastHeardTranscript: ''
    };
  }

  public getState(): VoiceSOSState {
    return { ...this.state };
  }

  public subscribe(listener: VoiceSOSListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setTriggerCallback(cb: VoiceSOSTriggerCallback | null): void {
    this.triggerCallback = cb;
  }

  private updateState(patch: Partial<VoiceSOSState>): void {
    this.state = { ...this.state, ...patch };
    const snapshot = this.getState();
    this.listeners.forEach((l) => l(snapshot));
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          triggerPhrase: this.state.triggerPhrase,
          language: this.state.language
        })
      );
    } catch {
      // ignore storage errors
    }
  }

  public setTriggerPhrase(phrase: string): void {
    const cleaned = phrase.trim() || 'Smart Shield Help';
    this.updateState({ triggerPhrase: cleaned });
    this.saveConfig();
  }

  public setLanguage(lang: 'en-US' | 'ta-IN'): void {
    this.updateState({ language: lang });
    this.saveConfig();
    if (this.state.isArmed) {
      this.stopRecognitionInstance();
      this.startRecognitionInstance();
    }
  }

  /**
   * Normalizes speech text for reliable keyword matching (case-insensitive, punctuation-free).
   */
  public normalizeText(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Checks whether a spoken transcript contains the configured trigger phrase or phonetic equivalents.
   */
  public matchTriggerPhrase(transcript: string): string | null {
    const normTranscript = this.normalizeText(transcript);
    if (!normTranscript) return null;

    const primaryNorm = this.normalizeText(this.state.triggerPhrase);
    if (primaryNorm && normTranscript.includes(primaryNorm)) {
      return this.state.triggerPhrase;
    }

    // Handle common Web Speech API spacing/phonetic variations for "Smart Shield Help"
    const compactTranscript = normTranscript.replace(/\s+/g, '');
    const compactPrimary = primaryNorm.replace(/\s+/g, '');
    if (compactPrimary.length >= 6 && compactTranscript.includes(compactPrimary)) {
      return this.state.triggerPhrase;
    }

    for (const sec of this.state.secondaryPhrases) {
      const secNorm = this.normalizeText(sec);
      if (secNorm && normTranscript.includes(secNorm)) {
        return sec.trim();
      }
      const compactSec = secNorm.replace(/\s+/g, '');
      if (compactSec.length >= 5 && compactTranscript.includes(compactSec)) {
        return sec.trim();
      }
    }

    return null;
  }

  /**
   * Arms the continuous Web Speech API listener for the SOS trigger keyword.
   */
  public async startListening(): Promise<boolean> {
    if (!this.state.isSupported) {
      this.updateState({
        isArmed: false,
        status: 'unsupported',
        errorMessage:
          'Web Speech API (SpeechRecognition) is not supported in this browser. Please use Chrome, Edge, or Android WebView, or use the Test Trigger button.'
      });
      return false;
    }

    const micGranted = await permissionService.requestMicrophonePermission();
    if (!micGranted) {
      this.updateState({
        isArmed: false,
        status: 'permission_denied',
        errorMessage:
          'Microphone permission was denied. Please grant microphone access in your browser settings to enable voice-activated SOS.'
      });
      return false;
    }

    this.shouldRestart = true;
    this.updateState({
      isArmed: true,
      status: 'listening',
      errorMessage: undefined
    });

    this.startRecognitionInstance();
    return true;
  }

  /**
   * Disarms the continuous Web Speech API listener.
   */
  public stopListening(): void {
    this.shouldRestart = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.stopRecognitionInstance();
    this.updateState({
      isArmed: false,
      status: 'idle',
      errorMessage: undefined
    });
  }

  public async toggleListening(): Promise<boolean> {
    if (this.state.isArmed) {
      this.stopListening();
      return false;
    } else {
      return await this.startListening();
    }
  }

  private stopRecognitionInstance(): void {
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        this.recognition.stop();
      } catch {
        // ignore stop errors
      }
      this.recognition = null;
    }
  }

  private startRecognitionInstance(): void {
    this.stopRecognitionInstance();
    if (!this.shouldRestart || !this.state.isSupported) return;

    try {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = this.state.language;

      recognition.onstart = () => {
        if (this.shouldRestart) {
          this.updateState({ status: 'listening', errorMessage: undefined });
        }
      };

      recognition.onresult = (event: any) => {
        let combinedTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          combinedTranscript += event.results[i][0].transcript + ' ';
        }
        const trimmed = combinedTranscript.trim();
        if (!trimmed) return;

        this.updateState({ lastHeardTranscript: trimmed });

        const matchedPhrase = this.matchTriggerPhrase(trimmed);
        if (matchedPhrase) {
          this.handleKeywordDetected(matchedPhrase, trimmed);
        }
      };

      recognition.onerror = (event: any) => {
        const errCode = event?.error || 'unknown';
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          this.shouldRestart = false;
          this.updateState({
            isArmed: false,
            status: 'permission_denied',
            errorMessage: 'Microphone permission was blocked by the browser.'
          });
        } else if (errCode === 'no-speech' || errCode === 'aborted') {
          // Normal during quiet periods; onend will smoothly restart listening
        } else if (errCode === 'audio-capture') {
          this.shouldRestart = false;
          this.updateState({
            isArmed: false,
            status: 'error',
            errorMessage: 'No microphone hardware was detected on this device.'
          });
        } else {
          this.updateState({
            errorMessage: `Voice monitor notice (${errCode}) — auto-reconnecting...`
          });
        }
      };

      recognition.onend = () => {
        if (this.shouldRestart && this.state.isArmed) {
          if (this.restartTimer) clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (this.shouldRestart && this.state.isArmed) {
              this.startRecognitionInstance();
            }
          }, 350);
        }
      };

      this.recognition = recognition;
      recognition.start();
    } catch (err: any) {
      this.updateState({
        status: 'error',
        errorMessage: err?.message || 'Unable to start Web Speech API recognition.'
      });
    }
  }

  /**
   * Handles a detected trigger phrase (either via live microphone speech or test simulation)
   * and immediately invokes the SOS countdown callback.
   */
  private handleKeywordDetected(matchedPhrase: string, fullTranscript: string): void {
    const now = Date.now();
    // Prevent duplicate triggers within 4 seconds
    if (now - this.lastTriggerTimestamp < 4000) {
      return;
    }
    this.lastTriggerTimestamp = now;

    // Pause continuous recognition while SOS countdown / recording runs to avoid mic conflicts
    this.shouldRestart = false;
    this.stopRecognitionInstance();

    const timeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    this.updateState({
      isArmed: false,
      status: 'triggered',
      lastHeardTranscript: fullTranscript,
      lastTriggeredPhrase: matchedPhrase,
      lastTriggeredAt: timeStr,
      errorMessage: undefined
    });

    if (this.triggerCallback) {
      this.triggerCallback(matchedPhrase, fullTranscript);
    }

    // Voice feedback confirming SOS trigger
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const isTamil = /[\u0B80-\u0BFF]/.test(matchedPhrase) || this.state.language === 'ta-IN';
        const feedbackText = isTamil
          ? 'அவசர எச்சரிக்கை தொடங்கப்பட்டது. உங்கள் இருப்பிடம் அவசர தொடர்புகளுக்கு அனுப்பப்படுகிறது.'
          : 'Emergency alert activated. Sending your location to your emergency contacts.';
        const utter = new SpeechSynthesisUtterance(feedbackText);
        utter.rate = 1.0;
        utter.lang = isTamil ? 'ta-IN' : 'en-US';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      } catch {}
    }
  }

  /**
   * Allows testing the keyword detection pipeline with a simulated spoken phrase
   * (e.g., "Smart Shield Help") to verify immediate SOS countdown initiation.
   */
  public simulatePhraseDetection(spokenText = 'Smart Shield Help'): boolean {
    this.updateState({ lastHeardTranscript: spokenText });
    const matched = this.matchTriggerPhrase(spokenText);
    if (matched) {
      this.handleKeywordDetected(matched, spokenText);
      return true;
    }
    return false;
  }
}

export const voiceSosService = new VoiceSOSService();
