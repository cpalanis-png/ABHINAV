import React, { useState, useEffect } from 'react';
import {
  Utensils,
  RefreshCw,
  Droplets,
  ArrowRight,
  Sparkles,
  Loader2,
  HeartPulse,
  Baby,
  CheckCircle2
} from 'lucide-react';
import { PregnancyProfile, SharedWellnessAIContext } from '../types';
import { StorageService } from '../services/storage';

interface NutritionTipItem {
  id: string;
  category: string;
  headline: string;
  advice: string;
  foodHighlight: string;
  nutrientFocus: string;
  isLiveAI?: boolean;
}

interface NutritionTipWidgetProps {
  pregnancyProfile: PregnancyProfile;
  onOpenNutritionPlanner: () => void;
}

export const NutritionTipWidget: React.FC<NutritionTipWidgetProps> = ({
  pregnancyProfile,
  onOpenNutritionPlanner
}) => {
  const todayStr = StorageService.getLocalDateString();
  const [wellnessCtx, setWellnessCtx] = useState<SharedWellnessAIContext>(() =>
    StorageService.getSharedWellnessAIContext()
  );
  const [tipOffset, setTipOffset] = useState<number>(0);
  const [waterQuickFeedback, setWaterQuickFeedback] = useState<string | null>(null);
  const [aiTipLoading, setAiTipLoading] = useState<boolean>(false);
  const [customAiTip, setCustomAiTip] = useState<NutritionTipItem | null>(null);

  useEffect(() => {
    setWellnessCtx(StorageService.getSharedWellnessAIContext());
  }, [pregnancyProfile.active, pregnancyProfile.trimester]);

  const refreshWellnessCtx = () => {
    setWellnessCtx(StorageService.getSharedWellnessAIContext());
  };

  const handleQuickLogWater250 = () => {
    StorageService.addWaterIntakeEntry(250, 'Quick 250 mL from Dashboard');
    refreshWellnessCtx();
    setWaterQuickFeedback('+250 mL logged!');
    setTimeout(() => setWaterQuickFeedback(null), 2500);
  };

  const buildDailyRotationTips = (): NutritionTipItem[] => {
    const mode = pregnancyProfile.active ? 'pregnancy' : wellnessCtx.wellnessJourneyMode;
    const primaryGoal = wellnessCtx.userPreferences.nutritionGoals?.[0] || 'general_wellness';
    const isVeg =
      wellnessCtx.userPreferences.dietType === 'veg' ||
      wellnessCtx.userPreferences.dietType === 'vegan';
    const waterRem = wellnessCtx.waterToday.remainingMl;
    const nextSlot = wellnessCtx.uncompletedPlannedSlots[0];
    const nextMealName =
      nextSlot === 'breakfast'
        ? wellnessCtx.todaysPlan?.breakfast.name
        : nextSlot === 'lunch'
        ? wellnessCtx.todaysPlan?.lunch.name
        : nextSlot === 'evening_snack'
        ? wellnessCtx.todaysPlan?.eveningSnack.name
        : nextSlot === 'dinner'
        ? wellnessCtx.todaysPlan?.dinner.name
        : null;

    const goalLabels: Record<string, string> = {
      general_wellness: 'Balanced Daily Wellness',
      energy_stamina: 'Sustained Energy & Stamina',
      iron_recovery: 'Iron & Hemoglobin Support',
      weight_balance: 'Metabolic & Weight Balance',
      muscle_strength: 'Protein & Muscle Tone',
      maternal_nourishment: 'Maternal & Fetal Nourishment'
    };

    const tips: NutritionTipItem[] = [];

    // 1. Wellness Context Mode Tips (Pregnancy / Menstrual / General)
    if (mode === 'pregnancy') {
      tips.push(
        {
          id: 'preg-folate-iron',
          category: `Pregnancy Trimester ${pregnancyProfile.trimester || 2} • Maternal Focus`,
          headline: 'Pair Folate & Iron with Vitamin C at Midday Meals',
          advice:
            'Add a squeeze of fresh lemon or 2 slices of amla to cooked spinach or murungai dal kootu to triple plant-iron absorption while supporting maternal blood volume expansion.',
          foodHighlight: 'Steamed Idli + Murungai Keerai Sambar (fully cooked, pasteurized dairy only)',
          nutrientFocus: 'Folate (600 mcg DFE) · Iron (27 mg) · Calcium (1000 mg)'
        },
        {
          id: 'preg-hydration',
          category: 'Pregnancy Hydration & Comfort',
          headline: 'Steady Small-Sip Hydration Prevents Midday Fatigue',
          advice: `You have ${waterRem} mL remaining toward today's ${wellnessCtx.waterToday.targetMl} mL target. Sip 200–250 mL of clean water or tender coconut water between meals rather than large volumes during meals to reduce heartburn.`,
          foodHighlight: 'Tender Coconut Water (Ilaneer) + 6 Soaked peeled almonds',
          nutrientFocus: 'Electrolytes · Potassium · Bioavailable Magnesium'
        }
      );
    } else if (mode === 'menstrual') {
      tips.push(
        {
          id: 'mens-iron-magnesium',
          category: 'Menstrual Wellness • Cycle Replenishment',
          headline: 'Replenish Iron & Magnesium to Soothe Muscle Tension',
          advice:
            'Warm, mineral-dense meals help relax uterine smooth muscles and restore ferritin reserves. Pair black sesame or ragi with jaggery and warm ginger-infused water.',
          foodHighlight: 'Ragi Porridge / Malt + Black Sesame & Palm Jaggery (Ellu Urundai)',
          nutrientFocus: 'Non-Heme Iron (18 mg) · Magnesium (320 mg) · Vitamin B6'
        },
        {
          id: 'mens-digestive-comfort',
          category: 'Menstrual Comfort & Bloating Relief',
          headline: 'Choose Warm Fermented & Low-Sodium Whole Foods',
          advice:
            'Swap heavy fried snacks for steamed green gram sundal or warm moong dal khichdi with cumin and ginger to ease cyclical water retention and support gut comfort.',
          foodHighlight: 'Warm Yellow Moong Dal Khichdi + Cumin-Ginger Infusion',
          nutrientFocus: 'Digestible Plant Protein · Gingerols · Soluble Fiber'
        }
      );
    }

    // 2. Nutritional Goal Tips
    if (primaryGoal === 'iron_recovery' || primaryGoal.toLowerCase().includes('iron')) {
      tips.push({
        id: 'goal-iron',
        category: `Goal: ${goalLabels[primaryGoal] || 'Iron & Hemoglobin Support'}`,
        headline: 'Boost Hemoglobin with Moringa, Lentils & Citrus',
        advice:
          'Avoid drinking tea or coffee within 45 minutes of your main iron-rich meal, as tannins reduce iron absorption by up to 60%. Pair lentils with fresh guava or lemon instead.',
        foodHighlight: isVeg
          ? 'Murungai Keerai (Moringa) Dal Kootu + Red Matta Rice'
          : 'Egg Curry / Grilled Fish + Moringa Leaf Sambar & Red Rice',
        nutrientFocus: 'Bioavailable Iron · Vitamin C · Folate'
      });
    } else if (primaryGoal === 'muscle_strength' || primaryGoal.toLowerCase().includes('protein')) {
      tips.push({
        id: 'goal-protein',
        category: `Goal: ${goalLabels[primaryGoal] || 'Protein & Muscle Tone'}`,
        headline: 'Distribute 18–22g Protein Across Every Meal Slot',
        advice:
          'Spreading protein intake across Breakfast, Lunch, Evening Snack, and Dinner optimizes muscle protein synthesis and prevents late-evening cravings.',
        foodHighlight: isVeg
          ? 'Green Moong Pesarattu + Paneer/Tofu Methi Bhurji + Sprouted Sundal'
          : '2 Boiled Eggs + South Indian Fish/Chicken Curry + Moong Sundal',
        nutrientFocus: 'Complete Amino Acids · 60–75g Daily Protein · Calcium'
      });
    } else if (primaryGoal === 'weight_balance' || primaryGoal.toLowerCase().includes('weight')) {
      tips.push({
        id: 'goal-weight',
        category: `Goal: ${goalLabels[primaryGoal] || 'Metabolic & Weight Balance'}`,
        headline: 'Lead Each Meal with Soluble Fiber & Protein',
        advice:
          'Eating vegetable poriyal/thoran and dal before rice or rotis flattens post-meal glucose spikes and keeps energy steady for 4+ hours.',
        foodHighlight: 'Millet Idli / Ragi Dosa + Mixed Vegetable Sambar & Cucumber Salad',
        nutrientFocus: '28–32g Dietary Fiber · Low Glycemic Index · Lean Protein'
      });
    } else {
      tips.push({
        id: 'goal-balanced-thali',
        category: `Goal: ${goalLabels[primaryGoal] || 'Balanced Daily Wellness'}`,
        headline: 'Follow the Balanced South Indian & Indian Thali Ratio',
        advice:
          'Fill ½ your plate with cooked seasonal vegetables (poriyal/keerai), ¼ with whole grains (red rice, millets, or phulka), and ¼ with protein-rich legumes, curd, paneer, or eggs/fish.',
        foodHighlight: isVeg
          ? 'Steamed Millet Idli + Palak Dal Kootu + Sprouted Green Gram Sundal'
          : 'Millet Idli + Egg Roast / Grilled Fish + Steamed Greens',
        nutrientFocus: 'Balanced Macros · Gut Probiotics · Essential Micronutrients'
      });
    }

    // 3. Real-Time Meal & Hydration Context Tip
    tips.push({
      id: 'live-tracker-tip',
      category: 'Live Daily Tracker Insight',
      headline: nextMealName
        ? `Up Next (${nextSlot?.replace('_', ' ').toUpperCase()}): ${nextMealName}`
        : 'All Planned Meals Completed Today — Prioritize Gentle Hydration',
      advice:
        waterRem > 0
          ? `You have logged ${wellnessCtx.waterToday.consumedMl} mL of your ${wellnessCtx.waterToday.targetMl} mL water goal (${wellnessCtx.waterToday.completionPercent}%). Have a 250 mL glass of water 15 minutes before your next meal.`
          : `Hydration target achieved (${wellnessCtx.waterToday.consumedMl} mL / ${wellnessCtx.waterToday.targetMl} mL)! Keep sipping water comfortably as needed.`,
      foodHighlight: `${wellnessCtx.completedMealsToday.length} meal(s) logged today • ${wellnessCtx.nutritionTotalsToday.calories} kcal • ${wellnessCtx.nutritionTotalsToday.proteinGrams}g protein`,
      nutrientFocus: `Water Remaining: ${waterRem} mL · Fiber Logged: ${wellnessCtx.nutritionTotalsToday.fiberGrams}g`
    });

    // 4. Evening Recovery & Micronutrient Tip
    tips.push({
      id: 'evening-recovery-tip',
      category: `${wellnessCtx.userPreferences.preferredCuisine || 'South Indian'} Micronutrient Tip`,
      headline: 'Support Restful Sleep & Gut Recovery with Light Early Dinners',
      advice:
        'Finishing dinner 2 hours before sleep improves digestion and overnight iron/calcium assimilation. Include cumin, ajwain, or curry leaves in evening tempering.',
      foodHighlight: isVeg
        ? '2 Whole Wheat Phulkas + Palak Paneer / Moong Dal Tadka'
        : '2 Whole Wheat Phulkas + Grilled Fish / Egg Curry & Steamed Greens',
      nutrientFocus: 'Tryptophan · Magnesium · Prebiotic Fiber'
    });

    return tips;
  };

  const DAILY_AI_TIP_CACHE_KEY = 'smartshield_daily_ai_nutrition_tip_v1';

  const fetchLiveAINutritionTip = async (silentAutoFetch = false) => {
    setAiTipLoading(true);
    try {
      const freshCtx = StorageService.getSharedWellnessAIContext();
      setWellnessCtx(freshCtx);
      const activeMode = pregnancyProfile.active ? 'pregnancy' : freshCtx.wellnessJourneyMode;
      const primaryGoal = freshCtx.userPreferences.nutritionGoals?.[0] || 'general_wellness';

      const response = await fetch('/api/nutrition/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question:
            'Give me one concise, actionable daily nutrition and hydration tip based on my current wellness mode, nutrition goals, completed meals, and remaining water intake today.',
          wellnessContext: freshCtx,
          pregnancyMode: pregnancyProfile.active
        })
      });
      if (response.ok) {
        const data = await response.json();
        const rawAnswer = String(data?.answer || '')
          .replace(/[#*`]/g, '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const headline = rawAnswer[0]?.slice(0, 95) || 'Personalized Smart Nutrition AI Insight';
        const advice = rawAnswer.slice(1, 4).join(' ') || rawAnswer[0] || '';
        const generatedTip: NutritionTipItem = {
          id: `ai-tip-${Date.now()}`,
          category: 'Smart Nutrition AI • Daily Tip',
          headline,
          advice,
          foodHighlight:
            data?.highlights?.[0] ||
            `${freshCtx.nutritionTotalsToday.calories} kcal & ${freshCtx.nutritionTotalsToday.proteinGrams}g protein logged today`,
          nutrientFocus:
            data?.highlights?.[1] ||
            `Water: ${freshCtx.waterToday.consumedMl} / ${freshCtx.waterToday.targetMl} mL (${freshCtx.waterToday.completionPercent}%)`,
          isLiveAI: true
        };
        setCustomAiTip(generatedTip);
        try {
          localStorage.setItem(
            DAILY_AI_TIP_CACHE_KEY,
            JSON.stringify({
              date: todayStr,
              mode: activeMode,
              goal: primaryGoal,
              tip: generatedTip
            })
          );
        } catch {
          // ignore storage quota errors
        }
      }
    } catch {
      if (!silentAutoFetch) {
        setTipOffset((prev) => prev + 1);
      }
    } finally {
      setAiTipLoading(false);
    }
  };

  useEffect(() => {
    const freshCtx = StorageService.getSharedWellnessAIContext();
    setWellnessCtx(freshCtx);
    const activeMode = pregnancyProfile.active ? 'pregnancy' : freshCtx.wellnessJourneyMode;
    const primaryGoal = freshCtx.userPreferences.nutritionGoals?.[0] || 'general_wellness';

    try {
      const rawCache = localStorage.getItem(DAILY_AI_TIP_CACHE_KEY);
      if (rawCache) {
        const parsed = JSON.parse(rawCache);
        if (
          parsed?.date === todayStr &&
          parsed?.mode === activeMode &&
          parsed?.goal === primaryGoal &&
          parsed?.tip?.headline
        ) {
          setCustomAiTip(parsed.tip);
          return;
        }
      }
    } catch {
      // ignore corrupted cache
    }

    fetchLiveAINutritionTip(true);
  }, [todayStr, pregnancyProfile.active, pregnancyProfile.trimester]);

  const nutritionTipsPool = buildDailyRotationTips();
  const dateSeedNum = parseInt(todayStr.replace(/-/g, ''), 10) || 20261031;
  const activeTipIndex = (dateSeedNum + tipOffset) % nutritionTipsPool.length;
  const activeNutritionTip = customAiTip || nutritionTipsPool[activeTipIndex];

  const handleNextTip = () => {
    setCustomAiTip(null);
    setTipOffset((prev) => prev + 1);
  };

  const modeLabel = pregnancyProfile.active
    ? `Pregnancy (Trimester ${pregnancyProfile.trimester || 2})`
    : wellnessCtx.wellnessJourneyMode === 'menstrual'
    ? 'Menstrual Wellness'
    : 'General Wellness';

  return (
    <section
      aria-label="Quick Nutrition Tip"
      className="animate-widget-fade-in rounded-3xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-purple-950/40 p-5 sm:p-6 border border-emerald-700/40 shadow-xl transition-all duration-300"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div key={activeNutritionTip.id || `tip-${activeTipIndex}`} className="animate-tip-text-fade space-y-2.5 flex-1">
          <div className="flex items-center flex-wrap gap-2 text-xs text-emerald-300 font-semibold">
            <span className="inline-flex items-center space-x-1.5 text-emerald-300 font-bold uppercase tracking-wider">
              <Utensils className="w-3.5 h-3.5 text-emerald-400" />
              <span>Quick Nutrition Tip</span>
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-purple-200 flex items-center space-x-1">
              {pregnancyProfile.active ? (
                <Baby className="w-3.5 h-3.5 text-pink-400" />
              ) : (
                <HeartPulse className="w-3.5 h-3.5 text-purple-400" />
              )}
              <span>{activeNutritionTip.category}</span>
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-slate-400">
              {activeNutritionTip.isLiveAI
                ? `AI Personalized (${modeLabel})`
                : `Daily Tip ${activeTipIndex + 1} of ${nutritionTipsPool.length} (${todayStr})`}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-extrabold text-white leading-snug">
            {activeNutritionTip.headline}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {activeNutritionTip.advice}
          </p>

          <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs">
            <div className="text-emerald-200 font-medium flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                <span className="text-slate-400">Focus: </span>
                {activeNutritionTip.foodHighlight}
              </span>
            </div>
            <span aria-hidden="true" className="hidden sm:inline text-slate-700">
              ·
            </span>
            <div className="text-cyan-300 font-medium">
              {activeNutritionTip.nutrientFocus}
            </div>
          </div>
        </div>

        {/* Right Interactive Controls: Rotate Tip, AI Tip, Quick +250 mL Water, Open Planner */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-2.5 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-800/80">
          {/* Live Mini Hydration & Macro Summary */}
          <div className="flex items-center space-x-3 text-xs text-slate-300 bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800">
            <Droplets className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Water:{' '}
              <strong className="text-cyan-300">
                {wellnessCtx.waterToday.consumedMl}
              </strong>{' '}
              / {wellnessCtx.waterToday.targetMl} mL (
              {wellnessCtx.waterToday.completionPercent}%)
            </span>
            {waterQuickFeedback && (
              <span className="text-emerald-400 font-bold">
                {waterQuickFeedback}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleNextTip}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Rotate to next daily nutrition tip"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Next Tip</span>
            </button>

            <button
              type="button"
              onClick={() => fetchLiveAINutritionTip(false)}
              disabled={aiTipLoading}
              className="px-3 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 text-purple-200 text-xs font-bold border border-purple-700/60 flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-60"
              title="Generate a fresh tip from Smart Nutrition AI"
            >
              {aiTipLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-purple-300 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              )}
              <span>AI Tip</span>
            </button>

            <button
              type="button"
              onClick={handleQuickLogWater250}
              className="px-3 py-2 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 text-xs font-bold border border-cyan-700/60 flex items-center space-x-1 transition-colors cursor-pointer"
              title="Log 250 mL water intake"
            >
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span>+250 mL</span>
            </button>

            <button
              type="button"
              onClick={onOpenNutritionPlanner}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1 shadow-md transition-colors cursor-pointer"
            >
              <span>Meal Planner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
