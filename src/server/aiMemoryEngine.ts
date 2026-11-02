import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AIMemoryCategory,
  AIMemoryItem,
  AIConversationSummary,
  AIMemorySettings,
  ChatMessage,
  PendingSensitiveMemoryPrompt,
  UserAIMemoryStore,
  UserNutritionMemory,
  UserProfileMemory,
  UserSafetyMemory,
  UserWellnessMemory,
  AIChatMode
} from '../types';

const DATA_DIR = path.join(process.cwd(), '.data');
const AI_MEMORY_FILE = path.join(DATA_DIR, 'ai_memories.json');

interface EncryptedMemoryEnvelope {
  v: 1;
  iv: string;
  tag: string;
  ciphertext: string;
  updatedAt: string;
}

type PersistedMemoryFile = Record<string, EncryptedMemoryEnvelope>;

function deriveMemoryEncryptionKey(secret: string): Buffer {
  return crypto.scryptSync(secret || 'smart-shield-default-secret', 'smart-shield-ai-memory-salt-v1', 32);
}

function encryptStoreForDisk(store: UserAIMemoryStore, secret: string): EncryptedMemoryEnvelope {
  const key = deriveMemoryEncryptionKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(store);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    updatedAt: new Date().toISOString()
  };
}

function decryptStoreFromDisk(envelope: EncryptedMemoryEnvelope, secret: string): UserAIMemoryStore | null {
  try {
    if (!envelope || envelope.v !== 1 || !envelope.iv || !envelope.tag || !envelope.ciphertext) {
      return null;
    }
    const key = deriveMemoryEncryptionKey(secret);
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const encrypted = Buffer.from(envelope.ciphertext, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted) as UserAIMemoryStore;
  } catch (err) {
    console.warn('[AIMemoryEngine] Failed to decrypt memory envelope:', err);
    return null;
  }
}

function readRawMemoryFile(): PersistedMemoryFile {
  try {
    if (fs.existsSync(AI_MEMORY_FILE)) {
      const raw = fs.readFileSync(AI_MEMORY_FILE, 'utf-8');
      return JSON.parse(raw) as PersistedMemoryFile;
    }
  } catch (err) {
    console.warn('[AIMemoryEngine] Failed to read memory file:', err);
  }
  return {};
}

function writeRawMemoryFile(fileData: PersistedMemoryFile): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(AI_MEMORY_FILE, JSON.stringify(fileData, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } catch (err) {
    console.error('[AIMemoryEngine] Failed to write memory file:', err);
  }
}

export function createDefaultUserMemoryStore(userId: string): UserAIMemoryStore {
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

export function getUserMemoryStore(userId: string, secret: string): UserAIMemoryStore {
  if (!userId || userId === 'anonymous') {
    return createDefaultUserMemoryStore('anonymous');
  }
  const all = readRawMemoryFile();
  const envelope = all[userId];
  if (envelope) {
    const decrypted = decryptStoreFromDisk(envelope, secret);
    if (decrypted && decrypted.userId === userId) {
      return {
        ...createDefaultUserMemoryStore(userId),
        ...decrypted,
        settings: {
          ...createDefaultUserMemoryStore(userId).settings,
          ...(decrypted.settings || {})
        },
        profileMemory: {
          ...createDefaultUserMemoryStore(userId).profileMemory,
          ...(decrypted.profileMemory || {})
        },
        nutritionMemory: {
          ...createDefaultUserMemoryStore(userId).nutritionMemory,
          ...(decrypted.nutritionMemory || {})
        },
        wellnessMemory: {
          ...createDefaultUserMemoryStore(userId).wellnessMemory,
          ...(decrypted.wellnessMemory || {})
        },
        safetyMemory: {
          ...createDefaultUserMemoryStore(userId).safetyMemory,
          ...(decrypted.safetyMemory || {})
        },
        memoryItems: Array.isArray(decrypted.memoryItems) ? decrypted.memoryItems : [],
        conversationSummaries: Array.isArray(decrypted.conversationSummaries) ? decrypted.conversationSummaries : [],
        activeConversationMessages: Array.isArray(decrypted.activeConversationMessages)
          ? decrypted.activeConversationMessages
          : [],
        pendingConsentPrompts: Array.isArray(decrypted.pendingConsentPrompts) ? decrypted.pendingConsentPrompts : []
      };
    }
  }
  return createDefaultUserMemoryStore(userId);
}

export function saveUserMemoryStore(store: UserAIMemoryStore, secret: string): UserAIMemoryStore {
  if (!store.userId || store.userId === 'anonymous') {
    return store;
  }
  store.updatedAt = new Date().toISOString();
  const all = readRawMemoryFile();
  all[store.userId] = encryptStoreForDisk(store, secret);
  writeRawMemoryFile(all);
  return store;
}

/**
 * Security Guard: Never store passwords, OTPs, API keys, or session tokens as AI memories.
 */
export function isForbiddenCredentialOrSecret(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  // Detect passwords, OTPs, PINs, API keys, Bearer tokens, JWTs
  if (/\b(password|passcode|otp|verification code|secret key|api key|api_key|bearer\s+[a-z0-9._-]+|scrypt\$)\b/i.test(text)) {
    return true;
  }
  if (/AIza[0-9A-Za-z-_]{30,}/.test(text) || /sk-[a-zA-Z0-9]{20,}/.test(text)) {
    return true;
  }
  if (/\bmy (password|pin|otp|code) is\b/i.test(lower)) {
    return true;
  }
  return false;
}

export function upsertMemoryItem(
  store: UserAIMemoryStore,
  params: {
    category: AIMemoryCategory;
    key: string;
    label: string;
    value: string;
    source?: AIMemoryItem['source'];
    confidence?: number;
    isSensitive?: boolean;
    consentGranted?: boolean;
  }
): AIMemoryItem | null {
  const cleanValue = String(params.value || '').trim();
  if (!cleanValue || isForbiddenCredentialOrSecret(cleanValue) || isForbiddenCredentialOrSecret(params.key)) {
    return null;
  }

  const isSensitive = Boolean(
    params.isSensitive ||
      params.category === 'wellness_menstrual' ||
      params.category === 'wellness_pregnancy'
  );
  const consentGranted = isSensitive
    ? Boolean(params.consentGranted ?? store.settings.wellnessMemoryConsent)
    : true;

  if (isSensitive && !consentGranted) {
    // Queue for explicit user consent instead of saving silently
    const existsPrompt = store.pendingConsentPrompts.some(
      (p) => p.key === params.key && p.value.toLowerCase() === cleanValue.toLowerCase()
    );
    if (!existsPrompt) {
      store.pendingConsentPrompts.push({
        id: `prompt_${crypto.randomBytes(6).toString('hex')}`,
        category: params.category,
        key: params.key,
        label: params.label,
        value: cleanValue,
        reason: 'Explicit consent is required before saving menstrual or pregnancy wellness details to your AI memory.'
      });
    }
    return null;
  }

  const now = new Date().toISOString();
  const existingIndex = store.memoryItems.findIndex(
    (item) => item.category === params.category && item.key.toLowerCase() === params.key.toLowerCase()
  );

  if (existingIndex >= 0) {
    const existing = store.memoryItems[existingIndex];
    existing.label = params.label || existing.label;
    existing.value = cleanValue;
    existing.source = params.source || existing.source;
    existing.confidence = params.confidence ?? existing.confidence;
    existing.isSensitive = isSensitive;
    existing.consentGranted = consentGranted;
    existing.updatedAt = now;
    return existing;
  }

  const newItem: AIMemoryItem = {
    id: `mem_${crypto.randomBytes(8).toString('hex')}`,
    userId: store.userId,
    category: params.category,
    key: params.key,
    label: params.label,
    value: cleanValue,
    source: params.source || 'conversation_learned',
    confidence: params.confidence ?? 0.95,
    isSensitive,
    consentGranted,
    createdAt: now,
    updatedAt: now
  };

  store.memoryItems.unshift(newItem);
  // Keep maximum 200 distinct memory items per user
  if (store.memoryItems.length > 200) {
    store.memoryItems = store.memoryItems.slice(0, 200);
  }
  return newItem;
}

/**
 * Sync structured module data (from Nutrition, Menstrual, Pregnancy, Safety modules) into the user's AI Memory Store.
 */
export function syncWellnessContextIntoMemoryStore(
  store: UserAIMemoryStore,
  wellnessContext: any
): void {
  if (!store.settings.memoryEnabled || !wellnessContext || typeof wellnessContext !== 'object') {
    return;
  }
  const now = new Date().toISOString();

  // 1. Sync Nutrition & Hydration preferences
  if (store.settings.nutritionMemoryEnabled && wellnessContext.userProfile) {
    const up = wellnessContext.userProfile;
    if (up.dietType && typeof up.dietType === 'string') {
      const normalizedDiet = up.dietType.replace('_', '-') as any;
      if (['veg', 'non-veg', 'vegan', 'egg'].includes(normalizedDiet) && !store.nutritionMemory.dietType) {
        store.nutritionMemory.dietType = normalizedDiet;
        upsertMemoryItem(store, {
          category: 'nutrition',
          key: 'diet_preference',
          label: 'Food Preference',
          value:
            normalizedDiet === 'veg'
              ? 'Vegetarian'
              : normalizedDiet === 'vegan'
              ? 'Vegan'
              : normalizedDiet === 'egg'
              ? 'Eggetarian'
              : 'Non-Vegetarian',
          source: 'module_sync'
        });
      }
    }
    if (up.preferredCuisine && typeof up.preferredCuisine === 'string') {
      const cuisine = up.preferredCuisine.replace('_', ' ');
      if (!store.nutritionMemory.preferredCuisine.includes(cuisine)) {
        store.nutritionMemory.preferredCuisine.push(cuisine);
      }
    }
    if (Array.isArray(up.allergies)) {
      for (const allergy of up.allergies) {
        const clean = String(allergy || '').trim();
        if (clean && !store.nutritionMemory.allergies.includes(clean)) {
          store.nutritionMemory.allergies.push(clean);
          upsertMemoryItem(store, {
            category: 'nutrition',
            key: `allergy_${clean.toLowerCase().replace(/\s+/g, '_')}`,
            label: 'Food Allergy / Restriction',
            value: clean,
            source: 'module_sync'
          });
        }
      }
    }
    if (up.healthGoal && typeof up.healthGoal === 'string') {
      const goal = up.healthGoal.replace(/_/g, ' ');
      if (goal && !store.nutritionMemory.nutritionGoals.includes(goal)) {
        store.nutritionMemory.nutritionGoals.push(goal);
      }
    }
    store.nutritionMemory.updatedAt = now;
  }

  // Record water intake & completed meals snapshot if provided
  if (store.settings.nutritionMemoryEnabled && wellnessContext.waterIntake) {
    const wi = wellnessContext.waterIntake;
    if (typeof wi.targetMl === 'number' && wi.targetMl > 0) {
      store.nutritionMemory.hydrationGoalLiters = Number((wi.targetMl / 1000).toFixed(2));
    }
    if (typeof wi.consumedMl === 'number' && wi.consumedMl > 0) {
      store.nutritionMemory.recentWaterIntakeNotes = `${wi.consumedMl} mL / ${wi.targetMl || 2300} mL (${wi.percentage || 0}%) on ${wellnessContext.currentDate || now.slice(0, 10)}`;
    }
  }
}

/**
 * Extract confirmed user preferences, profile details, and goals from a user message.
 * Never assumes missing facts, ignores temporary statements, and never stores credentials.
 */
export function extractAndLearnMemoriesFromUserText(
  store: UserAIMemoryStore,
  userText: string,
  contextMode?: string
): Array<{ id: string; category: AIMemoryCategory; key: string; value: string }> {
  const learned: Array<{ id: string; category: AIMemoryCategory; key: string; value: string }> = [];
  if (!store.settings.memoryEnabled || !store.settings.autoLearnEnabled) {
    return learned;
  }

  const trimmed = (userText || '').trim();
  if (!trimmed || trimmed.length < 3 || isForbiddenCredentialOrSecret(trimmed)) {
    return learned;
  }

  const lower = trimmed.toLowerCase();
  const now = new Date().toISOString();

  // 1. Preferred Name ("my name is X", "call me X", "i am X" when introducing)
  const nameMatch =
    trimmed.match(/\b(?:my name is|please call me|you can call me|call me)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/i) ||
    trimmed.match(/^i am\s+([A-Z][a-zA-Z]{2,18})\b/);
  if (nameMatch && nameMatch[1]) {
    const candidateName = nameMatch[1].trim();
    const stopWords = new Set([
      'vegetarian',
      'vegan',
      'allergic',
      'pregnant',
      'hungry',
      'tired',
      'having',
      'looking',
      'feeling',
      'going',
      'walking',
      'asking',
      'trying',
      'happy',
      'sad',
      'scared',
      'anxious',
      'fine',
      'good',
      'here',
      'ready'
    ]);
    if (!stopWords.has(candidateName.toLowerCase())) {
      store.profileMemory.preferredName = candidateName;
      store.profileMemory.updatedAt = now;
      const item = upsertMemoryItem(store, {
        category: 'profile',
        key: 'preferred_name',
        label: 'Preferred Name',
        value: candidateName,
        source: 'conversation_learned'
      });
      if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
    }
  }

  // 2. Preferred Language ("respond in tamil", "i prefer tamil", "speak in english", "talk in tanglish")
  if (/\b(respond in tamil|reply in tamil|speak in tamil|i prefer tamil|tamil language)\b/i.test(lower)) {
    store.profileMemory.preferredLanguage = 'ta';
    store.profileMemory.updatedAt = now;
    const item = upsertMemoryItem(store, {
      category: 'preference',
      key: 'preferred_language',
      label: 'Preferred Language',
      value: 'Tamil (தமிழ்)',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  } else if (/\b(respond in english|reply in english|speak in english|i prefer english)\b/i.test(lower)) {
    store.profileMemory.preferredLanguage = 'en';
    store.profileMemory.updatedAt = now;
    const item = upsertMemoryItem(store, {
      category: 'preference',
      key: 'preferred_language',
      label: 'Preferred Language',
      value: 'English',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  } else if (/\b(respond in tanglish|reply in tanglish|i prefer tanglish)\b/i.test(lower)) {
    store.profileMemory.preferredLanguage = 'tanglish';
    store.profileMemory.updatedAt = now;
    const item = upsertMemoryItem(store, {
      category: 'preference',
      key: 'preferred_language',
      label: 'Preferred Language',
      value: 'Tanglish',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  }

  // 3. Age / Age Range ("I am 24 years old", "my age is 28")
  const ageMatch = trimmed.match(/\b(?:i am|i'm|my age is)\s+(\d{2})\s*(?:years old|yrs old|yo)?\b/i);
  if (ageMatch && ageMatch[1]) {
    const ageNum = Number(ageMatch[1]);
    if (ageNum >= 13 && ageNum <= 90) {
      const ageStr = `${ageNum} years`;
      store.profileMemory.ageRange = ageStr;
      store.profileMemory.updatedAt = now;
      const item = upsertMemoryItem(store, {
        category: 'profile',
        key: 'age_range',
        label: 'Age / Age Range',
        value: ageStr,
        source: 'conversation_learned'
      });
      if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
    }
  }

  // 4. Dietary / Food Preferences (Vegetarian, Vegan, Non-Vegetarian, Eggetarian)
  // Check non-vegetarian BEFORE vegetarian so "non-vegetarian" is matched accurately
  if (
    /\b(i am non-vegetarian|i'm non-vegetarian|i am non vegetarian|i prefer non-vegetarian|i prefer non vegetarian|i eat non-veg|i eat chicken|i eat fish|i eat meat|switched to non-veg)\b/i.test(
      lower
    )
  ) {
    store.nutritionMemory.dietType = 'non-veg';
    store.nutritionMemory.updatedAt = now;
    const item = upsertMemoryItem(store, {
      category: 'nutrition',
      key: 'diet_preference',
      label: 'Food Preference',
      value: 'Non-Vegetarian',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  } else if (
    /\b(i am vegan|i'm vegan|i prefer vegan|strictly vegan|plant-based diet|switched to vegan)\b/i.test(lower)
  ) {
    store.nutritionMemory.dietType = 'vegan';
    store.nutritionMemory.updatedAt = now;
    const item = upsertMemoryItem(store, {
      category: 'nutrition',
      key: 'diet_preference',
      label: 'Food Preference',
      value: 'Vegan (Plant-Based)',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  } else if (
    /\b(i am eggetarian|i'm eggetarian|vegetarian plus egg|veg with egg|i eat eggs but no meat)\b/i.test(lower)
  ) {
    store.nutritionMemory.dietType = 'egg';
    store.nutritionMemory.updatedAt = now;
    const item = upsertMemoryItem(store, {
      category: 'nutrition',
      key: 'diet_preference',
      label: 'Food Preference',
      value: 'Eggetarian',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  } else if (
    /\b(i prefer vegetarian|i am vegetarian|i'm vegetarian|i am a vegetarian|i'm a vegetarian|i eat only vegetarian|i eat only veg|pure vegetarian|strictly vegetarian|switched to vegetarian|prefer veg food)\b/i.test(
      lower
    )
  ) {
    store.nutritionMemory.dietType = 'veg';
    store.nutritionMemory.updatedAt = now;
    const item = upsertMemoryItem(store, {
      category: 'nutrition',
      key: 'diet_preference',
      label: 'Food Preference',
      value: 'Vegetarian',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  }

  // 5. Food Allergies & Intolerances ("I am allergic to peanuts", "lactose intolerant")
  const allergyMatch = trimmed.match(
    /\b(?:i am allergic to|i'm allergic to|allergic to|i have a[n]?\s+([a-zA-Z\s]+)\s+allergy)\s*([a-zA-Z,\s]+)?/i
  );
  if (allergyMatch) {
    const rawAllergen = (allergyMatch[1] || allergyMatch[2] || '').trim().replace(/[.;!?]+$/, '');
    if (rawAllergen && rawAllergen.length >= 2 && rawAllergen.length <= 50) {
      if (!store.nutritionMemory.allergies.some((a) => a.toLowerCase() === rawAllergen.toLowerCase())) {
        store.nutritionMemory.allergies.push(rawAllergen);
      }
      store.nutritionMemory.updatedAt = now;
      const item = upsertMemoryItem(store, {
        category: 'nutrition',
        key: `allergy_${rawAllergen.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        label: 'Food Allergy',
        value: `Allergic to ${rawAllergen}`,
        source: 'conversation_learned'
      });
      if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
    }
  }
  if (/\b(lactose intolerant|dairy free|dairy-free|no dairy)\b/i.test(lower)) {
    if (!store.nutritionMemory.dietaryRestrictions.includes('Lactose-Free / No Dairy')) {
      store.nutritionMemory.dietaryRestrictions.push('Lactose-Free / No Dairy');
    }
    const item = upsertMemoryItem(store, {
      category: 'nutrition',
      key: 'restriction_lactose_free',
      label: 'Dietary Restriction',
      value: 'Lactose-Free / Avoids Dairy',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  }
  if (/\b(gluten free|gluten-free|gluten intolerant|celiac)\b/i.test(lower)) {
    if (!store.nutritionMemory.dietaryRestrictions.includes('Gluten-Free')) {
      store.nutritionMemory.dietaryRestrictions.push('Gluten-Free');
    }
    const item = upsertMemoryItem(store, {
      category: 'nutrition',
      key: 'restriction_gluten_free',
      label: 'Dietary Restriction',
      value: 'Gluten-Free',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  }

  // 6. Disliked / Avoided Foods ("I don't eat X", "I dislike X", "I avoid X")
  const dislikeMatch = trimmed.match(
    /\b(?:i don't eat|i do not eat|i dislike|i hate eating|i avoid eating|please exclude)\s+([a-zA-Z\s,]{3,40})/i
  );
  if (dislikeMatch && dislikeMatch[1]) {
    const disliked = dislikeMatch[1].trim().replace(/[.;!?]+$/, '');
    if (
      disliked &&
      !['meat', 'chicken', 'fish', 'non veg'].includes(disliked.toLowerCase()) &&
      !store.nutritionMemory.dislikedFoods.some((f) => f.toLowerCase() === disliked.toLowerCase())
    ) {
      store.nutritionMemory.dislikedFoods.push(disliked);
      store.nutritionMemory.updatedAt = now;
      const item = upsertMemoryItem(store, {
        category: 'nutrition',
        key: `disliked_${disliked.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        label: 'Avoided Food',
        value: `Avoids ${disliked}`,
        source: 'conversation_learned'
      });
      if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
    }
  }

  // 7. Favorite Foods / Cuisine ("my favorite meal is X", "i love eating X", "i prefer south indian food")
  const favFoodMatch = trimmed.match(
    /\b(?:my favorite (?:food|meal|dish|breakfast|dinner) is|i love eating)\s+([a-zA-Z\s]{3,40})/i
  );
  if (favFoodMatch && favFoodMatch[1]) {
    const fav = favFoodMatch[1].trim().replace(/[.;!?]+$/, '');
    if (fav && !store.nutritionMemory.favoriteMeals.some((f) => f.toLowerCase() === fav.toLowerCase())) {
      store.nutritionMemory.favoriteMeals.push(fav);
      store.nutritionMemory.updatedAt = now;
      const item = upsertMemoryItem(store, {
        category: 'nutrition',
        key: `favorite_meal_${fav.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        label: 'Favorite Meal',
        value: fav,
        source: 'conversation_learned'
      });
      if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
    }
  }
  if (/\b(south indian food|south indian cuisine|south indian meals|tamil nadu food)\b/i.test(lower)) {
    if (!store.nutritionMemory.preferredCuisine.includes('South Indian')) {
      store.nutritionMemory.preferredCuisine.push('South Indian');
    }
    const item = upsertMemoryItem(store, {
      category: 'nutrition',
      key: 'preferred_cuisine',
      label: 'Preferred Cuisine',
      value: 'South Indian',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  } else if (/\b(north indian food|north indian cuisine|north indian meals)\b/i.test(lower)) {
    if (!store.nutritionMemory.preferredCuisine.includes('North Indian')) {
      store.nutritionMemory.preferredCuisine.push('North Indian');
    }
    const item = upsertMemoryItem(store, {
      category: 'nutrition',
      key: 'preferred_cuisine',
      label: 'Preferred Cuisine',
      value: 'North Indian',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  }

  // 8. Fitness & Wellness Goals ("my goal is X", "i want to lose weight", "increase iron", "high protein")
  const goalMatch = trimmed.match(
    /\b(?:my (?:fitness|wellness|health|nutrition) goal is|my goal is to|i want to focus on)\s+([a-zA-Z0-9\s-]{4,55})/i
  );
  if (goalMatch && goalMatch[1]) {
    const goal = goalMatch[1].trim().replace(/[.;!?]+$/, '');
    if (!store.profileMemory.fitnessAndWellnessGoals.some((g) => g.toLowerCase() === goal.toLowerCase())) {
      store.profileMemory.fitnessAndWellnessGoals.push(goal);
      store.profileMemory.updatedAt = now;
    }
    const item = upsertMemoryItem(store, {
      category: 'profile',
      key: `wellness_goal_${goal.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24)}`,
      label: 'Wellness Goal',
      value: goal,
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  }

  // 9. Communication Style ("keep answers short", "give detailed explanations")
  if (/\b(keep answers short|keep it brief|concise answers|short answers please)\b/i.test(lower)) {
    store.profileMemory.communicationStyle = 'concise';
    store.profileMemory.updatedAt = now;
    const item = upsertMemoryItem(store, {
      category: 'preference',
      key: 'communication_style',
      label: 'Communication Style',
      value: 'Concise & brief responses',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  } else if (/\b(give detailed answers|detailed explanations|explain in detail)\b/i.test(lower)) {
    store.profileMemory.communicationStyle = 'detailed';
    store.profileMemory.updatedAt = now;
    const item = upsertMemoryItem(store, {
      category: 'preference',
      key: 'communication_style',
      label: 'Communication Style',
      value: 'Detailed & thorough explanations',
      source: 'conversation_learned'
    });
    if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
  }

  // 10. Sensitive Menstrual & Pregnancy Facts (Requires explicit consent)
  const cycleLengthMatch = trimmed.match(/\bmy (?:menstrual )?cycle is (\d{2}) days\b/i);
  if (cycleLengthMatch && cycleLengthMatch[1]) {
    const days = Number(cycleLengthMatch[1]);
    if (days >= 20 && days <= 45) {
      if (store.settings.wellnessMemoryConsent) {
        store.wellnessMemory.averageCycleLength = days;
        store.wellnessMemory.activeWellnessMode = 'menstrual';
        store.wellnessMemory.updatedAt = now;
      }
      const item = upsertMemoryItem(store, {
        category: 'wellness_menstrual',
        key: 'average_cycle_length',
        label: 'Average Menstrual Cycle Length',
        value: `${days} days`,
        source: 'conversation_learned',
        isSensitive: true
      });
      if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
    }
  }

  const pregWeekMatch = trimmed.match(/\bi am (\d{1,2}) weeks pregnant\b/i);
  if (pregWeekMatch && pregWeekMatch[1]) {
    const weeks = Number(pregWeekMatch[1]);
    if (weeks >= 1 && weeks <= 42) {
      if (store.settings.wellnessMemoryConsent) {
        store.wellnessMemory.currentTrimesterOrWeekNote = `${weeks} weeks pregnant`;
        store.wellnessMemory.activeWellnessMode = 'pregnancy';
        store.wellnessMemory.pregnancyCalculationsEnabled = true;
        store.wellnessMemory.updatedAt = now;
      }
      const item = upsertMemoryItem(store, {
        category: 'wellness_pregnancy',
        key: 'pregnancy_stage',
        label: 'Pregnancy Progress Note',
        value: `${weeks} weeks pregnant`,
        source: 'conversation_learned',
        isSensitive: true
      });
      if (item) learned.push({ id: item.id, category: item.category, key: item.key, value: item.value });
    }
  }

  return learned;
}

/**
 * Intelligent Memory Retrieval:
 * Selects ONLY relevant memories for the user's current question and builds a personalized context block.
 */
export function retrieveRelevantMemoriesForQuery(
  store: UserAIMemoryStore,
  userQuery: string,
  contextMode?: string
): {
  systemPromptBlock: string;
  memoriesUsed: Array<{ id: string; category: AIMemoryCategory; key: string; value: string }>;
} {
  if (!store.settings.memoryEnabled) {
    return { systemPromptBlock: '', memoriesUsed: [] };
  }

  const query = (userQuery || '').toLowerCase();
  const memoriesUsed: Array<{ id: string; category: AIMemoryCategory; key: string; value: string }> = [];
  const usedIds = new Set<string>();

  const addUsedItem = (item: AIMemoryItem) => {
    if (item.isSensitive && !store.settings.wellnessMemoryConsent) return;
    if (!usedIds.has(item.id)) {
      usedIds.add(item.id);
      memoriesUsed.push({
        id: item.id,
        category: item.category,
        key: item.key,
        value: item.value
      });
    }
  };

  // Determine query intent domains
  const isNutritionQuery =
    contextMode === 'nutrition' ||
    /\b(food|diet|meal|dinner|lunch|breakfast|snack|eat|recipe|cook|vegetarian|vegan|protein|calorie|water|hydration|drink|hungry|allergy|plan|menu|iron|calcium)\b/i.test(
      query
    );
  const isMenstrualQuery =
    contextMode === 'menstrual' ||
    /\b(period|menstrual|cycle|cramp|ovulation|luteal|follicular|pms|bleeding|pad|tampon)\b/i.test(query);
  const isPregnancyQuery =
    contextMode === 'pregnancy' ||
    /\b(pregnant|pregnancy|trimester|fetal|baby|prenatal|morning sickness|nausea|folate|due date)\b/i.test(query);
  const isSafetyQuery =
    contextMode === 'safety' ||
    contextMode === 'gps' ||
    /\b(sos|emergency|safe|safety|contact|walk|journey|location|gps|helpline|alert|police)\b/i.test(query);

  const lines: string[] = [];

  // 1. Always include core profile identity & language preference if present
  const pm = store.profileMemory;
  const profileParts: string[] = [];
  if (pm.preferredName) profileParts.push(`Preferred Name: ${pm.preferredName}`);
  if (pm.preferredLanguage) {
    const langLabel =
      pm.preferredLanguage === 'ta' ? 'Tamil (தமிழ்)' : pm.preferredLanguage === 'tanglish' ? 'Tanglish' : 'English';
    profileParts.push(`Preferred Language: ${langLabel}`);
  }
  if (pm.ageRange) profileParts.push(`Age Range: ${pm.ageRange}`);
  if (pm.communicationStyle) profileParts.push(`Preferred Communication Style: ${pm.communicationStyle}`);
  if (pm.fitnessAndWellnessGoals.length > 0) {
    profileParts.push(`Wellness Goals: ${pm.fitnessAndWellnessGoals.join(', ')}`);
  }
  if (profileParts.length > 0) {
    lines.push(`[Personal Profile Memory]: ${profileParts.join(' | ')}`);
    for (const item of store.memoryItems.filter((m) => m.category === 'profile' || m.category === 'preference')) {
      addUsedItem(item);
    }
  }

  // 2. Nutrition Memory (Always included for food/meal/dinner/diet queries, or if user has strict diet/allergies)
  const nm = store.nutritionMemory;
  const hasNutritionData =
    Boolean(nm.dietType) ||
    nm.allergies.length > 0 ||
    nm.dietaryRestrictions.length > 0 ||
    nm.dislikedFoods.length > 0 ||
    nm.favoriteMeals.length > 0 ||
    nm.preferredCuisine.length > 0;

  if (store.settings.nutritionMemoryEnabled && (isNutritionQuery || hasNutritionData)) {
    const nutParts: string[] = [];
    if (nm.dietType) {
      const label =
        nm.dietType === 'veg'
          ? 'Vegetarian (Strictly NO meat, poultry, fish, or eggs)'
          : nm.dietType === 'vegan'
          ? 'Vegan (Strictly plant-based; NO meat, eggs, dairy, milk, paneer, curd, or ghee)'
          : nm.dietType === 'egg'
          ? 'Eggetarian (Vegetarian + Eggs; NO meat, poultry, or fish)'
          : 'Non-Vegetarian';
      nutParts.push(`Saved Diet Preference: ${label}`);
    }
    if (nm.allergies.length > 0) {
      nutParts.push(`Food Allergies (MUST EXCLUDE): ${nm.allergies.join(', ')}`);
    }
    if (nm.dietaryRestrictions.length > 0) {
      nutParts.push(`Dietary Restrictions: ${nm.dietaryRestrictions.join(', ')}`);
    }
    if (nm.dislikedFoods.length > 0) {
      nutParts.push(`Avoided/Disliked Foods: ${nm.dislikedFoods.join(', ')}`);
    }
    if (nm.preferredCuisine.length > 0) {
      nutParts.push(`Preferred Cuisine: ${nm.preferredCuisine.join(', ')}`);
    }
    if (nm.favoriteMeals.length > 0) {
      nutParts.push(`Favorite Meals: ${nm.favoriteMeals.join(', ')}`);
    }
    if (nm.hydrationGoalLiters) {
      nutParts.push(`Daily Hydration Target: ${Math.round(nm.hydrationGoalLiters * 1000)} mL`);
    }
    if (nm.recentWaterIntakeNotes) {
      nutParts.push(`Latest Recorded Water Intake: ${nm.recentWaterIntakeNotes}`);
    }
    if (nutParts.length > 0) {
      lines.push(`[Nutrition AI Memory]: ${nutParts.join(' | ')}`);
      if (isNutritionQuery) {
        for (const item of store.memoryItems.filter((m) => m.category === 'nutrition')) {
          addUsedItem(item);
        }
      } else {
        // Even on general queries, if diet_preference exists, mark it if relevant
        const dietItem = store.memoryItems.find((m) => m.key === 'diet_preference');
        if (dietItem && isNutritionQuery) addUsedItem(dietItem);
      }
    }
  }

  // 3. Menstrual & Pregnancy Wellness Memory (ONLY if explicit consent is granted AND relevant to query)
  const wm = store.wellnessMemory;
  if (store.settings.wellnessMemoryConsent && wm.consentGranted) {
    if (isMenstrualQuery && wm.activeWellnessMode !== 'pregnancy') {
      const mParts: string[] = [];
      if (wm.lastPeriodStartDate) mParts.push(`Last Period Start: ${wm.lastPeriodStartDate}`);
      if (wm.averageCycleLength) mParts.push(`Avg Cycle Length: ${wm.averageCycleLength} days`);
      if (wm.periodDuration) mParts.push(`Period Duration: ${wm.periodDuration} days`);
      if (wm.typicalFlowLevel) mParts.push(`Typical Flow: ${wm.typicalFlowLevel}`);
      if (wm.commonSymptoms.length > 0) mParts.push(`Reported Symptoms: ${wm.commonSymptoms.join(', ')}`);
      if (wm.cycleFoodPreferences.length > 0) mParts.push(`Cycle Comfort Foods: ${wm.cycleFoodPreferences.join(', ')}`);
      if (mParts.length > 0) {
        lines.push(`[Consented Menstrual Wellness Memory]: ${mParts.join(' | ')}`);
      }
      for (const item of store.memoryItems.filter((m) => m.category === 'wellness_menstrual')) {
        addUsedItem(item);
      }
    }

    if (isPregnancyQuery && wm.activeWellnessMode === 'pregnancy') {
      const pParts: string[] = [];
      if (wm.currentTrimesterOrWeekNote) pParts.push(`Gestational Stage: ${wm.currentTrimesterOrWeekNote}`);
      if (wm.dueDateOrLmpDate) pParts.push(`Reference Date: ${wm.dueDateOrLmpDate}`);
      if (wm.pregnancySymptoms.length > 0) pParts.push(`Reported Symptoms: ${wm.pregnancySymptoms.join(', ')}`);
      if (wm.pregnancyFoodPreferences.length > 0) {
        pParts.push(`Pregnancy Food Preferences: ${wm.pregnancyFoodPreferences.join(', ')}`);
      }
      if (pParts.length > 0) {
        lines.push(`[Consented Pregnancy Wellness Memory]: ${pParts.join(' | ')}`);
      }
      for (const item of store.memoryItems.filter((m) => m.category === 'wellness_pregnancy')) {
        addUsedItem(item);
      }
    }
  }

  // 4. Smart Safety Memory (When safety/SOS/location query is asked)
  const sm = store.safetyMemory;
  if (store.settings.safetyMemoryEnabled && isSafetyQuery) {
    const sParts: string[] = [];
    if (sm.preferredAlertLanguage) sParts.push(`Preferred Alert Language: ${sm.preferredAlertLanguage}`);
    if (sm.savedEmergencyContactsSummary) sParts.push(`Saved Contacts: ${sm.savedEmergencyContactsSummary}`);
    if (sm.safeJourneyPreferences.length > 0) sParts.push(`Safe Journey Notes: ${sm.safeJourneyPreferences.join(', ')}`);
    if (sm.sosConfigurationNotes.length > 0) sParts.push(`SOS Config: ${sm.sosConfigurationNotes.join(', ')}`);
    if (sParts.length > 0) {
      lines.push(`[Smart Safety Memory]: ${sParts.join(' | ')}`);
    }
    for (const item of store.memoryItems.filter((m) => m.category === 'safety')) {
      addUsedItem(item);
    }
  }

  // 5. Keyword match against remaining explicit memoryItems
  const queryWords = query
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  for (const item of store.memoryItems) {
    if (item.isSensitive && !store.settings.wellnessMemoryConsent) continue;
    const itemText = `${item.label} ${item.value} ${item.key}`.toLowerCase();
    if (queryWords.some((w) => itemText.includes(w))) {
      addUsedItem(item);
    }
  }

  // 6. Recent Conversation Summaries for continuity across sessions
  if (store.conversationSummaries.length > 0) {
    const recentSummaries = store.conversationSummaries.slice(0, 3);
    const summaryText = recentSummaries
      .map((s) => `• [${s.createdAt.slice(0, 10)} - ${s.title}]: ${s.summary}`)
      .join('\n');
    lines.push(`[Previous Conversation Continuity Summaries]:\n${summaryText}`);
  }

  if (memoriesUsed.length > 0) {
    const explicitFacts = memoriesUsed.map((m) => `- ${m.key}: ${m.value}`).join('\n');
    lines.push(`[Matched User Memory Facts to Apply Automatically]:\n${explicitFacts}`);
  }

  if (lines.length === 0) {
    return { systemPromptBlock: '', memoriesUsed: [] };
  }

  const systemPromptBlock = `\n\n=== SMART SHIELD PERSONAL AI MEMORY (AUTHENTICATED USER) ===
${lines.join('\n')}
CRITICAL MEMORY INSTRUCTIONS:
1. Use the above user-approved memories to personalize your response automatically. Do NOT ask the user to repeat information that is already saved above (such as their vegetarian/vegan/non-veg preference, allergies, preferred name, or language).
2. If the user asks for a meal, breakfast, lunch, snack, or dinner plan and their Saved Diet Preference is Vegetarian or Vegan, strictly provide ONLY ${
    nm.dietType === 'vegan' ? 'Vegan' : nm.dietType === 'veg' ? 'Vegetarian' : 'matching'
  } dishes and exclude any listed allergies (${nm.allergies.join(', ') || 'none'}) or disliked foods (${
    nm.dislikedFoods.join(', ') || 'none'
  }).
3. Never invent or assume personal details, meals, or medical history that are not present in the memory block or current conversation.
============================================================`;

  return {
    systemPromptBlock,
    memoriesUsed
  };
}

/**
 * Append conversation turn to activeConversationMessages and update conversation summary.
 */
export function recordConversationTurnInMemory(
  store: UserAIMemoryStore,
  userMessage: string,
  assistantReply: string,
  mode: AIChatMode = 'universal',
  memoriesUsed?: Array<{ id: string; category: AIMemoryCategory; key: string; value: string }>,
  memoriesLearned?: Array<{ id: string; category: AIMemoryCategory; key: string; value: string }>
): void {
  if (!store.settings.memoryEnabled) return;

  const now = new Date().toISOString();
  const userMsgObj: ChatMessage = {
    id: `msg_u_${Date.now()}`,
    role: 'user',
    content: userMessage,
    timestamp: now,
    mode
  };
  const aiMsgObj: ChatMessage = {
    id: `msg_a_${Date.now() + 1}`,
    role: 'assistant',
    content: assistantReply,
    timestamp: now,
    mode,
    memoriesUsed,
    memoriesLearned
  };

  store.activeConversationMessages.push(userMsgObj, aiMsgObj);
  if (store.activeConversationMessages.length > 60) {
    store.activeConversationMessages = store.activeConversationMessages.slice(-60);
  }

  // Update or create rolling conversation summary for today's session
  const todayPrefix = now.slice(0, 10);
  const existingSummary = store.conversationSummaries.find(
    (s) => s.createdAt.startsWith(todayPrefix) && s.mode === mode
  );

  const cleanSnippet = userMessage.replace(/\s+/g, ' ').trim().slice(0, 90);
  const topicWords = Array.from(
    new Set(
      userMessage
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !['what', 'when', 'where', 'this', 'that', 'with', 'from', 'have', 'please'].includes(w))
    )
  ).slice(0, 5);

  if (existingSummary) {
    existingSummary.messageCount += 2;
    existingSummary.lastMessageAt = now;
    if (!existingSummary.summary.includes(cleanSnippet)) {
      existingSummary.summary = `${existingSummary.summary}; Asked: "${cleanSnippet}"`.slice(-320);
    }
    existingSummary.keyTopics = Array.from(new Set([...existingSummary.keyTopics, ...topicWords])).slice(0, 8);
  } else {
    const newSummary: AIConversationSummary = {
      id: `sum_${crypto.randomBytes(6).toString('hex')}`,
      userId: store.userId,
      title: `${mode.charAt(0).toUpperCase() + mode.slice(1)} Conversation (${todayPrefix})`,
      summary: `Discussed: "${cleanSnippet}"`,
      keyTopics: topicWords,
      mode,
      messageCount: 2,
      lastMessageAt: now,
      createdAt: now,
      canContinue: true
    };
    store.conversationSummaries.unshift(newSummary);
    if (store.conversationSummaries.length > 25) {
      store.conversationSummaries = store.conversationSummaries.slice(0, 25);
    }
  }
}
