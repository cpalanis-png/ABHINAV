import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Award,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Flame,
  BookOpen,
  Sparkles,
  HelpCircle,
  Check
} from 'lucide-react';

export interface SafetyTipItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  actionStep: string;
}

export interface SafetyQuizQuestion {
  id: string;
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  dailyTip: string;
}

interface AnsweredRecord {
  selectedIndex: number;
  isCorrect: boolean;
  answeredAt: string;
}

interface SafetyQuizProgressState {
  streakDays: number;
  lastActiveDate: string | null;
  answeredQuestions: Record<string, AnsweredRecord>;
  readTipIds: string[];
  totalPoints: number;
}

const QUIZ_STORAGE_KEY = 'smartshield_safety_quiz_progress_v1';

const DAILY_SAFETY_TIPS: SafetyTipItem[] = [
  {
    id: 'tip-rideshare-verify',
    category: 'Transit & Rideshare',
    title: 'Verify Rideshare Plate, Make & Child Lock Before Boarding',
    summary:
      'Always match the license plate, car model, and driver photo from outside the vehicle before opening the door. Ask the driver "Who are you picking up?" instead of stating your name first.',
    actionStep: 'Test the rear door handle from the inside before the vehicle pulls away to ensure child safety locks are disengaged.'
  },
  {
    id: 'tip-voice-sos-phrase',
    category: 'Emergency Preparedness',
    title: 'Keep Hands-Free Voice Trigger & Primary Contact Armed',
    summary:
      'In high-stress situations, unlocking your phone screen may take too long. Keeping at least one primary emergency contact synced and knowing your instant SOS trigger reduces alert latency to seconds.',
    actionStep: 'Verify your primary responder number in SmartShield and test Fake Call Escape before solo evening travel.'
  },
  {
    id: 'tip-situational-exit',
    category: 'Situational Awareness',
    title: 'Clock Exits & Lit Safe Havens Within 10 Seconds of Arrival',
    summary:
      'Whenever entering a transit station, parking garage, or unfamiliar street, identify two viable exit paths and the nearest 24/7 staffed business (pharmacy, hospital, hotel lobby, or police booth).',
    actionStep: 'Walk facing oncoming traffic on poorly lit roads so no vehicle can approach from behind unnoticed.'
  },
  {
    id: 'tip-digital-geotag',
    category: 'Digital Privacy',
    title: 'Delay Real-Time Social Location Tagging Until After Departure',
    summary:
      'Posting live stories with identifiable landmarks,カフェ names, or geotags broadcasts your exact real-time coordinates while you are still on site.',
    actionStep: 'Share live GPS coordinates exclusively with your private emergency circle, and post public updates only after leaving.'
  },
  {
    id: 'tip-elevator-posicion',
    category: 'Public Spaces',
    title: 'Stand Near the Control Panel in Elevators & Enclosed Spaces',
    summary:
      'Standing directly next to the elevator button panel gives you immediate access to the emergency alarm, door-open button, and all floor buttons if someone suspicious enters.',
    actionStep: 'If you feel uneasy before boarding an elevator, step back and take the next one or remain near the lobby desk.'
  },
  {
    id: 'tip-battery-reserve',
    category: 'Device Readiness',
    title: 'Treat 25% Battery as Your Critical Safety Threshold',
    summary:
      'Continuous GPS tracking and emergency audio/video recording require reliable battery reserve. Switching to low-power mode at 25% preserves cellular and GPS radios when you need them most.',
    actionStep: 'Carry a charged compact power bank and send a preemptive location check-in if your battery drops below 25%.'
  },
  {
    id: 'tip-trust-instincts',
    category: 'De-escalation & Boundaries',
    title: 'Prioritize Safety Over Politeness When Boundaries Are Crossed',
    summary:
      'Predatory behavior often relies on social hesitation. You never owe a stranger personal details, directions into isolated areas, or continued conversation when your instincts signal danger.',
    actionStep: 'Use a firm voice, create physical distance immediately, or trigger a simulated incoming call to exit discreetly.'
  }
];

const SAFETY_QUIZ_QUESTIONS: SafetyQuizQuestion[] = [
  {
    id: 'q-rideshare-check',
    category: 'Transit Safety',
    question:
      'When your booked cab or rideshare arrives at night, what is the safest verification sequence before getting in?',
    options: [
      'Wave to the driver, get in quickly, and check the app once seated',
      'Match the license plate from outside, ask "Who are you picking up?", and check the inside door handle',
      'Tell the driver your name and ask if they know the fastest shortcut',
      'Sit in the front passenger seat so you can see the navigation screen'
    ],
    correctIndex: 1,
    explanation:
      'Confirming the license plate from outside, having the driver state your name first, and checking that the rear door opens from the inside prevents boarding an impersonator vehicle or getting trapped by child locks.',
    dailyTip: 'Sit in the rear seat behind the front passenger seat for the clearest view and curbside exit.'
  },
  {
    id: 'q-followed-on-foot',
    category: 'Street Awareness',
    question:
      'You suspect someone is following you on foot during an evening commute. What should be your immediate action?',
    options: [
      'Walk faster straight to your home or apartment building and lock the door',
      'Turn into a quiet side alley to see if they follow you there',
      'Head toward a well-lit, populated 24/7 establishment (pharmacy, store, hotel, or police booth) and alert your circle',
      'Put on noise-canceling headphones and avoid looking around'
    ],
    correctIndex: 2,
    explanation:
      'Never lead a potential follower to your residence or into an isolated alley. Moving to a staffed, well-lit public venue with cameras and witnesses while triggering a location check-in or SOS is the safest protocol.',
    dailyTip: 'Crossing the street deliberately once or twice helps confirm whether someone is matching your path.'
  },
  {
    id: 'q-national-emergency',
    category: 'Emergency Response',
    question:
      'Which unified toll-free number connects you to India’s National Emergency Response Support System (Police, Fire, and Ambulance) even with low signal?',
    options: ['112', '198', '139', '1800'],
    correctIndex: 0,
    explanation:
      '112 is India’s unified pan-India Emergency Response Support System (ERSS) number, working alongside 1091 (Women Helpline) and 108 (Ambulance).',
    dailyTip: 'Pressing the power button rapidly 3–5 times on most smartphones dials 112 automatically.'
  },
  {
    id: 'q-digital-location',
    category: 'Digital Safety',
    question:
      'How should you handle location sharing when meeting someone new or commuting solo in an unfamiliar area?',
    options: [
      'Post a public story tagging the venue so everyone knows where you are',
      'Turn off your phone completely to save battery',
      'Share your live verified GPS link privately with trusted emergency contacts and set a check-in time',
      'Only share your location if an emergency has already started'
    ],
    correctIndex: 2,
    explanation:
      'Proactive private location sharing with trusted contacts—paired with an agreed check-in window—ensures someone knows your exact coordinates before any incident escalates.',
    dailyTip: 'Use SmartShield’s Daily Safety Checklist to copy and share your verified GPS link in one tap.'
  },
  {
    id: 'q-uncomfortable-interaction',
    category: 'De-escalation',
    question:
      'A stranger in a waiting area or transit hub is asking intrusive personal questions (whether you live alone or where you are headed). What is the best response?',
    options: [
      'Answer honestly so you do not appear rude',
      'Keep your response brief/non-specific, trigger a Fake Call Escape or move near staff/other commuters',
      'Show them your phone screen to prove someone is waiting for you',
      'Leave the station toward an unlit parking lot'
    ],
    correctIndex: 1,
    explanation:
      'You never owe strangers personal details. Using a discreet de-escalation tool like a realistic simulated call while relocating near staff or well-lit crowds breaks the interaction safely.',
    dailyTip: 'Mentioning "My family/friend is meeting me right outside at the counter now" deters opportunistic targeting.'
  },
  {
    id: 'q-elevator-safety',
    category: 'Public Spaces',
    question:
      'When riding an elevator alone in a parking structure or building at night, where is the safest place to stand?',
    options: [
      'In the far back corner facing the wall',
      'Directly in the center looking at your phone',
      'Next to the elevator control panel with your back to the side wall so you can see the door and press multiple floors if needed',
      'Blocking the doorway with your bag'
    ],
    correctIndex: 2,
    explanation:
      'Standing by the control panel lets you immediately press the next floor button, the Door Open button, or the Emergency Alarm if someone makes you uncomfortable.',
    dailyTip: 'If you need to exit quickly, press the next two floor buttons so the doors open within seconds.'
  }
];

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function getDayOfYearIndex(mod: number): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return day % mod;
}

function isYesterday(dateStr: string | null, todayStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  const t = new Date(`${todayStr}T00:00:00Z`);
  const diffDays = Math.round((t.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

const DEFAULT_PROGRESS: SafetyQuizProgressState = {
  streakDays: 0,
  lastActiveDate: null,
  answeredQuestions: {},
  readTipIds: [],
  totalPoints: 0
};

export const SafetyQuiz: React.FC = () => {
  const todayStr = getTodayDateString();

  const [progress, setProgress] = useState<SafetyQuizProgressState>(() => {
    try {
      const saved = localStorage.getItem(QUIZ_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SafetyQuizProgressState>;
        return {
          streakDays: typeof parsed.streakDays === 'number' ? parsed.streakDays : 0,
          lastActiveDate: typeof parsed.lastActiveDate === 'string' ? parsed.lastActiveDate : null,
          answeredQuestions:
            parsed.answeredQuestions && typeof parsed.answeredQuestions === 'object'
              ? parsed.answeredQuestions
              : {},
          readTipIds: Array.isArray(parsed.readTipIds) ? parsed.readTipIds : [],
          totalPoints: typeof parsed.totalPoints === 'number' ? parsed.totalPoints : 0
        };
      }
    } catch {
      // ignore corrupted localStorage
    }
    return DEFAULT_PROGRESS;
  });

  const [activeTipIndex, setActiveTipIndex] = useState<number>(() =>
    getDayOfYearIndex(DAILY_SAFETY_TIPS.length)
  );
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(() =>
    getDayOfYearIndex(SAFETY_QUIZ_QUESTIONS.length)
  );

  useEffect(() => {
    try {
      localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore storage quota errors
    }
  }, [progress]);

  const computeNextStreak = (current: SafetyQuizProgressState): { streakDays: number; lastActiveDate: string } => {
    if (current.lastActiveDate === todayStr) {
      return {
        streakDays: Math.max(1, current.streakDays),
        lastActiveDate: todayStr
      };
    }
    if (isYesterday(current.lastActiveDate, todayStr)) {
      return {
        streakDays: current.streakDays + 1,
        lastActiveDate: todayStr
      };
    }
    return {
      streakDays: 1,
      lastActiveDate: todayStr
    };
  };

  const currentTip = DAILY_SAFETY_TIPS[activeTipIndex] || DAILY_SAFETY_TIPS[0];
  const currentQuestion = SAFETY_QUIZ_QUESTIONS[activeQuestionIndex] || SAFETY_QUIZ_QUESTIONS[0];
  const currentAnswerRecord = progress.answeredQuestions[currentQuestion.id];
  const isTipRead = progress.readTipIds.includes(currentTip.id);

  const handleSelectOption = (optionIndex: number) => {
    const isCorrect = optionIndex === currentQuestion.correctIndex;
    const prevRecord = progress.answeredQuestions[currentQuestion.id];

    // Award points when a question is answered correctly for the first time
    let pointsDelta = 0;
    if (!prevRecord) {
      pointsDelta = isCorrect ? 25 : 10;
    } else if (!prevRecord.isCorrect && isCorrect) {
      pointsDelta = 15;
    }

    const streakUpdate = computeNextStreak(progress);

    setProgress((prev) => ({
      ...prev,
      ...streakUpdate,
      totalPoints: prev.totalPoints + pointsDelta,
      answeredQuestions: {
        ...prev.answeredQuestions,
        [currentQuestion.id]: {
          selectedIndex: optionIndex,
          isCorrect,
          answeredAt: new Date().toISOString()
        }
      }
    }));
  };

  const handleMarkTipRead = () => {
    if (isTipRead) return;
    const streakUpdate = computeNextStreak(progress);
    setProgress((prev) => ({
      ...prev,
      ...streakUpdate,
      readTipIds: [...prev.readTipIds, currentTip.id],
      totalPoints: prev.totalPoints + 10
    }));
  };

  const handleResetProgress = () => {
    setProgress(DEFAULT_PROGRESS);
    try {
      localStorage.removeItem(QUIZ_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const totalQuestions = SAFETY_QUIZ_QUESTIONS.length;
  const answeredList = Object.values(progress.answeredQuestions);
  const answeredCount = answeredList.length;
  const correctCount = answeredList.filter((a) => a.isCorrect).length;
  const masteryPct = Math.round((correctCount / totalQuestions) * 100);
  const accuracyPct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  const rankTitle =
    correctCount >= totalQuestions
      ? 'SmartShield Guardian'
      : correctCount >= 4
        ? 'Tactical Responder'
        : correctCount >= 2
          ? 'Situational Sentinel'
          : 'Safety Initiate';

  return (
    <section
      data-testid="safety-quiz-section"
      className="rounded-3xl bg-slate-900/90 p-6 sm:p-7 border border-slate-800 shadow-xl space-y-6"
    >
      {/* Top Header & Progress Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Daily Safety Intelligence</span>
            </span>
            <span
              data-testid="safety-quiz-rank-badge"
              className="px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[11px] font-bold"
            >
              Rank: {rankTitle}
            </span>
          </div>

          <h3 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
            <ShieldCheck className="w-6 h-6 text-indigo-400 shrink-0" />
            <span>Personal Safety Quiz &amp; Daily Tips</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400">
            Sharpen your situational instincts with daily personal safety tips and scenario drills. Progress saves automatically on your device.
          </p>
        </div>

        {/* Saved Progress Summary Strip */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-950/80 px-4 py-3 rounded-2xl border border-slate-800/90">
          <div className="flex items-center space-x-2 pr-3 border-r border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-700/60 flex items-center justify-center">
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div
                data-testid="safety-quiz-streak"
                className="text-xs font-black text-white leading-tight"
              >
                {progress.streakDays} Day{progress.streakDays === 1 ? '' : 's'}
              </div>
              <div className="text-[10px] text-amber-300 font-semibold">Active Streak</div>
            </div>
          </div>

          <div className="flex items-center space-x-2 pr-3 border-r border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center">
              <Award className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div
                data-testid="safety-quiz-score"
                className="text-xs font-black text-white leading-tight"
              >
                {correctCount}/{totalQuestions} Correct ({progress.totalPoints} XP)
              </div>
              <div className="text-[10px] text-emerald-300 font-semibold">
                {answeredCount > 0 ? `${accuracyPct}% Accuracy` : 'Start Quiz Below'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="text-left">
              <div className="text-xs font-black text-cyan-300">
                {progress.readTipIds.length}/{DAILY_SAFETY_TIPS.length} Tips Read
              </div>
              <div className="text-[10px] text-slate-400">Mastery: {masteryPct}%</div>
            </div>

            {(answeredCount > 0 || progress.readTipIds.length > 0) && (
              <button
                type="button"
                onClick={handleResetProgress}
                data-testid="safety-quiz-reset-btn"
                title="Reset Safety Quiz Progress"
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mastery Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300">
            Overall Safety Drill Mastery ({correctCount} of {totalQuestions} scenarios mastered)
          </span>
          <span className="font-extrabold text-indigo-300">{masteryPct}%</span>
        </div>
        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            data-testid="safety-quiz-progress-bar"
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-500 rounded-full"
            style={{ width: `${masteryPct}%` }}
          />
        </div>
      </div>

      {/* Main Two-Column Grid: Daily Personal Safety Tip + Interactive Scenario Quiz */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Daily Personal Safety Tip Card (5 cols) */}
        <div
          data-testid="daily-safety-tip-card"
          className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-950 p-5 border border-indigo-800/50 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[11px] font-bold">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span>Daily Tip #{activeTipIndex + 1}</span>
              </div>
              <span className="text-[11px] font-bold text-indigo-300 bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-800">
                {currentTip.category}
              </span>
            </div>

            <h4 className="text-base font-extrabold text-white leading-snug">
              {currentTip.title}
            </h4>

            <p className="text-xs text-slate-300 leading-relaxed">
              {currentTip.summary}
            </p>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center space-x-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Actionable Habit</span>
              </div>
              <p className="text-xs text-slate-200 font-medium leading-relaxed">
                {currentTip.actionStep}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() =>
                  setActiveTipIndex((prev) => (prev - 1 + DAILY_SAFETY_TIPS.length) % DAILY_SAFETY_TIPS.length)
                }
                aria-label="Previous safety tip"
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTipIndex((prev) => (prev + 1) % DAILY_SAFETY_TIPS.length)}
                aria-label="Next safety tip"
                data-testid="next-safety-tip-btn"
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <span>Next Tip</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleMarkTipRead}
              data-testid="mark-tip-read-btn"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                isTipRead
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/70'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isTipRead ? 'Tip Practiced (+10 XP)' : 'Mark Tip Read (+10 XP)'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Interactive Safety Quiz Card (7 cols) */}
        <div
          data-testid="safety-quiz-question-card"
          className="lg:col-span-7 rounded-2xl bg-slate-950/90 p-5 border border-slate-800 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-4">
            {/* Question Header & Pill Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[11px] font-bold">
                  Scenario {activeQuestionIndex + 1} of {totalQuestions}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {currentQuestion.category}
                </span>
              </div>

              {/* Question Number Dots */}
              <div className="flex items-center space-x-1.5">
                {SAFETY_QUIZ_QUESTIONS.map((q, idx) => {
                  const rec = progress.answeredQuestions[q.id];
                  const isCurrent = idx === activeQuestionIndex;
                  const dotTone = rec
                    ? rec.isCorrect
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-900 text-slate-400 border-slate-700';

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setActiveQuestionIndex(idx)}
                      data-testid={`quiz-step-btn-${idx}`}
                      className={`w-6 h-6 rounded-lg text-[11px] font-black border transition-all flex items-center justify-center cursor-pointer ${dotTone} ${
                        isCurrent ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                      title={`Scenario ${idx + 1}: ${q.category}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question Prompt */}
            <div className="flex items-start space-x-2.5">
              <HelpCircle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <h4
                data-testid="safety-quiz-question-text"
                className="text-sm sm:text-base font-bold text-white leading-snug"
              >
                {currentQuestion.question}
              </h4>
            </div>

            {/* Answer Options */}
            <div className="space-y-2.5">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = currentAnswerRecord?.selectedIndex === idx;
                const isCorrectOption = idx === currentQuestion.correctIndex;
                const hasAnswered = Boolean(currentAnswerRecord);

                let optionStyle =
                  'bg-slate-900/90 border-slate-800 hover:border-indigo-600/70 text-slate-200';
                if (hasAnswered) {
                  if (isCorrectOption) {
                    optionStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-100';
                  } else if (isSelected && !isCorrectOption) {
                    optionStyle = 'bg-rose-950/60 border-rose-500 text-rose-100';
                  } else {
                    optionStyle = 'bg-slate-900/40 border-slate-800/70 text-slate-400';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(idx)}
                    data-testid={`quiz-option-${idx}`}
                    className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all flex items-start justify-between gap-3 cursor-pointer ${optionStyle}`}
                  >
                    <div className="flex items-start space-x-2.5">
                      <span className="w-5 h-5 rounded-md bg-slate-950/80 border border-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 text-slate-300">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="leading-relaxed">{option}</span>
                    </div>

                    {hasAnswered && isCorrectOption && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    {hasAnswered && isSelected && !isCorrectOption && (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Instant Feedback & Safety Takeaway */}
            {currentAnswerRecord && (
              <div
                data-testid="safety-quiz-feedback"
                className={`p-4 rounded-xl border space-y-1.5 ${
                  currentAnswerRecord.isCorrect
                    ? 'bg-emerald-950/40 border-emerald-700/70 text-emerald-200'
                    : 'bg-amber-950/40 border-amber-700/70 text-amber-200'
                }`}
              >
                <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider">
                  {currentAnswerRecord.isCorrect ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-emerald-300">Correct Tactical Response (+25 XP)</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-amber-300">Safety Review — Try Selecting the Highlighted Option</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {currentQuestion.explanation}
                </p>
                <p className="text-[11px] text-cyan-300 font-semibold pt-1">
                  Quick Takeaway: {currentQuestion.dailyTip}
                </p>
              </div>
            )}
          </div>

          {/* Bottom Question Navigation Controls */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setActiveQuestionIndex(
                  (prev) => (prev - 1 + SAFETY_QUIZ_QUESTIONS.length) % SAFETY_QUIZ_QUESTIONS.length
                )
              }
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 border border-slate-700 transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-[11px] text-slate-400 font-medium">
              {currentAnswerRecord
                ? currentAnswerRecord.isCorrect
                  ? 'Scenario Mastered'
                  : 'Tap correct option to master'
                : 'Select an option above'}
            </span>

            <button
              type="button"
              onClick={() =>
                setActiveQuestionIndex((prev) => (prev + 1) % SAFETY_QUIZ_QUESTIONS.length)
              }
              data-testid="next-quiz-question-btn"
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-colors flex items-center space-x-1 shadow-md cursor-pointer"
            >
              <span>Next Scenario</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
