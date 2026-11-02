import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  Trash2,
  Baby,
  ShieldAlert,
  Search,
  MapPin,
  Mic,
  MicOff,
  Loader2,
  Zap,
  Brain,
  RotateCcw,
  AlertTriangle,
  Volume2,
  VolumeX,
  X,
  Heart,
  Utensils,
  Compass,
  PhoneCall,
  Settings,
  ExternalLink,
  Globe,
  Copy,
  Check,
  BookOpen,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck
} from 'lucide-react';
import { ChatMessage, AIChatMode, LocationData, UserAIMemoryStore } from '../types';
import { AIService, AIErrorCode } from '../services/aiService';
import { StorageService } from '../services/storage';
import { MemoryService } from '../services/memoryService';
import { voiceService } from '../services/voiceService';
import { permissionService } from '../services/permissionService';
import { ShieldVoiceAssistant } from './ShieldVoiceAssistant';
import { VoiceMode } from './VoiceMode';

interface ShieldAIChatProps {
  location: LocationData | null;
  pregnancyActive: boolean;
  triggerSOS?: () => void;
  triggerFakeCall?: () => void;
  setActiveTab?: (tab: string) => void;
}

const MODE_CONFIG: {
  id: AIChatMode;
  label: string;
  icon: React.FC<{ className?: string }>;
  prompts: string[];
}[] = [
  {
    id: 'universal',
    label: 'All Topics',
    icon: Sparkles,
    prompts: [
      'What should I eat now?',
      'How much water have I consumed today?',
      'Is my nutrition progress improving?',
      'How do I share my live location with emergency contacts?'
    ]
  },
  {
    id: 'safety',
    label: 'Personal Safety & SOS',
    icon: ShieldAlert,
    prompts: [
      'What should I do if I feel someone is following me at night?',
      'How does the Smart Shield Emergency SOS countdown and evidence recording work?',
      'How can I prepare a personal safety plan for daily commuting?'
    ]
  },
  {
    id: 'gps',
    label: 'GPS & App Help',
    icon: Compass,
    prompts: [
      'My GPS location is showing inaccurate or unavailable. How do I fix it?',
      'How do I add or update my primary emergency contacts in Smart Shield?',
      'Why does the app need microphone and camera permissions for SOS?'
    ]
  },
  {
    id: 'menstrual',
    label: 'Menstrual Wellness',
    icon: Heart,
    prompts: [
      'What is a normal menstrual cycle length and how do I track my fertile window?',
      'What helps ease severe period cramps and lower back pain?',
      'When should heavy menstrual bleeding be evaluated by a doctor?'
    ]
  },
  {
    id: 'pregnancy',
    label: 'Pregnancy Wellness',
    icon: Baby,
    prompts: [
      'What are the key pregnancy warning signs that require urgent medical care?',
      'Which foods should I avoid during pregnancy for food safety?',
      'How can I manage morning sickness in the first trimester?'
    ]
  },
  {
    id: 'nutrition',
    label: 'Meals & Nutrition',
    icon: Utensils,
    prompts: [
      'What should I eat now?',
      'How much water have I consumed today?',
      'I missed my breakfast',
      "Give me tomorrow's diet",
      'Is my nutrition progress improving?'
    ]
  }
];

export const ShieldAIChat: React.FC<ShieldAIChatProps> = ({
  location,
  pregnancyActive,
  triggerSOS,
  triggerFakeCall,
  setActiveTab
}) => {
  const [activeViewMode, setActiveViewMode] = useState<'text' | 'voice'>('text');
  const [showVoiceOverlay, setShowVoiceOverlay] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<AIChatMode>(pregnancyActive ? 'pregnancy' : 'universal');
  const [loading, setLoading] = useState(false);

  // Error & Retry state (never fabricates fake AI answers on failure)
  const [errorState, setErrorState] = useState<{
    message: string;
    code?: AIErrorCode;
    canRetry: boolean;
    failedPrompt?: string;
  } | null>(null);

  // Model Selection State (defaults to current stable gemini-3.8-flash)
  const [selectedModelTier, setSelectedModelTier] = useState<
    'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-4-argon'
  >('gemini-3.8-flash');

  // Grounding Toggles
  const [enableSearchGrounding, setEnableSearchGrounding] = useState(false);
  const [enableMapsGrounding, setEnableMapsGrounding] = useState(false);

  // Active Source Citation Tooltip Modal State
  const [activeTooltipSource, setActiveTooltipSource] = useState<{
    source: { title: string; url: string; snippet?: string };
    index: number;
    msgId: string;
  } | null>(null);

  // Dedicated Source Citations List Expanded State (msgId -> boolean)
  const [expandedCitationLists, setExpandedCitationLists] = useState<Record<string, boolean>>({});

  // Copied Link Status State
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const toggleCitationList = (msgId: string) => {
    setExpandedCitationLists((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const handleCopyUrl = (url: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2500);
      }).catch(() => {});
    }
  };

  // Voice Input (Speech-to-Text in Chat Bar) & Spoken Output (TTS)
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [voiceInputNotice, setVoiceInputNotice] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  const [isSpeakingTts, setIsSpeakingTts] = useState<boolean>(false);
  const [voiceLang, setVoiceLang] = useState<'en-US' | 'ta-IN'>('en-US');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const createWelcomeMessage = (): ChatMessage => ({
    id: 'welcome-1',
    role: 'assistant',
    content: `Hello! I am the **Smart Shield AI Assistant**, your safety-focused assistant for women's safety and wellness.

I can help you with:
1. **Personal Safety & SOS**: Emergency preparedness, safety planning, and SOS guidance.
2. **App & GPS Troubleshooting**: Location sharing, permissions, and emergency contacts.
3. **Menstrual Wellness**: Cycle education, symptom comfort, and period care.
4. **Pregnancy Wellness**: Trimester education, food safety, and urgent warning signs.
5. **Nutrition & Meal Planning**: Personalized meal suggestions, recipes, and key nutrients.
6. **Voice & Everyday Questions**: Speak or type in **English** or **Tamil (தமிழ்)**.

*Note: For immediate danger, always press the red **Emergency SOS** button or call local emergency services (112 / 1091).*`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    mode: 'universal'
  });

  const [memoryStore, setMemoryStore] = useState<UserAIMemoryStore>(() => MemoryService.getCachedMemoryStore());

  useEffect(() => {
    const history = StorageService.getChatHistory();
    if (history.length > 0) {
      setMessages(history);
    } else {
      const welcome = createWelcomeMessage();
      setMessages([welcome]);
      StorageService.saveChatHistory([welcome]);
    }

    // Load authenticated user's Personal AI Memory & restore cross-session conversation continuity
    MemoryService.fetchMemoryStore()
      .then((serverMem) => {
        setMemoryStore(serverMem);
        if (
          serverMem.settings.memoryEnabled &&
          Array.isArray(serverMem.activeConversationMessages) &&
          serverMem.activeConversationMessages.length > 0
        ) {
          const localHist = StorageService.getChatHistory();
          // If local history only has the welcome message, restore from server memory continuity
          if (localHist.length <= 1) {
            const restored = [createWelcomeMessage(), ...serverMem.activeConversationMessages];
            setMessages(restored);
            StorageService.saveChatHistory(restored);
          }
        }
      })
      .catch(() => {});

    const onMemUpdate = (e: Event) => {
      const custom = e as CustomEvent<UserAIMemoryStore>;
      if (custom.detail) setMemoryStore(custom.detail);
    };
    window.addEventListener('smartshield-memory-updated', onMemUpdate);

    return () => {
      window.removeEventListener('smartshield-memory-updated', onMemUpdate);
      AIService.cancelActiveRequest();
      voiceService.stopListening();
      voiceService.stopSpeaking();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, errorState]);

  const speakMessageAloud = (text: string) => {
    if (!voiceService.isSynthesisSupported()) return;
    voiceService.speak(text, {
      lang: voiceLang,
      rate: 1.0,
      onStart: () => setIsSpeakingTts(true),
      onEnd: () => setIsSpeakingTts(false),
      onError: () => setIsSpeakingTts(false)
    });
  };

  const stopSpeakingAloud = () => {
    voiceService.stopSpeaking();
    setIsSpeakingTts(false);
  };

  const sendPromptText = async (promptText: string, isRetryAttempt = false) => {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;

    setErrorState(null);
    setVoiceInputNotice(null);

    let updatedThread = [...messages];

    // Only append user message if it's not already the last message in thread (e.g., on Retry)
    const lastMsg = updatedThread[updatedThread.length - 1];
    if (!isRetryAttempt || !lastMsg || lastMsg.role !== 'user' || lastMsg.content !== trimmed) {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode
      };
      updatedThread = [...updatedThread, userMsg];
      setMessages(updatedThread);
      StorageService.saveChatHistory(updatedThread);
    }

    if (!isRetryAttempt) {
      setInput('');
    }

    setLoading(true);

    const apiPayload = updatedThread.map((m) => ({
      role: m.role,
      content: m.content
    }));

    const result = await AIService.sendMessage(apiPayload, {
      contextMode: mode,
      locationContext: location,
      selectedModel: selectedModelTier,
      enableSearchGrounding,
      enableMapsGrounding
    });

    setLoading(false);

    if (result.status === 'cancelled') {
      return;
    }

    if (result.status === 'error') {
      setErrorState({
        message: result.errorMessage || 'Unable to generate a response. Please try again.',
        code: result.errorCode,
        canRetry: result.canRetry ?? true,
        failedPrompt: trimmed
      });
      return;
    }

    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: result.text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode,
      model: result.model,
      groundingSources: result.groundingSources,
      memoriesUsed: result.memoriesUsed,
      memoriesLearned: result.memoriesLearned,
      pendingConsentPrompts: result.pendingConsentPrompts
    };

    const finalMessages = [...updatedThread, assistantMsg];
    setMessages(finalMessages);
    StorageService.saveChatHistory(finalMessages);

    if (ttsEnabled && voiceService.isSynthesisSupported()) {
      speakMessageAloud(result.text);
    }
  };

  const handleSend = async () => {
    await sendPromptText(input, false);
  };

  const handleRetry = async () => {
    if (!errorState?.failedPrompt) return;
    await sendPromptText(errorState.failedPrompt, true);
  };

  const handleCancelRequest = () => {
    AIService.cancelActiveRequest();
    setLoading(false);
  };

  // Speech-to-Text in chat input bar: converts speech to text and places it in the input box for review/correction
  const handleToggleMicInput = async () => {
    setVoiceInputNotice(null);

    if (isListeningMic) {
      voiceService.stopListening();
      setIsListeningMic(false);
      return;
    }

    if (!voiceService.isRecognitionSupported()) {
      setVoiceInputNotice(
        'Speech recognition is not supported in this browser. Please type your question or use Chrome/Edge.'
      );
      return;
    }

    const micGranted = await permissionService.requestMicrophonePermission();
    if (!micGranted) {
      setVoiceInputNotice(
        'Microphone permission was denied. Please enable microphone access in your browser/device settings to use voice input.'
      );
      return;
    }

    stopSpeakingAloud();

    const started = voiceService.startListening(
      {
        onStart: () => {
          setIsListeningMic(true);
          setVoiceInputNotice('Listening... Speak clearly. You can review and edit the recognized text before sending.');
        },
        onResult: (transcriptText, isFinal) => {
          setInput(transcriptText);
          if (isFinal) {
            setIsListeningMic(false);
            setVoiceInputNotice('Speech recognized! Review or edit your question below, then tap Send.');
            inputRef.current?.focus();
          }
        },
        onError: (err) => {
          setIsListeningMic(false);
          const errStr = String(err?.message || err || '');
          if (errStr.includes('not-allowed') || errStr.includes('permission')) {
            setVoiceInputNotice('Microphone access was blocked. Please grant microphone permission and try again.');
          } else if (errStr.includes('no-speech')) {
            setVoiceInputNotice('No speech was detected (or background noise was too high). Please tap the mic and speak again.');
          } else if (errStr.includes('network')) {
            setVoiceInputNotice('Speech recognition failed due to a network error. You can still type your question below.');
          } else {
            setVoiceInputNotice(`Voice recognition notice: ${errStr}. Please try again or type your question.`);
          }
        },
        onEnd: () => {
          setIsListeningMic(false);
        }
      },
      voiceLang
    );

    if (!started) {
      setVoiceInputNotice('Unable to start microphone listening. Please type your question below.');
    }
  };

  const clearHistory = () => {
    AIService.cancelActiveRequest();
    stopSpeakingAloud();
    StorageService.clearChatHistory();
    MemoryService.clearConversationHistory('conversations').catch(() => {});
    const welcome = createWelcomeMessage();
    setMessages([welcome]);
    StorageService.saveChatHistory([welcome]);
    setErrorState(null);
  };

  const currentModeConfig = MODE_CONFIG.find((m) => m.id === mode) || MODE_CONFIG[0];

  return (
    <div className="space-y-5 pb-12">
      {/* Full-Screen Voice Mode Overlay Modal */}
      {showVoiceOverlay && (
        <VoiceMode
          location={location}
          onClose={() => setShowVoiceOverlay(false)}
          triggerSOS={triggerSOS}
          triggerFakeCall={triggerFakeCall}
          setActiveTab={setActiveTab}
        />
      )}

      {/* Top Navigation Switch: Text Chat vs Voice Assistant + Always-On Independent SOS Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex flex-wrap items-center gap-1.5 font-extrabold text-xs">
          <button
            onClick={() => setActiveViewMode('text')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 ${
              activeViewMode === 'text'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-purple-200" />
            <span>AI Chat</span>
          </button>

          <button
            onClick={() => setActiveViewMode('voice')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 ${
              activeViewMode === 'voice'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic className="w-4 h-4 text-cyan-300" />
            <span>Voice Assistant</span>
          </button>

          <button
            onClick={() => setShowVoiceOverlay(true)}
            className="px-3.5 py-2.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-700/80 text-cyan-300 transition-all flex items-center space-x-1.5"
            title="Launch Full-Screen Voice Overlay Mode"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Full Voice Overlay</span>
          </button>
        </div>

        {/* Independent Emergency SOS Trigger — Never disabled even if AI service fails */}
        <div className="flex items-center space-x-2">
          {triggerFakeCall && (
            <button
              onClick={triggerFakeCall}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 transition-colors"
              title="Trigger Fake Incoming Call"
            >
              <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Fake Call</span>
            </button>
          )}
          {triggerSOS && (
            <button
              onClick={triggerSOS}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-lg shadow-rose-950/60 transition-all"
              title="Emergency SOS operates independently of AI service"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Emergency SOS</span>
            </button>
          )}
        </div>
      </div>

      {activeViewMode === 'voice' ? (
        <ShieldVoiceAssistant
          location={location}
          pregnancyActive={pregnancyActive}
          triggerSOS={triggerSOS || (() => {})}
          triggerFakeCall={triggerFakeCall || (() => {})}
          setActiveTab={setActiveTab || (() => {})}
          onSwitchToTextChat={() => setActiveViewMode('text')}
        />
      ) : (
        <>
          {/* Header, Domain Topic Tabs & Model Controls */}
          <div className="rounded-2xl bg-slate-900 p-5 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center flex-wrap gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-black text-white">Smart Shield AI Assistant</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">
                    {selectedModelTier}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab?.('memory')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                      memoryStore.settings.memoryEnabled
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60 hover:bg-emerald-900'
                        : 'bg-amber-950/80 text-amber-300 border-amber-600/60 hover:bg-amber-900'
                    }`}
                    title="Open My AI Memory Dashboard"
                  >
                    <Brain className="w-3 h-3" />
                    <span>
                      {memoryStore.settings.memoryEnabled
                        ? `Personal Memory Active (${memoryStore.memoryItems.length})`
                        : 'Memory Paused'}
                    </span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Safety, GPS Help, Menstrual &amp; Pregnancy Wellness, Nutrition &amp; Voice • English &amp; தமிழ்
                </p>
              </div>

              {/* Model Tier Selector */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  onClick={() => setSelectedModelTier('gemini-3.1-flash-lite')}
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1 ${
                    selectedModelTier === 'gemini-3.1-flash-lite'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>3.1 Flash Lite (Fast)</span>
                </button>

                <button
                  onClick={() => setSelectedModelTier('gemini-3.8-flash')}
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1 ${
                    selectedModelTier === 'gemini-3.8-flash'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>3.8 Flash</span>
                </button>

                <button
                  onClick={() => setSelectedModelTier('gemini-4-argon')}
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1 ${
                    selectedModelTier === 'gemini-4-argon'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>4 Argon</span>
                </button>
              </div>
            </div>

            {/* 6 Support Area Mode Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {MODE_CONFIG.map((item) => {
                const IconComp = item.icon;
                const isSelected = mode === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setMode(item.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all ${
                      isSelected
                        ? 'bg-indigo-600/90 border-indigo-400 text-white shadow-md'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Grounding, Voice Language, TTS & Clear History Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 font-semibold">
                  <input
                    type="checkbox"
                    checked={enableSearchGrounding}
                    onChange={(e) => {
                      setEnableSearchGrounding(e.target.checked);
                      if (e.target.checked) setEnableMapsGrounding(false);
                    }}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                  />
                  <Search className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Search Grounding</span>
                </label>

                <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 font-semibold">
                  <input
                    type="checkbox"
                    checked={enableMapsGrounding}
                    onChange={(e) => {
                      setEnableMapsGrounding(e.target.checked);
                      if (e.target.checked) setEnableSearchGrounding(false);
                    }}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                  />
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Maps Grounding</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={voiceLang}
                  onChange={(e) => setVoiceLang(e.target.value as 'en-US' | 'ta-IN')}
                  aria-label="Voice recognition and speech language"
                  className="bg-slate-950 text-slate-200 text-xs px-2.5 py-1.5 rounded-xl border border-slate-800"
                >
                  <option value="en-US">Mic/TTS: English</option>
                  <option value="ta-IN">Mic/TTS: தமிழ் (Tamil)</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (ttsEnabled) stopSpeakingAloud();
                    setTtsEnabled(!ttsEnabled);
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                    ttsEnabled
                      ? 'bg-purple-950/90 border-purple-600 text-purple-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Automatically speak AI responses aloud when Text-to-Speech is available"
                >
                  {ttsEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{ttsEnabled ? 'Spoken Replies On' : 'Spoken Replies Off'}</span>
                </button>

                {isSpeakingTts && (
                  <button
                    type="button"
                    onClick={stopSpeakingAloud}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-950 border border-rose-700 text-rose-200 text-xs font-bold"
                  >
                    Stop Audio
                  </button>
                )}

                <button
                  type="button"
                  onClick={clearHistory}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Clear Conversation History"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Suggested Prompts for Active Domain */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Quick Questions:
            </span>
            {currentModeConfig.prompts.map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                disabled={loading}
                onClick={() => sendPromptText(promptText, false)}
                className="text-left text-xs px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-indigo-600/60 transition-all disabled:opacity-50"
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Messages Thread Container */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-6 min-h-[420px] max-h-[600px] overflow-y-auto space-y-4 shadow-inner">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex items-start space-x-3 ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shrink-0 mt-1 shadow-md">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-purple-600 text-white rounded-tr-none shadow-md'
                      : 'bg-slate-800/90 text-slate-100 border border-slate-700/70 rounded-tl-none shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] text-slate-300/80 mb-1.5">
                    <span className="font-semibold uppercase tracking-wider">
                      {m.role === 'user' ? 'You' : 'Smart Shield AI'}
                    </span>
                    <div className="flex items-center space-x-2">
                      {m.role === 'assistant' && voiceService.isSynthesisSupported() && (
                        <button
                          type="button"
                          onClick={() => speakMessageAloud(m.content)}
                          className="text-slate-400 hover:text-cyan-300 transition-colors"
                          title="Read this response aloud"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span>{m.timestamp}</span>
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap font-sans text-sm space-y-1">
                    {m.content}
                  </div>

                  {m.groundingSources && m.groundingSources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-1.5 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Search Grounded Citations ({m.groundingSources.length})</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleCitationList(m.id)}
                          className="text-[11px] font-bold text-indigo-300 hover:text-white flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3 h-3 text-indigo-400" />
                          <span>{expandedCitationLists[m.id] ? 'Hide Dedicated List' : 'View Dedicated List'}</span>
                          {expandedCitationLists[m.id] ? (
                            <ChevronUp className="w-3 h-3 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </div>

                      {/* Interactive Citation Chips with Clickable Tooltip Popups */}
                      <div className="flex flex-wrap gap-1.5">
                        {m.groundingSources.map((source, sIdx) => {
                          const domain = source.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'Web';
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => setActiveTooltipSource({ source, index: sIdx + 1, msgId: m.id })}
                              className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-slate-900 text-[11px] text-cyan-200 hover:text-white border border-cyan-800/80 hover:border-cyan-400 transition-all cursor-pointer shadow-sm group"
                              title={`Click to inspect source citation [${sIdx + 1}]: ${source.title}`}
                            >
                              <span className="w-4 h-4 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700 text-[9px] font-black flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white">
                                {sIdx + 1}
                              </span>
                              <span className="font-medium truncate max-w-[140px]">{domain}</span>
                              <Info className="w-3 h-3 text-cyan-400 opacity-70 group-hover:opacity-100" />
                            </button>
                          );
                        })}
                      </div>

                      {/* Expandable Dedicated Citation List Panel */}
                      {expandedCitationLists[m.id] && (
                        <div className="mt-3 p-3.5 rounded-2xl bg-slate-950 border border-indigo-800/80 space-y-3 animate-fadeIn">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="text-xs font-black text-white flex items-center space-x-1.5">
                              <Globe className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Dedicated Web Search Grounding Citations</span>
                            </span>
                            <span className="text-[10px] font-mono text-indigo-300">
                              Verified Web Sources
                            </span>
                          </div>

                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {m.groundingSources.map((source, sIdx) => {
                              const domain = source.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'Web';
                              return (
                                <div
                                  key={sIdx}
                                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-left space-y-1.5"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center space-x-2">
                                      <span className="w-5 h-5 rounded-full bg-indigo-900 text-indigo-200 border border-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0">
                                        {sIdx + 1}
                                      </span>
                                      <h5 className="text-xs font-bold text-white line-clamp-1">
                                        {source.title}
                                      </h5>
                                    </div>
                                    <div className="flex items-center space-x-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleCopyUrl(source.url)}
                                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                                        title="Copy Source Link"
                                      >
                                        {copiedUrl === source.url ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                      <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                                        title="Open original source article"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  </div>

                                  {source.snippet && (
                                    <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950 p-2 rounded-lg border border-slate-800 italic">
                                      &ldquo;{source.snippet}&rdquo;
                                    </p>
                                  )}

                                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                                    <span className="font-mono text-cyan-300">{domain}</span>
                                    <span className="truncate max-w-[200px] font-mono text-slate-500">{source.url}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Personal AI Memory Badges (Learned or Applied Memories) */}
                  {m.role === 'assistant' &&
                    ((m.memoriesLearned && m.memoriesLearned.length > 0) ||
                      (m.memoriesUsed && m.memoriesUsed.length > 0)) && (
                      <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-1.5">
                        {m.memoriesLearned?.map((mem) => (
                          <button
                            key={`learned-${mem.id}`}
                            type="button"
                            onClick={() => setActiveTab?.('memory')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-600/50 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-900"
                            title="Click to manage in My AI Memory"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Saved to Memory: {mem.value}</span>
                          </button>
                        ))}
                        {m.memoriesUsed && m.memoriesUsed.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab?.('memory')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/90 border border-indigo-600/50 text-[10px] font-semibold text-indigo-200 hover:bg-indigo-900"
                            title="Click to view or edit your saved AI memories"
                          >
                            <Brain className="w-2.5 h-2.5 text-indigo-400" />
                            <span>
                              Personalized with {m.memoriesUsed.length} saved memor{m.memoriesUsed.length === 1 ? 'y' : 'ies'}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                </div>

                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-purple-900 border border-purple-700 flex items-center justify-center shrink-0 mt-1 shadow-md">
                    <User className="w-4 h-4 text-purple-200" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator with Cancel Button */}
            {loading && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-indigo-800/60 text-slate-300 text-xs">
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-700 flex items-center justify-center animate-spin">
                    <Loader2 className="w-4 h-4 text-indigo-400" />
                  </div>
                  <span>Smart Shield AI is generating a response...</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Understandable Error Alert Banner with Retry Button (Never fabricates fake answers) */}
            {errorState && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-600/80 text-rose-100 space-y-3 shadow-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">
                          AI Request Failed
                        </h4>
                        {errorState.code && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-900/80 text-rose-200 border border-rose-700">
                            {errorState.code}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-rose-100 leading-relaxed">{errorState.message}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorState(null)}
                    className="text-rose-300 hover:text-white"
                    aria-label="Dismiss error"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {errorState.canRetry && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={loading}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry Request</span>
                    </button>
                  )}
                  {triggerSOS && (
                    <button
                      type="button"
                      onClick={triggerSOS}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-700/70 font-bold text-xs flex items-center space-x-1.5"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      <span>Emergency SOS Still Active</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Visible Voice Listening / Recognition Status Banner */}
          {(isListeningMic || voiceInputNotice) && (
            <div
              className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                isListeningMic
                  ? 'bg-cyan-950/90 border-cyan-500 text-cyan-100 animate-pulse'
                  : 'bg-slate-900 border-slate-700 text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                {isListeningMic ? (
                  <Mic className="w-4 h-4 text-cyan-400 shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                )}
                <span>{voiceInputNotice || 'Listening to microphone...'}</span>
              </div>
              <div className="flex items-center space-x-2">
                {voiceInputNotice &&
                  (voiceInputNotice.toLowerCase().includes('denied') ||
                    voiceInputNotice.toLowerCase().includes('blocked')) && (
                    <button
                      type="button"
                      onClick={() => permissionService.openAppSettings()}
                      className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Open App Settings</span>
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => {
                    if (isListeningMic) {
                      voiceService.stopListening();
                      setIsListeningMic(false);
                    }
                    setVoiceInputNotice(null);
                  }}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Input Form Bar with Accessible Microphone Controls & Editable Recognized Question */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2.5"
          >
            <button
              type="button"
              onClick={handleToggleMicInput}
              aria-label={isListeningMic ? 'Stop microphone listening' : 'Speak question using microphone'}
              className={`p-3.5 rounded-xl border transition-all shrink-0 flex items-center space-x-1.5 ${
                isListeningMic
                  ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-950'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-400 hover:text-cyan-300'
              }`}
              title={
                isListeningMic
                  ? 'Tap to stop listening'
                  : 'Speak your question (recognized text can be edited before sending)'
              }
            >
              {isListeningMic ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Smart Shield AI (Safety, SOS, GPS, Menstrual, Pregnancy, Nutrition)..."
              className="flex-1 bg-slate-900 text-white placeholder-slate-500 text-sm px-4 py-3.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
            />

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-sm flex items-center space-x-2 shadow-lg transition-all shrink-0"
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}

      {/* Interactive Source Citation Tooltip Popover Modal */}
      {activeTooltipSource && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setActiveTooltipSource(null)}
        >
          <div
            className="bg-slate-900 rounded-3xl border-2 border-indigo-600 p-5 max-w-md w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <span className="w-8 h-8 rounded-2xl bg-cyan-950 border border-cyan-500 text-cyan-300 font-black text-xs flex items-center justify-center shrink-0">
                  #{activeTooltipSource.index}
                </span>
                <div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                    Grounded Web Source Citation
                  </span>
                  <h3 className="text-sm font-extrabold text-white line-clamp-2 mt-0.5">
                    {activeTooltipSource.source.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTooltipSource(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeTooltipSource.source.snippet && (
              <div className="space-y-1 text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Grounded Excerpt / Fact Quote:
                </span>
                <p className="text-xs text-slate-200 leading-relaxed bg-slate-950 p-3 rounded-2xl border border-slate-800 italic">
                  &ldquo;{activeTooltipSource.source.snippet}&rdquo;
                </p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Verified Web URL:
              </span>
              <p className="text-xs font-mono text-cyan-300 break-all">
                {activeTooltipSource.source.url}
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => handleCopyUrl(activeTooltipSource.source.url)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-slate-700 cursor-pointer"
              >
                {copiedUrl === activeTooltipSource.source.url ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <a
                href={activeTooltipSource.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs flex items-center justify-center space-x-1.5 shadow-lg"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Source Article</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
