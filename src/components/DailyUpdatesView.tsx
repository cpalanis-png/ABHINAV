import React, { useState, useEffect } from 'react';
import {
  Newspaper,
  RefreshCw,
  Search,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Clock,
  Globe,
  Loader2,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Utensils,
  Droplets,
  Leaf,
  Check,
  Award
} from 'lucide-react';
import { AIService } from '../services/aiService';
import { StorageService } from '../services/storage';
import { NutritionService } from '../services/nutritionService';
import { getMealVisualArtwork } from '../services/foodDatabase';
import { DailyUpdatesData, DailyMealPlan, DailyWaterSummary, CompletedMealRecord } from '../types';

export const DailyUpdatesView: React.FC = () => {
  const [data, setData] = useState<DailyUpdatesData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deliveryOptIn, setDeliveryOptIn] = useState<boolean>(true);

  // Connected Daily Meal Plan & Hydration State
  const [todayDate, setTodayDate] = useState<string>(StorageService.getLocalDateString());
  const [dailyPlan, setDailyPlan] = useState<DailyMealPlan | null>(null);
  const [completedMeals, setCompletedMeals] = useState<CompletedMealRecord[]>([]);
  const [waterSummary, setWaterSummary] = useState<DailyWaterSummary>(() =>
    StorageService.getWaterSummaryForDate(StorageService.getLocalDateString())
  );
  const [refreshingNutrition, setRefreshingNutrition] = useState<boolean>(false);
  const [variantSeed, setVariantSeed] = useState<number>(0);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const syncLocalWellnessState = async (dateStr: string) => {
    const profile = StorageService.getUserNutritionProfile();
    const journeyMode = profile.wellnessJourneyMode || 'general';
    let plan = StorageService.getDailyPlanByDateAndJourney(dateStr, journeyMode);
    if (!plan) {
      const journeyProf =
        journeyMode === 'pregnancy'
          ? StorageService.getPregnancyNutritionProfile()
          : journeyMode === 'menstrual'
          ? StorageService.getMenstrualNutritionProfile()
          : null;
      plan = await NutritionService.generateDailyPlan(journeyMode, profile, journeyProf, '', dateStr, 0);
      StorageService.saveDailyPlanByDateAndJourney(plan);
    }
    setDailyPlan(plan);
    setCompletedMeals(StorageService.getCompletedMealsForDate(dateStr));
    setWaterSummary(StorageService.getWaterSummaryForDate(dateStr));
  };

  const loadLiveUpdates = async () => {
    setLoading(true);
    setErrorMsg(null);
    const currentD = StorageService.getLocalDateString();
    setTodayDate(currentD);
    await syncLocalWellnessState(currentD);

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    const result = await AIService.fetchDailyUpdates(tz);
    setLoading(false);

    if (result.status === 'success') {
      setData(result);
    } else {
      setErrorMsg(result.errorMessage || 'Unable to load real-time daily updates at this moment.');
    }
  };

  useEffect(() => {
    loadLiveUpdates();
  }, []);

  // Refresh Daily Nutrition Recommendations while preserving already-completed meals
  const handleRefreshNutritionRecommendations = async () => {
    if (!dailyPlan) return;
    setRefreshingNutrition(true);
    const nextSeed = variantSeed + 1;
    setVariantSeed(nextSeed);

    const profile = StorageService.getUserNutritionProfile();
    const journeyMode = profile.wellnessJourneyMode || 'general';
    const journeyProf =
      journeyMode === 'pregnancy'
        ? StorageService.getPregnancyNutritionProfile()
        : journeyMode === 'menstrual'
        ? StorageService.getMenstrualNutritionProfile()
        : null;

    const freshPlan = NutritionService.createFallbackClientPlan(
      journeyMode,
      profile,
      journeyProf,
      dailyPlan.userCustomInstructions,
      todayDate,
      nextSeed
    );

    // Preserve any meal slots that the user has already completed today!
    const currentCompleted = StorageService.getCompletedMealsForDate(todayDate);
    const isSlotDone = (slot: 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner') =>
      currentCompleted.some(c => c.slot === slot);

    const mergedPlan: DailyMealPlan = {
      ...freshPlan,
      meals: {
        ...freshPlan.meals,
        breakfast: isSlotDone('breakfast') ? dailyPlan.meals.breakfast : freshPlan.meals.breakfast,
        lunch: isSlotDone('lunch') ? dailyPlan.meals.lunch : freshPlan.meals.lunch,
        eveningSnack: isSlotDone('eveningSnack')
          ? dailyPlan.meals.eveningSnack || dailyPlan.meals.afternoonSnack
          : freshPlan.meals.eveningSnack,
        dinner: isSlotDone('dinner') ? dailyPlan.meals.dinner : freshPlan.meals.dinner
      }
    };

    StorageService.saveDailyPlanByDateAndJourney(mergedPlan);
    setDailyPlan(mergedPlan);
    setRefreshingNutrition(false);
    setStatusToast('Refreshed uncompleted meal recommendations while preserving your completed meals!');
    setTimeout(() => setStatusToast(null), 3500);
  };

  const handleToggleSlotComplete = (slot: 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner') => {
    if (!dailyPlan) return;
    const meal =
      slot === 'eveningSnack'
        ? dailyPlan.meals.eveningSnack || dailyPlan.meals.afternoonSnack
        : dailyPlan.meals[slot];
    if (!meal) return;

    const result = StorageService.togglePlannedMealCompletion(todayDate, slot, meal);
    setCompletedMeals(result.recordsForDate);
    setStatusToast(
      result.completed
        ? `Great job! ${meal.mealName} marked completed (+${meal.caloriesApprox} kcal).`
        : `${meal.mealName} marked uncompleted.`
    );
    setTimeout(() => setStatusToast(null), 3000);
  };

  const handleQuickAddWater = (amountMl: number) => {
    const updated = StorageService.addWaterIntakeEntry(amountMl, todayDate, 'Daily Updates Quick Log');
    setWaterSummary(updated);
    setStatusToast(`Added +${amountMl} mL water (${updated.consumedMl} mL / ${updated.targetMl} mL today).`);
    setTimeout(() => setStatusToast(null), 3000);
  };

  const isSlotCompleted = (slot: 'breakfast' | 'lunch' | 'eveningSnack' | 'dinner') =>
    completedMeals.some(c => c.slot === slot);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 border border-indigo-800/60 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-950">
                <Newspaper className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Real-Time Daily Updates &amp; Nutrition</h2>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="inline-flex items-center space-x-1 text-xs font-bold text-indigo-300">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Gemini 3.8 Flash Grounding + Connected Smart Nutrition AI</span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-300 mt-2 max-w-xl leading-relaxed">
              Live news, technology updates, women&apos;s safety advisories, weather forecasts, and your dynamic daily meal &amp; hydration plan in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={loadLiveUpdates}
            disabled={loading}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs flex items-center space-x-2 shadow-xl hover:shadow-indigo-900/60 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Fetching Fresh Data...' : 'Refresh All Updates'}</span>
          </button>
        </div>

        {/* Dynamic Timestamp & Time Zone Banner */}
        <div className="mt-4 pt-4 border-t border-indigo-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-300 font-semibold">
            <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              {data ? `Generated: ${data.formattedTime}` : `Local Date: ${todayDate}`}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-xl bg-cyan-950 border border-cyan-700 text-cyan-200 text-[11px] font-extrabold flex items-center space-x-1">
              <Search className="w-3 h-3 text-cyan-400" />
              <span>Google Search Grounded</span>
            </span>
          </div>
        </div>
      </div>

      {/* Toast Feedback */}
      {statusToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/70 text-emerald-200 text-xs font-bold flex items-center space-x-2 shadow-lg">
          <Award className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Connected Daily Nutrition & Hydration Briefing Panel */}
      {dailyPlan && (
        <div className="rounded-3xl bg-slate-900 p-6 border border-emerald-800/60 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center">
                <Utensils className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  Today&apos;s Connected Nutrition &amp; Hydration Plan ({todayDate})
                </h3>
                <p className="text-xs text-slate-400">
                  Mode: <span className="text-emerald-300 font-bold uppercase">{dailyPlan.journeyType}</span> • Completed meals are preserved when refreshing
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefreshNutritionRecommendations}
              disabled={refreshingNutrition}
              className="px-4 py-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingNutrition ? 'animate-spin' : ''}`} />
              <span>Rotate Uncompleted Meals</span>
            </button>
          </div>

          {/* 4 Meal Slots Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              [
                { slot: 'breakfast', label: 'Breakfast', meal: dailyPlan.meals.breakfast },
                { slot: 'lunch', label: 'Lunch', meal: dailyPlan.meals.lunch },
                {
                  slot: 'eveningSnack',
                  label: 'Evening Snack',
                  meal: dailyPlan.meals.eveningSnack || dailyPlan.meals.afternoonSnack
                },
                { slot: 'dinner', label: 'Dinner', meal: dailyPlan.meals.dinner }
              ] as const
            ).map(({ slot, label, meal }) => {
              if (!meal) return null;
              const done = isSlotCompleted(slot);
              const artwork = meal.imageUrl || getMealVisualArtwork(meal);

              return (
                <div
                  key={slot}
                  className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                    done
                      ? 'bg-emerald-950/30 border-emerald-600/70'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <img
                    src={artwork}
                    alt={meal.mealName}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleSlotComplete(slot)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center space-x-1 cursor-pointer transition-all ${
                          done
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>{done ? 'Completed' : 'Mark Done'}</span>
                      </button>
                    </div>
                    <h4 className="text-xs font-bold text-white line-clamp-1">{meal.mealName}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-1">Portion: {meal.portionGuidance}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
                        {meal.caloriesApprox} kcal
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                        {meal.proteinGramsApprox}g Protein
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                        {meal.carbsGramsApprox ?? 40}g Carbs
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-purple-300">
                        {meal.fiberGramsApprox ?? 6}g Fiber
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Connected Hydration Status & Seasonal Tips Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/60 flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Droplets className="w-5 h-5 text-cyan-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black text-white">Today&apos;s Hydration Progress (mL)</h4>
                    <p className="text-[11px] text-cyan-200">
                      Consumed: <strong>{waterSummary.consumedMl} mL</strong> / Target: <strong>{waterSummary.targetMl} mL</strong> ({waterSummary.completionPercent}%)
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-cyan-300 bg-cyan-950 px-2.5 py-1 rounded-lg border border-cyan-700">
                  {waterSummary.remainingMl} mL left
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-cyan-900">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, waterSummary.completionPercent)}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">Quick log water from Daily Updates:</span>
                <div className="flex items-center gap-1.5">
                  {[150, 250, 500].map(ml => (
                    <button
                      key={ml}
                      type="button"
                      onClick={() => handleQuickAddWater(ml)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-900/70 hover:bg-cyan-800 text-cyan-100 text-[11px] font-bold border border-cyan-700 cursor-pointer"
                    >
                      +{ml} mL
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2">
                <Leaf className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="text-xs font-black text-white">Seasonal Foods &amp; Daily Nutrition Tip</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {dailyPlan.dailyWellnessTip ||
                  'Pair iron-rich lentils and greens with fresh lemon juice to boost non-heme iron absorption.'}
              </p>
              {dailyPlan.seasonalFoodSuggestions && dailyPlan.seasonalFoodSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {dailyPlan.seasonalFoodSuggestions.map((item, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-[10px] font-semibold"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Searching Live Web Sources...</h3>
            <p className="text-xs text-slate-400">Fetching today&apos;s top headlines, tech news, advisories, and local weather.</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {errorMsg && (
        <div className="p-5 rounded-3xl bg-rose-950/80 border-2 border-rose-600 text-left space-y-3 shadow-xl">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white">Unable to Fetch Live Updates</h3>
              <p className="text-xs text-rose-200 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadLiveUpdates}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow cursor-pointer"
          >
            Retry Live Search
          </button>
        </div>
      )}

      {/* Content Display */}
      {data && (
        <div className="space-y-6">
          {/* Main Raw Grounded Summary Response Card */}
          <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-black text-white">Today&apos;s Live Intelligence Report</h3>
              </div>
              <span className="text-xs font-mono text-indigo-300 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                {data.model || 'gemini-3.8-flash'}
              </span>
            </div>

            <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {data.rawText}
            </div>
          </div>

          {/* Sourced Citations & Web Links Panel */}
          {data.groundingSources && data.groundingSources.length > 0 && (
            <div className="rounded-3xl bg-slate-900 p-6 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-black text-white">
                    Verified Source Citations ({data.groundingSources.length})
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">Click to inspect live web article</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.groundingSources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-2xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-600/80 transition-all group flex flex-col justify-between space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-indigo-300 group-hover:text-indigo-200 line-clamp-2">
                        {source.title}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0 mt-0.5" />
                    </div>
                    {source.snippet && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {source.snippet}
                      </p>
                    )}
                    <span className="text-[10px] font-mono text-slate-500 truncate">
                      {source.url}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Search Queries Executed */}
          {data.searchQueries && data.searchQueries.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                Search Queries Executed:
              </span>
              {data.searchQueries.map((q, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px]">
                  &ldquo;{q}&rdquo;
                </span>
              ))}
            </div>
          )}

          {/* In-App Daily Delivery Schedule Preferences */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-950 border border-purple-700 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-purple-300" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-black text-white">Daily Morning Briefing &amp; Meal Plan Notification</h4>
                <p className="text-xs text-slate-400 max-w-xl">
                  Automatically refresh today&apos;s news, weather, and non-repeating daily meal recommendations every morning at 8:00 AM IST.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDeliveryOptIn(!deliveryOptIn)}
              className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                deliveryOptIn
                  ? 'bg-purple-950 border-purple-600 text-purple-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${deliveryOptIn ? 'text-purple-400' : 'text-slate-600'}`} />
              <span>{deliveryOptIn ? 'Briefings Enabled (8:00 AM)' : 'Enable Briefings'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
