import {
  DailyMealPlan,
  UserNutritionProfile,
  MenstrualNutritionProfile,
  PregnancyNutritionProfile,
  NutritionReminderConfig,
  WellnessJourneyMode,
  SharedWellnessAIContext
} from '../types';
import { selectDiverseDailyMeals, getMealVisualArtwork } from './foodDatabase';
import { StorageService } from './storage';
import { AuthService } from './authService';

export const NutritionService = {
  /**
   * Request daily meal plan from backend or fallback to smart date-seeded diverse generator
   */
  async generateDailyPlan(
    journeyType: WellnessJourneyMode,
    userProfile: UserNutritionProfile,
    journeyProfile?: MenstrualNutritionProfile | PregnancyNutritionProfile | null,
    customInstructions?: string,
    targetDate?: string,
    variantSeed: number = 0
  ): Promise<DailyMealPlan> {
    const date = targetDate || StorageService.getLocalDateString();
    try {
      const response = await fetch('/api/nutrition/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        credentials: 'same-origin',
        body: JSON.stringify({
          journeyType,
          profile: userProfile,
          userProfile,
          menstrualData: journeyType === 'menstrual' ? journeyProfile : undefined,
          pregnancyData: journeyType === 'pregnancy' ? journeyProfile : undefined,
          journeyProfile,
          customInstruction: customInstructions,
          customInstructions,
          targetDate: date,
          date,
          variantSeed
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data.plan && data.plan.meals) {
        const localFallback = NutritionService.createFallbackClientPlan(
          journeyType,
          userProfile,
          journeyProfile,
          customInstructions,
          date,
          variantSeed
        );
        const mergedMeals = { ...localFallback.meals, ...data.plan.meals };
        for (const key of ['breakfast', 'lunch', 'eveningSnack', 'dinner'] as const) {
          const m = mergedMeals[key];
          const fb = localFallback.meals[key];
          if (m && fb) {
            m.carbsGramsApprox = typeof m.carbsGramsApprox === 'number' ? m.carbsGramsApprox : fb.carbsGramsApprox || 38;
            m.fatsGramsApprox = typeof m.fatsGramsApprox === 'number' ? m.fatsGramsApprox : fb.fatsGramsApprox || 9;
            m.fiberGramsApprox = typeof m.fiberGramsApprox === 'number' ? m.fiberGramsApprox : fb.fiberGramsApprox || 6;
            m.nutritionalBenefits = m.nutritionalBenefits || fb.nutritionalBenefits;
            m.imageUrl = m.imageUrl || getMealVisualArtwork(m);
            m.isEstimated = typeof m.isEstimated === 'boolean' ? m.isEstimated : false;
          }
        }
        return {
          ...localFallback,
          ...data.plan,
          journeyType,
          date,
          meals: mergedMeals,
          seasonalFoodSuggestions: data.plan.seasonalFoodSuggestions || localFallback.seasonalFoodSuggestions,
          dailyWellnessTip: data.plan.dailyWellnessTip || localFallback.dailyWellnessTip
        };
      }
      throw new Error('No valid plan returned in response');
    } catch (err) {
      console.warn('Using Smart Shield diverse client meal planner:', err);
      return NutritionService.createFallbackClientPlan(
        journeyType,
        userProfile,
        journeyProfile,
        customInstructions,
        date,
        variantSeed
      );
    }
  },

  /**
   * Replace a single meal slot (Breakfast, Lunch, Evening Snack, or Dinner) without losing other meals
   */
  replaceSingleMealSlot(
    currentPlan: DailyMealPlan,
    slot: 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner',
    userProfile: UserNutritionProfile,
    variantSeed: number
  ): DailyMealPlan {
    const customDb = StorageService.getCustomFoods();
    const diverse = selectDiverseDailyMeals(
      currentPlan.date,
      userProfile.dietType || 'veg',
      currentPlan.journeyType,
      userProfile.allergies || [],
      userProfile.dislikedFoods || [],
      variantSeed,
      customDb
    );

    const replacement = diverse[slot];
    return {
      ...currentPlan,
      meals: {
        ...currentPlan.meals,
        [slot]: {
          ...replacement,
          imageUrl: getMealVisualArtwork(replacement)
        }
      },
      generatedAt: new Date().toISOString()
    };
  },

  /**
   * Dedicated Smart Nutrition AI Q&A with shared context awareness
   */
  async askNutritionAI(
    question: string,
    wellnessContext?: SharedWellnessAIContext
  ): Promise<{
    answer: string;
    highlights: string[];
    portionTip: string;
    isEstimated: boolean;
    model: string;
  }> {
    const ctx = wellnessContext || StorageService.getSharedWellnessAIContext();
    try {
      const response = await fetch('/api/nutrition/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        credentials: 'same-origin',
        body: JSON.stringify({
          question,
          wellnessContext: ctx
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.answer) {
          return data;
        }
      }
    } catch (err) {
      console.warn('Fallback to local Smart Nutrition AI knowledge base:', err);
    }

    return NutritionService.generateLocalNutritionAnswer(question, ctx);
  },

  /**
   * Fast Food Nutrition Query with macro breakdown via Nutrition AI
   */
  async analyzeFoodItem(
    foodQuery: string,
    portion: string = '1 standard serving',
    wellnessContext?: SharedWellnessAIContext
  ): Promise<{
    name: string;
    localNameTamil?: string;
    servingSize: string;
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatsGrams: number;
    fiberGrams: number;
    dietType: 'veg' | 'vegan' | 'egg' | 'non-veg';
    keyMicronutrients: string[];
    nutritionalBenefits: string;
    portionTip: string;
    isEstimated: boolean;
  }> {
    const ctx = wellnessContext || StorageService.getSharedWellnessAIContext();
    try {
      const response = await fetch('/api/nutrition/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AuthService.getAuthHeader() },
        credentials: 'same-origin',
        body: JSON.stringify({
          foodQuery,
          portion,
          wellnessContext: ctx
        })
      });
      if (response.ok) {
        const json = await response.json();
        if (json?.data?.name && typeof json.data.calories === 'number') {
          return json.data;
        }
      }
    } catch (e) {
      console.warn('Fallback to local food analysis calculation:', e);
    }

    // Direct match against curated IFCT/ICMR database
    const allDb = StorageService.getAllFoodDatabaseItems();
    const cleanQ = foodQuery.toLowerCase().trim();
    const found = allDb.find(f =>
      f.name.toLowerCase().includes(cleanQ) ||
      (f.localNameTamil && f.localNameTamil.toLowerCase().includes(cleanQ)) ||
      cleanQ.includes(f.name.toLowerCase().split('(')[0].trim())
    );

    if (found) {
      return {
        name: found.name,
        localNameTamil: found.localNameTamil,
        servingSize: found.servingSize,
        calories: found.calories,
        proteinGrams: found.proteinGrams,
        carbsGrams: found.carbsGrams,
        fatsGrams: found.fatsGrams,
        fiberGrams: found.fiberGrams,
        dietType: found.dietType,
        keyMicronutrients: found.keyMicronutrients,
        nutritionalBenefits: found.nutritionalBenefits,
        portionTip: `Standard serving: ${found.servingSize}`,
        isEstimated: found.sourceType === 'User_Custom_Estimated'
      };
    }

    return {
      name: foodQuery.trim(),
      servingSize: portion,
      calories: 220,
      proteinGrams: 7.0,
      carbsGrams: 35.0,
      fatsGrams: 5.5,
      fiberGrams: 4.0,
      dietType: 'veg',
      keyMicronutrients: ['Balanced Minerals', 'Plant Nutrients'],
      nutritionalBenefits: 'Estimated whole food providing energy and dietary fiber.',
      portionTip: `Portion: ${portion}`,
      isEstimated: true
    };
  },

  /**
   * Local evidence-informed nutritionist engine when offline or rate-limited
   */
  generateLocalNutritionAnswer(
    question: string,
    ctx: SharedWellnessAIContext
  ): {
    answer: string;
    highlights: string[];
    portionTip: string;
    isEstimated: boolean;
    model: string;
  } {
    const q = question.toLowerCase().trim();
    const allFoods = StorageService.getAllFoodDatabaseItems();

    // Check if the user is asking about a specific food in our IFCT/ICMR database
    const matchedFood = allFoods.find(
      f =>
        q.includes(f.name.toLowerCase().split('(')[0].trim().toLowerCase()) ||
        (f.localNameTamil && q.includes(f.localNameTamil.toLowerCase())) ||
        f.keyMicronutrients.some((m: string) => m.length > 3 && q.includes(m.toLowerCase()))
    );

    if (matchedFood) {
      const isEst = matchedFood.sourceType === 'User_Custom_Estimated';
      return {
        answer: `**${matchedFood.name}** (${matchedFood.servingSize}) provides **${matchedFood.calories} kcal**, **${matchedFood.proteinGrams}g protein**, **${matchedFood.carbsGrams}g carbohydrates**, **${matchedFood.fatsGrams}g fat**, and **${matchedFood.fiberGrams}g dietary fiber**.\n\n**Nutritional Benefits:** ${matchedFood.nutritionalBenefits}\n\n**Key Micronutrients:** ${(matchedFood.keyMicronutrients || []).join(', ') || 'Balanced micronutrients'}.`,
        highlights: [
          `${matchedFood.calories} kcal | ${matchedFood.proteinGrams}g Protein | ${matchedFood.fiberGrams}g Fiber`,
          `Portion: ${matchedFood.servingSize}`,
          isEst ? 'Estimated Custom Entry' : 'IFCT / ICMR Reference Value'
        ],
        portionTip: `Recommended serving: ${matchedFood.servingSize}. Pair with fresh vegetables or vitamin-C rich lemon/amla for optimal mineral absorption.`,
        isEstimated: isEst,
        model: 'smart-shield-nutrition-kb'
      };
    }

    if (q.includes('water') || q.includes('hydrat') || q.includes('drink')) {
      return {
        answer: `Today (${ctx.localDate}), you have consumed **${ctx.waterToday.consumedMl} mL** out of your **${ctx.waterToday.targetMl} mL** daily target (**${ctx.waterToday.completionPercent}%** complete, **${ctx.waterToday.remainingMl} mL** remaining).\n\nSteady hydration supports cellular energy, kidney filtration, temperature regulation, and digestive comfort. Sip 150–250 mL of water every 1.5–2 hours rather than drinking large volumes all at once.`,
        highlights: [
          `Consumed Today: ${ctx.waterToday.consumedMl} mL / ${ctx.waterToday.targetMl} mL (${ctx.waterToday.completionPercent}%)`,
          `Remaining Target: ${ctx.waterToday.remainingMl} mL`,
          'Tip: Include tender coconut water or spiced buttermilk (neer mor) for natural electrolytes'
        ],
        portionTip: '1 standard glass = 250 mL; 1 small tumbler = 150 mL.',
        isEstimated: false,
        model: 'smart-shield-nutrition-kb'
      };
    }

    if (q.includes('missed') || q.includes('skip') || q.includes('eat now') || q.includes('what should i eat')) {
      const nextSlotKey = ctx.uncompletedPlannedSlots[0] as 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner' | undefined;
      const nextMealObj = nextSlotKey && ctx.todaysPlan ? ctx.todaysPlan[nextSlotKey] : null;

      if (nextSlotKey && nextMealObj) {
        const slotTitle = nextSlotKey === 'eveningSnack' ? 'Evening Snack' : nextSlotKey.charAt(0).toUpperCase() + nextSlotKey.slice(1);
        return {
          answer: `Based on your live daily tracker, your next pending meal is **${slotTitle}**: **${nextMealObj.name}** (${nextMealObj.calories} kcal, ${nextMealObj.protein}g protein).\n\nIf you missed an earlier meal today, avoid doubling up on heavy fried foods—instead, have a balanced portion of protein and complex carbs (such as 2 idlis with sambar, a bowl of moong dal sundal, or a multigrain chapati wrap) along with **250 mL of water** to stabilize blood glucose.`,
          highlights: [
            `Next Pending Meal: ${slotTitle} — ${nextMealObj.name}`,
            `Current Intake Today: ${ctx.nutritionTotalsToday.calories} kcal, ${ctx.nutritionTotalsToday.proteinGrams}g protein`,
            `Water Logged: ${ctx.waterToday.consumedMl} mL / ${ctx.waterToday.targetMl} mL`
          ],
          portionTip: 'Combine 1 palm-sized serving of protein (dal/paneer/eggs/fish) with 1 fist-sized whole grain and 1 cup cooked vegetables.',
          isEstimated: false,
          model: 'smart-shield-nutrition-kb'
        };
      }
    }

    if (q.includes('protein') || q.includes('muscle') || q.includes('strength')) {
      const goalText = (ctx.userPreferences.nutritionGoals || ['Balanced Energy']).join(', ');
      return {
        answer: `For your profile (**${ctx.userPreferences.dietType.toUpperCase()}**, goals: **${goalText}**), aim for **55g–75g of protein daily** spread evenly across Breakfast, Lunch, Evening Snack, and Dinner.\n\n**Top Affordable Indian Protein Sources:**\n• **Vegetarian:** Moong dal chilla/adai (17g/serving), Soya chunks poriyal (22g/cup), Paneer bhurji (19g), Roasted chana & peanuts (9g/handful), Sprouted green gram sundal (11g).\n• **Egg / Non-Veg:** 2 Boiled eggs (13g), Grilled fish / Meen kuzhambu (28g), Home-style chicken curry (26g).`,
        highlights: [
          `Today's Protein Logged: ${ctx.nutritionTotalsToday.proteinGrams}g / ${ctx.nutritionTotalsToday.proteinTarget}g`,
          'Distribute 15g–20g protein per main meal for optimal absorption',
          'Values based on IFCT / ICMR reference food composition tables'
        ],
        portionTip: '1 katori (150 mL) thick cooked dal = ~7g protein; 100g paneer = ~18g protein; 2 eggs = ~12.5g protein.',
        isEstimated: false,
        model: 'smart-shield-nutrition-kb'
      };
    }

    return {
      answer: `For your **${ctx.wellnessJourneyMode.toUpperCase()}** wellness mode and **${ctx.userPreferences.dietType.toUpperCase()}** preference:\n\n• **Today's Progress:** ${ctx.completedMealsToday.length} meals logged (**${ctx.nutritionTotalsToday.calories} kcal**, **${ctx.nutritionTotalsToday.proteinGrams}g protein**, **${ctx.nutritionTotalsToday.fiberGrams}g fiber**) and **${ctx.waterToday.consumedMl} mL** water.\n• **Balanced Plate Formula:** Fill ½ your plate with seasonal non-starchy vegetables (keerai, beans, carrot, gourds), ¼ with high-fiber whole grains (red/brown rice, ragi, millets, whole wheat phulka), and ¼ with bioavailable protein (lentils, sundal, curd, paneer, eggs, or fish).`,
      highlights: [
        `Today: ${ctx.nutritionTotalsToday.calories} kcal | ${ctx.nutritionTotalsToday.proteinGrams}g Protein | ${ctx.waterToday.consumedMl} mL Water`,
        `7-Day Trend: ${ctx.weeklyProgress?.trendExplanation || 'Tracking active'}`,
        'Reference values sourced from ICMR-NIN & IFCT Indian food tables'
      ],
      portionTip: 'Use household measures: 1 standard katori = 150 mL, 1 tablespoon = 15g, 1 medium chapati = 35g.',
      isEstimated: false,
      model: 'smart-shield-nutrition-kb'
    };
  },

  /**
   * Request smart ingredient substitutions
   */
  async substituteIngredient(
    ingredient: string,
    category: string,
    journeyType: WellnessJourneyMode,
    allergies: string[],
    isBudgetPriority: boolean
  ): Promise<{
    originalIngredient: string;
    substitutions: {
      name: string;
      reason: string;
      costSavings: string;
      culinaryTip: string;
      pregnancySafe: boolean;
    }[];
    safetyDisclaimer: string;
  }> {
    try {
      const response = await fetch('/api/nutrition/substitute-ingredient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient,
          category,
          journeyType,
          allergies,
          isBudgetPriority
        })
      });
      if (response.ok) {
        const resData = await response.json();
        if (resData.substitutions) return resData;
        if (resData.data?.substitutes) {
          return {
            originalIngredient: ingredient,
            substitutions: resData.data.substitutes.map((s: any) => ({
              name: s.name,
              reason: s.reason,
              costSavings: s.costComparison || 'Budget-friendly local staple',
              culinaryTip: 'Cook thoroughly with mild spices and fresh curry leaves.',
              pregnancySafe: s.pregnancySafe !== false
            })),
            safetyDisclaimer: 'Substitutions are evidence-informed culinary suggestions. Consult a qualified clinician for medical dietary needs.'
          };
        }
      }
    } catch (err) {
      console.warn('Fallback ingredient substitution:', err);
    }

    return {
      originalIngredient: ingredient,
      substitutions: [
        {
          name: 'Roasted Bengal Gram (Pottukadalai) / Moong Dal',
          reason: 'High plant protein, gentle on digestion, rich in Folate & B-complex vitamins.',
          costSavings: 'Up to 45% cheaper than packaged protein powders or imported seeds',
          culinaryTip: 'Lightly roast and grind into podi or soak for 20 mins before pressure cooking.',
          pregnancySafe: true
        },
        {
          name: 'Sesame & Jaggery (Ellu) or Murungai Keerai (Moringa Leaves)',
          reason: 'Exceptionally rich bioavailable iron and calcium without heavy gastrointestinal burden.',
          costSavings: 'Locally available at a fraction of commercial supplement costs',
          culinaryTip: 'Add washed moringa leaves to dal; finish with fresh lemon juice for Vitamin C iron absorption.',
          pregnancySafe: true
        }
      ],
      safetyDisclaimer: 'Substitutions are evidence-informed culinary suggestions. Always consult your physician or registered dietitian regarding personal dietary modifications.'
    };
  },

  /**
   * Request pantry-to-meal suggestions
   */
  async generatePantryMeals(
    pantryItems: string[],
    journeyType: WellnessJourneyMode,
    dietType: string
  ): Promise<{
    suggestions: {
      dishName: string;
      dishNameTamil?: string;
      prepTimeMinutes: number;
      ingredientsUsed: string[];
      additionalStaplesNeeded: string[];
      quickInstructions: string;
      safetyNote: string;
    }[];
  }> {
    try {
      const response = await fetch('/api/nutrition/pantry-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pantryItems, journeyType, dietType })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.suggestions) return data;
      }
    } catch (err) {
      console.warn('Fallback pantry meal generator:', err);
    }

    return {
      suggestions: [
        {
          dishName: 'One-Pot Vegetable Moong Dal Khichdi / Ven Pongal',
          dishNameTamil: 'பருப்பு கிச்சடி / வெண் பொங்கல்',
          prepTimeMinutes: 20,
          ingredientsUsed: pantryItems.slice(0, 4),
          additionalStaplesNeeded: ['Cumin seeds', 'Ghee or Sesame oil', 'Turmeric'],
          quickInstructions: 'Pressure cook rice/millets and moong dal (1:1 ratio) with turmeric and chopped vegetables. Temper with cumin, ginger, and curry leaves.',
          safetyNote: journeyType === 'pregnancy' ? 'Ensure ginger is used in moderate culinary amounts and vegetables are thoroughly washed.' : 'Gentle on digestion, rich in complete plant protein.'
        },
        {
          dishName: 'Spiced Protein Sundal & Probiotic Buttermilk',
          dishNameTamil: 'தாளித்த சுண்டல் & மோர்',
          prepTimeMinutes: 15,
          ingredientsUsed: pantryItems.slice(1, 3),
          additionalStaplesNeeded: ['Mustard seeds', 'Curry leaves', 'Asafoetida / Hing'],
          quickInstructions: 'Boil soaked legumes until soft. Temper with mustard seeds, curry leaves, and grated fresh coconut.',
          safetyNote: 'Rich source of plant protein and soluble fiber; hydrating and easily digestible.'
        }
      ]
    };
  },

  /**
   * Web Speech Synthesis for English & Tamil audio readout
   */
  speakNutritionPlan(text: string, lang: 'en' | 'ta' = 'en'): void {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (lang === 'ta') {
      utterance.lang = 'ta-IN';
      const tamilVoice = voices.find(v => v.lang.startsWith('ta'));
      if (tamilVoice) utterance.voice = tamilVoice;
    } else {
      utterance.lang = 'en-US';
      const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha')));
      if (englishVoice) utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
  },

  stopSpeech(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },

  /**
   * Request browser notifications for meal and hydration reminders
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  /**
   * Schedule or trigger local reminder if enabled
   */
  checkReminderTriggers(config: NutritionReminderConfig, onAlert: (title: string, body: string) => void): void {
    if (!config.enabled) return;
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (currentTimeStr === config.morningTime) {
      onAlert('Smart Shield — Morning Fuel & Hydration', 'Time for a nourishing breakfast and your first hydration milestone of the day.');
    } else if (currentTimeStr === config.lunchTime) {
      onAlert('Smart Shield — Midday Wellness Lunch', 'Balance your energy with wholesome protein, fiber, and adequate fluids.');
    } else if (currentTimeStr === config.eveningTime) {
      onAlert('Smart Shield — Evening Snack & Comfort', 'Grab your planned evening snack and check in on your water target.');
    } else if (currentTimeStr === config.nightTime) {
      onAlert('Smart Shield — Dinner & Restful Routine', 'Enjoy your light, nutrient-rich dinner. Stay hydrated and log your completed meals.');
    }
  },

  /**
   * Date-seeded diverse daily meal plan generator using IFCT/ICMR database
   * Ensures non-repeating daily meals and supports General, Menstrual, and Pregnancy modes
   */
  createFallbackClientPlan(
    journeyType: WellnessJourneyMode,
    userProfile: UserNutritionProfile,
    journeyProfile?: MenstrualNutritionProfile | PregnancyNutritionProfile | null,
    customInstructions?: string,
    targetDate?: string,
    variantSeed: number = 0
  ): DailyMealPlan {
    const date = targetDate || StorageService.getLocalDateString();
    const customDb = StorageService.getCustomFoods();
    const diverseMeals = selectDiverseDailyMeals(
      date,
      userProfile.dietType || 'veg',
      journeyType,
      userProfile.allergies || [],
      userProfile.dislikedFoods || [],
      variantSeed,
      customDb
    );

    // Attach SVG culinary artwork to every meal
    const mealsWithArtwork = {
      breakfast: { ...diverseMeals.breakfast, imageUrl: getMealVisualArtwork(diverseMeals.breakfast) },
      morningSnack: { ...diverseMeals.eveningSnack, category: 'morning_snack' as const, imageUrl: getMealVisualArtwork(diverseMeals.eveningSnack) },
      lunch: { ...diverseMeals.lunch, imageUrl: getMealVisualArtwork(diverseMeals.lunch) },
      afternoonSnack: { ...diverseMeals.eveningSnack, category: 'afternoon_snack' as const, imageUrl: getMealVisualArtwork(diverseMeals.eveningSnack) },
      eveningSnack: { ...diverseMeals.eveningSnack, imageUrl: getMealVisualArtwork(diverseMeals.eveningSnack) },
      dinner: { ...diverseMeals.dinner, imageUrl: getMealVisualArtwork(diverseMeals.dinner) }
    };

    const targetWaterMl = StorageService.getEffectiveWaterTargetMl(userProfile);
    const waterSummary = StorageService.getWaterSummaryForDate(date);

    if (journeyType === 'pregnancy') {
      const pregProf = (journeyProfile as PregnancyNutritionProfile) || { gestationalWeeks: 20 };
      const weeks = pregProf.gestationalWeeks || 20;
      const trimester = weeks <= 12 ? 1 : weeks <= 27 ? 2 : 3;

      return {
        id: `plan-preg-${date}-${variantSeed}`,
        date,
        journeyType: 'pregnancy',
        weekOrCyclePhase: `Week ${weeks} (Trimester ${trimester})`,
        dailyHydrationTargetLiters: Number((targetWaterMl / 1000).toFixed(2)),
        hydrationLoggedLiters: Number((waterSummary.consumedMl / 1000).toFixed(2)),
        userCustomInstructions: customInstructions,
        nutrientHighlights: [
          { nutrient: 'Iron & Vitamin C', amount: '27 mg', purpose: 'Supports maternal blood volume expansion and placental oxygen transport' },
          { nutrient: 'Dietary Folate', amount: '600 mcg DFE', purpose: 'Essential for fetal neural tube and cellular DNA synthesis' },
          { nutrient: 'Bioavailable Calcium', amount: '1000 mg', purpose: 'Supports fetal bone mineralization and maternal skeletal stores' },
          { nutrient: 'Balanced Protein', amount: '71 g target', purpose: 'Supports maternal tissue and healthy fetal growth' }
        ],
        foodSafetyAlerts: [
          'Safety Rule: Avoid all raw or unpasteurized milk, soft cheeses, and unpasteurized juices.',
          'Safety Rule: Consume eggs, poultry, and fish only when cooked thoroughly to safe internal temperatures.',
          'Safety Rule: Wash all raw fruits, leafy greens, and herbs thoroughly under running potable water; avoid raw sprouts.'
        ],
        symptomFriendlyNotes: [
          'Nausea comfort: Eat small, frequent warm portions (steamed idli, moong khichdi) and sip lemon-ginger water.',
          'Heartburn relief: Stay upright for 45 minutes after meals and space fluid intake steadily throughout the day.'
        ],
        seasonalFoodSuggestions: [
          'Fresh Tender Coconut Water (Ilaneer) for natural potassium & electrolytes',
          'Thoroughly cooked Moringa leaves (Murungai Keerai) & Palak for folate and iron',
          'Sweet Lime (Mosambi), Guava, and Pomegranate for Vitamin C'
        ],
        dailyWellnessTip: 'Pair plant-based iron meals (dal, spinach, millet) with a squeeze of fresh lemon juice to boost iron absorption up to 3x.',
        meals: mealsWithArtwork,
        generatedAt: new Date().toISOString()
      };
    }

    if (journeyType === 'menstrual') {
      const mensProf = (journeyProfile as MenstrualNutritionProfile) || { currentCycleDay: 14 };
      const cycleDay = mensProf.currentCycleDay || 14;
      const phaseName =
        cycleDay <= 5
          ? 'Menstrual Phase'
          : cycleDay <= 13
          ? 'Follicular Phase'
          : cycleDay <= 16
          ? 'Ovulatory Window'
          : 'Luteal Phase';

      return {
        id: `plan-mens-${date}-${variantSeed}`,
        date,
        journeyType: 'menstrual',
        weekOrCyclePhase: `${phaseName} (Cycle Day ${cycleDay})`,
        dailyHydrationTargetLiters: Number((targetWaterMl / 1000).toFixed(2)),
        hydrationLoggedLiters: Number((waterSummary.consumedMl / 1000).toFixed(2)),
        userCustomInstructions: customInstructions,
        nutrientHighlights: [
          { nutrient: 'Bioavailable Iron', amount: '18 mg', purpose: 'Replenishes hemoglobin and red blood cell stores' },
          { nutrient: 'Magnesium', amount: '320–350 mg', purpose: 'Supports smooth muscle relaxation and neuromuscular comfort' },
          { nutrient: 'Omega-3 & Zinc', amount: '1.4 g / 10 mg', purpose: 'Supports prostaglandin balance and cellular recovery' },
          { nutrient: 'Complex Fiber & B6', amount: '28 g fiber', purpose: 'Sustains steady blood glucose and digestive ease' }
        ],
        foodSafetyAlerts: [
          'Limit ultra-processed high-sodium snacks to minimize cyclical water retention and bloating.',
          'Avoid drinking strong tea or coffee immediately with iron-rich meals, as tannins inhibit iron absorption.'
        ],
        symptomFriendlyNotes: [
          'Cramp comfort: Warm freshly cooked meals (ragi porridge, dal kootu) and ginger-cumin water.',
          'Energy stability: Combine complex carbohydrates with protein at every meal to prevent afternoon fatigue.'
        ],
        seasonalFoodSuggestions: [
          'Murungai Keerai (Drumstick Leaves) & Beetroot for iron replenishment',
          'Roasted Pumpkin Seeds, Sesame (Ellu), and Almonds for magnesium',
          'Fresh Amla, Orange, and Guava to enhance non-heme iron absorption'
        ],
        dailyWellnessTip: 'Space coffee or tea at least 60 minutes away from your main lunch and dinner so your body absorbs maximum dietary iron.',
        meals: mealsWithArtwork,
        generatedAt: new Date().toISOString()
      };
    }

    // General Daily Wellness Mode
    const goalLabel = (userProfile.nutritionGoals || ['Balanced Energy'])[0] || 'Balanced Energy';
    return {
      id: `plan-gen-${date}-${variantSeed}`,
      date,
      journeyType: 'general',
      weekOrCyclePhase: `Daily Balanced Nutrition & Vitality (${goalLabel})`,
      dailyHydrationTargetLiters: Number((targetWaterMl / 1000).toFixed(2)),
      hydrationLoggedLiters: Number((waterSummary.consumedMl / 1000).toFixed(2)),
      userCustomInstructions: customInstructions,
      nutrientHighlights: [
        { nutrient: 'Complete Protein', amount: '55–65 g', purpose: 'Supports lean muscle maintenance, immunity, and satiety' },
        { nutrient: 'Dietary Fiber', amount: '28–32 g', purpose: 'Supports gut microbiome health and steady glycemic response' },
        { nutrient: 'Iron & Calcium', amount: '18 mg / 1000 mg', purpose: 'Maintains daily oxygen transport, stamina, and bone density' },
        { nutrient: 'Vitamins & Antioxidants', amount: '100% DV', purpose: 'Supports cellular repair, skin health, and metabolic resilience' }
      ],
      foodSafetyAlerts: [
        'Use clean, filtered or boiled drinking water and wash fresh produce thoroughly.',
        'Prefer freshly cooked whole foods and traditional cold-pressed oils in moderate quantities.'
      ],
      symptomFriendlyNotes: [
        'Sustained Stamina: Start your morning with complex carbs + protein within 90 minutes of waking.',
        'Restful Sleep: Finish dinner 2 hours before bedtime and stay steadily hydrated through the afternoon.'
      ],
      seasonalFoodSuggestions: [
        'Traditional South Indian millets (Ragi, Foxtail Millet) & Red Matta Rice for slow-release energy',
        'Sprouted Green Gram (Pasi Payaru), Sundal, and Buttermilk (Neer Mor) for gut-friendly protein',
        'Seasonal local fruits (Guava, Banana, Pomegranate, Papaya) for daily fiber and antioxidants'
      ],
      dailyWellnessTip: 'Aim to complete all 4 planned meals and sip water steadily in 150–250 mL portions to reach your personalized daily hydration goal.',
      meals: mealsWithArtwork,
      generatedAt: new Date().toISOString()
    };
  }
};
