import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Smartphone,
  Phone,
  Settings,
  Info
} from 'lucide-react';
import { LocationData } from '../types';
import { LocationService } from '../services/locationService';
import { permissionService } from '../services/permissionService';

interface PermissionGateProps {
  children: React.ReactNode;
  activeTab?: string;
  location: LocationData | null;
  onLocationUpdated: (loc: LocationData) => void;
  triggerSOS?: () => void;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  activeTab = 'dashboard',
  location,
  onLocationUpdated,
  triggerSOS
}) => {
  const [permissionState, setPermissionState] = useState<'granted' | 'approximate' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [loading, setLoading] = useState(false);
  const [dismissedOverlay, setDismissedOverlay] = useState(false);
  const [errorState, setErrorState] = useState<{
    message: string;
    isDenied: boolean;
    isGpsDisabled: boolean;
  } | null>(null);

  const checkGeolocationPermission = useCallback(async () => {
    const status = await permissionService.checkAllPermissions();

    if (status.location === 'granted' || status.location === 'approximate') {
      setPermissionState(status.location);
      setErrorState(null);
      // If permission was just granted in Android Settings and we don't have usable coordinates yet, fetch them once
      if (!LocationService.isUsableLocation(location)) {
        const fresh = await LocationService.getCurrentLocation();
        if (LocationService.isUsableLocation(fresh)) {
          onLocationUpdated(fresh);
        }
      }
      return;
    }

    if (location && LocationService.isUsableLocation(location) && location.permissionStatus === 'granted') {
      setPermissionState(location.precision === 'approximate' ? 'approximate' : 'granted');
      return;
    }

    if (status.location === 'denied') {
      setPermissionState('denied');
    } else {
      setPermissionState('prompt');
    }
  }, [location, onLocationUpdated]);

  useEffect(() => {
    checkGeolocationPermission();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkGeolocationPermission();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [checkGeolocationPermission]);

  const handleEnableLocation = async () => {
    setLoading(true);
    setErrorState(null);

    const permResult = await permissionService.requestLocationPermission();
    const freshLoc = await LocationService.getCurrentLocation(9000);

    setLoading(false);

    if (LocationService.isUsableLocation(freshLoc)) {
      setPermissionState(freshLoc.precision === 'approximate' ? 'approximate' : 'granted');
      setErrorState(null);
      onLocationUpdated(freshLoc);
      return;
    }

    const isDenied =
      !permResult.granted &&
      (permResult.status.location === 'denied' || freshLoc.permissionStatus === 'denied');
    const isGpsDisabled = !permResult.status.locationServicesEnabled;

    if (isDenied) {
      setPermissionState('denied');
    }

    setErrorState({
      message:
        freshLoc.errorReason ||
        'Unable to acquire a valid GPS fix. Verify that Location is enabled in Android Quick Settings and permission is granted.',
      isDenied,
      isGpsDisabled
    });
  };

  // Show overlay only on dashboard tab when permission is denied or prompt and no valid location fix exists
  const hasValidFix = LocationService.isUsableLocation(location);
  const isBlocked =
    !dismissedOverlay &&
    activeTab === 'dashboard' &&
    (permissionState === 'denied' || permissionState === 'prompt') &&
    !hasValidFix;

  if (!isBlocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[650px] w-full">
      {/* Dimmed Background Content */}
      <div className="opacity-15 pointer-events-none filter blur-[2px]" aria-hidden="true">
        {children}
      </div>

      {/* Full-Screen Overlay Covering Main View on Dashboard Tab */}
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-300">
        <div className="max-w-xl w-full bg-gradient-to-br from-slate-900 via-cyan-950/90 to-slate-950 rounded-3xl border-2 border-cyan-500/80 shadow-2xl p-6 sm:p-8 space-y-5 text-left relative overflow-hidden my-auto">
          {/* Background Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center space-x-4 border-b border-cyan-800/40 pb-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-950 border border-cyan-500 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-950">
              <MapPin className="w-7 h-7 text-cyan-300 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white">Location Access Required</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-950 text-rose-300 border border-rose-700">
                  Safety Guard
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                SMART SHIELD requires real-time GPS or network location for SOS dispatch and safe-zone monitoring.
              </p>
            </div>
          </div>

          {/* Rationale & Key Features */}
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                Why SMART SHIELD Needs Location
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                SMART SHIELD never uses fake or hardcoded developer coordinates. Your genuine GPS or approximate network position is required to calculate your active safety perimeter, find nearby emergency hospitals/police stations, and attach verified coordinates to SOS alerts.
              </p>
            </div>

            <div className="space-y-1.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center space-x-2.5 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Supports both Precise GPS and Approximate (Coarse) Location</span>
              </div>
              <div className="flex items-center space-x-2.5 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Automatically rechecks permission when returning from Android Settings</span>
              </div>
              <div className="flex items-center space-x-2.5 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>SOS and 112/1091 Helplines remain usable even if GPS is unavailable</span>
              </div>
            </div>
          </div>

          {/* Error Message & Enable Location Action Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            {errorState ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-rose-950/90 border border-rose-700 text-xs text-rose-200 space-y-1">
                  <div className="flex items-center space-x-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      {errorState.isDenied
                        ? 'Location Permission Denied or Disabled'
                        : 'GPS Signal / Location Services Unavailable'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{errorState.message}</p>
                </div>

                {/* Troubleshooting Disabled Android Permission Controls */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
                  <p className="font-bold text-cyan-300 flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Why is Location Permission disabled or greyed out on Android?</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                    <li>
                      <strong>App Settings:</strong> Open <strong>Settings &gt; Apps &gt; SMART SHIELD &gt; Permissions &gt; Location</strong> and choose <em>Allow only while using the app</em>.
                    </li>
                    <li>
                      <strong>Browser / WebAPK Shortcut:</strong> If installed via Chrome "Add to Home Screen", ensure <strong>Google Chrome</strong> itself has Location permission enabled in Android Settings &gt; Apps &gt; Chrome &gt; Permissions, and check Site Settings (padlock icon).
                    </li>
                    <li>
                      <strong>Device GPS Toggle:</strong> Ensure the master <strong>Location</strong> toggle in your phone's Quick Settings pull-down shade is turned ON.
                    </li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => permissionService.openAppSettings()}
                    className="py-3 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md cursor-pointer transition-colors"
                  >
                    <Smartphone className="w-4 h-4 text-purple-200 shrink-0" />
                    <span>Open App Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => permissionService.openLocationServicesSettings()}
                    className="py-3 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md cursor-pointer transition-colors"
                  >
                    <Settings className="w-4 h-4 text-amber-100 shrink-0" />
                    <span>Device GPS Settings</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleEnableLocation}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center space-x-2 shadow-lg cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Requesting Location...' : 'Retry Location Fix'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <button
                  type="button"
                  onClick={handleEnableLocation}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center space-x-2 shadow-xl shadow-cyan-950 active:scale-95 transition-transform cursor-pointer"
                >
                  <MapPin className="w-5 h-5" />
                  <span>{loading ? 'Acquiring Verified Location...' : 'Enable Location'}</span>
                </button>
              </div>
            )}

            {/* Escape hatch so user is NEVER trapped in a permission loop */}
            <button
              type="button"
              onClick={() => setDismissedOverlay(true)}
              className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-[11px] border border-slate-800 transition-colors cursor-pointer"
            >
              Continue to Dashboard Without Live GPS (Limited Mode)
            </button>
          </div>

          {/* Emergency Direct Shortcuts (Always accessible without GPS) */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Phone className="w-4 h-4" />
                <span>Direct Helplines (No GPS Required)</span>
              </span>
              {triggerSOS && (
                <button
                  type="button"
                  onClick={triggerSOS}
                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>SOS Alert</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <a href="tel:112" className="p-2 rounded-xl bg-rose-950/60 border border-rose-800 hover:bg-rose-900 transition-colors">
                <span className="text-sm font-black text-rose-300">112</span>
                <p className="text-[9px] text-slate-300 truncate">Emergency</p>
              </a>
              <a href="tel:1091" className="p-2 rounded-xl bg-purple-950/60 border border-purple-800 hover:bg-purple-900 transition-colors">
                <span className="text-sm font-black text-purple-300">1091</span>
                <p className="text-[9px] text-slate-300 truncate">Women</p>
              </a>
              <a href="tel:108" className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-800 hover:bg-cyan-900 transition-colors">
                <span className="text-sm font-black text-cyan-300">108</span>
                <p className="text-[9px] text-slate-300 truncate">Ambulance</p>
              </a>
              <a href="tel:100" className="p-2 rounded-xl bg-indigo-950/60 border border-indigo-800 hover:bg-indigo-900 transition-colors">
                <span className="text-sm font-black text-indigo-300">100</span>
                <p className="text-[9px] text-slate-300 truncate">Police</p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
