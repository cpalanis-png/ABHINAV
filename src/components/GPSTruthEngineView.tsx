import React, { useState, useEffect } from 'react';
import {
  Compass,
  RefreshCw,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Navigation,
  Sliders,
  BellRing,
  Smartphone,
  CheckCircle2,
  Share2,
  LocateFixed,
  Info,
  Radio,
  Cpu,
  Terminal,
  Settings,
  ExternalLink,
  DownloadCloud,
  HardDrive,
  Wifi,
  WifiOff,
  Trash2,
  Loader2,
  Database,
  Save,
  ToggleLeft,
  ToggleRight,
  Eye
} from 'lucide-react';
import { LocationData } from '../types';
import { LocationService, NmeaValidationResult } from '../services/locationService';
import { StorageService, GeofenceConfig } from '../services/storage';
import { permissionService, PermissionStatus } from '../services/permissionService';
import {
  mapTileCacheService,
  CachedTileMetadata,
  OfflineMapViewSnapshot,
  OfflineMapMarker
} from '../services/mapTileCacheService';
import { PermissionRationaleModal } from './PermissionRationaleModal';

interface GPSTruthEngineViewProps {
  location: LocationData | null;
  refreshLocation: () => void;
  onLocationUpdated?: (loc: LocationData) => void;
  loading: boolean;
  safetySearchRadius?: number;
}

export const GPSTruthEngineView: React.FC<GPSTruthEngineViewProps> = ({
  location,
  refreshLocation,
  onLocationUpdated,
  loading
}) => {
  const hasUsableLocation = LocationService.isUsableLocation(location);
  const freshness = location ? LocationService.getFreshnessScore(location) : null;

  // Geofence configuration state (sanitize any previously poisoned 0,0 anchor)
  const [geofenceConfig, setGeofenceConfig] = useState<GeofenceConfig>(() => {
    const cfg = StorageService.getGeofenceConfig();
    if (
      cfg.anchorLocation &&
      !LocationService.isValidCoordinatePair(cfg.anchorLocation.latitude, cfg.anchorLocation.longitude)
    ) {
      const cleaned = { ...cfg, anchorLocation: null };
      StorageService.saveGeofenceConfig(cleaned);
      return cleaned;
    }
    return cfg;
  });

  const [showAndroidGuide, setShowAndroidGuide] = useState<boolean>(false);
  const [showHardwareNmeaPanel, setShowHardwareNmeaPanel] = useState<boolean>(false);
  const [permStatus, setPermStatus] = useState<PermissionStatus>(() => permissionService.getStatus());
  const [showLocationRationale, setShowLocationRationale] = useState<boolean>(false);
  const [nmeaInput, setNmeaInput] = useState<string>(
    '$GPGGA,123519,1304.9620,N,08016.2420,E,1,08,0.9,14.2,M,46.9,M,,*72'
  );
  const [nmeaResult, setNmeaResult] = useState<NmeaValidationResult | null>(null);
  const [nmeaProcessing, setNmeaProcessing] = useState<boolean>(false);

  // Offline Map Tile Caching State
  const [cacheMeta, setCacheMeta] = useState<CachedTileMetadata>(() => mapTileCacheService.getCacheMetadata());
  const [cachingProgress, setCachingProgress] = useState<number | null>(null);
  const [simulateOfflineMap, setSimulateOfflineMap] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineTileGrid, setOfflineTileGrid] = useState<{ z: number; x: number; y: number; dataUrl: string }[]>([]);
  const [offlineLoading, setOfflineLoading] = useState<boolean>(false);

  // Offline Mode Toggle & IndexedDB Persistence State
  const [offlineModeActive, setOfflineModeActive] = useState<boolean>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('smartshield_offline_mode_active') === 'true';
      }
    } catch {}
    return false;
  });
  const [offlineSnapshot, setOfflineSnapshot] = useState<OfflineMapViewSnapshot | null>(null);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState<boolean>(false);
  const [snapshotStatusMsg, setSnapshotStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    mapTileCacheService.getOfflineMapView().then((snap) => {
      if (snap) {
        setOfflineSnapshot(snap);
      }
    });
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadOfflineTilesForLocation = async (lat: number, lng: number) => {
    setOfflineLoading(true);
    const zoom = 15;
    const surrounding = mapTileCacheService.getSurroundingTiles(lat, lng, zoom, 1);
    const loaded: { z: number; x: number; y: number; dataUrl: string }[] = [];

    for (const t of surrounding) {
      let dataUrl = await mapTileCacheService.getTileFromCache(t.key);
      if (!dataUrl) {
        dataUrl = (mapTileCacheService as any).generateTacticalVectorTileDataUrl(t.z, t.x, t.y);
      }
      const safeDataUrl: string = dataUrl || '';
      loaded.push({ z: t.z, x: t.x, y: t.y, dataUrl: safeDataUrl });
    }

    setOfflineTileGrid(loaded);
    setOfflineLoading(false);
  };

  useEffect(() => {
    if (hasUsableLocation && location) {
      loadOfflineTilesForLocation(location.latitude, location.longitude);
      const currentMeta = mapTileCacheService.getCacheMetadata();
      const isStale = !currentMeta.lastUpdatedIso || (Date.now() - new Date(currentMeta.lastUpdatedIso).getTime() > 3600000);
      if (isStale && cachingProgress === null) {
        mapTileCacheService.cacheLocationMapTiles(location.latitude, location.longitude, location.address)
          .then((newMeta) => setCacheMeta(newMeta))
          .catch(() => {});
      }
    }
  }, [hasUsableLocation, location?.latitude, location?.longitude]);

  const handleCacheMapTiles = async () => {
    if (!hasUsableLocation || !location) return;
    setCachingProgress(0);
    try {
      const meta = await mapTileCacheService.cacheLocationMapTiles(
        location.latitude,
        location.longitude,
        location.address,
        (percent) => setCachingProgress(percent)
      );
      setCacheMeta(meta);
      await loadOfflineTilesForLocation(location.latitude, location.longitude);
    } catch (err) {
      console.warn('Map tile caching error:', err);
    } finally {
      setCachingProgress(null);
    }
  };

  const handleClearTileCache = async () => {
    await mapTileCacheService.clearTileCache();
    setCacheMeta(mapTileCacheService.getCacheMetadata());
    if (hasUsableLocation && location) {
      await loadOfflineTilesForLocation(location.latitude, location.longitude);
    }
  };

  const handleToggleOfflineMode = async (enable: boolean) => {
    if (enable) {
      if (!hasUsableLocation || !location) {
        setSnapshotStatusMsg('Valid GPS location required to capture and enable Offline Mode.');
        setTimeout(() => setSnapshotStatusMsg(null), 4000);
        return;
      }

      setIsSavingSnapshot(true);
      setSnapshotStatusMsg('Persisting active map view, tiles, and emergency markers into IndexedDB...');

      const activeAnchor = geofenceConfig.anchorLocation &&
        LocationService.isValidCoordinatePair(geofenceConfig.anchorLocation.latitude, geofenceConfig.anchorLocation.longitude)
          ? geofenceConfig.anchorLocation
          : { latitude: location.latitude, longitude: location.longitude, address: location.address };

      const markers: OfflineMapMarker[] = [
        {
          id: 'user_location',
          type: 'user_location',
          title: 'Current User GPS Position',
          latitude: location.latitude,
          longitude: location.longitude,
          subtitle: location.address || 'Verified Physical GPS Coordinates',
          color: '#f43f5e'
        }
      ];

      if (activeAnchor) {
        markers.push({
          id: 'geofence_anchor',
          type: 'geofence_anchor',
          title: 'Safe Zone Geofence Anchor',
          latitude: activeAnchor.latitude,
          longitude: activeAnchor.longitude,
          subtitle: `${geofenceConfig.radiusKm} km radius center point`,
          color: '#c084fc'
        });
      }

      const savedContacts = StorageService.getContacts();
      savedContacts.forEach((c, idx) => {
        const offsetLat = location.latitude + (idx + 1) * 0.002 * (idx % 2 === 0 ? 1 : -1);
        const offsetLng = location.longitude + (idx + 1) * 0.002 * (idx % 2 === 0 ? -1 : 1);
        markers.push({
          id: `contact_${c.id}`,
          type: 'emergency_contact',
          title: `Emergency Contact: ${c.name}`,
          latitude: offsetLat,
          longitude: offsetLng,
          subtitle: `${c.phone} (${c.relationship})`,
          color: '#f59e0b'
        });
      });

      const snapshot: OfflineMapViewSnapshot = {
        id: `snap_${Date.now()}`,
        savedAtIso: new Date().toISOString(),
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
          status: location.status
        },
        anchorLocation: activeAnchor ? { latitude: activeAnchor.latitude, longitude: activeAnchor.longitude, address: activeAnchor.address } : null,
        geofenceRadiusKm: geofenceConfig.radiusKm,
        markers,
        zoomLevel: 15,
        tileCount: 9
      };

      const meta = await mapTileCacheService.cacheLocationMapTiles(
        location.latitude,
        location.longitude,
        location.address
      );
      snapshot.tileCount = meta.tileCount;

      await mapTileCacheService.saveOfflineMapView(snapshot);
      setCacheMeta(meta);
      setOfflineSnapshot(snapshot);
      setOfflineModeActive(true);
      try {
        localStorage.setItem('smartshield_offline_mode_active', 'true');
      } catch {}

      await loadOfflineTilesForLocation(location.latitude, location.longitude);
      setIsSavingSnapshot(false);
      setSnapshotStatusMsg('✓ Offline Mode Active: Current map view & markers saved to IndexedDB.');
      setTimeout(() => setSnapshotStatusMsg(null), 5000);
    } else {
      setOfflineModeActive(false);
      try {
        localStorage.setItem('smartshield_offline_mode_active', 'false');
      } catch {}
      setSnapshotStatusMsg('Offline Mode disabled. Reverted to live network map.');
      setTimeout(() => setSnapshotStatusMsg(null), 3000);
    }
  };

  const handleClearOfflineSnapshot = async () => {
    await mapTileCacheService.clearOfflineMapView();
    setOfflineSnapshot(null);
    setSnapshotStatusMsg('IndexedDB offline map snapshot cleared.');
    setTimeout(() => setSnapshotStatusMsg(null), 3000);
  };

  useEffect(() => {
    const unsub = permissionService.subscribe((s) => setPermStatus(s));
    permissionService.checkAllPermissions();
    return unsub;
  }, []);

  const handleRequestGpsWithPermissionCheck = async () => {
    const current = await permissionService.checkAllPermissions();
    if (current.location !== 'granted' && current.location !== 'approximate') {
      setShowLocationRationale(true);
      return;
    }
    const fresh = await LocationService.getCurrentLocation();
    if (onLocationUpdated) {
      onLocationUpdated(fresh);
    }
    refreshLocation();
  };

  // Sync anchor location ONLY when a valid, non-zero coordinate fix becomes available
  useEffect(() => {
    if (
      (!geofenceConfig.anchorLocation ||
        !LocationService.isValidCoordinatePair(
          geofenceConfig.anchorLocation.latitude,
          geofenceConfig.anchorLocation.longitude
        )) &&
      hasUsableLocation &&
      location
    ) {
      const initialAnchor = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || 'Safe Center Point'
      };
      const updated = { ...geofenceConfig, anchorLocation: initialAnchor };
      setGeofenceConfig(updated);
      StorageService.saveGeofenceConfig(updated);
    }
  }, [hasUsableLocation, location, geofenceConfig]);

  const updateRadius = (newRadiusKm: number) => {
    const updated = { ...geofenceConfig, radiusKm: newRadiusKm };
    setGeofenceConfig(updated);
    StorageService.saveGeofenceConfig(updated);
  };

  const toggleNotifyOnExit = () => {
    const updated = { ...geofenceConfig, notifyOnExit: !geofenceConfig.notifyOnExit };
    setGeofenceConfig(updated);
    StorageService.saveGeofenceConfig(updated);
  };

  const setAnchorToCurrentLocation = () => {
    if (!hasUsableLocation || !location) return;
    const newAnchor = {
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address || 'Custom Safe Center'
    };
    const updated = { ...geofenceConfig, anchorLocation: newAnchor };
    setGeofenceConfig(updated);
    StorageService.saveGeofenceConfig(updated);
  };

  const handleParseNmea = async (applyAsActiveLocation: boolean) => {
    if (!nmeaInput.trim()) return;
    setNmeaProcessing(true);
    const res = await LocationService.parseAndIngestHardwareNmea(nmeaInput);
    setNmeaResult(res);
    setNmeaProcessing(false);
    if (applyAsActiveLocation && res.valid && res.locationData && onLocationUpdated) {
      onLocationUpdated(res.locationData);
    }
  };

  // Validate anchor and current coordinates before evaluating geofence
  const validAnchor =
    geofenceConfig.anchorLocation &&
    LocationService.isValidCoordinatePair(
      geofenceConfig.anchorLocation.latitude,
      geofenceConfig.anchorLocation.longitude
    )
      ? geofenceConfig.anchorLocation
      : hasUsableLocation && location
      ? { latitude: location.latitude, longitude: location.longitude, address: location.address }
      : null;

  const geofenceEval =
    hasUsableLocation && location && validAnchor
      ? LocationService.checkGeofence(
          location.latitude,
          location.longitude,
          validAnchor.latitude,
          validAnchor.longitude,
          geofenceConfig.radiusKm
        )
      : null;

  const presets = [1, 5, 10, 20, 50];

  // OpenStreetMap bounding box for live marker verification when valid coordinates exist
  const osmEmbedUrl =
    hasUsableLocation && location
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${(location.longitude - 0.015).toFixed(5)}%2C${(
          location.latitude - 0.015
        ).toFixed(5)}%2C${(location.longitude + 0.015).toFixed(5)}%2C${(location.latitude + 0.015).toFixed(
          5
        )}&layer=mapnik&marker=${location.latitude.toFixed(6)}%2C${location.longitude.toFixed(6)}`
      : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Location Permission Rationale Modal */}
      <PermissionRationaleModal
        type="location"
        isOpen={showLocationRationale}
        onClose={() => setShowLocationRationale(false)}
        onPermissionGranted={async () => {
          const fresh = await LocationService.getCurrentLocation();
          if (onLocationUpdated) {
            onLocationUpdated(fresh);
          }
          refreshLocation();
        }}
      />

      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/60 to-slate-900 p-6 border border-cyan-800/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700 flex items-center justify-center">
              <Compass className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-xl font-black text-white">GPS Truth Engine &amp; Geofence 5.0</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700">
              {LocationService.getSourceLabel(location?.source)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Validated device &amp; hardware GPS provider. Checks Android runtime location permission before reading coordinates.
          </p>
        </div>

        <button
          onClick={handleRequestGpsWithPermissionCheck}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-2 shadow-lg transition-colors shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Capturing Fresh GPS...' : 'Refresh GPS Location'}</span>
        </button>
      </div>

      {/* Approximate Location Notice (If user granted Coarse Location only) */}
      {hasUsableLocation && (location?.precision === 'approximate' || (location && location.accuracy > 100)) && (
        <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-700/70 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-white">
                Approximate Location Active (±{location.accuracy}m Accuracy)
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Your device is providing approximate (coarse) coordinates rather than high-precision satellite GPS. Geofencing and regional emergency search remain active, or you can enable <strong>Use precise location</strong> in Android App Settings.
              </p>
            </div>
          </div>
          <button
            onClick={() => permissionService.openAppSettings()}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 flex items-center space-x-1.5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Upgrade in App Settings</span>
          </button>
        </div>
      )}

      {/* Unavailable Location Notice & Permission Recovery */}
      {!hasUsableLocation && (
        <div className="p-5 rounded-2xl bg-rose-950/70 border border-rose-700/70 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">No Validated GPS Coordinates Available</h4>
              <p className="text-slate-300 leading-relaxed">
                {location?.errorReason ||
                  'Location permission has not been granted or device GPS services are disabled. SMART SHIELD never substitutes fabricated or hardcoded coordinates.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(permStatus.location === 'denied' || location?.permissionStatus === 'denied') && (
              <button
                onClick={() => permissionService.openAppSettings()}
                className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-700 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Open App Settings</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={handleRequestGpsWithPermissionCheck}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 cursor-pointer"
            >
              {permStatus.location === 'granted' ? 'Request GPS Fix Now' : 'Grant Location & Fetch GPS'}
            </button>
          </div>
        </div>
      )}

      {/* GEOFENCE BOUNDARY EXIT / ENTER ALERT BANNER */}
      {geofenceEval && (
        <div
          className={`p-5 rounded-3xl border-2 shadow-2xl transition-all ${
            geofenceEval.isInside
              ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-emerald-600/70'
              : 'bg-gradient-to-r from-rose-950 via-red-950 to-slate-900 border-rose-600 animate-pulse'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  geofenceEval.isInside
                    ? 'bg-emerald-900/80 border-emerald-500 text-emerald-300'
                    : 'bg-rose-900/90 border-rose-500 text-rose-300'
                }`}
              >
                {geofenceEval.isInside ? (
                  <ShieldCheck className="w-7 h-7" />
                ) : (
                  <AlertTriangle className="w-7 h-7" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                      geofenceEval.isInside
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : 'bg-rose-950 text-rose-300 border-rose-700'
                    }`}
                  >
                    {geofenceEval.isInside ? 'INSIDE SAFETY ZONE' : 'SAFETY BOUNDARY EXCEEDED!'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {geofenceEval.distanceFromAnchorKm} km from Anchor Center
                  </span>
                </div>

                <h3 className="text-lg font-black text-white mt-1">
                  {geofenceEval.isInside
                    ? `Within ${geofenceConfig.radiusKm} km Safe Perimeter (${geofenceEval.percentageOfRadius}% of radius)`
                    : `EXCEEDED SAFETY RADIUS by ${(
                        geofenceEval.distanceFromAnchorKm - geofenceConfig.radiusKm
                      ).toFixed(2)} km!`}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {geofenceEval.isInside
                    ? 'Geofence active. You will be alerted immediately if you travel outside your selected radius.'
                    : 'Out-of-bounds detected. Reset your anchor if you have relocated, or notify trusted contacts.'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
              <button
                onClick={setAnchorToCurrentLocation}
                disabled={!hasUsableLocation}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                title="Reset anchor point to your current physical GPS location"
              >
                <LocateFixed className="w-3.5 h-3.5 text-cyan-400" />
                <span>Reset Anchor Here</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Coordinate & Address Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Status Badge & Freshness Score */}
        <div className="rounded-2xl bg-slate-900 p-5 border border-slate-800 space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Location Status &amp; Source
          </span>

          <div className="flex items-center space-x-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                hasUsableLocation && location?.status === 'live'
                  ? 'bg-emerald-950 border border-emerald-700 text-emerald-400'
                  : hasUsableLocation
                  ? 'bg-amber-950 border border-amber-700 text-amber-400'
                  : 'bg-rose-950 border border-rose-700 text-rose-400'
              }`}
            >
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-black text-white uppercase">
                {hasUsableLocation ? location?.status : 'Unavailable'}
              </h4>
              <p className="text-xs text-slate-400">
                Permission:{' '}
                <strong className="text-cyan-300">
                  {location?.permissionStatus || 'prompt'}
                </strong>{' '}
                • Precision:{' '}
                <strong className="text-emerald-300">
                  {hasUsableLocation ? location?.precision || 'precise' : 'none'}
                </strong>
              </p>
            </div>
          </div>

          {freshness && (
            <div className={`p-3 rounded-xl border text-xs font-semibold space-y-1 ${freshness.badgeColor}`}>
              <div>Freshness: {freshness.label}</div>
              <div className="text-[11px] opacity-90">Source: {freshness.sourceLabel}</div>
            </div>
          )}

          {hasUsableLocation && location?.status === 'stale' && (
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800 text-[11px] text-amber-200 font-semibold space-y-1">
              <p className="flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Showing Cached Last-Known Location</span>
              </p>
              <p className="text-[10px] text-slate-300 font-normal">
                Captured at {new Date(location.timestamp).toLocaleTimeString()}. SMART SHIELD never marks an older cached fix as live.
              </p>
            </div>
          )}
        </div>

        {/* Resolved Street Address */}
        <div className="rounded-2xl bg-slate-900 p-5 border border-slate-800 space-y-2 md:col-span-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>Resolved Physical Address</span>
          </span>
          <h3 className="text-lg font-bold text-white leading-snug">
            {hasUsableLocation
              ? location?.address
              : location?.errorReason || 'Waiting for location permission and valid GPS fix...'}
          </h3>
          <p className="text-xs text-slate-400">
            City:{' '}
            <strong className="text-slate-200">
              {hasUsableLocation ? location?.city || 'Verified Coordinate Zone' : 'Unavailable'}
            </strong>{' '}
            • Country:{' '}
            <strong className="text-slate-200">
              {hasUsableLocation ? location?.country || 'Detected via Nominatim' : 'Unavailable'}
            </strong>
          </p>
          {location?.rawNmea && (
            <p className="text-[11px] font-mono text-emerald-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 truncate">
              Raw NMEA: {location.rawNmea}
            </p>
          )}
        </div>
      </div>

      {/* Raw Coordinate Specifications */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl bg-slate-900 p-4 border border-slate-800">
          <span className="text-[11px] text-slate-500 uppercase font-semibold">Latitude</span>
          <p className="text-base font-extrabold text-white font-mono mt-0.5">
            {hasUsableLocation && location ? `${location.latitude.toFixed(6)}°` : 'Unavailable'}
          </p>
        </div>

        <div className="rounded-xl bg-slate-900 p-4 border border-slate-800">
          <span className="text-[11px] text-slate-500 uppercase font-semibold">Longitude</span>
          <p className="text-base font-extrabold text-white font-mono mt-0.5">
            {hasUsableLocation && location ? `${location.longitude.toFixed(6)}°` : 'Unavailable'}
          </p>
        </div>

        <div className="rounded-xl bg-slate-900 p-4 border border-slate-800">
          <span className="text-[11px] text-slate-500 uppercase font-semibold">Horizontal Accuracy</span>
          <p className="text-base font-extrabold text-cyan-400 font-mono mt-0.5">
            {hasUsableLocation && location ? `± ${location.accuracy} meters` : 'Unavailable'}
          </p>
        </div>

        <div className="rounded-xl bg-slate-900 p-4 border border-slate-800">
          <span className="text-[11px] text-slate-500 uppercase font-semibold">Last Update Time</span>
          <p className="text-base font-extrabold text-slate-300 font-mono mt-0.5">
            {hasUsableLocation && location ? new Date(location.timestamp).toLocaleTimeString() : 'No Fix Yet'}
          </p>
        </div>
      </div>

      {/* FEATURE: OFFLINE MODE TOGGLE & INDEXEDDB SNAPSHOT PERSISTENCE CONTROL PANEL */}
      <div
        className={`rounded-3xl p-6 border shadow-2xl transition-all space-y-4 ${
          offlineModeActive
            ? 'bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-amber-500/80 shadow-amber-950/50'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                offlineModeActive
                  ? 'bg-amber-950 border-amber-500 text-amber-400 animate-pulse'
                  : 'bg-cyan-950 border-cyan-800 text-cyan-400'
              }`}
            >
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h3 className="text-base font-black text-white">Emergency Offline Mode (IndexedDB)</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    offlineModeActive
                      ? 'bg-amber-950 text-amber-300 border-amber-600'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {offlineModeActive ? 'ACTIVE (INDEXEDDB PERSISTED)' : 'DISABLED (NETWORK MAP)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Toggle Offline Mode to persist the active map view, 3x3 tile grid, and emergency markers in IndexedDB for emergency access when connectivity is lost.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => handleToggleOfflineMode(!offlineModeActive)}
              disabled={isSavingSnapshot}
              className={`px-5 py-2.5 rounded-2xl font-black text-xs flex items-center space-x-2 shadow-xl border transition-all cursor-pointer ${
                offlineModeActive
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow-amber-950'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-cyan-950'
              }`}
            >
              {isSavingSnapshot ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Persisting to IndexedDB...</span>
                </>
              ) : offlineModeActive ? (
                <>
                  <ToggleRight className="w-5 h-5 text-slate-950" />
                  <span>Offline Mode ON</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-cyan-200" />
                  <span>Enable Offline Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Snapshot Status Notification Banner */}
        {snapshotStatusMsg && (
          <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-700 text-amber-200 text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{snapshotStatusMsg}</span>
          </div>
        )}

        {/* Persisted View Details */}
        {offlineSnapshot && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-850 pb-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <span>IndexedDB Snapshot Record: {offlineSnapshot.id}</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  (Saved {new Date(offlineSnapshot.savedAtIso).toLocaleTimeString()})
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleToggleOfflineMode(true)}
                  disabled={isSavingSnapshot || !hasUsableLocation}
                  className="px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-cyan-300 border border-cyan-800 text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                  title="Update snapshot with latest location fix and markers"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Snapshot</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearOfflineSnapshot}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-850 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-750 hover:border-rose-800 text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                  title="Remove saved snapshot from IndexedDB"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Persisted Coordinates</span>
                <p className="font-mono text-white font-bold truncate">
                  {offlineSnapshot.location.latitude.toFixed(5)}°, {offlineSnapshot.location.longitude.toFixed(5)}°
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Geofence Perimeter</span>
                <p className="font-mono text-cyan-300 font-bold">
                  {offlineSnapshot.geofenceRadiusKm} km Safety Radius
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold">IndexedDB Markers Saved</span>
                <p className="font-mono text-emerald-400 font-bold">
                  {offlineSnapshot.markers.length} Active Markers Stored
                </p>
              </div>
            </div>

            {/* List of Persisted Markers */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Saved Offline Map Markers in IndexedDB:
              </span>
              <div className="flex flex-wrap gap-2">
                {offlineSnapshot.markers.map((m) => (
                  <span
                    key={m.id}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-semibold flex items-center space-x-1.5"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: m.color || '#38bdf8' }}
                    />
                    <span className="text-white">{m.title}</span>
                    <span className="text-slate-400 font-mono text-[10px]">({m.subtitle})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* OFFLINE EMERGENCY MAP TILE STORAGE & CACHE CONTROL PANEL */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-white">Offline Emergency Map Tile Cache</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  cacheMeta.tileCount > 0
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}>
                  {cacheMeta.tileCount > 0 ? `${cacheMeta.tileCount} Tiles Stored` : 'Uncached'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pre-downloads OpenStreetMap tiles into local IndexedDB storage so your last known emergency location renders seamlessly without cellular data.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleCacheMapTiles}
              disabled={!hasUsableLocation || cachingProgress !== null}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center space-x-2 shadow-lg transition-all cursor-pointer"
            >
              {cachingProgress !== null ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Caching Tiles ({cachingProgress}%)...</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="w-4 h-4" />
                  <span>Pre-Cache Map Tiles Now</span>
                </>
              )}
            </button>

            <button
              onClick={() => setSimulateOfflineMap(!simulateOfflineMap)}
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer ${
                simulateOfflineMap
                  ? 'bg-amber-950/80 border-amber-600 text-amber-200'
                  : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
              }`}
              title="Test offline map tile rendering without internet"
            >
              {simulateOfflineMap ? <WifiOff className="w-4 h-4 text-amber-400" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
              <span>{simulateOfflineMap ? 'Simulating Offline Mode' : 'Simulate Offline'}</span>
            </button>

            {cacheMeta.tileCount > 0 && (
              <button
                onClick={handleClearTileCache}
                className="p-2.5 rounded-xl bg-slate-850 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-750 hover:border-rose-800 transition-colors cursor-pointer"
                title="Clear local tile cache"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Caching Progress Bar */}
        {cachingProgress !== null && (
          <div className="space-y-1.5 animate-in fade-in">
            <div className="flex justify-between text-xs font-bold text-cyan-300">
              <span>Downloading Area Map Tiles (Zoom 13–16)...</span>
              <span>{cachingProgress}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-200"
                style={{ width: `${cachingProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Cache Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Cached Coordinates</span>
            <p className="font-mono text-slate-200 truncate font-semibold">
              {cacheMeta.cachedCenter
                ? `${cacheMeta.cachedCenter.latitude.toFixed(4)}°, ${cacheMeta.cachedCenter.longitude.toFixed(4)}°`
                : 'No Center Cached'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Last Tile Sync</span>
            <p className="font-mono text-slate-200 font-semibold">
              {cacheMeta.lastUpdatedIso
                ? new Date(cacheMeta.lastUpdatedIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Never'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Estimated Storage Used</span>
            <p className="font-mono text-cyan-300 font-semibold">
              {cacheMeta.approxSizeKb ? `~${cacheMeta.approxSizeKb} KB` : '0 KB'}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Live & Offline Tile Map Renderer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Validated Coordinate Map Card (Dual-Mode: Online OSM vs Offline IndexedDB Tile Renderer) */}
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              <span>{(offlineModeActive || !isOnline || simulateOfflineMap) ? 'Offline Emergency Tactical Map' : 'Live Validated Coordinate Map'}</span>
            </h3>
            {(offlineModeActive || !isOnline || simulateOfflineMap) ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-950 text-amber-300 border border-amber-700 flex items-center space-x-1">
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span>INDEXEDDB OFFLINE MODE</span>
              </span>
            ) : (
              hasUsableLocation && location && (
                <span className="text-xs font-mono text-emerald-300">
                  Pin: {location.latitude.toFixed(5)}°, {location.longitude.toFixed(5)}°
                </span>
              )
            )}
          </div>

          {/* DUAL MODE MAP RENDERER */}
          {(offlineModeActive || !isOnline || simulateOfflineMap) && hasUsableLocation && location ? (
            /* OFFLINE TACTICAL MAP RENDERER (IndexedDB 3x3 Cached Tile Composite) */
            <div className="relative w-full h-80 rounded-2xl overflow-hidden border-2 border-amber-600/70 bg-slate-950">
              {offlineLoading ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                  <span className="text-xs text-amber-200 font-mono">Loading cached tile grid from IndexedDB...</span>
                </div>
              ) : (
                <div className="relative w-full h-full">
                  {/* 3x3 Cached Map Tile Composite Grid */}
                  <div className="grid grid-cols-3 grid-rows-3 w-full h-full opacity-90">
                    {offlineTileGrid.length > 0 ? (
                      offlineTileGrid.map((tile, idx) => (
                        <img
                          key={tile.dataUrl ? tile.dataUrl.slice(0, 30) + idx : idx}
                          src={tile.dataUrl}
                          alt={`Cached tile ${tile.z}/${tile.x}/${tile.y}`}
                          className="w-full h-full object-cover border border-slate-900/40"
                        />
                      ))
                    ) : (
                      <div className="col-span-3 row-span-3 bg-slate-950 flex flex-col items-center justify-center text-center p-4">
                        <HardDrive className="w-8 h-8 text-amber-400 mb-2" />
                        <p className="text-xs text-amber-200 font-bold">No Cached Map Tiles Found</p>
                        <p className="text-[11px] text-slate-400">Tap "Pre-Cache Map Tiles Now" above while online.</p>
                      </div>
                    )}
                  </div>

                  {/* Tactical Target Marker & Accuracy Ring Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    {/* Accuracy Radius Pulse Circle */}
                    <div
                      className="rounded-full border-2 border-cyan-400 bg-cyan-500/20 animate-ping absolute"
                      style={{ width: '80px', height: '80px' }}
                    />
                    <div
                      className="rounded-full border border-cyan-400/80 bg-cyan-500/10 absolute"
                      style={{ width: '120px', height: '120px' }}
                    />

                    {/* Pin Marker */}
                    <div className="relative z-20 flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-rose-600 border-2 border-white flex items-center justify-center shadow-2xl shadow-rose-950">
                        <MapPin className="w-4 h-4 text-white" />
                      </div>
                      <span className="mt-1 px-2 py-0.5 rounded bg-slate-950/90 text-cyan-300 font-mono text-[10px] font-extrabold border border-cyan-700 shadow-lg">
                        {location.latitude.toFixed(5)}°, {location.longitude.toFixed(5)}°
                      </span>
                    </div>

                    {/* Persisted Markers Overlay Badge */}
                    {offlineSnapshot?.markers && offlineSnapshot.markers.length > 0 && (
                      <div className="absolute top-3 left-3 bg-slate-950/95 backdrop-blur-md p-2 rounded-xl border border-slate-800 text-[10px] space-y-1 z-20 max-w-[180px]">
                        <span className="font-bold text-amber-400 block uppercase border-b border-slate-800 pb-0.5">
                          IndexedDB Persisted Markers:
                        </span>
                        {offlineSnapshot.markers.slice(0, 4).map((m) => (
                          <div key={m.id} className="flex items-center space-x-1 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: m.color || '#38bdf8' }}
                            />
                            <span className="text-white truncate font-medium">{m.title}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Compass Rose */}
                    <div className="absolute top-3 right-3 bg-slate-950/90 p-2 rounded-xl border border-slate-800 text-[10px] font-mono text-cyan-400 flex flex-col items-center space-y-0.5 z-20">
                      <span className="font-bold">N ▲</span>
                      <span className="text-[9px] text-slate-400">Tactical Grid</span>
                    </div>
                  </div>

                  {/* Offline Status Footer Bar */}
                  <div className="absolute bottom-3 left-3 right-3 bg-slate-950/95 backdrop-blur-md px-3 py-2 rounded-xl border border-amber-700/80 text-xs flex items-center justify-between z-20">
                    <div className="flex items-center space-x-2 truncate">
                      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-amber-200 font-mono text-[11px] truncate">
                        Offline Cache: {location.address || `${location.latitude.toFixed(5)}°, ${location.longitude.toFixed(5)}°`}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 shrink-0 ml-2">
                      IndexedDB Cached
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : osmEmbedUrl && hasUsableLocation && location ? (
            /* ONLINE LIVE OPENSTREETMAP IFRAME VIEW */
            <div className="relative w-full h-80 rounded-2xl overflow-hidden border border-slate-700 bg-slate-950">
              <iframe
                key={`${location.latitude.toFixed(5)}_${location.longitude.toFixed(5)}`}
                title="Live Verified GPS Map"
                src={osmEmbedUrl}
                className="w-full h-full border-0"
                loading="lazy"
              />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-slate-950/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-200 font-mono truncate">
                  Marker synced to {location.latitude.toFixed(5)}°, {location.longitude.toFixed(5)}° (±{location.accuracy}m)
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1 shrink-0 ml-2"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Google Maps</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="w-full h-80 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-400" />
              <h4 className="text-sm font-bold text-white">Map Waiting for Valid GPS Coordinates</h4>
              <p className="text-xs text-slate-400 max-w-sm">
                SMART SHIELD does not jump to a fabricated default city when GPS is unavailable. Grant location permission or tap Refresh GPS to center the map on your true position.
              </p>
            </div>
          )}
        </div>

        {/* Geofence Radar Visualization */}
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>{geofenceConfig.radiusKm} km Geofence Perimeter Radar</span>
            </h3>
            <span className="text-xs font-mono text-cyan-300">
              Anchor:{' '}
              {validAnchor
                ? `${validAnchor.latitude.toFixed(4)}°, ${validAnchor.longitude.toFixed(4)}°`
                : 'Awaiting Fix'}
            </span>
          </div>

          <div className="relative w-full h-80 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center p-4">
            <div
              className={`absolute rounded-full border-2 transition-all duration-500 flex items-center justify-center ${
                geofenceEval?.isInside !== false
                  ? 'bg-cyan-500/10 border-cyan-400/60 shadow-2xl shadow-cyan-950'
                  : 'bg-rose-500/15 border-rose-500 shadow-2xl shadow-rose-950 animate-pulse'
              }`}
              style={{ width: '240px', height: '240px' }}
            >
              <div
                className="w-full h-full rounded-full border border-dashed border-cyan-300/40 animate-spin"
                style={{ animationDuration: '40s' }}
              />
              <span className="absolute top-2 right-6 text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-900/90 text-cyan-300 border border-cyan-700">
                {geofenceConfig.radiusKm} km Safety Radius
              </span>
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-purple-500/30 border-2 border-purple-400 flex items-center justify-center shadow-lg">
                <MapPin className="w-5 h-5 text-purple-300" />
              </div>
              <div className="mt-1 bg-slate-900/90 text-purple-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-purple-700">
                {validAnchor ? 'Anchor Center' : 'No Anchor Yet'}
              </div>
            </div>

            {geofenceEval && (
              <div
                className="absolute z-20 transition-all duration-700 flex flex-col items-center"
                style={{
                  top: `${Math.max(
                    15,
                    Math.min(80, 50 - Math.min(35, (geofenceEval.distanceFromAnchorKm / geofenceConfig.radiusKm) * 30))
                  )}%`,
                  left: `${Math.max(
                    15,
                    Math.min(80, 50 + Math.min(35, (geofenceEval.distanceFromAnchorKm / geofenceConfig.radiusKm) * 25))
                  )}%`
                }}
              >
                <div
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shadow-xl ${
                    geofenceEval.isInside
                      ? 'bg-cyan-500/30 border-cyan-400 text-cyan-300'
                      : 'bg-rose-600 border-white text-white animate-bounce'
                  }`}
                >
                  <Navigation className="w-4 h-4 transform -rotate-45" />
                </div>
                <div className="mt-1 bg-slate-900/95 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-slate-700 shadow-md">
                  You ({geofenceEval.distanceFromAnchorKm} km)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADJUSTABLE GEOFENCE CONTROL PANEL */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-black text-white flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <span>Custom Safety Monitoring Radius Settings</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select preset distances or adjust slider from 1 km to 50 km. Default is set to 5 km.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-850 px-3 py-1.5 rounded-xl border border-slate-750">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-extrabold text-white">
              Active Radius: <span className="text-cyan-400">{geofenceConfig.radiusKm} km</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Quick Preset Selection
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {presets.map((preset) => {
                const isSelected = geofenceConfig.radiusKm === preset;
                return (
                  <button
                    key={preset}
                    onClick={() => updateRadius(preset)}
                    className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all border shadow-md cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-600 text-white border-cyan-400 shadow-cyan-950 scale-105'
                        : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-750'
                    }`}
                  >
                    {preset} km {preset === 5 ? '(Default)' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 bg-slate-850 p-4 rounded-2xl border border-slate-750">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-400">Custom Distance Adjustment</span>
              <span className="text-cyan-400 font-black text-sm">
                {geofenceConfig.radiusKm} km ({geofenceConfig.radiusKm * 1000} m)
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={geofenceConfig.radiusKm}
              onChange={(e) => updateRadius(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-850 border border-slate-750">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-700 flex items-center justify-center text-purple-300">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Auto-Notify Trusted Contacts on Zone Exit</h4>
                <p className="text-[11px] text-slate-400">Sends Google Maps coordinates link if boundary is crossed</p>
              </div>
            </div>

            <button
              onClick={toggleNotifyOnExit}
              className={`w-12 h-6 rounded-full transition-colors relative border cursor-pointer ${
                geofenceConfig.notifyOnExit ? 'bg-purple-600 border-purple-400' : 'bg-slate-800 border-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  geofenceConfig.notifyOnExit ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-850 border border-slate-750">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-300">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="max-w-[200px]">
                <h4 className="text-xs font-bold text-white">Configured Safe Zone Anchor</h4>
                <p className="text-[11px] text-slate-400 truncate">
                  {validAnchor
                    ? `${validAnchor.latitude.toFixed(5)}°, ${validAnchor.longitude.toFixed(5)}°`
                    : 'Waiting for first valid GPS fix'}
                </p>
              </div>
            </div>

            <button
              onClick={setAnchorToCurrentLocation}
              disabled={!hasUsableLocation}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
            >
              Update Anchor
            </button>
          </div>
        </div>
      </div>

      {/* PHASE 5: ESP32-C3 MINI + NEO-6M HARDWARE GPS NMEA 0183 PARSER & VERIFIER */}
      <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-4">
        <button
          onClick={() => setShowHardwareNmeaPanel(!showHardwareNmeaPanel)}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                ESP32-C3 Mini + NEO-6M Hardware GPS Telemetry &amp; NMEA 0183 Verifier
              </h4>
              <p className="text-xs text-slate-400">
                Inspect UART (9600 baud) NMEA sentences, degrees+minutes to decimal degree conversion, and hardware GPS source isolation
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-cyan-300 px-3 py-1 rounded-lg bg-cyan-950 border border-cyan-800">
            {showHardwareNmeaPanel ? 'Hide Hardware Diagnostics' : 'Inspect Hardware GPS'}
          </span>
        </button>

        {showHardwareNmeaPanel && (
          <div className="pt-4 border-t border-slate-800 space-y-4 text-xs text-slate-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h5 className="font-bold text-cyan-300 flex items-center space-x-1.5">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>ESP32-C3 Mini &harr; NEO-6M Hardware Wiring &amp; UART Spec</span>
                </h5>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                  <li>
                    <strong>UART Cross-Connection:</strong> NEO-6M <code>TX</code> &rarr; ESP32-C3 <code>RX (GPIO20)</code>; NEO-6M <code>RX</code> &rarr; ESP32-C3 <code>TX (GPIO21)</code>; <code>VCC</code> &rarr; 3.3V/5V; <code>GND</code> &rarr; GND.
                  </li>
                  <li>
                    <strong>Baud Rate:</strong> Standard NEO-6M default is <code>9600 bps (8N1)</code>. Mismatched baud rate produces garbled characters.
                  </li>
                  <li>
                    <strong>NMEA Conversion Formula:</strong> Raw NMEA <code>ddmm.mmmm</code> is converted strictly via <code>Decimal = degrees + (minutes / 60)</code> with negative sign for <code>S</code> or <code>W</code>.
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <label className="font-bold text-white block">
                  Test / Ingest Raw NMEA Sentence ($GPGGA or $GPRMC):
                </label>
                <input
                  type="text"
                  value={nmeaInput}
                  onChange={(e) => setNmeaInput(e.target.value)}
                  className="w-full bg-slate-900 text-cyan-300 font-mono text-[11px] px-3 py-2 rounded-lg border border-slate-700"
                  placeholder="$GPGGA,123519,1304.9620,N,08016.2420,E,1,08,0.9,14.2,M,46.9,M,,*72"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNmeaInput('$GPGGA,123519,1304.9620,N,08016.2420,E,1,08,0.9,14.2,M,46.9,M,,*72')}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] border border-slate-800 cursor-pointer"
                  >
                    Sample $GPGGA (8 SatLock)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNmeaInput('$GPRMC,123519,A,1258.2960,N,07735.6760,E,022.4,084.4,230394,003.1,W*6A')}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] border border-slate-800 cursor-pointer"
                  >
                    Sample $GPRMC (Active)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNmeaInput('$GPGGA,123519,0000.0000,N,00000.0000,E,0,00,99.9,0.0,M,0.0,M,,*47')}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-rose-300 text-[10px] border border-slate-800 cursor-pointer"
                  >
                    Sample No-Fix (Rejected)
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleParseNmea(false)}
                    disabled={nmeaProcessing}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] border border-slate-700 cursor-pointer"
                  >
                    Validate NMEA Math Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleParseNmea(true)}
                    disabled={nmeaProcessing}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] cursor-pointer"
                  >
                    Ingest as Hardware GPS Fix (Source: ESP32-NEO6M)
                  </button>
                </div>
              </div>
            </div>

            {nmeaResult && (
              <div
                className={`p-4 rounded-xl border ${
                  nmeaResult.valid
                    ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-700 text-rose-200'
                }`}
              >
                {nmeaResult.valid ? (
                  <div className="space-y-1">
                    <div className="font-bold text-white">
                      ✓ Valid {nmeaResult.sentenceType} Hardware Fix — {nmeaResult.fixStatus}
                    </div>
                    <div className="font-mono text-[11px]">
                      Converted Decimal Coordinates: {nmeaResult.latitude?.toFixed(6)}°, {nmeaResult.longitude?.toFixed(6)}° (±{nmeaResult.accuracyMeters}m) • Source tagged: esp32-neo6m
                    </div>
                  </div>
                ) : (
                  <div className="font-bold">✗ NMEA Validation Rejected: {nmeaResult.error}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ANDROID NATIVE PERMISSIONS & FUSED LOCATION PROVIDER DOCUMENTATION */}
      <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-4">
        <button
          onClick={() => setShowAndroidGuide(!showAndroidGuide)}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-300">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Android Studio &amp; Native FusedLocation + WebView Bridge Specs
              </h4>
              <p className="text-xs text-slate-400">
                Click to view the repaired manifest, WebChromeClient geolocation bridge, and APK build instructions
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-400 px-3 py-1 rounded-lg bg-emerald-950 border border-emerald-800">
            {showAndroidGuide ? 'Hide Guide' : 'View Android Specs'}
          </span>
        </button>

        {showAndroidGuide && (
          <div className="pt-4 border-t border-slate-800 space-y-3 text-xs text-slate-300">
            <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 space-y-2">
              <h5 className="font-bold text-emerald-300 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Repaired /android/app/src/main/AndroidManifest.xml (Directly Under &lt;manifest&gt; Root):</span>
              </h5>
              <pre className="p-3 bg-slate-950 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto">
{`<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 space-y-2">
              <h5 className="font-bold text-cyan-300 flex items-center space-x-1.5">
                <Info className="w-4 h-4 text-cyan-400" />
                <span>Why Permissions Were Previously Missing &amp; How It Was Repaired:</span>
              </h5>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                <li>
                  <strong>WebChromeClient Origin-Validated Bridges:</strong> <code>MainActivity.kt</code> implements both <code>WebChromeClient.onGeolocationPermissionsShowPrompt</code> and <code>WebChromeClient.onPermissionRequest</code> (mapping <code>RESOURCE_VIDEO_CAPTURE</code> &rarr; <code>CAMERA</code> and <code>RESOURCE_AUDIO_CAPTURE</code> &rarr; <code>RECORD_AUDIO</code>), strictly validating the requesting HTTPS origin against the trusted Smart Shield domain before launching <code>ActivityResultContracts.RequestMultiplePermissions()</code>.
                </li>
                <li>
                  <strong>Unified Package ID:</strong> Debug and release builds both use <code>com.smartshield.womensafety</code> (<code>minSdk = 24</code>, <code>targetSdk = 34</code>), ensuring <code>Settings.ACTION_APPLICATION_DETAILS_SETTINGS</code> opens the exact installed app settings screen.
                </li>
                <li>
                  <strong>Automatic onResume() Recheck:</strong> Every time the Activity resumes from Android Settings, <code>MainActivity.onResume()</code> re-evaluates OS permission states and syncs with the WebView via <code>window.onAndroidPermissionUpdate</code>.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
