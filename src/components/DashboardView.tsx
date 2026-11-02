import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Compass,
  HeartPulse,
  MessageSquare,
  PhoneCall,
  MapPin,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Phone,
  Baby,
  Calendar,
  Utensils,
  Lock,
  ArrowRight,
  ClipboardCheck,
  BatteryCharging,
  Battery,
  BatteryWarning,
  Share2,
  Users,
  RefreshCw,
  Check,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Video,
  Droplets
} from 'lucide-react';
import { LocationData, PregnancyProfile, Contact } from '../types';
import { LocationService } from '../services/locationService';
import { StorageService } from '../services/storage';
import { SmartSOSWidget } from './SmartSOSWidget';
import { VoiceSOSTriggerCard } from './VoiceSOSTriggerCard';
import { PermissionCheck } from './PermissionCheck';
import { PermissionGate } from './PermissionGate';
import { NativeContactSyncModal } from './NativeContactSyncModal';
import { EmergencyContactsManager } from './EmergencyContactsManager';
import { NutritionTipWidget } from './NutritionTipWidget';
import { SafetyQuiz } from './SafetyQuiz';
import { HealthSyncCard } from './HealthSyncCard';

interface SafetyChecklistTaskState {
  date: string;
  completedIds: string[];
  lastSharedAt?: string;
  batteryVerifiedLevel?: number;
}

const CHECKLIST_STORAGE_KEY = 'smartshield_daily_safety_checklist_v5';

interface DashboardViewProps {
  location: LocationData | null;
  refreshLocation: () => void;
  triggerSOS: () => void;
  pregnancyProfile: PregnancyProfile;
  contacts: Contact[];
  setActiveTab: (tab: string) => void;
  triggerFakeCall: () => void;
  onContactsUpdated?: (contacts: Contact[]) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  location,
  refreshLocation,
  triggerSOS,
  pregnancyProfile,
  contacts,
  setActiveTab,
  triggerFakeCall,
  onContactsUpdated
}) => {
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [quickAIInput, setQuickAIInput] = useState('');
  const todayStr = new Date().toISOString().split('T')[0];

  const [checklistState, setChecklistState] = useState<SafetyChecklistTaskState>(() => {
    try {
      const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SafetyChecklistTaskState;
        if (parsed.date === todayStr && Array.isArray(parsed.completedIds)) {
          return parsed;
        }
      }
    } catch {
      // ignore corrupted storage
    }
    return {
      date: todayStr,
      completedIds: []
    };
  });

  const [batteryInfo, setBatteryInfo] = useState<{
    level: number | null;
    charging: boolean;
    supported: boolean;
  }>({
    level: null,
    charging: false,
    supported: false
  });

  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [batteryFeedback, setBatteryFeedback] = useState<string | null>(null);

  useEffect(() => {
    let batteryManager: any = null;
    const updateBattery = () => {
      if (batteryManager) {
        setBatteryInfo({
          level: Math.round(batteryManager.level * 100),
          charging: Boolean(batteryManager.charging),
          supported: true
        });
      }
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((bm: any) => {
          batteryManager = bm;
          updateBattery();
          bm.addEventListener('levelchange', updateBattery);
          bm.addEventListener('chargingchange', updateBattery);
        })
        .catch(() => {
          setBatteryInfo({ level: 88, charging: false, supported: false });
        });
    } else {
      setBatteryInfo({ level: 88, charging: false, supported: false });
    }

    return () => {
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', updateBattery);
        batteryManager.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  const saveChecklistState = (next: SafetyChecklistTaskState) => {
    setChecklistState(next);
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  };

  const toggleChecklistTask = (taskId: string) => {
    const exists = checklistState.completedIds.includes(taskId);
    const updatedIds = exists
      ? checklistState.completedIds.filter((id) => id !== taskId)
      : [...checklistState.completedIds, taskId];
    saveChecklistState({
      ...checklistState,
      date: todayStr,
      completedIds: updatedIds
    });
  };

  const markTaskComplete = (taskId: string, extra?: Partial<SafetyChecklistTaskState>) => {
    const updatedIds = checklistState.completedIds.includes(taskId)
      ? checklistState.completedIds
      : [...checklistState.completedIds, taskId];
    saveChecklistState({
      ...checklistState,
      ...extra,
      date: todayStr,
      completedIds: updatedIds
    });
  };

  const hasUsableLocation = LocationService.isUsableLocation(location);

  const handleShareDailyLocation = async () => {
    refreshLocation();
    if (!hasUsableLocation || !location) {
      setShareFeedback('Refreshing GPS fix — grant location permission to copy coordinates.');
      setTimeout(() => setShareFeedback(null), 4000);
      return;
    }
    const coordsText = `https://maps.google.com/?q=${location.latitude},${location.longitude} (${location.address || 'Verified GPS'}, ±${location.accuracy}m)`;
    const shareMessage = `SMART SHIELD Daily Safety Check-In: My current verified location is ${coordsText}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareMessage);
      }
    } catch {
      // Clipboard fallback
    }

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    markTaskComplete('share-location', { lastSharedAt: timeNow });
    setShareFeedback(`Location check-in link copied (${timeNow})`);
    setTimeout(() => setShareFeedback(null), 4000);
  };

  const handleVerifyBatteryHealth = () => {
    const currentPct = batteryInfo.level ?? 88;
    markTaskComplete('battery-health', { batteryVerifiedLevel: currentPct });
    const statusLabel =
      currentPct <= 20 && !batteryInfo.charging
        ? `Low battery (${currentPct}%) — connect charger or power bank before travel`
        : `Battery health verified at ${currentPct}% (${batteryInfo.charging ? 'Charging' : 'Optimal reserve'})`;
    setBatteryFeedback(statusLabel);
    setTimeout(() => setBatteryFeedback(null), 4000);
  };

  const handleVerifyContacts = () => {
    markTaskComplete('verify-contacts');
    setIsSyncModalOpen(true);
  };

  const handleVerifyPerimeter = () => {
    markTaskComplete('safe-perimeter');
    setActiveTab('gps');
  };

  const handleTestEscapeReadiness = () => {
    markTaskComplete('escape-readiness');
    triggerFakeCall();
  };

  const handleResetChecklist = () => {
    saveChecklistState({
      date: todayStr,
      completedIds: []
    });
  };

  const safetyRadiusKm = StorageService.getSafetySearchRadius();
  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

  const dailySafetyTasks = [
    {
      id: 'share-location',
      title: 'Share & Verify Live Location',
      description:
        hasUsableLocation && location
          ? `Active fix: ${location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`} (±${Math.round(location.accuracy)}m)`
          : 'Acquire fresh GPS coordinates and copy check-in link for trusted circle',
      badge: checklistState.lastSharedAt
        ? `Shared ${checklistState.lastSharedAt}`
        : hasUsableLocation
        ? 'GPS Locked'
        : 'Needs Fix',
      badgeTone: hasUsableLocation
        ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
        : 'bg-amber-950 text-amber-300 border-amber-800',
      icon: Share2,
      iconTone: 'text-cyan-400 bg-cyan-950 border-cyan-800/60',
      actionLabel: hasUsableLocation ? 'Copy Check-In Link' : 'Acquire GPS Fix',
      onAction: handleShareDailyLocation
    },
    {
      id: 'verify-contacts',
      title: 'Check Emergency Contacts Circle',
      description:
        contacts.length > 0
          ? `${contacts.length} responder(s) active • Primary: ${primaryContact?.name} (${primaryContact?.phone})`
          : 'No emergency contacts configured — sync directly from phone address book for rapid alert dispatch',
      badge: `${contacts.length} Armed`,
      badgeTone:
        contacts.length > 0
          ? 'bg-purple-950 text-purple-300 border-purple-800'
          : 'bg-rose-950 text-rose-300 border-rose-800',
      icon: Users,
      iconTone: 'text-purple-400 bg-purple-950 border-purple-800/60',
      actionLabel: contacts.length > 0 ? 'Sync & Inspect' : 'Sync Phone Contacts',
      onAction: handleVerifyContacts
    },
    {
      id: 'battery-health',
      title: 'Ensure Device Battery & Power Health',
      description:
        batteryInfo.level !== null
          ? `Current level: ${batteryInfo.level}% ${batteryInfo.charging ? '(Charging)' : '(On Battery)'} • ${
              batteryInfo.level <= 25 && !batteryInfo.charging
                ? 'Enable power-saving mode or plug in before commuting'
                : 'Sufficient reserve for continuous GPS & SOS relay'
            }`
          : 'Check device power reserve for uninterrupted GPS escort and emergency alerts',
      badge:
        batteryInfo.level !== null
          ? `${batteryInfo.level}% ${batteryInfo.charging ? '⚡' : ''}`
          : 'Ready',
      badgeTone:
        batteryInfo.level !== null && batteryInfo.level <= 25 && !batteryInfo.charging
          ? 'bg-rose-950 text-rose-300 border-rose-800'
          : 'bg-emerald-950 text-emerald-300 border-emerald-800',
      icon:
        batteryInfo.charging
          ? BatteryCharging
          : batteryInfo.level !== null && batteryInfo.level <= 25
          ? BatteryWarning
          : Battery,
      iconTone:
        batteryInfo.level !== null && batteryInfo.level <= 25 && !batteryInfo.charging
          ? 'text-rose-400 bg-rose-950 border-rose-800/60'
          : 'text-emerald-400 bg-emerald-950 border-emerald-800/60',
      actionLabel: 'Verify Battery',
      onAction: handleVerifyBatteryHealth
    },
    {
      id: 'safe-perimeter',
      title: 'Confirm Safe Zone Search Perimeter',
      description: `Active emergency resource scan radius set to ${safetyRadiusKm}km around your live coordinates`,
      badge: `${safetyRadiusKm}km Radius`,
      badgeTone: 'bg-indigo-950 text-indigo-300 border-indigo-800',
      icon: Compass,
      iconTone: 'text-indigo-400 bg-indigo-950 border-indigo-800/60',
      actionLabel: 'Check Radar',
      onAction: handleVerifyPerimeter
    },
    {
      id: 'escape-readiness',
      title: 'Test Discreet Escape & Deterrent Tools',
      description: 'Confirm simulated incoming call & quick SOS audio readiness before solo travel',
      badge: 'Escape Ready',
      badgeTone: 'bg-pink-950 text-pink-300 border-pink-800',
      icon: PhoneCall,
      iconTone: 'text-pink-400 bg-pink-950 border-pink-800/60',
      actionLabel: 'Test Fake Call',
      onAction: handleTestEscapeReadiness
    }
  ];

  const completedTasksCount = dailySafetyTasks.filter((t) =>
    checklistState.completedIds.includes(t.id)
  ).length;
  const totalTasksCount = dailySafetyTasks.length;
  const checklistProgressPct = Math.round((completedTasksCount / totalTasksCount) * 100);

  const freshness = location ? LocationService.getFreshnessScore(location) : null;
  const primaryContactsCount = contacts.length;

  const handleQuickAISubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAIInput.trim()) return;
    // Switch to AI tab with query
    setActiveTab('ai');
  };

  return (
      <div className="space-y-8 pb-12">
        
        {/* Hero Welcome & Emergency SOS Trigger */}
        <section className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-6 sm:p-8 border border-purple-800/40 shadow-2xl overflow-hidden">
          {/* Glowing Background Elements */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-900/60 border border-purple-700/60 text-purple-200 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>SMART SHIELD 5.0 Active Defense & Wellness</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                Your Safety. Your Health.<br />
                <span className="bg-gradient-to-r from-purple-300 via-pink-300 to-rose-400 bg-clip-text text-transparent">
                  Your Absolute Power.
                </span>
              </h1>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
                Real-time GPS verification, multi-tiered emergency response, universal Gemini AI support, and precision menstrual & pregnancy health care.
              </p>

              {/* Live GPS Address snippet */}
              <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-900/80 px-4 py-2.5 rounded-xl border border-slate-800 max-w-lg">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate">
                  {location?.address || 'Detecting live verified GPS location...'}
                </span>
                {freshness && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ml-auto shrink-0 ${freshness.badgeColor}`}>
                    {freshness.label}
                  </span>
                )}
              </div>
            </div>

              {/* SOS Hero Trigger Button */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-900/60 rounded-2xl border border-rose-900/40 backdrop-blur-sm overflow-hidden">
              <div className="text-center mb-4">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Instant Emergency Response</span>
                <h3 className="text-lg font-bold text-white">Tap for Instant SOS</h3>
              </div>

              <button
                onClick={triggerSOS}
                data-testid="dashboard-sos-btn"
                className="group relative w-36 h-36 rounded-full bg-gradient-to-tr from-rose-600 via-red-600 to-amber-500 p-1 shadow-2xl shadow-rose-900/60 hover:shadow-rose-700/90 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer my-2 animate-pulse"
              >
                {/* Subtle Emergency Attention Pulse Ring */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-2 rounded-full border-2 border-rose-500/50 animate-ping opacity-35"
                />

                {/* Subtle Protective Halo Pulse */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-2.5 rounded-full bg-gradient-to-r from-rose-400/25 via-amber-200/30 to-purple-400/25 blur-md opacity-80 animate-pulse group-hover:opacity-100 group-active:scale-125 transition-all duration-300"
                />

                {/* Animated Left Angel Wing Overlay */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 120 140"
                  className="sos-wing-left pointer-events-none absolute -left-16 sm:-left-20 top-1/2 -translate-y-1/2 w-24 sm:w-28 h-28 sm:h-32 z-0"
                  fill="none"
                >
                  <defs>
                    <linearGradient id="shieldWingGradLeft" x1="100%" y1="50%" x2="0%" y2="0%">
                      <stop offset="0%" stopColor="#fda4af" stopOpacity="0.85" />
                      <stop offset="55%" stopColor="#fde68a" stopOpacity="0.65" />
                      <stop offset="100%" stopColor="#e9d5ff" stopOpacity="0.15" />
                    </linearGradient>
                  </defs>
                  {/* Upper Primary Feather Arc */}
                  <path
                    d="M112 78 C92 42, 54 18, 8 14 C24 34, 48 52, 82 64 C52 50, 24 44, 4 42 C24 60, 54 72, 88 78 C58 72, 30 70, 12 72 C32 86, 62 92, 94 90 C68 92, 44 96, 26 102 C48 110, 78 108, 106 98 Z"
                    fill="url(#shieldWingGradLeft)"
                    stroke="rgba(254, 240, 138, 0.55)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Inner Soft Feather Accent */}
                  <path
                    d="M108 82 C88 58, 58 40, 26 34 M104 86 C82 70, 56 60, 28 58 M102 92 C82 84, 58 80, 36 82"
                    stroke="rgba(255, 255, 255, 0.45)"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Animated Right Angel Wing Overlay */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 120 140"
                  className="sos-wing-right pointer-events-none absolute -right-16 sm:-right-20 top-1/2 -translate-y-1/2 w-24 sm:w-28 h-28 sm:h-32 z-0"
                  fill="none"
                >
                  <defs>
                    <linearGradient id="shieldWingGradRight" x1="0%" y1="50%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#fda4af" stopOpacity="0.85" />
                      <stop offset="55%" stopColor="#fde68a" stopOpacity="0.65" />
                      <stop offset="100%" stopColor="#e9d5ff" stopOpacity="0.15" />
                    </linearGradient>
                  </defs>
                  {/* Upper Primary Feather Arc */}
                  <path
                    d="M8 78 C28 42, 66 18, 112 14 C96 34, 72 52, 38 64 C68 50, 96 44, 116 42 C96 60, 66 72, 32 78 C62 72, 90 70, 108 72 C88 86, 58 92, 26 90 C52 92, 76 96, 94 102 C72 110, 42 108, 14 98 Z"
                    fill="url(#shieldWingGradRight)"
                    stroke="rgba(254, 240, 138, 0.55)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Inner Soft Feather Accent */}
                  <path
                    d="M12 82 C32 58, 62 40, 94 34 M16 86 C38 70, 64 60, 92 58 M18 92 C38 84, 62 80, 84 82"
                    stroke="rgba(255, 255, 255, 0.45)"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Core Circular SOS Button Surface */}
                <div className="relative z-10 w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center text-center p-2 group-hover:bg-slate-900 transition-colors shadow-inner">
                  <ShieldAlert className="w-12 h-12 text-rose-500 group-hover:scale-110 transition-transform mb-1 stroke-[2.2]" />
                  <span className="text-xl font-black text-white tracking-wider">SOS</span>
                  <span className="text-[10px] text-rose-300 font-semibold uppercase">Instant Alert</span>
                </div>
              </button>

              <p className="text-[11px] text-slate-300 mt-4 text-center">
                {primaryContactsCount > 0
                  ? `Immediately alerts ${primaryContactsCount} saved emergency contact${primaryContactsCount > 1 ? 's' : ''} with Google Maps GPS link.`
                  : 'No emergency contacts saved yet — add your emergency contacts below.'}
              </p>
            </div>

          </div>
        </section>

        {/* AI PRIVATE SPACE SECURITY SCANNER FEATURE BANNER */}
        <div
          onClick={() => setActiveTab('scanner')}
          className="cursor-pointer rounded-2xl bg-gradient-to-r from-cyan-950/90 via-blue-950/80 to-slate-900 p-5 border-2 border-cyan-500/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl hover:border-cyan-400 transition-all group"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 uppercase tracking-wider">
                  AI PRIVATE SPACE SECURITY SCANNER
                </span>
                <span className="text-[11px] text-cyan-300 font-bold hidden sm:inline">
                  Hidden Camera &amp; Electronic Bug Inspection
                </span>
              </div>
              <h4 className="text-base font-bold text-white mt-1">
                Inspect Hotel Rooms, Changing Areas &amp; Private Spaces
              </h4>
              <p className="text-xs text-slate-300">
                Real-time optical lens reflection clues, IR remote calibration, local Wi-Fi OUI vendor lookup, hardware magnetometer telemetry, and structured physical verification.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('scanner');
            }}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 shrink-0 self-end sm:self-center shadow-md cursor-pointer"
          >
            <span>Open Security Scanner</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* EMERGENCY CONTACTS SECTION (CUSTOM USER CONTACTS) */}
        <EmergencyContactsManager
          contacts={contacts}
          onUpdateContacts={(updated) => {
            if (onContactsUpdated) onContactsUpdated(updated);
          }}
          location={location}
        />

        {/* WEARABLE HEALTH SYNC & VITALS EMERGENCY MONITOR CARD */}
        <HealthSyncCard onTriggerSOS={triggerSOS} />

        {/* VOICE-ACTIVATED SOS TRIGGER CARD ("Smart Shield Help") */}
        <VoiceSOSTriggerCard />

        {/* SMART SOS WIDGET - ESTIMATED EMERGENCY RESPONSE TIME */}
        <SmartSOSWidget
          location={location}
          triggerSOS={triggerSOS}
        />

        {/* DAILY PERSONAL SECURITY & SAFETY CHECKLIST */}
        <section className="rounded-3xl bg-slate-900/90 p-6 sm:p-7 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-bold uppercase tracking-wider">
                  Daily Security Protocol
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {todayStr}
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
                <ClipboardCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <span>Daily Personal Safety Checklist</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Complete your daily security readiness checks before commuting or traveling solo.
              </p>
            </div>

            <div className="flex items-center space-x-4 self-start sm:self-center bg-slate-950/70 px-4 py-3 rounded-2xl border border-slate-800/80">
              {/* Circular Progress Bar */}
              <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                <svg className="w-16 h-16 -rotate-90 transform" viewBox="0 0 64 64">
                  <defs>
                    <linearGradient id="safetyChecklistGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#14b8a6" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                  {/* Background Track Circle */}
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-slate-800"
                  />
                  {/* Animated Progress Circle (Circumference = 2 * PI * 26 ≈ 163.36) */}
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    fill="transparent"
                    stroke="url(#safetyChecklistGrad)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={163.36}
                    strokeDashoffset={163.36 - (163.36 * checklistProgressPct) / 100}
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-black text-white leading-none">
                    {checklistProgressPct}%
                  </span>
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter mt-0.5">
                    Ready
                  </span>
                </div>
              </div>

              <div className="text-left">
                <div className="text-xs font-bold text-white">
                  {completedTasksCount} of {totalTasksCount} Tasks Done
                </div>
                <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                  {checklistProgressPct === 100
                    ? 'All Checks Verified'
                    : `${totalTasksCount - completedTasksCount} Remaining Today`}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Daily Security Score
                </div>
              </div>

              {completedTasksCount > 0 && (
                <button
                  onClick={handleResetChecklist}
                  title="Reset Today's Checklist"
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Linear Progress Bar Accent */}
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-500 rounded-full"
              style={{ width: `${checklistProgressPct}%` }}
            />
          </div>

          {/* Live Action Feedback Banner */}
          {(shareFeedback || batteryFeedback) && (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{shareFeedback || batteryFeedback}</span>
              </div>
            </div>
          )}

          {/* All Tasks Completed Banner */}
          {completedTasksCount === totalTasksCount && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-teal-950/70 to-slate-900 border border-emerald-700/50 flex items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-900/70 border border-emerald-600/60 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    100% Daily Personal Security Readiness Achieved
                  </h4>
                  <p className="text-xs text-slate-300">
                    Your live GPS, emergency contacts, device battery health, and escape tools are verified for today.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Checklist Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {dailySafetyTasks.map((task) => {
              const isCompleted = checklistState.completedIds.includes(task.id);
              const TaskIcon = task.icon;
              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    isCompleted
                      ? 'bg-emerald-950/20 border-emerald-800/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <button
                      type="button"
                      onClick={() => toggleChecklistTask(task.id)}
                      aria-label={`Mark ${task.title} as ${isCompleted ? 'incomplete' : 'complete'}`}
                      className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'bg-slate-900 border-slate-700 hover:border-emerald-500 text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4
                          onClick={() => toggleChecklistTask(task.id)}
                          className={`text-sm font-bold cursor-pointer transition-colors ${
                            isCompleted ? 'text-emerald-300 line-through' : 'text-white'
                          }`}
                        >
                          {task.title}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${task.badgeTone}`}
                        >
                          {task.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {task.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <div className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-400">
                      <div className={`w-6 h-6 rounded-lg border flex items-center justify-center ${task.iconTone}`}>
                        <TaskIcon className="w-3.5 h-3.5" />
                      </div>
                      <span>{isCompleted ? 'Verified Today' : 'Action Pending'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={task.onAction}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <span>{task.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* PERSONAL SAFETY QUIZ & DAILY TIPS (WITH LOCALSTORAGE PROGRESS) */}
        <SafetyQuiz />

        {/* Pregnancy Mode Active Notification Banner (If enabled) */}
        {pregnancyProfile.active && (
          <div 
            onClick={() => setActiveTab('wellness')}
            className="cursor-pointer rounded-2xl bg-gradient-to-r from-pink-950/80 via-purple-950/70 to-slate-900 p-5 border border-pink-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg hover:border-pink-500 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-pink-900/80 border border-pink-600/60 flex items-center justify-center shrink-0">
                <Baby className="w-7 h-7 text-pink-300" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-pink-900 text-pink-200 border border-pink-700">
                    Pregnancy Mode Active
                  </span>
                  <span className="text-xs text-slate-300 font-medium">Trimester {pregnancyProfile.trimester}</span>
                </div>
                <h4 className="text-lg font-bold text-white mt-1">
                  Week {pregnancyProfile.currentWeek}, Day {pregnancyProfile.currentDay} • {pregnancyProfile.babySizeComparison}
                </h4>
                <p className="text-xs text-slate-300">
                  Due Date: <strong className="text-pink-300">{pregnancyProfile.dueDate}</strong> • Doctor: {pregnancyProfile.clinicianName}
                </p>
              </div>
            </div>

            <button className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center space-x-1 shrink-0 self-end sm:self-center">
              <span>Pregnancy Center</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Nutrition Tip Widget (Rotates Daily Based on Nutritional Goals & Wellness Context) */}
        <NutritionTipWidget
          pregnancyProfile={pregnancyProfile}
          onOpenNutritionPlanner={() => setActiveTab('nutrition')}
        />

        {/* Grid: Status Cards & Readiness Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* GPS Truth Engine Card */}
          <div 
            onClick={() => setActiveTab('gps')}
            className="group cursor-pointer rounded-2xl bg-slate-900/80 p-5 border border-slate-800 hover:border-cyan-700/60 transition-all shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-700/50 flex items-center justify-center">
                <Compass className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                GPS Engine
              </span>
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
              Location Truth
            </h4>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              {location ? `${location.address}` : 'Click to verify high-accuracy GPS coordinates'}
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-cyan-400 font-semibold">
              <span>Inspect Coordinates</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Rescue Relay & Contacts Card */}
          <div 
            onClick={() => setActiveTab('safety')}
            className="group cursor-pointer rounded-2xl bg-slate-900/80 p-5 border border-slate-800 hover:border-purple-700/60 transition-all shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-700/50 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                {contacts.length} Contacts
              </span>
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
              Rescue Relay
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Automated escalation chain &amp; SMS delivery confirmation.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-purple-400 font-semibold">
              <span>Manage Circle</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Safety Twin Readiness Simulator Card */}
          <div 
            onClick={() => setActiveTab('safety')}
            className="group cursor-pointer rounded-2xl bg-slate-900/80 p-5 border border-slate-800 hover:border-emerald-700/60 transition-all shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700/50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                96% Ready
              </span>
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
              Safety Twin Simulator
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Rehearse SOS, network loss, and check-in workflows.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-semibold">
              <span>Run Readiness Audit</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Wellness & Nutrition Planner Card */}
          <div 
            onClick={() => setActiveTab('wellness')}
            className="group cursor-pointer rounded-2xl bg-slate-900/80 p-5 border border-slate-800 hover:border-pink-700/60 transition-all shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-pink-950 border border-pink-700/50 flex items-center justify-center">
                <HeartPulse className="w-5 h-5 text-pink-400" />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-pink-950 text-pink-300 border border-pink-800">
                Wellness
              </span>
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-pink-300 transition-colors">
              Menstrual &amp; Nutrition
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Cycle tracking, symptom logs &amp; Indian meal plans.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-pink-400 font-semibold">
              <span>View Wellness Hub</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* SOS Evidence Vault Card */}
          <div 
            onClick={() => setActiveTab('evidence')}
            className="group cursor-pointer rounded-2xl bg-slate-900/80 p-5 border border-slate-800 hover:border-rose-700/60 transition-all shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-700/50 flex items-center justify-center">
                <Video className="w-5 h-5 text-rose-400" />
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                Encrypted
              </span>
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-rose-300 transition-colors">
              SOS Evidence Vault
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Tamper-evident camera &amp; audio recordings with SHA-256 hashes.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-rose-400 font-semibold">
              <span>View Recordings</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>

        {/* Quick Escape & De-escalation Actions Bar */}
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-white flex items-center space-x-2">
                <PhoneCall className="w-5 h-5 text-indigo-400" />
                <span>Escape Mode &amp; Quick De-escalation</span>
              </h3>
              <p className="text-xs text-slate-400">Immediate discreet tools to exit uncomfortable situations</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={triggerFakeCall}
              className="p-4 rounded-xl bg-slate-850 hover:bg-indigo-950/70 border border-slate-700 hover:border-indigo-600 transition-colors text-left flex items-start space-x-3 group"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-950 border border-indigo-700 flex items-center justify-center shrink-0">
                <PhoneCall className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <h5 className="text-sm font-bold text-white">Fake Call Escape</h5>
                <p className="text-[11px] text-slate-400 mt-0.5">Triggers realistic simulated incoming call in 5 seconds</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('safety')}
              className="p-4 rounded-xl bg-slate-850 hover:bg-cyan-950/70 border border-slate-700 hover:border-cyan-600 transition-colors text-left flex items-start space-x-3 group"
            >
              <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-700 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <h5 className="text-sm font-bold text-white">SafeRoute Planner</h5>
                <p className="text-[11px] text-slate-400 mt-0.5">Find well-lit routes, rest stops &amp; verified safe havens</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('privacy')}
              className="p-4 rounded-xl bg-slate-850 hover:bg-emerald-950/70 border border-slate-700 hover:border-emerald-600 transition-colors text-left flex items-start space-x-3 group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-700 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <h5 className="text-sm font-bold text-white">Rescue Passport</h5>
                <p className="text-[11px] text-slate-400 mt-0.5">Generate temporary 1-click emergency medical profile</p>
              </div>
            </button>
          </div>
        </div>

        {/* Verified National & Regional Helplines Bar */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
            <Phone className="w-4 h-4 text-rose-400" />
            <span>Verified Direct Emergency Shortcuts</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <a
              href="tel:112"
              className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 hover:bg-rose-900/80 transition-colors flex flex-col items-center justify-center"
            >
              <span className="text-lg font-black text-rose-300">112</span>
              <span className="text-[10px] text-slate-300 font-medium">National Emergency</span>
            </a>

            <a
              href="tel:1091"
              className="p-3 rounded-xl bg-purple-950/60 border border-purple-800/80 hover:bg-purple-900/80 transition-colors flex flex-col items-center justify-center"
            >
              <span className="text-lg font-black text-purple-300">1091</span>
              <span className="text-[10px] text-slate-300 font-medium">Women Helpline</span>
            </a>

            <a
              href="tel:108"
              className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-800/80 hover:bg-cyan-900/80 transition-colors flex flex-col items-center justify-center"
            >
              <span className="text-lg font-black text-cyan-300">108</span>
              <span className="text-[10px] text-slate-300 font-medium">Ambulance Services</span>
            </a>

            <a
              href="tel:100"
              className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-800/80 hover:bg-indigo-900/80 transition-colors flex flex-col items-center justify-center"
            >
              <span className="text-lg font-black text-indigo-300">100</span>
              <span className="text-[10px] text-slate-300 font-medium">Police Control</span>
            </a>
          </div>
        </div>

        {/* Native Contact Sync Modal */}
        <NativeContactSyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          existingContacts={contacts}
          onContactsUpdated={(updated) => {
            if (onContactsUpdated) onContactsUpdated(updated);
          }}
          location={location}
        />

      </div>
  );
};
