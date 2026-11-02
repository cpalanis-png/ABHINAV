import React, { useState, useEffect } from 'react';
import {
  Brain,
  ShieldCheck,
  Lock,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Download,
  PauseCircle,
  PlayCircle,
  Sparkles,
  MessageSquare,
  Utensils,
  Heart,
  ShieldAlert,
  UserCheck,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import {
  AIMemoryCategory,
  AIMemoryItem,
  UserAIMemoryStore
} from '../types';
import { MemoryService } from '../services/memoryService';
import { AuthService } from '../services/authService';

interface AIMemoryDashboardViewProps {
  onOpenChat?: () => void;
}

const CATEGORY_LABELS: Record<AIMemoryCategory, { label: string; badgeClass: string }> = {
  profile: { label: 'Personal Profile', badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  preference: { label: 'Preference', badgeClass: 'bg-violet-100 text-violet-700 border-violet-200' },
  nutrition: { label: 'Nutrition & Diet', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  wellness_menstrual: { label: 'Menstrual Wellness', badgeClass: 'bg-rose-100 text-rose-700 border-rose-200' },
  wellness_pregnancy: { label: 'Pregnancy Wellness', badgeClass: 'bg-pink-100 text-pink-700 border-pink-200' },
  safety: { label: 'Smart Safety', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  routine: { label: 'Daily Routine', badgeClass: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  conversation: { label: 'Conversation Context', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' }
};

export const AIMemoryDashboardView: React.FC<AIMemoryDashboardViewProps> = ({ onOpenChat }) => {
  const currentUser = AuthService.getCurrentUser();
  const [store, setStore] = useState<UserAIMemoryStore>(() => MemoryService.getCachedMemoryStore());
  const [loading, setLoading] = useState<boolean>(true);
  const [activeSubTab, setActiveSubTab] = useState<'memories' | 'preferences' | 'wellness_safety' | 'conversations'>('memories');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add new memory form state
  const [newCategory, setNewCategory] = useState<AIMemoryCategory>('nutrition');
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState('');

  // Structured Preferences Form State
  const [prefName, setPrefName] = useState('');
  const [prefLanguage, setPrefLanguage] = useState<'en' | 'ta' | 'tanglish'>('en');
  const [prefAgeRange, setPrefAgeRange] = useState('');
  const [prefCommStyle, setPrefCommStyle] = useState<'concise' | 'detailed' | 'supportive' | 'action_oriented'>('supportive');
  const [prefDietType, setPrefDietType] = useState<'veg' | 'non-veg' | 'vegan' | 'egg' | ''>('');
  const [prefAllergies, setPrefAllergies] = useState('');
  const [prefDislikes, setPrefDislikes] = useState('');
  const [prefFavorites, setPrefFavorites] = useState('');
  const [prefGoals, setPrefGoals] = useState('');

  const syncFormFromStore = (s: UserAIMemoryStore) => {
    setPrefName(s.profileMemory.preferredName || currentUser?.fullName?.split(' ')[0] || '');
    setPrefLanguage(s.profileMemory.preferredLanguage || 'en');
    setPrefAgeRange(s.profileMemory.ageRange || '');
    setPrefCommStyle(s.profileMemory.communicationStyle || 'supportive');
    setPrefDietType(s.nutritionMemory.dietType || '');
    setPrefAllergies((s.nutritionMemory.allergies || []).join(', '));
    setPrefDislikes((s.nutritionMemory.dislikedFoods || []).join(', '));
    setPrefFavorites((s.nutritionMemory.favoriteMeals || []).join(', '));
    setPrefGoals((s.profileMemory.fitnessAndWellnessGoals || []).join(', '));
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const fetched = await MemoryService.fetchMemoryStore();
      if (mounted) {
        setStore(fetched);
        syncFormFromStore(fetched);
        setLoading(false);
      }
    };
    load();

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<UserAIMemoryStore>;
      if (custom.detail && mounted) {
        setStore(custom.detail);
        syncFormFromStore(custom.detail);
      }
    };
    window.addEventListener('smartshield-memory-updated', handleUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('smartshield-memory-updated', handleUpdate);
    };
  }, [currentUser?.id]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const handleToggleMemoryEnabled = async () => {
    const nextState = !store.settings.memoryEnabled;
    const updated = await MemoryService.updateMemorySettings({ memoryEnabled: nextState });
    setStore(updated);
    showToast(
      'success',
      nextState
        ? 'Personal AI Memory is now ACTIVE. Shield AI will personalize answers using your saved preferences.'
        : 'Personal AI Memory is now PAUSED. Shield AI will not save or use personal memories until re-enabled.'
    );
  };

  const handleToggleAutoLearn = async () => {
    const nextState = !store.settings.autoLearnEnabled;
    const updated = await MemoryService.updateMemorySettings({ autoLearnEnabled: nextState });
    setStore(updated);
    showToast(
      'success',
      nextState
        ? 'Automatic learning from conversations enabled.'
        : 'Automatic learning paused. Only manual memories will be saved.'
    );
  };

  const handleToggleWellnessConsent = async () => {
    const nextState = !store.settings.wellnessMemoryConsent;
    const updated = await MemoryService.updateMemorySettings({ wellnessMemoryConsent: nextState });
    setStore(updated);
    showToast(
      'success',
      nextState
        ? 'Explicit consent granted for Menstrual & Pregnancy Wellness AI Memory.'
        : 'Menstrual & Pregnancy Wellness AI Memory consent revoked and sensitive cycle/pregnancy memories cleared.'
    );
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newValue.trim()) {
      showToast('error', 'Please enter both a label (e.g., Food Preference) and a value (e.g., Vegetarian).');
      return;
    }
    const res = await MemoryService.addMemoryItem({
      category: newCategory,
      label: newLabel.trim(),
      value: newValue.trim(),
      isSensitive: newCategory === 'wellness_menstrual' || newCategory === 'wellness_pregnancy'
    });
    if (!res.ok) {
      showToast('error', res.error || 'Could not save memory item.');
      return;
    }
    setStore(res.store);
    setNewLabel('');
    setNewValue('');
    showToast('success', 'Memory saved to your encrypted Personal AI Memory store.');
  };

  const handleStartEdit = (item: AIMemoryItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditValue(item.value);
  };

  const handleSaveEdit = async (itemId: string) => {
    if (!editValue.trim()) {
      showToast('error', 'Memory value cannot be empty.');
      return;
    }
    const res = await MemoryService.updateMemoryItem(itemId, {
      label: editLabel.trim(),
      value: editValue.trim()
    });
    if (!res.ok) {
      showToast('error', res.error || 'Failed to update memory.');
      return;
    }
    setStore(res.store);
    setEditingId(null);
    showToast('success', 'Memory updated.');
  };

  const handleDeleteMemory = async (itemId: string) => {
    const updated = await MemoryService.deleteMemoryItem(itemId);
    setStore(updated);
    showToast('success', 'Memory item deleted.');
  };

  const handleSaveStructuredPreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    const parseList = (str: string) =>
      str
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const updated = await MemoryService.updateProfileAndDomainMemory({
      profileMemory: {
        preferredName: prefName.trim() || undefined,
        preferredLanguage: prefLanguage,
        ageRange: prefAgeRange.trim() || undefined,
        communicationStyle: prefCommStyle,
        fitnessAndWellnessGoals: parseList(prefGoals),
        dailyRoutineNotes: store.profileMemory.dailyRoutineNotes,
        reminderPreferences: store.profileMemory.reminderPreferences,
        updatedAt: new Date().toISOString()
      },
      nutritionMemory: {
        ...store.nutritionMemory,
        dietType: prefDietType,
        allergies: parseList(prefAllergies),
        dislikedFoods: parseList(prefDislikes),
        favoriteMeals: parseList(prefFavorites),
        updatedAt: new Date().toISOString()
      }
    });
    setStore(updated);
    showToast('success', 'Your Personal & Nutrition Preferences have been saved and synced with Shield AI.');
  };

  const handleClearConversations = async (scope: 'conversations' | 'all') => {
    const updated = await MemoryService.clearConversationHistory(scope);
    setStore(updated);
    syncFormFromStore(updated);
    showToast(
      'success',
      scope === 'all'
        ? 'All saved AI memories and conversation history have been reset.'
        : 'Conversation history and summaries have been cleared.'
    );
  };

  const filteredMemories = (store.memoryItems || []).filter((item) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.value.toLowerCase().includes(q) ||
      item.key.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-500/20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Brain className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">My AI Memory</h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                    store.settings.memoryEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      store.settings.memoryEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {store.settings.memoryEnabled ? 'Memory Active' : 'Memory Paused'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-white/10 text-slate-200 border border-white/10">
                  <Lock className="w-3 h-3 text-indigo-300" />
                  AES-256-GCM Encrypted
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                Smart Shield remembers your approved preferences—such as vegetarian/non-veg diet, allergies, preferred language, and wellness goals—across sessions and devices so you never have to repeat yourself.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleToggleMemoryEnabled}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                store.settings.memoryEnabled
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40'
              }`}
            >
              {store.settings.memoryEnabled ? (
                <>
                  <PauseCircle className="w-4 h-4" />
                  Pause Memory
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  Resume Memory
                </>
              )}
            </button>

            <button
              onClick={() => MemoryService.exportMemoryJson()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </button>
          </div>
        </div>

        {/* Account Isolation & Privacy Explanation Bar */}
        <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Account-Isolated:</strong> Linked strictly to{' '}
              <span className="text-indigo-200 font-medium">{currentUser?.fullName || 'your account'}</span>. Never shared with other users.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Zero Credential Storage:</strong> Passwords, OTP codes, API keys, and session tokens are strictly blocked from AI memory.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Heart className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Consent-First Wellness:</strong> Menstrual and pregnancy details are only remembered with your explicit consent.
            </span>
          </div>
        </div>
      </div>

      {/* Status Toast */}
      {statusBanner && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs md:text-sm font-medium ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button onClick={() => setStatusBanner(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pending Sensitive Consent Prompts */}
      {store.pendingConsentPrompts && store.pendingConsentPrompts.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-rose-900 font-semibold text-sm">
            <Heart className="w-4 h-4 text-rose-600" />
            <span>Permission Requested for Sensitive Wellness Memory</span>
          </div>
          {store.pendingConsentPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="bg-white rounded-xl p-3.5 border border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {prompt.label}: <span className="text-rose-700">{prompt.value}</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{prompt.reason}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    const updated = await MemoryService.resolveConsentPrompt(prompt.id, true);
                    setStore(updated);
                    showToast('success', 'Consent granted and wellness memory saved.');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                >
                  Allow & Save
                </button>
                <button
                  onClick={async () => {
                    const updated = await MemoryService.resolveConsentPrompt(prompt.id, false);
                    setStore(updated);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Controls Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-800">Auto-Learn from Chat</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Remember stated diet & preferences automatically</p>
          </div>
          <button
            onClick={handleToggleAutoLearn}
            className={`w-11 h-6 rounded-full transition-colors p-0.5 ${
              store.settings.autoLearnEnabled ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
            aria-label="Toggle Auto-Learn"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                store.settings.autoLearnEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-800">Menstrual & Pregnancy Consent</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Allow AI to remember cycle & trimester updates</p>
          </div>
          <button
            onClick={handleToggleWellnessConsent}
            className={`w-11 h-6 rounded-full transition-colors p-0.5 ${
              store.settings.wellnessMemoryConsent ? 'bg-rose-600' : 'bg-slate-300'
            }`}
            aria-label="Toggle Wellness Memory Consent"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                store.settings.wellnessMemoryConsent ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-800">Saved Memory Facts</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {store.memoryItems.length} active item{store.memoryItems.length === 1 ? '' : 's'} •{' '}
              {store.conversationSummaries.length} summary log{store.conversationSummaries.length === 1 ? '' : 's'}
            </p>
          </div>
          {onOpenChat && (
            <button
              onClick={onOpenChat}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold"
            >
              Ask AI <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'memories', label: `Saved Memories (${store.memoryItems.length})`, icon: Sparkles },
          { id: 'preferences', label: 'Personal & Diet Preferences', icon: Utensils },
          { id: 'wellness_safety', label: 'Wellness & Safety Memory', icon: ShieldAlert },
          { id: 'conversations', label: `Conversation History (${store.conversationSummaries.length})`, icon: MessageSquare }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SAVED MEMORIES LIST, ADD, EDIT, DELETE */}
      {activeSubTab === 'memories' && (
        <div className="space-y-5">
          {/* Add New Memory Form */}
          <form
            onSubmit={handleAddMemory}
            className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Add a Personal Memory Fact
              </h3>
              <span className="text-[11px] text-slate-400">Immediately available to Shield AI & Nutrition AI</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as AIMemoryCategory)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="nutrition">Nutrition & Diet</option>
                  <option value="profile">Personal Profile</option>
                  <option value="preference">Communication & Language</option>
                  <option value="routine">Daily Routine & Goals</option>
                  <option value="safety">Smart Safety Preference</option>
                  <option value="wellness_menstrual">Menstrual Wellness</option>
                  <option value="wellness_pregnancy">Pregnancy Wellness</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Memory Label</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Food Preference or Allergy"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="md:col-span-2 flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Detail to Remember</label>
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="e.g., I prefer vegetarian South Indian meals, no peanuts"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0 transition-colors"
                >
                  Save Memory
                </button>
              </div>
            </div>
          </form>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved memories (e.g., vegetarian, allergy, Tamil, goal)..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700"
            >
              <option value="all">All Categories ({store.memoryItems.length})</option>
              <option value="nutrition">Nutrition & Diet</option>
              <option value="profile">Personal Profile</option>
              <option value="preference">Preferences</option>
              <option value="routine">Daily Routine</option>
              <option value="safety">Smart Safety</option>
              <option value="wellness_menstrual">Menstrual Wellness</option>
              <option value="wellness_pregnancy">Pregnancy Wellness</option>
            </select>
          </div>

          {/* Memories List */}
          {loading ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              Loading your encrypted Personal AI Memory...
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
              <Brain className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No saved memories match your filter</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Add a memory above or tell Shield AI in chat (for example: <em>"I prefer vegetarian food"</em> or{' '}
                <em>"My fitness goal is iron recovery"</em>) and it will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMemories.map((item) => {
                const catMeta = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.preference;
                const isEditing = editingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between gap-3 hover:border-indigo-200 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${catMeta.badgeClass}`}
                        >
                          {catMeta.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.source === 'conversation_learned'
                            ? 'Learned from Chat'
                            : item.source === 'module_sync'
                            ? 'Synced from App'
                            : 'Saved by You'}{' '}
                          • {new Date(item.updatedAt).toLocaleDateString()}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
                            placeholder="Label"
                          />
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-400 text-xs text-slate-800"
                            placeholder="Value"
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold text-slate-800">{item.label}</p>
                          <p className="text-sm font-medium text-indigo-950 mt-0.5">{item.value}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-medium"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMemory(item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PERSONAL & NUTRITION PREFERENCES */}
      {activeSubTab === 'preferences' && (
        <form
          onSubmit={handleSaveStructuredPreferences}
          className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                Personal Profile & Nutrition AI Memory
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Update how Shield AI addresses you and what dietary rules it automatically applies to meal plans.
              </p>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
            >
              Save Preferences
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Name</label>
              <input
                type="text"
                value={prefName}
                onChange={(e) => setPrefName(e.target.value)}
                placeholder="How should Shield AI address you?"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Language</label>
              <select
                value={prefLanguage}
                onChange={(e) => setPrefLanguage(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white"
              >
                <option value="en">English</option>
                <option value="ta">Tamil (தமிழ்)</option>
                <option value="tanglish">Tanglish (Tamil + English)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Age Range (Optional)</label>
              <input
                type="text"
                value={prefAgeRange}
                onChange={(e) => setPrefAgeRange(e.target.value)}
                placeholder="e.g., 22-28 years"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">AI Communication Style</label>
              <select
                value={prefCommStyle}
                onChange={(e) => setPrefCommStyle(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white"
              >
                <option value="supportive">Warm & Supportive</option>
                <option value="concise">Short & Concise</option>
                <option value="detailed">Detailed & Step-by-Step</option>
                <option value="action_oriented">Direct & Action-Oriented</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dietary Preference</label>
              <select
                value={prefDietType}
                onChange={(e) => setPrefDietType(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white"
              >
                <option value="">Not Specified</option>
                <option value="veg">Vegetarian (Strictly No Meat/Fish/Eggs)</option>
                <option value="vegan">Vegan (100% Plant-Based, No Dairy)</option>
                <option value="egg">Eggetarian (Vegetarian + Eggs)</option>
                <option value="non-veg">Non-Vegetarian</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Food Allergies & Restrictions (comma-separated)
              </label>
              <input
                type="text"
                value={prefAllergies}
                onChange={(e) => setPrefAllergies(e.target.value)}
                placeholder="e.g., Peanuts, Prawns, Lactose"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Avoided / Disliked Foods (comma-separated)
              </label>
              <input
                type="text"
                value={prefDislikes}
                onChange={(e) => setPrefDislikes(e.target.value)}
                placeholder="e.g., Bitter gourd, Brinjal"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Favorite Meals & Cuisines (comma-separated)
              </label>
              <input
                type="text"
                value={prefFavorites}
                onChange={(e) => setPrefFavorites(e.target.value)}
                placeholder="e.g., Millet Idli, Paneer Bhurji, South Indian"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fitness & Wellness Goals (comma-separated)
              </label>
              <input
                type="text"
                value={prefGoals}
                onChange={(e) => setPrefGoals(e.target.value)}
                placeholder="e.g., Improve iron levels, Daily 2500 mL hydration, Balanced protein"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: WELLNESS & SAFETY MEMORY */}
      {activeSubTab === 'wellness_safety' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Menstrual & Pregnancy Wellness Memory Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Menstrual & Pregnancy Memory</h3>
                  <p className="text-[11px] text-slate-500">Educational personalization only • Never diagnoses conditions</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                  store.settings.wellnessMemoryConsent
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {store.settings.wellnessMemoryConsent ? 'Consent Active' : 'Consent Off'}
              </span>
            </div>

            {!store.settings.wellnessMemoryConsent ? (
              <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-4 space-y-2.5">
                <p className="text-xs text-slate-700 leading-relaxed">
                  For your privacy, Smart Shield AI does not remember menstrual cycle dates, period symptoms, or pregnancy stage unless you grant explicit consent.
                </p>
                <button
                  onClick={handleToggleWellnessConsent}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                >
                  Enable Wellness Memory Consent
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-slate-700">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <p>
                    <strong className="text-slate-900">Active Wellness Mode:</strong>{' '}
                    {store.wellnessMemory.activeWellnessMode
                      ? store.wellnessMemory.activeWellnessMode.toUpperCase()
                      : 'General / Not Selected'}
                  </p>
                  {store.wellnessMemory.lastPeriodStartDate && (
                    <p>
                      <strong className="text-slate-900">Last Period Start:</strong>{' '}
                      {store.wellnessMemory.lastPeriodStartDate}
                    </p>
                  )}
                  {store.wellnessMemory.averageCycleLength && (
                    <p>
                      <strong className="text-slate-900">Average Cycle Length:</strong>{' '}
                      {store.wellnessMemory.averageCycleLength} days
                    </p>
                  )}
                  {store.wellnessMemory.currentTrimesterOrWeekNote && (
                    <p>
                      <strong className="text-slate-900">Pregnancy Note:</strong>{' '}
                      {store.wellnessMemory.currentTrimesterOrWeekNote}
                    </p>
                  )}
                  {store.wellnessMemory.commonSymptoms.length > 0 && (
                    <p>
                      <strong className="text-slate-900">Logged Symptoms:</strong>{' '}
                      {store.wellnessMemory.commonSymptoms.join(', ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleToggleWellnessConsent}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Revoke Consent & Delete Sensitive Wellness Memories
                </button>
              </div>
            )}
          </div>

          {/* Smart Safety Memory Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Smart Safety Memory</h3>
                <p className="text-[11px] text-slate-500">
                  Remembers safety preferences • Never triggers SOS or edits contacts automatically
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs text-slate-700">
              <p>
                <strong className="text-slate-900">Preferred Alert Language:</strong>{' '}
                {store.safetyMemory.preferredAlertLanguage === 'ta' ? 'Tamil (தமிழ்)' : 'English'}
              </p>
              <p>
                <strong className="text-slate-900">Emergency Contacts Status:</strong>{' '}
                {store.safetyMemory.savedEmergencyContactsSummary || 'Synced from Emergency Contacts module'}
              </p>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                Safety Guarantee: Emergency SOS alerts are only dispatched when you press the SOS button or speak your emergency voice trigger phrase.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONVERSATION CONTINUITY & SUMMARIES */}
      {activeSubTab === 'conversations' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Conversation Continuity & Summaries</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Shield AI preserves your active conversation ({store.activeConversationMessages.length} saved messages) across app restarts and logins.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onOpenChat && (
                <button
                  onClick={onOpenChat}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  Continue Conversation
                </button>
              )}
              <button
                onClick={() => handleClearConversations('conversations')}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200"
              >
                Clear Conversation History
              </button>
              <button
                onClick={() => handleClearConversations('all')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Reset All Memory
              </button>
            </div>
          </div>

          {store.conversationSummaries.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No past conversation summaries recorded yet. Start chatting with Shield AI to build session continuity!
            </div>
          ) : (
            <div className="space-y-3">
              {store.conversationSummaries.map((sum) => (
                <div
                  key={sum.id}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{sum.title}</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                        {sum.messageCount} messages
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{sum.summary}</p>
                    {sum.keyTopics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {sum.keyTopics.map((topic) => (
                          <span
                            key={topic}
                            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] text-slate-600"
                          >
                            #{topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {onOpenChat && (
                    <button
                      onClick={onOpenChat}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold shrink-0"
                    >
                      Resume in Chat
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
