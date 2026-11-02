import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  MapPin,
  Mic,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Settings,
  RefreshCw,
  ExternalLink,
  Compass,
  Smartphone,
  Video,
  Code2,
  Copy,
  Check
} from 'lucide-react';
import { permissionService, PermissionStatus } from '../services/permissionService';
import { LocationService } from '../services/locationService';
import { LocationData } from '../types';
import { PermissionRationaleModal, RationalePermissionType } from './PermissionRationaleModal';

interface PermissionStatusViewProps {
  location: LocationData | null;
  refreshLocation: () => void;
}

export const PermissionStatusView: React.FC<PermissionStatusViewProps> = ({
  location,
  refreshLocation
}) => {
  const [status, setStatus] = useState<PermissionStatus>(() => permissionService.getStatus());
  const [activeModal, setActiveModal] = useState<RationalePermissionType | null>(null);
  const [testingMic, setTestingMic] = useState(false);
  const [testingCam, setTestingCam] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);
  const [showAndroidFiles, setShowAndroidFiles] = useState(false);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = permissionService.subscribe((s) => setStatus(s));
    permissionService.checkAllPermissions();
    return unsubscribe;
  }, []);

  const handleRequestMicWithRationale = async () => {
    if (status.microphone !== 'granted') {
      setActiveModal('microphone');
      return;
    }
    setTestingMic(true);
    const granted = await permissionService.requestMicrophonePermission();
    setTestingMic(false);
    if (!granted) {
      setActiveModal('microphone');
    }
  };

  const handleRequestCamWithRationale = async () => {
    if (status.camera !== 'granted') {
      setActiveModal('camera');
      return;
    }
    setTestingCam(true);
    const granted = await permissionService.requestCameraPermission();
    setTestingCam(false);
    if (!granted) {
      setActiveModal('camera');
    }
  };

  const handleTestNotification = async () => {
    if (status.notifications !== 'granted') {
      setActiveModal('notifications');
      return;
    }
    setTestingNotif(true);
    const granted = await permissionService.requestNotificationPermission();
    setTestingNotif(false);
    if (granted && typeof Notification !== 'undefined') {
      new Notification('SMART SHIELD Security Test', {
        body: 'Notification permissions verified working! Real-time alerts are active.',
        icon: '/pwa-192x192.png'
      });
    } else if (!granted) {
      setActiveModal('notifications');
    }
  };

  const handleCopySnippet = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFile(key);
      setTimeout(() => setCopiedFile(null), 2000);
    });
  };

  const allCoreGranted =
    (status.location === 'granted' || status.location === 'approximate') &&
    status.camera === 'granted' &&
    status.microphone === 'granted';

  const anyCoreDenied =
    status.location === 'denied' ||
    status.camera === 'denied' ||
    status.microphone === 'denied' ||
    Boolean(status.permanentDenialDetected);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Rationale Modal */}
      {activeModal && (
        <PermissionRationaleModal
          type={activeModal}
          isOpen={Boolean(activeModal)}
          onClose={() => setActiveModal(null)}
          onPermissionGranted={() => {
            permissionService.checkAllPermissions();
            refreshLocation();
          }}
        />
      )}

      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 p-6 border border-indigo-800/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-black text-white">Android Permissions &amp; Hardware Audit</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">
              {status.isAndroidBridgeActive ? 'Native Android WebView Bridge Active' : 'Web & Android Runtime Manager'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time runtime permission verification for Location (GPS), Camera (SOS Video), and Microphone (Voice AI &amp; Audio SOS).
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2 shrink-0">
          {!allCoreGranted && (
            <button
              onClick={() => setActiveModal('all')}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center space-x-2 shadow-lg cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Setup All Permissions</span>
            </button>
          )}
          <button
            onClick={() => {
              permissionService.checkAllPermissions();
              refreshLocation();
            }}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Re-check Permissions</span>
          </button>
        </div>
      </div>

      {/* Denied / Permanently Denied Recovery Banner */}
      {anyCoreDenied && (
        <div className="rounded-2xl bg-rose-950/75 border-2 border-rose-600/80 p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white">
                One or More Permissions Are Denied ({[
                  status.location === 'denied' ? 'Location' : null,
                  status.camera === 'denied' ? 'Camera' : null,
                  status.microphone === 'denied' ? 'Microphone' : null
                ].filter(Boolean).join(', ')})
              </h3>
              <p className="text-xs text-rose-200 leading-relaxed">
                Smart Shield keeps all emergency SOS alerts, helplines (112 / 1091), and wellness tools usable even when permissions are denied. To restore GPS coordinates, SOS camera recording, or voice input, open Android App Settings and allow the denied permission.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
            <button
              onClick={() => permissionService.openAppSettings()}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-rose-950 font-black text-xs flex items-center space-x-1.5 shadow-lg cursor-pointer"
            >
              <Settings className="w-4 h-4 text-rose-600" />
              <span>Open Android App Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* PERMISSION STATUS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* 1. LOCATION PERMISSION CARD */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-300">
                <MapPin className="w-5 h-5" />
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                status.location === 'granted'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : status.location === 'approximate'
                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                  : status.location === 'denied'
                  ? 'bg-rose-950 text-rose-300 border-rose-700'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {status.location === 'granted'
                  ? 'Precise Granted'
                  : status.location === 'approximate'
                  ? 'Approximate Only'
                  : status.location === 'denied'
                  ? 'Denied'
                  : 'Prompt Ready'}
              </span>
            </div>

            <div>
              <h3 className="text-base font-black text-white">GPS Location</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                <code>ACCESS_FINE_LOCATION</code> &amp; <code>ACCESS_COARSE_LOCATION</code> for SOS coordinates &amp; geofencing.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-850 border border-slate-750 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Precision:</span>
                <span className={`font-bold uppercase ${
                  status.locationPrecision === 'precise'
                    ? 'text-emerald-400'
                    : status.locationPrecision === 'approximate'
                    ? 'text-amber-400'
                    : 'text-slate-500'
                }`}>
                  {status.locationPrecision === 'precise'
                    ? 'Precise GPS'
                    : status.locationPrecision === 'approximate'
                    ? 'Approximate'
                    : 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Coordinates:</span>
                <span className="text-slate-200 font-mono text-[11px]">
                  {LocationService.isUsableLocation(location)
                    ? `${location!.latitude.toFixed(4)}°, ${location!.longitude.toFixed(4)}°`
                    : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            {status.location === 'denied' ? (
              <div className="space-y-1.5">
                <button
                  onClick={() => setActiveModal('location')}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md cursor-pointer"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Request / Fix Location</span>
                </button>
                <button
                  onClick={() => permissionService.openAppSettings()}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold text-[11px] flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Open App Settings</span>
                </button>
              </div>
            ) : status.location !== 'granted' ? (
              <button
                onClick={() => setActiveModal('location')}
                className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                <span>{status.location === 'approximate' ? 'Upgrade to Precise GPS' : 'Grant Location Access'}</span>
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-center text-emerald-300 text-xs font-bold flex items-center justify-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Precise GPS Granted</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. CAMERA EVIDENCE PERMISSION CARD */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-rose-950 border border-rose-700 flex items-center justify-center text-rose-300">
                <Video className="w-5 h-5" />
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                status.camera === 'granted'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : status.camera === 'denied'
                  ? 'bg-rose-950 text-rose-300 border-rose-700'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {status.camera === 'granted'
                  ? 'Camera Granted'
                  : status.camera === 'denied'
                  ? 'Denied'
                  : 'Prompt Ready'}
              </span>
            </div>

            <div>
              <h3 className="text-base font-black text-white">Camera (SOS Video)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                <code>android.permission.CAMERA</code> for SOS video evidence recording into the SHA-256 vault.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-850 border border-slate-750 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">SOS Evidence:</span>
                <span className="text-slate-200 font-bold">
                  {status.camera === 'granted' ? 'Video Armed' : 'Audio Fallback Active'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">WebView Resource:</span>
                <span className="text-rose-300 font-mono text-[10px]">VIDEO_CAPTURE</span>
              </div>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={handleRequestCamWithRationale}
              disabled={testingCam}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>
                {testingCam
                  ? 'Checking Camera...'
                  : status.camera === 'granted'
                  ? 'Verify Camera Stream'
                  : 'Grant Camera Permission'}
              </span>
            </button>
            {status.camera === 'denied' && (
              <button
                onClick={() => permissionService.openAppSettings()}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 font-bold text-[11px] flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Open App Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. MICROPHONE PERMISSION CARD */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-indigo-950 border border-indigo-700 flex items-center justify-center text-indigo-300">
                <Mic className="w-5 h-5" />
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                status.microphone === 'granted'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : status.microphone === 'denied'
                  ? 'bg-rose-950 text-rose-300 border-rose-700'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {status.microphone === 'granted'
                  ? 'Mic Granted'
                  : status.microphone === 'denied'
                  ? 'Denied'
                  : 'Prompt Ready'}
              </span>
            </div>

            <div>
              <h3 className="text-base font-black text-white">Microphone (Voice &amp; SOS)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                <code>android.permission.RECORD_AUDIO</code> for Voice AI, "Smart Shield Help" SOS, &amp; audio evidence.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-850 border border-slate-750 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Capture Status:</span>
                <span className="text-slate-200 font-bold">
                  {status.microphone === 'granted' ? 'Verified Ready' : 'Requires Permission'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">WebView Resource:</span>
                <span className="text-indigo-300 font-mono text-[10px]">AUDIO_CAPTURE</span>
              </div>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={handleRequestMicWithRationale}
              disabled={testingMic}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>
                {testingMic
                  ? 'Checking Microphone...'
                  : status.microphone === 'granted'
                  ? 'Verify Microphone Stream'
                  : 'Grant Microphone Permission'}
              </span>
            </button>
            {status.microphone === 'denied' && (
              <button
                onClick={() => permissionService.openAppSettings()}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 font-bold text-[11px] flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Open App Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. NOTIFICATION PERMISSION CARD */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-teal-950 border border-teal-700 flex items-center justify-center text-teal-300">
                <Bell className="w-5 h-5" />
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                status.notifications === 'granted'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : 'bg-teal-950 text-teal-300 border-teal-700'
              }`}>
                {status.notifications === 'granted' ? 'Alerts Enabled' : 'In-App Alerts'}
              </span>
            </div>

            <div>
              <h3 className="text-base font-black text-white">Safety Alerts</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Delivers immediate geofence boundary breach alerts and wellness reminders.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-850 border border-slate-750 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Geofence Alerts:</span>
                <span className={status.notifications === 'granted' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  {status.notifications === 'granted' ? 'System Push' : 'In-App Banner'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">SOS Dispatch:</span>
                <span className="text-emerald-400 font-bold">Always Active</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleTestNotification}
              disabled={testingNotif}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span>{testingNotif ? 'Sending Test Alert...' : status.notifications === 'granted' ? 'Send Test Notification' : 'Enable Notifications'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* ANDROID SYSTEM SETTINGS & REVOKED PERMISSION RECOVERY */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-850 border border-slate-750 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Android System Settings &amp; Permission Recovery</h3>
              <p className="text-xs text-slate-400">
                Direct recovery actions if Location, Camera, or Microphone was denied or revoked in Android Settings
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => permissionService.openLocationServicesSettings()}
              className="px-3.5 py-2 rounded-xl bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/70 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Device Location Settings</span>
            </button>
            <button
              onClick={() => {
                const opened = permissionService.openAppSettings();
                if (!opened) {
                  setActiveModal('all');
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black flex items-center space-x-1.5 shadow cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Android App Settings</span>
            </button>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-850 border border-slate-750 space-y-3">
          <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center space-x-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <span>How to allow permissions on your Android phone</span>
          </h4>

          <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5">
            <li>Tap <strong>Open Android App Settings</strong> above (or go to <strong>Settings &rarr; Apps &rarr; Smart Shield</strong>, package <code>com.smartshield.womensafety</code>).</li>
            <li>Tap <strong>Permissions</strong>.</li>
            <li>Set <strong>Location</strong> to <em>"Allow only while using the app"</em> and turn ON <strong>Use precise location</strong>.</li>
            <li>Set <strong>Camera</strong> to <em>"Allow only while using the app"</em> (for SOS video evidence).</li>
            <li>Set <strong>Microphone</strong> to <em>"Allow only while using the app"</em> (for Voice AI, "Smart Shield Help" SOS, and SOS audio evidence).</li>
            <li>Return to Smart Shield — permissions are automatically re-checked in <code>onResume()</code> and when the app regains focus.</li>
          </ol>
        </div>

        {/* Native Android WebView Project Files Inspector */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAndroidFiles(!showAndroidFiles)}
            className="w-full p-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 flex items-center justify-between text-left cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Code2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  Native Android WebView Source Files (AndroidManifest.xml &amp; MainActivity.kt)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Inspect the repaired AndroidManifest.xml and WebChromeClient runtime permission implementation in /android
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-400 px-3 py-1 rounded-lg bg-emerald-950 border border-emerald-800 shrink-0">
              {showAndroidFiles ? 'Hide Android Code' : 'View Android Code'}
            </span>
          </button>

          {showAndroidFiles && (
            <div className="mt-4 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 font-mono">
                    /android/app/src/main/AndroidManifest.xml
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopySnippet(
                        'manifest',
                        `<uses-permission android:name="android.permission.INTERNET" />\n<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n<uses-permission android:name="android.permission.CAMERA" />\n<uses-permission android:name="android.permission.RECORD_AUDIO" />`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedFile === 'manifest' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedFile === 'manifest' ? 'Copied' : 'Copy Permissions'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 rounded-xl text-[11px] font-mono text-cyan-300 overflow-x-auto">
{`<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
