import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldAlert,
  Bot,
  User,
  MessageSquare,
  Zap,
  AlertTriangle,
  X,
  RotateCcw,
  Send,
  Edit3,
  Settings,
  Radio,
  HelpCircle,
  Shield,
  CheckCircle2,
  Info
} from 'lucide-react';
import { LocationData, ChatMessage, AIChatMode } from '../types';
import { StorageService } from '../services/storage';
import { AIService, AIErrorCode } from '../services/aiService';
import { permissionService } from '../services/permissionService';
import { voiceSosService } from '../services/voiceSosService';
import { voiceService } from '../services/voiceService';

export type VoiceState =
  | 'idle'
  | 'requesting_permission'
  | 'connecting'
  | 'listening'
  | 'reviewing'
  | 'processing'
  | 'generating'
  | 'speaking'
  | 'interrupted'
  | 'permission_denied'
  | 'connection_lost'
  | 'error'
  | 'session_ended';

interface ShieldVoiceAssistantProps {
  location: LocationData | null;
  pregnancyActive: boolean;
  triggerSOS: () => void;
  triggerFakeCall: () => void;
  setActiveTab: (tab: string) => void;
  onSwitchToTextChat: () => void;
}

export const ShieldVoiceAssistant: React.FC<ShieldVoiceAssistantProps> = ({
  location,
  pregnancyActive,
  triggerSOS,
  triggerFakeCall,
  setActiveTab,
  onSwitchToTextChat
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorCode, setErrorCode] = useState<AIErrorCode | undefined>(undefined);
  const [canRetryApi, setCanRetryApi] = useState<boolean>(false);

  // Language settings: English (US & IN), Tamil (ta-IN), Tanglish
  const [selectedLanguage, setSelectedLanguage] = useState<'auto' | 'en-US' | 'en-IN' | 'ta-IN'>('auto');
  const [isAudioRecordingFallback, setIsAudioRecordingFallback] = useState<boolean>(false);

  // Speech Recognition & Editable Recognized Question
  const [transcript, setTranscript] = useState<string>('');
  const [reviewBeforeSend, setReviewBeforeSend] = useState<boolean>(true);
  const [aiResponseText, setAiResponseText] = useState<string>('');
  const [voiceHistory, setVoiceHistory] = useState<ChatMessage[]>([]);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState<string>('');

  // Speech Audio Settings (TTS only when available and enabled)
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const isTtsAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Voice Assistant Modes: Normal Q&A vs Continuous Emergency Monitor
  const [assistantMode, setAssistantMode] = useState<'normal' | 'emergency_monitor'>('normal');
  const [voiceSosState, setVoiceSosState] = useState(() => voiceSosService.getState());
  const [showCommandHelp, setShowCommandHelp] = useState<boolean>(false);

  // Audio Visualizer Spectrum Data (32 bars)
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(32).fill(10));

  // Voice Command Trigger Banner
  const [triggeredAction, setTriggeredAction] = useState<string | null>(null);

  // Refs for Web Audio & Speech Recognition
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const transcriptInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const history = StorageService.getChatHistory();
    if (history.length > 0) {
      setVoiceHistory(history);
    }
    const unsubVoiceSos = voiceSosService.subscribe((state) => {
      setVoiceSosState(state);
    });
    return () => {
      unsubVoiceSos();
      stopAllAudio();
      AIService.cancelActiveRequest();
    };
  }, []);

  const stopMicAndStream = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    setAudioLevels(new Array(32).fill(10));
  };

  const stopAllAudio = () => {
    stopMicAndStream();
    if (isTtsAvailable) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  };

  // Start Voice Session (Microphone Permission & Speech Recognition)
  const startVoiceSession = async () => {
    stopAllAudio();
    setErrorMessage('');
    setErrorCode(undefined);
    setCanRetryApi(false);
    setVoiceState('requesting_permission');

    try {
      const micGranted = await permissionService.requestMicrophonePermission();
      if (!micGranted) {
        setVoiceState('permission_denied');
        setErrorMessage(
          'Microphone permission was denied. Please enable microphone access in your browser or Android settings, or type/edit your question in the box below.'
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      setVoiceState('connecting');

      // Setup Web Audio Analyser for Real-time Spectrum Visualization
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateSpectrum = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            const normalized = Array.from(dataArray.slice(0, 32)).map((val) =>
              Math.max(12, (val / 255) * 100)
            );
            setAudioLevels(normalized);
            animFrameRef.current = requestAnimationFrame(updateSpectrum);
          }
        };
        updateSpectrum();
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        // Fallback for Android WebView: Record via MediaRecorder and transcribe through backend
        if (voiceService.isMediaRecorderSupported()) {
          setIsAudioRecordingFallback(true);
          const ok = await voiceService.startAudioRecording(
            () => {
              setVoiceState('listening');
            },
            (err) => {
              stopMicAndStream();
              setIsAudioRecordingFallback(false);
              setVoiceState('reviewing');
              setErrorMessage('Microphone capture error: ' + (err?.message || 'Access failed'));
              transcriptInputRef.current?.focus();
            }
          );
          if (ok) return;
        }

        stopMicAndStream();
        setVoiceState('reviewing');
        setErrorMessage(
          'Browser Speech-to-Text is unavailable in this environment. You can type or edit your question directly below and send it through the voice assistant.'
        );
        transcriptInputRef.current?.focus();
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage === 'auto' ? 'en-US' : selectedLanguage;

      let capturedAnySpeech = false;

      recognition.onstart = () => {
        setVoiceState('listening');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const currentText = (final || interim).trim();
        if (currentText) {
          capturedAnySpeech = true;
          setTranscript(currentText);
        }

        if (final && final.trim()) {
          stopMicAndStream();
          const matchedSosPhrase = voiceSosService.matchTriggerPhrase(final.trim());
          if (matchedSosPhrase) {
            setTriggeredAction(`Voice SOS Trigger Detected: "${matchedSosPhrase}"`);
            voiceSosService.simulatePhraseDetection(final.trim());
            return;
          }
          if (reviewBeforeSend) {
            setVoiceState('reviewing');
            transcriptInputRef.current?.focus();
          } else {
            processUserVoiceQuery(final.trim());
          }
        }
      };

      recognition.onerror = (event: any) => {
        stopMicAndStream();
        const errType = event?.error || 'unknown';
        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          setVoiceState('permission_denied');
          setErrorMessage(
            'Microphone access was denied by your browser or device. Please allow microphone access or edit your question below.'
          );
        } else if (errType === 'no-speech') {
          setVoiceState('error');
          setErrorMessage(
            'No speech was detected (or background noise masked your voice). Please move to a quieter spot and tap Retry Listening, or type your question below.'
          );
        } else if (errType === 'audio-capture') {
          setVoiceState('error');
          setErrorMessage(
            'No working microphone hardware was detected. Please check your microphone connection or type your question below.'
          );
        } else if (errType === 'network') {
          setVoiceState('connection_lost');
          setErrorMessage(
            'Speech recognition encountered a network error. Please check your internet connection or type your question below.'
          );
        } else {
          setVoiceState('error');
          setErrorMessage(`Speech recognition could not complete (${errType}). Please try again or edit your question below.`);
        }
      };

      recognition.onend = () => {
        stopMicAndStream();
        setVoiceState((prev) => {
          if (prev === 'listening') {
            if (!capturedAnySpeech) {
              setErrorMessage(
                'Listening ended without detecting clear speech. Tap Start Voice to try again, or type your question below.'
              );
              return 'error';
            }
            return 'reviewing';
          }
          return prev;
        });
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      stopMicAndStream();
      setVoiceState('permission_denied');
      setErrorMessage(
        'Microphone permission is required for voice recognition. Please allow access in your browser settings or type your question below.'
      );
    }
  };

  // Process User Voice Query through the unified AIService pipeline
  const processUserVoiceQuery = async (queryText: string) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery) {
      setVoiceState('error');
      setErrorMessage('Recognized question is empty. Please speak or type a valid question before sending.');
      return;
    }

    stopMicAndStream();
    setErrorMessage('');
    setErrorCode(undefined);
    setCanRetryApi(false);
    setLastSubmittedQuery(cleanQuery);
    setVoiceState('processing');

    // Check for explicit SMART SHIELD emergency voice commands
    const lower = cleanQuery.toLowerCase();
    const matchedSosPhrase = voiceSosService.matchTriggerPhrase(cleanQuery);
    if (matchedSosPhrase || lower === 'trigger sos' || lower === 'emergency sos' || lower === 'activate sos') {
      setTriggeredAction(`Voice SOS Trigger Detected: "${matchedSosPhrase || 'Emergency Voice Command'}"`);
      voiceSosService.simulatePhraseDetection(cleanQuery);
      setVoiceState('idle');
      return; // Immediate SOS activation: do not wait for AI chat response
    } else if (lower.includes('fake call')) {
      setTriggeredAction('Triggering Fake Call Escape');
      triggerFakeCall();
      setVoiceState('idle');
      return;
    }

    setVoiceState('generating');

    const latestHistory = StorageService.getChatHistory();
    const lastEntry = latestHistory[latestHistory.length - 1];
    let updatedHistory = [...latestHistory];

    if (!lastEntry || lastEntry.role !== 'user' || lastEntry.content !== cleanQuery) {
      const userMsg: ChatMessage = {
        id: `uv-${Date.now()}`,
        role: 'user',
        content: cleanQuery,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: pregnancyActive ? 'pregnancy' : 'universal'
      };
      updatedHistory = [...updatedHistory, userMsg];
      setVoiceHistory(updatedHistory);
      StorageService.saveChatHistory(updatedHistory);
    }

    const contextMode: AIChatMode = pregnancyActive ? 'pregnancy' : 'universal';

    const result = await AIService.sendMessage(
      updatedHistory.map((m) => ({ role: m.role, content: m.content })),
      {
        contextMode,
        locationContext: location,
        selectedModel: 'gemini-3.1-flash-lite'
      }
    );

    if (result.status === 'cancelled') {
      setVoiceState('idle');
      return;
    }

    if (result.status === 'error') {
      setVoiceState(result.errorCode === 'OFFLINE' || result.errorCode === 'NETWORK_ERROR' ? 'connection_lost' : 'error');
      setErrorCode(result.errorCode);
      setCanRetryApi(result.canRetry ?? true);
      setErrorMessage(result.errorMessage || 'Failed to receive a response from Smart Shield AI.');
      return;
    }

    const responseAnswer = result.text;
    setAiResponseText(responseAnswer);

    const assistantMsg: ChatMessage = {
      id: `av-${Date.now()}`,
      role: 'assistant',
      content: responseAnswer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode: contextMode,
      model: result.model
    };

    const finalHistory = [...updatedHistory, assistantMsg];
    setVoiceHistory(finalHistory);
    StorageService.saveChatHistory(finalHistory);

    speakAiResponse(responseAnswer);
  };

  // Speak AI Response using Browser Web Speech Synthesis ONLY when available and enabled
  const speakAiResponse = (textToSpeak: string) => {
    if (isMuted || !isTtsAvailable) {
      setVoiceState('idle');
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {}

    const cleanSpeechText = textToSpeak
      .replace(/\*+/g, '')
      .replace(/#+/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/`/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
    utterance.rate = speechRate;

    const isTamil = /[\u0B80-\u0BFF]/.test(cleanSpeechText);
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;

    if (isTamil) {
      selectedVoice =
        voices.find((v) => v.lang.includes('ta') || v.name.toLowerCase().includes('tamil')) || null;
    } else {
      selectedVoice =
        voices.find((v) => v.lang.includes('en-IN') || v.lang.includes('en-US')) || null;
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      setVoiceState('speaking');
    };

    utterance.onend = () => {
      setVoiceState('idle');
    };

    utterance.onerror = () => {
      setVoiceState('idle');
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const interruptSpeaking = () => {
    if (isTtsAvailable) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setVoiceState('interrupted');
    setTimeout(() => {
      setVoiceState('idle');
    }, 1000);
  };

  const endVoiceSession = () => {
    stopAllAudio();
    AIService.cancelActiveRequest();
    setVoiceState('session_ended');
  };

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background Neon Halo */}
      <div
        className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
          voiceState === 'listening'
            ? 'bg-cyan-600/20'
            : voiceState === 'speaking'
            ? 'bg-purple-600/20'
            : 'bg-indigo-600/10'
        }`}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg transition-colors ${
              voiceState === 'listening'
                ? 'bg-cyan-950 border-cyan-500 text-cyan-400'
                : voiceState === 'speaking'
                ? 'bg-purple-950 border-purple-500 text-purple-300'
                : 'bg-indigo-950 border-indigo-700 text-indigo-300'
            }`}
          >
            <Bot className="w-7 h-7" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black text-white">Smart Shield Voice Assistant</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${
                  voiceState === 'listening'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-700 animate-pulse'
                    : voiceState === 'speaking'
                    ? 'bg-purple-950 text-purple-300 border-purple-700 animate-pulse'
                    : 'bg-indigo-950 text-indigo-300 border-indigo-800'
                }`}
              >
                {voiceState.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Speak, review &amp; edit your recognized question • English &amp; தமிழ் (Tamil)
            </p>
          </div>
        </div>

        {/* Action Controls & Language Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value as any)}
            aria-label="Select speech recognition language"
            className="bg-slate-950 text-white text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none"
          >
            <option value="auto">Auto Language (English / Tamil / Tanglish)</option>
            <option value="en-IN">Indian English (en-IN)</option>
            <option value="en-US">English (en-US)</option>
            <option value="ta-IN">Tamil (தமிழ் / ta-IN)</option>
          </select>

          <button
            onClick={onSwitchToTextChat}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 border border-slate-700 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Switch to Text Chat</span>
          </button>

          <button
            onClick={triggerSOS}
            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase flex items-center space-x-1.5 shadow-md"
            title="Emergency SOS is always active regardless of AI state"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>SOS</span>
          </button>
        </div>
      </div>

      {/* Voice Assistant Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 rounded-2xl bg-slate-950/90 border border-slate-800">
        <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setAssistantMode('normal')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              assistantMode === 'normal'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Normal Assistant Mode</span>
          </button>

          <button
            type="button"
            onClick={() => setAssistantMode('emergency_monitor')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              assistantMode === 'emergency_monitor'
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Emergency Voice Mode</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowCommandHelp(!showCommandHelp)}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center space-x-1.5 border border-slate-800 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-pink-400" />
          <span>{showCommandHelp ? 'Hide Emergency Commands' : 'Supported Voice Commands'}</span>
        </button>
      </div>

      {/* Emergency Commands Reference Card */}
      {showCommandHelp && (
        <div className="p-4 rounded-2xl bg-[#0F1738] border border-purple-500/40 space-y-3.5 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2 font-bold text-white text-sm">
              <Shield className="w-4 h-4 text-pink-400" />
              <span>Smart Shield Explicit Emergency Commands</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCommandHelp(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-slate-300 leading-relaxed">
            Speak any of these explicit emergency commands to instantly dispatch SOS alerts with live GPS coordinates to all saved emergency contacts:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <span className="font-bold text-cyan-300 uppercase tracking-wider text-[11px]">🇬🇧 English</span>
              <ul className="space-y-1 text-slate-300 text-[11px]">
                <li>• "Send SOS"</li>
                <li>• "Activate emergency"</li>
                <li>• "I need emergency help"</li>
                <li>• "Call my emergency contacts"</li>
                <li>• "Smart Shield emergency"</li>
                <li>• "Smart Shield SOS"</li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <span className="font-bold text-pink-300 uppercase tracking-wider text-[11px]">🇮🇳 தமிழ் (Tamil)</span>
              <ul className="space-y-1 text-slate-300 text-[11px]">
                <li>• "SOS அனுப்பு"</li>
                <li>• "உடனடி உதவி"</li>
                <li>• "காப்பாற்றுங்கள்"</li>
                <li>• "அவசர உதவி"</li>
                <li>• "எனக்கு உதவி வேண்டும்"</li>
                <li>• "காப்பாத்துங்க"</li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <span className="font-bold text-purple-300 uppercase tracking-wider text-[11px]">🗣️ Tanglish</span>
              <ul className="space-y-1 text-slate-300 text-[11px]">
                <li>• "emergency help venum"</li>
                <li>• "SOS activate pannu"</li>
                <li>• "SOS anupu"</li>
                <li>• "kaapathunga"</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start space-x-2 pt-1 text-[11px] text-slate-400">
            <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <span>
              <strong>Conversational Safety:</strong> Ambiguous conversational words like "help with breakfast" will not trigger accidental emergency alerts. Only clear explicit emergency phrases activate instant SOS without requiring a second manual confirmation.
            </span>
          </div>
        </div>
      )}

      {/* Emergency Voice Mode Hero Display */}
      {assistantMode === 'emergency_monitor' && (
        <div className="flex flex-col items-center justify-center py-6 space-y-5 bg-gradient-to-b from-[#180A28] to-[#0A0D20] rounded-3xl border border-rose-500/40 p-6 shadow-2xl text-center">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-rose-950/80 border border-rose-500/50 text-xs font-bold">
            <div className={`w-2.5 h-2.5 rounded-full ${voiceSosState.isArmed ? 'bg-rose-500 animate-ping' : 'bg-slate-500'}`} />
            <span className={voiceSosState.isArmed ? 'text-rose-200' : 'text-slate-400'}>
              {voiceSosState.isArmed ? 'EMERGENCY VOICE MONITOR ARMED & LISTENING' : 'VOICE MONITOR DISARMED'}
            </span>
          </div>

          <div className="relative flex items-center justify-center">
            {voiceSosState.isArmed && (
              <div className="absolute w-36 h-36 rounded-full animate-ping opacity-30 bg-rose-500" />
            )}

            <button
              type="button"
              onClick={async () => {
                await voiceSosService.toggleListening();
              }}
              className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center shadow-2xl transition-transform active:scale-95 cursor-pointer z-10 ${
                voiceSosState.isArmed
                  ? 'bg-rose-600 border-rose-400 text-white shadow-rose-950 hover:bg-rose-500'
                  : 'bg-slate-800 border-slate-600 text-slate-300 shadow-slate-950 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Radio className={`w-11 h-11 ${voiceSosState.isArmed ? 'animate-pulse' : ''}`} />
              <span className="text-[11px] font-black uppercase tracking-wider mt-1.5">
                {voiceSosState.isArmed ? 'Disarm Monitor' : 'Arm Monitor'}
              </span>
            </button>
          </div>

          <div className="space-y-1.5 max-w-md">
            <h3 className="text-base font-black text-white">
              {voiceSosState.isArmed
                ? 'Listening for Emergency Voice Commands...'
                : 'Continuous Emergency Voice Monitor is Disarmed'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {voiceSosState.isArmed
                ? 'Speak "Send SOS", "Activate emergency", "உடனடி உதவி", or "emergency help venum" to immediately trigger SOS and notify all emergency contacts.'
                : 'Tap Arm Monitor to start continuous safety keyword detection while this screen is active.'}
            </p>
          </div>

          {/* Real-time speech display */}
          <div className="w-full max-w-md p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-left space-y-1 text-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Last Heard Speech</span>
              {voiceSosState.isArmed && (
                <span className="text-emerald-400 text-[10px] flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Microphone Active</span>
                </span>
              )}
            </div>
            <div className="text-slate-200 font-mono text-xs italic">
              {voiceSosState.lastHeardTranscript ? `"${voiceSosState.lastHeardTranscript}"` : 'Listening... no speech detected yet.'}
            </div>
            {voiceSosState.lastTriggeredPhrase && (
              <div className="pt-1 border-t border-slate-800 text-[11px] text-pink-300">
                Last Emergency Trigger: <strong>"{voiceSosState.lastTriggeredPhrase}"</strong> at {voiceSosState.lastTriggeredAt}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                voiceSosService.simulatePhraseDetection('Send SOS');
              }}
              className="px-4 py-2 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-600 text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-pink-400" />
              <span>Test Voice SOS ("Send SOS")</span>
            </button>

            <button
              type="button"
              onClick={() => {
                voiceSosService.simulatePhraseDetection('உடனடி உதவி');
              }}
              className="px-4 py-2 rounded-xl bg-pink-900/80 hover:bg-pink-800 text-pink-200 border border-pink-600 text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-pink-300" />
              <span>Test Tamil SOS ("உடனடி உதவி")</span>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-left text-[11px] text-slate-400 space-y-1 max-w-lg">
            <div className="font-bold text-slate-300 flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Android &amp; Appilix Compatibility</span>
            </div>
            <p>
              Requires foreground microphone permission. Audio matching is performed strictly on your device for emergency keywords and is never uploaded or saved to any server. Android OS suspends WebView microphone access when minimized or locked without a native Android foreground service.
            </p>
          </div>
        </div>
      )}

      {/* Triggered Action Notification Banner */}
      {triggeredAction && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950 to-indigo-950 border border-cyan-600/80 text-cyan-200 text-xs font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>
              Voice Action Triggered: <strong>{triggeredAction}</strong>
            </span>
          </div>
          <button onClick={() => setTriggeredAction(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error / Permission Denied / Network Failure Banner with Retry Buttons */}
      {(voiceState === 'permission_denied' ||
        voiceState === 'error' ||
        voiceState === 'connection_lost' ||
        Boolean(errorMessage)) && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-600 space-y-2.5 text-rose-100 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Voice Assistant Notice {errorCode ? `(${errorCode})` : ''}
              </h4>
            </div>
            <button
              onClick={() => {
                setErrorMessage('');
                if (voiceState === 'error' || voiceState === 'connection_lost') {
                  setVoiceState('idle');
                }
              }}
              className="text-rose-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs leading-relaxed">
            {errorMessage || 'Voice assistant encountered a temporary issue.'}
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            {canRetryApi && lastSubmittedQuery && (
              <button
                onClick={() => processUserVoiceQuery(lastSubmittedQuery)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry AI Request</span>
              </button>
            )}

            <button
              onClick={startVoiceSession}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 text-cyan-400" />
              <span>Retry Microphone Listening</span>
            </button>

            {voiceState === 'permission_denied' && (
              <button
                onClick={() => permissionService.openAppSettings()}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Open App Settings</span>
              </button>
            )}

            <button
              onClick={onSwitchToTextChat}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer"
            >
              Continue in Text Mode
            </button>
          </div>
        </div>
      )}

      {/* Normal Assistant Mode Display */}
      {assistantMode === 'normal' && (
        <>

      {/* Main Voice Spectrum & Recording Hero Display */}
      <div className="flex flex-col items-center justify-center py-6 space-y-5 bg-slate-950/80 rounded-3xl border border-slate-800/80 p-6 shadow-inner text-center">
        <div className="relative flex items-center justify-center">
          {(voiceState === 'listening' || voiceState === 'speaking') && (
            <div
              className={`absolute w-36 h-36 rounded-full animate-ping opacity-25 ${
                voiceState === 'listening' ? 'bg-cyan-500' : 'bg-purple-500'
              }`}
            />
          )}

          <button
            type="button"
            aria-label={
              voiceState === 'listening'
                ? 'Stop recording speech'
                : voiceState === 'speaking'
                ? 'Interrupt spoken response'
                : 'Start microphone listening'
            }
            onClick={async () => {
              if (voiceState === 'listening') {
                if (isAudioRecordingFallback) {
                  setIsAudioRecordingFallback(false);
                  setVoiceState('processing');
                  try {
                    const transcribed = await voiceService.stopAudioRecordingAndTranscribe(
                      selectedLanguage === 'auto' ? 'en-US' : selectedLanguage
                    );
                    stopMicAndStream();
                    if (transcribed && transcribed.trim()) {
                      const cleanText = transcribed.trim();
                      setTranscript(cleanText);
                      const matched = voiceSosService.matchTriggerPhrase(cleanText);
                      if (matched) {
                        setTriggeredAction(`Voice SOS Trigger Detected: "${matched}"`);
                        voiceSosService.simulatePhraseDetection(cleanText);
                        return;
                      }
                      if (reviewBeforeSend) {
                        setVoiceState('reviewing');
                        transcriptInputRef.current?.focus();
                      } else {
                        processUserVoiceQuery(cleanText);
                      }
                    } else {
                      setVoiceState('error');
                      setErrorMessage('No clear speech was recognized in the audio. Please try speaking again or type below.');
                    }
                  } catch (err: any) {
                    stopMicAndStream();
                    setVoiceState('error');
                    setErrorMessage(err?.message || 'Audio transcription error');
                  }
                  return;
                }

                stopMicAndStream();
                setVoiceState(transcript.trim() ? 'reviewing' : 'idle');
              } else if (voiceState === 'speaking') {
                interruptSpeaking();
              } else {
                startVoiceSession();
              }
            }}
            className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-2xl transition-transform active:scale-95 cursor-pointer z-10 ${
              voiceState === 'listening'
                ? 'bg-cyan-600 border-cyan-400 text-white shadow-cyan-950'
                : voiceState === 'speaking'
                ? 'bg-purple-600 border-purple-400 text-white shadow-purple-950'
                : 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 border-indigo-400 text-white shadow-indigo-950 hover:scale-105'
            }`}
          >
            {voiceState === 'listening' ? (
              <Mic className="w-10 h-10 animate-pulse stroke-[2.5]" />
            ) : voiceState === 'speaking' ? (
              <Volume2 className="w-10 h-10 animate-bounce stroke-[2.5]" />
            ) : (
              <Mic className="w-10 h-10 stroke-[2.5]" />
            )}

            <span className="text-[10px] font-black uppercase tracking-wider mt-1">
              {voiceState === 'listening'
                ? 'Stop Mic'
                : voiceState === 'speaking'
                ? 'Interrupt'
                : 'Start Voice'}
            </span>
          </button>
        </div>

        {/* 32-Bar Real-Time Web Audio Frequency Spectrum Analyzer */}
        <div className="w-full max-w-md h-14 flex items-end justify-center gap-1.5 px-4 pt-2">
          {audioLevels.map((level, idx) => (
            <div
              key={idx}
              style={{ height: `${Math.max(10, level)}%` }}
              className={`flex-1 rounded-full transition-all duration-75 ${
                voiceState === 'listening'
                  ? 'bg-gradient-to-t from-cyan-600 to-cyan-300'
                  : voiceState === 'speaking'
                  ? 'bg-gradient-to-t from-purple-600 to-pink-400'
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* State Status Descriptor */}
        <div className="space-y-1">
          <h3 className="text-base font-black text-white">
            {voiceState === 'listening' && 'Listening... Speak your question clearly'}
            {voiceState === 'reviewing' && 'Review or edit your recognized question below, then tap Send'}
            {voiceState === 'processing' && 'Processing your question...'}
            {voiceState === 'generating' && 'Smart Shield AI is generating an answer...'}
            {voiceState === 'speaking' && 'Smart Shield AI is speaking the answer...'}
            {voiceState === 'interrupted' && 'Spoken audio interrupted'}
            {voiceState === 'idle' && 'Tap Start Voice to speak, or type/edit your question below'}
            {voiceState === 'session_ended' && 'Voice session ended'}
            {(voiceState === 'error' || voiceState === 'permission_denied' || voiceState === 'connection_lost') &&
              'Voice session paused — use Retry or edit your question below'}
          </h3>
        </div>

        {/* Audio Output & Review Mode Controls Bar */}
        <div className="flex flex-wrap items-center justify-center gap-4 bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-800 text-xs font-bold text-slate-300">
          <button
            type="button"
            onClick={() => {
              if (!isMuted && isTtsAvailable) {
                window.speechSynthesis.cancel();
              }
              setIsMuted(!isMuted);
            }}
            disabled={!isTtsAvailable}
            className="flex items-center space-x-1.5 hover:text-white transition-colors disabled:opacity-50"
          >
            {isMuted || !isTtsAvailable ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
            <span>
              {!isTtsAvailable
                ? 'TTS Unavailable'
                : isMuted
                ? 'Spoken Output Muted'
                : 'Spoken Output On'}
            </span>
          </button>

          <span className="text-slate-700">•</span>

          <div className="flex items-center space-x-1.5">
            <span>Speed:</span>
            <button
              type="button"
              onClick={() => setSpeechRate(speechRate === 1.0 ? 1.2 : speechRate === 1.2 ? 0.85 : 1.0)}
              className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono border border-slate-700"
            >
              {speechRate}x
            </button>
          </div>

          <span className="text-slate-700">•</span>

          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={reviewBeforeSend}
              onChange={(e) => setReviewBeforeSend(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-cyan-500"
            />
            <span>Review speech before sending</span>
          </label>

          <span className="text-slate-700">•</span>

          <button
            type="button"
            onClick={endVoiceSession}
            className="text-rose-400 hover:text-rose-300 font-bold"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Editable Recognized Question & AI Response Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* User Recognized Speech Box (Editable so user can correct recognition errors) */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Recognized Question (Editable)</span>
            </span>
            <span className="text-[10px] text-slate-400 flex items-center space-x-1">
              <Edit3 className="w-3 h-3" />
              <span>Edit before sending</span>
            </span>
          </div>

          <textarea
            ref={transcriptInputRef}
            rows={3}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Your spoken question will appear here. You can edit or type corrections before sending..."
            className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-cyan-500 focus:outline-none text-xs text-slate-100 font-medium leading-relaxed resize-none"
          />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setTranscript('')}
              disabled={!transcript}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-400 hover:text-white text-xs font-bold border border-slate-800"
            >
              Clear Text
            </button>

            <button
              type="button"
              disabled={!transcript.trim() || voiceState === 'generating' || voiceState === 'processing'}
              onClick={() => processUserVoiceQuery(transcript)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center space-x-1.5 shadow-lg"
            >
              <span>Send Question to AI</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* AI Spoken Response Box */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Bot className="w-3.5 h-3.5" />
              <span>Smart Shield AI Answer</span>
            </span>
            <div className="flex items-center space-x-2">
              {voiceState === 'speaking' ? (
                <button
                  type="button"
                  onClick={interruptSpeaking}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-600/80 text-[11px] text-rose-300 font-bold flex items-center space-x-1 hover:bg-rose-900 cursor-pointer"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Stop Playback</span>
                </button>
              ) : (
                aiResponseText && isTtsAvailable && !isMuted && (
                  <button
                    type="button"
                    onClick={() => speakAiResponse(aiResponseText)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Repeat Answer</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 min-h-[115px] max-h-[220px] overflow-y-auto text-xs text-slate-200 font-medium leading-relaxed whitespace-pre-wrap">
            {aiResponseText || 'Smart Shield AI answer will appear here and be spoken aloud when enabled...'}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
