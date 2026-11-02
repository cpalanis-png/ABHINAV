import {
  AIMemoryCategory,
  AIMemoryItem,
  AIMemorySettings,
  ChatMessage,
  UserAIMemoryStore,
  UserNutritionMemory,
  UserProfileMemory,
  UserSafetyMemory,
  UserWellnessMemory
} from '../types';
import { AuthService } from './authService';

const MEMORY_CACHE_PREFIX = 'smartshield_ai_memory_v1_';

function createEmptyClientMemoryStore(userId: string): UserAIMemoryStore {
  const now = new Date().toISOString();
  return {
    userId,
    settings: {
      memoryEnabled: true,
      autoLearnEnabled: true,
      wellnessMemoryConsent: false,
      nutritionMemoryEnabled: true,
      safetyMemoryEnabled: true,
      updatedAt: now
    },
    profileMemory: {
      preferredLanguage: 'en',
      fitnessAndWellnessGoals: [],
      dailyRoutineNotes: [],
      reminderPreferences: [],
      updatedAt: now
    },
    nutritionMemory: {
      dietType: '',
      allergies: [],
      dietaryRestrictions: [],
      dislikedFoods: [],
      favoriteMeals: [],
      preferredCuisine: [],
      nutritionGoals: [],
      completedMealsLog: [],
      skippedMealsLog: [],
      recommendationFeedback: [],
      updatedAt: now
    },
    wellnessMemory: {
      consentGranted: false,
      commonSymptoms: [],
      moodAndEnergyPatterns: [],
      cycleFoodPreferences: [],
      pregnancySymptoms: [],
      pregnancyFoodPreferences: [],
      pregnancySafeRoutineNotes: [],
      updatedAt: now
    },
    safetyMemory: {
      preferredAlertLanguage: 'en',
      safeJourneyPreferences: [],
      sosConfigurationNotes: [],
      locationSharingPreferences: [],
      notificationPreferences: [],
      updatedAt: now
    },
    memoryItems: [],
    conversationSummaries: [],
    activeConversationMessages: [],
    pendingConsentPrompts: [],
    createdAt: now,
    updatedAt: now
  };
}

function getActiveUserId(): string {
  const user = AuthService.getCurrentUser();
  return user?.id || 'anonymous';
}

function getCacheKey(userId: string): string {
  return `${MEMORY_CACHE_PREFIX}${userId}`;
}

function notifyMemoryUpdated(store: UserAIMemoryStore): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smartshield-memory-updated', { detail: store }));
  }
}

export const MemoryService = {
  getCachedMemoryStore(userIdOverride?: string): UserAIMemoryStore {
    const userId = userIdOverride || getActiveUserId();
    if (!userId || userId === 'anonymous') {
      return createEmptyClientMemoryStore('anonymous');
    }
    try {
      const raw = localStorage.getItem(getCacheKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as UserAIMemoryStore;
        if (parsed && parsed.userId === userId) {
          return {
            ...createEmptyClientMemoryStore(userId),
            ...parsed
          };
        }
      }
    } catch {
      // Ignore parse errors
    }
    return createEmptyClientMemoryStore(userId);
  },

  saveCachedMemoryStore(store: UserAIMemoryStore): void {
    if (!store?.userId || store.userId === 'anonymous') return;
    try {
      localStorage.setItem(getCacheKey(store.userId), JSON.stringify(store));
      notifyMemoryUpdated(store);
    } catch {
      // Ignore quota errors
    }
  },

  async fetchMemoryStore(): Promise<UserAIMemoryStore> {
    const userId = getActiveUserId();
    if (!userId || userId === 'anonymous') {
      return createEmptyClientMemoryStore('anonymous');
    }
    try {
      const res = await fetch('/api/memory', {
        method: 'GET',
        headers: {
          ...AuthService.getAuthHeader()
        },
        credentials: 'same-origin'
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.memory && data.memory.userId === userId) {
          this.saveCachedMemoryStore(data.memory);
          return data.memory as UserAIMemoryStore;
        }
      }
    } catch (err) {
      console.warn('[MemoryService] Offline or failed to fetch server memory, using local cache:', err);
    }
    return this.getCachedMemoryStore(userId);
  },

  async updateProfileAndDomainMemory(payload: {
    profileMemory?: Partial<UserProfileMemory>;
    nutritionMemory?: Partial<UserNutritionMemory>;
    wellnessMemory?: Partial<UserWellnessMemory>;
    safetyMemory?: Partial<UserSafetyMemory>;
  }): Promise<UserAIMemoryStore> {
    const userId = getActiveUserId();
    const cached = this.getCachedMemoryStore(userId);
    const now = new Date().toISOString();

    if (payload.profileMemory) {
      cached.profileMemory = { ...cached.profileMemory, ...payload.profileMemory, updatedAt: now };
    }
    if (payload.nutritionMemory) {
      cached.nutritionMemory = { ...cached.nutritionMemory, ...payload.nutritionMemory, updatedAt: now };
    }
    if (payload.wellnessMemory) {
      cached.wellnessMemory = { ...cached.wellnessMemory, ...payload.wellnessMemory, updatedAt: now };
    }
    if (payload.safetyMemory) {
      cached.safetyMemory = { ...cached.safetyMemory, ...payload.safetyMemory, updatedAt: now };
    }
    this.saveCachedMemoryStore(cached);

    try {
      const res = await fetch('/api/memory/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.memory) {
          this.saveCachedMemoryStore(data.memory);
          return data.memory;
        }
      }
    } catch (err) {
      console.warn('[MemoryService] Failed to sync profile memory to server:', err);
    }
    return cached;
  },

  async addMemoryItem(params: {
    category: AIMemoryCategory;
    key?: string;
    label: string;
    value: string;
    isSensitive?: boolean;
  }): Promise<{ ok: boolean; store: UserAIMemoryStore; error?: string }> {
    const userId = getActiveUserId();
    try {
      const res = await fetch('/api/memory/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        },
        credentials: 'same-origin',
        body: JSON.stringify(params)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          store: this.getCachedMemoryStore(userId),
          error: data?.error || 'Unable to save memory item.'
        };
      }
      if (data?.memory) {
        this.saveCachedMemoryStore(data.memory);
        return { ok: true, store: data.memory };
      }
    } catch (err: any) {
      return {
        ok: false,
        store: this.getCachedMemoryStore(userId),
        error: err?.message || 'Network error while saving memory item.'
      };
    }
    return { ok: true, store: this.getCachedMemoryStore(userId) };
  },

  async updateMemoryItem(
    itemId: string,
    params: { label?: string; value: string; category?: AIMemoryCategory }
  ): Promise<{ ok: boolean; store: UserAIMemoryStore; error?: string }> {
    const userId = getActiveUserId();
    try {
      const res = await fetch(`/api/memory/items/${encodeURIComponent(itemId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        },
        credentials: 'same-origin',
        body: JSON.stringify(params)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          store: this.getCachedMemoryStore(userId),
          error: data?.error || 'Failed to update memory item.'
        };
      }
      if (data?.memory) {
        this.saveCachedMemoryStore(data.memory);
        return { ok: true, store: data.memory };
      }
    } catch (err: any) {
      return {
        ok: false,
        store: this.getCachedMemoryStore(userId),
        error: err?.message || 'Network error while updating memory item.'
      };
    }
    return { ok: true, store: this.getCachedMemoryStore(userId) };
  },

  async deleteMemoryItem(itemId: string): Promise<UserAIMemoryStore> {
    const userId = getActiveUserId();
    const cached = this.getCachedMemoryStore(userId);
    cached.memoryItems = cached.memoryItems.filter((i) => i.id !== itemId);
    this.saveCachedMemoryStore(cached);

    try {
      const res = await fetch(`/api/memory/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        headers: {
          ...AuthService.getAuthHeader()
        },
        credentials: 'same-origin'
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.memory) {
          this.saveCachedMemoryStore(data.memory);
          return data.memory;
        }
      }
    } catch (err) {
      console.warn('[MemoryService] Failed to delete memory item on server:', err);
    }
    return cached;
  },

  async updateMemorySettings(settings: Partial<AIMemorySettings>): Promise<UserAIMemoryStore> {
    const userId = getActiveUserId();
    const cached = this.getCachedMemoryStore(userId);
    cached.settings = {
      ...cached.settings,
      ...settings,
      updatedAt: new Date().toISOString()
    };
    this.saveCachedMemoryStore(cached);

    try {
      const res = await fetch('/api/memory/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        },
        credentials: 'same-origin',
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.memory) {
          this.saveCachedMemoryStore(data.memory);
          return data.memory;
        }
      }
    } catch (err) {
      console.warn('[MemoryService] Failed to update memory settings on server:', err);
    }
    return cached;
  },

  async resolveConsentPrompt(promptId: string, approve: boolean): Promise<UserAIMemoryStore> {
    const userId = getActiveUserId();
    try {
      const res = await fetch(`/api/memory/consent-prompt/${encodeURIComponent(promptId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        },
        credentials: 'same-origin',
        body: JSON.stringify({ approve })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.memory) {
          this.saveCachedMemoryStore(data.memory);
          return data.memory;
        }
      }
    } catch (err) {
      console.warn('[MemoryService] Failed to resolve consent prompt:', err);
    }
    return this.getCachedMemoryStore(userId);
  },

  async clearConversationHistory(scope: 'conversations' | 'all' = 'conversations'): Promise<UserAIMemoryStore> {
    const userId = getActiveUserId();
    try {
      const res = await fetch(`/api/memory/conversations?scope=${encodeURIComponent(scope)}`, {
        method: 'DELETE',
        headers: {
          ...AuthService.getAuthHeader()
        },
        credentials: 'same-origin'
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.memory) {
          this.saveCachedMemoryStore(data.memory);
          return data.memory;
        }
      }
    } catch (err) {
      console.warn('[MemoryService] Failed to clear conversations:', err);
    }
    const cached = this.getCachedMemoryStore(userId);
    if (scope === 'all') {
      const reset = createEmptyClientMemoryStore(userId);
      this.saveCachedMemoryStore(reset);
      return reset;
    }
    cached.activeConversationMessages = [];
    cached.conversationSummaries = [];
    this.saveCachedMemoryStore(cached);
    return cached;
  },

  async saveActiveConversationMessages(messages: ChatMessage[]): Promise<void> {
    const userId = getActiveUserId();
    if (!userId || userId === 'anonymous') return;
    const cached = this.getCachedMemoryStore(userId);
    if (!cached.settings.memoryEnabled) return;

    cached.activeConversationMessages = messages.slice(-60);
    this.saveCachedMemoryStore(cached);

    try {
      await fetch('/api/memory/conversations/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeader()
        },
        credentials: 'same-origin',
        body: JSON.stringify({ messages: cached.activeConversationMessages })
      });
    } catch {
      // Offline resilient
    }
  },

  async exportMemoryJson(): Promise<void> {
    const userId = getActiveUserId();
    let exportPayload: any = {
      exportedAt: new Date().toISOString(),
      memoryStore: this.getCachedMemoryStore(userId)
    };
    try {
      const res = await fetch('/api/memory/export', {
        method: 'GET',
        headers: {
          ...AuthService.getAuthHeader()
        },
        credentials: 'same-origin'
      });
      if (res.ok) {
        exportPayload = await res.json();
      }
    } catch {
      // Fallback to cached payload
    }

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart_shield_ai_memory_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
