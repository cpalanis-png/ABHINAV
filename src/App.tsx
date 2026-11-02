import React, { useState, useEffect, useRef } from 'react';
import { LocationData, Contact, PregnancyProfile, SOSDispatchSummary, AuthUser } from './types';
import { auth, onAuthStateChanged, reload } from './firebase';
import { LocationService } from './services/locationService';
import { StorageService } from './services/storage';
import { NativeContactsService } from './services/nativeContactsService';
import { AuthService } from './services/authService';
import { MemoryService } from './services/memoryService';

import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { PermissionGate } from './components/PermissionGate';
import { SafetyHubView } from './components/SafetyHubView';
import { MenstrualWellnessView } from './components/MenstrualWellnessView';
import { PregnancyWellnessView } from './components/PregnancyWellnessView';
import { GPSTruthEngineView } from './components/GPSTruthEngineView';
import { ShieldAIChat } from './components/ShieldAIChat';
import { AIMemoryDashboardView } from './components/AIMemoryDashboardView';
import { PrivacyAndPassportView } from './components/PrivacyAndPassportView';
import { NutritionPlannerView } from './components/NutritionPlannerView';
import { BioscienceHubView } from './components/BioscienceHubView';
import { MediaStudioView } from './components/MediaStudioView';
import { ShieldGuardianGame } from './components/ShieldGuardianGame';
import { SafetySettingsView } from './components/SafetySettingsView';
import { SOSEvidenceHistoryView } from './components/SOSEvidenceHistoryView';
import { DailyUpdatesView } from './components/DailyUpdatesView';
import { WelcomeAuthFlow } from './components/WelcomeAuthFlow';
import { HolographicShieldBackground } from './components/HolographicShieldBackground';
import { PrivateSpaceScannerView } from './components/PrivateSpaceScannerView';
import { sosRecordingService } from './services/sosRecordingService';
import { voiceSosService } from './services/voiceSosService';
import { permissionService } from './services/permissionService';
import { sosAlertService } from './services/sosAlertService';

import {
  ShieldAlert,
  Phone,
  PhoneOff,
  CheckCircle2,
  Mic,
  AlertTriangle,
  Settings,
  UserPlus,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Loader2,
  MapPin
} from 'lucide-react';

export default function App() {
  // Authentication State: Require a verified Firebase email user before opening the SmartShield dashboard
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [unverifiedFirebaseEmail, setUnverifiedFirebaseEmail] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [safetyInitialSubTab, setSafetyInitialSubTab] = useState<'sos' | 'circle' | undefined>(undefined);
  const [autoOpenAddContact, setAutoOpenAddContact] = useState<boolean>(false);

  const [location, setLocation] = useState<LocationData | null>(() => LocationService.getCachedLocation());
  const [locationLoading, setLocationLoading] = useState<boolean>(false);

  // Safety Search Radius (1km, 3km, 5km, 10km, 25km) saved to localStorage via StorageService
  const [safetySearchRadius, setSafetySearchRadius] = useState<number>(() => StorageService.getSafetySearchRadius());

  const [contacts, setContacts] = useState<Contact[]>(() => StorageService.getContacts());
  const [pregnancyProfile, setPregnancyProfile] = useState<PregnancyProfile>(StorageService.getPregnancyProfile());

  // 3D Game Overlay State
  const [isGameOpen, setIsGameOpen] = useState<boolean>(false);

  // Instant SOS Modal State (Zero artificial countdown delay)
  const [sosActive, setSosActive] = useState<boolean>(false);
  const [sosVoiceKeyword, setSosVoiceKeyword] = useState<string | null>(null);
  const [sosDispatchSummary, setSosDispatchSummary] = useState<SOSDispatchSummary | null>(() =>
    sosAlertService.getCurrentSession()
  );

  const contactsRef = useRef<Contact[]>(contacts);
  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  const locationRef = useRef<LocationData | null>(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const sosActiveRef = useRef<boolean>(sosActive);
  useEffect(() => {
    sosActiveRef.current = sosActive;
  }, [sosActive]);

  // SOS Recording Session State
  const [sosRecordingState, setSosRecordingState] = useState(() => sosRecordingService.getState());

  // Fake Call Modal State
  const [fakeCallActive, setFakeCallActive] = useState<boolean>(false);
  const [fakeCallAnswered, setFakeCallAnswered] = useState<boolean>(false);

  // Verify Firebase Authentication state and require a verified email on startup
  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      if (!firebaseUser) {
        AuthService.clearSession();
        setUnverifiedFirebaseEmail(false);
        setCurrentUser(null);
        setAuthChecking(false);
        return;
      }

      try {
        await reload(firebaseUser);
      } catch {}

      if (!mounted) return;

      if (!firebaseUser.emailVerified) {
        // User is signed in to Firebase, but email is NOT verified yet — block dashboard access
        AuthService.clearSession();
        setUnverifiedFirebaseEmail(true);
        setCurrentUser(null);
        setAuthChecking(false);
        return;
      }

      setUnverifiedFirebaseEmail(false);

      try {
        const idToken = await firebaseUser.getIdToken();
        const { user } = await AuthService.completeFirebaseEmailAuth({
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email || '',
          emailVerified: true,
          idToken,
          fullName: firebaseUser.displayName || undefined
        });
        if (mounted) {
          setCurrentUser(user);
          setAuthChecking(false);
        }
      } catch {
        const verifiedSessionUser = await AuthService.verifyActiveSession();
        if (mounted) {
          setCurrentUser(verifiedSessionUser);
          setAuthChecking(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await AuthService.logout();
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // Initialize GPS on load
  const fetchGPSLocation = async () => {
    setLocationLoading(true);
    const loc = await LocationService.getCurrentLocation();
    setLocation(loc);
    setLocationLoading(false);
  };

  /**
   * Executes the Instant SOS sequence immediately without artificial timers or countdowns:
   * 1. Activates visible "SOS ACTIVATED" emergency state.
   * 2. Uses most recent available GPS location immediately while requesting an updated fix in parallel.
   * 3. Immediately starts sending alerts to all saved and valid emergency contacts.
   * 4. Starts SOS camera/audio evidence recording in parallel (non-blocking).
   */
  const executeInstantSOS = (voiceKeyword: string | null = null) => {
    // Trigger Vibration API for immediate physical haptic feedback on device
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {
        console.warn('Vibration API error:', e);
      }
    }

    const latestContacts = StorageService.getContacts();
    setContacts(latestContacts);

    const immediateLoc = locationRef.current || LocationService.getCachedLocation();
    setSosVoiceKeyword(voiceKeyword);
    setSosActive(true);

    const incidentId = `sos-${Date.now()}`;
    // Start SOS Camera & Audio recording in background (non-blocking)
    if (!sosRecordingService.getState().isRecording) {
      sosRecordingService.startRecording(immediateLoc, incidentId);
    }

    // Immediately dispatch alerts to all saved contacts (or report no_contacts state)
    sosAlertService.dispatchInstantSOS(latestContacts, immediateLoc);

    // Record SOS Incident in StorageService
    const hasUsableCoords = LocationService.isUsableLocation(immediateLoc);
    StorageService.addIncident({
      id: incidentId,
      timestamp: new Date().toISOString(),
      location: hasUsableCoords ? immediateLoc : null,
      status: 'active',
      notifiedContactsCount: latestContacts.length,
      relayEvents: [
        {
          timestamp: new Date().toLocaleTimeString(),
          description:
            latestContacts.length === 0
              ? 'SOS activated with 0 saved emergency contacts.'
              : hasUsableCoords && immediateLoc
                ? `Instant SOS alert initiated for ${latestContacts.length} saved contact(s) with coordinates (${immediateLoc.latitude.toFixed(5)}, ${immediateLoc.longitude.toFixed(5)}).`
                : `Instant SOS alert initiated for ${latestContacts.length} saved contact(s) (GPS signal pending — requesting parallel fix).`,
          status: 'sent'
        }
      ]
    });

    // Request an updated GPS location in parallel; if coordinates arrive, update the active SOS alert
    LocationService.getCurrentLocation(4500)
      .then((freshLoc) => {
        setLocation(freshLoc);
        if (LocationService.isUsableLocation(freshLoc)) {
          sosAlertService.updateLocationForActiveSOS(contactsRef.current, freshLoc);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!currentUser) return;

    fetchGPSLocation();
    StorageService.syncUserDataFromServer(currentUser.id).then(() => {
      setContacts(StorageService.getContacts());
      setPregnancyProfile(StorageService.getPregnancyProfile());
    });
    // Load the authenticated user's encrypted Personal AI Memory store
    MemoryService.fetchMemoryStore().catch(() => {});

    const handleRefreshGPS = () => fetchGPSLocation();
    window.addEventListener('refreshGPS', handleRefreshGPS);

    // Subscribe to SOS audio/video recording state changes
    const unsubRecording = sosRecordingService.subscribe((state) => {
      setSosRecordingState(state);
    });

    // Subscribe to real-time per-contact SOS alert status updates
    const unsubSosAlert = sosAlertService.subscribe((summary) => {
      setSosDispatchSummary(summary);
    });

    // Register Web Speech API Voice-Activated SOS Trigger ("Smart Shield Help")
    voiceSosService.setTriggerCallback((detectedPhrase) => {
      executeInstantSOS(detectedPhrase);
    });

    // Hardware Wearable SOS Polling (ESP32-C3 + SIM800L trigger listener)
    const hardwarePollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/hardware/sos/status');
        if (res.ok) {
          const data = await res.json();
          if (data.active && data.lastEvent?.timestamp) {
            const eventAge = Date.now() - new Date(data.lastEvent.timestamp).getTime();
            if (eventAge < 35000 && !sosActiveRef.current) {
              executeInstantSOS('Hardware Wearable Button');
            }
          }
        }
      } catch {}
    }, 12000);

    return () => {
      window.removeEventListener('refreshGPS', handleRefreshGPS);
      unsubRecording();
      unsubSosAlert();
      voiceSosService.setTriggerCallback(null);
      clearInterval(hardwarePollInterval);
    };
  }, [currentUser]);

  const triggerSOS = () => {
    executeInstantSOS(null);
  };

  const closeSOSModal = () => {
    if (sosRecordingState.isRecording) {
      sosRecordingService.stopRecording('completed');
    }
    setSosActive(false);
    setSosVoiceKeyword(null);
  };

  const handleCancelAccidentalSOS = async () => {
    if (sosRecordingState.isRecording) {
      sosRecordingService.stopRecording('completed');
    }
    const currentLoc = locationRef.current || LocationService.getCachedLocation();
    await sosAlertService.cancelActiveSOS(contacts, 'Accidental activation');

    StorageService.addIncident({
      id: `sos-cancel-${Date.now()}`,
      timestamp: new Date().toISOString(),
      location: LocationService.isUsableLocation(currentLoc) ? currentLoc : null,
      status: 'cancelled',
      cancellationReason: 'User cancelled accidental SOS trigger',
      notifiedContactsCount: contacts.length,
      relayEvents: [
        {
          timestamp: new Date().toLocaleTimeString(),
          description: 'Emergency SOS cancelled by user. Stand-down notice recorded and broadcast.',
          status: 'sent'
        }
      ]
    });
  };

  const handleOpenAddContactFromSOS = () => {
    if (sosRecordingState.isRecording) {
      sosRecordingService.stopRecording('completed');
    }
    setSosActive(false);
    setSosVoiceKeyword(null);
    setSafetyInitialSubTab('circle');
    setAutoOpenAddContact(true);
    setActiveTab('safety');
  };

  const triggerFakeCall = () => {
    setFakeCallActive(true);
    setFakeCallAnswered(false);
  };

  const hasValidSOSLocation = LocationService.isUsableLocation(location);
  const sosAgeSeconds =
    hasValidSOSLocation && location ? Math.max(0, Math.round((Date.now() - location.timestamp) / 1000)) : 0;
  const fakeCallerContact = contacts.find((c) => c.isPrimary) || contacts[0] || null;

  // Show lightweight verification spinner only if no cached session is immediately known while checking
  if (authChecking && !currentUser) {
    return (
      <div className="min-h-screen bg-[#080C1D] text-slate-100 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-pink-400 animate-spin mb-3" />
        <p className="text-xs font-semibold text-purple-200 tracking-wide">
          Verifying Smart Shield Session...
        </p>
      </div>
    );
  }

  // First-time, logged-out, or unverified-email users see the Welcome Page & Authentication Flow
  if (!currentUser) {
    return (
      <div className="relative min-h-screen bg-[#050816] text-slate-100 font-sans selection:bg-purple-600 selection:text-white">
        <HolographicShieldBackground activeTab="welcome" isSosEmergencyActive={sosActive} />
        <div className="relative z-10">
          <WelcomeAuthFlow
            initialScreen={unverifiedFirebaseEmail ? 'verify_email' : 'welcome'}
            onAuthenticated={(user) => {
              setUnverifiedFirebaseEmail(false);
              setCurrentUser(user);
              StorageService.syncUserDataFromServer(user.id).then(() => {
                setContacts(StorageService.getContacts());
                setPregnancyProfile(StorageService.getPregnancyProfile());
              });
              MemoryService.fetchMemoryStore().catch(() => {});
              setActiveTab('dashboard');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white overflow-x-hidden">
      {/* 3D Game Full-Viewport Shell (when active) */}
      {isGameOpen && (
        <ShieldGuardianGame onCloseGame={() => setIsGameOpen(false)} />
      )}

      {/* Main UI Container above z-0 3D canvas */}
      <div className="relative z-10 flex flex-col flex-1 min-h-screen">

      {/* Top Sticky Header Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        location={location}
        triggerSOS={triggerSOS}
        pregnancyActive={pregnancyProfile.active}
        onOpenGame={() => setIsGameOpen(true)}
        safetySearchRadius={safetySearchRadius}
        contactsCount={contacts.length}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Sticky Active Recording Banner (when recording in background outside the SOS modal) */}
      {sosRecordingState.isRecording && !sosActive && (
        <div className="sticky top-16 z-30 bg-rose-950/95 border-b-2 border-rose-600 px-4 py-2.5 shadow-2xl backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-black text-rose-200 uppercase tracking-wider">
              SOS EVIDENCE RECORDING ACTIVE:
            </span>
            <span className="font-mono text-xs font-bold text-white">
              {Math.floor(sosRecordingState.elapsedSeconds / 60).toString().padStart(2, '0')}:
              {(sosRecordingState.elapsedSeconds % 60).toString().padStart(2, '0')}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-900 border border-rose-700 font-extrabold uppercase text-rose-300">
              {sosRecordingState.mediaType === 'video' ? 'Camera + Audio' : 'Audio Only'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                sosRecordingService.stopRecording('completed');
                setActiveTab('evidence');
              }}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow"
            >
              View in Vault
            </button>
            <button
              onClick={() => sosRecordingService.stopRecording('completed')}
              className="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 text-rose-950 font-black text-xs shadow"
            >
              Stop Recording
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-12">
        {activeTab === 'dashboard' && (
          <PermissionGate
            activeTab={activeTab}
            location={location}
            onLocationUpdated={(updatedLoc) => setLocation(updatedLoc)}
            triggerSOS={triggerSOS}
          >
            <DashboardView
              location={location}
              refreshLocation={fetchGPSLocation}
              triggerSOS={triggerSOS}
              pregnancyProfile={pregnancyProfile}
              contacts={contacts}
              setActiveTab={setActiveTab}
              triggerFakeCall={triggerFakeCall}
              onContactsUpdated={(updated) => setContacts(updated)}
            />
          </PermissionGate>
        )}

        {(activeTab === 'safety' || activeTab === 'contacts') && (
          <SafetyHubView
            location={location}
            contacts={contacts}
            setContacts={setContacts}
            triggerSOS={triggerSOS}
            triggerFakeCall={triggerFakeCall}
            safetySearchRadius={safetySearchRadius}
            onOpenSafetySettings={() => setActiveTab('settings')}
            initialSubTab={activeTab === 'contacts' ? 'circle' : safetyInitialSubTab}
            autoOpenAddContact={autoOpenAddContact}
            onClearAutoOpenAddContact={() => {
              setAutoOpenAddContact(false);
              setSafetyInitialSubTab(undefined);
            }}
          />
        )}

        {activeTab === 'wellness' && (
          <div className="space-y-8">
            {pregnancyProfile.active ? (
              <PregnancyWellnessView
                pregnancyProfile={pregnancyProfile}
                setPregnancyProfile={(p) => {
                  setPregnancyProfile(p);
                  StorageService.savePregnancyProfile(p);
                }}
                setActiveTab={setActiveTab}
              />
            ) : (
              <MenstrualWellnessView
                pregnancyActive={pregnancyProfile.active}
                setPregnancyActive={(active) => {
                  const updated = { ...pregnancyProfile, active };
                  setPregnancyProfile(updated);
                  StorageService.savePregnancyProfile(updated);
                }}
              />
            )}

            <NutritionPlannerView pregnancyActive={pregnancyProfile.active} />
          </div>
        )}

        {activeTab === 'nutrition' && (
          <NutritionPlannerView pregnancyActive={pregnancyProfile.active} />
        )}

        {activeTab === 'bioscience' && (
          <BioscienceHubView />
        )}

        {activeTab === 'studio' && (
          <MediaStudioView />
        )}

        {activeTab === 'gps' && (
          <GPSTruthEngineView
            location={location}
            refreshLocation={fetchGPSLocation}
            onLocationUpdated={(updatedLoc) => setLocation(updatedLoc)}
            loading={locationLoading}
            safetySearchRadius={safetySearchRadius}
          />
        )}

        {(activeTab === 'daily_updates' || activeTab === 'updates') && (
          <DailyUpdatesView />
        )}

        {activeTab === 'ai' && (
          <ShieldAIChat
            location={location}
            pregnancyActive={pregnancyProfile.active}
            triggerSOS={triggerSOS}
            triggerFakeCall={triggerFakeCall}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'memory' && (
          <AIMemoryDashboardView
            onOpenChat={() => setActiveTab('ai')}
          />
        )}

        {activeTab === 'privacy' && (
          <PrivacyAndPassportView
            location={location}
            contacts={contacts}
          />
        )}

        {activeTab === 'settings' && (
          <SafetySettingsView
            location={location}
            currentRadius={safetySearchRadius}
            onRadiusChange={(r) => {
              setSafetySearchRadius(r);
              StorageService.saveSafetySearchRadius(r);
            }}
            setActiveTab={setActiveTab}
            contacts={contacts}
            onContactsUpdated={(updated) => setContacts(updated)}
          />
        )}

        {activeTab === 'evidence' && (
          <SOSEvidenceHistoryView
            location={location}
            triggerSOS={triggerSOS}
          />
        )}

        {activeTab === 'scanner' && (
          <PrivateSpaceScannerView />
        )}

      </main>

      {/* Mobile Accessible Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pregnancyActive={pregnancyProfile.active}
      />

      {/* INSTANT EMERGENCY SOS ACTIVATED MODAL (ZERO COUNTDOWN DELAY) */}
      {sosActive && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="instant-sos-modal"
          className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-slate-900 rounded-3xl border-2 border-rose-600 p-5 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl my-auto">
            {/* Top Status Header — Immediately Shows SOS ACTIVATED */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border-2 border-rose-500 flex items-center justify-center animate-pulse shrink-0">
                  <ShieldAlert className="w-7 h-7 text-rose-500" />
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-2">
                    <span
                      data-testid="sos-activated-badge"
                      className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-black uppercase tracking-wider"
                    >
                      SOS ACTIVATED
                    </span>
                    {sosVoiceKeyword && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500 text-cyan-200 text-[10px] font-bold">
                        <Mic className="w-3 h-3 text-cyan-400" />
                        <span>&ldquo;{sosVoiceKeyword}&rdquo;</span>
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black text-white mt-1">
                    Immediate Emergency Response
                  </h2>
                </div>
              </div>

              <a
                href="tel:112"
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center space-x-1.5 shadow-lg shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call 112</span>
              </a>
            </div>

            {/* CASE 1: NO SAVED EMERGENCY CONTACTS */}
            {contacts.length === 0 ? (
              <div
                data-testid="sos-no-contacts-warning"
                className="p-5 rounded-2xl bg-amber-950/70 border-2 border-amber-500 text-left space-y-3"
              >
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-white">
                      Add an emergency contact before using contact-based SOS alerts
                    </h3>
                    <p className="text-xs text-amber-200 leading-relaxed">
                      You currently have 0 saved emergency contacts. Smart Shield never sends alerts to random or fake numbers. Add a trusted contact now, or use the direct emergency helplines below.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddContactFromSOS}
                  data-testid="sos-add-contact-shortcut-btn"
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Open Emergency Contacts &amp; Add Contact</span>
                </button>
              </div>
            ) : (
              /* CASE 2: SAVED CONTACTS PRESENT — SHOW IMMEDIATE PER-CONTACT ALERT STATUS */
              <div className="space-y-3 text-left" data-testid="sos-contacts-dispatch-panel">
                {/* Software-Only Action Callout Banner */}
                <div className="p-3.5 rounded-xl bg-amber-950/80 border-2 border-amber-500/80 text-left space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-black text-amber-300">
                    <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>ACTION REQUIRED: Press "SEND" in SMS App</span>
                  </div>
                  <p className="text-[11px] text-amber-100/90 leading-relaxed">
                    Smart Shield has launched your device messaging application with your emergency alert and recipient contacts prefilled. <strong>Please press "SEND" inside your SMS app</strong> to dispatch the emergency messages.
                  </p>
                  <button
                    type="button"
                    onClick={() => sosAlertService.openSmsAppForAllContacts(contacts, location)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-md cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Re-Open Messaging App for All Contacts</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span data-testid="sos-overall-summary-text">
                      {sosDispatchSummary?.overallSummaryText ||
                        `Messaging app opened for ${contacts.length} saved contact(s). Press Send in SMS app.`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      sosAlertService.dispatchInstantSOS(contacts, location, { forceRetry: true })
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center space-x-1 shrink-0 cursor-pointer"
                    title="Retry launching SMS app"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Re-Open</span>
                  </button>
                </div>

                {/* Per-Contact Status List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {(sosDispatchSummary?.contactStatuses || []).map((cs) => {
                    const statusBadgeTone =
                      cs.status === 'sms_composer_opened' || cs.status === 'submitted' || cs.status === 'delivered'
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-600'
                        : cs.status === 'cancelled'
                          ? 'bg-slate-800 text-slate-300 border-slate-600'
                          : 'bg-rose-950 text-rose-300 border-rose-700';

                    return (
                      <div
                        key={cs.contactId}
                        data-testid={`sos-contact-status-${cs.contactId}`}
                        className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-extrabold text-white">
                              {cs.contactName}
                            </span>
                            <span className="text-[11px] font-mono text-cyan-300">{cs.phone}</span>
                            {cs.relationship && (
                              <span className="text-[10px] text-slate-400">({cs.relationship})</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center space-x-1 ${statusBadgeTone}`}
                            >
                              <span>{cs.statusLabel}</span>
                            </span>
                          </div>
                          {cs.errorReason && (
                            <p className="text-[10px] text-rose-300/90 leading-tight">
                              {cs.errorReason}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const targetContact: Contact = contacts.find((c) => c.id === cs.contactId) || {
                                id: cs.contactId,
                                name: cs.contactName,
                                phone: cs.phone,
                                relationship: cs.relationship || 'Emergency Contact',
                                isPrimary: false,
                                isBackupRelay: false,
                                canSeeLocation: true,
                                canSeePregnancyUpdates: false
                              };
                              sosAlertService.openSmsAppForContact(targetContact, location);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center space-x-1 shadow cursor-pointer"
                            title="Open messaging app prefilled for this contact"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>SMS App</span>
                          </button>

                          <a
                            href={NativeContactsService.getDirectCallUrl(cs.phone)}
                            data-testid={`sos-call-${cs.contactId}`}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center space-x-1 shadow"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Generated Emergency Message & Live GPS Status */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Emergency SOS Message Payload
                </span>
                {hasValidSOSLocation && location ? (
                  <a
                    href={`https://maps.google.com/?q=${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center space-x-1"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Google Maps Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400">
                    GPS Fix Pending (Sent without waiting)
                  </span>
                )}
              </div>
              <p
                data-testid="sos-emergency-message-preview"
                className="text-[11px] font-mono text-slate-200 bg-slate-900 p-2.5 rounded-lg border border-slate-800 break-words leading-relaxed"
              >
                {sosDispatchSummary?.messageBody ||
                  NativeContactsService.buildEmergencySmsBody(null, location)}
              </p>
              {hasValidSOSLocation && location && (
                <p className="text-[11px] text-slate-400">
                  Coordinates:{' '}
                  <span className="text-cyan-300 font-mono font-bold">
                    {location.latitude.toFixed(5)}°, {location.longitude.toFixed(5)}° (±
                    {location.accuracy}m,{' '}
                    {location.status === 'stale' ? `${sosAgeSeconds}s old` : 'Fresh GPS'})
                  </span>
                </p>
              )}
            </div>

            {/* Live SOS Evidence Recording Panel */}
            {sosRecordingState.isRecording && (
              <div className="p-3.5 rounded-xl bg-rose-950/90 border border-rose-600 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      Evidence Recording Active
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-900 text-rose-200 border border-rose-700 uppercase">
                    {sosRecordingState.mediaType === 'video' ? 'Camera + Audio' : 'Audio Only'}
                  </span>
                </div>
                <p className="text-xs text-rose-200">
                  Duration:{' '}
                  <span className="font-mono font-bold text-white">
                    {Math.floor(sosRecordingState.elapsedSeconds / 60).toString().padStart(2, '0')}:
                    {(sosRecordingState.elapsedSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </p>
              </div>
            )}

            {/* Honest Error Reporting if Camera & Microphone Were Denied */}
            {!sosRecordingState.isRecording &&
              sosRecordingState.status === 'error' &&
              sosRecordingState.error && (
                <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-700 text-left space-y-2">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200 space-y-0.5">
                      <div className="font-bold text-white">Evidence Recording Unavailable</div>
                      <p className="text-[11px] text-slate-300">{sosRecordingState.error}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => permissionService.openAppSettings()}
                    className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Open Android App Settings</span>
                  </button>
                </div>
              )}

            {/* Direct National Emergency Helplines */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <a
                href="tel:112"
                className="py-2 px-2 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 font-black text-xs hover:bg-rose-900"
              >
                112 Emergency
              </a>
              <a
                href="tel:1091"
                className="py-2 px-2 rounded-xl bg-purple-950/80 border border-purple-700 text-purple-200 font-black text-xs hover:bg-purple-900"
              >
                1091 Helpline
              </a>
              <a
                href="tel:108"
                className="py-2 px-2 rounded-xl bg-cyan-950/80 border border-cyan-700 text-cyan-200 font-black text-xs hover:bg-cyan-900"
              >
                108 Ambulance
              </a>
            </div>

            {/* Cancel Accidental SOS (Stand-Down Broadcast) */}
            <button
              type="button"
              onClick={handleCancelAccidentalSOS}
              data-testid="cancel-accidental-sos-btn"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-slate-950" />
              <span>Cancel Accidental SOS (Send Stand-Down Notice)</span>
            </button>

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (sosRecordingState.isRecording) {
                    sosRecordingService.stopRecording('completed');
                  }
                  closeSOSModal();
                  setActiveTab('evidence');
                }}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
              >
                Open Evidence Vault
              </button>
              <button
                type="button"
                onClick={closeSOSModal}
                data-testid="close-sos-modal-btn"
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                End SOS / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAKE CALL ESCAPE MODAL */}
      {fakeCallActive && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-between p-8 text-center">
          <div className="space-y-2 mt-12">
            <div className="w-24 h-24 mx-auto rounded-full bg-slate-800 border-2 border-indigo-500 flex items-center justify-center text-3xl font-bold text-indigo-300 shadow-2xl">
              {fakeCallerContact ? fakeCallerContact.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <h2 className="text-2xl font-black text-white mt-4">
              {fakeCallerContact ? fakeCallerContact.name : 'Emergency Check-In'}
            </h2>
            <p className="text-sm text-indigo-400 font-semibold animate-pulse">
              {fakeCallAnswered ? '00:14 • Connected' : 'Incoming Mobile Call...'}
            </p>
          </div>

          {!fakeCallAnswered ? (
            <div className="w-full max-w-xs flex items-center justify-around mb-12">
              <button
                onClick={() => setFakeCallActive(false)}
                className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg"
              >
                <PhoneOff className="w-7 h-7" />
              </button>

              <button
                onClick={() => setFakeCallAnswered(true)}
                className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg animate-bounce"
              >
                <Phone className="w-7 h-7" />
              </button>
            </div>
          ) : (
            <div className="w-full max-w-xs space-y-4 mb-12">
              <p className="text-xs text-slate-300 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                "Hey! I am outside in the car waiting for you, come out right now!"
              </p>
              <button
                onClick={() => setFakeCallActive(false)}
                className="w-full py-4 rounded-2xl bg-rose-600 text-white font-bold text-sm"
              >
                End Call &amp; Exit Escape Mode
              </button>
            </div>
          )}
        </div>
      )}

      </div>
    </div>
  );
}
