import {
  Contact,
  SOSIncident,
  CycleLog,
  SymptomLog,
  PregnancyProfile,
  Appointment,
  PregnancyJournalEntry,
  PregnancyMedication,
  FetalKickLog,
  EvidenceItem,
  RescuePassport,
  ChatMessage,
  UserNutritionProfile,
  MenstrualNutritionProfile,
  PregnancyNutritionProfile,
  DailyMealPlan,
  NutritionReminderConfig,
  FoodJournalLog,
  GroceryItem,
  FoodDatabaseItem,
  CompletedMealRecord,
  WaterIntakeEntry,
  DailyWaterSummary,
  CongratulationsBadge,
  SharedWellnessAIContext,
  WellnessJourneyMode
} from '../types';
import { INITIAL_FOOD_DATABASE } from './foodDatabase';
import { AuthService } from './authService';

const STORAGE_KEYS = {
  CONTACTS: 'smartshield_contacts_v5',
  INCIDENTS: 'smartshield_incidents_v5',
  CYCLES: 'smartshield_cycles_v5',
  SYMPTOMS: 'smartshield_symptoms_v5',
  PREGNANCY: 'smartshield_pregnancy_v5',
  APPOINTMENTS: 'smartshield_appointments_v5',
  PREG_JOURNAL: 'smartshield_preg_journal_v5',
  PREG_MEDS: 'smartshield_preg_meds_v5',
  KICK_LOGS: 'smartshield_kick_logs_v5',
  EVIDENCE: 'smartshield_evidence_v5',
  PASSPORT: 'smartshield_passport_v5',
  CHAT_HISTORY: 'smartshield_chat_v5',
  GEOFENCE: 'smartshield_geofence_v5',
  SAFETY_SEARCH_RADIUS: 'smartshield_safety_search_radius_v5',
  NUTRITION_USER_PROFILE: 'smartshield_nutrition_user_profile_v5',
  MENSTRUAL_NUTRITION_PROFILE: 'smartshield_menstrual_nutrition_profile_v5',
  PREGNANCY_NUTRITION_PROFILE: 'smartshield_pregnancy_nutrition_profile_v5',
  MENSTRUAL_PLAN: 'smartshield_menstrual_meal_plan_v5',
  PREGNANCY_PLAN: 'smartshield_pregnancy_meal_plan_v5',
  DAILY_PLANS_BY_DATE: 'smartshield_daily_plans_by_date_v5',
  COMPLETED_MEALS: 'smartshield_completed_meals_v5',
  WATER_ENTRIES: 'smartshield_water_entries_v5',
  CUSTOM_FOOD_DB: 'smartshield_custom_foods_v5',
  NUTRITION_REMINDERS: 'smartshield_nutrition_reminders_v5',
  FOOD_JOURNAL: 'smartshield_food_journal_v5',
  GROCERY_ITEMS: 'smartshield_grocery_items_v5',
};

export interface GeofenceConfig {
  radiusKm: number; // 1, 5, 10, 20, 50
  notifyOnExit: boolean;
  anchorLocation: {
    latitude: number;
    longitude: number;
    address?: string;
  } | null;
}

const LEGACY_DUMMY_IDS = new Set(['c1', 'c2', 'c3']);
const LEGACY_DUMMY_PHONES = new Set(['919876543210', '9876543210', '919812345678', '9812345678', '914422578888', '4422578888']);
const LEGACY_DUMMY_NAMES = new Set([
  'anita sharma (mom)',
  'kavitha r. (sister)',
  'campus security desk'
]);

const isLegacyDummyContact = (c: Partial<Contact> | null | undefined): boolean => {
  if (!c) return true;
  const id = String(c.id || '').trim();
  const name = String(c.name || '').trim().toLowerCase();
  const digits = String(c.phone || '').replace(/[^\d]/g, '');
  if (LEGACY_DUMMY_IDS.has(id)) return true;
  if (LEGACY_DUMMY_NAMES.has(name)) return true;
  if (digits && LEGACY_DUMMY_PHONES.has(digits)) return true;
  return false;
};

// Purge any legacy hardcoded contacts while preserving real user-saved contacts
const sanitizeContactsList = (rawList: unknown): { cleaned: Contact[]; changed: boolean } => {
  if (!Array.isArray(rawList)) return { cleaned: [], changed: true };
  let changed = false;
  const cleaned: Contact[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') {
      changed = true;
      continue;
    }
    const c = item as Contact;
    if (isLegacyDummyContact(c)) {
      changed = true;
      continue;
    }
    if (!c.name || !String(c.name).trim() || !c.phone || !String(c.phone).trim()) {
      changed = true;
      continue;
    }
    cleaned.push({
      id: String(c.id || `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      name: String(c.name).trim(),
      phone: String(c.phone).trim(),
      relationship: String(c.relationship || '').trim(),
      isPrimary: Boolean(c.isPrimary),
      isBackupRelay: c.isBackupRelay !== undefined ? Boolean(c.isBackupRelay) : true,
      canSeeLocation: c.canSeeLocation !== undefined ? Boolean(c.canSeeLocation) : true,
      canSeePregnancyUpdates: Boolean(c.canSeePregnancyUpdates),
    });
  }

  if (cleaned.length > 0 && !cleaned.some((c) => c.isPrimary)) {
    cleaned[0].isPrimary = true;
    changed = true;
  }

  return { cleaned, changed };
};

// Seed initial app data safely without EVER inserting fake/dummy emergency contacts
const seedDefaults = () => {
  try {
    const rawContacts = localStorage.getItem(STORAGE_KEYS.CONTACTS);
    if (!rawContacts) {
      // Start with an empty emergency contact list for new users
      localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify([]));
    } else {
      const parsed = JSON.parse(rawContacts);
      const { cleaned, changed } = sanitizeContactsList(parsed);
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(cleaned));
      }
    }
  } catch {
    try {
      localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify([]));
    } catch {
      // ignore if storage unavailable
    }
  }

  if (!localStorage.getItem(STORAGE_KEYS.PREGNANCY)) {
    const defaultPregnancy: PregnancyProfile = {
      active: true,
      startDate: '2026-05-15',
      dueDate: '2027-02-19',
      currentWeek: 23,
      currentDay: 4,
      babySizeComparison: 'Size of an Eggplant 🍆 (~28 cm, 500g)',
      trimester: 2,
      clinicianName: 'Dr. Radhika V., MD (OB-GYN)',
      hospitalName: 'Apollo Women & Child Hospital, Chennai',
      emergencyContactPhone: '',
    };
    localStorage.setItem(STORAGE_KEYS.PREGNANCY, JSON.stringify(defaultPregnancy));
  }

  if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
    const defaultAppts: Appointment[] = [
      {
        id: 'a1',
        title: '24-Week Anomaly & Growth Ultrasound',
        doctorName: 'Dr. Radhika V.',
        locationName: 'Apollo Women Center, Clinic 3B',
        dateTime: '2026-10-28T10:30',
        notes: 'Fast for 1 hour prior. Carry blood pressure log.',
        questionsToAsk: [
          'Is fetal weight tracking along expected percentile?',
          'Should I start daily iron & calcium supplements now?',
          'What exercises are safe for lower back comfort?'
        ],
        completed: false,
      },
    ];
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(defaultAppts));
  }

  if (!localStorage.getItem(STORAGE_KEYS.CYCLES)) {
    const defaultCycles: CycleLog[] = [
      { id: 'cy1', startDate: '2026-09-01', endDate: '2026-09-06', cycleLengthDays: 28, periodLengthDays: 5 },
      { id: 'cy2', startDate: '2026-08-04', endDate: '2026-08-09', cycleLengthDays: 28, periodLengthDays: 5 },
    ];
    localStorage.setItem(STORAGE_KEYS.CYCLES, JSON.stringify(defaultCycles));
  }
};

// Execute seed on file load
seedDefaults();

const mirrorContactsToServer = (contacts: Contact[]) => {
  if (typeof fetch === 'undefined') return;
  fetch('/api/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contacts })
  }).catch(() => {
    // Non-blocking backup to server
  });
};

export const StorageService = {
  // Contacts — verified persistent storage with zero dummy data
  getContacts: (): Contact[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CONTACTS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const { cleaned, changed } = sanitizeContactsList(parsed);
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  },
  saveContacts: (contacts: Contact[]): boolean => {
    const { cleaned } = sanitizeContactsList(contacts);
    const serialized = JSON.stringify(cleaned);
    localStorage.setItem(STORAGE_KEYS.CONTACTS, serialized);
    // Read-back verification so we never claim a contact was saved if persistence failed
    const verifyRaw = localStorage.getItem(STORAGE_KEYS.CONTACTS);
    if (verifyRaw !== serialized) {
      throw new Error('Failed to verify contact persistence in device storage.');
    }
    mirrorContactsToServer(cleaned);
    return true;
  },
  syncContactsFromServerIfEmpty: async (): Promise<Contact[]> => {
    const local = StorageService.getContacts();
    if (local.length > 0) {
      mirrorContactsToServer(local);
      return local;
    }
    try {
      const res = await fetch('/api/contacts');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.contacts) && data.contacts.length > 0) {
          const { cleaned } = sanitizeContactsList(data.contacts);
          if (cleaned.length > 0) {
            localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(cleaned));
            return cleaned;
          }
        }
      }
    } catch {
      // Offline or server unavailable; use local storage
    }
    return local;
  },
  addContact: (contact: Contact): Contact[] => {
    const list = StorageService.getContacts();
    // If new contact is marked primary or is the first contact, ensure primary flag is consistent
    if (contact.isPrimary || list.length === 0) {
      list.forEach(c => { c.isPrimary = false; });
      contact.isPrimary = true;
    }
    list.unshift(contact);
    StorageService.saveContacts(list);
    return StorageService.getContacts();
  },
  updateContact: (contact: Contact): Contact[] => {
    const list = StorageService.getContacts();
    const index = list.findIndex(c => c.id === contact.id);
    if (index === -1) {
      throw new Error('Contact not found in storage.');
    }
    if (contact.isPrimary) {
      list.forEach(c => { c.isPrimary = false; });
    }
    list[index] = contact;
    if (list.length > 0 && !list.some(c => c.isPrimary)) {
      list[0].isPrimary = true;
    }
    StorageService.saveContacts(list);
    return StorageService.getContacts();
  },
  deleteContact: (contactId: string): Contact[] => {
    const existing = StorageService.getContacts();
    const list = existing.filter(c => c.id !== contactId);
    // If the primary contact was deleted and list is not empty, elevate first contact
    if (list.length > 0 && !list.some(c => c.isPrimary)) {
      list[0].isPrimary = true;
    }
    StorageService.saveContacts(list);
    return StorageService.getContacts();
  },
  setPrimaryContact: (contactId: string): Contact[] => {
    const list = StorageService.getContacts().map(c => ({
      ...c,
      isPrimary: c.id === contactId
    }));
    StorageService.saveContacts(list);
    return StorageService.getContacts();
  },

  // Incidents
  getIncidents: (): SOSIncident[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.INCIDENTS) || '[]');
    } catch { return []; }
  },
  addIncident: (incident: SOSIncident) => {
    const list = StorageService.getIncidents();
    list.unshift(incident);
    localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(list));
  },

  // Menstrual Cycle Logs
  getCycles: (): CycleLog[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CYCLES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [
      { id: 'cy1', startDate: '2026-09-01', endDate: '2026-09-06', cycleLengthDays: 28, periodLengthDays: 5, notes: 'Normal flow, mild cramps on day 1' },
      { id: 'cy2', startDate: '2026-08-04', endDate: '2026-08-09', cycleLengthDays: 28, periodLengthDays: 5, notes: 'Regular cycle, good hydration' },
      { id: 'cy3', startDate: '2026-07-07', endDate: '2026-07-12', cycleLengthDays: 28, periodLengthDays: 5, notes: 'Slight fatigue on days 1-2' }
    ];
  },
  saveCycles: (cycles: CycleLog[]) => {
    localStorage.setItem(STORAGE_KEYS.CYCLES, JSON.stringify(cycles));
    StorageService.syncWellnessToServer();
  },

  // Pregnancy Profile
  getPregnancyProfile: (): PregnancyProfile => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PREGNANCY) || '{"active": false, "currentWeek": 0, "currentDay": 0, "trimester": 1}');
    } catch {
      return { active: false, currentWeek: 0, currentDay: 0, trimester: 1 };
    }
  },
  savePregnancyProfile: (profile: PregnancyProfile) => {
    localStorage.setItem(STORAGE_KEYS.PREGNANCY, JSON.stringify(profile));
  },

  // Appointments
  getAppointments: (): Appointment[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.APPOINTMENTS) || '[]');
    } catch { return []; }
  },
  saveAppointments: (appts: Appointment[]) => {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appts));
  },

  // Evidence Vault
  getEvidence: (): EvidenceItem[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.EVIDENCE) || '[]');
    } catch { return []; }
  },
  addEvidence: (item: EvidenceItem) => {
    const list = StorageService.getEvidence();
    list.unshift(item);
    localStorage.setItem(STORAGE_KEYS.EVIDENCE, JSON.stringify(list));
  },

  // Rescue Passport
  getPassport: (): RescuePassport | null => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PASSPORT);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },
  savePassport: (passport: RescuePassport) => {
    localStorage.setItem(STORAGE_KEYS.PASSPORT, JSON.stringify(passport));
  },

  // Chat History
  getChatHistory: (): ChatMessage[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY) || '[]');
    } catch { return []; }
  },
  saveChatHistory: (messages: ChatMessage[]) => {
    localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(messages));
  },
  clearChatHistory: () => {
    localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
  },

  // Geofence Config
  getGeofenceConfig: (): GeofenceConfig => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GEOFENCE);
      if (data) {
        return JSON.parse(data);
      }
    } catch {}
    return {
      radiusKm: 5, // Default to 5 km as required
      notifyOnExit: true,
      anchorLocation: null,
    };
  },

  saveGeofenceConfig: (config: GeofenceConfig) => {
    localStorage.setItem(STORAGE_KEYS.GEOFENCE, JSON.stringify(config));
  },

  // Safety Search Radius (1km, 3km, 5km, 10km, 25km)
  getSafetySearchRadius: (): number => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAFETY_SEARCH_RADIUS);
      if (data) {
        const parsed = parseFloat(data);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {}
    return 5; // Default 5 km search radius
  },

  saveSafetySearchRadius: (radiusKm: number) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SAFETY_SEARCH_RADIUS, radiusKm.toString());
    } catch (e) {
      console.warn('Failed to save safety search radius to localStorage:', e);
    }
  },

  // Local-Date Helper (Time-zone aware YYYY-MM-DD so daily resets happen at local midnight)
  getLocalDateString: (dateObj: Date = new Date()): string => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Non-blocking background sync of nutrition & wellness state to backend store
  syncWellnessToServer: () => {
    if (typeof fetch === 'undefined') return;
    try {
      const payload = {
        profile: StorageService.getUserNutritionProfile(),
        completedMeals: StorageService.getAllCompletedMeals(),
        waterEntries: StorageService.getAllWaterEntries(),
        customFoods: StorageService.getCustomFoods()
      };
      fetch('/api/wellness/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch {}
  },

  // Nutrition User Profile
  getUserNutritionProfile: (): UserNutritionProfile => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NUTRITION_USER_PROFILE);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          age: parsed.age ?? 26,
          weightKg: parsed.weightKg ?? 58,
          heightCm: parsed.heightCm ?? 160,
          country: parsed.country || 'India',
          region: parsed.region || 'Tamil Nadu, Chennai',
          preferredCuisine: parsed.preferredCuisine || 'Tamil / South Indian',
          dietType: parsed.dietType || 'veg',
          allergies: Array.isArray(parsed.allergies) ? parsed.allergies : [],
          dislikedFoods: Array.isArray(parsed.dislikedFoods) ? parsed.dislikedFoods : [],
          budget: parsed.budget || 'budget',
          cookingTimeMinutes: parsed.cookingTimeMinutes || 30,
          wakingTime: parsed.wakingTime || '07:00',
          sleepingTime: parsed.sleepingTime || '22:30',
          activityLevel: parsed.activityLevel || 'moderate',
          climate: parsed.climate || 'warm_humid',
          preferredLanguage: parsed.preferredLanguage || 'en',
          nutritionGoals: Array.isArray(parsed.nutritionGoals) ? parsed.nutritionGoals : ['Balanced Energy', 'Gentle Digestion', 'Adequate Hydration'],
          clinicianRestrictions: Array.isArray(parsed.clinicianRestrictions) ? parsed.clinicianRestrictions : [],
          wellnessJourneyMode: parsed.wellnessJourneyMode || 'general',
          customWaterTargetMl: parsed.customWaterTargetMl ?? null,
          medicalFluidRestrictionMl: parsed.medicalFluidRestrictionMl ?? null,
          shareProgressWithMainAI: parsed.shareProgressWithMainAI !== undefined ? Boolean(parsed.shareProgressWithMainAI) : true
        };
      }
    } catch {}
    return {
      age: 26,
      weightKg: 58,
      heightCm: 160,
      country: 'India',
      region: 'Tamil Nadu, Chennai',
      preferredCuisine: 'Tamil / South Indian',
      dietType: 'veg',
      allergies: [],
      dislikedFoods: [],
      budget: 'budget',
      cookingTimeMinutes: 30,
      wakingTime: '07:00',
      sleepingTime: '22:30',
      activityLevel: 'moderate',
      climate: 'warm_humid',
      preferredLanguage: 'en',
      nutritionGoals: ['Balanced Energy', 'Gentle Digestion', 'Adequate Hydration'],
      clinicianRestrictions: [],
      wellnessJourneyMode: 'general',
      customWaterTargetMl: null,
      medicalFluidRestrictionMl: null,
      shareProgressWithMainAI: true
    };
  },
  saveUserNutritionProfile: (profile: UserNutritionProfile) => {
    localStorage.setItem(STORAGE_KEYS.NUTRITION_USER_PROFILE, JSON.stringify(profile));
    StorageService.syncWellnessToServer();
  },

  getMenstrualNutritionProfile: (): MenstrualNutritionProfile => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MENSTRUAL_NUTRITION_PROFILE);
      if (data) return JSON.parse(data);
    } catch {}
    return {
      regularity: 'regular',
      currentCycleDay: 14,
      currentSymptoms: ['Mild Cramps'],
      knownConditions: [],
      comfortFoods: ['Warm Rasam', 'Khichdi', 'Ginger Tea']
    };
  },
  saveMenstrualNutritionProfile: (profile: MenstrualNutritionProfile) => {
    localStorage.setItem(STORAGE_KEYS.MENSTRUAL_NUTRITION_PROFILE, JSON.stringify(profile));
  },

  getPregnancyNutritionProfile: (): PregnancyNutritionProfile => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PREGNANCY_NUTRITION_PROFILE);
      if (data) return JSON.parse(data);
    } catch {}
    return {
      confirmed: true,
      gestationalWeeks: 20,
      isMultiple: false,
      symptoms: ['Mild Morning Nausea'],
      clinicianConditions: [],
      prescribedSupplements: ['Folic Acid 5mg', 'Elemental Iron 100mg', 'Calcium + Vit D3']
    };
  },
  savePregnancyNutritionProfile: (profile: PregnancyNutritionProfile) => {
    localStorage.setItem(STORAGE_KEYS.PREGNANCY_NUTRITION_PROFILE, JSON.stringify(profile));
  },

  // Date-Indexed Daily Meal Plans (Never overwrites today's plan with yesterday's or tomorrow's)
  getDailyPlanByDateAndJourney: (dateStr: string, journey: WellnessJourneyMode): DailyMealPlan | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DAILY_PLANS_BY_DATE);
      if (raw) {
        const map = JSON.parse(raw) as Record<string, DailyMealPlan>;
        const key = `${dateStr}_${journey}`;
        if (map[key] && map[key].date === dateStr) {
          return map[key];
        }
      }
    } catch {}
    // Check legacy keys if date matches
    if (journey === 'pregnancy') {
      const p = StorageService.getPregnancyMealPlan();
      if (p && p.date === dateStr) return p;
    } else if (journey === 'menstrual') {
      const m = StorageService.getMenstrualMealPlan();
      if (m && m.date === dateStr) return m;
    }
    return null;
  },

  saveDailyPlanByDateAndJourney: (plan: DailyMealPlan) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DAILY_PLANS_BY_DATE);
      const map: Record<string, DailyMealPlan> = raw ? JSON.parse(raw) : {};
      const key = `${plan.date}_${plan.journeyType}`;
      map[key] = plan;
      localStorage.setItem(STORAGE_KEYS.DAILY_PLANS_BY_DATE, JSON.stringify(map));
    } catch {}
    if (plan.journeyType === 'pregnancy') {
      localStorage.setItem(STORAGE_KEYS.PREGNANCY_PLAN, JSON.stringify(plan));
    } else {
      localStorage.setItem(STORAGE_KEYS.MENSTRUAL_PLAN, JSON.stringify(plan));
    }
  },

  // Meal Plans (legacy compatibility)
  getMenstrualMealPlan: (): DailyMealPlan | null => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MENSTRUAL_PLAN);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },
  saveMenstrualMealPlan: (plan: DailyMealPlan) => {
    localStorage.setItem(STORAGE_KEYS.MENSTRUAL_PLAN, JSON.stringify(plan));
  },

  getPregnancyMealPlan: (): DailyMealPlan | null => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PREGNANCY_PLAN);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },
  savePregnancyMealPlan: (plan: DailyMealPlan) => {
    localStorage.setItem(STORAGE_KEYS.PREGNANCY_PLAN, JSON.stringify(plan));
  },

  // ==========================================================================
  // COMPLETED MEALS & MANUAL FOOD LOGGING SYSTEM
  // ==========================================================================
  getAllCompletedMeals: (): CompletedMealRecord[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.COMPLETED_MEALS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  getCompletedMealsForDate: (dateStr?: string): CompletedMealRecord[] => {
    const targetDate = dateStr || StorageService.getLocalDateString();
    return StorageService.getAllCompletedMeals().filter(m => m.date === targetDate);
  },

  togglePlannedMealCompletion: (
    dateStr: string,
    slot: 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner' | 'morningSnack' | 'afternoonSnack',
    recipe: {
      mealName: string;
      mealNameTamil?: string;
      portionGuidance: string;
      caloriesApprox: number;
      proteinGramsApprox: number;
      carbsGramsApprox?: number;
      fatsGramsApprox?: number;
      fiberGramsApprox?: number;
      isEstimated?: boolean;
    }
  ): { completed: boolean; recordsForDate: CompletedMealRecord[] } => {
    const all = StorageService.getAllCompletedMeals();
    const existingIdx = all.findIndex(
      m => m.date === dateStr && m.slot === slot && m.source === 'planned'
    );

    if (existingIdx !== -1) {
      // Unmark completion
      all.splice(existingIdx, 1);
      localStorage.setItem(STORAGE_KEYS.COMPLETED_MEALS, JSON.stringify(all));
      StorageService.syncWellnessToServer();
      return {
        completed: false,
        recordsForDate: all.filter(m => m.date === dateStr)
      };
    }

    const now = new Date();
    const record: CompletedMealRecord = {
      id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: dateStr,
      slot,
      mealName: recipe.mealName,
      mealNameTamil: recipe.mealNameTamil,
      portion: recipe.portionGuidance || '1 standard serving',
      calories: Math.round(recipe.caloriesApprox || 300),
      proteinGrams: Number((recipe.proteinGramsApprox || 10).toFixed(1)),
      carbsGrams: Number((recipe.carbsGramsApprox ?? Math.round((recipe.caloriesApprox || 300) * 0.52 / 4)).toFixed(1)),
      fatsGrams: Number((recipe.fatsGramsApprox ?? Math.round((recipe.caloriesApprox || 300) * 0.25 / 9)).toFixed(1)),
      fiberGrams: Number((recipe.fiberGramsApprox ?? 5.5).toFixed(1)),
      completedAt: now.toISOString(),
      localTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'planned',
      isEstimated: Boolean(recipe.isEstimated)
    };

    all.unshift(record);
    localStorage.setItem(STORAGE_KEYS.COMPLETED_MEALS, JSON.stringify(all));
    StorageService.syncWellnessToServer();
    return {
      completed: true,
      recordsForDate: all.filter(m => m.date === dateStr)
    };
  },

  addCompletedMealEntry: (entry: Omit<CompletedMealRecord, 'id' | 'completedAt' | 'localTime'>): CompletedMealRecord[] => {
    const all = StorageService.getAllCompletedMeals();
    const now = new Date();
    const newRecord: CompletedMealRecord = {
      ...entry,
      id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      completedAt: now.toISOString(),
      localTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    all.unshift(newRecord);
    localStorage.setItem(STORAGE_KEYS.COMPLETED_MEALS, JSON.stringify(all));
    StorageService.syncWellnessToServer();
    return all.filter(m => m.date === entry.date);
  },

  deleteCompletedMealEntry: (id: string, dateStr?: string): CompletedMealRecord[] => {
    const all = StorageService.getAllCompletedMeals().filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEYS.COMPLETED_MEALS, JSON.stringify(all));
    StorageService.syncWellnessToServer();
    const target = dateStr || StorageService.getLocalDateString();
    return all.filter(m => m.date === target);
  },

  // ==========================================================================
  // SMART WATER TRACKER (mL, Timestamps, Undo, Personalized Target, History)
  // ==========================================================================
  calculateSuggestedWaterTargetMl: (profile?: UserNutritionProfile): number => {
    const p = profile || StorageService.getUserNutritionProfile();
    // Respect clinician fluid restriction first and foremost
    if (p.medicalFluidRestrictionMl && p.medicalFluidRestrictionMl >= 500 && p.medicalFluidRestrictionMl <= 4000) {
      return Math.round(p.medicalFluidRestrictionMl);
    }
    // Base calculation on weight (~35 mL/kg) or reasonable adult baseline (2100 mL)
    const weight = p.weightKg && p.weightKg >= 35 && p.weightKg <= 150 ? p.weightKg : 58;
    let baseMl = Math.round(weight * 35);

    // Activity level adjustment
    if (p.activityLevel === 'active') baseMl += 350;
    else if (p.activityLevel === 'sedentary') baseMl -= 100;

    // Climate adjustment
    if (p.climate === 'hot_dry') baseMl += 300;
    else if (p.climate === 'warm_humid') baseMl += 200;

    // Wellness journey adjustment
    if (p.wellnessJourneyMode === 'pregnancy') baseMl += 300;

    // Clamp to safe physiological daily limits (1500 mL to 3500 mL) so we never encourage excessive consumption
    const clamped = Math.max(1500, Math.min(3500, baseMl));
    return Math.round(clamped / 50) * 50;
  },

  getEffectiveWaterTargetMl: (profile?: UserNutritionProfile): number => {
    const p = profile || StorageService.getUserNutritionProfile();
    if (p.medicalFluidRestrictionMl && p.medicalFluidRestrictionMl >= 500) {
      return Math.round(p.medicalFluidRestrictionMl);
    }
    if (p.customWaterTargetMl && p.customWaterTargetMl >= 800 && p.customWaterTargetMl <= 4500) {
      return Math.round(p.customWaterTargetMl);
    }
    return StorageService.calculateSuggestedWaterTargetMl(p);
  },

  getAllWaterEntries: (): WaterIntakeEntry[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WATER_ENTRIES);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  getWaterSummaryForDate: (dateStr?: string): DailyWaterSummary => {
    const targetDate = dateStr || StorageService.getLocalDateString();
    const profile = StorageService.getUserNutritionProfile();
    const suggestedTargetMl = StorageService.calculateSuggestedWaterTargetMl(profile);
    const targetMl = StorageService.getEffectiveWaterTargetMl(profile);
    const entries = StorageService.getAllWaterEntries().filter(e => e.date === targetDate);
    const consumedMl = entries.reduce((sum, e) => sum + (Number(e.amountMl) || 0), 0);
    const remainingMl = Math.max(0, targetMl - consumedMl);
    const completionPercent = targetMl > 0 ? Math.min(100, Math.round((consumedMl / targetMl) * 100)) : 0;

    return {
      date: targetDate,
      targetMl,
      suggestedTargetMl,
      consumedMl,
      remainingMl,
      completionPercent,
      isMedicalFluidRestriction: Boolean(profile.medicalFluidRestrictionMl && profile.medicalFluidRestrictionMl > 0),
      entries
    };
  },

  addWaterIntakeEntry: (amountMl: number, dateStr?: string, sourceLabel?: string): DailyWaterSummary => {
    const cleanAmount = Math.round(Number(amountMl) || 0);
    const targetDate = dateStr || StorageService.getLocalDateString();
    if (cleanAmount <= 0 || cleanAmount > 2500) {
      return StorageService.getWaterSummaryForDate(targetDate);
    }
    const now = new Date();
    const entry: WaterIntakeEntry = {
      id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: targetDate,
      amountMl: cleanAmount,
      timestamp: now.toISOString(),
      localTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sourceLabel: sourceLabel || `${cleanAmount} mL`
    };
    const all = StorageService.getAllWaterEntries();
    all.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.WATER_ENTRIES, JSON.stringify(all));
    StorageService.syncWellnessToServer();
    return StorageService.getWaterSummaryForDate(targetDate);
  },

  undoLastWaterEntryForDate: (dateStr?: string): DailyWaterSummary => {
    const targetDate = dateStr || StorageService.getLocalDateString();
    const all = StorageService.getAllWaterEntries();
    const idx = all.findIndex(e => e.date === targetDate);
    if (idx !== -1) {
      all.splice(idx, 1);
      localStorage.setItem(STORAGE_KEYS.WATER_ENTRIES, JSON.stringify(all));
      StorageService.syncWellnessToServer();
    }
    return StorageService.getWaterSummaryForDate(targetDate);
  },

  deleteWaterEntryById: (id: string, dateStr?: string): DailyWaterSummary => {
    const targetDate = dateStr || StorageService.getLocalDateString();
    const all = StorageService.getAllWaterEntries().filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.WATER_ENTRIES, JSON.stringify(all));
    StorageService.syncWellnessToServer();
    return StorageService.getWaterSummaryForDate(targetDate);
  },

  // ==========================================================================
  // INTELLIGENT FOOD & NUTRIENT DATABASE (Reference + Custom User Foods)
  // ==========================================================================
  getCustomFoods: (): FoodDatabaseItem[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_FOOD_DB);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  getAllFoodDatabaseItems: (): FoodDatabaseItem[] => {
    const custom = StorageService.getCustomFoods();
    return [...custom, ...INITIAL_FOOD_DATABASE];
  },

  addCustomFoodToDatabase: (
    item: Omit<FoodDatabaseItem, 'id' | 'sourceType' | 'isCustom'>
  ): { added: boolean; error?: string; items: FoodDatabaseItem[] } => {
    const all = StorageService.getAllFoodDatabaseItems();
    const normalizedName = item.name.trim().toLowerCase();
    if (!normalizedName) {
      return { added: false, error: 'Food name is required.', items: all };
    }
    // Prevent duplicate food entries
    if (all.some(existing => existing.name.trim().toLowerCase() === normalizedName)) {
      return { added: false, error: `"${item.name.trim()}" already exists in the Food Database.`, items: all };
    }

    const newFood: FoodDatabaseItem = {
      ...item,
      id: `custom-fd-${Date.now()}`,
      name: item.name.trim(),
      sourceType: 'User_Custom_Estimated',
      isCustom: true
    };
    const customList = [newFood, ...StorageService.getCustomFoods()];
    localStorage.setItem(STORAGE_KEYS.CUSTOM_FOOD_DB, JSON.stringify(customList));
    StorageService.syncWellnessToServer();
    return { added: true, items: StorageService.getAllFoodDatabaseItems() };
  },

  deleteCustomFoodFromDatabase: (id: string): FoodDatabaseItem[] => {
    const updated = StorageService.getCustomFoods().filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_FOOD_DB, JSON.stringify(updated));
    StorageService.syncWellnessToServer();
    return StorageService.getAllFoodDatabaseItems();
  },

  // ==========================================================================
  // DAILY COMPLETION, WEEKLY PROGRESS & CONGRATULATIONS ENGINE
  // ==========================================================================
  getEarnedCongratulations: (dateStr?: string): CongratulationsBadge[] => {
    const targetDate = dateStr || StorageService.getLocalDateString();
    const completedMeals = StorageService.getCompletedMealsForDate(targetDate);
    const waterSummary = StorageService.getWaterSummaryForDate(targetDate);
    const badges: CongratulationsBadge[] = [];

    const hasSlot = (s: string) => completedMeals.some(m => m.slot === s);

    if (hasSlot('breakfast')) {
      const rec = completedMeals.find(m => m.slot === 'breakfast')!;
      badges.push({
        id: `cong-bf-${targetDate}`,
        type: 'breakfast',
        title: 'Breakfast Completed',
        message: 'Excellent work! You completed your breakfast today.',
        earnedAt: rec.localTime
      });
    }

    if (hasSlot('lunch')) {
      const rec = completedMeals.find(m => m.slot === 'lunch')!;
      badges.push({
        id: `cong-ln-${targetDate}`,
        type: 'lunch',
        title: 'Midday Lunch Logged',
        message: 'Great job! You nourished your body with a balanced lunch today.',
        earnedAt: rec.localTime
      });
    }

    if (hasSlot('eveningSnack')) {
      const rec = completedMeals.find(m => m.slot === 'eveningSnack')!;
      badges.push({
        id: `cong-sn-${targetDate}`,
        type: 'eveningSnack',
        title: 'Healthy Snack Completed',
        message: 'Well done! You completed your healthy evening snack.',
        earnedAt: rec.localTime
      });
    }

    if (hasSlot('dinner')) {
      const rec = completedMeals.find(m => m.slot === 'dinner')!;
      badges.push({
        id: `cong-dn-${targetDate}`,
        type: 'dinner',
        title: 'Dinner Completed',
        message: 'Wonderful! You logged a nourishing dinner for tonight.',
        earnedAt: rec.localTime
      });
    }

    if (hasSlot('breakfast') && hasSlot('lunch') && hasSlot('eveningSnack') && hasSlot('dinner')) {
      badges.push({
        id: `cong-allmeals-${targetDate}`,
        type: 'all_meals',
        title: 'All Planned Meals Completed',
        message: 'Wonderful! You completed all your planned meals today.',
        earnedAt: completedMeals[0]?.localTime || 'Today'
      });
    }

    if (waterSummary.consumedMl >= waterSummary.targetMl && waterSummary.targetMl > 0) {
      badges.push({
        id: `cong-water-goal-${targetDate}`,
        type: 'water_goal',
        title: 'Hydration Target Reached',
        message: 'Congratulations! You reached your personalized water target.',
        earnedAt: waterSummary.entries[0]?.localTime || 'Today'
      });
    } else if (waterSummary.entries.length > 0 && waterSummary.consumedMl > 0) {
      badges.push({
        id: `cong-water-prog-${targetDate}`,
        type: 'water_progress',
        title: 'Active Hydration Tracking',
        message: 'Great progress! You are keeping track of your hydration.',
        earnedAt: waterSummary.entries[0]?.localTime || 'Today'
      });
    }

    // Check weekly consistency (at least 2 days with recorded meals or water in the past 7 days)
    const weekly = StorageService.getWeeklyProgressStats();
    if (weekly.daysWithRecords >= 2) {
      badges.push({
        id: `cong-weekly-${targetDate}`,
        type: 'weekly_consistency',
        title: 'Weekly Consistency',
        message: 'Amazing consistency! You have made progress this week.',
        earnedAt: `${weekly.daysWithRecords} active days`
      });
    }

    return badges;
  },

  getWeeklyProgressStats: () => {
    const today = new Date();
    const last7Dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      last7Dates.push(StorageService.getLocalDateString(d));
    }

    const allMeals = StorageService.getAllCompletedMeals();
    const allWater = StorageService.getAllWaterEntries();
    const waterTargetMl = StorageService.getEffectiveWaterTargetMl();

    let daysWithRecords = 0;
    let totalMealsCompletedLast7Days = 0;
    let sumCalories = 0;
    let sumProtein = 0;
    let sumWaterMl = 0;
    let hydrationGoalMetDays = 0;

    const dailyBreakdown = last7Dates.map(dateStr => {
      const dayMeals = allMeals.filter(m => m.date === dateStr);
      const dayWater = allWater.filter(w => w.date === dateStr);
      const cals = dayMeals.reduce((s, m) => s + (m.calories || 0), 0);
      const prot = dayMeals.reduce((s, m) => s + (m.proteinGrams || 0), 0);
      const waterMl = dayWater.reduce((s, w) => s + (w.amountMl || 0), 0);

      if (dayMeals.length > 0 || waterMl > 0) {
        daysWithRecords++;
        totalMealsCompletedLast7Days += dayMeals.length;
        sumCalories += cals;
        sumProtein += prot;
        sumWaterMl += waterMl;
      }
      if (waterMl >= waterTargetMl && waterTargetMl > 0) {
        hydrationGoalMetDays++;
      }

      return {
        date: dateStr,
        shortDay: new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
        mealsCount: dayMeals.length,
        calories: cals,
        proteinGrams: Math.round(prot),
        waterMl,
        waterPercent: waterTargetMl > 0 ? Math.min(100, Math.round((waterMl / waterTargetMl) * 100)) : 0
      };
    });

    const avgDailyCalories = daysWithRecords > 0 ? Math.round(sumCalories / daysWithRecords) : 0;
    const avgDailyProteinGrams = daysWithRecords > 0 ? Math.round(sumProtein / daysWithRecords) : 0;
    const avgDailyWaterMl = daysWithRecords > 0 ? Math.round(sumWaterMl / daysWithRecords) : 0;

    let trendExplanation = 'No historical nutrition or water logs recorded yet. Complete a meal or log water to start tracking your weekly trend.';
    if (daysWithRecords === 1) {
      trendExplanation = `You have logged wellness data on 1 day this week (${totalMealsCompletedLast7Days} meal(s), ${sumWaterMl} mL water). Continue logging daily to compare multi-day trends.`;
    } else if (daysWithRecords > 1) {
      trendExplanation = `Across ${daysWithRecords} tracked days this week, you averaged ${avgDailyCalories} kcal, ${avgDailyProteinGrams}g protein, and ${avgDailyWaterMl} mL water per active day (${totalMealsCompletedLast7Days} total meals completed).`;
    }

    return {
      daysWithRecords,
      totalMealsCompletedLast7Days,
      avgDailyCalories,
      avgDailyProteinGrams,
      avgDailyWaterMl,
      hydrationGoalMetDays,
      trendExplanation,
      dailyBreakdown
    };
  },

  // ==========================================================================
  // SHARED WELLNESS AI CONTEXT (Connects Main Smart Shield AI + Nutrition AI)
  // ==========================================================================
  getSharedWellnessAIContext: (): SharedWellnessAIContext => {
    const now = new Date();
    const localDate = StorageService.getLocalDateString(now);
    const localTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

    const profile = StorageService.getUserNutritionProfile();
    const journeyMode: WellnessJourneyMode = profile.wellnessJourneyMode || 'general';
    const currentPlan = StorageService.getDailyPlanByDateAndJourney(localDate, journeyMode);
    const completedMeals = StorageService.getCompletedMealsForDate(localDate);
    const waterSummary = StorageService.getWaterSummaryForDate(localDate);
    const weekly = StorageService.getWeeklyProgressStats();

    const caloriesTarget = journeyMode === 'pregnancy' ? 2100 : 1850;
    const proteinTarget = journeyMode === 'pregnancy' ? 71 : 55;

    const totalCalories = completedMeals.reduce((s, m) => s + (m.calories || 0), 0);
    const totalProtein = Number(completedMeals.reduce((s, m) => s + (m.proteinGrams || 0), 0).toFixed(1));
    const totalCarbs = Number(completedMeals.reduce((s, m) => s + (m.carbsGrams || 0), 0).toFixed(1));
    const totalFats = Number(completedMeals.reduce((s, m) => s + (m.fatsGrams || 0), 0).toFixed(1));
    const totalFiber = Number(completedMeals.reduce((s, m) => s + (m.fiberGrams || 0), 0).toFixed(1));

    const plannedSlots: ('breakfast' | 'lunch' | 'eveningSnack' | 'dinner')[] = ['breakfast', 'lunch', 'eveningSnack', 'dinner'];
    const uncompletedPlannedSlots = plannedSlots.filter(
      slot => !completedMeals.some(m => m.slot === slot)
    );

    return {
      localDate,
      localTime,
      timeZone,
      wellnessJourneyMode: journeyMode,
      userPreferences: {
        age: profile.age,
        dietType: profile.dietType,
        preferredCuisine: profile.preferredCuisine,
        allergies: profile.allergies,
        dislikedFoods: profile.dislikedFoods,
        activityLevel: profile.activityLevel,
        nutritionGoals: profile.nutritionGoals,
        budget: profile.budget
      },
      todaysPlan: currentPlan
        ? {
            date: currentPlan.date,
            breakfast: {
              name: currentPlan.meals.breakfast.mealName,
              calories: currentPlan.meals.breakfast.caloriesApprox,
              protein: currentPlan.meals.breakfast.proteinGramsApprox,
              portion: currentPlan.meals.breakfast.portionGuidance
            },
            lunch: {
              name: currentPlan.meals.lunch.mealName,
              calories: currentPlan.meals.lunch.caloriesApprox,
              protein: currentPlan.meals.lunch.proteinGramsApprox,
              portion: currentPlan.meals.lunch.portionGuidance
            },
            eveningSnack: {
              name: (currentPlan.meals.eveningSnack || currentPlan.meals.afternoonSnack || currentPlan.meals.morningSnack)?.mealName || 'Roasted Makhana & Sprouts Bowl',
              calories: (currentPlan.meals.eveningSnack || currentPlan.meals.afternoonSnack || currentPlan.meals.morningSnack)?.caloriesApprox || 175,
              protein: (currentPlan.meals.eveningSnack || currentPlan.meals.afternoonSnack || currentPlan.meals.morningSnack)?.proteinGramsApprox || 7,
              portion: (currentPlan.meals.eveningSnack || currentPlan.meals.afternoonSnack || currentPlan.meals.morningSnack)?.portionGuidance || '1 bowl'
            },
            dinner: {
              name: currentPlan.meals.dinner.mealName,
              calories: currentPlan.meals.dinner.caloriesApprox,
              protein: currentPlan.meals.dinner.proteinGramsApprox,
              portion: currentPlan.meals.dinner.portionGuidance
            }
          }
        : null,
      completedMealsToday: completedMeals.map(m => ({
        slot: m.slot,
        mealName: m.mealName,
        portion: m.portion,
        calories: m.calories,
        proteinGrams: m.proteinGrams,
        carbsGrams: m.carbsGrams,
        fatsGrams: m.fatsGrams,
        fiberGrams: m.fiberGrams,
        localTime: m.localTime
      })),
      uncompletedPlannedSlots,
      nutritionTotalsToday: {
        calories: totalCalories,
        proteinGrams: totalProtein,
        carbsGrams: totalCarbs,
        fatsGrams: totalFats,
        fiberGrams: totalFiber,
        caloriesTarget,
        proteinTarget
      },
      waterToday: {
        consumedMl: waterSummary.consumedMl,
        targetMl: waterSummary.targetMl,
        remainingMl: waterSummary.remainingMl,
        completionPercent: waterSummary.completionPercent,
        entryCount: waterSummary.entries.length,
        lastEntryTime: waterSummary.entries[0]?.localTime,
        isMedicalRestriction: waterSummary.isMedicalFluidRestriction
      },
      weeklyProgress: profile.shareProgressWithMainAI !== false
        ? {
            daysWithRecords: weekly.daysWithRecords,
            totalMealsCompletedLast7Days: weekly.totalMealsCompletedLast7Days,
            avgDailyCalories: weekly.avgDailyCalories,
            avgDailyProteinGrams: weekly.avgDailyProteinGrams,
            avgDailyWaterMl: weekly.avgDailyWaterMl,
            hydrationGoalMetDays: weekly.hydrationGoalMetDays,
            trendExplanation: weekly.trendExplanation
          }
        : undefined
    };
  },

  // Nutrition Reminders
  getNutritionReminders: (): NutritionReminderConfig => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NUTRITION_REMINDERS);
      if (data) return JSON.parse(data);
    } catch {}
    return {
      enabled: false,
      morningTime: '08:00',
      lunchTime: '12:30',
      eveningTime: '19:30',
      nightTime: '21:30',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
    };
  },
  saveNutritionReminders: (config: NutritionReminderConfig) => {
    localStorage.setItem(STORAGE_KEYS.NUTRITION_REMINDERS, JSON.stringify(config));
  },

  // Food & Symptom Journal
  getFoodJournalLogs: (): FoodJournalLog[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.FOOD_JOURNAL) || '[]');
    } catch { return []; }
  },
  addFoodJournalLog: (log: FoodJournalLog) => {
    const logs = StorageService.getFoodJournalLogs();
    logs.unshift(log);
    localStorage.setItem(STORAGE_KEYS.FOOD_JOURNAL, JSON.stringify(logs));
  },

  // Smart Grocery List
  getGroceryItems: (): GroceryItem[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.GROCERY_ITEMS) || '[]');
    } catch { return []; }
  },
  saveGroceryItems: (items: GroceryItem[]) => {
    localStorage.setItem(STORAGE_KEYS.GROCERY_ITEMS, JSON.stringify(items));
  },

  // Export & Erase Privacy Controls
  exportAllUserData: () => {
    const exportObj: Record<string, any> = {};
    Object.entries(STORAGE_KEYS).forEach(([key, val]) => {
      exportObj[key] = localStorage.getItem(val);
    });
    return JSON.stringify(exportObj, null, 2);
  },

  wipeAllUserData: () => {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    seedDefaults();
  },

  // Server Sync & Backup partitioned per authenticated user
  syncUserDataFromServer: async (userId: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const headers = AuthService.getAuthHeader();
      const res = await fetch(`/api/wellness/sync?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers
      });
      if (!res.ok) return false;
      const json = await res.json();
      if (!json?.success || !json.data) return false;

      const data = json.data;
      if (Array.isArray(data.contacts)) {
        localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(data.contacts));
      }
      if (Array.isArray(data.incidents)) {
        localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(data.incidents));
      }
      if (Array.isArray(data.cycles)) {
        localStorage.setItem(STORAGE_KEYS.CYCLES, JSON.stringify(data.cycles));
      }
      if (Array.isArray(data.symptoms)) {
        localStorage.setItem(STORAGE_KEYS.SYMPTOMS, JSON.stringify(data.symptoms));
      }
      if (data.pregnancy) {
        localStorage.setItem(STORAGE_KEYS.PREGNANCY, JSON.stringify(data.pregnancy));
      }
      if (Array.isArray(data.appointments)) {
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(data.appointments));
      }
      if (Array.isArray(data.pregJournal)) {
        localStorage.setItem(STORAGE_KEYS.PREG_JOURNAL, JSON.stringify(data.pregJournal));
      }
      if (Array.isArray(data.pregMeds)) {
        localStorage.setItem(STORAGE_KEYS.PREG_MEDS, JSON.stringify(data.pregMeds));
      }
      if (Array.isArray(data.kickLogs)) {
        localStorage.setItem(STORAGE_KEYS.KICK_LOGS, JSON.stringify(data.kickLogs));
      }
      if (Array.isArray(data.evidence)) {
        localStorage.setItem(STORAGE_KEYS.EVIDENCE, JSON.stringify(data.evidence));
      }
      if (data.passport) {
        localStorage.setItem(STORAGE_KEYS.PASSPORT, JSON.stringify(data.passport));
      }
      if (data.nutritionUserProfile) {
        localStorage.setItem(STORAGE_KEYS.NUTRITION_USER_PROFILE, JSON.stringify(data.nutritionUserProfile));
      }
      if (data.menstrualNutritionProfile) {
        localStorage.setItem(STORAGE_KEYS.MENSTRUAL_NUTRITION_PROFILE, JSON.stringify(data.menstrualNutritionProfile));
      }
      if (data.pregnancyNutritionProfile) {
        localStorage.setItem(STORAGE_KEYS.PREGNANCY_NUTRITION_PROFILE, JSON.stringify(data.pregnancyNutritionProfile));
      }
      if (data.menstrualMealPlan) {
        localStorage.setItem(STORAGE_KEYS.MENSTRUAL_PLAN, JSON.stringify(data.menstrualMealPlan));
      }
      if (data.pregnancyMealPlan) {
        localStorage.setItem(STORAGE_KEYS.PREGNANCY_PLAN, JSON.stringify(data.pregnancyMealPlan));
      }
      if (Array.isArray(data.waterEntries)) {
        localStorage.setItem(STORAGE_KEYS.WATER_ENTRIES, JSON.stringify(data.waterEntries));
      }
      if (Array.isArray(data.completedMeals)) {
        localStorage.setItem(STORAGE_KEYS.COMPLETED_MEALS, JSON.stringify(data.completedMeals));
      }
      if (Array.isArray(data.foodJournal)) {
        localStorage.setItem(STORAGE_KEYS.FOOD_JOURNAL, JSON.stringify(data.foodJournal));
      }
      if (Array.isArray(data.groceryItems)) {
        localStorage.setItem(STORAGE_KEYS.GROCERY_ITEMS, JSON.stringify(data.groceryItems));
      }
      return true;
    } catch (e) {
      console.warn('[Storage] Sync from server warning:', e);
      return false;
    }
  },

  backupUserDataToServer: async (userId: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const parseJson = (key: string, def: any = []) => {
        try {
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item) : def;
        } catch {
          return def;
        }
      };

      const payload: Record<string, any> = {
        contacts: StorageService.getContacts(),
        incidents: StorageService.getIncidents(),
        cycles: StorageService.getCycles(),
        symptoms: parseJson(STORAGE_KEYS.SYMPTOMS, []),
        pregnancy: StorageService.getPregnancyProfile(),
        appointments: StorageService.getAppointments(),
        pregJournal: parseJson(STORAGE_KEYS.PREG_JOURNAL, []),
        pregMeds: parseJson(STORAGE_KEYS.PREG_MEDS, []),
        kickLogs: parseJson(STORAGE_KEYS.KICK_LOGS, []),
        evidence: StorageService.getEvidence(),
        passport: StorageService.getPassport(),
        nutritionUserProfile: StorageService.getUserNutritionProfile(),
        menstrualNutritionProfile: StorageService.getMenstrualNutritionProfile(),
        pregnancyNutritionProfile: StorageService.getPregnancyNutritionProfile(),
        menstrualMealPlan: StorageService.getMenstrualMealPlan(),
        pregnancyMealPlan: StorageService.getPregnancyMealPlan(),
        waterEntries: StorageService.getAllWaterEntries(),
        completedMeals: StorageService.getAllCompletedMeals(),
        foodJournal: StorageService.getFoodJournalLogs(),
        groceryItems: StorageService.getGroceryItems()
      };

      const headers = {
        'Content-Type': 'application/json',
        ...AuthService.getAuthHeader()
      };

      const res = await fetch('/api/wellness/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, data: payload })
      });
      return res.ok;
    } catch (e) {
      console.warn('[Storage] Backup to server warning:', e);
      return false;
    }
  }
};
