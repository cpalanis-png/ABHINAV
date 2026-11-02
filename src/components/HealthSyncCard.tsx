import React, { useState, useEffect } from 'react';
import {
  Activity,
  Heart,
  Droplets,
  Thermometer,
  Zap,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Radio,
  Clock,
  Watch,
  Smartphone,
  ChevronDown
} from 'lucide-react';
import {
  wearableHealthService,
  WearableProvider,
  VitalsReading,
  WearableConfig,
  VitalsAlertLog
} from '../services/wearableHealthService';

interface HealthSyncCardProps {
  onTriggerSOS: (reason?: string) => void;
}

export const HealthSyncCard: React.FC<HealthSyncCardProps> = ({ onTriggerSOS }) => {
  const [config, setConfig] = useState<WearableConfig>(() => wearableHealthService.getConfig());
  const [reading, setReading] = useState<VitalsReading>({
    heartRate: 72,
    spO2: 98,
    stressLevel: 28,
    skinTemp: 36.6,
    respiratoryRate: 15,
    wearableBattery: 88,
    lastSyncTime: 'Just now',
    isAnomaly: false
  });
  const [logs, setLogs] = useState<VitalsAlertLog[]>(() => wearableHealthService.getLogs());
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showThresholdEdit, setShowThresholdEdit] = useState(false);
  const [tempLow, setTempLow] = useState(config.lowHRThreshold);
  const [tempHigh, setTempHigh] = useState(config.highHRThreshold);

  useEffect(() => {
    // Subscribe to live vitals reading
    const unsubscribeVitals = wearableHealthService.subscribeVitals((newReading) => {
      setReading(newReading);
      setLogs(wearableHealthService.getLogs());
    });

    // Subscribe to auto emergency SOS trigger
    const unsubscribeSOS = wearableHealthService.onEmergencySOS((reason) => {
      onTriggerSOS(reason);
    });

    return () => {
      unsubscribeVitals();
      unsubscribeSOS();
    };
  }, [onTriggerSOS]);

  const handleProviderSelect = (provider: WearableProvider) => {
    wearableHealthService.connect(provider);
    setConfig(wearableHealthService.getConfig());
    setShowProviderDropdown(false);
  };

  const handleToggleAutoSOS = () => {
    const nextVal = !config.autoSOSEnabled;
    wearableHealthService.updateConfig({ autoSOSEnabled: nextVal });
    setConfig(wearableHealthService.getConfig());
  };

  const handleSaveThresholds = () => {
    const low = Math.max(30, Math.min(60, tempLow));
    const high = Math.max(120, Math.min(200, tempHigh));
    wearableHealthService.updateConfig({ lowHRThreshold: low, highHRThreshold: high });
    setConfig(wearableHealthService.getConfig());
    setShowThresholdEdit(false);
  };

  const providers: WearableProvider[] = [
    'Google Fit',
    'Apple Health',
    'Fitbit',
    'Garmin',
    'Samsung Health'
  ];

  const getHRStatusTone = (hr: number) => {
    if (hr < config.lowHRThreshold || hr > config.highHRThreshold) {
      return 'text-rose-400 bg-rose-950/80 border-rose-600 animate-pulse';
    }
    if (hr < 50 || hr > 100) {
      return 'text-amber-300 bg-amber-950/70 border-amber-600';
    }
    return 'text-emerald-400 bg-emerald-950/60 border-emerald-600';
  };

  return (
    <section
      data-testid="health-sync-card"
      className="rounded-3xl bg-slate-900/90 p-6 sm:p-7 border border-slate-800 shadow-xl space-y-6"
    >
      {/* Header & Provider Integration Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1">
              <Watch className="w-3 h-3 text-rose-400" />
              <span>Wearable Health Sync</span>
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                config.connected
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {config.connected ? `Connected: ${config.provider}` : 'Disconnected'}
            </span>
          </div>

          <h3 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
            <Activity className="w-6 h-6 text-rose-400 shrink-0" />
            <span>Wearable Vitals &amp; Emergency Heart Rate Monitor</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time health telemetry synced from Google Fit, Apple Health, or smartwatch. Automatically triggers emergency SOS if heart rate drops below {config.lowHRThreshold} BPM or spikes above {config.highHRThreshold} BPM.
          </p>
        </div>

        {/* Provider Switcher Dropdown & Connect Toggle */}
        <div className="relative self-start sm:self-center">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowProviderDropdown((prev) => !prev)}
              data-testid="wearable-provider-dropdown-btn"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-purple-400" />
              <span>{config.provider}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (config.connected) {
                  wearableHealthService.disconnect();
                  setConfig(wearableHealthService.getConfig());
                } else {
                  wearableHealthService.connect(config.provider);
                  setConfig(wearableHealthService.getConfig());
                }
              }}
              data-testid="wearable-connect-toggle-btn"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                config.connected
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  : 'bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white shadow-md'
              }`}
            >
              {config.connected ? 'Disconnect' : 'Connect Wearable'}
            </button>
          </div>

          {showProviderDropdown && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-slate-950 border border-slate-800 p-2 shadow-2xl z-20 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
                Select Wearable API
              </div>
              {providers.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleProviderSelect(p)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                    config.provider === p
                      ? 'bg-purple-950 text-purple-200 font-bold'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <span>{p}</span>
                  {config.provider === p && <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Emergency Threshold Anomaly Warning Banner (If Vitals Anomaly Triggered) */}
      {reading.isAnomaly && (
        <div
          data-testid="wearable-anomaly-banner"
          className="p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl animate-pulse"
        >
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase">
                  DANGER DETECTED
                </span>
                <span className="text-xs font-bold text-rose-200">
                  {reading.anomalyReason}
                </span>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                {config.autoSOSEnabled
                  ? 'Automatic Emergency SOS dispatched to all saved emergency contacts with live GPS coordinates.'
                  : 'Auto-SOS is disabled. Tap below to trigger instant emergency alert immediately.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onTriggerSOS(reading.anomalyReason)}
            data-testid="wearable-manual-sos-override-btn"
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shrink-0 cursor-pointer"
          >
            Trigger Instant SOS Now
          </button>
        </div>
      )}

      {/* Live Vitals Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Heart Rate Card */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-rose-950/90 border border-rose-700/60 flex items-center justify-center">
                <Heart className="w-4 h-4 text-rose-400 animate-bounce" />
              </div>
              <span className="text-xs font-bold text-slate-300">Heart Rate</span>
            </div>
            <span
              data-testid="vitals-hr-badge"
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getHRStatusTone(
                reading.heartRate
              )}`}
            >
              {reading.heartRate < config.lowHRThreshold
                ? 'Critically Low'
                : reading.heartRate > config.highHRThreshold
                ? 'High Spike'
                : 'Normal'}
            </span>
          </div>

          <div className="flex items-baseline space-x-2">
            <span
              data-testid="vitals-heart-rate-val"
              className={`text-3xl font-black font-mono tracking-tight ${
                reading.heartRate < config.lowHRThreshold || reading.heartRate > config.highHRThreshold
                  ? 'text-rose-400'
                  : 'text-white'
              }`}
            >
              {config.connected ? reading.heartRate : '--'}
            </span>
            <span className="text-xs text-slate-400 font-bold">BPM</span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Safety Thresholds:</span>
            <span className="font-mono text-cyan-300 font-bold">
              {config.lowHRThreshold} – {config.highHRThreshold} BPM
            </span>
          </div>
        </div>

        {/* SpO2 Blood Oxygen Card */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-950/90 border border-cyan-700/60 flex items-center justify-center">
                <Droplets className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xs font-bold text-slate-300">Blood Oxygen</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
              Optimal
            </span>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {config.connected ? `${reading.spO2}%` : '--'}
            </span>
            <span className="text-xs text-slate-400 font-bold">SpO2</span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Respiratory:</span>
            <span className="font-mono text-slate-200 font-bold">
              {config.connected ? `${reading.respiratoryRate} rpm` : '--'}
            </span>
          </div>
        </div>

        {/* Stress & Trauma Sensor Card */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-purple-950/90 border border-purple-700/60 flex items-center justify-center">
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-xs font-bold text-slate-300">Stress Index</span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                reading.stressLevel > 70
                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                  : 'bg-purple-950 text-purple-300 border-purple-800'
              }`}
            >
              {reading.stressLevel > 70 ? 'High Distress' : 'Relaxed'}
            </span>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {config.connected ? reading.stressLevel : '--'}
            </span>
            <span className="text-xs text-slate-400 font-bold">/ 100</span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Autonomic State:</span>
            <span className="font-mono text-purple-300 font-bold">
              {reading.stressLevel > 70 ? 'Distress Signal' : 'Normal Baseline'}
            </span>
          </div>
        </div>

        {/* Body Temp & Battery Status Card */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-amber-950/90 border border-amber-700/60 flex items-center justify-center">
                <Thermometer className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-xs font-bold text-slate-300">Skin Temp</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
              {config.connected ? `${reading.wearableBattery}% Bat` : '--'}
            </span>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {config.connected ? `${reading.skinTemp}°C` : '--'}
            </span>
            <span className="text-xs text-slate-400 font-bold">Body</span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Last Telemetry Sync:</span>
            <span className="font-mono text-slate-300 font-bold">
              {reading.lastSyncTime}
            </span>
          </div>
        </div>
      </div>

      {/* Emergency Control Panel: Auto-SOS Toggle, Threshold Adjuster & Simulation Drill */}
      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-pink-400" />
              <span>Automatic SOS Emergency Rules &amp; Testing</span>
            </h4>
            <p className="text-xs text-slate-400">
              Configurable heart rate limits that trigger automatic emergency contact alerts.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setShowThresholdEdit((prev) => !prev)}
              data-testid="edit-vitals-thresholds-btn"
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700 flex items-center space-x-1 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Adjust Thresholds</span>
            </button>

            {/* Auto-SOS Toggle Switch */}
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <span className="text-xs font-bold text-slate-300">Auto-SOS:</span>
              <button
                type="button"
                onClick={handleToggleAutoSOS}
                data-testid="auto-sos-vitals-toggle-btn"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.autoSOSEnabled ? 'bg-pink-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.autoSOSEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Threshold Edit Drawer */}
        {showThresholdEdit && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Low HR Trigger Limit (&lt; BPM)
              </label>
              <input
                type="number"
                min="30"
                max="60"
                value={tempLow}
                onChange={(e) => setTempLow(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Default: 40 BPM (Bradycardia)</span>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                High HR Trigger Limit (&gt; BPM)
              </label>
              <input
                type="number"
                min="120"
                max="200"
                value={tempHigh}
                onChange={(e) => setTempHigh(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Default: 160 BPM (Tachycardia/Panic)</span>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSaveThresholds}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-xs shadow-md"
              >
                Save Threshold Limits
              </button>
            </div>
          </div>
        )}

        {/* Interactive Testing / Drill Simulation Buttons */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Test Emergency Vitals Triggers:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => wearableHealthService.simulateVitalsAnomaly('low_hr')}
              data-testid="test-low-hr-btn"
              className="p-3 rounded-xl bg-rose-950/70 hover:bg-rose-900/90 border border-rose-700/80 text-rose-200 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <div className="text-left">
                  <div className="font-extrabold">Simulate Low HR Spike</div>
                  <div className="text-[10px] text-rose-300 font-mono">35 BPM (&lt; {config.lowHRThreshold} BPM)</div>
                </div>
              </div>
              <Radio className="w-3.5 h-3.5 text-rose-400 animate-ping" />
            </button>

            <button
              type="button"
              onClick={() => wearableHealthService.simulateVitalsAnomaly('high_hr')}
              data-testid="test-high-hr-btn"
              className="p-3 rounded-xl bg-rose-950/70 hover:bg-rose-900/90 border border-rose-700/80 text-rose-200 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <div className="text-left">
                  <div className="font-extrabold">Simulate High HR Spike</div>
                  <div className="text-[10px] text-rose-300 font-mono">172 BPM (&gt; {config.highHRThreshold} BPM)</div>
                </div>
              </div>
              <Radio className="w-3.5 h-3.5 text-rose-400 animate-ping" />
            </button>

            <button
              type="button"
              onClick={() => wearableHealthService.simulateVitalsAnomaly('normal')}
              data-testid="reset-vitals-btn"
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span>Reset to Normal (72 BPM)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Vitals Audit & SOS Dispatch Log */}
      {logs.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-400 flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Recent Vitals Anomaly Log ({logs.length})</span>
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {logs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="font-mono font-bold text-rose-300">{log.heartRate} BPM</span>
                  <span className="text-slate-300">{log.details}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800">
                    {log.status === 'sos_dispatched' ? 'SOS Dispatched' : 'Alert Recorded'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
