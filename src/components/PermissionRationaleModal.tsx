import React from 'react';
import {
  ShieldCheck,
  MapPin,
  Mic,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Settings,
  X,
  ExternalLink,
  ChevronRight,
  Video,
  Compass
} from 'lucide-react';
import { PermissionType, permissionService } from '../services/permissionService';

export type RationalePermissionType = PermissionType | 'all';

interface PermissionRationaleModalProps {
  type: RationalePermissionType;
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: () => void;
}

export const PermissionRationaleModal: React.FC<PermissionRationaleModalProps> = ({
  type,
  isOpen,
  onClose,
  onPermissionGranted
}) => {
  if (!isOpen) return null;

  const [loading, setLoading] = React.useState(false);
  const [deniedState, setDeniedState] = React.useState(false);

  const getDetails = () => {
    switch (type) {
      case 'all':
        return {
          icon: <ShieldCheck className="w-8 h-8 text-emerald-400" />,
          title: 'Smart Shield Safety Permissions',
          badge: 'Location • Camera • Microphone',
          explanation:
            'Before requesting Android system access, here is why Smart Shield needs Location, Camera, and Microphone permissions to protect you during emergencies:',
          benefits: [
            'Location (ACCESS_FINE_LOCATION): Attaches your real GPS coordinates to SOS alerts and monitors your safe zone radius.',
            'Camera (CAMERA): Captures tamper-evident SOS video evidence into your local SHA-256 vault during an emergency.',
            'Microphone (RECORD_AUDIO): Enables hands-free Voice SOS ("Smart Shield Help"), Voice AI questions, and SOS audio evidence.',
            'Full Control: Emergency SOS & helplines (112 / 1091) remain usable even if you decline permissions.'
          ]
        };
      case 'location':
        return {
          icon: <MapPin className="w-8 h-8 text-cyan-400" />,
          title: 'Location Access Required',
          badge: 'GPS & Geofencing Defense',
          explanation:
            'SMART SHIELD uses your GPS location to display your current position on the map, monitor your configured safety radius, detect boundary breaches, and include precise Google Maps coordinates in emergency SOS alerts.',
          benefits: [
            'Real-time GPS coordinate verification (No fake cities)',
            'Custom 1 km - 50 km Safe Zone Geofencing alerts',
            'One-touch Google Maps link included in Emergency SOS alerts',
            'Supports both Precise and Approximate location accuracy'
          ]
        };
      case 'camera':
        return {
          icon: <Video className="w-8 h-8 text-rose-400" />,
          title: 'Camera Access Required',
          badge: 'SOS Video Evidence Vault',
          explanation:
            'SMART SHIELD uses your camera during emergency SOS situations to capture tamper-evident video evidence with cryptographic SHA-256 integrity verification.',
          benefits: [
            'Captures environment and incident details during an SOS event',
            'Saves recordings securely to local private storage (IndexedDB)',
            'Cryptographic SHA-256 fingerprint generated automatically',
            'Camera is strictly activated ONLY during an active SOS or test recording'
          ]
        };
      case 'microphone':
        return {
          icon: <Mic className="w-8 h-8 text-indigo-400" />,
          title: 'Microphone Access Required',
          badge: 'SOS Audio & Voice Assistant',
          explanation:
            'SMART SHIELD uses your microphone to capture audio evidence during emergency SOS events, listen for the opt-in "Smart Shield Help" voice SOS trigger, and enable hands-free speech recognition for the Shield AI assistant.',
          benefits: [
            'Simultaneous emergency audio recording during SOS events',
            'Hands-free speech-to-text input & Voice SOS keyword detection',
            'Automatic fallback to audio-only evidence if camera is unavailable',
            'Zero hidden background recording without your explicit activation'
          ]
        };
      case 'notifications':
        return {
          icon: <Bell className="w-8 h-8 text-teal-400" />,
          title: 'Notification Access Required',
          badge: 'Real-time Emergency Alerts',
          explanation:
            'SMART SHIELD uses notifications to alert you immediately if you step outside your configured safety zone or if an incoming emergency relay update is received.',
          benefits: [
            'Instant geofence zone breach notifications',
            'Safe Walk escort timer reminder alerts',
            'Medication & appointment reminders for pregnancy wellness',
            'Emergency contact acknowledgment status updates'
          ]
        };
      case 'backgroundLocation':
        return {
          icon: <MapPin className="w-8 h-8 text-purple-400" />,
          title: 'Continuous Location Escort Access',
          badge: 'SafeWalk Escort Service',
          explanation:
            'SafeWalk uses location updates during an active session to monitor your journey until you reach your destination safely.',
          benefits: [
            'Active location tracking during SafeWalk sessions',
            'Displays an ongoing active status with a quick Cancel button',
            'Automatically terminates tracking when SafeWalk session completes',
            'Strictly opt-in: Never tracks location outside active sessions'
          ]
        };
    }
  };

  const details = getDetails();

  const handleRequest = async () => {
    setLoading(true);
    let success = false;

    if (type === 'all') {
      const status = await permissionService.requestAllSafetyPermissions();
      success =
        status.location === 'granted' ||
        status.location === 'approximate' ||
        status.camera === 'granted' ||
        status.microphone === 'granted';
    } else if (type === 'location' || type === 'backgroundLocation') {
      const res = await permissionService.requestLocationPermission();
      success = res.granted;
    } else if (type === 'camera') {
      success = await permissionService.requestCameraPermission();
    } else if (type === 'microphone') {
      success = await permissionService.requestMicrophonePermission();
    } else if (type === 'notifications') {
      success = await permissionService.requestNotificationPermission();
    }

    setLoading(false);

    if (success) {
      onPermissionGranted();
      onClose();
    } else {
      setDeniedState(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-850 border border-slate-750 flex items-center justify-center shrink-0">
            {details.icon}
          </div>
          <div>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
              {details.badge}
            </span>
            <h3 className="text-xl font-black text-white mt-1">{details.title}</h3>
          </div>
        </div>

        {/* Explanation Banner */}
        <p className="text-xs text-slate-300 leading-relaxed bg-slate-850 p-4 rounded-2xl border border-slate-750">
          {details.explanation}
        </p>

        {/* Benefits Checklist */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Why Smart Shield Needs This</h4>
          <div className="space-y-2">
            {details.benefits.map((b, i) => (
              <div key={i} className="flex items-start space-x-2.5 text-xs text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Denied Warning State & Recovery Actions */}
        {deniedState && (
          <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-700 space-y-3 text-xs text-rose-200">
            <div className="flex items-center space-x-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Permission Was Denied or Permanently Blocked</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Android blocks repeated system dialogs after a permission is denied. Use the recovery button below to open Smart Shield's Android App Settings and set the permission to <strong>Allow</strong>. The rest of Smart Shield remains usable.
            </p>
            <div className="p-3 bg-slate-950 rounded-xl text-[11px] font-mono text-cyan-300">
              {permissionService.openAppSettingsInstructions()}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => permissionService.openAppSettings()}
                className="flex-1 py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs flex items-center justify-center space-x-1.5 shadow cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Open Android App Settings</span>
                <ExternalLink className="w-3 h-3" />
              </button>
              {(type === 'location' || type === 'all') && (
                <button
                  type="button"
                  onClick={() => permissionService.openLocationServicesSettings()}
                  className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Location Settings</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 cursor-pointer"
          >
            {deniedState ? 'Continue Without Permission' : 'Not Now'}
          </button>

          <button
            onClick={handleRequest}
            disabled={loading}
            className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-cyan-950 cursor-pointer"
          >
            {loading ? (
              <span>Requesting...</span>
            ) : (
              <>
                <span>{deniedState ? 'Retry Permission Prompt' : 'Continue & Allow'}</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
