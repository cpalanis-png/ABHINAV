import React, { useState } from 'react';
import {
  Sliders,
  Shield,
  MapPin,
  CheckCircle2,
  ExternalLink,
  Building2,
  Compass,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info,
  Navigation,
  Car,
  Footprints,
  Hospital,
  ShieldAlert,
  Save,
  Users,
  Smartphone,
  Download,
  Star
} from 'lucide-react';
import { LocationData, Contact } from '../types';
import { StorageService } from '../services/storage';
import { LocationService } from '../services/locationService';
import { EmergencyContactsManager } from './EmergencyContactsManager';

interface SafetySettingsViewProps {
  location: LocationData | null;
  currentRadius: number;
  onRadiusChange: (radiusKm: number) => void;
  setActiveTab?: (tab: string) => void;
  contacts?: Contact[];
  onContactsUpdated?: (contacts: Contact[]) => void;
}

export const SafetySettingsView: React.FC<SafetySettingsViewProps> = ({
  location,
  currentRadius,
  onRadiusChange,
  setActiveTab,
  contacts: propContacts,
  onContactsUpdated
}) => {
  const [contacts, setContacts] = useState<Contact[]>(() => propContacts || StorageService.getContacts());
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState<number>(currentRadius || 5);
  const [savedNotification, setSavedNotification] = useState<boolean>(false);
  const [syncWithGeofence, setSyncWithGeofence] = useState<boolean>(false);

  // Radius Preset options specified by user requirements
  const radiusPresets = [
    {
      km: 1,
      title: '1 km',
      subtitle: 'Immediate Walking Distance',
      description: 'Hyper-local quick response. Best for dense campuses, inner city walks, and foot patrols.',
      badge: 'Hyper-Local'
    },
    {
      km: 3,
      title: '3 km',
      subtitle: 'Neighborhood Perimeter',
      description: 'Covers immediate residential neighborhood, local police posts, and nearest 24/7 clinics.',
      badge: 'Neighborhood'
    },
    {
      km: 5,
      title: '5 km',
      subtitle: 'Standard Safety Zone (Recommended)',
      description: 'Optimal balance for urban emergency response times (average 8–15 minutes vehicle transit).',
      badge: 'Recommended'
    },
    {
      km: 10,
      title: '10 km',
      subtitle: 'Extended City Corridor',
      description: 'Encompasses multi-ward district hospitals, police commissionerates, and major transit hubs.',
      badge: 'Extended'
    },
    {
      km: 25,
      title: '25 km',
      subtitle: 'Metropolitan & Highway Network',
      description: 'Wide regional perimeter for inter-city travel, outer ring roads, and rural highway transit.',
      badge: 'Metropolitan'
    }
  ];

  const handleSelectRadius = (km: number) => {
    setSelectedRadius(km);
    onRadiusChange(km);
    StorageService.saveSafetySearchRadius(km);

    if (syncWithGeofence) {
      const currentGeofence = StorageService.getGeofenceConfig();
      StorageService.saveGeofenceConfig({
        ...currentGeofence,
        radiusKm: km
      });
    }

    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 2500);
  };

  const handleResetDefault = () => {
    handleSelectRadius(5);
  };

  const hasUsableLocation = LocationService.isUsableLocation(location);
  const lat = hasUsableLocation && location ? location.latitude : null;
  const lng = hasUsableLocation && location ? location.longitude : null;
  const coverageAreaSqKm = (Math.PI * selectedRadius * selectedRadius).toFixed(1);
  const approxWalkingMins = Math.round(selectedRadius * 12);
  const approxDrivingMins = Math.max(3, Math.round(selectedRadius * 2.2 + 2));

  // Determine Google Maps search zoom level based on radius
  const getMapsZoom = (r: number) => {
    if (r <= 1) return 16;
    if (r <= 3) return 15;
    if (r <= 5) return 14;
    if (r <= 10) return 12;
    return 10;
  };

  const zoom = getMapsZoom(selectedRadius);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/80 to-purple-950 p-6 sm:p-8 border border-purple-800/40 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-900/60 border border-purple-700/60 text-purple-200 text-xs font-semibold">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span>Safety Search Perimeter Configuration</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Safety Location Radius Settings
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Configure your active GPS radius for nearby emergency resources. This setting dynamically controls hospital filters, police dispatch boundaries, Safe Haven facilities, and emergency map searches.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={handleResetDefault}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Default (5 km)</span>
            </button>
          </div>
        </div>

        {/* Saved Toast Notification */}
        {savedNotification && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 text-xs font-bold flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Safety Search Radius updated and saved to {selectedRadius} km successfully!</span>
          </div>
        )}
      </div>

      {/* Real-time Radius Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Selected Radius Card */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-cyan-800/60 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase">Active Search Radius</span>
            <Compass className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-black text-white flex items-baseline space-x-1">
            <span>{selectedRadius}</span>
            <span className="text-sm font-bold text-cyan-400">km</span>
          </div>
          <p className="text-[11px] text-slate-400">Centered on your verified GPS coordinates</p>
        </div>

        {/* Coverage Area Card */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-purple-800/60 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase">Radial Coverage Area</span>
            <Navigation className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-black text-white flex items-baseline space-x-1">
            <span>{coverageAreaSqKm}</span>
            <span className="text-sm font-bold text-purple-400">km²</span>
          </div>
          <p className="text-[11px] text-slate-400">Perimeter: {(2 * Math.PI * selectedRadius).toFixed(1)} km circle</p>
        </div>

        {/* Vehicular Response Time */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-rose-800/60 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase">Emergency Vehicle ETA</span>
            <Car className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-black text-white flex items-baseline space-x-1">
            <span>~{approxDrivingMins}</span>
            <span className="text-sm font-bold text-rose-400">mins</span>
          </div>
          <p className="text-[11px] text-slate-400">Estimated ambulance / patrol response</p>
        </div>

        {/* Walking Transit Time */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-800/60 shadow-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase">On-Foot Escape Transit</span>
            <Footprints className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-white flex items-baseline space-x-1">
            <span>~{approxWalkingMins}</span>
            <span className="text-sm font-bold text-emerald-400">mins</span>
          </div>
          <p className="text-[11px] text-slate-400">Average brisk walking reach</p>
        </div>

      </div>

      {/* Selectable Range Cards (1km, 3km, 5km, 10km, 25km) */}
      <div className="rounded-3xl bg-slate-900 p-6 sm:p-8 border border-slate-800 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <span>Selectable Safety Search Radii</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose the radius that matches your environment (urban, suburban, highway).
            </p>
          </div>
          <span className="text-xs text-cyan-400 font-mono font-bold bg-cyan-950 px-3 py-1 rounded-full border border-cyan-800">
            Selected: {selectedRadius} km
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {radiusPresets.map((preset) => {
            const isSelected = selectedRadius === preset.km;
            return (
              <div
                key={preset.km}
                onClick={() => handleSelectRadius(preset.km)}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 group ${
                  isSelected
                    ? 'bg-gradient-to-br from-cyan-950/80 via-slate-850 to-slate-900 border-cyan-500 shadow-xl shadow-cyan-950/60 scale-[1.02]'
                    : 'bg-slate-850/60 hover:bg-slate-800 border-slate-750 hover:border-slate-600'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      isSelected
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {preset.badge}
                    </span>

                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                      isSelected
                        ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                        : 'border-slate-600 group-hover:border-slate-400'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </div>

                  <div className="flex items-baseline space-x-1.5">
                    <h4 className="text-2xl font-black text-white">{preset.title}</h4>
                    <span className="text-xs text-slate-400 font-medium">{preset.subtitle}</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">
                    Area: ~{(Math.PI * preset.km * preset.km).toFixed(1)} km²
                  </span>
                  <button
                    type="button"
                    className={`font-bold transition-colors ${
                      isSelected ? 'text-cyan-400' : 'text-slate-400 group-hover:text-white'
                    }`}
                  >
                    {isSelected ? 'Active Selection' : 'Tap to Activate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Fine-Tuning Slider */}
        <div className="p-5 rounded-2xl bg-slate-850 border border-slate-750 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-bold text-white">Custom Radius Slider (1 km – 50 km)</h4>
            </div>
            <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950 px-2.5 py-0.5 rounded-lg border border-purple-800">
              {selectedRadius} km
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={selectedRadius}
            onChange={(e) => handleSelectRadius(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>1 km (Walk)</span>
            <span>5 km (Default)</span>
            <span>10 km (City)</span>
            <span>25 km (Metro)</span>
            <span>50 km (Highway)</span>
          </div>
        </div>

        {/* Sync with Geofence Option */}
        <div className="flex items-start space-x-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
          <input
            type="checkbox"
            id="syncGeofence"
            checked={syncWithGeofence}
            onChange={(e) => setSyncWithGeofence(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 bg-slate-900"
          />
          <label htmlFor="syncGeofence" className="text-xs text-slate-300 cursor-pointer">
            <span className="font-bold text-white block">Synchronize with SOS Geofence Perimeter</span>
            Automatically update the background Geofence Truth Engine perimeter when this search radius changes, keeping safe-zone boundary alerts aligned with nearby resource lookups.
          </label>
        </div>

      </div>

      {/* Applied Applications & Live Search Previews */}
      <div className="rounded-3xl bg-slate-900 p-6 sm:p-8 border border-slate-800 space-y-6 shadow-xl">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <span>Test Resource Searches in {selectedRadius} km</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {lat !== null && lng !== null
              ? `Preview live Google Maps queries for emergency facilities using your current verified coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) and your chosen ${selectedRadius} km radius.`
              : `Preview Google Maps queries for emergency facilities within your chosen ${selectedRadius} km radius (grant location permission to lock onto exact GPS coordinates).`}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <a
            href={
              lat !== null && lng !== null
                ? `https://www.google.com/maps/search/Emergency+Hospitals+and+24x7+Trauma+Centers/@${lat},${lng},${zoom}z`
                : 'https://www.google.com/maps/search/Emergency+Hospitals+and+24x7+Trauma+Centers+near+me'
            }
            target="_blank"
            rel="noreferrer"
            className="p-4 rounded-2xl bg-slate-850 hover:bg-rose-950/40 border border-slate-750 hover:border-rose-600 transition-all flex items-start space-x-3 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-700 flex items-center justify-center shrink-0">
              <Hospital className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h5 className="text-sm font-bold text-white">Emergency Hospitals</h5>
                <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Locate trauma centers within {selectedRadius} km
              </p>
            </div>
          </a>

          <a
            href={
              lat !== null && lng !== null
                ? `https://www.google.com/maps/search/Police+Stations+Emergency+Control/@${lat},${lng},${zoom}z`
                : 'https://www.google.com/maps/search/Police+Stations+Emergency+Control+near+me'
            }
            target="_blank"
            rel="noreferrer"
            className="p-4 rounded-2xl bg-slate-850 hover:bg-indigo-950/40 border border-slate-750 hover:border-indigo-600 transition-all flex items-start space-x-3 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h5 className="text-sm font-bold text-white">Police Stations</h5>
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Find manned police desks within {selectedRadius} km
              </p>
            </div>
          </a>

          <a
            href={
              lat !== null && lng !== null
                ? `https://www.google.com/maps/search/24x7+Pharmacies+Safe+Havens/@${lat},${lng},${zoom}z`
                : 'https://www.google.com/maps/search/24x7+Pharmacies+Safe+Havens+near+me'
            }
            target="_blank"
            rel="noreferrer"
            className="p-4 rounded-2xl bg-slate-850 hover:bg-emerald-950/40 border border-slate-750 hover:border-emerald-600 transition-all flex items-start space-x-3 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h5 className="text-sm font-bold text-white">24/7 Safe Haven Spots</h5>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Well-lit public spaces within {selectedRadius} km
              </p>
            </div>
          </a>

        </div>

        {/* Current GPS Verification Details */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Search origin anchor:{' '}
              <strong className="text-white">
                {hasUsableLocation && location ? location.address : 'Waiting for Verified GPS Fix'}
              </strong>
            </span>
          </div>
          {setActiveTab && (
            <button
              onClick={() => setActiveTab('safety')}
              className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1"
            >
              <span>Return to Safety Hub</span>
              <span>&rarr;</span>
            </button>
          )}
        </div>

      </div>

      {/* EMERGENCY CONTACTS MANAGEMENT SECTION */}
      <EmergencyContactsManager
        contacts={propContacts !== undefined ? propContacts : contacts}
        onUpdateContacts={(updated) => {
          setContacts(updated);
          if (onContactsUpdated) onContactsUpdated(updated);
        }}
        location={location}
      />

    </div>
  );
};
