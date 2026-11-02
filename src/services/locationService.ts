import { LocationData, LocationSource } from '../types';

const LAST_VALID_LOCATION_KEY = 'smartshield_last_valid_gps_v5';

declare global {
  interface Window {
    SmartShieldAndroidBridge?: {
      requestLocationPermission: () => void;
      requestCameraPermission?: () => void;
      requestMicrophonePermission?: () => void;
      requestMediaPermissions?: () => void;
      requestSmsPermission?: () => void;
      sendEmergencySms?: (contactId: string, phone: string, message: string) => string;
      openSmsComposer?: (phonesCsv: string, message: string) => void;
      openAppSettings: () => void;
      openLocationSettings: () => void;
      getPermissionStateJson: () => string;
      getNativeLocationJson: () => string;
      requestFreshNativeLocation: () => void;
      pickNativeContact?: () => void;
      isNativeContactPickerAvailable?: () => boolean;
      getPermissionStatus?: () => string;
    };
    onAndroidLocationUpdate?: (locJson: string) => void;
    onAndroidPermissionUpdate?: (permJson: string) => void;
    onAndroidSmsStatusUpdate?: (smsJson: string) => void;
    onAndroidContactPicked?: (result: { name?: string; phone?: string; email?: string; status?: string; error?: string }) => void;
    onAndroidContactPickerCancelled?: () => void;
  }
}

export interface NmeaValidationResult {
  valid: boolean;
  sentenceType?: 'GPGGA' | 'GNGGA' | 'GPRMC' | 'GNRMC' | string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  satellites?: number;
  altitudeMeters?: number | null;
  fixStatus?: string;
  timestampIso?: string;
  error?: string;
  locationData?: LocationData;
}

export class LocationService {
  private static watchId: number | null = null;
  private static currentLocation: LocationData | null = LocationService.loadCachedValidLocation();
  private static listeners: ((loc: LocationData) => void)[] = [];
  private static bridgeInitialized = false;

  private static loadCachedValidLocation(): LocationData | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(LAST_VALID_LOCATION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LocationData;
      if (LocationService.isValidCoordinatePair(parsed.latitude, parsed.longitude)) {
        return {
          ...parsed,
          status: 'stale',
          source: parsed.source || 'last-known-cache'
        };
      }
    } catch {
      // ignore corrupted storage
    }
    return null;
  }

  public static getCachedLocation(): LocationData | null {
    return LocationService.currentLocation || LocationService.loadCachedValidLocation();
  }

  private static saveCachedValidLocation(loc: LocationData) {
    if (typeof localStorage === 'undefined') return;
    if (!LocationService.isValidCoordinatePair(loc.latitude, loc.longitude)) return;
    try {
      localStorage.setItem(LAST_VALID_LOCATION_KEY, JSON.stringify(loc));
    } catch {
      // ignore storage quota errors
    }
  }

  /**
   * Strict coordinate range validation (-90 to 90 lat, -180 to 180 lng, rejecting 0,0 Null Island)
   */
  public static isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
    return (
      typeof lat === 'number' &&
      !isNaN(lat) &&
      isFinite(lat) &&
      typeof lng === 'number' &&
      !isNaN(lng) &&
      isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001)
    );
  }

  /**
   * Checks whether a LocationData object has usable real-world coordinates
   * (either live, imprecise/approximate, or explicitly marked stale last-known fix)
   */
  public static isUsableLocation(loc: LocationData | null | undefined): boolean {
    if (!loc) return false;
    if (loc.status === 'unavailable') return false;
    return LocationService.isValidCoordinatePair(loc.latitude, loc.longitude);
  }

  /**
   * Initializes listener for native Android WebView Bridge callbacks if running inside the APK
   */
  public static initAndroidBridgeListener() {
    if (typeof window === 'undefined' || LocationService.bridgeInitialized) return;
    LocationService.bridgeInitialized = true;

    window.onAndroidLocationUpdate = async (locJson: string) => {
      try {
        const parsed = JSON.parse(locJson);
        if (LocationService.isValidCoordinatePair(parsed.latitude, parsed.longitude)) {
          const acc = Math.round(Number(parsed.accuracy) || 25);
          const resolved = await LocationService.resolveAddressForCoordinates(
            parsed.latitude,
            parsed.longitude,
            acc
          );
          const locData: LocationData = {
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            accuracy: acc,
            altitude: parsed.altitude ?? null,
            heading: parsed.heading ?? null,
            speed: parsed.speed ?? null,
            timestamp: Number(parsed.timestamp) || Date.now(),
            address: resolved.address,
            city: resolved.city,
            state: resolved.state,
            country: resolved.country,
            status: acc > 100 ? 'imprecise' : 'live',
            permissionStatus: 'granted',
            precision: acc <= 100 ? 'precise' : 'approximate',
            source: 'android-bridge'
          };
          LocationService.currentLocation = locData;
          LocationService.saveCachedValidLocation(locData);
          LocationService.notifyListeners(locData);
        }
      } catch (e) {
        console.warn('Failed to parse Android bridge location update:', e);
      }
    };
  }

  private static async resolveAddressForCoordinates(
    lat: number,
    lng: number,
    acc: number
  ): Promise<{ address: string; city: string; state: string; country: string }> {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    let address = `Verified Fix: ${Math.abs(lat).toFixed(5)}°${latDir}, ${Math.abs(lng).toFixed(5)}°${lngDir} (±${acc}m)`;
    let city = '';
    let state = '';
    let country = '';

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(`/api/geocoding/reverse?lat=${lat}&lng=${lng}`, {
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const geoData = await res.json();
        if (geoData.address) address = geoData.address;
        if (geoData.city) city = geoData.city;
        if (geoData.state) state = geoData.state;
        if (geoData.country) country = geoData.country;
      }
    } catch {
      // Retain coordinate string if offline or geocoder times out
    }

    return { address, city, state, country };
  }

  /**
   * Acquires a fresh location fix with bounded timeout and automatic fallback:
   * 1. Native Android Bridge (if running inside Smart Shield Android WebView APK)
   * 2. Browser Geolocation with High Accuracy (GPS hardware)
   * 3. Browser Geolocation with Coarse/Approximate Accuracy (Wi-Fi / Cellular fallback when high-accuracy times out or only approximate permission is granted)
   * 4. Validated last-known location explicitly marked 'stale' (never masquerading as live, never using hardcoded developer coordinates)
   */
  public static async getCurrentLocation(timeoutMs = 8000): Promise<LocationData> {
    LocationService.initAndroidBridgeListener();

    // 1. Check Native Android Bridge if running inside the Android APK WebView
    if (typeof window !== 'undefined' && window.SmartShieldAndroidBridge) {
      try {
        window.SmartShieldAndroidBridge.requestFreshNativeLocation();
        const nativeRaw = window.SmartShieldAndroidBridge.getNativeLocationJson();
        if (nativeRaw) {
          const parsed = JSON.parse(nativeRaw);
          if (LocationService.isValidCoordinatePair(parsed.latitude, parsed.longitude)) {
            const acc = Math.round(Number(parsed.accuracy) || 20);
            const ageMs = Date.now() - (Number(parsed.timestamp) || Date.now());
            const isStale = ageMs > 120000;
            const resolved = await LocationService.resolveAddressForCoordinates(
              parsed.latitude,
              parsed.longitude,
              acc
            );
            const nativeLoc: LocationData = {
              latitude: parsed.latitude,
              longitude: parsed.longitude,
              accuracy: acc,
              timestamp: Number(parsed.timestamp) || Date.now(),
              address: resolved.address,
              city: resolved.city,
              state: resolved.state,
              country: resolved.country,
              status: isStale ? 'stale' : acc > 100 ? 'imprecise' : 'live',
              permissionStatus: 'granted',
              precision: acc <= 100 ? 'precise' : 'approximate',
              source: 'android-bridge'
            };
            LocationService.currentLocation = nativeLoc;
            LocationService.saveCachedValidLocation(nativeLoc);
            LocationService.notifyListeners(nativeLoc);
            return nativeLoc;
          }
        }
      } catch (e) {
        console.warn('Android native bridge location read failed, falling back to Web Geolocation:', e);
      }
    }

    // 2. Check standard Web Geolocation support
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return LocationService.buildFallbackOrUnavailable(
        'denied',
        'Geolocation API is not supported by this browser or WebView environment.'
      );
    }

    // Helper to wrap navigator.geolocation.getCurrentPosition as a Promise
    const requestPosition = (highAccuracy: boolean, maxWaitMs: number, maxAgeMs: number) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        let settled = false;
        const safetyTimer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject({ code: 3, message: 'Bounded GPS timeout exceeded' });
          }
        }, maxWaitMs + 500);

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!settled) {
              settled = true;
              clearTimeout(safetyTimer);
              resolve(pos);
            }
          },
          (err) => {
            if (!settled) {
              settled = true;
              clearTimeout(safetyTimer);
              reject(err);
            }
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: maxWaitMs,
            maximumAge: maxAgeMs
          }
        );
      });

    try {
      // Attempt 1: High-accuracy satellite/fused fix
      let position: GeolocationPosition;
      try {
        position = await requestPosition(true, Math.min(timeoutMs, 7000), 0);
      } catch (firstErr: any) {
        // If user explicitly denied permission (code === 1), do not retry immediately
        if (firstErr && firstErr.code === 1) {
          throw firstErr;
        }
        // Attempt 2: Fallback to coarse / approximate location (essential when user granted Approximate Location only on Android 12+ or when indoor satellite lock times out)
        position = await requestPosition(false, 5000, 15000);
      }

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const acc = Math.max(1, Math.round(position.coords.accuracy || 50));
      const fixTimestamp = position.timestamp ? Number(position.timestamp) : Date.now();
      const now = Date.now();
      // Guard against skewed device timestamps
      const validatedTimestamp =
        fixTimestamp > 0 && Math.abs(now - fixTimestamp) < 86400000 ? fixTimestamp : now;

      if (!LocationService.isValidCoordinatePair(lat, lng)) {
        return LocationService.buildFallbackOrUnavailable(
          'granted',
          'GPS hardware returned coordinates outside valid Earth bounds.'
        );
      }

      const isImprecise = acc > 100;
      const status: 'live' | 'stale' | 'imprecise' | 'unavailable' = isImprecise ? 'imprecise' : 'live';
      const resolved = await LocationService.resolveAddressForCoordinates(lat, lng, acc);

      const locData: LocationData = {
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        altitude: position.coords.altitude,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: validatedTimestamp,
        address: resolved.address,
        city: resolved.city,
        state: resolved.state,
        country: resolved.country,
        status,
        permissionStatus: 'granted',
        precision: isImprecise ? 'approximate' : 'precise',
        source: 'phone-gps'
      };

      LocationService.currentLocation = locData;
      LocationService.saveCachedValidLocation(locData);
      LocationService.notifyListeners(locData);
      return locData;
    } catch (error: any) {
      let permStatus: PermissionState | 'unknown' = 'prompt';
      let errReason = 'Location access unavailable.';

      if (error?.code === 1) {
        permStatus = 'denied';
        errReason =
          'Location permission denied. Open Android Settings > Apps > SMART SHIELD > Permissions > Location, or allow location in your browser prompt.';
      } else if (error?.code === 2) {
        errReason =
          'Device Location Services (GPS/Network) are disabled or unreachable. Please enable Location in Android Quick Settings.';
      } else if (error?.code === 3) {
        errReason =
          'GPS satellite lock timed out. Move near a window or outdoors and tap Refresh GPS.';
      }

      return LocationService.buildFallbackOrUnavailable(permStatus, errReason);
    }
  }

  private static buildFallbackOrUnavailable(
    permStatus: PermissionState | 'unknown',
    errReason: string
  ): LocationData {
    const cached = LocationService.currentLocation || LocationService.loadCachedValidLocation();
    if (cached && LocationService.isValidCoordinatePair(cached.latitude, cached.longitude)) {
      const ageSeconds = Math.max(1, Math.round((Date.now() - cached.timestamp) / 1000));
      const baseAddr = cached.address?.replace(/^\[Last Known Fix.*?\]:\s*/i, '') ||
        `${cached.latitude.toFixed(5)}°, ${cached.longitude.toFixed(5)}°`;
      const staleLoc: LocationData = {
        ...cached,
        status: 'stale',
        permissionStatus: permStatus,
        source: 'last-known-cache',
        errorReason: errReason,
        address: `[Last Known Fix (${ageSeconds}s ago)]: ${baseAddr}`
      };
      LocationService.currentLocation = staleLoc;
      return staleLoc;
    }

    const unavailableLoc: LocationData = {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      timestamp: Date.now(),
      status: 'unavailable',
      permissionStatus: permStatus,
      precision: 'none',
      source: 'none',
      errorReason: errReason,
      address: errReason,
      city: '',
      state: '',
      country: ''
    };
    return unavailableLoc;
  }

  public static startWatching(onChange: (loc: LocationData) => void) {
    LocationService.initAndroidBridgeListener();
    LocationService.listeners.push(onChange);

    if (LocationService.watchId !== null) {
      if (LocationService.currentLocation && LocationService.isUsableLocation(LocationService.currentLocation)) {
        onChange(LocationService.currentLocation);
      }
      return;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    LocationService.watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = Math.max(1, Math.round(position.coords.accuracy || 50));

        if (!LocationService.isValidCoordinatePair(lat, lng)) {
          return;
        }

        const isImprecise = acc > 100;
        const status: 'live' | 'stale' | 'imprecise' | 'unavailable' = isImprecise ? 'imprecise' : 'live';
        const resolved = await LocationService.resolveAddressForCoordinates(lat, lng, acc);

        const locData: LocationData = {
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp ? Number(position.timestamp) : Date.now(),
          address: resolved.address,
          city: resolved.city,
          state: resolved.state,
          country: resolved.country,
          status,
          permissionStatus: 'granted',
          precision: isImprecise ? 'approximate' : 'precise',
          source: 'phone-gps'
        };

        LocationService.currentLocation = locData;
        LocationService.saveCachedValidLocation(locData);
        LocationService.notifyListeners(locData);
      },
      (err) => {
        console.warn('Watch location error:', err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );
  }

  public static stopWatching() {
    if (LocationService.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(LocationService.watchId);
      LocationService.watchId = null;
    }
    LocationService.listeners = [];
  }

  private static notifyListeners(loc: LocationData) {
    LocationService.listeners.forEach((listener) => listener(loc));
  }

  /**
   * PHASE 5 — SMART SHIELD ESP32-C3 Mini + NEO-6M Hardware GPS NMEA 0183 Parser
   * Converts raw NMEA ddmm.mmmm (lat) and dddmm.mmmm (lng) into validated Decimal Degrees:
   *   Decimal degrees = degrees + (minutes / 60)
   *   Negative sign applied for South ('S') latitude and West ('W') longitude.
   */
  public static convertNmeaToDecimalDegrees(rawCoord: string, hemisphere: string): number | null {
    const cleaned = rawCoord.trim();
    const hem = hemisphere.trim().toUpperCase();
    if (!cleaned || !hem) return null;

    const dotIndex = cleaned.indexOf('.');
    if (dotIndex < 3) return null; // Must have at least 1 degree digit + 2 minute digits before decimal point

    const degPartStr = cleaned.slice(0, dotIndex - 2);
    const minPartStr = cleaned.slice(dotIndex - 2);

    const degrees = parseInt(degPartStr, 10);
    const minutes = parseFloat(minPartStr);

    if (isNaN(degrees) || isNaN(minutes) || minutes < 0 || minutes >= 60) {
      return null;
    }

    let decimal = degrees + minutes / 60.0;
    if (hem === 'S' || hem === 'W') {
      decimal = -decimal;
    } else if (hem !== 'N' && hem !== 'E') {
      return null;
    }

    return Math.round(decimal * 1000000) / 1000000;
  }

  /**
   * Verifies optional NMEA 0183 XOR checksum (*XX)
   */
  public static verifyNmeaChecksum(sentence: string): boolean {
    const trimmed = sentence.trim();
    if (!trimmed.startsWith('$')) return false;
    const starIdx = trimmed.indexOf('*');
    if (starIdx === -1) return true; // If no checksum suffix transmitted, allow field validation

    const payload = trimmed.slice(1, starIdx);
    const expectedHex = trimmed.slice(starIdx + 1, starIdx + 3).toUpperCase();
    if (expectedHex.length !== 2) return false;

    let xorSum = 0;
    for (let i = 0; i < payload.length; i++) {
      xorSum ^= payload.charCodeAt(i);
    }
    const calculatedHex = xorSum.toString(16).toUpperCase().padStart(2, '0');
    return calculatedHex === expectedHex;
  }

  /**
   * Parses $GPGGA / $GNGGA or $GPRMC / $GNRMC sentence from ESP32-C3 Mini + NEO-6M GPS module (UART 9600 baud)
   */
  public static async parseAndIngestHardwareNmea(rawSentence: string): Promise<NmeaValidationResult> {
    const line = rawSentence.trim();
    if (!line.startsWith('$')) {
      return { valid: false, error: 'Invalid NMEA frame: must start with $' };
    }

    if (!LocationService.verifyNmeaChecksum(line)) {
      return { valid: false, error: 'NMEA XOR checksum mismatch (*XX verification failed)' };
    }

    const cleanBody = line.split('*')[0];
    const fields = cleanBody.split(',');
    const header = fields[0].slice(1).toUpperCase();

    if (header === 'GPGGA' || header === 'GNGGA') {
      // $GPGGA,hhmmss.ss,llll.ll,a,yyyyy.yy,a,x,xx,x.x,x.x,M,x.x,M,x.x,xxxx*hh
      if (fields.length < 10) {
        return { valid: false, sentenceType: header, error: 'Incomplete GPGGA sentence fields' };
      }
      const fixQuality = parseInt(fields[6] || '0', 10);
      if (isNaN(fixQuality) || fixQuality <= 0) {
        return {
          valid: false,
          sentenceType: header,
          fixStatus: 'No Satellite Fix (Quality 0)',
          error: 'NEO-6M GPS module has not acquired a satellite lock yet (Fix Quality = 0).'
        };
      }

      const lat = LocationService.convertNmeaToDecimalDegrees(fields[2], fields[3]);
      const lng = LocationService.convertNmeaToDecimalDegrees(fields[4], fields[5]);
      if (lat === null || lng === null || !LocationService.isValidCoordinatePair(lat, lng)) {
        return {
          valid: false,
          sentenceType: header,
          error: 'Invalid NMEA coordinate degrees/minutes conversion or out-of-bounds.'
        };
      }

      const satellites = parseInt(fields[7] || '0', 10) || 4;
      const hdop = parseFloat(fields[8] || '1.5') || 1.5;
      const altitude = parseFloat(fields[9] || '0');
      const accuracyMeters = Math.max(3, Math.round(hdop * 5));

      const resolved = await LocationService.resolveAddressForCoordinates(lat, lng, accuracyMeters);
      const locData: LocationData = {
        latitude: lat,
        longitude: lng,
        accuracy: accuracyMeters,
        altitude: isNaN(altitude) ? null : altitude,
        timestamp: Date.now(),
        address: `[ESP32-C3 + NEO-6M Hardware GPS] ${resolved.address}`,
        city: resolved.city,
        state: resolved.state,
        country: resolved.country,
        status: accuracyMeters <= 100 ? 'live' : 'imprecise',
        permissionStatus: 'granted',
        precision: accuracyMeters <= 100 ? 'precise' : 'approximate',
        source: 'esp32-neo6m',
        satellites,
        rawNmea: line
      };

      LocationService.currentLocation = locData;
      LocationService.saveCachedValidLocation(locData);
      LocationService.notifyListeners(locData);

      return {
        valid: true,
        sentenceType: header,
        latitude: lat,
        longitude: lng,
        accuracyMeters,
        satellites,
        altitudeMeters: isNaN(altitude) ? null : altitude,
        fixStatus: `Active 3D Fix (Quality ${fixQuality}, ${satellites} Satellites)`,
        timestampIso: new Date(locData.timestamp).toISOString(),
        locationData: locData
      };
    }

    if (header === 'GPRMC' || header === 'GNRMC') {
      // $GPRMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,ddmmyy,x.x,a*hh
      if (fields.length < 7) {
        return { valid: false, sentenceType: header, error: 'Incomplete GPRMC sentence fields' };
      }
      const statusChar = (fields[2] || 'V').toUpperCase();
      if (statusChar !== 'A') {
        return {
          valid: false,
          sentenceType: header,
          fixStatus: 'Void / Receiver Warning (V)',
          error: 'NEO-6M GPRMC status is V (Void — no active satellite fix).'
        };
      }

      const lat = LocationService.convertNmeaToDecimalDegrees(fields[3], fields[4]);
      const lng = LocationService.convertNmeaToDecimalDegrees(fields[5], fields[6]);
      if (lat === null || lng === null || !LocationService.isValidCoordinatePair(lat, lng)) {
        return {
          valid: false,
          sentenceType: header,
          error: 'Invalid GPRMC coordinate degrees/minutes conversion.'
        };
      }

      const knots = parseFloat(fields[7] || '0');
      const speedMps = isNaN(knots) ? null : Math.round(knots * 0.514444 * 100) / 100;
      const accuracyMeters = 8;

      const resolved = await LocationService.resolveAddressForCoordinates(lat, lng, accuracyMeters);
      const locData: LocationData = {
        latitude: lat,
        longitude: lng,
        accuracy: accuracyMeters,
        speed: speedMps,
        timestamp: Date.now(),
        address: `[ESP32-C3 + NEO-6M Hardware GPS] ${resolved.address}`,
        city: resolved.city,
        state: resolved.state,
        country: resolved.country,
        status: 'live',
        permissionStatus: 'granted',
        precision: 'precise',
        source: 'esp32-neo6m',
        rawNmea: line
      };

      LocationService.currentLocation = locData;
      LocationService.saveCachedValidLocation(locData);
      LocationService.notifyListeners(locData);

      return {
        valid: true,
        sentenceType: header,
        latitude: lat,
        longitude: lng,
        accuracyMeters,
        fixStatus: 'Active Validated Fix (Status A)',
        timestampIso: new Date(locData.timestamp).toISOString(),
        locationData: locData
      };
    }

    return {
      valid: false,
      sentenceType: header,
      error: `Unsupported NMEA sentence type "${header}". Expected $GPGGA, $GNGGA, $GPRMC, or $GNRMC.`
    };
  }

  public static getSourceLabel(source?: LocationSource): string {
    switch (source) {
      case 'esp32-neo6m':
        return 'ESP32-C3 + NEO-6M Hardware GPS (UART)';
      case 'android-bridge':
        return 'Android Native FusedLocationProvider';
      case 'phone-gps':
        return 'Device GPS / Geolocation Sensor';
      case 'last-known-cache':
        return 'Cached Last-Known Fix (Stale)';
      default:
        return 'No Verified GPS Source';
    }
  }

  public static getFreshnessScore(loc: LocationData): {
    secondsOld: number;
    isFresh: boolean;
    badgeColor: string;
    label: string;
    sourceLabel: string;
  } {
    const secondsOld = Math.max(0, Math.round((Date.now() - loc.timestamp) / 1000));
    const sourceLabel = LocationService.getSourceLabel(loc.source);

    if (loc.status === 'unavailable' || !LocationService.isValidCoordinatePair(loc.latitude, loc.longitude)) {
      return {
        secondsOld,
        isFresh: false,
        badgeColor: 'bg-rose-950 text-rose-300 border-rose-700',
        label: 'GPS Unavailable',
        sourceLabel
      };
    }
    if (loc.status === 'stale' || secondsOld > 120) {
      return {
        secondsOld,
        isFresh: false,
        badgeColor: 'bg-amber-950 text-amber-300 border-amber-700',
        label: `Last Known (${secondsOld}s ago, ±${loc.accuracy}m)`,
        sourceLabel
      };
    }
    if (loc.status === 'imprecise' || loc.accuracy > 100) {
      return {
        secondsOld,
        isFresh: true,
        badgeColor: 'bg-yellow-950 text-yellow-300 border-yellow-700',
        label: `Approximate (±${loc.accuracy}m, ${secondsOld}s ago)`,
        sourceLabel
      };
    }
    return {
      secondsOld,
      isFresh: true,
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-700',
      label: `Verified Live (±${loc.accuracy}m, ${secondsOld}s ago)`,
      sourceLabel
    };
  }

  /**
   * Calculates Great-Circle distance using Haversine formula in kilometers
   */
  public static calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (!LocationService.isValidCoordinatePair(lat1, lon1) || !LocationService.isValidCoordinatePair(lat2, lon2)) {
      return 0;
    }
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  /**
   * Evaluates if current location is within configured safety radius from anchor
   */
  public static checkGeofence(
    currentLat: number,
    currentLng: number,
    anchorLat: number,
    anchorLng: number,
    radiusKm: number
  ): { isInside: boolean; distanceFromAnchorKm: number; percentageOfRadius: number } | null {
    if (
      !LocationService.isValidCoordinatePair(currentLat, currentLng) ||
      !LocationService.isValidCoordinatePair(anchorLat, anchorLng)
    ) {
      return null;
    }
    const dist = LocationService.calculateDistanceKm(currentLat, currentLng, anchorLat, anchorLng);
    const percentage = Math.min(100, Math.round((dist / Math.max(0.1, radiusKm)) * 100));
    return {
      isInside: dist <= radiusKm,
      distanceFromAnchorKm: dist,
      percentageOfRadius: percentage
    };
  }
}
