/**
 * Central Permission Service for SMART SHIELD
 * Manages runtime permission requests, Android Native WebView bridge integration,
 * precise vs approximate location states, camera/microphone access for SOS Evidence & Voice AI,
 * automatic onResume / visibilitychange rechecks, and permanent denial recovery actions.
 */

export type PermissionType = 'location' | 'microphone' | 'camera' | 'notifications' | 'backgroundLocation';

export interface PermissionStatus {
  location: 'granted' | 'denied' | 'prompt' | 'approximate' | 'unknown';
  locationPrecision: 'precise' | 'approximate' | 'none';
  locationServicesEnabled: boolean;
  microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
  notifications: 'granted' | 'denied' | 'prompt' | 'unknown';
  backgroundLocation: 'granted' | 'denied' | 'prompt' | 'unknown';
  isAndroidBridgeActive?: boolean;
  permanentDenialDetected?: boolean;
  locationPermanentlyDenied?: boolean;
  cameraPermanentlyDenied?: boolean;
  microphonePermanentlyDenied?: boolean;
  lastCheckedAt?: number;
}

class PermissionService {
  private currentStatus: PermissionStatus = {
    location: 'unknown',
    locationPrecision: 'none',
    locationServicesEnabled: true,
    microphone: 'unknown',
    camera: 'unknown',
    notifications: 'unknown',
    backgroundLocation: 'unknown',
    isAndroidBridgeActive: false,
    permanentDenialDetected: false,
    locationPermanentlyDenied: false,
    cameraPermanentlyDenied: false,
    microphonePermanentlyDenied: false,
    lastCheckedAt: Date.now()
  };

  private listeners: ((status: PermissionStatus) => void)[] = [];
  private bridgeUpdateResolvers: ((status: PermissionStatus) => void)[] = [];

  constructor() {
    this.initAndroidBridgeCallback();
    this.checkAllPermissions();

    // Recheck permissions whenever the app resumes from Android Settings, permission dialog, or background
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.checkAllPermissions();
      });
      window.addEventListener('pageshow', () => {
        this.checkAllPermissions();
      });
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.checkAllPermissions();
          }
        });
      }
    }
  }

  private initAndroidBridgeCallback() {
    if (typeof window === 'undefined') return;
    window.onAndroidPermissionUpdate = (permJson: string) => {
      try {
        const parsed = typeof permJson === 'string' ? JSON.parse(permJson) : permJson;
        this.applyNativeBridgeState(parsed);
        this.notify();
        const resolvers = [...this.bridgeUpdateResolvers];
        this.bridgeUpdateResolvers = [];
        resolvers.forEach((resolve) => resolve({ ...this.currentStatus }));
      } catch (e) {
        console.warn('Failed to parse Android permission callback:', e);
      }
    };
  }

  private waitForBridgePermissionUpdate(timeoutMs: number = 3500): Promise<PermissionStatus> {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.bridgeUpdateResolvers = this.bridgeUpdateResolvers.filter((r) => r !== onUpdate);
          resolve({ ...this.currentStatus });
        }
      }, timeoutMs);

      const onUpdate = (status: PermissionStatus) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(status);
        }
      };

      this.bridgeUpdateResolvers.push(onUpdate);
    });
  }

  private applyNativeBridgeState(parsed: any) {
    if (!parsed || typeof parsed !== 'object') return;

    this.currentStatus.isAndroidBridgeActive = true;
    this.currentStatus.lastCheckedAt = Date.now();

    const fine = Boolean(parsed.fineLocationGranted);
    const coarse = Boolean(parsed.coarseLocationGranted);
    const gpsEnabled = parsed.locationServicesEnabled !== false;
    const locPermDenied = Boolean(parsed.locationPermanentlyDenied ?? parsed.permanentlyDenied);

    this.currentStatus.locationServicesEnabled = gpsEnabled;
    this.currentStatus.locationPermanentlyDenied = locPermDenied;

    if (fine) {
      this.currentStatus.location = 'granted';
      this.currentStatus.locationPrecision = 'precise';
      this.currentStatus.locationPermanentlyDenied = false;
    } else if (coarse) {
      this.currentStatus.location = 'approximate';
      this.currentStatus.locationPrecision = 'approximate';
      this.currentStatus.locationPermanentlyDenied = false;
    } else if (locPermDenied) {
      this.currentStatus.location = 'denied';
      this.currentStatus.locationPrecision = 'none';
    } else {
      this.currentStatus.location = 'prompt';
      this.currentStatus.locationPrecision = 'none';
    }

    // Apply Camera permission state from Android bridge if provided
    if ('cameraGranted' in parsed || 'cameraPermanentlyDenied' in parsed) {
      const camGranted = Boolean(parsed.cameraGranted);
      const camPermDenied = Boolean(parsed.cameraPermanentlyDenied);
      this.currentStatus.cameraPermanentlyDenied = camPermDenied;
      if (camGranted) {
        this.currentStatus.camera = 'granted';
        this.currentStatus.cameraPermanentlyDenied = false;
      } else if (camPermDenied) {
        this.currentStatus.camera = 'denied';
      } else if (this.currentStatus.camera !== 'denied') {
        this.currentStatus.camera = 'prompt';
      }
    }

    // Apply Microphone permission state from Android bridge if provided
    if ('microphoneGranted' in parsed || 'microphonePermanentlyDenied' in parsed) {
      const micGranted = Boolean(parsed.microphoneGranted);
      const micPermDenied = Boolean(parsed.microphonePermanentlyDenied);
      this.currentStatus.microphonePermanentlyDenied = micPermDenied;
      if (micGranted) {
        this.currentStatus.microphone = 'granted';
        this.currentStatus.microphonePermanentlyDenied = false;
      } else if (micPermDenied) {
        this.currentStatus.microphone = 'denied';
      } else if (this.currentStatus.microphone !== 'denied') {
        this.currentStatus.microphone = 'prompt';
      }
    }

    this.currentStatus.permanentDenialDetected = Boolean(
      this.currentStatus.locationPermanentlyDenied ||
        this.currentStatus.cameraPermanentlyDenied ||
        this.currentStatus.microphonePermanentlyDenied
    );
  }

  public subscribe(listener: (status: PermissionStatus) => void) {
    this.listeners.push(listener);
    listener({ ...this.currentStatus });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.currentStatus.lastCheckedAt = Date.now();
    this.currentStatus.permanentDenialDetected = Boolean(
      this.currentStatus.locationPermanentlyDenied ||
        this.currentStatus.cameraPermanentlyDenied ||
        this.currentStatus.microphonePermanentlyDenied
    );
    const snapshot = { ...this.currentStatus };
    this.listeners.forEach((l) => l(snapshot));
  }

  public async checkAllPermissions(): Promise<PermissionStatus> {
    let bridgeProvidedLocation = false;
    let bridgeProvidedCamera = false;
    let bridgeProvidedMicrophone = false;

    // 0. Check Native Android Bridge first if running inside the Smart Shield Android APK
    if (typeof window !== 'undefined' && window.SmartShieldAndroidBridge) {
      try {
        const raw = window.SmartShieldAndroidBridge.getPermissionStateJson();
        if (raw) {
          const parsed = JSON.parse(raw);
          this.applyNativeBridgeState(parsed);
          bridgeProvidedLocation = 'fineLocationGranted' in parsed || 'coarseLocationGranted' in parsed;
          bridgeProvidedCamera = 'cameraGranted' in parsed;
          bridgeProvidedMicrophone = 'microphoneGranted' in parsed;
        }
      } catch (e) {
        console.warn('Native bridge permission check failed, supplementing with Web Permissions API:', e);
      }
    }

    // 1. Check Web Permissions API for any permission not already resolved by the Android Bridge
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      if (!bridgeProvidedLocation) {
        try {
          const locPerm = await navigator.permissions.query({ name: 'geolocation' as any });
          if (locPerm.state === 'granted') {
            this.currentStatus.location =
              this.currentStatus.locationPrecision === 'approximate' ? 'approximate' : 'granted';
            if (this.currentStatus.locationPrecision === 'none') {
              this.currentStatus.locationPrecision = 'precise';
            }
            this.currentStatus.locationPermanentlyDenied = false;
          } else if (locPerm.state === 'denied') {
            this.currentStatus.location = 'denied';
            this.currentStatus.locationPrecision = 'none';
            this.currentStatus.locationPermanentlyDenied = true;
          } else {
            this.currentStatus.location = 'prompt';
          }

          locPerm.onchange = () => {
            this.checkAllPermissions();
          };
        } catch {
          if (this.currentStatus.location === 'unknown') {
            this.currentStatus.location = 'prompt';
          }
        }
      }

      if (!bridgeProvidedMicrophone) {
        try {
          const micPerm = await navigator.permissions.query({ name: 'microphone' as any });
          if (micPerm.state === 'granted') {
            this.currentStatus.microphone = 'granted';
            this.currentStatus.microphonePermanentlyDenied = false;
          } else if (micPerm.state === 'denied') {
            this.currentStatus.microphone = 'denied';
            this.currentStatus.microphonePermanentlyDenied = true;
          } else {
            this.currentStatus.microphone = 'prompt';
          }

          micPerm.onchange = () => {
            this.checkAllPermissions();
          };
        } catch {
          if (this.currentStatus.microphone === 'unknown') {
            this.currentStatus.microphone = 'prompt';
          }
        }
      }

      if (!bridgeProvidedCamera) {
        try {
          const camPerm = await navigator.permissions.query({ name: 'camera' as any });
          if (camPerm.state === 'granted') {
            this.currentStatus.camera = 'granted';
            this.currentStatus.cameraPermanentlyDenied = false;
          } else if (camPerm.state === 'denied') {
            this.currentStatus.camera = 'denied';
            this.currentStatus.cameraPermanentlyDenied = true;
          } else {
            this.currentStatus.camera = 'prompt';
          }

          camPerm.onchange = () => {
            this.checkAllPermissions();
          };
        } catch {
          if (this.currentStatus.camera === 'unknown') {
            this.currentStatus.camera = 'prompt';
          }
        }
      }

      // Check Notification Permission
      try {
        const notifPerm = await navigator.permissions.query({ name: 'notifications' as any });
        if (notifPerm.state === 'granted') {
          this.currentStatus.notifications = 'granted';
        } else if (notifPerm.state === 'denied') {
          this.currentStatus.notifications = 'denied';
        } else {
          this.currentStatus.notifications = 'prompt';
        }
      } catch {
        if (typeof Notification !== 'undefined') {
          this.currentStatus.notifications = Notification.permission as any;
        }
      }
    } else {
      if (typeof Notification !== 'undefined') {
        this.currentStatus.notifications = Notification.permission as any;
      }
    }

    if (!bridgeProvidedLocation) {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        this.currentStatus.locationServicesEnabled = true;
      } else {
        this.currentStatus.locationServicesEnabled = false;
      }
    }

    this.notify();
    return this.getStatus();
  }

  /**
   * Request Location Permission explicitly (supports both Native Android Bridge and Web Geolocation with Coarse Fallback)
   */
  public async requestLocationPermission(): Promise<{ granted: boolean; status: PermissionStatus }> {
    if (typeof window !== 'undefined' && window.SmartShieldAndroidBridge) {
      try {
        const updatePromise = this.waitForBridgePermissionUpdate(4000);
        window.SmartShieldAndroidBridge.requestLocationPermission();
        await updatePromise;
        if (this.currentStatus.location === 'granted' || this.currentStatus.location === 'approximate') {
          return { granted: true, status: this.getStatus() };
        }
        if (this.currentStatus.location === 'denied') {
          return { granted: false, status: this.getStatus() };
        }
      } catch (e) {
        console.warn('Android bridge requestLocationPermission call failed:', e);
      }
    }

    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        this.currentStatus.location = 'denied';
        this.currentStatus.locationServicesEnabled = false;
        this.notify();
        resolve({ granted: false, status: this.getStatus() });
        return;
      }

      // Attempt high-accuracy first; if it times out (e.g., user granted Approximate Location only), try coarse
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const acc = position.coords.accuracy || 25;
          const isPrecise = acc <= 100;
          this.currentStatus.location = isPrecise ? 'granted' : 'approximate';
          this.currentStatus.locationPrecision = isPrecise ? 'precise' : 'approximate';
          this.currentStatus.locationServicesEnabled = true;
          this.currentStatus.locationPermanentlyDenied = false;
          this.notify();
          resolve({ granted: true, status: this.getStatus() });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            this.currentStatus.location = 'denied';
            this.currentStatus.locationPrecision = 'none';
            this.currentStatus.locationPermanentlyDenied = true;
            this.notify();
            resolve({ granted: false, status: this.getStatus() });
            return;
          }

          // Fallback to coarse/approximate location request
          navigator.geolocation.getCurrentPosition(
            (coarsePos) => {
              const acc = coarsePos.coords.accuracy || 150;
              const isPrecise = acc <= 100;
              this.currentStatus.location = isPrecise ? 'granted' : 'approximate';
              this.currentStatus.locationPrecision = isPrecise ? 'precise' : 'approximate';
              this.currentStatus.locationServicesEnabled = true;
              this.currentStatus.locationPermanentlyDenied = false;
              this.notify();
              resolve({ granted: true, status: this.getStatus() });
            },
            (secondErr) => {
              if (secondErr.code === secondErr.PERMISSION_DENIED) {
                this.currentStatus.location = 'denied';
                this.currentStatus.locationPrecision = 'none';
                this.currentStatus.locationPermanentlyDenied = true;
              } else if (secondErr.code === secondErr.POSITION_UNAVAILABLE) {
                this.currentStatus.locationServicesEnabled = false;
              }
              this.notify();
              resolve({ granted: false, status: this.getStatus() });
            },
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 15000 }
          );
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
      );
    });
  }

  /**
   * Opens Android Application Details Settings (via Native Bridge if in APK, or Android Intent URI)
   */
  public openAppSettings(): boolean {
    if (typeof window !== 'undefined' && window.SmartShieldAndroidBridge) {
      try {
        window.SmartShieldAndroidBridge.openAppSettings();
        return true;
      } catch (e) {
        console.warn('Bridge openAppSettings failed:', e);
      }
    }

    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    if (isAndroid && typeof window !== 'undefined') {
      try {
        window.location.href =
          'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:com.smartshield.womensafety;end';
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Opens Android Device Location Services Settings
   */
  public openLocationServicesSettings(): boolean {
    if (typeof window !== 'undefined' && window.SmartShieldAndroidBridge) {
      try {
        window.SmartShieldAndroidBridge.openLocationSettings();
        return true;
      } catch (e) {
        console.warn('Bridge openLocationSettings failed:', e);
      }
    }

    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    if (isAndroid && typeof window !== 'undefined') {
      try {
        window.location.href = 'intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end';
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Request Microphone Permission explicitly for Voice AI, Voice SOS & SOS Audio Evidence
   */
  public async requestMicrophonePermission(): Promise<boolean> {
    // 1. If running in the Android WebView APK, request OS RECORD_AUDIO permission via bridge first
    if (typeof window !== 'undefined' && window.SmartShieldAndroidBridge?.requestMicrophonePermission) {
      try {
        const updatePromise = this.waitForBridgePermissionUpdate(4000);
        window.SmartShieldAndroidBridge.requestMicrophonePermission();
        await updatePromise;
        if (this.currentStatus.microphone === 'denied') {
          return false;
        }
      } catch (e) {
        console.warn('Android bridge requestMicrophonePermission failed:', e);
      }
    }

    // 2. Request Web media stream (triggers WebChromeClient.onPermissionRequest in WebView)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (this.currentStatus.isAndroidBridgeActive && this.currentStatus.microphone === 'granted') {
        return true;
      }
      this.currentStatus.microphone = 'denied';
      this.notify();
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      this.currentStatus.microphone = 'granted';
      this.currentStatus.microphonePermanentlyDenied = false;
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('Microphone permission request denied:', err);
      this.currentStatus.microphone = 'denied';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        this.currentStatus.microphonePermanentlyDenied = true;
      }
      this.notify();
      return false;
    }
  }

  /**
   * Request Camera Permission explicitly for SOS Video Evidence
   */
  public async requestCameraPermission(): Promise<boolean> {
    // 1. If running in the Android WebView APK, request OS CAMERA permission via bridge first
    if (typeof window !== 'undefined' && window.SmartShieldAndroidBridge?.requestCameraPermission) {
      try {
        const updatePromise = this.waitForBridgePermissionUpdate(4000);
        window.SmartShieldAndroidBridge.requestCameraPermission();
        await updatePromise;
        if (this.currentStatus.camera === 'denied') {
          return false;
        }
      } catch (e) {
        console.warn('Android bridge requestCameraPermission failed:', e);
      }
    }

    // 2. Request Web video stream (triggers WebChromeClient.onPermissionRequest in WebView)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (this.currentStatus.isAndroidBridgeActive && this.currentStatus.camera === 'granted') {
        return true;
      }
      this.currentStatus.camera = 'denied';
      this.notify();
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach((track) => track.stop());
      this.currentStatus.camera = 'granted';
      this.currentStatus.cameraPermanentlyDenied = false;
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('Camera permission request denied:', err);
      this.currentStatus.camera = 'denied';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        this.currentStatus.cameraPermanentlyDenied = true;
      }
      this.notify();
      return false;
    }
  }

  /**
   * Request both Camera & Microphone for SOS Evidence recording with graceful fallback
   */
  public async requestMediaPermissions(): Promise<{ camera: boolean; microphone: boolean }> {
    if (typeof window !== 'undefined' && window.SmartShieldAndroidBridge?.requestMediaPermissions) {
      try {
        const updatePromise = this.waitForBridgePermissionUpdate(4500);
        window.SmartShieldAndroidBridge.requestMediaPermissions();
        await updatePromise;
      } catch (e) {
        console.warn('Android bridge requestMediaPermissions failed:', e);
      }
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        camera: this.currentStatus.camera === 'granted',
        microphone: this.currentStatus.microphone === 'granted'
      };
    }

    // Try combined camera + audio first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
      this.currentStatus.camera = 'granted';
      this.currentStatus.microphone = 'granted';
      this.currentStatus.cameraPermanentlyDenied = false;
      this.currentStatus.microphonePermanentlyDenied = false;
      this.notify();
      return { camera: true, microphone: true };
    } catch {
      // If combined request fails (e.g., user denied camera or device has no camera), test individually
      const cameraGranted = await this.requestCameraPermission();
      const micGranted = await this.requestMicrophonePermission();
      return { camera: cameraGranted, microphone: micGranted };
    }
  }

  /**
   * Request all 3 core Smart Shield safety permissions (Location, Camera, Microphone) in sequence
   * in response to an explicit user onboarding action.
   */
  public async requestAllSafetyPermissions(): Promise<PermissionStatus> {
    await this.requestLocationPermission();
    await this.requestMediaPermissions();
    return this.checkAllPermissions();
  }

  /**
   * Request Notification Permission
   */
  public async requestNotificationPermission(): Promise<boolean> {
    if (typeof Notification === 'undefined') {
      this.currentStatus.notifications = 'denied';
      this.notify();
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.currentStatus.notifications = permission as any;
      this.notify();
      return permission === 'granted';
    } catch {
      this.currentStatus.notifications = 'denied';
      this.notify();
      return false;
    }
  }

  public openAppSettingsInstructions(): string {
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    if (isAndroid || this.currentStatus.isAndroidBridgeActive) {
      return "To enable permissions on Android: Tap 'Open Android App Settings' below (or go to Android Settings > Apps > Smart Shield > Permissions), and allow Location ('Allow only while using the app' with 'Use precise location'), Camera, and Microphone.";
    }
    return "To re-enable permissions: Click the site settings icon in your browser address bar, select 'Permissions', and set Location, Camera, and Microphone to 'Allow'.";
  }

  public getStatus(): PermissionStatus {
    return { ...this.currentStatus };
  }
}

export const permissionService = new PermissionService();
