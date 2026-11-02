import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Droplets,
  Sparkles,
  Heart,
  Baby,
  Calendar,
  Clock,
  CheckCircle2,
  Share2,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  ShoppingBag,
  BookOpen,
  ArrowRightLeft,
  Refrigerator,
  BarChart3,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Info,
  SlidersHorizontal,
  Printer,
  Copy,
  Award,
  Search,
  Undo2,
  Database,
  Send,
  Loader2,
  X,
  Sun
} from 'lucide-react';
import {
  DailyMealPlan,
  MealRecipe,
  UserNutritionProfile,
  MenstrualNutritionProfile,
  PregnancyNutritionProfile,
  GroceryItem,
  WellnessJourneyMode,
  CompletedMealRecord,
  DailyWaterSummary,
  CongratulationsBadge,
  FoodDatabaseItem
} from '../types';
import { StorageService } from '../services/storage';
import { NutritionService } from '../services/nutritionService';
import { getMealVisualArtwork } from '../services/foodDatabase';

interface NutritionPlannerViewProps {
  pregnancyActive: boolean;
}

export const NutritionPlannerView: React.FC<NutritionPlannerViewProps> = ({ pregnancyActive: initialPregnancyActive }) => {
  // Profiles
  const [userProfile, setUserProfile] = useState<UserNutritionProfile>(() => StorageService.getUserNutritionProfile());
  const [menstrualProfile] = useState<MenstrualNutritionProfile>(() => StorageService.getMenstrualNutritionProfile());
  const [pregnancyProfile] = useState<PregnancyNutritionProfile>(() => StorageService.getPregnancyNutritionProfile());

  // 1. 3-Way Wellness Journey Mode ('general' | 'menstrual' | 'pregnancy')
  // Never assumes pregnancy or menstruation unless explicitly chosen or pregnancyActive prop is set
  const [activeJourney, setActiveJourney] = useState<WellnessJourneyMode>(() => {
    if (initialPregnancyActive) return 'pregnancy';
    return userProfile.wellnessJourneyMode || 'general';
  });

  useEffect(() => {
    if (initialPregnancyActive) {
      setActiveJourney('pregnancy');
    }
  }, [initialPregnancyActive]);

  const handleSelectJourneyMode = (mode: WellnessJourneyMode) => {
    setActiveJourney(mode);
    const updated = { ...userProfile, wellnessJourneyMode: mode };
    setUserProfile(updated);
    StorageService.saveUserNutritionProfile(updated);
  };

  // Date & Meal Plan State
  const [currentDate, setCurrentDate] = useState<string>(() => StorageService.getLocalDateString());
  const [mealPlan, setMealPlan] = useState<DailyMealPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [variantSeed, setVariantSeed] = useState<number>(0);

  // Completed Meals & Smart Water Tracker State (in mL)
  const [completedMeals, setCompletedMeals] = useState<CompletedMealRecord[]>(() =>
    StorageService.getCompletedMealsForDate(StorageService.getLocalDateString())
  );
  const [waterSummary, setWaterSummary] = useState<DailyWaterSummary>(() =>
    StorageService.getWaterSummaryForDate(StorageService.getLocalDateString())
  );
  const [customWaterMlInput, setCustomWaterMlInput] = useState<string>('');
  const [waterNoteInput, setWaterNoteInput] = useState<string>('');
  const [congratulations, setCongratulations] = useState<CongratulationsBadge[]>(() =>
    StorageService.getEarnedCongratulations(StorageService.getLocalDateString())
  );
  const [weeklyStats, setWeeklyStats] = useState(() => StorageService.getWeeklyProgressStats());

  // Food & Nutrient Database State
  const [foodDatabase, setFoodDatabase] = useState<FoodDatabaseItem[]>(() => StorageService.getAllFoodDatabaseItems());
  const [foodSearchQuery, setFoodSearchQuery] = useState<string>('');
  const [selectedFoodCategoryFilter, setSelectedFoodCategoryFilter] = useState<string>('all');
  const [logSlotSelection, setLogSlotSelection] = useState<'breakfast' | 'lunch' | 'eveningSnack' | 'dinner' | 'custom'>('breakfast');
  const [showFoodDbModal, setShowFoodDbModal] = useState<boolean>(false);

  // Add Custom Food Form State
  const [showAddCustomFoodForm, setShowAddCustomFoodForm] = useState<boolean>(false);
  const [customFoodName, setCustomFoodName] = useState<string>('');
  const [customFoodServing, setCustomFoodServing] = useState<string>('1 bowl (150g)');
  const [customFoodCalories, setCustomFoodCalories] = useState<string>('250');
  const [customFoodProtein, setCustomFoodProtein] = useState<string>('10');
  const [customFoodCarbs, setCustomFoodCarbs] = useState<string>('35');
  const [customFoodFats, setCustomFoodFats] = useState<string>('7');
  const [customFoodFiber, setCustomFoodFiber] = useState<string>('5');
  const [customFoodDietType, setCustomFoodDietType] = useState<'veg' | 'vegan' | 'egg' | 'non-veg'>('veg');
  const [customFoodBenefits, setCustomFoodBenefits] = useState<string>('');

  // Smart Nutrition AI Q&A State
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<{
    answer: string;
    highlights: string[];
    portionTip: string;
    isEstimated: boolean;
    model: string;
  } | null>(null);

  // Quick Nutrition AI Food Query & Direct Logging State
  const [quickAiFoodQuery, setQuickAiFoodQuery] = useState<string>('');
  const [quickAiFoodPortion, setQuickAiFoodPortion] = useState<string>('1 serving (150g)');
  const [quickAiFoodSlot, setQuickAiFoodSlot] = useState<'breakfast' | 'lunch' | 'eveningSnack' | 'dinner' | 'custom'>('lunch');
  const [quickAiFoodLoading, setQuickAiFoodLoading] = useState<boolean>(false);
  const [quickAiFoodResult, setQuickAiFoodResult] = useState<any | null>(null);

  // UI Modals & Panels
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showSubModal, setShowSubModal] = useState<boolean>(false);
  const [showPantryModal, setShowPantryModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [activeMealDetail, setActiveMealDetail] = useState<MealRecipe | null>(null);

  // Voice Assistant State
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechLanguage] = useState<'en' | 'ta'>('en');

  // Grocery State
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>(() => StorageService.getGroceryItems());
  const [showGrocerySection, setShowGrocerySection] = useState<boolean>(false);

  // Substitution Tool State
  const [subIngredientInput, setSubIngredientInput] = useState<string>('');
  const [subCategoryInput] = useState<string>('protein');
  const [subBudgetPriority] = useState<boolean>(true);
  const [subLoading, setSubLoading] = useState<boolean>(false);
  const [subResult, setSubResult] = useState<any>(null);

  // Pantry-to-Meal Tool State
  const [pantryInput, setPantryInput] = useState<string>('Rice, Toor dal, Spinach, Onions, Mustard seeds');
  const [pantryLoading, setPantryLoading] = useState<boolean>(false);
  const [pantryResult, setPantryResult] = useState<any>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Refresh all date-bound records (completed meals, water summary, congratulations, weekly stats)
  const refreshDateTrackingState = (dateStr: string = currentDate) => {
    setCompletedMeals(StorageService.getCompletedMealsForDate(dateStr));
    setWaterSummary(StorageService.getWaterSummaryForDate(dateStr));
    setCongratulations(StorageService.getEarnedCongratulations(dateStr));
    setWeeklyStats(StorageService.getWeeklyProgressStats());
  };

  // Automatic midnight date check so water & daily completion reset cleanly on new day
  useEffect(() => {
    const interval = setInterval(() => {
      const todayLocal = StorageService.getLocalDateString();
      if (currentDate === todayLocal) {
        refreshDateTrackingState(todayLocal);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [currentDate]);

  // Load or generate meal plan when journey or date changes
  useEffect(() => {
    loadPlanForCurrentJourney(false);
    refreshDateTrackingState(currentDate);
  }, [activeJourney, currentDate]);

  const loadPlanForCurrentJourney = async (forceRegenerate: boolean = false, overridePrompt?: string) => {
    setLoadingPlan(true);
    try {
      const saved = StorageService.getDailyPlanByDateAndJourney(currentDate, activeJourney);
      if (saved && saved.date === currentDate && !forceRegenerate && !overridePrompt) {
        setMealPlan(saved);
        setLoadingPlan(false);
        return;
      }

      const nextSeed = forceRegenerate ? variantSeed + 1 : variantSeed;
      if (forceRegenerate) setVariantSeed(nextSeed);

      const journeyProf =
        activeJourney === 'pregnancy'
          ? pregnancyProfile
          : activeJourney === 'menstrual'
          ? menstrualProfile
          : null;

      const freshPlan = await NutritionService.generateDailyPlan(
        activeJourney,
        userProfile,
        journeyProf,
        overridePrompt || customInstructions,
        currentDate,
        nextSeed
      );

      // If regenerating for today, preserve any meal slots already marked completed by the user
      if (forceRegenerate && mealPlan) {
        const currentDone = StorageService.getCompletedMealsForDate(currentDate);
        const isDone = (s: 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner') =>
          currentDone.some(c => c.slot === s);

        freshPlan.meals = {
          ...freshPlan.meals,
          breakfast: isDone('breakfast') ? mealPlan.meals.breakfast : freshPlan.meals.breakfast,
          lunch: isDone('lunch') ? mealPlan.meals.lunch : freshPlan.meals.lunch,
          eveningSnack: isDone('eveningSnack')
            ? mealPlan.meals.eveningSnack || mealPlan.meals.afternoonSnack
            : freshPlan.meals.eveningSnack,
          dinner: isDone('dinner') ? mealPlan.meals.dinner : freshPlan.meals.dinner
        };
      }

      setMealPlan(freshPlan);
      StorageService.saveDailyPlanByDateAndJourney(freshPlan);
      if (forceRegenerate) {
        showToast('Generated fresh non-repeating meal plan while preserving completed meals!');
      }
    } catch (err) {
      console.error('Error generating plan:', err);
      showToast('Loaded evidence-based daily meal plan.');
    } finally {
      setLoadingPlan(false);
    }
  };

  // Replace a single meal slot (Breakfast, Lunch, Evening Snack, or Dinner)
  const handleReplaceSingleMealSlot = (slot: 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner') => {
    if (!mealPlan) return;
    const nextSeed = variantSeed + 1;
    setVariantSeed(nextSeed);
    const updatedPlan = NutritionService.replaceSingleMealSlot(mealPlan, slot, userProfile, nextSeed);
    setMealPlan(updatedPlan);
    StorageService.saveDailyPlanByDateAndJourney(updatedPlan);
    const slotLabel = slot === 'eveningSnack' ? 'Evening Snack' : slot.charAt(0).toUpperCase() + slot.slice(1);
    showToast(`Swapped ${slotLabel} with ${updatedPlan.meals[slot]?.mealName}!`);
  };

  // Toggle completion of a planned meal slot
  const handleToggleMealCompletion = (slot: 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner') => {
    if (!mealPlan) return;
    const meal =
      slot === 'eveningSnack'
        ? mealPlan.meals.eveningSnack || mealPlan.meals.afternoonSnack
        : mealPlan.meals[slot];
    if (!meal) return;

    const result = StorageService.togglePlannedMealCompletion(currentDate, slot, meal);
    refreshDateTrackingState(currentDate);
    if (result.completed) {
      showToast(`Completed ${meal.mealName} (+${meal.caloriesApprox} kcal, +${meal.proteinGramsApprox}g protein)!`);
    } else {
      showToast(`Removed ${meal.mealName} from completed meals.`);
    }
  };

  // Log a food item from the IFCT/ICMR database to today's completed meals
  const handleLogDatabaseFood = (item: FoodDatabaseItem) => {
    StorageService.addCompletedMealEntry({
      date: currentDate,
      slot: logSlotSelection,
      mealName: item.name,
      mealNameTamil: item.localNameTamil,
      portion: item.servingSize,
      calories: item.calories,
      proteinGrams: item.proteinGrams,
      carbsGrams: item.carbsGrams,
      fatsGrams: item.fatsGrams,
      fiberGrams: item.fiberGrams,
      source: 'database',
      isEstimated: item.sourceType === 'User_Custom_Estimated'
    });
    refreshDateTrackingState(currentDate);
    showToast(`Logged ${item.name} (${item.calories} kcal, ${item.proteinGrams}g protein) to ${currentDate}!`);
  };

  // Add a new custom food to the persistent database
  const handleCreateCustomFood = (e: React.FormEvent) => {
    e.preventDefault();
    const result = StorageService.addCustomFoodToDatabase({
      name: customFoodName,
      category: 'lunch',
      dietType: customFoodDietType,
      servingSize: customFoodServing || '1 serving (150g)',
      calories: Number(customFoodCalories) || 200,
      proteinGrams: Number(customFoodProtein) || 8,
      carbsGrams: Number(customFoodCarbs) || 30,
      fatsGrams: Number(customFoodFats) || 6,
      fiberGrams: Number(customFoodFiber) || 4,
      keyMicronutrients: ['User Logged Entry', 'Balanced Minerals'],
      nutritionalBenefits:
        customFoodBenefits.trim() ||
        'Custom user-added dish with estimated macronutrient values.'
    });

    if (!result.added) {
      showToast(result.error || 'Could not add custom food.');
      return;
    }

    setFoodDatabase(result.items);
    setCustomFoodName('');
    setCustomFoodBenefits('');
    setShowAddCustomFoodForm(false);
    showToast(`Saved "${customFoodName}" to your Food Database!`);
  };

  // Smart Water Tracker Actions (in mL)
  const handleAddWaterMl = (amountMl: number, note?: string) => {
    if (isNaN(amountMl) || amountMl <= 0) {
      showToast('Please enter a valid positive water amount in mL.');
      return;
    }
    if (amountMl > 2500) {
      showToast('Single water entry cannot exceed 2500 mL. Log realistic servings (e.g., 100–500 mL).');
      return;
    }
    const updated = StorageService.addWaterIntakeEntry(amountMl, currentDate, note || waterNoteInput.trim() || undefined);
    setWaterNoteInput('');
    setCustomWaterMlInput('');
    refreshDateTrackingState(currentDate);
    showToast(`Added +${amountMl} mL water! Total today: ${updated.consumedMl} mL / ${updated.targetMl} mL (${updated.completionPercent}%).`);
  };

  const handleUndoLastWater = () => {
    const updated = StorageService.undoLastWaterEntryForDate(currentDate);
    refreshDateTrackingState(currentDate);
    showToast(`Undid last water entry. Current total: ${updated.consumedMl} mL.`);
  };

  const handleDeleteWaterEntry = (entryId: string) => {
    StorageService.deleteWaterEntryById(entryId, currentDate);
    refreshDateTrackingState(currentDate);
    showToast('Removed water entry.');
  };

  // Smart Nutrition AI Question Handler
  const handleAskNutritionAI = async (questionOverride?: string) => {
    const q = (questionOverride ?? aiQuestion).trim();
    if (!q || aiLoading) return;
    if (!questionOverride) setAiQuestion('');
    setAiLoading(true);
    try {
      const res = await NutritionService.askNutritionAI(q);
      setAiResponse(res);
    } finally {
      setAiLoading(false);
    }
  };

  // Quick Food AI Query (Fetches macros & nutritional values via Nutrition AI)
  const handleQuickAiFoodQuery = async (queryOverride?: string) => {
    const q = (queryOverride ?? quickAiFoodQuery).trim();
    if (!q || quickAiFoodLoading) return;
    setQuickAiFoodLoading(true);
    try {
      const analyzed = await NutritionService.analyzeFoodItem(
        q,
        quickAiFoodPortion.trim() || '1 standard serving'
      );
      setQuickAiFoodResult(analyzed);
      showToast(`Analyzed "${analyzed.name}" with Nutrition AI: ${analyzed.calories} kcal, ${analyzed.proteinGrams}g protein.`);
    } catch {
      showToast('Could not analyze food item. Please check the spelling.');
    } finally {
      setQuickAiFoodLoading(false);
    }
  };

  // Log the AI Analyzed Food Directly to Daily Intake
  const handleLogAiFoodResult = () => {
    if (!quickAiFoodResult) return;
    StorageService.addCompletedMealEntry({
      slot: quickAiFoodSlot,
      mealName: quickAiFoodResult.localNameTamil
        ? `${quickAiFoodResult.name} (${quickAiFoodResult.localNameTamil})`
        : quickAiFoodResult.name,
      mealNameTamil: quickAiFoodResult.localNameTamil,
      portion: quickAiFoodResult.servingSize || quickAiFoodPortion || '1 serving',
      calories: Number(quickAiFoodResult.calories) || 200,
      proteinGrams: Number(quickAiFoodResult.proteinGrams) || 8,
      carbsGrams: Number(quickAiFoodResult.carbsGrams) || 30,
      fatsGrams: Number(quickAiFoodResult.fatsGrams) || 6,
      fiberGrams: Number(quickAiFoodResult.fiberGrams) || 4,
      date: currentDate,
      source: 'manual',
      isEstimated: Boolean(quickAiFoodResult.isEstimated)
    });
    refreshDateTrackingState(currentDate);
    showToast(`Logged ${quickAiFoodResult.name} (${quickAiFoodResult.calories} kcal, ${quickAiFoodResult.proteinGrams}g protein) to ${quickAiFoodSlot.toUpperCase()} for ${currentDate}!`);
    setQuickAiFoodResult(null);
    setQuickAiFoodQuery('');
  };

  // Voice Readout
  const handleToggleVoiceReadout = () => {
    if (isSpeaking) {
      NutritionService.stopSpeech();
      setIsSpeaking(false);
      return;
    }
    if (!mealPlan) return;
    const isTa = speechLanguage === 'ta';
    const summary = isTa
      ? `ஸ்மார்ட் ஷீல்ட் ஊட்டச்சத்து வழிகாட்டி. காலை உணவு: ${mealPlan.meals.breakfast.mealNameTamil || mealPlan.meals.breakfast.mealName}. மதிய உணவு: ${mealPlan.meals.lunch.mealNameTamil || mealPlan.meals.lunch.mealName}. மாலை சிற்றுண்டி: ${(mealPlan.meals.eveningSnack || mealPlan.meals.afternoonSnack)?.mealName}. இரவு உணவு: ${mealPlan.meals.dinner.mealNameTamil || mealPlan.meals.dinner.mealName}. இன்றைய தண்ணீர் இலக்கு ${waterSummary.targetMl} மில்லிலிட்டர்.`
      : `Smart Shield Daily Nutrition Plan. Breakfast is ${mealPlan.meals.breakfast.mealName}. Lunch is ${mealPlan.meals.lunch.mealName}. Evening snack is ${(mealPlan.meals.eveningSnack || mealPlan.meals.afternoonSnack)?.mealName}. Dinner is ${mealPlan.meals.dinner.mealName}. Your daily hydration target is ${waterSummary.targetMl} milliliters, and you have logged ${waterSummary.consumedMl} milliliters today.`;

    setIsSpeaking(true);
    NutritionService.speakNutritionPlan(summary, speechLanguage);
    setTimeout(() => setIsSpeaking(false), 16000);
  };

  // Speech-to-Text for Smart Prompt
  const handleSpeechToTextInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Speech recognition is not supported in this browser. Please type your instructions.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = speechLanguage === 'ta' ? 'ta-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);
    showToast('Listening... Speak your meal instructions or cravings now.');
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCustomInstructions(transcript);
      setIsListening(false);
      showToast(`Heard: "${transcript}"`);
    };
    recognition.onerror = () => {
      setIsListening(false);
      showToast('Could not hear voice input. Please try again.');
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // Add all ingredients from current plan to grocery list
  const handleImportPlanToGrocery = () => {
    if (!mealPlan) return;
    const existing = StorageService.getGroceryItems();
    const existingNames = new Set(existing.map(i => i.name.toLowerCase()));
    const newItems: GroceryItem[] = [...existing];

    const allMeals = [
      mealPlan.meals.breakfast,
      mealPlan.meals.lunch,
      mealPlan.meals.eveningSnack || mealPlan.meals.afternoonSnack,
      mealPlan.meals.dinner
    ].filter(Boolean) as MealRecipe[];

    let addedCount = 0;
    allMeals.forEach(meal => {
      meal.ingredients.forEach(ing => {
        if (!existingNames.has(ing.item.toLowerCase())) {
          newItems.push({
            id: `groc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: ing.item,
            quantity: ing.quantity,
            category: 'produce',
            inPantry: Boolean(ing.inPantry),
            allergySafe: true
          });
          existingNames.add(ing.item.toLowerCase());
          addedCount++;
        }
      });
    });

    setGroceryItems(newItems);
    StorageService.saveGroceryItems(newItems);
    setShowGrocerySection(true);
    showToast(`Added ${addedCount} ingredients to your Smart Grocery List.`);
  };

  // Calculate Planned vs Completed Daily Totals
  const primaryMealsList = mealPlan
    ? ([
        { slot: 'breakfast' as const, label: 'Breakfast', timeHint: '7:30 – 9:00 AM', meal: mealPlan.meals.breakfast },
        { slot: 'lunch' as const, label: 'Lunch', timeHint: '12:30 – 2:00 PM', meal: mealPlan.meals.lunch },
        {
          slot: 'eveningSnack' as const,
          label: 'Evening Snack',
          timeHint: '4:30 – 5:30 PM',
          meal: mealPlan.meals.eveningSnack || mealPlan.meals.afternoonSnack
        },
        { slot: 'dinner' as const, label: 'Dinner', timeHint: '7:30 – 9:00 PM', meal: mealPlan.meals.dinner }
      ].filter((x): x is { slot: 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner'; label: string; timeHint: string; meal: MealRecipe } => Boolean(x.meal)))
    : [];

  const plannedDailyTotals = primaryMealsList.reduce(
    (acc, { meal }) => ({
      calories: acc.calories + (meal.caloriesApprox || 0),
      protein: acc.protein + (meal.proteinGramsApprox || 0),
      carbs: acc.carbs + (meal.carbsGramsApprox || 40),
      fats: acc.fats + (meal.fatsGramsApprox || 9),
      fiber: acc.fiber + (meal.fiberGramsApprox || 6)
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 }
  );

  const completedDailyTotals = completedMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + (Number(m.calories) || 0),
      protein: Math.round((acc.protein + (Number(m.proteinGrams) || 0)) * 10) / 10,
      carbs: Math.round((acc.carbs + (Number(m.carbsGrams) || 0)) * 10) / 10,
      fats: Math.round((acc.fats + (Number(m.fatsGrams) || 0)) * 10) / 10,
      fiber: Math.round((acc.fiber + (Number(m.fiberGrams) || 0)) * 10) / 10
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 }
  );

  const isSlotCompleted = (slot: 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner') =>
    completedMeals.some(c => c.slot === slot);

  const completedMainSlotsCount = (['breakfast', 'lunch', 'eveningSnack', 'dinner'] as const).filter(s =>
    isSlotCompleted(s)
  ).length;

  const filteredFoodDb = foodDatabase.filter(item => {
    const matchesCategory =
      selectedFoodCategoryFilter === 'all' || item.category === selectedFoodCategoryFilter;
    const q = foodSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      (item.localNameTamil && item.localNameTamil.toLowerCase().includes(q)) ||
      item.keyMicronutrients.some(t => t.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 border-2 border-emerald-500 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold leading-snug">{toastMessage}</span>
        </div>
      )}

      {/* Top Hero Header & 3-Way Wellness Journey Mode Selector */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950/60 to-slate-900 p-6 border border-emerald-800/60 shadow-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-950">
                <Utensils className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Intelligent Nutrition AI, Meal Planner &amp; Water Tracker
                </h2>
                <p className="text-xs text-emerald-300 font-semibold">
                  ICMR-NIN &amp; IFCT Indian Food Database • Dynamic Non-Repeating Plans • Smart mL Hydration
                </p>
              </div>
            </div>
          </div>

          {/* 3-Way Wellness Mode Switcher (Never assumes pregnancy or menstruation by default) */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => handleSelectJourneyMode('general')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeJourney === 'general'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>General Wellness</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectJourneyMode('menstrual')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeJourney === 'menstrual'
                  ? 'bg-rose-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Menstrual Mode</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectJourneyMode('pregnancy')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeJourney === 'pregnancy'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Baby className="w-3.5 h-3.5" />
              <span>Pregnancy Mode</span>
            </button>
          </div>
        </div>

        {/* Date Selector & Quick Action Toolbar */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center space-x-2 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-300">Plan Date:</span>
              <input
                type="date"
                value={currentDate}
                onChange={e => setCurrentDate(e.target.value || StorageService.getLocalDateString())}
                className="bg-transparent text-xs font-extrabold text-white focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => setCurrentDate(StorageService.getLocalDateString())}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => {
                const tmrw = new Date();
                tmrw.setDate(tmrw.getDate() + 1);
                setCurrentDate(StorageService.getLocalDateString(tmrw));
              }}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-300 cursor-pointer"
            >
              Tomorrow&apos;s Diet
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadPlanForCurrentJourney(true)}
              disabled={loadingPlan}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center space-x-1.5 shadow-lg cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPlan ? 'animate-spin' : ''}`} />
              <span>{loadingPlan ? 'Generating...' : 'Generate New Plan'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFoodDbModal(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>Food Database &amp; Log</span>
            </button>

            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Diet &amp; Water Profile</span>
            </button>

            <button
              type="button"
              onClick={handleToggleVoiceReadout}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
                isSpeaking
                  ? 'bg-amber-600 border-amber-400 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isSpeaking ? 'Stop Audio' : 'Read Plan'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK FOOD NUTRITION AI SEARCH & DAILY INTAKE LOGGER */}
      <section
        aria-label="Quick Nutrition AI Food Search"
        className="rounded-3xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-emerald-950/50 p-6 border border-indigo-700/50 shadow-xl space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/90 border border-indigo-400/40 flex items-center justify-center shrink-0">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                <span>Quick Nutrition AI Food Search</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700">
                  Instant Macro Analysis &amp; Log
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Query any Indian or regional dish with Nutrition AI to inspect accurate calories, protein, carbs, fats &amp; fiber, then log it directly to {currentDate}.
              </p>
            </div>
          </div>

          {/* Target Meal Slot Dropdown */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs text-slate-400 font-semibold">Log to slot:</span>
            <select
              value={quickAiFoodSlot}
              onChange={e => setQuickAiFoodSlot(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-emerald-700/70 text-xs font-bold text-emerald-300 focus:outline-none cursor-pointer"
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="eveningSnack">Evening Snack</option>
              <option value="dinner">Dinner</option>
              <option value="custom">Extra / Custom Snack</option>
            </select>
          </div>
        </div>

        {/* Quick Food Search Input Form */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleQuickAiFoodQuery();
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={quickAiFoodQuery}
              onChange={e => setQuickAiFoodQuery(e.target.value)}
              placeholder="Search food or dish (e.g. '2 Rava Idli & Sambar', 'Paneer Methi Bhurji', 'Moong Dal Sundal', 'Ragi Dosa')..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="w-full sm:w-48 shrink-0">
            <input
              type="text"
              value={quickAiFoodPortion}
              onChange={e => setQuickAiFoodPortion(e.target.value)}
              placeholder="Portion (e.g. 1 bowl, 2 pcs)"
              className="w-full px-3.5 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={quickAiFoodLoading || !quickAiFoodQuery.trim()}
            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-950 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {quickAiFoodLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-200" />
            )}
            <span>{quickAiFoodLoading ? 'Analyzing...' : 'Analyze Food'}</span>
          </button>
        </form>

        {/* Quick Food Query Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-slate-400">
          <span className="text-[11px] font-semibold text-slate-400">Popular Quick Queries:</span>
          {[
            '2 Steamed Idlis + Veg Sambar',
            'Moong Dal Sundal (1 bowl)',
            '2 Whole Wheat Phulkas + Dal',
            'Ragi Porridge / Malt (1 cup)',
            'Paneer Bhurji (100g)',
            'Boiled Egg (2 pcs)'
          ].map(quickFood => (
            <button
              key={quickFood}
              type="button"
              onClick={() => {
                setQuickAiFoodQuery(quickFood);
                handleQuickAiFoodQuery(quickFood);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-indigo-950 border border-slate-800 hover:border-indigo-700 text-[11px] font-medium text-slate-300 hover:text-indigo-200 transition-colors cursor-pointer"
            >
              {quickFood}
            </button>
          ))}
        </div>

        {/* AI Analyzed Food Result & One-Tap Direct Logging Card */}
        {quickAiFoodResult && (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-emerald-600/60 shadow-xl space-y-3 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm sm:text-base font-black text-white">
                    {quickAiFoodResult.name}
                    {quickAiFoodResult.localNameTamil && (
                      <span className="text-emerald-400 font-bold ml-2">({quickAiFoodResult.localNameTamil})</span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Portion: <strong className="text-slate-200">{quickAiFoodResult.servingSize}</strong> •{' '}
                    Diet: <span className="uppercase text-emerald-300 font-semibold">{quickAiFoodResult.dietType}</span>
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                {quickAiFoodResult.isEstimated ? 'Nutrition AI Estimated' : 'ICMR / IFCT Reference Aligned'}
              </span>
            </div>

            {/* Macro Breakdown Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Calories</div>
                <div className="text-sm font-black text-amber-300">{quickAiFoodResult.calories} kcal</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Protein</div>
                <div className="text-sm font-black text-emerald-300">{quickAiFoodResult.proteinGrams}g</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Carbs</div>
                <div className="text-sm font-black text-cyan-300">{quickAiFoodResult.carbsGrams}g</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Fats</div>
                <div className="text-sm font-black text-rose-300">{quickAiFoodResult.fatsGrams}g</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Fiber</div>
                <div className="text-sm font-black text-purple-300">{quickAiFoodResult.fiberGrams}g</div>
              </div>
            </div>

            {/* Benefits & Portion Advice */}
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-emerald-300">Nutritional Benefits: </strong>
              {quickAiFoodResult.nutritionalBenefits}
            </p>

            {/* Micronutrient tags */}
            {quickAiFoodResult.keyMicronutrients && quickAiFoodResult.keyMicronutrients.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {quickAiFoodResult.keyMicronutrients.map((m: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}

            {/* Direct Log to Daily Intake Button */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80">
              <div className="text-xs text-slate-400">
                Target date: <strong className="text-white">{currentDate}</strong> • Slot:{' '}
                <strong className="text-emerald-300 uppercase">{quickAiFoodSlot}</strong>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setQuickAiFoodResult(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Dismiss
                </button>

                <button
                  type="button"
                  onClick={handleLogAiFoodResult}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-emerald-950 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Log to Daily Intake</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4: DAILY COMPLETION, PROGRESS & CONGRATULATIONS SYSTEM */}
      <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <Award className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="text-lg font-black text-white">
                Daily Progress &amp; Milestones ({currentDate})
              </h3>
              <p className="text-xs text-slate-400">
                Real-time macro calculation from your recorded meals &amp; water entries
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-700 text-emerald-200 font-extrabold">
              Planned Meals Done: {completedMainSlotsCount} / 4
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-cyan-950 border border-cyan-700 text-cyan-200 font-extrabold">
              Water Goal: {waterSummary.completionPercent}% ({waterSummary.consumedMl} / {waterSummary.targetMl} mL)
            </span>
          </div>
        </div>

        {/* Positive Congratulations Badges (Only shown when genuinely earned!) */}
        {congratulations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {congratulations.map(badge => (
              <div
                key={badge.id}
                className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-slate-950 border border-emerald-500/60 flex items-start space-x-3 shadow-md"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black text-emerald-200">{badge.title}</h4>
                  <p className="text-xs text-slate-200 leading-relaxed">{badge.message}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Info className="w-5 h-5 text-cyan-400 shrink-0" />
              <p className="text-xs text-slate-300">
                Mark your first meal completed or log water in mL below to unlock today&apos;s real-time wellness milestones!
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-400 shrink-0">0 milestones yet today</span>
          </div>
        )}

        {/* Live Macro Progress Cards (Completed vs Planned Daily Reference) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            {
              label: 'Calories',
              done: completedDailyTotals.calories,
              target: plannedDailyTotals.calories || 1650,
              unit: 'kcal',
              color: 'text-amber-300',
              bar: 'bg-amber-500'
            },
            {
              label: 'Protein',
              done: completedDailyTotals.protein,
              target: plannedDailyTotals.protein || 60,
              unit: 'g',
              color: 'text-emerald-300',
              bar: 'bg-emerald-500'
            },
            {
              label: 'Carbohydrates',
              done: completedDailyTotals.carbs,
              target: plannedDailyTotals.carbs || 210,
              unit: 'g',
              color: 'text-cyan-300',
              bar: 'bg-cyan-500'
            },
            {
              label: 'Healthy Fats',
              done: completedDailyTotals.fats,
              target: plannedDailyTotals.fats || 45,
              unit: 'g',
              color: 'text-rose-300',
              bar: 'bg-rose-500'
            },
            {
              label: 'Dietary Fiber',
              done: completedDailyTotals.fiber,
              target: plannedDailyTotals.fiber || 28,
              unit: 'g',
              color: 'text-purple-300',
              bar: 'bg-purple-500'
            }
          ].map(macro => {
            const pct = macro.target > 0 ? Math.min(100, Math.round((macro.done / macro.target) * 100)) : 0;
            return (
              <div key={macro.label} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400">{macro.label}</span>
                  <span className="text-[10px] font-black text-slate-400">{pct}%</span>
                </div>
                <div className={`text-sm font-black ${macro.color}`}>
                  {macro.done} <span className="text-[11px] font-normal text-slate-400">/ {macro.target} {macro.unit}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className={`h-full ${macro.bar} transition-all duration-300`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: INTERACTIVE SMART WATER TRACKER (IN mL) */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-cyan-950/40 to-slate-900 p-6 border border-cyan-800/60 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-900/50 pb-4">
          <div className="flex items-start space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-950 shrink-0">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Smart Water Intake Tracker (mL)</h3>
              <p className="text-xs text-cyan-200/90">
                Personalized target based on your profile ({userProfile.weightKg || 58} kg, {userProfile.activityLevel || 'moderate'} activity, {userProfile.climate || 'warm_humid'} climate)
                {userProfile.medicalFluidRestrictionMl
                  ? ` • Medical Fluid Cap Active: ${userProfile.medicalFluidRestrictionMl} mL`
                  : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-xl font-black text-cyan-300">
                {waterSummary.consumedMl} mL <span className="text-xs font-normal text-slate-400">/ {waterSummary.targetMl} mL</span>
              </div>
              <div className="text-[11px] font-bold text-slate-300">
                {waterSummary.remainingMl > 0
                  ? `${waterSummary.remainingMl} mL remaining today (${waterSummary.completionPercent}%)`
                  : `Daily Hydration Target Reached (${waterSummary.completionPercent}%)!`}
              </div>
            </div>

            {waterSummary.entries.length > 0 && (
              <button
                type="button"
                onClick={handleUndoLastWater}
                title="Undo last water entry"
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Undo</span>
              </button>
            )}
          </div>
        </div>

        {/* Visual Water Progress Indicator */}
        <div className="space-y-2">
          <div className="w-full h-5 bg-slate-950 rounded-2xl overflow-hidden border border-cyan-800/80 p-0.5">
            <div
              className="h-full rounded-xl bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500 transition-all duration-500 flex items-center justify-end pr-2"
              style={{ width: `${Math.min(100, waterSummary.completionPercent)}%` }}
            >
              {waterSummary.completionPercent >= 12 && (
                <span className="text-[10px] font-black text-slate-950">{waterSummary.completionPercent}%</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <span>0 mL</span>
            <span>50% ({Math.round(waterSummary.targetMl * 0.5)} mL)</span>
            <span>Target: {waterSummary.targetMl} mL</span>
          </div>
        </div>

        {/* Quick-Add mL Buttons + Custom mL Input */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
            {[
              { ml: 100, label: '+100 mL', sub: 'Small Cup' },
              { ml: 150, label: '+150 mL', sub: 'Tumbler' },
              { ml: 250, label: '+250 mL', sub: '1 Glass' },
              { ml: 300, label: '+300 mL', sub: 'Large Mug' },
              { ml: 500, label: '+500 mL', sub: 'Sipper Bottle' }
            ].map(btn => (
              <button
                key={btn.ml}
                type="button"
                onClick={() => handleAddWaterMl(btn.ml, btn.sub)}
                className="flex-1 min-w-[95px] py-2.5 px-3 rounded-2xl bg-cyan-950/90 hover:bg-cyan-800/80 border border-cyan-600/60 text-white transition-all cursor-pointer text-center shadow-md active:scale-95"
              >
                <div className="text-xs font-black text-cyan-200">{btn.label}</div>
                <div className="text-[10px] text-slate-300">{btn.sub}</div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-5 flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={2500}
              step={10}
              value={customWaterMlInput}
              onChange={e => setCustomWaterMlInput(e.target.value)}
              placeholder="Custom mL (e.g. 200)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleAddWaterMl(Number(customWaterMlInput), 'Custom mL Entry')}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold shrink-0 cursor-pointer"
            >
              Add mL
            </button>
          </div>
        </div>

        {/* Timestamped Water Entries Log for Selected Date */}
        {waterSummary.entries.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Recorded Water Entries ({currentDate}) — {waterSummary.entries.length} logs
            </div>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
              {waterSummary.entries.map(entry => (
                <div
                  key={entry.id}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2 text-xs"
                >
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-black text-cyan-200">{entry.amountMl} mL</span>
                  {entry.sourceLabel && <span className="text-slate-400 text-[11px]">({entry.sourceLabel})</span>}
                  <span className="text-[10px] text-slate-500">{entry.localTime}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteWaterEntry(entry.id)}
                    className="text-slate-500 hover:text-rose-400 cursor-pointer ml-1"
                    title="Delete entry"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: AUTOMATIC DAILY MEAL PLANNER (BREAKFAST, LUNCH, EVENING SNACK, DINNER) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-black text-white flex items-center space-x-2">
              <Utensils className="w-5 h-5 text-emerald-400" />
              <span>Automatic Daily Meal Planner ({currentDate})</span>
            </h3>
            <p className="text-xs text-slate-400">
              {mealPlan?.weekOrCyclePhase || 'Balanced Daily Nutrition'} • Tap &ldquo;Mark Completed&rdquo; when you finish a meal or &ldquo;Swap Meal&rdquo; for a fresh dish
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleImportPlanToGrocery}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-300 flex items-center space-x-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Send Ingredients to Grocery List</span>
            </button>
          </div>
        </div>

        {/* Custom Craving / Dietary Instruction Bar */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full flex items-center space-x-2 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              type="text"
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              placeholder="Optional: Add a craving or instruction (e.g., 'South Indian millet breakfast, high protein, no mushroom')..."
              className="w-full bg-transparent text-xs text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSpeechToTextInput}
              className={`p-1.5 rounded-lg cursor-pointer ${
                isListening ? 'bg-rose-600 text-white animate-pulse' : 'text-slate-400 hover:text-white'
              }`}
              title="Voice input"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => loadPlanForCurrentJourney(true, customInstructions)}
            disabled={loadingPlan}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shrink-0 cursor-pointer"
          >
            Customize Today&apos;s Plan
          </button>
        </div>

        {/* 4 Primary Meal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {primaryMealsList.map(({ slot, label, timeHint, meal }) => {
            const done = isSlotCompleted(slot);
            const artwork = meal.imageUrl || getMealVisualArtwork(meal);

            return (
              <div
                key={slot}
                className={`rounded-3xl overflow-hidden border transition-all flex flex-col justify-between shadow-xl ${
                  done
                    ? 'bg-emerald-950/25 border-emerald-500/80 shadow-emerald-950/30'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Visual Food Header with Illustration & Status */}
                  <div className="relative h-44 w-full bg-slate-950 overflow-hidden border-b border-slate-800">
                    <img
                      src={artwork}
                      alt={meal.mealName}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                    <div className="absolute top-3 left-3 flex items-center space-x-2">
                      <span className="px-3 py-1 rounded-xl bg-slate-950/90 border border-slate-700 text-emerald-300 text-xs font-black uppercase tracking-wider">
                        {label}
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-slate-950/80 text-slate-300 text-[11px] font-semibold flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>{timeHint}</span>
                      </span>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-xl bg-slate-950/90 border border-slate-700 text-[10px] font-bold text-slate-300">
                        {meal.isEstimated ? 'Estimated Values' : 'IFCT / ICMR Ref'}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3">
                      <h4 className="text-base font-black text-white leading-snug line-clamp-1">
                        {meal.mealName}
                      </h4>
                      {meal.mealNameTamil && (
                        <p className="text-xs font-bold text-emerald-300/90 line-clamp-1">
                          {meal.mealNameTamil}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Meal Body: Portion, Full Macros, Benefits & Nutrients */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between text-xs bg-slate-950/90 px-3.5 py-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 font-semibold">Recommended Portion:</span>
                      <span className="text-white font-bold">{meal.portionGuidance}</span>
                    </div>

                    {/* 5 Macro Pills */}
                    <div className="grid grid-cols-5 gap-1.5 text-center">
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Calories</div>
                        <div className="text-xs font-black text-amber-300">{meal.caloriesApprox}</div>
                        <div className="text-[9px] text-slate-500">kcal</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Protein</div>
                        <div className="text-xs font-black text-emerald-300">{meal.proteinGramsApprox}g</div>
                        <div className="text-[9px] text-slate-500">muscle</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Carbs</div>
                        <div className="text-xs font-black text-cyan-300">{meal.carbsGramsApprox ?? 42}g</div>
                        <div className="text-[9px] text-slate-500">energy</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Fats</div>
                        <div className="text-xs font-black text-rose-300">{meal.fatsGramsApprox ?? 8}g</div>
                        <div className="text-[9px] text-slate-500">lipids</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-semibold">Fiber</div>
                        <div className="text-xs font-black text-purple-300">{meal.fiberGramsApprox ?? 6}g</div>
                        <div className="text-[9px] text-slate-500">gut</div>
                      </div>
                    </div>

                    {/* Nutritional Benefits */}
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-emerald-300">Nutritional Benefits: </strong>
                      {meal.nutritionalBenefits ||
                        meal.pregnancySafetyNotes ||
                        'Provides balanced complex carbohydrates, bioavailable protein, and essential micronutrients for sustained stamina.'}
                    </p>

                    {/* Micronutrient Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {(meal.keyNutrients || []).map((nut, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-300"
                        >
                          {nut}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Footer: Complete Button, Swap Single Meal Button, Recipe Modal Button */}
                <div className="px-5 pb-5 pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => handleToggleMealCompletion(slot)}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      done
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950'
                        : 'bg-slate-800 hover:bg-emerald-600 text-white border border-slate-700'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{done ? 'Completed ✓' : 'Mark Completed'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReplaceSingleMealSlot(slot)}
                    className="py-2.5 px-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Replace just this meal with another dish"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Swap Meal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMealDetail(meal)}
                    className="py-2.5 px-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-indigo-300 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Recipe</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* COMPLETED MEAL HISTORY FOR SELECTED DATE */}
      <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-black text-white">
              Completed Meal History ({currentDate}) — {completedMeals.length} Logged
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowFoodDbModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Additional Food / Custom Meal</span>
          </button>
        </div>

        {completedMeals.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">
            No meals marked completed yet for {currentDate}. Tap <strong>&ldquo;Mark Completed&rdquo;</strong> on any meal card above or log a food from the Food Database.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {completedMeals.map(rec => (
              <div
                key={rec.id}
                className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-800/50 flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[10px] font-black uppercase">
                      {rec.slot}
                    </span>
                    <span className="text-[10px] text-slate-500">{rec.localTime}</span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">{rec.mealName}</div>
                  <div className="text-[11px] text-slate-400">
                    {rec.portion} • <strong className="text-amber-300">{rec.calories} kcal</strong> •{' '}
                    <strong className="text-emerald-300">{rec.proteinGrams}g P</strong> • {rec.carbsGrams}g C • {rec.fatsGrams}g F • {rec.fiberGrams}g Fiber
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    StorageService.deleteCompletedMealEntry(rec.id, currentDate);
                    refreshDateTrackingState(currentDate);
                    showToast(`Removed ${rec.mealName} from completed log.`);
                  }}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 cursor-pointer shrink-0"
                  title="Remove completed meal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 1: SMART NUTRITION AI NATURAL-LANGUAGE ASSISTANT */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/50 to-slate-900 p-6 border border-indigo-800/60 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Smart Nutrition AI Assistant</h3>
              <p className="text-xs text-indigo-300">
                Connected to your live meals &amp; water intake • Ask about any Indian food, portion, macro, or diet goal
              </p>
            </div>
          </div>
        </div>

        {/* Quick Question Chips */}
        <div className="flex flex-wrap gap-2">
          {[
            'What should I eat now?',
            'How much water have I consumed today?',
            'Best South Indian high-protein vegetarian breakfast?',
            'Explain calories, protein, carbs, fats & fiber in Idli Sambar',
            'Affordable iron-rich foods for daily stamina'
          ].map(qChip => (
            <button
              key={qChip}
              type="button"
              onClick={() => handleAskNutritionAI(qChip)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-indigo-950 border border-slate-800 hover:border-indigo-600 text-xs font-semibold text-indigo-200 transition-all cursor-pointer"
            >
              {qChip}
            </button>
          ))}
        </div>

        <form
          onSubmit={e => {
            e.preventDefault();
            handleAskNutritionAI();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={aiQuestion}
            onChange={e => setAiQuestion(e.target.value)}
            placeholder="Ask Nutrition AI anything (e.g., 'How much protein is in 2 moong dal pesarattu?' or 'I missed my breakfast')..."
            className="flex-1 px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-xs text-white focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={aiLoading || !aiQuestion.trim()}
            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Ask AI</span>
          </button>
        </form>

        {aiResponse && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-indigo-700/60 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-indigo-300 uppercase tracking-wider">
                Smart Nutrition AI Answer
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {aiResponse.isEstimated ? 'Estimated Values' : 'IFCT / ICMR Reference Aligned'}
              </span>
            </div>
            <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
              {aiResponse.answer}
            </div>
            {aiResponse.highlights && aiResponse.highlights.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {aiResponse.highlights.map((h, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-indigo-950/70 border border-indigo-800 text-indigo-200 text-[11px] font-bold"
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}
            {aiResponse.portionTip && (
              <div className="text-[11px] text-emerald-300 font-semibold pt-1">
                Portion Guidance: {aiResponse.portionTip}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7-DAY WEEKLY PROGRESS & HISTORICAL RECORDS */}
      <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-black text-white">7-Day Nutrition &amp; Water History</h3>
              <p className="text-xs text-slate-400">{weeklyStats.trendExplanation}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-bold">
              Avg: {weeklyStats.avgDailyCalories} kcal/day
            </span>
            <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-bold">
              Avg Water: {weeklyStats.avgDailyWaterMl} mL/day
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5">
          {weeklyStats.dailyBreakdown.map(d => {
            const isSelected = d.date === currentDate;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setCurrentDate(d.date)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                  isSelected
                    ? 'bg-emerald-950/50 border-emerald-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] font-black text-slate-400">
                  {d.shortDay} ({d.date.slice(5)})
                </div>
                <div className="text-xs font-extrabold text-white">{d.mealsCount} meals</div>
                <div className="text-[11px] font-bold text-amber-300">{d.calories} kcal</div>
                <div className="text-[11px] font-bold text-emerald-300">{d.proteinGrams}g P</div>
                <div className="text-[11px] font-bold text-cyan-300">
                  {d.waterMl} mL ({d.waterPercent}%)
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ADDITIONAL CULINARY TOOLS: PANTRY-TO-MEAL, INGREDIENT SUBSTITUTION, GROCERY LIST & EXPORT */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setShowPantryModal(true)}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center space-x-3 cursor-pointer"
        >
          <Refrigerator className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-black text-white">Pantry-to-Meal AI</div>
            <div className="text-[11px] text-slate-400">Cook from ingredients on hand</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowSubModal(true)}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center space-x-3 cursor-pointer"
        >
          <ArrowRightLeft className="w-6 h-6 text-cyan-400 shrink-0" />
          <div>
            <div className="text-xs font-black text-white">Smart Substitutions</div>
            <div className="text-[11px] text-slate-400">Affordable &amp; allergy-safe swaps</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowGrocerySection(!showGrocerySection)}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center space-x-3 cursor-pointer"
        >
          <ShoppingBag className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <div className="text-xs font-black text-white">Grocery List ({groceryItems.length})</div>
            <div className="text-[11px] text-slate-400">View &amp; check off items</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowShareModal(true)}
          className="p-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center space-x-3 cursor-pointer"
        >
          <Share2 className="w-6 h-6 text-purple-400 shrink-0" />
          <div>
            <div className="text-xs font-black text-white">Export Summary</div>
            <div className="text-[11px] text-slate-400">Share or print daily report</div>
          </div>
        </button>
      </div>

      {/* Collapsible Grocery Section */}
      {showGrocerySection && (
        <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white">Smart Grocery Checklist ({groceryItems.length})</h4>
            <button
              type="button"
              onClick={() => {
                setGroceryItems([]);
                StorageService.saveGroceryItems([]);
              }}
              className="text-xs text-rose-400 hover:underline cursor-pointer"
            >
              Clear All
            </button>
          </div>
          {groceryItems.length === 0 ? (
            <p className="text-xs text-slate-400">No grocery items yet. Click &ldquo;Send Ingredients to Grocery List&rdquo; above.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {groceryItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => {
                    const updated = groceryItems.map(g => (g.id === item.id ? { ...g, inPantry: !g.inPantry } : g));
                    setGroceryItems(updated);
                    StorageService.saveGroceryItems(updated);
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${
                    item.inPantry ? 'bg-emerald-950/30 border-emerald-700/50 line-through text-slate-500' : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                >
                  <span className="text-xs font-bold">{item.name} ({item.quantity})</span>
                  <Check className={`w-4 h-4 ${item.inPantry ? 'text-emerald-400' : 'text-slate-600'}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: RECIPE & PREPARATION STEPS DETAIL */}
      {activeMealDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">{activeMealDetail.mealName}</h3>
                {activeMealDetail.mealNameTamil && (
                  <p className="text-xs font-bold text-emerald-400">{activeMealDetail.mealNameTamil}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveMealDetail(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <div className="font-bold text-emerald-300">Ingredients:</div>
              <ul className="list-disc pl-5 space-y-1">
                {activeMealDetail.ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing.item} — <strong>{ing.quantity}</strong>
                  </li>
                ))}
              </ul>

              <div className="font-bold text-cyan-300 pt-2">Preparation Steps:</div>
              <ol className="list-decimal pl-5 space-y-1.5">
                {activeMealDetail.preparationSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            <button
              type="button"
              onClick={() => setActiveMealDetail(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold cursor-pointer"
            >
              Close Recipe
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: INTELLIGENT FOOD & NUTRIENT DATABASE + MANUAL FOOD LOGGING */}
      {showFoodDbModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-white">
                  Intelligent Food &amp; Nutrient Database (IFCT / ICMR)
                </h3>
                <p className="text-xs text-slate-400">
                  Search Indian &amp; South Indian dishes, inspect macros/vitamins, or log directly to {currentDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFoodDbModal(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search, Filter & Target Slot Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center space-x-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={foodSearchQuery}
                  onChange={e => setFoodSearchQuery(e.target.value)}
                  placeholder="Search idli, ragi, dal, egg, fish, sundal..."
                  className="bg-transparent text-xs text-white w-full focus:outline-none"
                />
              </div>

              <select
                value={selectedFoodCategoryFilter}
                onChange={e => setSelectedFoodCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="all">All Categories</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="snack">Evening Snacks</option>
                <option value="dinner">Dinner</option>
                <option value="beverage">Beverages</option>
              </select>

              <select
                value={logSlotSelection}
                onChange={e => setLogSlotSelection(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-700 text-xs font-bold text-emerald-200"
              >
                <option value="breakfast">Log as: Breakfast</option>
                <option value="lunch">Log as: Lunch</option>
                <option value="eveningSnack">Log as: Evening Snack</option>
                <option value="dinner">Log as: Dinner</option>
                <option value="custom">Log as: Extra / Custom</option>
              </select>
            </div>

            {/* Toggle Add Custom Food Form */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold">
                Showing {filteredFoodDb.length} verified foods
              </span>
              <button
                type="button"
                onClick={() => setShowAddCustomFoodForm(!showAddCustomFoodForm)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddCustomFoodForm ? 'Hide Custom Food Form' : 'Add New Custom Food'}</span>
              </button>
            </div>

            {showAddCustomFoodForm && (
              <form onSubmit={handleCreateCustomFood} className="p-4 rounded-2xl bg-slate-950 border border-indigo-700 space-y-3">
                <h4 className="text-xs font-black text-indigo-300 uppercase">Add Custom Food to Database</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={customFoodName}
                    onChange={e => setCustomFoodName(e.target.value)}
                    placeholder="Dish Name (required)"
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <input
                    type="text"
                    required
                    value={customFoodServing}
                    onChange={e => setCustomFoodServing(e.target.value)}
                    placeholder="Serving Size (e.g., 1 bowl / 2 pcs)"
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <select
                    value={customFoodDietType}
                    onChange={e => setCustomFoodDietType(e.target.value as any)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="egg">Eggetarian</option>
                    <option value="non-veg">Non-Vegetarian</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input
                    type="number"
                    value={customFoodCalories}
                    onChange={e => setCustomFoodCalories(e.target.value)}
                    placeholder="Calories (kcal)"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={customFoodProtein}
                    onChange={e => setCustomFoodProtein(e.target.value)}
                    placeholder="Protein (g)"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={customFoodCarbs}
                    onChange={e => setCustomFoodCarbs(e.target.value)}
                    placeholder="Carbs (g)"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={customFoodFats}
                    onChange={e => setCustomFoodFats(e.target.value)}
                    placeholder="Fats (g)"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={customFoodFiber}
                    onChange={e => setCustomFoodFiber(e.target.value)}
                    placeholder="Fiber (g)"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
                <input
                  type="text"
                  value={customFoodBenefits}
                  onChange={e => setCustomFoodBenefits(e.target.value)}
                  placeholder="Nutritional benefits note (optional)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold cursor-pointer"
                >
                  Save Custom Food
                </button>
              </form>
            )}

            {/* Food Database List */}
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {filteredFoodDb.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black text-white">{item.name}</span>
                      {item.localNameTamil && <span className="text-[11px] text-emerald-400 font-bold">({item.localNameTamil})</span>}
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-bold uppercase text-slate-300">
                        {item.dietType}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Portion: <strong>{item.servingSize}</strong> •{' '}
                      <span className="text-amber-300 font-bold">{item.calories} kcal</span> •{' '}
                      <span className="text-emerald-300 font-bold">{item.proteinGrams}g P</span> •{' '}
                      <span className="text-cyan-300">{item.carbsGrams}g C</span> •{' '}
                      <span className="text-rose-300">{item.fatsGrams}g F</span> •{' '}
                      <span className="text-purple-300">{item.fiberGrams}g Fiber</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{item.nutritionalBenefits}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLogDatabaseFood(item)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shrink-0 cursor-pointer"
                  >
                    + Log Meal
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: USER DIET & WATER PROFILE SETTINGS */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white">Personal Nutrition &amp; Water Target Settings</h3>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Dietary Preference</label>
                <select
                  value={userProfile.dietType}
                  onChange={e => setUserProfile({ ...userProfile, dietType: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="veg">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="egg">Eggetarian</option>
                  <option value="non-veg">Non-Vegetarian</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Body Weight (kg)</label>
                <input
                  type="number"
                  min={35}
                  max={150}
                  value={userProfile.weightKg || 58}
                  onChange={e => setUserProfile({ ...userProfile, weightKg: Number(e.target.value) || 58 })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Activity Level</label>
                <select
                  value={userProfile.activityLevel || 'moderate'}
                  onChange={e => setUserProfile({ ...userProfile, activityLevel: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="sedentary">Sedentary</option>
                  <option value="moderate">Moderate Activity</option>
                  <option value="active">Active / High Stamina</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Local Climate</label>
                <select
                  value={userProfile.climate || 'warm_humid'}
                  onChange={e => setUserProfile({ ...userProfile, climate: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="temperate">Temperate / Cool</option>
                  <option value="warm_humid">Warm &amp; Humid (+200 mL)</option>
                  <option value="hot_dry">Hot &amp; Dry (+300 mL)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Custom Water Target (mL, optional)</label>
                <input
                  type="number"
                  min={1000}
                  max={4500}
                  step={50}
                  value={userProfile.customWaterTargetMl || ''}
                  onChange={e =>
                    setUserProfile({
                      ...userProfile,
                      customWaterTargetMl: e.target.value ? Number(e.target.value) : null
                    })
                  }
                  placeholder={`Auto (${StorageService.calculateSuggestedWaterTargetMl({ ...userProfile, customWaterTargetMl: null })} mL)`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Medical Fluid Restriction Cap (mL)</label>
                <input
                  type="number"
                  min={800}
                  max={4000}
                  step={50}
                  value={userProfile.medicalFluidRestrictionMl || ''}
                  onChange={e =>
                    setUserProfile({
                      ...userProfile,
                      medicalFluidRestrictionMl: e.target.value ? Number(e.target.value) : null
                    })
                  }
                  placeholder="None (Clinician advised cap)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                StorageService.saveUserNutritionProfile(userProfile);
                refreshDateTrackingState(currentDate);
                loadPlanForCurrentJourney(true);
                setShowProfileModal(false);
                showToast('Saved profile & recalculated your personalized daily plan and mL water target!');
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer"
            >
              Save Profile &amp; Update Plan
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: PANTRY-TO-MEAL AI */}
      {showPantryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Pantry-to-Meal Generator</h3>
              <button type="button" onClick={() => setShowPantryModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={pantryInput}
              onChange={e => setPantryInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
              placeholder="Enter ingredients separated by commas..."
            />
            <button
              type="button"
              onClick={async () => {
                setPantryLoading(true);
                const items = pantryInput.split(',').map(s => s.trim()).filter(Boolean);
                const res = await NutritionService.generatePantryMeals(items, activeJourney, userProfile.dietType);
                setPantryResult(res);
                setPantryLoading(false);
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold cursor-pointer"
            >
              {pantryLoading ? 'Generating Ideas...' : 'Suggest Meals from Pantry'}
            </button>
            {pantryResult?.suggestions && (
              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {pantryResult.suggestions.map((s: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <div className="font-black text-emerald-300">{s.dishName} ({s.prepTimeMinutes} mins)</div>
                    <p className="text-slate-300">{s.quickInstructions}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: SMART INGREDIENT SUBSTITUTION */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Smart Ingredient Substitution</h3>
              <button type="button" onClick={() => setShowSubModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={subIngredientInput}
              onChange={e => setSubIngredientInput(e.target.value)}
              placeholder="Enter ingredient to replace (e.g., Paneer, White Rice, Milk)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
            />
            <button
              type="button"
              onClick={async () => {
                if (!subIngredientInput.trim()) return;
                setSubLoading(true);
                const res = await NutritionService.substituteIngredient(
                  subIngredientInput,
                  subCategoryInput,
                  activeJourney,
                  userProfile.allergies || [],
                  subBudgetPriority
                );
                setSubResult(res);
                setSubLoading(false);
              }}
              className="w-full py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-extrabold cursor-pointer"
            >
              {subLoading ? 'Finding Substitutes...' : 'Find Healthy Substitutes'}
            </button>
            {subResult?.substitutions && (
              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {subResult.substitutions.map((s: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <div className="font-black text-cyan-300">{s.name}</div>
                    <p className="text-slate-300">{s.reason}</p>
                    <p className="text-emerald-300 text-[11px]">{s.costSavings}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 6: EXPORT / PRINT SUMMARY */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Export Daily Nutrition &amp; Water Report</h3>
              <button type="button" onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1 font-mono">
              <div>Date: {currentDate} ({activeJourney.toUpperCase()})</div>
              <div>Completed Meals: {completedMeals.length} ({completedDailyTotals.calories} kcal, {completedDailyTotals.protein}g Protein)</div>
              <div>Water Logged: {waterSummary.consumedMl} mL / {waterSummary.targetMl} mL ({waterSummary.completionPercent}%)</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = `Smart Shield Nutrition Report (${currentDate}): Meals Completed=${completedMeals.length} (${completedDailyTotals.calories} kcal, ${completedDailyTotals.protein}g Protein), Water=${waterSummary.consumedMl}/${waterSummary.targetMl} mL (${waterSummary.completionPercent}%).`;
                  navigator.clipboard?.writeText(text);
                  showToast('Copied report to clipboard!');
                  setShowShareModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Summary</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
