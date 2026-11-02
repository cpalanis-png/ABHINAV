import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Video,
  Mic,
  Play,
  Pause,
  Download,
  Share2,
  Trash2,
  MapPin,
  Clock,
  Lock,
  FileCheck2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  HardDrive,
  Camera,
  RefreshCw,
  X,
  Sparkles,
  Info,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { SOSEvidenceRecord, SOSRecordingSessionState, LocationData } from '../types';
import { sosRecordingService } from '../services/sosRecordingService';
import { permissionService, PermissionStatus } from '../services/permissionService';
import { PermissionRationaleModal, RationalePermissionType } from './PermissionRationaleModal';

interface SOSEvidenceHistoryViewProps {
  location?: LocationData | null;
  triggerSOS?: () => void;
}

export const SOSEvidenceHistoryView: React.FC<SOSEvidenceHistoryViewProps> = ({
  location,
  triggerSOS
}) => {
  const [records, setRecords] = useState<SOSEvidenceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'video' | 'audio'>('all');
  const [selectedRecord, setSelectedRecord] = useState<SOSEvidenceRecord | null>(null);
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<SOSRecordingSessionState>(sosRecordingService.getState());
  const [storageStats, setStorageStats] = useState<{ totalBytes: number; count: number }>({ totalBytes: 0, count: 0 });
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>(permissionService.getStatus());
  const [testModeLoading, setTestModeLoading] = useState<boolean>(false);
  const [rationaleModal, setRationaleModal] = useState<RationalePermissionType | null>(null);

  // Load records from IndexedDB
  const refreshRecords = async () => {
    setLoading(true);
    try {
      const all = await sosRecordingService.getAllRecords();
      setRecords(all);
      const stats = await sosRecordingService.getStorageUsage();
      setStorageStats(stats);
    } catch (e) {
      console.warn('Failed to fetch records:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshRecords();

    // Subscribe to recording state updates
    const unsubRecording = sosRecordingService.subscribe((state) => {
      setRecordingState(state);
      // When recording transitions from active to idle, reload list
      if (!state.isRecording && state.status === 'idle') {
        refreshRecords();
      }
    });

    // Subscribe to permission changes
    const unsubPerms = permissionService.subscribe((perms) => {
      setPermissionStatus(perms);
    });

    return () => {
      unsubRecording();
      unsubPerms();
      if (activeMediaUrl) {
        URL.revokeObjectURL(activeMediaUrl);
      }
    };
  }, []);

  // Update media blob URL when selected record changes
  useEffect(() => {
    if (activeMediaUrl) {
      URL.revokeObjectURL(activeMediaUrl);
      setActiveMediaUrl(null);
    }

    if (selectedRecord && selectedRecord.blob) {
      const url = URL.createObjectURL(selectedRecord.blob);
      setActiveMediaUrl(url);
    }
  }, [selectedRecord]);

  const handleCopyHash = (id: string, hash: string) => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopiedHashId(id);
      setTimeout(() => setCopiedHashId(null), 2500);
    });
  };

  const handleDelete = async (id: string) => {
    await sosRecordingService.deleteRecord(id);
    setConfirmDeleteId(null);
    if (selectedRecord?.id === id) {
      setSelectedRecord(null);
    }
    refreshRecords();
  };

  const handleExport = (record: SOSEvidenceRecord) => {
    sosRecordingService.exportRecord(record);
  };

  const handleShare = async (record: SOSEvidenceRecord) => {
    await sosRecordingService.shareRecord(record);
  };

  const handleStartTestRecording = async () => {
    const perms = await permissionService.checkAllPermissions();
    if (perms.camera !== 'granted' && perms.microphone !== 'granted') {
      setRationaleModal('camera');
      return;
    }
    setTestModeLoading(true);
    try {
      await sosRecordingService.startRecording(location, `test-${Date.now()}`);
    } finally {
      setTestModeLoading(false);
    }
  };

  const handleStopRecording = async () => {
    await sosRecordingService.stopRecording('completed');
    refreshRecords();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const filteredRecords = records.filter((r) => {
    if (filterType === 'video') return r.mediaType === 'video';
    if (filterType === 'audio') return r.mediaType === 'audio';
    return true;
  });

  return (
    <div className="space-y-6">
      {rationaleModal && (
        <PermissionRationaleModal
          type={rationaleModal}
          isOpen={Boolean(rationaleModal)}
          onClose={() => setRationaleModal(null)}
          onPermissionGranted={async () => {
            await permissionService.checkAllPermissions();
          }}
        />
      )}

      {/* RECORDING ERROR / PERMISSION DENIED BANNER */}
      {!recordingState.isRecording && recordingState.status === 'error' && recordingState.error && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/85 border-2 border-rose-600 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-black text-white">SOS Evidence Recording Could Not Start</h4>
              <p className="text-xs text-rose-200 leading-relaxed">{recordingState.error}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => permissionService.openAppSettings()}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-rose-950 font-black text-xs flex items-center space-x-1.5 shadow cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-rose-600" />
              <span>Open App Settings</span>
            </button>
            <button
              onClick={() => setRationaleModal('camera')}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
            >
              Grant Camera &amp; Mic
            </button>
          </div>
        </div>
      )}

      {/* LIVE RECORDING ACTIVE BANNER */}
      {recordingState.isRecording && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/90 border-2 border-rose-500 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-lg">
              {recordingState.mediaType === 'video' ? (
                <Video className="w-5 h-5 animate-spin-slow" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-black uppercase tracking-widest text-rose-300">
                  SOS LIVE EVIDENCE RECORDING ACTIVE
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-900 border border-rose-600 text-rose-200 uppercase">
                  {recordingState.mediaType === 'video' ? 'Camera + Audio' : 'Audio Only'}
                </span>
              </div>
              <p className="text-sm font-bold text-white mt-0.5">
                Elapsed: <span className="font-mono text-rose-200">{formatSeconds(recordingState.elapsedSeconds)}</span> /{' '}
                <span className="text-xs text-rose-300 font-mono">{formatSeconds(recordingState.maxDurationSeconds)} max</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleStopRecording}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-rose-950 font-black text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Stop &amp; Secure to Vault</span>
          </button>
        </div>
      )}

      {/* VAULT STATS & HEADER */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Lock className="w-6 h-6 text-white stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-white">SOS Evidence Vault</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-950 text-rose-300 border border-rose-700">
                  SHA-256 Verified
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Tamper-evident camera &amp; audio recordings stored securely in device private storage.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
            {!recordingState.isRecording && (
              <button
                onClick={handleStartTestRecording}
                disabled={testModeLoading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs flex items-center space-x-2 transition-colors"
                title="Verify camera & microphone capture prior to emergency"
              >
                <Camera className="w-3.5 h-3.5 text-indigo-400" />
                <span>Test SOS Recording</span>
              </button>
            )}

            <button
              onClick={refreshRecords}
              className="p-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 transition-colors"
              title="Refresh vault"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Storage & Readiness Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Recordings</span>
            <div className="text-lg font-black text-white mt-1">{storageStats.count} Files</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Encrypted Storage</span>
            <div className="text-lg font-black text-indigo-300 mt-1">{formatBytes(storageStats.totalBytes)}</div>
          </div>

          <button
            type="button"
            onClick={() => setRationaleModal('camera')}
            className="p-3.5 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left transition-colors cursor-pointer"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Camera Access</span>
            <div className="flex items-center space-x-1.5 mt-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  permissionStatus.camera === 'granted'
                    ? 'bg-emerald-400'
                    : permissionStatus.camera === 'denied'
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-xs font-bold text-slate-200">
                {permissionStatus.camera === 'granted'
                  ? 'Armed'
                  : permissionStatus.camera === 'denied'
                  ? 'Denied (Tap to Fix)'
                  : 'Tap to Enable'}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRationaleModal('microphone')}
            className="p-3.5 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left transition-colors cursor-pointer"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Microphone Access</span>
            <div className="flex items-center space-x-1.5 mt-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  permissionStatus.microphone === 'granted'
                    ? 'bg-emerald-400'
                    : permissionStatus.microphone === 'denied'
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-xs font-bold text-slate-200">
                {permissionStatus.microphone === 'granted'
                  ? 'Armed'
                  : permissionStatus.microphone === 'denied'
                  ? 'Denied (Tap to Fix)'
                  : 'Tap to Enable'}
              </span>
            </div>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filterType === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Evidence ({records.length})
            </button>
            <button
              onClick={() => setFilterType('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                filterType === 'video' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video ({records.filter((r) => r.mediaType === 'video').length})</span>
            </button>
            <button
              onClick={() => setFilterType('audio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                filterType === 'audio' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Audio ({records.filter((r) => r.mediaType === 'audio').length})</span>
            </button>
          </div>

          {records.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Delete all recorded SOS evidence permanently from this device?')) {
                  sosRecordingService.clearAllRecords().then(refreshRecords);
                }
              }}
              className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center space-x-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-950/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Vault</span>
            </button>
          )}
        </div>
      </div>

      {/* RECORDINGS LIST */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900 rounded-3xl border border-slate-800">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          <p className="text-xs font-semibold">Loading secure evidence vault...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="p-10 text-center bg-slate-900/60 rounded-3xl border border-slate-800/80 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-800/60 flex items-center justify-center text-slate-500">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white">No SOS Evidence Recorded Yet</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              When the SOS emergency button is pressed, Smart Shield automatically activates camera and audio capture
              to gather evidence and stores it here with cryptographic SHA-256 verification.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleStartTestRecording}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg transition-transform active:scale-95 inline-flex items-center space-x-2"
            >
              <Camera className="w-4 h-4" />
              <span>Run a Test Recording</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredRecords.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-lg space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                      item.mediaType === 'video'
                        ? 'bg-rose-950 border border-rose-700 text-rose-400'
                        : 'bg-cyan-950 border border-cyan-700 text-cyan-400'
                    }`}
                  >
                    {item.mediaType === 'video' ? <Video className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap">
                      <h4 className="text-sm font-extrabold text-white">{item.title}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {formatSeconds(item.durationSeconds)}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                        {formatBytes(item.sizeBytes)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center space-x-2 self-end sm:self-auto">
                  <button
                    onClick={() => setSelectedRecord(item)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md transition-all active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Play &amp; Review</span>
                  </button>

                  <button
                    onClick={() => handleExport(item)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title="Download evidence to device"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleShare(item)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title="Share evidence securely"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {confirmDeleteId === item.id ? (
                    <div className="flex items-center space-x-1 bg-rose-950 p-1 rounded-xl border border-rose-700">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-2 py-1 text-[10px] font-black bg-rose-600 hover:bg-rose-500 text-white rounded"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-[10px] text-slate-300 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
                      title="Delete recording"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Location & Metadata Bar */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  {item.location ? (
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="text-slate-200 font-mono font-medium">
                        {item.location.latitude.toFixed(5)}°, {item.location.longitude.toFixed(5)}°
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        (±{item.location.accuracy}m fix)
                      </span>
                      <a
                        href={`https://maps.google.com/?q=${item.location.latitude},${item.location.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-cyan-400 hover:underline flex items-center space-x-0.5 ml-1"
                      >
                        <span>Open Map</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <span className="text-amber-400 text-[11px]">GPS coordinates were unavailable at recording start</span>
                  )}
                </div>

                {/* Cryptographic SHA-256 Hash with Copy */}
                <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400">
                  <span className="text-slate-500 uppercase text-[9px] font-sans font-bold">SHA-256:</span>
                  <span className="text-indigo-300 truncate max-w-[120px] sm:max-w-[180px]">{item.sha256Hash}</span>
                  <button
                    onClick={() => handleCopyHash(item.id, item.sha256Hash)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                    title="Copy full cryptographic hash"
                  >
                    {copiedHashId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MEDIA PREVIEW PLAYER MODAL */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl border border-slate-700 max-w-2xl w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white truncate max-w-sm sm:max-w-md">
                  {selectedRecord.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media Player Display */}
            <div className="rounded-2xl bg-black overflow-hidden border border-slate-800 flex items-center justify-center min-h-[240px]">
              {activeMediaUrl ? (
                selectedRecord.mediaType === 'video' ? (
                  <video
                    src={activeMediaUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full max-h-[420px] object-contain rounded-2xl"
                  />
                ) : (
                  <div className="w-full p-8 flex flex-col items-center justify-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-cyan-950 border-2 border-cyan-500 flex items-center justify-center text-cyan-400 animate-pulse">
                      <Mic className="w-10 h-10" />
                    </div>
                    <audio src={activeMediaUrl} controls autoPlay className="w-full max-w-md" />
                  </div>
                )
              ) : (
                <div className="text-xs text-slate-500">Preparing media stream...</div>
              )}
            </div>

            {/* Details & Actions Footer */}
            <div className="space-y-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1 font-mono">
                <p className="text-slate-400">
                  Integrity Hash:{' '}
                  <span className="text-indigo-300 break-all select-all">{selectedRecord.sha256Hash}</span>
                </p>
                {selectedRecord.location && (
                  <p className="text-slate-400">
                    GPS Coordinates:{' '}
                    <span className="text-emerald-400 font-bold">
                      {selectedRecord.location.latitude.toFixed(5)}°, {selectedRecord.location.longitude.toFixed(5)}° (±
                      {selectedRecord.location.accuracy}m)
                    </span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => handleExport(selectedRecord)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center space-x-1.5 border border-slate-700"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Media</span>
                </button>

                <button
                  onClick={() => handleShare(selectedRecord)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Evidence</span>
                </button>

                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMERGENCY RECORDING GUIDE */}
      <div className="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-800/50 space-y-2">
        <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center space-x-1.5">
          <Info className="w-4 h-4 text-indigo-400" />
          <span>About Smart Shield SOS Evidence Automation</span>
        </h4>
        <div className="text-xs text-slate-300 space-y-1">
          <p>
            • <strong>Zero Blocking:</strong> SOS alert dispatch to your emergency contacts is never delayed waiting for
            camera or microphone startup.
          </p>
          <p>
            • <strong>Graceful Fallback:</strong> If the rear camera is unavailable, Smart Shield falls back to audio-only
            recording automatically.
          </p>
          <p>
            • <strong>Local Integrity:</strong> Chunks are written directly into device private storage (IndexedDB) with
            a cryptographic SHA-256 fingerprint so evidence cannot be disputed or altered.
          </p>
        </div>
      </div>

    </div>
  );
};
