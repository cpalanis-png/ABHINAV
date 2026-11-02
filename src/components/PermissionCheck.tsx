import React, { useState } from 'react';
import {
  MapPin,
  ShieldAlert,
  Compass,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  ChevronRight,
  Info
} from 'lucide-react';
import { LocationData } from '../types';
import { LocationService } from '../services/locationService';
import { permissionService } from '../services/permissionService';

interface PermissionCheckProps {
  location: LocationData | null;
  onLocationUpdated: (loc: LocationData) => void;
}

export const PermissionCheck: React.FC<PermissionCheckProps> = ({
  location,
  onLocationUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<{ message: string; isDenied: boolean } | null>(null);

  // If location exists and status is live or imprecise with permission granted, do not block
  const isPermissionGranted = location && location.permissionStatus === 'granted' && location.status !== 'unavailable';

  if (isPermissionGranted && !errorState?.isDenied) {
    return null; // Don't render overlay if location permission is already granted and active
  }

  const handleEnableLocation = () => {
    setLoading(true);
    setErrorState(null);

    if (!('geolocation' in navigator)) {
      setLoading(false);
      setErrorState({
        message: 'Geolocation is not supported by your browser device environment.',
        isDenied: true
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = Math.round(position.coords.accuracy);

        let address = `Coordinates: ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`;
        let city = '';
        let state = '';
        let country = '';

        try {
          const res = await fetch(`/api/geocoding/reverse?lat=${lat}&lng=${lng}`);
          if (res.ok) {
            const geoData = await res.json();
            if (geoData.address) address = geoData.address;
            if (geoData.city) city = geoData.city;
            if (geoData.state) state = geoData.state;
            if (geoData.country) country = geoData.country;
          }
        } catch {}

        const freshLoc: LocationData = {
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: Date.now(),
          address,
          city,
          state,
          country,
          status: acc > 150 ? 'imprecise' : 'live',
          permissionStatus: 'granted'
        };

        setLoading(false);
        setErrorState(null);
        permissionService.checkAllPermissions();
        onLocationUpdated(freshLoc);
      },
      (error) => {
        setLoading(false);
        let msg = 'Failed to acquire location.';
        let isDenied = false;

        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. SMART SHIELD requires GPS permission to enable real-time geofence defense, SafeWalk escorts, and emergency SOS location sharing.';
          isDenied = true;
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Device location services appear to be turned off or unavailable. Please enable Location/GPS in your phone quick settings.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out. Please check your GPS signal and tap Retry.';
        }

        setErrorState({ message: msg, isDenied });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="mb-8 rounded-3xl bg-gradient-to-br from-slate-900 via-cyan-950/80 to-slate-900 p-6 sm:p-8 border-2 border-cyan-500/80 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in duration-300">
      {/* Background Accent Glow */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-cyan-800/40">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-950 border border-cyan-500 flex items-center justify-center shrink-0">
            <MapPin className="w-6 h-6 text-cyan-300 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-black text-white">Enable GPS Location Access</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-950 text-cyan-300 border border-cyan-700">
                Action Required
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Location access is required to power core safety monitoring and emergency features.
            </p>
          </div>
        </div>
      </div>

      {/* Explanation Banner & Features Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        
        <div className="space-y-3">
          <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
            "SMART SHIELD uses your location to show your current position, calculate your active safety radius, trigger out-of-bounds geofence alerts, and attach verified Google Maps coordinates to emergency SOS messages."
          </p>

          <div className="space-y-2 pt-1">
            <div className="flex items-center space-x-2 text-xs text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Real-Time Honest GPS Coordinates (No fake defaults)</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Custom 1 km – 50 km Safe Zone Geofencing</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>1-Tap Google Maps Link in Emergency SOS Alerts</span>
            </div>
          </div>
        </div>

        {/* Error / Denied State or Action Box */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          {errorState ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-700 text-xs text-rose-200 space-y-1">
                <div className="flex items-center space-x-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorState.isDenied ? 'Location Permission Denied' : 'Location Unavailable'}</span>
                </div>
                <p className="text-[11px] text-slate-300">{errorState.message}</p>
              </div>

              {errorState.isDenied && (
                <div className="p-3 bg-slate-950 rounded-xl text-[11px] font-mono text-cyan-300 space-y-1">
                  <p className="font-bold text-white flex items-center space-x-1">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Android Settings Steps:</span>
                  </p>
                  <p>Android Settings &gt; Apps &gt; SMART SHIELD &gt; Permissions &gt; Location &gt; Allow only while using the app.</p>
                </div>
              )}

              <button
                onClick={handleEnableLocation}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center space-x-2 shadow-lg"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Requesting GPS...' : 'Retry Location Permission'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-300">
                <Compass className="w-6 h-6" />
              </div>

              <div>
                <h4 className="text-sm font-bold text-white">Enable Device Location</h4>
                <p className="text-xs text-slate-400">Triggers native browser / Android location prompt</p>
              </div>

              <button
                onClick={handleEnableLocation}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center space-x-2 shadow-xl shadow-cyan-950 active:scale-95 transition-transform"
              >
                <MapPin className="w-5 h-5" />
                <span>{loading ? 'Acquiring GPS Position...' : 'Enable Location Now'}</span>
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
