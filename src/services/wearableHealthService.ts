export type WearableProvider = 'Google Fit' | 'Apple Health' | 'Fitbit' | 'Garmin' | 'Samsung Health';

export interface VitalsReading {
  heartRate: number; // BPM
  spO2: number; // percentage %
  stressLevel: number; // 0 - 100
  skinTemp: number; // Celsius °C
  respiratoryRate: number; // breaths/min
  wearableBattery: number; // %
  lastSyncTime: string;
  isAnomaly: boolean;
  anomalyReason?: string;
}

export interface WearableConfig {
  connected: boolean;
  provider: WearableProvider;
  autoSOSEnabled: boolean;
  lowHRThreshold: number; // default 40 bpm
  highHRThreshold: number; // default 160 bpm
}

export interface VitalsAlertLog {
  id: string;
  timestamp: string;
  heartRate: number;
  triggerType: 'low_hr' | 'high_hr';
  status: 'sos_dispatched' | 'warning';
  details: string;
}

const WEARABLE_CONFIG_KEY = 'smartshield_wearable_health_config_v1';
const WEARABLE_LOGS_KEY = 'smartshield_wearable_vitals_logs_v1';

const DEFAULT_CONFIG: WearableConfig = {
  connected: true,
  provider: 'Google Fit',
  autoSOSEnabled: true,
  lowHRThreshold: 40,
  highHRThreshold: 160
};

type VitalsListener = (reading: VitalsReading) => void;
type SOSCallback = (reason: string) => void;

class WearableHealthService {
  private config: WearableConfig;
  private listeners: Set<VitalsListener> = new Set();
  private sosCallbacks: Set<SOSCallback> = new Set();
  private timer: any = null;
  private logs: VitalsAlertLog[] = [];
  private forcedAnomaly: 'low_hr' | 'high_hr' | null = null;
  private currentReading: VitalsReading = {
    heartRate: 72,
    spO2: 98,
    stressLevel: 28,
    skinTemp: 36.6,
    respiratoryRate: 15,
    wearableBattery: 88,
    lastSyncTime: new Date().toLocaleTimeString(),
    isAnomaly: false
  };

  constructor() {
    this.config = this.loadConfig();
    this.logs = this.loadLogs();
    this.startStreaming();
  }

  private loadConfig(): WearableConfig {
    try {
      const raw = localStorage.getItem(WEARABLE_CONFIG_KEY);
      if (raw) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch {}
    return DEFAULT_CONFIG;
  }

  private saveConfig() {
    try {
      localStorage.setItem(WEARABLE_CONFIG_KEY, JSON.stringify(this.config));
    } catch {}
  }

  private loadLogs(): VitalsAlertLog[] {
    try {
      const raw = localStorage.getItem(WEARABLE_LOGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  private saveLogs() {
    try {
      localStorage.setItem(WEARABLE_LOGS_KEY, JSON.stringify(this.logs.slice(0, 30)));
    } catch {}
  }

  public getConfig(): WearableConfig {
    return { ...this.config };
  }

  public updateConfig(update: Partial<WearableConfig>) {
    this.config = { ...this.config, ...update };
    this.saveConfig();
  }

  public getLogs(): VitalsAlertLog[] {
    return [...this.logs];
  }

  public subscribeVitals(listener: VitalsListener): () => void {
    this.listeners.add(listener);
    listener(this.currentReading);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onEmergencySOS(callback: SOSCallback): () => void {
    this.sosCallbacks.add(callback);
    return () => {
      this.sosCallbacks.delete(callback);
    };
  }

  public connect(provider: WearableProvider) {
    this.config.connected = true;
    this.config.provider = provider;
    this.saveConfig();
    this.forceTick();
  }

  public disconnect() {
    this.config.connected = false;
    this.saveConfig();
    this.forceTick();
  }

  public simulateVitalsAnomaly(type: 'low_hr' | 'high_hr' | 'normal') {
    if (type === 'normal') {
      this.forcedAnomaly = null;
    } else {
      this.forcedAnomaly = type;
    }
    this.forceTick();
  }

  private startStreaming() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.tickVitals();
    }, 4000);
  }

  private forceTick() {
    this.tickVitals();
  }

  private tickVitals() {
    if (!this.config.connected) {
      this.currentReading = {
        ...this.currentReading,
        lastSyncTime: 'Disconnected',
        isAnomaly: false
      };
      this.notifyListeners();
      return;
    }

    let nextHR = Math.floor(68 + Math.random() * 12); // normal 68-80

    if (this.forcedAnomaly === 'low_hr') {
      nextHR = Math.floor(34 + Math.random() * 4); // 34 - 37 bpm (< 40)
    } else if (this.forcedAnomaly === 'high_hr') {
      nextHR = Math.floor(166 + Math.random() * 10); // 166 - 176 bpm (> 160)
    }

    const lowThreshold = this.config.lowHRThreshold;
    const highThreshold = this.config.highHRThreshold;

    let isAnomaly = false;
    ariaReason: String;
    let anomalyReason: string | undefined = undefined;

    if (nextHR < lowThreshold) {
      isAnomaly = true;
      anomalyReason = `Critical Low Heart Rate (${nextHR} BPM < threshold ${lowThreshold} BPM)`;
    } else if (nextHR > highThreshold) {
      isAnomaly = true;
      anomalyReason = `Dangerous Heart Rate Spike (${nextHR} BPM > threshold ${highThreshold} BPM)`;
    }

    this.currentReading = {
      heartRate: nextHR,
      spO2: Math.min(100, Math.max(95, Math.floor(97 + Math.random() * 3))),
      stressLevel: isAnomaly ? 88 : Math.floor(20 + Math.random() * 20),
      skinTemp: Number((36.4 + Math.random() * 0.4).toFixed(1)),
      respiratoryRate: isAnomaly ? 24 : Math.floor(14 + Math.random() * 4),
      wearableBattery: Math.max(12, this.currentReading.wearableBattery - (Math.random() < 0.1 ? 1 : 0)),
      lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isAnomaly,
      anomalyReason
    };

    this.notifyListeners();

    // Trigger automatic SOS if autoSOSEnabled and anomaly is detected
    if (isAnomaly && anomalyReason) {
      const triggerType: 'low_hr' | 'high_hr' = nextHR < lowThreshold ? 'low_hr' : 'high_hr';
      const logItem: VitalsAlertLog = {
        id: `vitals-log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        heartRate: nextHR,
        triggerType,
        status: this.config.autoSOSEnabled ? 'sos_dispatched' : 'warning',
        details: anomalyReason
      };
      
      // Prevent duplicate rapid logs
      if (!this.logs.some((l) => Date.now() - new Date(`1970-01-01T${l.timestamp}`).getTime() < 10000 && l.heartRate === nextHR)) {
        this.logs.unshift(logItem);
        this.saveLogs();
      }

      if (this.config.autoSOSEnabled) {
        this.sosCallbacks.forEach((cb) => cb(`Wearable Emergency Alert: ${anomalyReason}`));
      }
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.currentReading));
  }
}

export const wearableHealthService = new WearableHealthService();
