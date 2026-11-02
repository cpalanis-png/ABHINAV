export type LocationSource =
  | 'phone-gps'
  | 'android-bridge'
  | 'esp32-neo6m'
  | 'last-known-cache'
  | 'none';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  status: 'live' | 'stale' | 'imprecise' | 'unavailable';
  permissionStatus: PermissionState | 'unknown';
  precision?: 'precise' | 'approximate' | 'none';
  source?: LocationSource;
  satellites?: number;
  rawNmea?: string;
  errorReason?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
  isBackupRelay: boolean;
  canSeeLocation: boolean;
  canSeePregnancyUpdates: boolean;
  email?: string;
  syncedFromDevice?: boolean;
  lastSyncedAt?: string;
  avatarColor?: string;
}

export interface NativePickedContact {
  name: string;
  phone: string;
  email?: string;
  source?: 'android-picker' | 'w3c-contact-picker' | 'vcard-import';
}

export type ContactAlertDeliveryState =
  | 'queued'
  | 'sending'
  | 'submitted'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'unknown'
  | 'cancelled'
  | 'sms_composer_ready'
  | 'sms_composer_opened';

export type ContactAlertChannel =
  | 'android-sms-manager'
  | 'backend-sms-gateway'
  | 'native-sms-intent'
  | 'hardware-sim800l'
  | 'none';

export interface ContactAlertStatus {
  contactId: string;
  contactName: string;
  phone: string;
  relationship?: string;
  status: ContactAlertDeliveryState;
  channel: ContactAlertChannel;
  statusLabel: string;
  timestamp: string;
  locationIncluded: boolean;
  errorReason?: string;
}

export interface SOSDispatchSummary {
  sessionId: string;
  startedAt: string;
  messageBody: string;
  locationIncluded: boolean;
  mapsUrl: string | null;
  overallState: 'no_contacts' | 'dispatching' | 'completed' | 'partial_or_manual' | 'failed' | 'cancelled' | 'sms_composer_opened';
  overallSummaryText: string;
  contactStatuses: ContactAlertStatus[];
  locationUpdatedFollowUpSent?: boolean;
  cancelledAt?: string;
  cancellationSent?: boolean;
}

export interface SOSIncident {
  id: string;
  timestamp: string;
  location: LocationData | null;
  status: 'active' | 'cancelled' | 'resolved' | 'escalated';
  cancellationReason?: string;
  notifiedContactsCount: number;
  relayEvents: {
    timestamp: string;
    description: string;
    status: 'sent' | 'delivered' | 'acknowledged' | 'failed';
  }[];
}

export interface CycleLog {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  cycleLengthDays: number;
  periodLengthDays: number;
  notes?: string;
}

export interface SymptomLog {
  id: string;
  date: string; // YYYY-MM-DD
  cramps: 'none' | 'mild' | 'moderate' | 'severe';
  flow: 'spotting' | 'light' | 'medium' | 'heavy';
  mood: string[];
  symptoms: string[];
  waterGlasses: number;
  notes?: string;
}

export interface PregnancyProfile {
  active: boolean;
  startDate?: string; // Last menstrual period date or confirmation date
  dueDate?: string; // YYYY-MM-DD
  currentWeek: number;
  currentDay: number;
  babySizeComparison?: string; // e.g. "Size of a Mango"
  trimester: 1 | 2 | 3 | 4; // 4 = Postpartum
  clinicianName?: string;
  hospitalName?: string;
  emergencyContactPhone?: string;
}

export interface Appointment {
  id: string;
  title: string;
  doctorName: string;
  locationName: string;
  dateTime: string;
  notes?: string;
  questionsToAsk: string[];
  completed: boolean;
}

export interface PregnancyJournalEntry {
  id: string;
  date: string;
  energyLevel: 'low' | 'medium' | 'high';
  sleepHours: number;
  comfortLevel: 'comfortable' | 'mild_discomfort' | 'uncomfortable';
  symptomsLogged: string[];
  notes?: string;
}

export interface PregnancyMedication {
  id: string;
  name: string;
  dosage: string;
  prescribedBy: string;
  frequency: string;
  reminderTimes: string[];
  notes?: string;
  active: boolean;
}

export interface FetalKickLog {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  kickCount: number;
  durationMinutes?: number;
  notes?: string;
}

export type WellnessJourneyMode = 'general' | 'menstrual' | 'pregnancy';

export interface FoodItem {
  id: string;
  name: string;
  localNameTamil?: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dietType: 'veg' | 'vegan' | 'non-veg';
  keyNutrients: string[];
  pregnancySafetyStatus: 'safe' | 'caution' | 'avoid';
  pregnancyPrepNotes?: string;
  caloriesApprox?: number;
}

export interface FoodDatabaseItem {
  id: string;
  name: string;
  localNameTamil?: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'staple' | 'beverage';
  dietType: 'veg' | 'vegan' | 'egg' | 'non-veg';
  servingSize: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  fiberGrams: number;
  keyMicronutrients: string[];
  nutritionalBenefits: string;
  sourceType: 'IFCT_ICMR_Reference' | 'USDA_Reference' | 'User_Custom_Estimated';
  isCustom?: boolean;
}

export interface UserNutritionProfile {
  age?: number;
  weightKg?: number;
  heightCm?: number;
  country: string;
  region: string;
  preferredCuisine: string; // e.g. "Tamil / South Indian", "North Indian", "Continental", "Pan-Asian"
  dietType: 'veg' | 'vegan' | 'egg' | 'non-veg';
  allergies: string[];
  dislikedFoods: string[];
  budget: 'budget' | 'moderate' | 'flexible';
  cookingTimeMinutes: number; // e.g. 20, 30, 45, 60
  wakingTime: string; // "07:00"
  sleepingTime: string; // "22:30"
  activityLevel: 'sedentary' | 'moderate' | 'active';
  climate?: 'temperate' | 'warm_humid' | 'hot_dry';
  preferredLanguage: 'en' | 'ta';
  nutritionGoals: string[];
  clinicianRestrictions: string[];
  wellnessJourneyMode?: WellnessJourneyMode;
  customWaterTargetMl?: number | null;
  medicalFluidRestrictionMl?: number | null;
  shareProgressWithMainAI?: boolean;
}

export interface MenstrualNutritionProfile {
  lmpDate?: string;
  cycleLengthDays?: number;
  regularity: 'regular' | 'irregular' | 'unknown';
  currentCycleDay?: number;
  currentSymptoms: string[]; // cramps, fatigue, bloating, cravings, headache
  knownConditions: string[]; // PCOS, endometriosis, heavy bleeding
  comfortFoods: string[];
}

export interface PregnancyNutritionProfile {
  confirmed: boolean;
  gestationalWeeks: number;
  dueDate?: string;
  isMultiple: boolean;
  symptoms: string[]; // nausea, constipation, heartburn, food aversion, fatigue
  clinicianConditions: string[]; // gestational diabetes, gestational hypertension, anemia risk
  prescribedSupplements: string[]; // iron, folic acid, calcium, DHA, vitamin D
}

export interface MealRecipe {
  id?: string;
  mealName: string;
  mealNameTamil?: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'morning_snack' | 'afternoon_snack' | 'evening_snack';
  ingredients: { item: string; quantity: string; inPantry?: boolean }[];
  preparationSteps: string[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  caloriesApprox: number;
  proteinGramsApprox: number;
  carbsGramsApprox?: number;
  fatsGramsApprox?: number;
  fiberGramsApprox?: number;
  keyNutrients: string[];
  nutritionalBenefits?: string;
  portionGuidance: string;
  substitutions: string[];
  allergyWarnings: string[];
  pregnancySafetyNotes?: string;
  isPregnancySafe: boolean;
  isEstimated?: boolean;
  imageUrl?: string;
  imageTheme?: 'idli_dosa' | 'pongal_upma' | 'thali_lunch' | 'curd_rice' | 'snacks_makhana' | 'sprouts_chaat' | 'roti_paneer' | 'khichdi_bowl' | 'nonveg_curry' | 'egg_masala';
}

export interface DailyMealPlan {
  id: string;
  date: string; // YYYY-MM-DD
  journeyType: WellnessJourneyMode;
  weekOrCyclePhase: string; // e.g. "Week 24 (Trimester 2)" or "Luteal Phase (Est. Day 22)" or "General Daily Wellness"
  meals: {
    breakfast: MealRecipe;
    lunch: MealRecipe;
    dinner: MealRecipe;
    morningSnack?: MealRecipe;
    afternoonSnack?: MealRecipe;
    eveningSnack?: MealRecipe;
  };
  dailyHydrationTargetLiters: number;
  hydrationLoggedLiters: number;
  nutrientHighlights: { nutrient: string; amount: string; purpose: string }[];
  foodSafetyAlerts?: string[];
  symptomFriendlyNotes?: string[];
  seasonalFoodSuggestions?: string[];
  dailyWellnessTip?: string;
  generatedAt: string;
  userCustomInstructions?: string;
  variantSeed?: number;
}

export type PrimaryMealSlot = 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner';

export interface CompletedMealRecord {
  id: string;
  date: string; // YYYY-MM-DD local date
  slot: PrimaryMealSlot | 'morningSnack' | 'afternoonSnack' | 'custom';
  mealName: string;
  mealNameTamil?: string;
  portion: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  fiberGrams: number;
  completedAt: string; // ISO
  localTime: string;
  source: 'planned' | 'manual' | 'database';
  isEstimated: boolean;
}

export interface WaterIntakeEntry {
  id: string;
  date: string; // YYYY-MM-DD local date
  amountMl: number;
  timestamp: string; // ISO
  localTime: string;
  sourceLabel?: string;
}

export interface DailyWaterSummary {
  date: string;
  targetMl: number;
  suggestedTargetMl: number;
  consumedMl: number;
  remainingMl: number;
  completionPercent: number;
  isMedicalFluidRestriction: boolean;
  entries: WaterIntakeEntry[];
}

export interface CongratulationsBadge {
  id: string;
  type: 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner' | 'all_meals' | 'water_progress' | 'water_goal' | 'weekly_consistency';
  title: string;
  message: string;
  earnedAt: string;
}

export interface DailyNutritionProgressRecord {
  date: string; // YYYY-MM-DD
  completedMeals: CompletedMealRecord[];
  waterEntries: WaterIntakeEntry[];
  waterTargetMl: number;
  caloriesTarget: number;
  proteinTargetGrams: number;
  carbsTargetGrams: number;
  fatsTargetGrams: number;
  fiberTargetGrams: number;
  updatedAt: string;
}

export interface SharedWellnessAIContext {
  localDate: string;
  localTime: string;
  timeZone: string;
  wellnessJourneyMode: WellnessJourneyMode;
  userPreferences: {
    age?: number;
    dietType: string;
    preferredCuisine: string;
    allergies: string[];
    dislikedFoods: string[];
    activityLevel: string;
    nutritionGoals: string[];
    budget: string;
  };
  todaysPlan: {
    date: string;
    breakfast: { name: string; calories: number; protein: number; portion: string };
    lunch: { name: string; calories: number; protein: number; portion: string };
    eveningSnack: { name: string; calories: number; protein: number; portion: string };
    dinner: { name: string; calories: number; protein: number; portion: string };
  } | null;
  completedMealsToday: {
    slot: string;
    mealName: string;
    portion: string;
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatsGrams: number;
    fiberGrams: number;
    localTime: string;
  }[];
  uncompletedPlannedSlots: string[];
  nutritionTotalsToday: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatsGrams: number;
    fiberGrams: number;
    caloriesTarget: number;
    proteinTarget: number;
  };
  waterToday: {
    consumedMl: number;
    targetMl: number;
    remainingMl: number;
    completionPercent: number;
    entryCount: number;
    lastEntryTime?: string;
    isMedicalRestriction?: boolean;
  };
  weeklyProgress?: {
    daysWithRecords: number;
    totalMealsCompletedLast7Days: number;
    avgDailyCalories: number;
    avgDailyProteinGrams: number;
    avgDailyWaterMl: number;
    hydrationGoalMetDays: number;
    trendExplanation: string;
  };
}

export interface NutritionReminderConfig {
  enabled: boolean;
  morningTime: string; // e.g. "08:00"
  lunchTime: string; // e.g. "12:30"
  eveningTime: string; // e.g. "19:30"
  nightTime: string; // e.g. "21:30"
  timezone: string;
}

export interface FoodJournalLog {
  id: string;
  date: string;
  time: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodName: string;
  portion: string;
  symptomsFelt: string[];
  hydrationMl: number;
  notes?: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  category: 'produce' | 'dairy_protein' | 'grains_pulses' | 'spices_oils' | 'pantry';
  quantity: string;
  inPantry: boolean;
  estimatedCostInr?: number;
  allergySafe: boolean;
  budgetFriendlyAlternative?: string;
}

export interface EvidenceItem {
  id: string;
  timestamp: string;
  title: string;
  notes: string;
  location?: LocationData | null;
  sha256Hash: string;
  fileAttachmentName?: string;
  fileType?: string;
}

export interface SOSEvidenceRecord {
  id: string;
  timestamp: string;
  durationSeconds: number;
  mediaType: 'video' | 'audio';
  mimeType: string;
  blob?: Blob;
  blobUrl?: string;
  sizeBytes: number;
  location?: LocationData | null;
  sha256Hash: string;
  incidentId?: string;
  status: 'completed' | 'interrupted' | 'failed';
  errorReason?: string;
  title: string;
}

export interface SOSRecordingSessionState {
  isRecording: boolean;
  mediaType: 'video' | 'audio' | 'none';
  elapsedSeconds: number;
  maxDurationSeconds: number;
  status: 'idle' | 'starting' | 'recording' | 'stopping' | 'error';
  error?: string;
  cameraAvailable: boolean;
  microphoneAvailable: boolean;
  incidentId?: string;
}

export interface RescuePassport {
  id: string;
  tokenId: string;
  bloodGroup: string;
  allergies: string[];
  emergencyMedications: string[];
  preExistingConditions: string[];
  emergencyNotes: string;
  expiresAt: string;
  createdAt: string;
  active: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: AIChatMode;
  model?: string;
  groundingSources?: Array<{ title: string; url: string; snippet?: string }>;
  memoriesUsed?: Array<{ id: string; category: AIMemoryCategory; key: string; value: string }>;
  memoriesLearned?: Array<{ id: string; category: AIMemoryCategory; key: string; value: string }>;
  pendingConsentPrompts?: PendingSensitiveMemoryPrompt[];
}

export interface DailyUpdatesData {
  generatedAt: string;
  formattedTime: string;
  timeZone: string;
  model?: string;
  rawText: string;
  groundingSources: Array<{ title: string; url: string; snippet?: string }>;
  searchQueries?: string[];
  status: 'success' | 'error';
  errorMessage?: string;
}


export type AIChatMode =
  | 'universal'
  | 'safety'
  | 'gps'
  | 'menstrual'
  | 'pregnancy'
  | 'nutrition'
  | 'study';

export interface PrivacyHealthCheckStatus {
  locationSharingActive: boolean;
  contactsWithAccessCount: number;
  passportActive: boolean;
  evidenceItemsCount: number;
  chatHistorySaved: boolean;
  dataEncryptedLocally: boolean;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  isVerified?: boolean;
  createdAt: string;
  lastLoginAt?: string;
  consentGiven?: boolean;
  emergencyContactsCount?: number;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

export type AuthScreenState = 'welcome' | 'signin' | 'signup' | 'verify_email' | 'verify_code' | 'forgot_password';

// ============================================================================
// PERSONAL AI MEMORY SYSTEM TYPES
// ============================================================================

export type AIMemoryCategory =
  | 'profile'
  | 'preference'
  | 'nutrition'
  | 'wellness_menstrual'
  | 'wellness_pregnancy'
  | 'safety'
  | 'routine'
  | 'conversation';

export interface AIMemoryItem {
  id: string;
  userId: string;
  category: AIMemoryCategory;
  key: string;
  label: string;
  value: string;
  source: 'user_explicit' | 'conversation_learned' | 'module_sync' | 'onboarding';
  confidence: number;
  isSensitive: boolean;
  consentGranted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PendingSensitiveMemoryPrompt {
  id: string;
  category: AIMemoryCategory;
  key: string;
  label: string;
  value: string;
  reason: string;
}

export interface AIConversationSummary {
  id: string;
  userId: string;
  title: string;
  summary: string;
  keyTopics: string[];
  mode: AIChatMode;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  canContinue: boolean;
}

export interface UserProfileMemory {
  preferredName?: string;
  preferredLanguage?: 'en' | 'ta' | 'tanglish';
  ageRange?: string;
  communicationStyle?: 'concise' | 'detailed' | 'supportive' | 'action_oriented';
  fitnessAndWellnessGoals: string[];
  dailyRoutineNotes: string[];
  reminderPreferences: string[];
  updatedAt: string;
}

export interface UserNutritionMemory {
  dietType?: 'veg' | 'non-veg' | 'vegan' | 'egg' | '';
  allergies: string[];
  dietaryRestrictions: string[];
  dislikedFoods: string[];
  favoriteMeals: string[];
  preferredCuisine: string[];
  hydrationGoalLiters?: number;
  recentWaterIntakeNotes?: string;
  nutritionGoals: string[];
  completedMealsLog: string[];
  skippedMealsLog: string[];
  recommendationFeedback: Array<{ item: string; feedback: 'liked' | 'disliked' | 'helpful'; timestamp: string }>;
  updatedAt: string;
}

export interface UserWellnessMemory {
  consentGranted: boolean;
  consentTimestamp?: string;
  activeWellnessMode?: 'menstrual' | 'pregnancy' | 'general';
  // Menstrual memory
  lastPeriodStartDate?: string;
  averageCycleLength?: number;
  periodDuration?: number;
  typicalFlowLevel?: string;
  commonSymptoms: string[];
  moodAndEnergyPatterns: string[];
  cycleFoodPreferences: string[];
  // Pregnancy memory
  pregnancyCalculationsEnabled?: boolean;
  dueDateOrLmpDate?: string;
  currentTrimesterOrWeekNote?: string;
  pregnancySymptoms: string[];
  pregnancyFoodPreferences: string[];
  pregnancySafeRoutineNotes: string[];
  updatedAt: string;
}

export interface UserSafetyMemory {
  preferredAlertLanguage?: 'en' | 'ta';
  savedEmergencyContactsSummary?: string;
  emergencyContactsCount?: number;
  safeJourneyPreferences: string[];
  sosConfigurationNotes: string[];
  locationSharingPreferences: string[];
  notificationPreferences: string[];
  updatedAt: string;
}

export interface AIMemorySettings {
  memoryEnabled: boolean;
  autoLearnEnabled: boolean;
  wellnessMemoryConsent: boolean;
  nutritionMemoryEnabled: boolean;
  safetyMemoryEnabled: boolean;
  pausedAt?: string;
  updatedAt: string;
}

export interface UserAIMemoryStore {
  userId: string;
  settings: AIMemorySettings;
  profileMemory: UserProfileMemory;
  nutritionMemory: UserNutritionMemory;
  wellnessMemory: UserWellnessMemory;
  safetyMemory: UserSafetyMemory;
  memoryItems: AIMemoryItem[];
  conversationSummaries: AIConversationSummary[];
  activeConversationMessages: ChatMessage[];
  pendingConsentPrompts: PendingSensitiveMemoryPrompt[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// AI PRIVATE SPACE SECURITY SCANNER TYPES
// ============================================================================

export type AISecurityResultCategory =
  | 'No suspicious findings observed.'
  | 'Possible suspicious finding – manual inspection recommended.'
  | 'Unidentified network device – identity not established.'
  | 'Sensor unavailable.'
  | 'Scan incomplete.'
  | 'Confirmed device identity only when supported by reliable evidence.';

export type WifiDeviceStatus =
  | 'Identified device'
  | 'Unknown device'
  | 'Inspection required'
  | 'Not discoverable';

export interface WifiDiscoveredDevice {
  id: string;
  ipAddress: string | null;
  macPrefix: string | null;
  hostname: string | null;
  manufacturer: string | null;
  status: WifiDeviceStatus;
  trustState: 'trusted' | 'unfamiliar' | 'unreviewed';
  discoverySource: 'android-bridge' | 'local-endpoint' | 'manual-oui-lookup';
  notes: string;
}

export interface CameraReflectionFinding {
  id: string;
  timestamp: string;
  relativeX: number;
  relativeY: number;
  peakBrightness: number;
  note: string;
  confidenceNote: string;
}

export interface IRInspectionResult {
  tested: boolean;
  cameraUsed: 'environment' | 'user' | 'none';
  remoteTestPerformed: boolean;
  irLightObserved: boolean;
  filterLimitationNote: string;
}

export interface MagnetometerReading {
  x: number;
  y: number;
  z: number;
  magnitudeUt: number;
  timestamp: number;
}

export interface MagnetometerLogItem {
  id: string;
  timestamp: string;
  magnitudeUt: number;
  x: number;
  y: number;
  z: number;
  userNote: string;
}

export interface PhysicalChecklistItem {
  id: string;
  category: string;
  title: string;
  locationHint: string;
  whatToLookFor: string;
  checked: boolean;
  flaggedSuspicious: boolean;
  userNotes: string;
}

export interface SecurityScannerAIAnalysis {
  overallCategory: AISecurityResultCategory;
  measuredDataSummary: string;
  aiInterpretation: string;
  recommendedNextSteps: string[];
  confidenceLimitations: string;
  generatedAt: string;
}

export interface PrivateSpaceSecurityReport {
  id: string;
  createdAt: string;
  locationLabel: string;
  cameraCapabilities: {
    supported: boolean;
    torchSupported: boolean;
    permissionState: 'prompt' | 'granted' | 'denied' | 'error';
  };
  cameraFindings: CameraReflectionFinding[];
  irInspection: IRInspectionResult;
  wifiScanSummary: {
    scanMethod: string;
    limitationsNote: string;
    devices: WifiDiscoveredDevice[];
  };
  magnetometerSummary: {
    sensorAvailable: boolean;
    unavailabilityReason: string;
    peakMagnitudeUt: number | null;
    logs: MagnetometerLogItem[];
  };
  physicalChecklist: PhysicalChecklistItem[];
  aiAnalysis: SecurityScannerAIAnalysis | null;
  userConsentForAI: boolean;
}


