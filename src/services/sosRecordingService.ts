import { LocationData, SOSEvidenceRecord, SOSRecordingSessionState } from '../types';
import { permissionService } from './permissionService';

const DB_NAME = 'SmartShield_EvidenceDB_v1';
const STORE_NAME = 'sos_evidence_store';
const DB_VERSION = 1;
const MAX_RECORDING_DURATION_SEC = 600; // 10 minutes max safety limit

class SOSRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private timerInterval: NodeJS.Timeout | null = null;
  private autoStopTimeout: NodeJS.Timeout | null = null;
  private currentIncidentId: string | null = null;
  private currentLocation: LocationData | null = null;
  private recordingStartTime: number = 0;

  private state: SOSRecordingSessionState = {
    isRecording: false,
    mediaType: 'none',
    elapsedSeconds: 0,
    maxDurationSeconds: MAX_RECORDING_DURATION_SEC,
    status: 'idle',
    cameraAvailable: true,
    microphoneAvailable: true
  };

  private listeners: ((state: SOSRecordingSessionState) => void)[] = [];
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDB();
  }

  // --------------------------------------------------------------------------
  // IndexedDB Storage Layer
  // --------------------------------------------------------------------------
  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported on this platform.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('mediaType', 'mediaType', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Failed to open SOS Evidence IndexedDB:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  private async initDB() {
    try {
      await this.getDB();
    } catch (e) {
      console.warn('Could not initialize evidence IndexedDB:', e);
    }
  }

  public async saveRecord(record: SOSEvidenceRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.error('Failed to save SOS Evidence record:', req.error);
        reject(req.error);
      };
    });
  }

  public async getAllRecords(): Promise<SOSEvidenceRecord[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const records: SOSEvidenceRecord[] = req.result || [];
          // Sort descending by timestamp
          records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          resolve(records);
        };

        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Error reading SOS evidence records:', e);
      return [];
    }
  }

  public async getRecordById(id: string): Promise<SOSEvidenceRecord | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  public async deleteRecord(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async clearAllRecords(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getStorageUsage(): Promise<{ totalBytes: number; count: number }> {
    const records = await this.getAllRecords();
    const totalBytes = records.reduce((acc, curr) => acc + (curr.sizeBytes || 0), 0);
    return { totalBytes, count: records.length };
  }

  // --------------------------------------------------------------------------
  // State Subscriptions
  // --------------------------------------------------------------------------
  public subscribe(listener: (state: SOSRecordingSessionState) => void) {
    this.listeners.push(listener);
    listener({ ...this.state });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const copy = { ...this.state };
    this.listeners.forEach((l) => l(copy));
  }

  public getState(): SOSRecordingSessionState {
    return { ...this.state };
  }

  // --------------------------------------------------------------------------
  // Media Recorder Lifecycle
  // --------------------------------------------------------------------------
  private pickSupportedMimeType(preferredType: 'video' | 'audio'): string {
    if (typeof MediaRecorder === 'undefined') return '';

    if (preferredType === 'video') {
      const videoTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4;codecs=avc1,mp4a',
        'video/mp4'
      ];
      for (const t of videoTypes) {
        if (MediaRecorder.isTypeSupported(t)) return t;
      }
    }

    const audioTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/aac'
    ];
    for (const t of audioTypes) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }

    return '';
  }

  /**
   * Start SOS recording immediately and non-blockingly.
   * If video fails or camera permission is denied, it automatically falls back to audio.
   * Does NOT block the SOS dispatch workflow.
   */
  public async startRecording(
    location?: LocationData | null,
    incidentId?: string
  ): Promise<{ success: boolean; mediaType: 'video' | 'audio' | 'none'; error?: string }> {
    // If already recording, prevent duplicate sessions and return current status
    if (this.state.isRecording) {
      return { success: true, mediaType: this.state.mediaType };
    }

    this.currentLocation = location || null;
    this.currentIncidentId = incidentId || `sos-${Date.now()}`;
    this.recordedChunks = [];
    this.recordingStartTime = Date.now();

    this.state = {
      ...this.state,
      isRecording: true,
      status: 'starting',
      elapsedSeconds: 0,
      error: undefined,
      incidentId: this.currentIncidentId
    };
    this.notify();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = 'Media recording is not supported on this browser or platform.';
      this.state = { ...this.state, isRecording: false, status: 'error', error: err };
      this.notify();
      return { success: false, mediaType: 'none', error: err };
    }

    // Check current permission status and request Android runtime permissions if running in WebView APK
    const permStatus = await permissionService.checkAllPermissions();
    if (
      typeof window !== 'undefined' &&
      window.SmartShieldAndroidBridge?.requestMediaPermissions &&
      (permStatus.camera !== 'granted' || permStatus.microphone !== 'granted')
    ) {
      try {
        window.SmartShieldAndroidBridge.requestMediaPermissions();
      } catch (e) {
        console.warn('Android bridge media permission request warning:', e);
      }
    }

    let stream: MediaStream | null = null;
    let chosenType: 'video' | 'audio' = 'video';

    // 1. Attempt Camera + Audio (Environment / Rear camera preferred for evidence)
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        });
      } catch {
        // Fallback to any camera + audio if environment facingMode fails
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
      }
      chosenType = 'video';
      this.state.cameraAvailable = true;
      this.state.microphoneAvailable = true;
      permissionService.checkAllPermissions();
    } catch (camErr: any) {
      console.warn('Camera stream acquisition failed, falling back to audio-only SOS evidence:', camErr);

      // 2. Fallback to Audio-only (check/request microphone permission if needed)
      if (typeof window !== 'undefined' && window.SmartShieldAndroidBridge?.requestMicrophonePermission) {
        try {
          window.SmartShieldAndroidBridge.requestMicrophonePermission();
        } catch {}
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chosenType = 'audio';
        this.state.cameraAvailable = false;
        this.state.microphoneAvailable = true;
        permissionService.checkAllPermissions();
      } catch (audioErr: any) {
        console.warn('Audio stream acquisition also failed:', audioErr);
        permissionService.checkAllPermissions();

        const isDenied =
          camErr?.name === 'NotAllowedError' ||
          camErr?.name === 'PermissionDeniedError' ||
          audioErr?.name === 'NotAllowedError' ||
          audioErr?.name === 'PermissionDeniedError';
        const isNotFound =
          camErr?.name === 'NotFoundError' && audioErr?.name === 'NotFoundError';

        const errorMsg = isDenied
          ? 'Camera and Microphone permissions were denied. SOS emergency alert continues without media recording. Open App Settings to allow Camera & Microphone.'
          : isNotFound
          ? 'No camera or microphone hardware was detected on this device. SOS emergency alert continues.'
          : `Unable to start media recording (${audioErr?.message || 'hardware busy or unavailable'}). SOS emergency alert continues.`;

        this.state = {
          ...this.state,
          isRecording: false,
          status: 'error',
          error: errorMsg,
          cameraAvailable: false,
          microphoneAvailable: false
        };
        this.notify();
        return { success: false, mediaType: 'none', error: errorMsg };
      }
    }

    this.mediaStream = stream;
    const mimeType = this.pickSupportedMimeType(chosenType);

    try {
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      console.warn('MediaRecorder init with mimeType failed, falling back to default:', e);
      this.mediaRecorder = new MediaRecorder(stream);
    }

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onerror = (event: any) => {
      console.error('MediaRecorder runtime error:', event);
      this.stopRecording('interrupted');
    };

    this.mediaRecorder.onstop = () => {
      this.finalizeRecording('completed');
    };

    // Request data slice every 1000ms so chunks are captured continuously
    try {
      this.mediaRecorder.start(1000);
    } catch {
      this.mediaRecorder.start();
    }

    this.state = {
      ...this.state,
      isRecording: true,
      status: 'recording',
      mediaType: chosenType,
      error: undefined
    };
    this.notify();

    // Start elapsed timer (updates every 1s)
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      this.state.elapsedSeconds = elapsed;
      this.notify();

      if (elapsed >= MAX_RECORDING_DURATION_SEC) {
        this.stopRecording('completed');
      }
    }, 1000);

    return { success: true, mediaType: chosenType };
  }

  /**
   * Stop recording and securely save evidence
   */
  public async stopRecording(status: 'completed' | 'interrupted' = 'completed'): Promise<SOSEvidenceRecord | null> {
    if (!this.state.isRecording && !this.mediaRecorder) {
      return null;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.autoStopTimeout) {
      clearTimeout(this.autoStopTimeout);
      this.autoStopTimeout = null;
    }

    this.state = {
      ...this.state,
      status: 'stopping'
    };
    this.notify();

    return new Promise((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = async () => {
          const record = await this.finalizeRecording(status);
          resolve(record);
        };
        try {
          this.mediaRecorder.stop();
        } catch {
          this.finalizeRecording(status).then(resolve);
        }
      } else {
        this.finalizeRecording(status).then(resolve);
      }
    });
  }

  /**
   * Finalize the recording session: assemble blob, compute SHA-256 hash, save to IndexedDB
   */
  private async finalizeRecording(status: 'completed' | 'interrupted'): Promise<SOSEvidenceRecord | null> {
    // Release all camera and microphone hardware tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.mediaStream = null;
    }

    const elapsed = Math.max(1, Math.floor((Date.now() - this.recordingStartTime) / 1000));
    const mediaType = this.state.mediaType === 'video' ? 'video' : 'audio';
    const mimeType = this.recordedChunks[0]?.type || (mediaType === 'video' ? 'video/webm' : 'audio/webm');

    let finalRecord: SOSEvidenceRecord | null = null;

    if (this.recordedChunks.length > 0) {
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      const sizeBytes = blob.size;

      // Compute cryptographic SHA-256 integrity hash
      let sha256Hash = '00000000000000000000000000000000';
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        sha256Hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (hashErr) {
        console.warn('Crypto SHA-256 generation fallback:', hashErr);
        sha256Hash = `sha256-${Date.now()}-${sizeBytes}`;
      }

      const timestamp = new Date().toISOString();
      const locSummary = this.currentLocation
        ? `${this.currentLocation.latitude.toFixed(4)}, ${this.currentLocation.longitude.toFixed(4)}`
        : 'GPS Unavailable';

      finalRecord = {
        id: `evidence-${Date.now()}`,
        timestamp,
        durationSeconds: elapsed,
        mediaType,
        mimeType,
        blob,
        sizeBytes,
        location: this.currentLocation,
        sha256Hash,
        incidentId: this.currentIncidentId || undefined,
        status,
        title: `SOS ${mediaType.toUpperCase()} Evidence (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) — ${locSummary}`
      };

      try {
        await this.saveRecord(finalRecord);
      } catch (saveErr) {
        console.error('Failed to save evidence to IndexedDB:', saveErr);
      }
    }

    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.state = {
      ...this.state,
      isRecording: false,
      mediaType: 'none',
      status: 'idle',
      elapsedSeconds: 0
    };
    this.notify();

    return finalRecord;
  }

  // --------------------------------------------------------------------------
  // Export and Share Helpers
  // --------------------------------------------------------------------------
  public exportRecord(record: SOSEvidenceRecord) {
    if (!record.blob) return;
    const url = URL.createObjectURL(record.blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const ext = record.mediaType === 'video' ? 'webm' : 'webm';
    const dateStr = record.timestamp.replace(/[:.]/g, '-');
    a.download = `SMART_SHIELD_SOS_EVIDENCE_${dateStr}.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  }

  public async shareRecord(record: SOSEvidenceRecord): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.share) {
      return false;
    }

    const locText = record.location
      ? `Location: ${record.location.latitude.toFixed(5)}, ${record.location.longitude.toFixed(5)} (±${record.location.accuracy}m). Address: ${record.location.address || 'N/A'}. Maps: https://maps.google.com/?q=${record.location.latitude},${record.location.longitude}`
      : 'Location: GPS was unavailable during recording.';

    const shareData: ShareData = {
      title: 'SMART SHIELD SOS EVIDENCE RECORD',
      text: `SMART SHIELD SOS ${record.mediaType.toUpperCase()} EVIDENCE\nRecorded: ${new Date(record.timestamp).toLocaleString()}\nDuration: ${record.durationSeconds}s\nSHA-256 Hash: ${record.sha256Hash}\n${locText}`
    };

    if (record.blob && navigator.canShare) {
      try {
        const ext = record.mediaType === 'video' ? 'webm' : 'webm';
        const file = new File([record.blob], `SmartShield_Evidence_${record.id}.${ext}`, {
          type: record.mimeType
        });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            ...shareData,
            files: [file]
          });
          return true;
        }
      } catch (e) {
        console.warn('File share failed, falling back to text share:', e);
      }
    }

    try {
      await navigator.share(shareData);
      return true;
    } catch {
      return false;
    }
  }
}

export const sosRecordingService = new SOSRecordingService();
