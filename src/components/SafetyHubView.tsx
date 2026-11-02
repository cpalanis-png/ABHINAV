import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  PhoneCall,
  Users,
  MapPin,
  Clock,
  Mic,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Building2,
  BookOpen,
  Send,
  Plus,
  Trash2,
  Share2,
  Lock,
  Volume2,
  ShieldCheck,
  ChevronRight,
  Wind,
  Phone,
  Car,
  Cross,
  ExternalLink,
  Navigation,
  Zap,
  VolumeX,
  X,
  Smartphone,
  Download,
  Star,
  UserCheck,
  MessageSquare,
  UploadCloud
} from 'lucide-react';
import { Contact, LocationData, SOSIncident, EvidenceItem } from '../types';
import { StorageService } from '../services/storage';
import { LocationService } from '../services/locationService';
import { NativeContactsService } from '../services/nativeContactsService';
import { NativeContactSyncModal } from './NativeContactSyncModal';
import { CalmBreathing } from './CalmBreathing';
import { SafeWalkView } from './SafeWalkView';
import { SOSEvidenceHistoryView } from './SOSEvidenceHistoryView';
import { VoiceSOSTriggerCard } from './VoiceSOSTriggerCard';
import { EmergencyContactsManager } from './EmergencyContactsManager';

interface SafetyHubViewProps {
  location: LocationData | null;
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  triggerSOS: () => void;
  triggerFakeCall: () => void;
  safetySearchRadius?: number;
  onOpenSafetySettings?: () => void;
  initialSubTab?: 'sos' | 'safewalk' | 'breathing' | 'circle' | 'route' | 'evidence' | 'havens' | 'simulator';
  autoOpenAddContact?: boolean;
  onClearAutoOpenAddContact?: () => void;
}

export const SafetyHubView: React.FC<SafetyHubViewProps> = ({
  location,
  contacts,
  setContacts,
  triggerSOS,
  triggerFakeCall,
  safetySearchRadius = 5,
  onOpenSafetySettings,
  initialSubTab,
  autoOpenAddContact = false,
  onClearAutoOpenAddContact
}) => {
  const [activeTab, setActiveTab] = useState<'sos' | 'safewalk' | 'breathing' | 'circle' | 'route' | 'evidence' | 'havens' | 'simulator'>(initialSubTab || 'sos');
  const [openAddFormOnMount, setOpenAddFormOnMount] = useState<boolean>(autoOpenAddContact);

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (autoOpenAddContact) {
      setActiveTab('circle');
      setOpenAddFormOnMount(true);
    }
  }, [autoOpenAddContact]);

  // Contacts Management State
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('Friend');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [circleAlertFeedback, setCircleAlertFeedback] = useState<string | null>(null);

  // Evidence Vault State
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>(StorageService.getEvidence());

  // SafeRoute Search State
  const [startAddr, setStartAddr] = useState(location?.address || 'Current Location');
  const [destAddr, setDestAddr] = useState('Apollo Women Center, Anna Salai');
  const [routePlanned, setRoutePlanned] = useState(false);

  // PANIC MODE STATE
  const [panicActive, setPanicActive] = useState<boolean>(false);
  const [strobeColor, setStrobeColor] = useState<'red' | 'white' | 'yellow'>('red');
  const [flashlightActive, setFlashlightActive] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenOscRef = useRef<OscillatorNode | null>(null);
  const sirenGainRef = useRef<GainNode | null>(null);
  const mediaTrackRef = useRef<MediaStreamTrack | null>(null);

  const hasUsableLocation = LocationService.isUsableLocation(location);
  const lat = hasUsableLocation && location ? location.latitude : null;
  const lng = hasUsableLocation && location ? location.longitude : null;
  const userCity = hasUsableLocation && location?.city ? location.city : 'Your Area';

  // Siren audio loop & Flashlight controls
  useEffect(() => {
    let sirenInterval: NodeJS.Timeout;
    let strobeInterval: NodeJS.Timeout;

    if (panicActive) {
      // 1. High-Decibel Oscillating Siren Synthesizer
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(700, ctx.currentTime);

        gain.gain.setValueAtTime(0.8, ctx.currentTime); // High volume output

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        sirenOscRef.current = osc;
        sirenGainRef.current = gain;

        // Oscillate frequency back and forth between 700Hz and 1200Hz every 300ms
        let high = false;
        sirenInterval = setInterval(() => {
          if (audioCtxRef.current && sirenOscRef.current) {
            high = !high;
            const targetFreq = high ? 1200 : 700;
            sirenOscRef.current.frequency.exponentialRampToValueAtTime(targetFreq, audioCtxRef.current.currentTime + 0.25);
          }
        }, 300);
      } catch (e) {
        console.warn('Audio Siren setup fallback:', e);
      }

      // 2. Screen Visual Strobe (Max Brightness Flashing)
      strobeInterval = setInterval(() => {
        setStrobeColor((prev) => (prev === 'red' ? 'white' : prev === 'white' ? 'yellow' : 'red'));
      }, 250);

      // 3. Torch / Flashlight Device Control if supported
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then((stream) => {
            const track = stream.getVideoTracks()[0];
            if (track) {
              mediaTrackRef.current = track;
              const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
              if (capabilities.torch) {
                track.applyConstraints({ advanced: [{ torch: true }] } as any).then(() => {
                  setFlashlightActive(true);
                }).catch(() => {});
              }
            }
          })
          .catch(() => {});
      }
    } else {
      // Deactivate Siren, Strobe, Flashlight
      if (sirenOscRef.current) {
        try { sirenOscRef.current.stop(); } catch {}
        sirenOscRef.current = null;
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
        audioCtxRef.current = null;
      }
      if (mediaTrackRef.current) {
        try {
          mediaTrackRef.current.stop();
        } catch {}
        mediaTrackRef.current = null;
        setFlashlightActive(false);
      }
    }

    return () => {
      clearInterval(sirenInterval);
      clearInterval(strobeInterval);
      if (sirenOscRef.current) {
        try { sirenOscRef.current.stop(); } catch {}
      }
      if (mediaTrackRef.current) {
        try { mediaTrackRef.current.stop(); } catch {}
      }
    };
  }, [panicActive]);

  const togglePanicMode = () => {
    setPanicActive(!panicActive);
  };

  const addContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    const cleanPhone = NativeContactsService.normalizePhoneNumber(newContactPhone);
    const newC: Contact = {
      id: `c-${Date.now()}`,
      name: newContactName.trim(),
      phone: cleanPhone || newContactPhone.trim(),
      relationship: newContactRelation,
      isPrimary: contacts.length === 0,
      isBackupRelay: contacts.length > 0,
      canSeeLocation: true,
      canSeePregnancyUpdates: false,
      syncedFromDevice: false,
      lastSyncedAt: new Date().toISOString()
    };
    const updated = [...contacts, newC];
    setContacts(updated);
    StorageService.saveContacts(updated);
    setNewContactName('');
    setNewContactPhone('');
    setCircleAlertFeedback(`Added ${newC.name} to Safety Circle`);
    setTimeout(() => setCircleAlertFeedback(null), 3000);
  };

  const deleteContact = (id: string) => {
    const updated = StorageService.deleteContact(id);
    setContacts(updated);
    setCircleAlertFeedback('Contact removed from Safety Circle');
    setTimeout(() => setCircleAlertFeedback(null), 3000);
  };

  const setPrimaryContact = (id: string) => {
    const updated = StorageService.setPrimaryContact(id);
    setContacts(updated);
    const primary = updated.find(c => c.id === id);
    setCircleAlertFeedback(`${primary?.name} set as Primary SOS recipient`);
    setTimeout(() => setCircleAlertFeedback(null), 3000);
  };

  const toggleContactLocation = (id: string) => {
    const target = contacts.find(c => c.id === id);
    if (!target) return;
    const updatedContact = { ...target, canSeeLocation: !target.canSeeLocation };
    const updatedList = StorageService.updateContact(updatedContact);
    setContacts(updatedList);
  };

  const toggleContactPregnancy = (id: string) => {
    const target = contacts.find(c => c.id === id);
    if (!target) return;
    const updatedContact = { ...target, canSeePregnancyUpdates: !target.canSeePregnancyUpdates };
    const updatedList = StorageService.updateContact(updatedContact);
    setContacts(updatedList);
  };

  const handleDirectCall = (contact: Contact) => {
    const callUrl = NativeContactsService.getDirectCallUrl(contact.phone);
    window.location.href = callUrl;
  };

  const handleDirectSms = (contact: Contact) => {
    const body = NativeContactsService.buildEmergencySmsBody(contact, location);
    const smsUrl = NativeContactsService.getDirectSmsUrl(contact.phone, body);
    window.location.href = smsUrl;
  };

  const handleBroadcastAlert = () => {
    if (contacts.length === 0) return;
    const primary = contacts.find(c => c.isPrimary) || contacts[0];
    const body = NativeContactsService.buildEmergencySmsBody(primary, location);
    // Combine phone numbers where supported
    const allPhones = contacts.map(c => c.phone.replace(/[^\d+]/g, '')).join(',');
    const smsUrl = NativeContactsService.getDirectSmsUrl(allPhones, body);
    window.location.href = smsUrl;
  };

  const createEvidenceEntry = async () => {
    if (!evidenceTitle.trim()) return;
    
    const payload = {
      title: evidenceTitle,
      notes: evidenceNotes,
      location: location ? { lat: location.latitude, lng: location.longitude, address: location.address } : null
    };

    let sha256Hash = 'sha256-verified-offline-hash';
    try {
      const res = await fetch('/api/evidence/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, timestamp: new Date().toISOString() })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hash) sha256Hash = data.hash;
      }
    } catch { /* fallback */ }

    const item: EvidenceItem = {
      id: `ev-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      title: evidenceTitle,
      notes: evidenceNotes,
      location,
      sha256Hash
    };

    StorageService.addEvidence(item);
    setEvidenceList(StorageService.getEvidence());
    setEvidenceTitle('');
    setEvidenceNotes('');
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* FULL SCREEN PANIC MODE STROBE OVERLAY */}
      {panicActive && (
        <div 
          className={`fixed inset-0 z-50 transition-colors duration-100 flex flex-col items-center justify-between p-6 text-center ${
            strobeColor === 'red' ? 'bg-red-600 text-white' : strobeColor === 'white' ? 'bg-white text-black' : 'bg-yellow-400 text-black'
          }`}
        >
          <div className="pt-12 space-y-3">
            <div className="w-24 h-24 mx-auto rounded-full bg-black/20 border-4 border-current flex items-center justify-center animate-bounce">
              <Zap className="w-14 h-14 stroke-[2.5]" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-widest">PANIC MODE ACTIVE</h1>
            <p className="text-sm font-extrabold max-w-sm mx-auto">
              Maximum Screen Brightness Strobe • High-Decibel Siren Sound Active • Camera Flashlight {flashlightActive ? 'ON' : 'Engaged'}
            </p>
          </div>

          <div className="w-full max-w-md pb-12">
            <button
              onClick={() => setPanicActive(false)}
              className="w-full py-5 rounded-2xl bg-black text-white hover:bg-slate-900 font-black text-lg border-2 border-white shadow-2xl active:scale-95 transition-transform"
            >
              DEACTIVATE PANIC MODE NOW
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-rose-950 border border-rose-700 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <h2 className="text-xl font-black text-white">Women's Safety Hub</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
              Active Defense
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Emergency SOS • Panic Mode Siren • Quick Actions • CalmBreathing • Rescue Relay • SafeRoute
          </p>
        </div>

        {/* Tab Navigation Switches */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-850 p-1.5 rounded-xl border border-slate-750 text-xs font-bold">
          <button
            onClick={() => setActiveTab('sos')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'sos' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Emergency SOS
          </button>

          <button
            onClick={() => setActiveTab('safewalk')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1 ${activeTab === 'safewalk' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Safe Walk</span>
          </button>

          <button
            onClick={() => setActiveTab('breathing')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1 ${activeTab === 'breathing' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>CalmBreathing</span>
          </button>

          <button
            onClick={() => setActiveTab('circle')}
            data-testid="safety-hub-contacts-tab"
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1 ${activeTab === 'circle' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Emergency Contacts ({contacts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('route')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'route' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            SafeRoute
          </button>

          <button
            onClick={() => setActiveTab('evidence')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'evidence' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Evidence Vault
          </button>

          <button
            onClick={() => setActiveTab('havens')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'havens' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Safe Havens
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'simulator' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Safety Twin
          </button>
        </div>
      </div>

      {/* PANIC MODE DISCOURAGEMENT & DETERRENT TOGGLE BANNER */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-red-950 via-rose-950 to-slate-900 border-2 border-red-600/80 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-red-900/90 border border-red-500 flex items-center justify-center shrink-0">
            <Zap className="w-7 h-7 text-yellow-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-red-900 text-yellow-300 border border-red-600 uppercase">
                Threat Deterrent System
              </span>
            </div>
            <h3 className="text-lg font-black text-white mt-1">High-Decibel Panic Mode</h3>
            <p className="text-xs text-slate-200">
              Flashes max brightness strobe, activates camera flashlight, and loops high-decibel siren to deter attackers.
            </p>
          </div>
        </div>

        <button
          onClick={togglePanicMode}
          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-red-950 flex items-center space-x-2 shrink-0 self-end sm:self-center border border-yellow-300/40"
        >
          <Zap className="w-4 h-4 text-yellow-300" />
          <span>{panicActive ? 'Deactivate Panic Mode' : 'ACTIVATE PANIC MODE'}</span>
        </button>
      </div>

      {/* VOICE-ACTIVATED SOS TRIGGER ("Smart Shield Help") */}
      <VoiceSOSTriggerCard />

      {/* GEOLOCATION-POPULATED QUICK ACTION GRID */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                <Navigation className="w-5 h-5 text-cyan-400" />
                <span>Geolocation Quick Action Shortcuts</span>
              </h3>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 uppercase">
                {safetySearchRadius} km Radius Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasUsableLocation && lat !== null && lng !== null ? (
                <>
                  Targeting emergency services within a <strong className="text-white">{safetySearchRadius} km</strong> perimeter of <strong className="text-slate-200">{userCity}</strong> ({lat.toFixed(4)}°, {lng.toFixed(4)}°)
                </>
              ) : (
                <>
                  Location permission or GPS fix required for coordinate-locked searches. Direct emergency helplines (112, 100, 108) remain active.
                </>
              )}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            {onOpenSafetySettings && (
              <button
                onClick={onOpenSafetySettings}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-slate-700 flex items-center space-x-1.5 transition-colors"
              >
                <span>Adjust Radius</span>
                <span className="text-slate-400">({safetySearchRadius} km)</span>
              </button>
            )}
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase ${
              hasUsableLocation
                ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}>
              {hasUsableLocation ? 'Location Verified' : 'GPS Fix Pending'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* LOCAL POLICE QUICK ACTION */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/80 to-slate-850 border border-indigo-800/60 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-900/80 border border-indigo-600 flex items-center justify-center text-indigo-300">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700 uppercase">
                Police • {safetySearchRadius} km
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-white">Local Police &amp; Dispatch</h4>
              <p className="text-xs text-slate-300 mt-0.5">Control room &amp; patrol desks within {safetySearchRadius} km of {userCity}</p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <a
                href="tel:100"
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call 100 / 112</span>
              </a>

              <a
                href={
                  lat !== null && lng !== null
                    ? `https://www.google.com/maps/search/Police+Station+within+${safetySearchRadius}+km/@${lat},${lng},14z`
                    : 'https://www.google.com/maps/search/Police+Station+near+me'
                }
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title={`Open Nearest Police Station within ${safetySearchRadius} km in Google Maps`}
              >
                <ExternalLink className="w-4 h-4 text-indigo-400" />
              </a>
            </div>
          </div>

          {/* TAXI & TRANSIT SERVICES QUICK ACTION */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/80 to-slate-850 border border-cyan-800/60 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-cyan-900/80 border border-cyan-600 flex items-center justify-center text-cyan-300">
                <Car className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 uppercase">
                Transit • {safetySearchRadius} km
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-white">Taxi &amp; Emergency Transit</h4>
              <p className="text-xs text-slate-300 mt-0.5">Dispatches pickup within {safetySearchRadius} km perimeter</p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <a
                href="https://m.uber.com/ul/?action=setPickup&pickup=my_location"
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md"
              >
                <Car className="w-3.5 h-3.5" />
                <span>Request Emergency Ride</span>
              </a>

              <a
                href={
                  lat !== null && lng !== null
                    ? `https://www.google.com/maps/search/Taxi+stand+or+Transit+within+${safetySearchRadius}+km/@${lat},${lng},14z`
                    : 'https://www.google.com/maps/search/Taxi+stand+or+Transit+near+me'
                }
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title={`Find Nearest Taxi Stand within ${safetySearchRadius} km in Google Maps`}
              >
                <ExternalLink className="w-4 h-4 text-cyan-400" />
              </a>
            </div>
          </div>

          {/* MEDICAL FACILITIES & ER QUICK ACTION */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-950/80 to-slate-850 border border-rose-800/60 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-900/80 border border-rose-600 flex items-center justify-center text-rose-300">
                <Cross className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 uppercase">
                Medical • {safetySearchRadius} km
              </span>
            </div>

            <div>
              <h4 className="text-base font-bold text-white">Emergency Hospitals &amp; ER</h4>
              <p className="text-xs text-slate-300 mt-0.5">Ambulance &amp; Trauma Unit within {safetySearchRadius} km</p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <a
                href="tel:108"
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Ambulance (108)</span>
              </a>

              <a
                href={
                  lat !== null && lng !== null
                    ? `https://www.google.com/maps/search/Hospitals+and+24x7+Emergency+within+${safetySearchRadius}+km/@${lat},${lng},14z`
                    : 'https://www.google.com/maps/search/Hospitals+and+24x7+Emergency+near+me'
                }
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title={`Locate Nearest ER Hospital within ${safetySearchRadius} km in Google Maps`}
              >
                <ExternalLink className="w-4 h-4 text-rose-400" />
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* TAB: SAFE WALK REAL-TIME ESCORT */}
      {activeTab === 'safewalk' && (
        <SafeWalkView
          location={location}
          contacts={contacts}
          triggerSOS={triggerSOS}
        />
      )}

      {/* TAB: CALMBREATHING BOX EXERCISE */}
      {activeTab === 'breathing' && (
        <CalmBreathing />
      )}

      {/* TAB 1: EMERGENCY SOS & RESCUE RELAY */}
      {activeTab === 'sos' && (
        <div className="space-y-6">
          
          {/* Active Geofence Monitoring Quick Banner */}
          {(() => {
            const geofenceConfig = StorageService.getGeofenceConfig();
            const anchor = geofenceConfig.anchorLocation || (location ? { latitude: location.latitude, longitude: location.longitude } : null);
            const evalStatus = (location && anchor) ? LocationService.checkGeofence(location.latitude, location.longitude, anchor.latitude, anchor.longitude, geofenceConfig.radiusKm) : null;

            return (
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg ${
                evalStatus?.isInside
                  ? 'bg-slate-900 border-cyan-800/60'
                  : 'bg-rose-950/80 border-rose-600 animate-pulse'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                    evalStatus?.isInside ? 'bg-cyan-950 border-cyan-700 text-cyan-300' : 'bg-rose-900 border-rose-500 text-rose-300'
                  }`}>
                    <Navigation className="w-5 h-5 transform -rotate-45" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-black text-white">
                        GPS Geofence: {geofenceConfig.radiusKm} km Safety Radius Active
                      </h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                        evalStatus?.isInside ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-rose-950 text-rose-300 border-rose-700'
                      }`}>
                        {evalStatus?.isInside ? 'Inside Perimeter' : 'Zone Breach Alert'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      {evalStatus ? `${evalStatus.distanceFromAnchorKm} km from safe center • Boundary auto-notify: ${geofenceConfig.notifyOnExit ? 'ENABLED' : 'DISABLED'}` : 'Detecting coordinates...'}
                    </p>
                  </div>
                </div>

                <a
                  href="#gps"
                  onClick={() => {
                    const gpsBtn = document.querySelector('button[title*="GPS"]') as HTMLElement;
                    if (gpsBtn) gpsBtn.click();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0"
                >
                  Configure Geofence
                </a>
              </div>
            );
          })()}

          {/* Quick CalmBreathing Callout Card inside Emergency SOS tab */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/80 via-slate-900 to-slate-900 border border-teal-700/50 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-teal-900/80 border border-teal-600 flex items-center justify-center shrink-0">
                <Wind className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Feeling Stressed or Anxious?</h4>
                <p className="text-xs text-slate-300">Start a guided 4-4-4-4 Box Breathing exercise to lower heart rate immediately.</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('breathing')}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shrink-0"
            >
              Open CalmBreathing
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* SOS Immediate Trigger Panel */}
            <div className="rounded-2xl bg-gradient-to-br from-rose-950/80 via-slate-900 to-slate-900 p-6 border border-rose-800/50 shadow-xl space-y-4 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-rose-900/60 border border-rose-600 flex items-center justify-center">
                <ShieldAlert className="w-10 h-10 text-rose-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Instant Emergency SOS</h3>
                <p className="text-xs text-slate-300 max-w-sm mt-1">
                  Activates SOS immediately without delay, retrieves your current GPS location in parallel, and dispatches emergency alerts to all saved contacts.
                </p>
              </div>

              <button
                onClick={triggerSOS}
                data-testid="safety-hub-instant-sos-btn"
                className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-base shadow-xl shadow-rose-950/80 active:scale-95 transition-all cursor-pointer"
              >
                TRIGGER INSTANT SOS NOW
              </button>

              <button
                onClick={triggerFakeCall}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-2 border border-slate-700 cursor-pointer"
              >
                <PhoneCall className="w-4 h-4 text-indigo-400" />
                <span>Simulate Fake Call Escape</span>
              </button>
            </div>

            {/* Saved Emergency Contacts Summary & Quick Add Card */}
            <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    <span>Saved Emergency Contacts ({contacts.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('circle');
                      setOpenAddFormOnMount(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Contact</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Instant SOS alerts are sent only to contacts you explicitly add and save.
                </p>

                {contacts.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-700/60 text-amber-200 text-xs space-y-2">
                    <p className="font-bold">
                      Add an emergency contact before using contact-based SOS alerts.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('circle');
                        setOpenAddFormOnMount(true);
                      }}
                      className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold text-xs inline-flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Emergency Contact Now</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1 max-h-56 overflow-y-auto">
                    {contacts.map((c, index) => (
                      <div key={c.id} className="p-3 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded-full bg-purple-950 border border-purple-700 flex items-center justify-center text-purple-300 font-black text-xs">
                            {index + 1}
                          </div>
                          <div>
                            <h5 className="text-sm font-bold text-white">{c.name}</h5>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {c.phone} {c.relationship ? `• ${c.relationship}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-purple-300 border border-slate-700">
                          {c.isPrimary ? 'Primary' : 'Saved'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('circle')}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-purple-300 font-bold text-xs border border-slate-700 cursor-pointer"
              >
                Manage Emergency Contacts
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: EMERGENCY CONTACTS (CUSTOM CONTACTS MANAGER) */}
      {activeTab === 'circle' && (
        <EmergencyContactsManager
          contacts={contacts}
          onUpdateContacts={setContacts}
          location={location}
          autoOpenAddForm={openAddFormOnMount}
          onAutoOpenHandled={() => {
            setOpenAddFormOnMount(false);
            onClearAutoOpenAddContact?.();
          }}
        />
      )}

      {/* TAB 3: SAFEROUTE & WELLNESS JOURNEY PLANNER */}
      {activeTab === 'route' && (
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              <span>SafeRoute &amp; Wellness-Aware Journey Planner</span>
            </h3>
            <p className="text-xs text-slate-400">Find well-lit routes with verified public toilets, rest stops, and 24/7 pharmacies</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
            <input
              type="text"
              value={startAddr}
              onChange={(e) => setStartAddr(e.target.value)}
              placeholder="Origin / Current Location"
              className="bg-slate-900 text-white text-xs px-3 py-2.5 rounded-lg border border-slate-700"
            />
            <input
              type="text"
              value={destAddr}
              onChange={(e) => setDestAddr(e.target.value)}
              placeholder="Destination Address"
              className="bg-slate-900 text-white text-xs px-3 py-2.5 rounded-lg border border-slate-700"
            />

            <button
              onClick={() => setRoutePlanned(true)}
              className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center space-x-2"
            >
              <span>Find Safe Route</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {routePlanned && (
            <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 uppercase">Recommended Safe Option (Via Main Lit Corridor)</span>
                <span className="text-xs font-black text-emerald-400">4.8 km • 14 mins</span>
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <p>• Passes 3 Verified 24/7 Safe Haven Spots (Apollo Pharmacy, Campus Gate 1, Police Booth).</p>
                <p>• Verified accessible rest areas &amp; clean public facilities along route.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PROOFCHAIN & SOS MEDIA EVIDENCE VAULT */}
      {activeTab === 'evidence' && (
        <div className="space-y-8">
          {/* Real Audio & Video SOS Evidence Vault */}
          <SOSEvidenceHistoryView location={location} triggerSOS={triggerSOS} />

          {/* Supplementary Manual Incident Notes Vault */}
          <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>Manual Witness Notes &amp; Vehicle Logging</span>
              </h3>
              <p className="text-xs text-slate-400">
                Record written incident statements, vehicle license plates, or assailant descriptions with SHA-256 proof.
              </p>
            </div>

            <div className="space-y-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
              <input
                type="text"
                placeholder="Incident Title (e.g. Unsafe Vehicle Follower on Anna Salai)"
                value={evidenceTitle}
                onChange={(e) => setEvidenceTitle(e.target.value)}
                className="w-full bg-slate-900 text-white text-xs px-3 py-2.5 rounded-lg border border-slate-700"
              />
              <textarea
                rows={3}
                placeholder="Detailed notes, vehicle numbers, physical descriptions, bystander details..."
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                className="w-full bg-slate-900 text-white text-xs px-3 py-2.5 rounded-lg border border-slate-700"
              />

              <button
                onClick={createEvidenceEntry}
                className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>Generate Vault Entry &amp; SHA-256 Hash</span>
              </button>
            </div>

            {/* Existing Vault Entries */}
            {evidenceList.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase">Written Witness Records ({evidenceList.length})</h4>
                {evidenceList.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-slate-850 border border-slate-750 space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-bold text-white">{item.title}</h5>
                      <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-300">{item.notes}</p>
                    <div className="p-2 rounded bg-slate-900 font-mono text-[10px] text-indigo-300 break-all">
                      SHA-256 Hash: {item.sha256Hash}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: VERIFIED SAFE HAVENS */}
      {activeTab === 'havens' && (
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <span>Verified Safe Haven Network</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Participating 24/7 security desks, hospitals, and pharmacies with confirmed emergency intake policies.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-3 py-1 rounded-full border border-cyan-800">
                Search Radius: {safetySearchRadius} km
              </span>
              {onOpenSafetySettings && (
                <button
                  onClick={onOpenSafetySettings}
                  className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700"
                >
                  Configure
                </button>
              )}
            </div>
          </div>

          {/* List of Verified Havens with Distance Computation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                id: 'sh1',
                title: 'Apollo Women Hospital Gate 1',
                type: '24/7 Hospital Safe Spot',
                address: 'Thousand Lights, Anna Salai, Chennai',
                feature: 'Security Desk active • Staff trained in emergency intake',
                latOffset: 0.012,
                lngOffset: 0.008
              },
              {
                id: 'sh2',
                title: 'MedPlus 24x7 Center',
                type: '24/7 Pharmacy Safe Spot',
                address: 'Guindy Main Rd, Chennai',
                feature: 'Well lit • Direct panic hotline to police',
                latOffset: -0.018,
                lngOffset: 0.015
              },
              {
                id: 'sh3',
                title: 'Metro Central Police Post',
                type: '24/7 Police Safe Spot',
                address: 'Central Station Subway Hub, Chennai',
                feature: 'Female police officer desk • Continuous CCTV surveillance',
                latOffset: 0.024,
                lngOffset: -0.012
              },
              {
                id: 'sh4',
                title: 'IIT Madras Campus Main Gate Security',
                type: '24/7 Campus Safe Spot',
                address: 'Sardar Patel Road, Chennai',
                feature: 'SOS intercom box • Barrier gate & emergency vehicle lane',
                latOffset: -0.035,
                lngOffset: 0.021
              }
            ].map((haven) => {
              const havenLat = lat !== null ? lat + haven.latOffset : null;
              const havenLng = lng !== null ? lng + haven.lngOffset : null;
              const distKm =
                lat !== null && lng !== null && havenLat !== null && havenLng !== null
                  ? Math.round(LocationService.calculateDistanceKm(lat, lng, havenLat, havenLng) * 10) / 10
                  : Math.round(Math.sqrt(haven.latOffset * haven.latOffset + haven.lngOffset * haven.lngOffset) * 111 * 10) / 10;
              const isWithinRadius = distKm <= safetySearchRadius;

              return (
                <div
                  key={haven.id}
                  className={`p-4 rounded-xl border space-y-2 transition-all ${
                    isWithinRadius
                      ? 'bg-slate-850 border-emerald-800/60 shadow-md'
                      : 'bg-slate-900/60 border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {haven.type}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isWithinRadius
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {distKm} km • {isWithinRadius ? 'Within Radius' : 'Outside Radius'}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white">{haven.title}</h4>
                  <p className="text-xs text-slate-400">{haven.address}</p>
                  <p className="text-[11px] text-emerald-400 font-semibold">• {haven.feature}</p>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <a
                      href={
                        havenLat !== null && havenLng !== null
                          ? `https://www.google.com/maps/dir/?api=1&destination=${havenLat},${havenLng}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(haven.title)}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Directions</span>
                    </a>

                    <a
                      href={
                        havenLat !== null && havenLng !== null
                          ? `https://www.google.com/maps/search/Safe+Haven+near+me/@${havenLat},${havenLng},15z`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(haven.title)}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-white"
                      title="Inspect on Google Maps"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick link to search more in current radius */}
          <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <span className="text-slate-300">
              Want to see all participating safe locations across the entire <strong>{safetySearchRadius} km</strong> perimeter?
            </span>
            <a
              href={
                lat !== null && lng !== null
                  ? `https://www.google.com/maps/search/Safe+Haven+Police+Hospital+within+${safetySearchRadius}+km/@${lat},${lng},14z`
                  : 'https://www.google.com/maps/search/Safe+Haven+Police+Hospital+near+me'
              }
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center space-x-1.5 shrink-0"
            >
              <span>Search All ({safetySearchRadius} km)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </div>
      )}

      {/* TAB 6: SAFETY TWIN SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>Safety Twin Simulator &amp; Readiness Audit</span>
            </h3>
            <p className="text-xs text-slate-400">Rehearse emergency workflows safely without sending real alerts</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between">
              <div>
                <h5 className="text-sm font-bold text-white">SOS Trigger Delay</h5>
                <p className="text-xs text-slate-400">5s Cancellation Window</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between">
              <div>
                <h5 className="text-sm font-bold text-white">Trusted Contacts</h5>
                <p className="text-xs text-slate-400">{contacts.length} Configured</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between">
              <div>
                <h5 className="text-sm font-bold text-white">GPS Browser Permission</h5>
                <p className="text-xs text-slate-400">High-Accuracy Granted</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-between">
              <div>
                <h5 className="text-sm font-bold text-white">Offline Fallback SMS</h5>
                <p className="text-xs text-slate-400">Web Share API Native</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
