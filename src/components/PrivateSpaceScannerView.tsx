import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield,
  Camera,
  Eye,
  Wifi,
  Compass,
  ClipboardCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Flashlight,
  RefreshCw,
  Play,
  Square,
  Plus,
  Trash2,
  Download,
  Sparkles,
  Info,
  Lock,
  Radio,
  Search,
  Check,
  HelpCircle,
  Sliders,
  ChevronRight
} from 'lucide-react';
import {
  AISecurityResultCategory,
  CameraReflectionFinding,
  IRInspectionResult,
  MagnetometerLogItem,
  MagnetometerReading,
  PhysicalChecklistItem,
  PrivateSpaceSecurityReport,
  SecurityScannerAIAnalysis,
  WifiDeviceStatus,
  WifiDiscoveredDevice
} from '../types';
import {
  DeviceScannerCapabilities,
  buildLocalFallbackAnalysis,
  deleteSecurityReport,
  detectScannerCapabilities,
  formatReportAsText,
  getDefaultPhysicalChecklist,
  getScannerAndroidBridge,
  loadSavedTrustMap,
  loadSecurityReports,
  lookupMacVendor,
  normalizeMacPrefix,
  saveDeviceTrustState,
  saveSecurityReport
} from '../services/privateSpaceScannerService';
import {
  CAMERA_SCAN_STATUS_MESSAGES,
  CameraLensCvTracker,
  CameraScanStatusState,
  LensCandidateRegion
} from '../services/cameraLensCvEngine';

type ScannerScreen = 'dashboard' | 'live_inspection' | 'results' | 'reports';
type InspectionToolTab = 'camera_lens' | 'infrared' | 'wifi' | 'magnetometer' | 'physical_guide';

export const PrivateSpaceScannerView: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ScannerScreen>('dashboard');
  const [activeTool, setActiveTool] = useState<InspectionToolTab>('camera_lens');
  const [locationLabel, setLocationLabel] = useState<string>('Hotel Room / Private Space');

  // Hardware & runtime capability state
  const [capabilities, setCapabilities] = useState<DeviceScannerCapabilities | null>(null);

  // Camera & Computer Vision Lens Inspection state
  const [cameraStreamActive, setCameraStreamActive] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraPermissionState, setCameraPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'error'>('prompt');
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [torchStatusNote, setTorchStatusNote] = useState<string>('Checking camera torch capability...');
  const [cvOverlayEnabled, setCvOverlayEnabled] = useState<boolean>(true);
  const [cvSensitivity, setCvSensitivity] = useState<number>(238); // Luminance threshold 215-250
  const [cameraScanState, setCameraScanState] = useState<CameraScanStatusState>('SCANNING');
  const [cameraScanQualityDetail, setCameraScanQualityDetail] = useState<string | null>(null);
  const [liveSpecularCandidates, setLiveSpecularCandidates] = useState<LensCandidateRegion[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<LensCandidateRegion | null>(null);
  const [cameraFindings, setCameraFindings] = useState<CameraReflectionFinding[]>([]);
  const [findingNoteInput, setFindingNoteInput] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const cvTrackerRef = useRef<CameraLensCvTracker>(new CameraLensCvTracker());

  // Infrared Light Inspection state
  const [irInspection, setIrInspection] = useState<IRInspectionResult>({
    tested: false,
    cameraUsed: 'none',
    remoteTestPerformed: false,
    irLightObserved: false,
    filterLimitationNote:
      'Most smartphone rear cameras contain a hardware IR-cut filter that blocks 850nm/940nm infrared LEDs. Use the TV/AC remote calibration test below to check if your active camera sensor can detect near-infrared light.'
  });

  // Wi-Fi Network Inspection state
  const [wifiLoading, setWifiLoading] = useState<boolean>(false);
  const [wifiScanMethod, setWifiScanMethod] = useState<string>('Web Network Information & Endpoint Check');
  const [wifiLimitationsNote, setWifiLimitationsNote] = useState<string>(
    'Android 10+ and WebView containers restrict direct ARP table (`ip neigh`) and raw MAC enumeration to protect user privacy. You can inspect your current connection link below and look up any device MAC/IP from your router client list.'
  );
  const [wifiDevices, setWifiDevices] = useState<WifiDiscoveredDevice[]>([]);
  const [manualDeviceLabel, setManualDeviceLabel] = useState<string>('');
  const [manualDeviceIp, setManualDeviceIp] = useState<string>('');
  const [manualDeviceMac, setManualDeviceMac] = useState<string>('');

  // Magnetometer Sensor state
  const [magMonitoring, setMagMonitoring] = useState<boolean>(false);
  const [currentMagReading, setCurrentMagReading] = useState<MagnetometerReading | null>(null);
  const [peakMagUt, setPeakMagUt] = useState<number | null>(null);
  const [magHistory, setMagHistory] = useState<number[]>([]);
  const [magLogs, setMagLogs] = useState<MagnetometerLogItem[]>([]);
  const [magNoteInput, setMagNoteInput] = useState<string>('');
  const magSensorRef = useRef<any>(null);
  const magPollIntervalRef = useRef<number | null>(null);
  const magCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Physical & Electronic Bug Checklist state
  const [physicalChecklist, setPhysicalChecklist] = useState<PhysicalChecklistItem[]>(() =>
    getDefaultPhysicalChecklist()
  );

  // AI Security Analysis & Consent state
  const [userAiConsent, setUserAiConsent] = useState<boolean>(false);
  const [aiAnalyzing, setAiAnalyzing] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<SecurityScannerAIAnalysis | null>(null);
  const [aiErrorNote, setAiErrorNote] = useState<string | null>(null);

  // Saved Security Reports state
  const [savedReports, setSavedReports] = useState<PrivateSpaceSecurityReport[]>(() =>
    loadSecurityReports()
  );
  const [selectedReport, setSelectedReport] = useState<PrivateSpaceSecurityReport | null>(null);
  const [reportSaveNotice, setReportSaveNotice] = useState<string | null>(null);

  // Detect real hardware capabilities on mount
  useEffect(() => {
    let mounted = true;
    detectScannerCapabilities().then((caps) => {
      if (mounted) {
        setCapabilities(caps);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Stop camera and magnetometer cleanly when unmounting
  const stopCameraInspection = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    const bridge = getScannerAndroidBridge();
    if (torchEnabled && bridge?.setTorchMode) {
      try {
        bridge.setTorchMode(false);
      } catch {
        // ignore
      }
    }
    cvTrackerRef.current.reset();
    setCameraStreamActive(false);
    setTorchEnabled(false);
    setLiveSpecularCandidates([]);
    setSelectedCandidate(null);
    setCameraScanState('SCANNING');
    setCameraScanQualityDetail(null);
  }, [torchEnabled]);

  const stopMagnetometer = useCallback(() => {
    if (magSensorRef.current) {
      try {
        magSensorRef.current.stop();
      } catch {
        // ignore
      }
      magSensorRef.current = null;
    }
    if (magPollIntervalRef.current !== null) {
      window.clearInterval(magPollIntervalRef.current);
      magPollIntervalRef.current = null;
    }
    const bridge = getScannerAndroidBridge();
    if (bridge?.stopMagnetometer) {
      try {
        bridge.stopMagnetometer();
      } catch {
        // ignore
      }
    }
    setMagMonitoring(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraInspection();
      stopMagnetometer();
    };
  }, [stopCameraInspection, stopMagnetometer]);

  // Multi-Indicator Computer Vision frame processor (brightness, local contrast, circularity, size bounds, multi-frame stability)
  const processCameraFrame = useCallback(
    (timestamp: number) => {
      if (!videoRef.current || !overlayCanvasRef.current) return;

      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;

      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
          overlay.width = video.videoWidth;
          overlay.height = video.videoHeight;
        }

        // Throttle CV analysis to ~8 FPS (125ms) for smooth Android performance without blocking UI thread
        if (timestamp - lastFrameTimeRef.current >= 125) {
          lastFrameTimeRef.current = timestamp;

          if (!analysisCanvasRef.current) {
            analysisCanvasRef.current = document.createElement('canvas');
          }
          const analysisCanvas = analysisCanvasRef.current;
          const sampleW = 160;
          const sampleH = 120;
          analysisCanvas.width = sampleW;
          analysisCanvas.height = sampleH;

          const aCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
          const oCtx = overlay.getContext('2d');

          if (aCtx && oCtx) {
            oCtx.clearRect(0, 0, overlay.width, overlay.height);

            if (cvOverlayEnabled) {
              try {
                aCtx.drawImage(video, 0, 0, sampleW, sampleH);
                const imgData = aCtx.getImageData(0, 0, sampleW, sampleH).data;

                const result = cvTrackerRef.current.analyzeFrame(
                  imgData,
                  sampleW,
                  sampleH,
                  cvSensitivity
                );

                setCameraScanState(result.scanState);
                setCameraScanQualityDetail(result.qualityDetail);
                setLiveSpecularCandidates(result.stableCandidates);

                // Draw clean bounding boxes around stable candidate regions without covering the center of the lens clue
                result.stableCandidates.forEach((cand, idx) => {
                  const bx = cand.boxX * overlay.width;
                  const by = cand.boxY * overlay.height;
                  const bw = cand.boxW * overlay.width;
                  const bh = cand.boxH * overlay.height;

                  oCtx.strokeStyle = '#22d3ee';
                  oCtx.lineWidth = 2.5;
                  oCtx.strokeRect(bx, by, bw, bh);

                  // Corner brackets for high visibility
                  const cornerLen = Math.min(10, bw * 0.28);
                  oCtx.lineWidth = 3.5;
                  oCtx.beginPath();
                  // Top-left
                  oCtx.moveTo(bx, by + cornerLen);
                  oCtx.lineTo(bx, by);
                  oCtx.lineTo(bx + cornerLen, by);
                  // Top-right
                  oCtx.moveTo(bx + bw - cornerLen, by);
                  oCtx.lineTo(bx + bw, by);
                  oCtx.lineTo(bx + bw, by + cornerLen);
                  // Bottom-left
                  oCtx.moveTo(bx, by + bh - cornerLen);
                  oCtx.lineTo(bx, by + bh);
                  oCtx.lineTo(bx + cornerLen, by + bh);
                  // Bottom-right
                  oCtx.moveTo(bx + bw - cornerLen, by + bh);
                  oCtx.lineTo(bx + bw, by + bh);
                  oCtx.lineTo(bx + bw, by + bh - cornerLen);
                  oCtx.stroke();

                  const labelText = `Candidate #${idx + 1} (Tap to inspect)`;
                  oCtx.fillStyle = 'rgba(8, 51, 68, 0.9)';
                  oCtx.fillRect(bx, Math.max(0, by - 22), 160, 20);
                  oCtx.fillStyle = '#67e8f9';
                  oCtx.font = 'bold 11px sans-serif';
                  oCtx.fillText(labelText, bx + 6, Math.max(14, by - 8));
                });
              } catch {
                setCameraScanState('SCAN_ERROR');
                setCameraScanQualityDetail('Could not read camera frame buffer.');
                setLiveSpecularCandidates([]);
              }
            } else {
              setLiveSpecularCandidates([]);
              setCameraScanState('SCANNING');
              setCameraScanQualityDetail('Guided Manual Mode active (automated bounding boxes paused).');
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(processCameraFrame);
    },
    [cvOverlayEnabled, cvSensitivity]
  );

  const handleRescanCamera = () => {
    cvTrackerRef.current.reset();
    setLiveSpecularCandidates([]);
    setSelectedCandidate(null);
    setCameraScanState('SCANNING');
    setCameraScanQualityDetail(null);
  };

  // Start Camera Lens or IR Inspection stream
  const startCameraInspection = async (preferredFacing: 'environment' | 'user' = cameraFacingMode) => {
    stopCameraInspection();
    setCameraErrorMsg(null);

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setCameraPermissionState('error');
      setCameraErrorMsg(
        'Camera API (navigator.mediaDevices.getUserMedia) is unavailable in this WebView or browser context. Ensure HTTPS is active and Camera permissions are enabled in Android Settings.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: preferredFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false // Strictly no microphone permission requested
      });

      mediaStreamRef.current = stream;
      setCameraPermissionState('granted');
      setCameraStreamActive(true);
      setCameraFacingMode(preferredFacing);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Inspect real flashlight/torch support on active video track or Android bridge
      const videoTrack = stream.getVideoTracks()[0];
      let hasTrackTorch = false;
      if (videoTrack && typeof (videoTrack as any).getCapabilities === 'function') {
        try {
          const caps = (videoTrack as any).getCapabilities();
          if (caps && caps.torch) {
            hasTrackTorch = true;
          }
        } catch {
          // ignore
        }
      }

      const bridge = getScannerAndroidBridge();
      const hasBridgeTorch =
        typeof bridge?.hasTorch === 'function' && bridge.hasTorch();

      if (hasTrackTorch || hasBridgeTorch) {
        setTorchSupported(true);
        setTorchStatusNote('Hardware flashlight / torch control is supported on this camera.');
      } else {
        setTorchSupported(false);
        setTorchStatusNote(
          preferredFacing === 'user'
            ? 'Front camera active — hardware rear torch is disabled while using the front sensor.'
            : 'Flashlight control is not exposed by this browser/WebView track. You can toggle your phone flashlight manually from the Android Quick Settings shade.'
        );
      }

      rafIdRef.current = requestAnimationFrame(processCameraFrame);
    } catch (err: any) {
      setCameraScanState('SCAN_ERROR');
      const errName = err?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraPermissionState('denied');
        setCameraErrorMsg(
          'Camera permission was denied. Please grant Camera access in your Android App Settings or browser address bar to inspect for lens reflections.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraPermissionState('error');
        setCameraErrorMsg('No compatible camera sensor was found on this device.');
      } else {
        setCameraPermissionState('error');
        setCameraErrorMsg(
          `Could not initialize camera preview: ${err?.message || 'Camera in use by another app or restricted by WebView.'}`
        );
      }
    }
  };

  // Restart frame loop when CV settings change while stream is active
  useEffect(() => {
    if (cameraStreamActive) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(processCameraFrame);
    }
  }, [cameraStreamActive, processCameraFrame]);

  const toggleTorch = async () => {
    const nextState = !torchEnabled;
    let applied = false;

    if (mediaStreamRef.current) {
      const track = mediaStreamRef.current.getVideoTracks()[0];
      if (track && typeof track.applyConstraints === 'function') {
        try {
          await track.applyConstraints({
            advanced: [{ torch: nextState } as any]
          });
          applied = true;
        } catch {
          applied = false;
        }
      }
    }

    const bridge = getScannerAndroidBridge();
    if (!applied && bridge?.setTorchMode) {
      try {
        applied = !!bridge.setTorchMode(nextState);
      } catch {
        applied = false;
      }
    }

    if (applied) {
      setTorchEnabled(nextState);
    } else {
      setTorchSupported(false);
      setTorchStatusNote(
        'Torch constraint was rejected by the active camera driver. Please toggle the Android system flashlight from the top Quick Settings bar while keeping this camera preview open.'
      );
    }
  };

  const handleLogCameraFinding = (candidateOverride?: LensCandidateRegion | null) => {
    const targetCandidate =
      candidateOverride ||
      selectedCandidate ||
      (liveSpecularCandidates.length > 0 ? liveSpecularCandidates[0] : null);

    const peak = targetCandidate ? targetCandidate.peakBrightness : cvSensitivity;
    const avgX = targetCandidate ? targetCandidate.cx : 0.5;
    const avgY = targetCandidate ? targetCandidate.cy : 0.5;

    const noteText =
      findingNoteInput.trim() ||
      (targetCandidate
        ? `Candidate ${targetCandidate.id} (${targetCandidate.indicatorsMatched.join(', ')})`
        : 'User-flagged suspicious fixture during manual optical inspection');

    const newFinding: CameraReflectionFinding = {
      id: `cam-clue-${Date.now()}`,
      timestamp: new Date().toISOString(),
      relativeX: avgX,
      relativeY: avgY,
      peakBrightness: peak,
      note: noteText,
      confidenceNote:
        'Visual reflection clue only — glossy screws, LEDs, or glass decor also reflect light. Physical inspection required.'
    };

    setCameraFindings((prev) => [newFinding, ...prev]);
    setFindingNoteInput('');
  };

  // Run Lawful Wi-Fi / Local Network Environment Inspection
  const runWifiInspection = async () => {
    setWifiLoading(true);
    const trustMap = loadSavedTrustMap();

    try {
      const discovered: WifiDiscoveredDevice[] = [];
      let methodUsed = 'Web Network Information API + Server Endpoint Telemetry';
      let limitMsg =
        'Android 10+ and WebView sandboxes block raw ARP (`ip neigh`) table reads to prevent cross-app device tracking. Only verifiable connection endpoints and user-entered router client MAC/IP entries are shown.';

      // 1. Check Native Android Bridge if running inside SmartShield native container
      const bridge = getScannerAndroidBridge();
      if (typeof bridge?.getLocalNetworkSummary === 'function') {
        try {
          const rawJson = bridge.getLocalNetworkSummary();
          if (rawJson) {
            const parsed = JSON.parse(rawJson);
            methodUsed = 'Android ConnectivityManager & LinkProperties Bridge';
            if (parsed.gatewayIp) {
              const key = `gw_${parsed.gatewayIp}`;
              discovered.push({
                id: key,
                ipAddress: parsed.gatewayIp,
                macPrefix: null,
                hostname: parsed.interfaceName ? `Gateway (${parsed.interfaceName})` : 'Local Wi-Fi Router / Gateway',
                manufacturer: 'Local Network Default Gateway',
                status: 'Identified device',
                trustState: trustMap[key] || 'trusted',
                discoverySource: 'android-bridge',
                notes: `Active default route gateway reported by Android LinkProperties${parsed.dnsServers ? ` | DNS: ${parsed.dnsServers}` : ''}.`
              });
            }
            if (parsed.localIp) {
              const key = `self_${parsed.localIp}`;
              discovered.push({
                id: key,
                ipAddress: parsed.localIp,
                macPrefix: null,
                hostname: 'This Smart Shield Android Device',
                manufacturer: 'Authenticated User Device',
                status: 'Identified device',
                trustState: 'trusted',
                discoverySource: 'android-bridge',
                notes: 'Local IPv4 address assigned to this handset on the current network.'
              });
            }
          }
        } catch {
          // ignore bridge parse issues
        }
      }

      // 2. Query server endpoint for genuine request network telemetry
      try {
        const res = await fetch('/api/security-scanner/network-info');
        if (res.ok) {
          const data = await res.json();
          if (data.limitationsNote) {
            limitMsg = data.limitationsNote;
          }
          if (Array.isArray(data.endpoints)) {
            for (const ep of data.endpoints) {
              const key = ep.id || `ep_${ep.ipAddress}`;
              if (!discovered.some((d) => d.ipAddress === ep.ipAddress)) {
                discovered.push({
                  id: key,
                  ipAddress: ep.ipAddress || null,
                  macPrefix: ep.macPrefix || null,
                  hostname: ep.hostname || null,
                  manufacturer: ep.manufacturer || null,
                  status: (ep.status as WifiDeviceStatus) || 'Identified device',
                  trustState: trustMap[key] || 'unreviewed',
                  discoverySource: 'local-endpoint',
                  notes: ep.notes || 'Observed via active session network interface.'
                });
              }
            }
          }
        }
      } catch {
        // ignore offline fetch
      }

      // 3. Add an explicit entry representing sandboxed LAN peers if no raw LAN enumeration is possible
      if (!discovered.some((d) => d.status === 'Not discoverable')) {
        discovered.push({
          id: 'lan_peer_sandbox_notice',
          ipAddress: 'Local Subnet Peers',
          macPrefix: null,
          hostname: 'Other Wi-Fi Clients on This Router',
          manufacturer: null,
          status: 'Not discoverable',
          trustState: 'unreviewed',
          discoverySource: 'local-endpoint',
          notes:
            'Hidden by Android OS / WebView client isolation. To inspect specific devices on this Wi-Fi, open your router admin page or paste any MAC address / OUI below.'
        });
      }

      // Preserve any manual OUI lookups the user already added
      setWifiDevices((prev) => {
        const manualEntries = prev.filter((p) => p.discoverySource === 'manual-oui-lookup');
        return [...discovered, ...manualEntries];
      });
      setWifiScanMethod(methodUsed);
      setWifiLimitationsNote(limitMsg);
    } finally {
      setWifiLoading(false);
    }
  };

  const handleAddManualWifiDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDeviceMac.trim() && !manualDeviceIp.trim() && !manualDeviceLabel.trim()) return;

    const macLookup = manualDeviceMac.trim()
      ? lookupMacVendor(manualDeviceMac)
      : {
          vendor: null,
          typicalRole: null,
          note: 'No MAC prefix provided; device identity cannot be verified via IEEE OUI table.',
          status: 'Unknown device' as WifiDeviceStatus
        };

    const normalizedPrefix = normalizeMacPrefix(manualDeviceMac);
    const id = `manual_${Date.now()}`;
    const trustMap = loadSavedTrustMap();
    const lookupKey = normalizedPrefix || manualDeviceIp.trim() || id;

    const newDevice: WifiDiscoveredDevice = {
      id,
      ipAddress: manualDeviceIp.trim() || null,
      macPrefix: normalizedPrefix || (manualDeviceMac.trim() ? manualDeviceMac.trim().toUpperCase() : null),
      hostname: manualDeviceLabel.trim() || macLookup.typicalRole || 'User-Entered Network Device',
      manufacturer: macLookup.vendor,
      status: macLookup.status,
      trustState: trustMap[lookupKey] || 'unreviewed',
      discoverySource: 'manual-oui-lookup',
      notes: macLookup.note
    };

    setWifiDevices((prev) => [newDevice, ...prev]);
    setManualDeviceLabel('');
    setManualDeviceIp('');
    setManualDeviceMac('');
  };

  const handleSetDeviceTrust = (device: WifiDiscoveredDevice, state: 'trusted' | 'unfamiliar') => {
    const key = device.macPrefix || device.ipAddress || device.id;
    saveDeviceTrustState(key, state);
    setWifiDevices((prev) =>
      prev.map((d) => (d.id === device.id ? { ...d, trustState: state } : d))
    );
  };

  // Start Real Magnetometer Sensor
  const startMagnetometer = () => {
    stopMagnetometer();

    if (!capabilities?.magnetometerSupported) {
      return;
    }

    const bridge = getScannerAndroidBridge();
    if (
      capabilities.magnetometerSource === 'android-bridge' &&
      bridge?.startMagnetometer &&
      bridge?.getMagnetometerReading
    ) {
      const started = bridge.startMagnetometer();
      if (started) {
        setMagMonitoring(true);
        magPollIntervalRef.current = window.setInterval(() => {
          try {
            const raw = getScannerAndroidBridge()?.getMagnetometerReading?.();
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (
              typeof parsed.x === 'number' &&
              typeof parsed.y === 'number' &&
              typeof parsed.z === 'number'
            ) {
              const mag = Math.sqrt(
                parsed.x * parsed.x + parsed.y * parsed.y + parsed.z * parsed.z
              );
              const reading: MagnetometerReading = {
                x: parsed.x,
                y: parsed.y,
                z: parsed.z,
                magnitudeUt: mag,
                timestamp: Date.now()
              };
              setCurrentMagReading(reading);
              setPeakMagUt((prev) => (prev === null || mag > prev ? mag : prev));
              setMagHistory((prev) => [...prev.slice(-59), mag]);
            }
          } catch {
            // ignore
          }
        }, 120);
      }
      return;
    }

    if (capabilities.magnetometerSource === 'web-sensor' && 'Magnetometer' in window) {
      try {
        const MagnetometerCtor = (window as any).Magnetometer;
        const sensor = new MagnetometerCtor({ frequency: 10 });
        magSensorRef.current = sensor;
        sensor.addEventListener('reading', () => {
          const x = Number(sensor.x || 0);
          const y = Number(sensor.y || 0);
          const z = Number(sensor.z || 0);
          const mag = Math.sqrt(x * x + y * y + z * z);
          const reading: MagnetometerReading = {
            x,
            y,
            z,
            magnitudeUt: mag,
            timestamp: Date.now()
          };
          setCurrentMagReading(reading);
          setPeakMagUt((prev) => (prev === null || mag > prev ? mag : prev));
          setMagHistory((prev) => [...prev.slice(-59), mag]);
        });
        sensor.addEventListener('error', () => {
          stopMagnetometer();
        });
        sensor.start();
        setMagMonitoring(true);
      } catch {
        stopMagnetometer();
      }
    }
  };

  // Draw live magnetometer graph when magHistory updates
  useEffect(() => {
    if (!magCanvasRef.current || magHistory.length === 0) return;
    const canvas = magCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Reference baseline band (Earth ambient field ~25–65 uT)
    const maxScale = Math.max(150, ...magHistory);
    const y65 = h - (65 / maxScale) * h;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y65);
    ctx.lineTo(w, y65);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    magHistory.forEach((val, idx) => {
      const x = (idx / Math.max(1, 59)) * w;
      const y = h - Math.min(1, val / maxScale) * (h - 10) - 5;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [magHistory]);

  const handleLogMagReading = () => {
    if (!currentMagReading) return;
    const newItem: MagnetometerLogItem = {
      id: `mag-${Date.now()}`,
      timestamp: new Date().toISOString(),
      magnitudeUt: currentMagReading.magnitudeUt,
      x: currentMagReading.x,
      y: currentMagReading.y,
      z: currentMagReading.z,
      userNote: magNoteInput.trim() || 'Logged close-range magnetic measurement'
    };
    setMagLogs((prev) => [newItem, ...prev]);
    setMagNoteInput('');
  };

  const toggleChecklistItem = (id: string) => {
    setPhysicalChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const toggleChecklistFlag = (id: string) => {
    setPhysicalChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, flaggedSuspicious: !item.flaggedSuspicious, checked: true } : item
      )
    );
  };

  const updateChecklistNote = (id: string, note: string) => {
    setPhysicalChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, userNotes: note } : item))
    );
  };

  // Run AI Security Interpretation (Requires Explicit User Consent)
  const handleRunAIAnalysis = async () => {
    setAiErrorNote(null);

    if (!userAiConsent) {
      setAiErrorNote(
        'Please check the explicit consent box before transmitting your inspection summary for AI interpretation.'
      );
      return;
    }

    setAiAnalyzing(true);
    try {
      const payload = {
        userConsentGranted: true,
        locationLabel,
        cameraFindings,
        irInspection,
        wifiDevices,
        magnetometerAvailable: !!capabilities?.magnetometerSupported,
        magnetometerLogs: magLogs,
        physicalChecklist
      };

      const res = await fetch('/api/security-scanner/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setAiAnalysis(data.analysis);
          return;
        }
      }

      // Deterministic local analysis if server AI is unreachable
      const fallback = buildLocalFallbackAnalysis(
        cameraFindings,
        irInspection,
        wifiDevices,
        !!capabilities?.magnetometerSupported,
        magLogs,
        physicalChecklist
      );
      setAiAnalysis(fallback);
    } catch {
      const fallback = buildLocalFallbackAnalysis(
        cameraFindings,
        irInspection,
        wifiDevices,
        !!capabilities?.magnetometerSupported,
        magLogs,
        physicalChecklist
      );
      setAiAnalysis(fallback);
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Build and Save Security Report
  const handleSaveCurrentReport = () => {
    const analysisToUse =
      aiAnalysis ||
      buildLocalFallbackAnalysis(
        cameraFindings,
        irInspection,
        wifiDevices,
        !!capabilities?.magnetometerSupported,
        magLogs,
        physicalChecklist
      );

    const report: PrivateSpaceSecurityReport = {
      id: `SSR-${Date.now()}`,
      createdAt: new Date().toISOString(),
      locationLabel: locationLabel.trim() || 'Private Space Inspection',
      cameraCapabilities: {
        supported: !!capabilities?.cameraApiSupported,
        torchSupported,
        permissionState: cameraPermissionState
      },
      cameraFindings,
      irInspection,
      wifiScanSummary: {
        scanMethod: wifiScanMethod,
        limitationsNote: wifiLimitationsNote,
        devices: wifiDevices
      },
      magnetometerSummary: {
        sensorAvailable: !!capabilities?.magnetometerSupported,
        unavailabilityReason: capabilities?.magnetometerLimitationReason || 'Sensor unavailable',
        peakMagnitudeUt: peakMagUt,
        logs: magLogs
      },
      physicalChecklist,
      aiAnalysis: analysisToUse,
      userConsentForAI: userAiConsent
    };

    const updated = saveSecurityReport(report);
    setSavedReports(updated);
    setSelectedReport(report);
    setReportSaveNotice('Security Report saved to local device storage.');
    setTimeout(() => setReportSaveNotice(null), 4000);
  };

  const handleExportReport = (report: PrivateSpaceSecurityReport, format: 'txt' | 'json') => {
    const content =
      format === 'json' ? JSON.stringify(report, null, 2) : formatReportAsText(report);
    const mime = format === 'json' ? 'application/json' : 'text/plain;charset=utf-8';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartShield-Security-Report-${report.id}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteReport = (reportId: string) => {
    const updated = deleteSecurityReport(reportId);
    setSavedReports(updated);
    if (selectedReport?.id === reportId) {
      setSelectedReport(null);
    }
  };

  const completedChecklistCount = physicalChecklist.filter((c) => c.checked).length;
  const flaggedChecklistCount = physicalChecklist.filter((c) => c.flaggedSuspicious).length;

  return (
    <div className="space-y-6 pb-10">
      {/* Top Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-cyan-950/60 to-blue-950/60 border border-cyan-500/40 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-extrabold uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI PRIVATE SPACE SECURITY SCANNER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Hidden Camera &amp; Electronic Bug Inspection Suite
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Real-time optical lens reflection analysis, infrared remote calibration, local network OUI inspection, hardware magnetometer telemetry, and structured physical verification for hotel rooms, changing rooms, and private spaces.
            </p>
          </div>

          {/* Room / Space Label & Primary Screen Switcher */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <div className="flex items-center bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-2">
              <span className="text-[11px] font-bold text-cyan-400 uppercase mr-2 shrink-0">
                Space Label:
              </span>
              <input
                type="text"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="e.g., Room 402 / Airbnb"
                className="bg-transparent text-xs text-white font-semibold focus:outline-none w-44"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveScreen('dashboard')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  activeScreen === 'dashboard'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                1. Dashboard
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('live_inspection')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  activeScreen === 'live_inspection'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                2. Live Tools
              </button>
              <button
                type="button"
                onClick={() => {
                  stopCameraInspection();
                  setActiveScreen('results');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  activeScreen === 'results'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                3. AI Results
              </button>
              <button
                type="button"
                onClick={() => {
                  stopCameraInspection();
                  setActiveScreen('reports');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  activeScreen === 'reports'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                4. Reports ({savedReports.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Honest Technical Notice Banner */}
      <div className="rounded-2xl bg-slate-900/90 border border-cyan-500/30 p-4 flex items-start space-x-3">
        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="font-bold text-cyan-200">
            Evidence-Based Inspection Notice — No Simulated Scans or False Guarantees
          </p>
          <p>
            Smartphones use optical cameras, network checks, and magnetic sensors as physical inspection aids. They cannot guarantee a room is &ldquo;100% safe&rdquo; or automatically detect powered-off/non-transmitting cameras behind opaque walls. Every clue highlighted below requires manual visual verification.
          </p>
        </div>
      </div>

      {/* =====================================================================
          SCREEN A: SECURITY SCANNER DASHBOARD
          ===================================================================== */}
      {activeScreen === 'dashboard' && (
        <div className="space-y-6">
          {/* Device Hardware Capability Matrix */}
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-white flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Real-Time Hardware &amp; Container Capabilities</span>
              </h2>
              <button
                type="button"
                onClick={() => detectScannerCapabilities().then(setCapabilities)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-check Sensors</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Optical Camera API</span>
                  {capabilities?.cameraApiSupported ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-extrabold">
                      SUPPORTED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-700 text-[10px] font-extrabold">
                      UNAVAILABLE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300">
                  {capabilities?.cameraApiSupported
                    ? 'Ready for live lens reflection analysis & IR remote testing.'
                    : 'Camera API blocked by WebView or missing HTTPS context.'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Flashlight / Torch</span>
                  <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-700 text-[10px] font-extrabold">
                    VERIFIED ON STREAM
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Tested when rear camera opens via MediaStreamTrack or Android CameraManager bridge.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Magnetometer Sensor</span>
                  {capabilities?.magnetometerSupported ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-extrabold">
                      AVAILABLE ({capabilities.magnetometerSource})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-700 text-[10px] font-extrabold">
                      SENSOR UNAVAILABLE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300">
                  {capabilities?.magnetometerLimitationReason || 'Checking hardware magnetometer...'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Network Environment</span>
                  <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-700 text-[10px] font-extrabold">
                    SANDBOX-SAFE
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {capabilities?.effectiveConnectionType
                    ? `Link type: ${capabilities.effectiveConnectionType.toUpperCase()} (${capabilities.downlinkMbps ?? '?'} Mbps)`
                    : 'Local endpoint inspection + IEEE OUI MAC vendor lookup ready.'}
                </p>
              </div>
            </div>
          </div>

          {/* 6 Core Sub-Module Launch Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Camera Lens Inspection */}
            <div className="rounded-3xl bg-slate-900/90 border border-cyan-500/30 p-6 flex flex-col justify-between space-y-4 hover:border-cyan-400 transition-all shadow-xl">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                    Optical Reflection Clues
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Camera Lens Inspection
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Uses your live camera feed, flashlight control (when supported), and computer-vision specular highlight detection to spot tiny pinhole glass reflections for manual inspection.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">
                  {cameraFindings.length} clue(s) logged
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('camera_lens');
                    setActiveScreen('live_inspection');
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>Open Lens Scanner</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2. Infrared Light Inspection */}
            <div className="rounded-3xl bg-slate-900/90 border border-blue-500/30 p-6 flex flex-col justify-between space-y-4 hover:border-blue-400 transition-all shadow-xl">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">
                    Night-Vision LED Check
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Infrared Light Inspection
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Test your camera sensor with a standard TV/AC infrared remote to verify whether your front or rear camera can detect near-IR night-vision emitters in a darkened room.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">
                  {irInspection.tested ? 'Calibration tested' : 'Not calibrated yet'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('infrared');
                    setActiveScreen('live_inspection');
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>Open IR Check</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 3. Wi-Fi Device Scanner */}
            <div className="rounded-3xl bg-slate-900/90 border border-cyan-500/30 p-6 flex flex-col justify-between space-y-4 hover:border-cyan-400 transition-all shadow-xl">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
                  <Wifi className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                    Local Network &amp; IEEE OUI
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Wi-Fi Device Scanner
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Inspect your current network link, understand Android/WebView client isolation limits, look up MAC OUI hardware vendors (Espressif, Hikvision, Wyze, etc.), and tag devices as Trusted or Unfamiliar.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">
                  {wifiDevices.length} endpoint(s) listed
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('wifi');
                    setActiveScreen('live_inspection');
                    if (wifiDevices.length === 0) runWifiInspection();
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>Open Wi-Fi Scanner</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4. Magnetic Sensor Inspection */}
            <div className="rounded-3xl bg-slate-900/90 border border-indigo-500/30 p-6 flex flex-col justify-between space-y-4 hover:border-indigo-400 transition-all shadow-xl">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center">
                  <Compass className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">
                    Close-Range Magnetometer
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Magnetic Sensor Inspection
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Reads real X, Y, Z magnetic field values in microtesla (&mu;T) when hardware magnetometer access is available, or clearly reports sensor unavailability without fake numbers.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">
                  {capabilities?.magnetometerSupported ? 'Hardware Ready' : 'Sensor Unavailable'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('magnetometer');
                    setActiveScreen('live_inspection');
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>Open Magnetometer</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 5. Electronic & Audio Bug Inspection Guide */}
            <div className="rounded-3xl bg-slate-900/90 border border-cyan-500/30 p-6 flex flex-col justify-between space-y-4 hover:border-cyan-400 transition-all shadow-xl">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                    Physical &amp; Acoustic Guide
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Electronic Device Inspection Guide
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Interactive room-by-room checklist for smoke detectors, USB power blocks, clocks, mirrors, and vents—without requesting microphone permissions or making false audio bug claims.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">
                  {completedChecklistCount}/{physicalChecklist.length} inspected
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('physical_guide');
                    setActiveScreen('live_inspection');
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>Open Checklist</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 6. AI Security Analysis & Report */}
            <div className="rounded-3xl bg-slate-900/90 border border-blue-500/30 p-6 flex flex-col justify-between space-y-4 hover:border-blue-400 transition-all shadow-xl">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">
                    Consent-Based Interpretation
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Security Report &amp; AI Review
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Review all measured findings, generate an AI-assisted verification plan with explicit user consent, and export or delete saved Security Reports.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">
                  {savedReports.length} saved report(s)
                </span>
                <button
                  type="button"
                  onClick={() => setActiveScreen('results')}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>Review Findings</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN B: LIVE INSPECTION SCREEN
          ===================================================================== */}
      {activeScreen === 'live_inspection' && (
        <div className="space-y-6">
          {/* Sub-Tool Selector Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTool('camera_lens')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeTool === 'camera_lens'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Camera Lens Inspection</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('infrared')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeTool === 'infrared'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Infrared Light Check</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCameraInspection();
                setActiveTool('wifi');
                if (wifiDevices.length === 0) runWifiInspection();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeTool === 'wifi'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Wifi className="w-4 h-4" />
              <span>Wi-Fi Device Scanner</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCameraInspection();
                setActiveTool('magnetometer');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeTool === 'magnetometer'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Magnetic Sensor</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCameraInspection();
                setActiveTool('physical_guide');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition-all cursor-pointer ${
                activeTool === 'physical_guide'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Electronic &amp; Audio Bug Guide</span>
            </button>
          </div>

          {/* -----------------------------------------------------------------
              SUB-TOOL 1: CAMERA LENS INSPECTION
              ----------------------------------------------------------------- */}
          {activeTool === 'camera_lens' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-3xl bg-slate-900/90 border border-cyan-500/30 p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-white">
                      Optical Camera Lens Reflection Scanner
                    </h2>
                    <p className="text-xs text-slate-400">
                      Shine a light toward suspicious fixtures and move your phone slowly to spot pinpoint glass lens reflections.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!cameraStreamActive ? (
                      <button
                        type="button"
                        onClick={() => startCameraInspection('environment')}
                        className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 shadow-lg cursor-pointer"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Camera Inspection</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            startCameraInspection(
                              cameraFacingMode === 'environment' ? 'user' : 'environment'
                            )
                          }
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>
                            Switch to {cameraFacingMode === 'environment' ? 'Front' : 'Rear'} Camera
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={toggleTorch}
                          disabled={!torchSupported}
                          className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center space-x-1.5 cursor-pointer ${
                            torchEnabled
                              ? 'bg-amber-400 text-slate-950'
                              : torchSupported
                                ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40'
                                : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                          }`}
                        >
                          <Flashlight className="w-3.5 h-3.5" />
                          <span>{torchEnabled ? 'Torch ON' : 'Toggle Torch'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRescanCamera}
                          className="px-3 py-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-500/50 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Rescan</span>
                        </button>

                        <button
                          type="button"
                          onClick={stopCameraInspection}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>Stop Scan</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 5-State Dynamic Camera Scan Status Banner (Never Shows Static False-Positive Warning) */}
                {cameraStreamActive && !cameraErrorMsg && (
                  <div
                    className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 ${
                      cameraScanState === 'POSSIBLE_CANDIDATE'
                        ? 'bg-amber-950/80 border-amber-500/70 text-amber-100'
                        : cameraScanState === 'NO_CANDIDATE'
                          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-100'
                          : cameraScanState === 'LOW_CONFIDENCE'
                            ? 'bg-slate-900 border-amber-500/40 text-amber-200'
                            : 'bg-cyan-950/60 border-cyan-500/50 text-cyan-100'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {cameraScanState === 'POSSIBLE_CANDIDATE' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      ) : cameraScanState === 'NO_CANDIDATE' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1 text-xs">
                        <div className="font-black">
                          {CAMERA_SCAN_STATUS_MESSAGES[cameraScanState]}
                        </div>
                        {cameraScanQualityDetail && (
                          <p className="text-[11px] opacity-90">{cameraScanQualityDetail}</p>
                        )}
                      </div>
                    </div>

                    {liveSpecularCandidates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedCandidate(liveSpecularCandidates[0])}
                        className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shrink-0 cursor-pointer"
                      >
                        Manual Inspection
                      </button>
                    )}
                  </div>
                )}

                {/* Camera Error / Denied Message (STATE 5: SCAN ERROR) */}
                {cameraErrorMsg && (
                  <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200 space-y-2">
                    <div className="font-black text-white flex items-center space-x-2">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>{CAMERA_SCAN_STATUS_MESSAGES.SCAN_ERROR}</span>
                    </div>
                    <p>{cameraErrorMsg}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => startCameraInspection(cameraFacingMode)}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                      >
                        Retry Camera Scan
                      </button>
                    </div>
                  </div>
                )}

                {/* Live Video + CV Canvas Viewport + Interactive Tappable Candidate Bounding Boxes */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraStreamActive ? 'block' : 'hidden'}`}
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    className={`absolute inset-0 w-full h-full pointer-events-none ${
                      cameraStreamActive ? 'block' : 'hidden'
                    }`}
                  />

                  {/* Clickable / Tappable Candidate Bounding Box Hit Targets */}
                  {cameraStreamActive &&
                    liveSpecularCandidates.map((cand, idx) => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => setSelectedCandidate(cand)}
                        style={{
                          left: `${cand.boxX * 100}%`,
                          top: `${cand.boxY * 100}%`,
                          width: `${cand.boxW * 100}%`,
                          height: `${cand.boxH * 100}%`
                        }}
                        title={`Tap to inspect Candidate #${idx + 1} manually`}
                        className="absolute border-2 border-cyan-400/60 hover:border-amber-400 rounded-lg bg-transparent cursor-pointer focus:outline-none"
                      />
                    ))}

                  {!cameraStreamActive && (
                    <div className="p-8 text-center space-y-3 max-w-md">
                      <Camera className="w-12 h-12 text-cyan-400 mx-auto opacity-80" />
                      <h3 className="text-base font-bold text-white">
                        Live Camera Preview Standby
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Press <strong>Start Camera Inspection</strong> above to request runtime camera access. Camera frames are analyzed strictly on-device in memory and are never uploaded.
                      </p>
                    </div>
                  )}
                </div>

                {/* Selected Candidate Manual Inspection Panel */}
                {selectedCandidate && (
                  <div className="p-4 rounded-2xl bg-slate-950 border-2 border-cyan-400/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                          Manual Candidate Verification
                        </span>
                        <h4 className="text-sm font-black text-white">
                          Inspecting Candidate ({selectedCandidate.id})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCandidate(null)}
                        className="text-xs text-slate-400 hover:text-white font-bold cursor-pointer"
                      >
                        Close
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {selectedCandidate.indicatorsMatched.map((ind, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-700 text-[10px] font-bold"
                        >
                          {ind}
                        </span>
                      ))}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>How to verify physically:</strong> Move 15–30 cm closer to this exact spot and change your viewing angle slightly. A real pinhole camera lens sits inside a tiny dark circular opening (1–3 mm) behind glass or plastic, whereas benign reflections on chrome, mirrors, or LEDs shift across flat surfaces.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleLogCameraFinding(selectedCandidate);
                          setSelectedCandidate(null);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer"
                      >
                        Log Candidate to Security Report
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCandidate(null)}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                      >
                        Dismiss as Benign Surface Reflection
                      </button>
                    </div>
                  </div>
                )}

                {/* Torch & CV Controls Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        CV Reflection Clue Highlighting
                      </span>
                      <button
                        type="button"
                        onClick={() => setCvOverlayEnabled(!cvOverlayEnabled)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                          cvOverlayEnabled
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {cvOverlayEnabled ? 'CV Clues ON' : 'Guided Manual Mode'}
                      </button>
                    </div>
                    {cvOverlayEnabled && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Glint Threshold Sensitivity</span>
                          <span className="text-cyan-300 font-bold">{cvSensitivity}/255</span>
                        </div>
                        <input
                          type="range"
                          min={215}
                          max={250}
                          value={cvSensitivity}
                          onChange={(e) => setCvSensitivity(Number(e.target.value))}
                          className="w-full accent-cyan-400"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <Flashlight className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Flashlight / Torch Status</span>
                    </span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{torchStatusNote}</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Log Reflection Findings & Guided Manual Instructions */}
              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 space-y-5">
                <div className="space-y-2">
                  <h3 className="text-base font-black text-white">
                    Log Suspicious Object for Manual Verification
                  </h3>
                  <p className="text-xs text-slate-400">
                    Record where you observed a lens-like reflection so it is included in your Security Report.
                  </p>
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={findingNoteInput}
                      onChange={(e) => setFindingNoteInput(e.target.value)}
                      placeholder="e.g., Vent grille facing bed / digital clock"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleLogCameraFinding()}
                      className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Log Optical Reflection Clue</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
                    Logged Optical Clues ({cameraFindings.length})
                  </h4>
                  {cameraFindings.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No reflection clues logged in this session yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {cameraFindings.map((f) => (
                        <div
                          key={f.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-cyan-300">
                              {new Date(f.timestamp).toLocaleTimeString()}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCameraFindings((prev) => prev.filter((item) => item.id !== f.id))
                              }
                              className="text-slate-500 hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-white font-semibold">{f.note}</p>
                          <p className="text-[10px] text-slate-400">{f.confidenceNote}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-300">
                  <div className="font-bold text-white">Guided Manual Lens Inspection Technique</div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                    <li>Dim the room lights and close curtains if possible.</li>
                    <li>Hold your phone flashlight close to your eye line so retro-reflections bounce directly back to you or the camera lens.</li>
                    <li>Scan objects that have a direct view of the bed, shower, or changing area.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              SUB-TOOL 2: INFRARED LIGHT INSPECTION
              ----------------------------------------------------------------- */}
          {activeTool === 'infrared' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-3xl bg-slate-900/90 border border-blue-500/30 p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-white">
                      Infrared (IR) Night-Vision Light Inspection
                    </h2>
                    <p className="text-xs text-slate-400">
                      Calibrate your camera sensor with a standard TV/AC remote before scanning a darkened room for 850nm/940nm IR emitters.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!cameraStreamActive ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startCameraInspection('user')}
                          className="px-3.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-black text-xs cursor-pointer"
                        >
                          Start Front Camera (Often Less IR Filtering)
                        </button>
                        <button
                          type="button"
                          onClick={() => startCameraInspection('environment')}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                        >
                          Start Rear Camera
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            startCameraInspection(
                              cameraFacingMode === 'environment' ? 'user' : 'environment'
                            )
                          }
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                        >
                          Switch to {cameraFacingMode === 'environment' ? 'Front' : 'Rear'} Sensor
                        </button>
                        <button
                          type="button"
                          onClick={stopCameraInspection}
                          className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer"
                        >
                          Stop Camera
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Live Video Preview for IR Testing */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraStreamActive ? 'block' : 'hidden'}`}
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    className={`absolute inset-0 w-full h-full pointer-events-none ${
                      cameraStreamActive ? 'block' : 'hidden'
                    }`}
                  />
                  {!cameraStreamActive && (
                    <div className="p-8 text-center space-y-2 max-w-md">
                      <Eye className="w-12 h-12 text-blue-400 mx-auto opacity-80" />
                      <h3 className="text-base font-bold text-white">
                        Open Front or Rear Camera to Run the IR Remote Test
                      </h3>
                      <p className="text-xs text-slate-400">
                        Many rear smartphone cameras have strong IR-cut filters, while front-facing cameras often allow near-infrared light to appear as a pinkish-white glow.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* IR Calibration & Limitations Panel */}
              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 space-y-4">
                <h3 className="text-base font-black text-white">
                  Step-by-Step IR Remote Calibration
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-300">
                  <li>Start the <strong>Front Camera</strong> (or Rear Camera) preview on the left.</li>
                  <li>Point a household TV or air-conditioner infrared remote control directly at the camera lens.</li>
                  <li>Press and hold any button on the remote while watching the preview screen.</li>
                  <li>Record below whether you see a pulsing pinkish/white dot on the remote tip.</li>
                </ol>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setIrInspection({
                        tested: true,
                        cameraUsed: cameraFacingMode,
                        remoteTestPerformed: true,
                        irLightObserved: true,
                        filterLimitationNote: `Verified: The ${cameraFacingMode === 'user' ? 'front' : 'rear'} camera sensor detected near-IR light from a test remote. Turn off room lights and scan for steady dim purple/white dots—note that 940nm emitters or daytime cameras without IR LEDs will still not glow.`
                      })
                    }
                    className={`w-full p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                      irInspection.tested && irInspection.irLightObserved
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    Yes — I saw the IR remote LED glow on screen
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setIrInspection({
                        tested: true,
                        cameraUsed: cameraFacingMode,
                        remoteTestPerformed: true,
                        irLightObserved: false,
                        filterLimitationNote: `Hardware IR-Cut Filter Active: Your ${cameraFacingMode === 'user' ? 'front' : 'rear'} camera sensor blocked the IR remote signal. Try switching to the other camera sensor; if neither shows the remote glow, this phone blocks infrared light and cannot detect night-vision LEDs.`
                      })
                    }
                    className={`w-full p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                      irInspection.tested && !irInspection.irLightObserved
                        ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    No — No IR glow visible (Blocked by IR-Cut Filter)
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                  <div className="font-bold text-blue-300">Recorded Calibration Status</div>
                  <p className="text-slate-300 leading-relaxed">{irInspection.filterLimitationNote}</p>
                  <p className="text-[11px] text-amber-300 pt-1">
                    Important: Absence of visible IR light never proves no camera exists. Standard daylight pinhole cameras do not use infrared LEDs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              SUB-TOOL 3: WI-FI NETWORK DEVICE INSPECTION
              ----------------------------------------------------------------- */}
          {activeTool === 'wifi' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-3xl bg-slate-900/90 border border-cyan-500/30 p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-white">
                      Local Wi-Fi Environment &amp; Device OUI Inspector
                    </h2>
                    <p className="text-xs text-slate-400">
                      Inspects your active network link and identifies hardware vendors from IEEE OUI MAC prefixes without making illegal port attacks or fake camera claims.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={runWifiInspection}
                    disabled={wifiLoading}
                    className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${wifiLoading ? 'animate-spin' : ''}`} />
                    <span>{wifiLoading ? 'Inspecting Link...' : 'Refresh Network Check'}</span>
                  </button>
                </div>

                {/* Honest OS / Client Isolation Explanation */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300">
                      Discovery Method: {wifiScanMethod}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{wifiLimitationsNote}</p>
                </div>

                {/* Device List Table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Observed &amp; User-Inspected Network Entries ({wifiDevices.length})
                  </h3>

                  {wifiDevices.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                      Click <strong>Refresh Network Check</strong> to inspect your active network interface, or enter a MAC address / IP on the right.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {wifiDevices.map((dev) => (
                        <div
                          key={dev.id}
                          className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-black text-white">
                                {dev.hostname || 'Network Endpoint'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                                  dev.status === 'Inspection required'
                                    ? 'bg-amber-950 text-amber-300 border-amber-600'
                                    : dev.status === 'Identified device'
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                      : dev.status === 'Not discoverable'
                                        ? 'bg-slate-900 text-slate-400 border-slate-700'
                                        : 'bg-blue-950 text-blue-300 border-blue-700'
                                }`}
                              >
                                {dev.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                              <span>IP: {dev.ipAddress || 'Not exposed'}</span>
                              <span>MAC/OUI: {dev.macPrefix || 'Restricted by OS'}</span>
                              <span>Vendor: {dev.manufacturer || 'Identity not established'}</span>
                            </div>

                            <p className="text-xs text-slate-300 pt-0.5">{dev.notes}</p>
                          </div>

                          {dev.status !== 'Not discoverable' && (
                            <div className="flex items-center space-x-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleSetDeviceTrust(dev, 'trusted')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                                  dev.trustState === 'trusted'
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-500/60'
                                }`}
                              >
                                Trusted
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetDeviceTrust(dev, 'unfamiliar')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                                  dev.trustState === 'unfamiliar'
                                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500/60'
                                }`}
                              >
                                Unfamiliar
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: IEEE OUI MAC Manufacturer Lookup & Router Entry */}
              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 space-y-4">
                <h3 className="text-base font-black text-white">
                  IEEE OUI MAC Vendor Lookup &amp; Router Device Entry
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  If you view connected clients on your Wi-Fi router page or hotspot list, enter a device&apos;s MAC address (or first 6 hex digits) below to check whether its manufacturer produces IoT/camera modules.
                </p>

                <form onSubmit={handleAddManualWifiDevice} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      MAC Address or OUI Prefix (e.g. 24:0A:C4 or 4C:BC:98)
                    </label>
                    <input
                      type="text"
                      value={manualDeviceMac}
                      onChange={(e) => setManualDeviceMac(e.target.value)}
                      placeholder="24:0A:C4:12:34:56"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      IP Address (Optional)
                    </label>
                    <input
                      type="text"
                      value={manualDeviceIp}
                      onChange={(e) => setManualDeviceIp(e.target.value)}
                      placeholder="192.168.1.45"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Hostname / Label (Optional)
                    </label>
                    <input
                      type="text"
                      value={manualDeviceLabel}
                      onChange={(e) => setManualDeviceLabel(e.target.value)}
                      placeholder="Unknown client on hotel Wi-Fi"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                    <span>Inspect MAC Vendor &amp; Add to List</span>
                  </button>
                </form>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="font-bold text-slate-200">Why Network Scanning Has Limits:</div>
                  <p>
                    1. Cameras recording purely to an internal SD card without Wi-Fi never appear on any network scan.
                  </p>
                  <p>
                    2. Hotel networks use AP Client Isolation and randomized MACs, so a network entry alone never confirms a hidden camera.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              SUB-TOOL 4: MAGNETIC SENSOR INSPECTION
              ----------------------------------------------------------------- */}
          {activeTool === 'magnetometer' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-3xl bg-slate-900/90 border border-indigo-500/30 p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-white">
                      Close-Range Magnetic Field Sensor (&mu;T)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Measures live X, Y, Z magnetic flux density in microtesla (&mu;T) when hardware magnetometer access is supported.
                    </p>
                  </div>

                  {capabilities?.magnetometerSupported && (
                    <div>
                      {!magMonitoring ? (
                        <button
                          type="button"
                          onClick={startMagnetometer}
                          className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Play className="w-4 h-4" />
                          <span>Start Magnetometer</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopMagnetometer}
                          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Square className="w-4 h-4" />
                          <span>Stop Sensor</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* IF SENSOR UNAVAILABLE: Show Honest Message, Never Invent Readings */}
                {!capabilities?.magnetometerSupported ? (
                  <div className="p-6 rounded-2xl bg-amber-950/60 border-2 border-amber-500/60 space-y-3">
                    <div className="flex items-center space-x-2.5">
                      <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                      <h3 className="text-base font-black text-white">
                        Magnetometer Sensor Unavailable on This Runtime
                      </h3>
                    </div>
                    <p className="text-xs text-amber-100 leading-relaxed">
                      {capabilities?.magnetometerLimitationReason ||
                        'This device or WebView container does not expose hardware TYPE_MAGNETIC_FIELD / Web Magnetometer readings.'}
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>Zero-Simulation Guarantee:</strong> Smart Shield never generates synthetic or random magnetic numbers when hardware sensor access is unavailable. Please use the <strong>Camera Lens Inspection</strong> and <strong>Electronic Device Inspection Guide</strong> tabs to perform your room check.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                        <span className="text-[11px] font-bold text-slate-400">Magnitude |B|</span>
                        <div className="text-2xl font-black text-cyan-400 mt-1">
                          {currentMagReading ? `${currentMagReading.magnitudeUt.toFixed(1)} µT` : '—'}
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                        <span className="text-[11px] font-bold text-slate-400">X-Axis</span>
                        <div className="text-lg font-extrabold text-white mt-1">
                          {currentMagReading ? `${currentMagReading.x.toFixed(1)} µT` : '—'}
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                        <span className="text-[11px] font-bold text-slate-400">Y-Axis</span>
                        <div className="text-lg font-extrabold text-white mt-1">
                          {currentMagReading ? `${currentMagReading.y.toFixed(1)} µT` : '—'}
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                        <span className="text-[11px] font-bold text-slate-400">Z-Axis</span>
                        <div className="text-lg font-extrabold text-white mt-1">
                          {currentMagReading ? `${currentMagReading.z.toFixed(1)} µT` : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Live Magnetic Flux Graph (&mu;T)</span>
                        <span>Peak: {peakMagUt ? `${peakMagUt.toFixed(1)} µT` : '—'}</span>
                      </div>
                      <canvas
                        ref={magCanvasRef}
                        width={600}
                        height={140}
                        className="w-full h-32 bg-slate-900/60 rounded-xl"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={magNoteInput}
                        onChange={(e) => setMagNoteInput(e.target.value)}
                        placeholder="Object inspected (e.g., clock frame, charger)"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={handleLogMagReading}
                        disabled={!currentMagReading}
                        className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black text-xs cursor-pointer"
                      >
                        Log Reading
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Calibration & False-Positive Explanation */}
              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 space-y-4">
                <h3 className="text-base font-black text-white">
                  Calibration &amp; Close-Range Physics
                </h3>
                <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                  <p>
                    <strong>1. Figure-8 Calibration:</strong> Wave your phone gently in a figure-8 motion in open air away from metal furniture before scanning. Earth&apos;s natural magnetic field is typically 25–65 &mu;T.
                  </p>
                  <p>
                    <strong>2. Very Short Range (1–5 cm):</strong> Magnetic fields drop off with the inverse cube of distance. You must hold the phone within a few centimeters of the object being inspected.
                  </p>
                  <p>
                    <strong>3. Normal Household Metal Sources:</strong> Speakers, alarm clocks, power transformers, door locks, and steel screws naturally cause spikes above 100 &mu;T. A magnetic spike alone never proves a hidden bug is present.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              SUB-TOOL 5: AUDIO BUG & ELECTRONIC DEVICE INSPECTION GUIDE
              ----------------------------------------------------------------- */}
          {activeTool === 'physical_guide' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-3xl bg-slate-900/90 border border-cyan-500/30 p-5 sm:p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-black text-white">
                    Structured Physical &amp; Electronic Bug Inspection Checklist
                  </h2>
                  <p className="text-xs text-slate-400">
                    Inspect high-risk fixtures that have a direct line of sight to beds, showers, or dressing areas.
                  </p>
                </div>

                <div className="space-y-3">
                  {physicalChecklist.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        item.flaggedSuspicious
                          ? 'bg-rose-950/40 border-rose-500/70'
                          : item.checked
                            ? 'bg-emerald-950/30 border-emerald-500/50'
                            : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                            {item.category} • {item.locationHint}
                          </span>
                          <h3 className="text-sm font-black text-white">{item.title}</h3>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleChecklistItem(item.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 cursor-pointer ${
                              item.checked
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{item.checked ? 'Inspected' : 'Mark Inspected'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleChecklistFlag(item.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 cursor-pointer ${
                              item.flaggedSuspicious
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-900 text-amber-300 border border-amber-500/40 hover:bg-amber-950/50'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{item.flaggedSuspicious ? 'Flagged' : 'Flag Suspicious'}</span>
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">{item.whatToLookFor}</p>

                      <input
                        type="text"
                        value={item.userNotes}
                        onChange={(e) => updateChecklistNote(item.id, e.target.value)}
                        placeholder="Add inspection notes for this fixture (optional)..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Honest Audio Bug & RF Detector Guidance */}
              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 space-y-4">
                <div className="p-4 rounded-2xl bg-cyan-950/50 border border-cyan-500/40 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-black text-cyan-300">
                    <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Zero Microphone Access Required</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Smart Shield does <strong>not</strong> request microphone permission for this scanner. A smartphone microphone cannot detect passive or hidden listening bugs, because hidden microphones do not emit audible sound.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs text-slate-300">
                  <h4 className="font-black text-white flex items-center space-x-1.5">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <span>How Audio Bugs Are Actually Found</span>
                  </h4>
                  <p className="leading-relaxed">
                    1. <strong>Power Source Inspection:</strong> Continuous audio or video transmitters require power. Check for unfamiliar USB wall cubes, multi-plug adapters, or wires tucked behind headboards and desks.
                  </p>
                  <p className="leading-relaxed">
                    2. <strong>Optional Dedicated RF Hardware:</strong> Detecting active cellular/GSM or sub-GHz radio transmitters requires a dedicated broadband RF spectrum detector (typically 1 MHz – 6 GHz)—standard Android phones do not expose raw RF spectrum analyzers to apps.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SCREEN C: RESULTS & AI SECURITY ANALYSIS SCREEN
          ===================================================================== */}
      {activeScreen === 'results' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Measured Session Findings Card */}
            <div className="rounded-3xl bg-slate-900/90 border border-cyan-500/30 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                    Measured Data Only
                  </span>
                  <h2 className="text-xl font-black text-white">
                    Inspection Summary for {locationLabel}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleSaveCurrentReport}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 shadow-lg cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Save Security Report</span>
                </button>
              </div>

              {reportSaveNotice && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-xs text-emerald-200 font-bold">
                  {reportSaveNotice}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-bold">Lens Clues</div>
                  <div className="text-xl font-black text-white mt-0.5">
                    {cameraFindings.length}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-bold">IR Calibration</div>
                  <div className="text-sm font-black text-cyan-300 mt-1">
                    {irInspection.tested
                      ? irInspection.irLightObserved
                        ? 'IR Sensitive'
                        : 'IR Filtered'
                      : 'Not Tested'}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-bold">Network Entries</div>
                  <div className="text-xl font-black text-white mt-0.5">{wifiDevices.length}</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-bold">Checklist</div>
                  <div className="text-xl font-black text-white mt-0.5">
                    {completedChecklistCount}/{physicalChecklist.length}
                    {flaggedChecklistCount > 0 && (
                      <span className="ml-1.5 text-xs text-rose-400">
                        ({flaggedChecklistCount} flagged)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Security Analysis Output Card */}
            <div className="rounded-3xl bg-slate-900/90 border border-blue-500/40 p-6 space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-black text-white">
                  AI Security Interpretation &amp; Verification Plan
                </h3>
              </div>

              {/* Explicit User Consent Gate */}
              <label className="flex items-start space-x-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={userAiConsent}
                  onChange={(e) => setUserAiConsent(e.target.checked)}
                  className="mt-0.5 accent-cyan-400"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  <strong>Explicit User Consent:</strong> I consent to sending my structured text summary (logged reflection notes, MAC/OUI vendor statuses, magnetometer logs, and checklist progress—never raw camera video) to the Smart Shield AI endpoint to generate manual verification steps.
                </span>
              </label>

              {aiErrorNote && (
                <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500 text-xs text-amber-200">
                  {aiErrorNote}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRunAIAnalysis}
                  disabled={aiAnalyzing}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {aiAnalyzing
                      ? 'Interpreting Measured Findings...'
                      : 'Generate AI Security Analysis'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const local = buildLocalFallbackAnalysis(
                      cameraFindings,
                      irInspection,
                      wifiDevices,
                      !!capabilities?.magnetometerSupported,
                      magLogs,
                      physicalChecklist
                    );
                    setAiAnalysis(local);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Run On-Device Deterministic Summary (Offline)
                </button>
              </div>

              {aiAnalysis && (
                <div className="mt-4 p-5 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                      Standardized Result Category
                    </span>
                    <div className="text-base font-black text-white mt-0.5">
                      {aiAnalysis.overallCategory}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-300">
                      1. Measured Sensor &amp; Checklist Data:
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {aiAnalysis.measuredDataSummary}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-300">
                      2. AI Technical Interpretation:
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {aiAnalysis.aiInterpretation}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-cyan-300">
                      3. Recommended Manual Verification Steps:
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-200">
                      {aiAnalysis.recommendedNextSteps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                    <strong>Confidence &amp; Technical Limitations:</strong>{' '}
                    {aiAnalysis.confidenceLimitations}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: What to Do If You Find a Suspicious Device */}
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-black text-white">
              If You Visually Confirm a Hidden Camera
            </h3>
            <ol className="list-decimal list-inside space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <li>
                <strong>Do not destroy evidence:</strong> Take clear photos and video of the device in its original position from a safe distance using your phone camera.
              </li>
              <li>
                <strong>Cover or disconnect safely:</strong> Place a thick towel or tape over the lens if you must remain briefly while gathering your belongings.
              </li>
              <li>
                <strong>Relocate to a safe area:</strong> Move to a public lobby or secure location before confronting property hosts or management.
              </li>
              <li>
                <strong>Contact local authorities &amp; platform support:</strong> Report the device to local police and your booking platform&apos;s Trust &amp; Safety team, and export your Smart Shield Security Report for documentation.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN D: SAVED SECURITY REPORTS SCREEN
          ===================================================================== */}
      {activeScreen === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-white">
                Saved Security Reports ({savedReports.length})
              </h2>
              <button
                type="button"
                onClick={handleSaveCurrentReport}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                + Save Current
              </button>
            </div>

            {savedReports.length === 0 ? (
              <p className="text-xs text-slate-400">
                No saved reports yet. Click <strong>+ Save Current</strong> to store your current inspection session locally on this device.
              </p>
            ) : (
              <div className="space-y-2.5">
                {savedReports.map((rep) => (
                  <div
                    key={rep.id}
                    onClick={() => setSelectedReport(rep)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      selectedReport?.id === rep.id
                        ? 'bg-cyan-950/60 border-cyan-400'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">{rep.locationLabel}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteReport(rep.id);
                        }}
                        title="Delete Report"
                        className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(rep.createdAt).toLocaleString()}
                    </div>
                    {rep.aiAnalysis && (
                      <div className="text-[11px] text-cyan-300 font-bold mt-1">
                        {rep.aiAnalysis.overallCategory}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-3xl bg-slate-900/90 border border-cyan-500/30 p-5 sm:p-6 space-y-4">
            {!selectedReport ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Select a saved Security Report on the left (or click <strong>+ Save Current</strong>) to view, export, or delete it.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-white">
                      {selectedReport.locationLabel} ({selectedReport.id})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Created {new Date(selectedReport.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportReport(selectedReport, 'txt')}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export TXT</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportReport(selectedReport, 'json')}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteReport(selectedReport.id)}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Report</span>
                    </button>
                  </div>
                </div>

                <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-200 font-mono whitespace-pre-wrap overflow-x-auto max-h-[480px] overflow-y-auto">
                  {formatReportAsText(selectedReport)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
