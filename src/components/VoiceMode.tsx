import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  X,
  Bot,
  ShieldAlert,
  RotateCcw,
  AlertCircle,
  MessageSquare,
  Send
} from 'lucide-react';
import { LocationData, ChatMessage } from '../types';
import { voiceService } from '../services/voiceService';
import { StorageService } from '../services/storage';
import { permissionService } from '../services/permissionService';
import { AIService } from '../services/aiService';
import { voiceSosService } from '../services/voiceSosService';

interface VoiceModeProps {
  location: LocationData | null;
  onClose: () => void;
  triggerSOS?: () => void;
  triggerFakeCall?: () => void;
  setActiveTab?: (tab: string) => void;
}

export type MicPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported';

export const VoiceMode: React.FC<VoiceModeProps> = ({
  location,
  onClose,
  triggerSOS,
  triggerFakeCall,
  setActiveTab
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [micPermission, setMicPermission] = useState<MicPermissionState>('prompt');

  const [transcript, setTranscript] = useState<string>('');
  const [aiResponseText, setAiResponseText] = useState<string>('');
  const [selectedLang, setSelectedLang] = useState<string>('en-US');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [canRetry, setCanRetry] = useState<boolean>(false);
  const [lastQuery, setLastQuery] = useState<string>('');

  const [barHeights, setBarHeights] = useState<number[]>(new Array(16).fill(20));
  const animIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as any })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'granted') setMicPermission('granted');
          else if (permissionStatus.state === 'denied') setMicPermission('denied');
          else setMicPermission('prompt');

          permissionStatus.onchange = () => {
            if (permissionStatus.state === 'granted') setMicPermission('granted');
            else if (permissionStatus.state === 'denied') setMicPermission('denied');
            else setMicPermission('prompt');
          };
        })
        .catch(() => {
          setMicPermission('prompt');
        });
    } else {
      setMicPermission('prompt');
    }

    return () => {
      voiceService.stopListening();
      voiceService.stopSpeaking();
      AIService.cancelActiveRequest();
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, []);

  const startSpectrumAnimation = () => {
    if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    animIntervalRef.current = setInterval(() => {
      setBarHeights(Array.from({ length: 16 }, () => Math.floor(Math.random() * 85) + 15));
    }, 100);
  };

  const stopSpectrumAnimation = () => {
    if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    setBarHeights(new Array(16).fill(20));
  };

  const handleStartListening = async () => {
    setErrorMessage('');
    setCanRetry(false);
    voiceService.stopSpeaking();

    const micGranted = await permissionService.requestMicrophonePermission();
    if (!micGranted) {
      setMicPermission('denied');
      setErrorMessage(
        'Microphone access is required for voice recognition. Please grant permission in your browser/device settings or type your question below.'
      );
      return;
    }

    setMicPermission('granted');

    const success = voiceService.startListening(
      {
        onStart: () => {
          setIsListening(true);
          setMicPermission('granted');
          startSpectrumAnimation();
        },
        onResult: (text, isFinal) => {
          setTranscript(text);
          const matchedSos = voiceSosService.matchTriggerPhrase(text);
          if (matchedSos) {
            setIsListening(false);
            stopSpectrumAnimation();
            voiceSosService.simulatePhraseDetection(text);
            return;
          }
          if (isFinal) {
            setIsListening(false);
            stopSpectrumAnimation();
          }
        },
        onError: (err) => {
          setIsListening(false);
          stopSpectrumAnimation();
          const errStr = String(err?.message || err || '');
          if (errStr.includes('not-allowed') || errStr.includes('permission')) {
            setMicPermission('denied');
            setErrorMessage(
              'Microphone access was denied. Please allow microphone permissions or edit your question below.'
            );
          } else if (errStr.includes('no-speech')) {
            setErrorMessage(
              'No clear speech was detected. Please tap Start Mic to try again or type your question below.'
            );
          } else {
            setErrorMessage(`Voice recognition notice: ${errStr}`);
          }
        },
        onEnd: () => {
          setIsListening(false);
          stopSpectrumAnimation();
        }
      },
      selectedLang
    );

    if (!success && !errorMessage) {
      setErrorMessage('Speech recognition is not supported in this browser. Please type your question below.');
    }
  };

  const handleStopListening = () => {
    voiceService.stopListening();
    setIsListening(false);
    stopSpectrumAnimation();
  };

  const handleSendVoiceQuery = async (queryText: string) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery || isProcessing) return;

    handleStopListening();
    setErrorMessage('');
    setCanRetry(false);
    setLastQuery(cleanQuery);
    setIsProcessing(true);

    const lower = cleanQuery.toLowerCase();
    const matchedSos = voiceSosService.matchTriggerPhrase(cleanQuery);
    if ((matchedSos || lower === 'trigger sos' || lower === 'emergency sos') && triggerSOS) {
      triggerSOS();
    } else if (lower.includes('fake call') && triggerFakeCall) {
      triggerFakeCall();
    } else if (lower.includes('safe walk') && setActiveTab) {
      setActiveTab('safety');
    }

    const history = StorageService.getChatHistory();
    const lastEntry = history[history.length - 1];
    let newHistory = [...history];

    if (!lastEntry || lastEntry.role !== 'user' || lastEntry.content !== cleanQuery) {
      const userMsg: ChatMessage = {
        id: `u-vmode-${Date.now()}`,
        role: 'user',
        content: cleanQuery,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: 'universal'
      };
      newHistory = [...newHistory, userMsg];
      StorageService.saveChatHistory(newHistory);
    }

    const result = await AIService.sendMessage(
      newHistory.map((m) => ({ role: m.role, content: m.content })),
      {
        contextMode: 'universal',
        locationContext: location,
        selectedModel: 'gemini-3.1-flash-lite'
      }
    );

    setIsProcessing(false);

    if (result.status === 'cancelled') {
      return;
    }

    if (result.status === 'error') {
      setErrorMessage(result.errorMessage || 'Unable to connect to Smart Shield AI.');
      setCanRetry(result.canRetry ?? true);
      return;
    }

    const answer = result.text;
    setAiResponseText(answer);

    const assistantMsg: ChatMessage = {
      id: `a-vmode-${Date.now()}`,
      role: 'assistant',
      content: answer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode: 'universal',
      model: result.model
    };
    StorageService.saveChatHistory([...newHistory, assistantMsg]);

    if (!isMuted && voiceService.isSynthesisSupported()) {
      startSpectrumAnimation();
      voiceService.speak(answer, {
        lang: selectedLang,
        rate: speechRate,
        onStart: () => setIsSpeaking(true),
        onEnd: () => {
          setIsSpeaking(false);
          stopSpectrumAnimation();
        },
        onError: () => {
          setIsSpeaking(false);
          stopSpectrumAnimation();
        }
      });
    }
  };

  const handleInterruptSpeaking = () => {
    voiceService.stopSpeaking();
    setIsSpeaking(false);
    stopSpectrumAnimation();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col justify-between p-6 sm:p-10 text-white overflow-y-auto">
      {/* Top Bar: Title, Permission Status & Independent Emergency SOS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-black text-white">Smart Shield Voice Mode</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider flex items-center space-x-1 ${
                  micPermission === 'granted'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : micPermission === 'denied'
                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                    : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}
              >
                <span>Mic: {micPermission}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Speak, review &amp; edit recognized speech before sending
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {triggerSOS && (
            <button
              onClick={triggerSOS}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase flex items-center space-x-1.5 shadow-lg"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Emergency SOS</span>
            </button>
          )}

          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="bg-slate-900 text-xs text-slate-200 px-3 py-2 rounded-xl border border-slate-800"
          >
            <option value="en-US">English (en-US)</option>
            <option value="ta-IN">Tamil (தமிழ் / ta-IN)</option>
          </select>

          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            title="Exit Voice Mode"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Banner with Retry Button */}
      {errorMessage && (
        <div
          role="alert"
          className="max-w-lg w-full mx-auto my-2 p-4 rounded-2xl bg-rose-950/90 border border-rose-600 text-rose-100 text-xs space-y-2 shadow-xl"
        >
          <div className="flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          {canRetry && lastQuery && (
            <button
              onClick={() => handleSendVoiceQuery(lastQuery)}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Question</span>
            </button>
          )}
        </div>
      )}

      {/* Center Hero: Microphone, Spectrum & Editable Transcript */}
      <div className="flex flex-col items-center justify-center my-auto space-y-6 text-center max-w-xl w-full mx-auto py-4">
        <div className="relative flex items-center justify-center">
          {(isListening || isSpeaking) && (
            <div
              className={`absolute -inset-6 rounded-full blur-2xl opacity-60 animate-ping ${
                isListening ? 'bg-cyan-500' : 'bg-purple-500'
              }`}
            />
          )}

          <button
            onClick={
              isListening
                ? handleStopListening
                : isSpeaking
                ? handleInterruptSpeaking
                : handleStartListening
            }
            className={`relative w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-2xl transition-transform active:scale-95 cursor-pointer ${
              isListening
                ? 'bg-cyan-600 border-cyan-300 text-white shadow-cyan-950'
                : isSpeaking
                ? 'bg-purple-600 border-purple-300 text-white shadow-purple-950'
                : 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-600 border-purple-400 text-white shadow-purple-950 hover:scale-105'
            }`}
          >
            {isListening ? (
              <Mic className="w-10 h-10 animate-pulse stroke-[2.2]" />
            ) : isSpeaking ? (
              <Volume2 className="w-10 h-10 animate-bounce stroke-[2.2]" />
            ) : (
              <Mic className="w-10 h-10 stroke-[2.2]" />
            )}
            <span className="text-[10px] font-black uppercase tracking-wider mt-1">
              {isListening ? 'Stop Mic' : isSpeaking ? 'Interrupt' : 'Start Mic'}
            </span>
          </button>
        </div>

        <div className="w-full max-w-xs h-12 flex items-end justify-between gap-1.5 px-4 bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800">
          {barHeights.map((h, idx) => (
            <div
              key={idx}
              style={{ height: `${h}%` }}
              className={`flex-1 rounded-full transition-all duration-150 ${
                isListening
                  ? 'bg-gradient-to-t from-cyan-600 to-cyan-300'
                  : isSpeaking
                  ? 'bg-gradient-to-t from-purple-600 to-pink-400'
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-black text-white">
            {isListening && 'Listening to your speech...'}
            {isProcessing && 'Smart Shield AI is answering...'}
            {isSpeaking && 'Speaking response aloud...'}
            {!isListening && !isSpeaking && !isProcessing && 'Speak or edit your question below'}
          </h3>
        </div>

        {/* Editable Recognized Question Box */}
        <div className="w-full space-y-3 text-left">
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-cyan-400 uppercase block">
              Recognized Question (Review &amp; Edit before sending):
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Your spoken question will appear here (or type directly)..."
                className="flex-1 bg-slate-950 text-white text-xs px-3 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                disabled={!transcript.trim() || isProcessing}
                onClick={() => handleSendVoiceQuery(transcript)}
                className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold flex items-center space-x-1.5"
              >
                <span>Ask AI</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {aiResponseText && (
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200 max-h-44 overflow-y-auto whitespace-pre-wrap">
              <span className="text-[10px] font-bold text-purple-400 uppercase block mb-1">
                Smart Shield AI Answer:
              </span>
              {aiResponseText}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer Controls Bar */}
      <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (!isMuted) voiceService.stopSpeaking();
              setIsMuted(!isMuted);
            }}
            className="flex items-center space-x-1.5 text-slate-400 hover:text-white"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
            <span>{isMuted ? 'Spoken Output Muted' : 'Spoken Output On'}</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold flex items-center space-x-2 shadow-lg"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Return to Text Chat</span>
        </button>
      </div>
    </div>
  );
};
