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

export interface ScannerAndroidBridge {
  hasMagnetometer?: () => boolean;
  startMagnetometer?: () => boolean;
  stopMagnetometer?: () => void;
  getMagnetometerReading?: () => string;
  setTorchMode?: (enabled: boolean) => boolean;
  hasTorch?: () => boolean;
  getLocalNetworkSummary?: () => string;
}

export function getScannerAndroidBridge(): ScannerAndroidBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as any).SmartShieldAndroidBridge as ScannerAndroidBridge | undefined;
}

const REPORTS_STORAGE_KEY = 'smart_shield_private_space_reports_v1';
const TRUSTED_DEVICES_STORAGE_KEY = 'smart_shield_scanner_device_trust_v1';

// Standard IEEE OUI prefix dictionary for common hardware manufacturers
const IEEE_OUI_DATABASE: Record<string, { vendor: string; typicalRole: string; note: string }> = {
  '00:1A:11': { vendor: 'Google, Inc.', typicalRole: 'Smart Home / Nest / Chromecast', note: 'Verify whether a smart speaker or display is expected in this room.' },
  'F4:F5:D8': { vendor: 'Google, Inc.', typicalRole: 'Nest Camera / Smart Device', note: 'Nest devices may include cameras or microphones. Inspect physical room.' },
  'DC:A6:32': { vendor: 'Raspberry Pi Trading Ltd', typicalRole: 'Single-Board Computer / DIY IoT', note: 'Unusual in standard hotel rooms. Inspect nearby enclosures and outlets.' },
  'B8:27:EB': { vendor: 'Raspberry Pi Foundation', typicalRole: 'Embedded Linux Device', note: 'Single-board computer; check behind TVs, routers, or wall plates.' },
  '24:0A:C4': { vendor: 'Espressif Inc.', typicalRole: 'ESP32 / ESP8266 Wi-Fi Micro-Camera or IoT Sensor', note: 'Common in low-cost IoT smart plugs and miniature Wi-Fi camera modules.' },
  '30:AEA4': { vendor: 'Espressif Inc.', typicalRole: 'ESP32 Wi-Fi Module', note: 'Used in smart bulbs, plugs, and compact wireless camera boards.' },
  'A0:20:A6': { vendor: 'Espressif Inc.', typicalRole: 'ESP8266 / ESP32 Wireless Module', note: 'Often embedded in small wireless devices or custom electronics.' },
  'EC:FA:BC': { vendor: 'Espressif Inc.', typicalRole: 'ESP8266 / ESP32 IoT Device', note: 'Check nearby USB adapters, smoke detectors, or digital clocks.' },
  '44:61:32': { vendor: 'Ecobee Inc.', typicalRole: 'Smart Thermostat / Sensor', note: 'Common wall-mounted smart thermostat.' },
  'B0:C5:54': { vendor: 'D-Link Corporation', typicalRole: 'Network Router / IP Camera', note: 'D-Link manufactures both Wi-Fi routers and wireless IP cameras.' },
  'C0:56:27': { vendor: 'Belkin International Inc.', typicalRole: 'Smart Plug / Router / NetCam', note: 'Verify if Belkin router or Wemo smart plug is visible.' },
  '50:C7:BF': { vendor: 'TP-Link Technologies Co., Ltd.', typicalRole: 'Router / Tapo / Kasa Smart Device', note: 'TP-Link produces routers, smart plugs, and Tapo indoor cameras.' },
  '60:32:B1': { vendor: 'TP-Link Technologies Co., Ltd.', typicalRole: 'Wi-Fi Extender / Smart Camera', note: 'Check wall outlets for extenders or small camera units.' },
  'E0:B9:4D': { vendor: 'Shenzhen Bilian Electronic Co., Ltd.', typicalRole: 'Embedded Wi-Fi Camera / IoT Radio Module', note: 'Common wireless module inside consumer IP cameras and smart gadgets.' },
  '00:E0:4C': { vendor: 'Realtek Semiconductor Corp.', typicalRole: 'Network Interface / Media Box / IP Camera', note: 'Generic network chipset used in TVs, set-top boxes, and cameras.' },
  '4C:BC:98': { vendor: 'Hikvision Digital Technology', typicalRole: 'Network Security Camera / NVR', note: 'Commercial surveillance camera manufacturer. Verify if situated in private area.' },
  'BC:AD:28': { vendor: 'Hikvision Digital Technology', typicalRole: 'IP Surveillance Camera', note: 'Surveillance equipment vendor. Inspect ceiling corners and fixtures.' },
  '3C:EF:8C': { vendor: 'Dahua Technology Co., Ltd.', typicalRole: 'IP Security Camera / Recorder', note: 'Surveillance camera manufacturer. Verify authorized placement.' },
  '7C:D9:5C': { vendor: 'Amazon Technologies Inc.', typicalRole: 'Echo / Fire TV / Ring / Blink', note: 'Amazon smart device; check for Echo speakers, Fire TV sticks, or Ring/Blink cameras.' },
  '68:54:FD': { vendor: 'Amazon Technologies Inc.', typicalRole: 'Echo / Ring Smart Device', note: 'Verify visible smart TV stick or voice assistant.' },
  '2C:AA:8E': { vendor: 'Wyze Labs Inc.', typicalRole: 'Wyze Cam / Smart Sensor', note: 'Compact consumer smart camera vendor. Inspect shelves, frames, and outlets.' },
  'D0:3F:27': { vendor: 'Wyze Labs Inc.', typicalRole: 'Wyze Cam / Smart Plug', note: 'Check for small cube cameras or smart plugs.' },
  '00:62:6E': { vendor: 'Arlo Technologies', typicalRole: 'Wireless Security Camera', note: 'Battery-operated wireless camera system.' }
};

export function normalizeMacPrefix(macInput: string): string {
  const hexOnly = macInput.toUpperCase().replace(/[^0-9A-F]/g, '');
  if (hexOnly.length < 6) return '';
  return `${hexOnly.slice(0, 2)}:${hexOnly.slice(2, 4)}:${hexOnly.slice(4, 6)}`;
}

export function lookupMacVendor(macInput: string): {
  vendor: string | null;
  typicalRole: string | null;
  note: string;
  status: WifiDeviceStatus;
} {
  const prefix = normalizeMacPrefix(macInput);
  if (!prefix) {
    return {
      vendor: null,
      typicalRole: null,
      note: 'Invalid or incomplete MAC address prefix (requires at least 6 hexadecimal characters, e.g. 24:0A:C4).',
      status: 'Unknown device'
    };
  }

  // Check locally administered MAC bit (second hex char is 2, 6, A, or E)
  const secondChar = prefix.charAt(1);
  if (['2', '6', 'A', 'E'].includes(secondChar)) {
    return {
      vendor: 'Randomized / Locally Administered MAC',
      typicalRole: 'Modern Smartphone, Tablet, or Laptop with Privacy MAC',
      note: 'Modern Android, iOS, and Windows devices randomize MAC addresses per Wi-Fi network for privacy.',
      status: 'Unknown device'
    };
  }

  const match = IEEE_OUI_DATABASE[prefix];
  if (match) {
    const isCameraRelated = /camera|hikvision|dahua|wyze|arlo|espressif|bilian|raspberry/i.test(
      `${match.vendor} ${match.typicalRole}`
    );
    return {
      vendor: match.vendor,
      typicalRole: match.typicalRole,
      note: match.note,
      status: isCameraRelated ? 'Inspection required' : 'Identified device'
    };
  }

  return {
    vendor: null,
    typicalRole: null,
    note: `OUI prefix ${prefix} is not in the embedded surveillance/IoT hardware index. Identity cannot be determined from MAC prefix alone.`,
    status: 'Unknown device'
  };
}

export function getDefaultPhysicalChecklist(): PhysicalChecklistItem[] {
  return [
    {
      id: 'chk_smoke_detector',
      category: 'Ceiling & Environmental Sensors',
      title: 'Smoke Detectors & Carbon Monoxide Alarms',
      locationHint: 'Directly above beds, showers, or dressing areas',
      whatToLookFor:
        'Look for a second unlabelled smoke detector, pinhole openings that do not match the manufacturer vent pattern, or a dark glossy lens ring inside the plastic grille.',
      checked: false,
      flaggedSuspicious: false,
      userNotes: ''
    },
    {
      id: 'chk_power_adapters',
      category: 'Power & Charging Fixtures',
      title: 'USB Wall Chargers, Power Strips & Outlet Faceplates',
      locationHint: 'Wall outlets facing the bed, desk, or bathroom mirror',
      whatToLookFor:
        'Unplug unfamiliar USB charger blocks left in outlets. Inspect for tiny 1–2mm pinhole apertures on the front face or microSD card slots hidden near the prongs.',
      checked: false,
      flaggedSuspicious: false,
      userNotes: ''
    },
    {
      id: 'chk_clocks_lamps',
      category: 'Bedside & Desk Electronics',
      title: 'Digital Alarm Clocks, Speakers & Table Lamps',
      locationHint: 'Nightstands, dresser tops, and TV consoles',
      whatToLookFor:
        'Shine a bright flashlight across dark translucent clock screens at a 15-degree angle to check for a circular camera lens behind the smoked plastic faceplate.',
      checked: false,
      flaggedSuspicious: false,
      userNotes: ''
    },
    {
      id: 'chk_mirrors',
      category: 'Mirrors & Glass Surfaces',
      title: 'Two-Way Mirror Fingernail & Flashlight Inspection',
      locationHint: 'Bathroom mirrors, wardrobe mirrors, and framed wall mirrors',
      whatToLookFor:
        'Place your fingernail tip against the mirror surface: a standard mirror has a small gap between your nail and its reflection due to the glass thickness. Also press a flashlight flat against the mirror in a darkened room to see if a hollow cavity exists behind the glass.',
      checked: false,
      flaggedSuspicious: false,
      userNotes: ''
    },
    {
      id: 'chk_vents_purifiers',
      category: 'Ventilation & Appliances',
      title: 'Air Purifiers, Diffusers & HVAC Wall Vents',
      locationHint: 'Eye-level vents, shelves, and corner appliances',
      whatToLookFor:
        'Check if an appliance is angled unusually toward private areas or has an unexpected power cord routed into a wall cavity.',
      checked: false,
      flaggedSuspicious: false,
      userNotes: ''
    },
    {
      id: 'chk_decor_plants',
      category: 'Decor & Small Objects',
      title: 'Stuffed Animals, Picture Frames, Books & Plant Pots',
      locationHint: 'Bookshelves, wall frames, and decor facing the room center',
      whatToLookFor:
        'Look for unnatural circular cutouts in picture frame matting, wiring hidden inside artificial plants, or objects fixed rigidly in place.',
      checked: false,
      flaggedSuspicious: false,
      userNotes: ''
    }
  ];
}

export interface DeviceScannerCapabilities {
  cameraApiSupported: boolean;
  magnetometerSupported: boolean;
  magnetometerSource: 'android-bridge' | 'web-sensor' | 'unavailable';
  magnetometerLimitationReason: string;
  networkInfoSupported: boolean;
  effectiveConnectionType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
}

export async function detectScannerCapabilities(): Promise<DeviceScannerCapabilities> {
  const cameraApiSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  let magnetometerSupported = false;
  let magnetometerSource: 'android-bridge' | 'web-sensor' | 'unavailable' = 'unavailable';
  let magnetometerLimitationReason =
    'Neither the Android SensorManager bridge nor the Web Magnetometer API is exposed by this runtime container.';

  try {
    const bridge = getScannerAndroidBridge();
    if (bridge && typeof bridge.hasMagnetometer === 'function') {
      if (bridge.hasMagnetometer()) {
        magnetometerSupported = true;
        magnetometerSource = 'android-bridge';
        magnetometerLimitationReason = 'Hardware magnetometer available via Android SensorManager.';
      } else {
        magnetometerLimitationReason =
          'This Android device reports no hardware TYPE_MAGNETIC_FIELD sensor.';
      }
    } else if (typeof window !== 'undefined' && 'Magnetometer' in window) {
      // Probe Web Magnetometer availability
      try {
        const MagnetometerCtor = (window as any).Magnetometer;
        const sensor = new MagnetometerCtor({ frequency: 10 });
        magnetometerSupported = true;
        magnetometerSource = 'web-sensor';
        magnetometerLimitationReason = 'Hardware magnetometer available via Generic Sensor API.';
        sensor.stop?.();
      } catch (err: any) {
        magnetometerSupported = false;
        magnetometerLimitationReason = `Magnetometer API blocked by browser/WebView permissions policy or unsupported hardware (${err?.message || 'SecurityError'}).`;
      }
    }
  } catch (e: any) {
    magnetometerSupported = false;
    magnetometerLimitationReason = `Magnetometer check failed: ${e?.message || 'Sensor unavailable'}.`;
  }

  const conn =
    typeof navigator !== 'undefined'
      ? (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection
      : null;

  return {
    cameraApiSupported,
    magnetometerSupported,
    magnetometerSource,
    magnetometerLimitationReason,
    networkInfoSupported: !!conn,
    effectiveConnectionType: conn?.effectiveType || null,
    downlinkMbps: typeof conn?.downlink === 'number' ? conn.downlink : null,
    rttMs: typeof conn?.rtt === 'number' ? conn.rtt : null
  };
}

export function loadSavedTrustMap(): Record<string, 'trusted' | 'unfamiliar'> {
  try {
    const raw = localStorage.getItem(TRUSTED_DEVICES_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveDeviceTrustState(deviceKey: string, state: 'trusted' | 'unfamiliar'): void {
  try {
    const current = loadSavedTrustMap();
    current[deviceKey] = state;
    localStorage.setItem(TRUSTED_DEVICES_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

export function loadSecurityReports(): PrivateSpaceSecurityReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSecurityReport(report: PrivateSpaceSecurityReport): PrivateSpaceSecurityReport[] {
  try {
    const existing = loadSecurityReports().filter((r) => r.id !== report.id);
    const updated = [report, ...existing].slice(0, 30);
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [report];
  }
}

export function deleteSecurityReport(reportId: string): PrivateSpaceSecurityReport[] {
  try {
    const updated = loadSecurityReports().filter((r) => r.id !== reportId);
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function formatReportAsText(report: PrivateSpaceSecurityReport): string {
  const lines: string[] = [
    '============================================================',
    'SMART SHIELD — AI PRIVATE SPACE SECURITY SCANNER REPORT',
    '============================================================',
    `Report ID:     ${report.id}`,
    `Room / Label:  ${report.locationLabel}`,
    `Timestamp:     ${new Date(report.createdAt).toLocaleString()}`,
    '',
    'IMPORTANT PRIVACY & TECHNICAL NOTICE:',
    'This report records only genuine sensor measurements and user-logged',
    'observations. It never claims a room is 100% safe or that a hidden device',
    'is 100% confirmed without physical verification.',
    '',
    '1. SENSOR AVAILABILITY & LIMITATIONS',
    `   - Camera Sensor:       ${report.cameraCapabilities.supported ? 'Available' : 'Unavailable'}`,
    `   - Flashlight / Torch:  ${report.cameraCapabilities.torchSupported ? 'Supported' : 'Not Supported on Active Camera'}`,
    `   - Infrared Test:       ${report.irInspection.tested ? (report.irInspection.irLightObserved ? 'IR sensitivity verified with remote' : 'No IR glow seen (likely hardware IR-cut filter)') : 'Not tested'}`,
    `   - Magnetometer:        ${report.magnetometerSummary.sensorAvailable ? 'Available' : 'Sensor unavailable'}`,
    `   - Wi-Fi Scan Mode:     ${report.wifiScanSummary.scanMethod}`,
    `   - Network Notes:       ${report.wifiScanSummary.limitationsNote}`,
    '',
    `2. CAMERA LENS REFLECTION CLUES (${report.cameraFindings.length})`,
    ...(report.cameraFindings.length === 0
      ? ['   - No suspicious lens reflection clues logged.']
      : report.cameraFindings.map(
          (f, i) =>
            `   [${i + 1}] ${new Date(f.timestamp).toLocaleTimeString()} | Brightness ${f.peakBrightness}/255 | Note: ${f.note} (${f.confidenceNote})`
        )),
    '',
    `3. WI-FI & LOCAL NETWORK FINDINGS (${report.wifiScanSummary.devices.length})`,
    ...(report.wifiScanSummary.devices.length === 0
      ? ['   - No additional LAN endpoints enumerated.']
      : report.wifiScanSummary.devices.map(
          (d, i) =>
            `   [${i + 1}] ${d.hostname || 'Network Endpoint'} | IP: ${d.ipAddress || 'N/A'} | MAC/OUI: ${d.macPrefix || 'Not exposed by OS'} | Vendor: ${d.manufacturer || 'Unknown'} | Status: ${d.status} | User Tag: ${d.trustState}`
        )),
    '',
    `4. MAGNETIC FIELD LOGS (${report.magnetometerSummary.logs.length})`,
    ...(report.magnetometerSummary.logs.length === 0
      ? ['   - No localized magnetic field spikes logged.']
      : report.magnetometerSummary.logs.map(
          (m, i) =>
            `   [${i + 1}] ${m.magnitudeUt.toFixed(1)} uT (X:${m.x.toFixed(1)}, Y:${m.y.toFixed(1)}, Z:${m.z.toFixed(1)}) - ${m.userNote}`
        )),
    '',
    '5. PHYSICAL & ELECTRONIC BUG CHECKLIST',
    ...report.physicalChecklist.map(
      (c) =>
        `   - [${c.checked ? 'INSPECTED' : 'PENDING'}] ${c.title}${c.flaggedSuspicious ? ' [FLAGGED FOR FOLLOW-UP]' : ''}${c.userNotes ? ` — Note: ${c.userNotes}` : ''}`
    )
  ];

  if (report.aiAnalysis) {
    lines.push(
      '',
      '6. AI SECURITY INTERPRETATION',
      `   - Category: ${report.aiAnalysis.overallCategory}`,
      `   - Measured Data Summary: ${report.aiAnalysis.measuredDataSummary}`,
      '   - Recommended Manual Verification Steps:',
      ...report.aiAnalysis.recommendedNextSteps.map((s) => `     * ${s}`),
      `   - Confidence & Limitations: ${report.aiAnalysis.confidenceLimitations}`
    );
  }

  lines.push('============================================================');
  return lines.join('\n');
}

export function buildLocalFallbackAnalysis(
  cameraFindings: CameraReflectionFinding[],
  irInspection: IRInspectionResult,
  wifiDevices: WifiDiscoveredDevice[],
  magnetometerAvailable: boolean,
  magnetometerLogs: MagnetometerLogItem[],
  checklist: PhysicalChecklistItem[]
): SecurityScannerAIAnalysis {
  const suspiciousChecklist = checklist.filter((c) => c.flaggedSuspicious);
  const unfamiliarDevices = wifiDevices.filter(
    (d) => d.trustState === 'unfamiliar' || d.status === 'Inspection required' || d.status === 'Unknown device'
  );
  const completedChecks = checklist.filter((c) => c.checked).length;

  let overallCategory: AISecurityResultCategory = 'No suspicious findings observed.';

  if (
    cameraFindings.length > 0 ||
    suspiciousChecklist.length > 0 ||
    magnetometerLogs.some((l) => l.magnitudeUt > 85)
  ) {
    overallCategory = 'Possible suspicious finding – manual inspection recommended.';
  } else if (unfamiliarDevices.length > 0) {
    overallCategory = 'Unidentified network device – identity not established.';
  } else if (completedChecks === 0 && cameraFindings.length === 0 && wifiDevices.length <= 1) {
    overallCategory = 'Scan incomplete.';
  } else if (!magnetometerAvailable && cameraFindings.length === 0 && completedChecks < 3) {
    overallCategory = 'Sensor unavailable.';
  }

  const measuredParts: string[] = [
    `Logged ${cameraFindings.length} optical reflection clue(s)`,
    `${wifiDevices.length} network entry/entries (${unfamiliarDevices.length} requiring review)`,
    `magnetometer sensor ${magnetometerAvailable ? `active (${magnetometerLogs.length} reading(s) logged)` : 'unavailable on this runtime'}`,
    `and ${completedChecks}/${checklist.length} physical inspection checks completed (${suspiciousChecklist.length} flagged).`
  ];

  const steps: string[] = [];
  if (cameraFindings.length > 0) {
    steps.push(
      'Physically inspect the exact object(s) where optical reflection clues were flagged using a handheld flashlight at close range (10–30 cm) to verify whether a glass pinhole lens is present.'
    );
  }
  if (suspiciousChecklist.length > 0) {
    steps.push(
      `Closely examine the flagged physical items (${suspiciousChecklist.map((c) => c.title).join(', ')}); unplug unfamiliar wall adapters or cover suspicious fixtures if safe and lawful to do so.`
    );
  }
  if (unfamiliarDevices.length > 0) {
    steps.push(
      'Review unfamiliar network entries against visible smart TVs, routers, or IoT appliances in the room. Remember that randomized MAC addresses and shared hotel subnets can show neighboring guests.'
    );
  }
  if (completedChecks < checklist.length) {
    steps.push(
      `Complete the remaining ${checklist.length - completedChecks} guided physical inspection checks (especially smoke detectors, USB power blocks, and mirrors facing private areas).`
    );
  }
  if (steps.length === 0) {
    steps.push(
      'Continue practicing physical awareness: check line-of-sight fixtures facing beds and bathrooms, and unplug unnecessary third-party USB power adapters.'
    );
  }

  return {
    overallCategory,
    measuredDataSummary: measuredParts.join(', '),
    aiInterpretation:
      'Based solely on the recorded sensor logs and physical checklist entries, smartphone sensors serve as inspection aids rather than definitive bug detectors. Optical glints, magnetic readings, and network endpoints require direct visual confirmation.',
    recommendedNextSteps: steps,
    confidenceLimitations:
      'Smartphone cameras, magnetometers, and sandboxed Wi-Fi checks cannot detect passive non-transmitting storage cameras hidden behind opaque surfaces unless a lens opening is physically visible. Absence of alerts does not guarantee a space is free of recording devices.',
    generatedAt: new Date().toISOString()
  };
}
