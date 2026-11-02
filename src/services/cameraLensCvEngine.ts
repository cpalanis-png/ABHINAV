/**
 * Smart Shield — Camera Lens Specular Reflection Computer Vision Engine
 *
 * Implements multi-indicator visual clue detection to minimize false positives from
 * ordinary room lights, mirrors, glass surfaces, and shiny metal edges:
 * 1. Global frame quality & motion stability analysis (detects LOW_CONFIDENCE frames).
 * 2. Connected-component region detection with minimum & maximum candidate size bounds
 *    (ignores isolated 1-2 px bright pixels and large uniform light sources).
 * 3. Circularity / aspect-ratio shape analysis (rejects linear edges and broad glints).
 * 4. Radial dark-surround & local contrast analysis (requires concentrated point reflection
 *    surrounded by a darker isotropic housing/aperture ring).
 * 5. Multi-frame temporal stability tracking & duplicate candidate suppression (NMS).
 */

export type CameraScanStatusState =
  | 'SCANNING'
  | 'POSSIBLE_CANDIDATE'
  | 'NO_CANDIDATE'
  | 'LOW_CONFIDENCE'
  | 'SCAN_ERROR';

export const CAMERA_SCAN_STATUS_MESSAGES: Record<CameraScanStatusState, string> = {
  SCANNING: 'Inspecting the camera view...',
  POSSIBLE_CANDIDATE: 'Possible lens-like reflection found. Please inspect this area.',
  NO_CANDIDATE: 'No lens-like visual clues detected in this scan.',
  LOW_CONFIDENCE: 'Image quality is insufficient. Try adjusting the lighting or camera angle.',
  SCAN_ERROR: 'Camera inspection could not be completed. Please try again.'
};

export interface LensCandidateRegion {
  id: string;
  /** Normalized center X (0..1) */
  cx: number;
  /** Normalized center Y (0..1) */
  cy: number;
  /** Normalized bounding box X (0..1) */
  boxX: number;
  /** Normalized bounding box Y (0..1) */
  boxY: number;
  /** Normalized bounding box width (0..1) */
  boxW: number;
  /** Normalized bounding box height (0..1) */
  boxH: number;
  /** Peak luminance of the specular core (0..255) */
  peakBrightness: number;
  /** Local contrast between specular core and surrounding aperture ring */
  localContrast: number;
  /** Circularity score (0..1, where 1 is a compact symmetric circle) */
  circularityScore: number;
  /** Number of consecutive frames this candidate has remained stable */
  stableFrames: number;
  /** Human-readable visual indicators satisfied by this candidate */
  indicatorsMatched: string[];
  /** Timestamp when first stabilized */
  firstDetectedAt: number;
}

interface InternalTrack {
  id: string;
  cx: number;
  cy: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  peakBrightness: number;
  localContrast: number;
  circularityScore: number;
  stableFrames: number;
  missedFrames: number;
  firstDetectedAt: number;
  indicatorsMatched: string[];
}

export interface FrameAnalysisOutput {
  scanState: CameraScanStatusState;
  statusMessage: string;
  qualityDetail: string | null;
  stableCandidates: LensCandidateRegion[];
  framesAnalyzed: number;
}

export class CameraLensCvTracker {
  private prevLumaBuffer: Float32Array | null = null;
  private tracks: InternalTrack[] = [];
  private nextTrackSeq = 1;
  private framesAnalyzed = 0;

  public reset(): void {
    this.prevLumaBuffer = null;
    this.tracks = [];
    this.framesAnalyzed = 0;
  }

  public analyzeFrame(
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    brightnessThreshold: number = 236
  ): FrameAnalysisOutput {
    const totalPixels = width * height;
    if (totalPixels === 0 || rgbaData.length < totalPixels * 4) {
      return {
        scanState: 'SCAN_ERROR',
        statusMessage: CAMERA_SCAN_STATUS_MESSAGES.SCAN_ERROR,
        qualityDetail: 'Camera frame buffer was empty or unreadable.',
        stableCandidates: [],
        framesAnalyzed: this.framesAnalyzed
      };
    }

    this.framesAnalyzed += 1;

    // 1. Compute luminance buffer and global image quality statistics
    const luma = new Float32Array(totalPixels);
    let lumaSum = 0;
    let brightPixels = 0;
    let darkPixels = 0;
    let motionDiffSum = 0;
    const hasPrev = this.prevLumaBuffer !== null && this.prevLumaBuffer.length === totalPixels;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const yVal =
        0.299 * rgbaData[idx] + 0.587 * rgbaData[idx + 1] + 0.114 * rgbaData[idx + 2];
      luma[i] = yVal;
      lumaSum += yVal;
      if (yVal >= 242) brightPixels++;
      if (yVal <= 14) darkPixels++;
      if (hasPrev && this.prevLumaBuffer) {
        motionDiffSum += Math.abs(yVal - this.prevLumaBuffer[i]);
      }
    }

    this.prevLumaBuffer = luma;

    const meanLuma = lumaSum / totalPixels;
    const brightRatio = brightPixels / totalPixels;
    const darkRatio = darkPixels / totalPixels;
    const meanMotionDelta = hasPrev ? motionDiffSum / totalPixels : 0;

    // Check for LOW_CONFIDENCE conditions:
    // (a) Excessive camera movement / shake
    if (hasPrev && meanMotionDelta > 26) {
      this.decayAllTracks();
      return {
        scanState: 'LOW_CONFIDENCE',
        statusMessage: CAMERA_SCAN_STATUS_MESSAGES.LOW_CONFIDENCE,
        qualityDetail: 'Camera is moving too quickly. Hold the phone steady for multi-frame lens analysis.',
        stableCandidates: [],
        framesAnalyzed: this.framesAnalyzed
      };
    }

    // (b) Overexposed frame / pointed directly at a large light source or bright window/mirror glare
    if (brightRatio > 0.18 || meanLuma > 215) {
      this.decayAllTracks();
      return {
        scanState: 'LOW_CONFIDENCE',
        statusMessage: CAMERA_SCAN_STATUS_MESSAGES.LOW_CONFIDENCE,
        qualityDetail:
          'Large bright light source or surface glare detected. Adjust your angle away from direct room lights or windows.',
        stableCandidates: [],
        framesAnalyzed: this.framesAnalyzed
      };
    }

    // (c) Extremely dark / obstructed camera lens with no visible illumination
    if (meanLuma < 7 && darkRatio > 0.985 && brightPixels === 0) {
      this.decayAllTracks();
      return {
        scanState: 'LOW_CONFIDENCE',
        statusMessage: CAMERA_SCAN_STATUS_MESSAGES.LOW_CONFIDENCE,
        qualityDetail:
          'Scene is too dark to evaluate surface context. Enable the flashlight/torch or add slight ambient light.',
        stableCandidates: [],
        framesAnalyzed: this.framesAnalyzed
      };
    }

    // 2. Connected-Component Region Detection on bright candidate pixels
    const visited = new Uint8Array(totalPixels);
    const rawDetections: Array<{
      cx: number;
      cy: number;
      boxX: number;
      boxY: number;
      boxW: number;
      boxH: number;
      peakBrightness: number;
      localContrast: number;
      circularityScore: number;
      indicatorsMatched: string[];
    }> = [];

    const margin = 9;
    const effectiveThreshold = Math.max(215, Math.min(252, brightnessThreshold));

    for (let y = margin; y < height - margin; y++) {
      for (let x = margin; x < width - margin; x++) {
        const startIdx = y * width + x;
        if (visited[startIdx] || luma[startIdx] < effectiveThreshold) continue;

        // Flood-fill 8-connected bright cluster
        const queue: number[] = [startIdx];
        visited[startIdx] = 1;

        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let sumX = 0;
        let sumY = 0;
        let peakLuma = luma[startIdx];
        let pixelCount = 0;

        while (queue.length > 0 && pixelCount <= 80) {
          const curr = queue.pop()!;
          const cy = Math.floor(curr / width);
          const cx = curr % width;

          pixelCount++;
          sumX += cx;
          sumY += cy;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          if (luma[curr] > peakLuma) peakLuma = luma[curr];

          // 8-neighbors
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx < margin || nx >= width - margin || ny < margin || ny >= height - margin) {
                continue;
              }
              const nIdx = ny * width + nx;
              if (!visited[nIdx] && luma[nIdx] >= effectiveThreshold - 12) {
                visited[nIdx] = 1;
                queue.push(nIdx);
              }
            }
          }
        }

        // FILTER 1: Minimum & Maximum Candidate Size
        // - Ignore isolated 1–2 pixel noise / dust / hot pixels
        // - Ignore large uniform light sources or broad shiny reflections (> 42 px on 160x120 grid)
        if (pixelCount < 3 || pixelCount > 42) {
          continue;
        }

        const blobW = maxX - minX + 1;
        const blobH = maxY - minY + 1;
        if (blobW < 2 || blobH < 2 || blobW > 11 || blobH > 11) {
          continue;
        }

        // FILTER 2: Circular / Lens-Like Shape Analysis
        // Reject linear metallic edges, mirror frames, or elongated strip reflections
        const aspect = Math.max(blobW, blobH) / Math.max(1, Math.min(blobW, blobH));
        if (aspect > 1.85) {
          continue;
        }

        const boundingArea = blobW * blobH;
        const fillRatio = pixelCount / boundingArea;
        if (fillRatio < 0.42) {
          continue;
        }
        const circularityScore = Math.min(1, (1 / aspect) * Math.min(1, fillRatio / 0.65));

        // FILTER 3: Concentric Dark Bezel / Local Contrast Analysis
        const centerPxX = Math.round(sumX / pixelCount);
        const centerPxY = Math.round(sumY / pixelCount);

        const rayDirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1]
        ];

        const innerRadius = Math.max(3, Math.ceil(Math.max(blobW, blobH) / 2) + 2);
        const outerRadius = innerRadius + 3;

        let innerSum = 0;
        let outerSum = 0;
        let brightLeakRays = 0;
        const innerSamples: number[] = [];

        for (const [dx, dy] of rayDirs) {
          const ix = Math.min(width - 1, Math.max(0, centerPxX + dx * innerRadius));
          const iy = Math.min(height - 1, Math.max(0, centerPxY + dy * innerRadius));
          const ox = Math.min(width - 1, Math.max(0, centerPxX + dx * outerRadius));
          const oy = Math.min(height - 1, Math.max(0, centerPxY + dy * outerRadius));

          const iVal = luma[iy * width + ix];
          const oVal = luma[oy * width + ox];

          innerSum += iVal;
          outerSum += oVal;
          innerSamples.push(iVal);

          // If surrounding ray remains very bright, this is part of a larger light/mirror reflection
          if (iVal > peakLuma - 38 || oVal > peakLuma - 32) {
            brightLeakRays++;
          }
        }

        if (brightLeakRays > 1) {
          continue;
        }

        const innerAvg = innerSum / rayDirs.length;
        const outerAvg = outerSum / rayDirs.length;
        const localContrast = peakLuma - innerAvg;

        // Require strong contrast against immediate dark lens housing ring
        if (localContrast < 62 || innerAvg > 165 || outerAvg > 180) {
          continue;
        }

        // Check radial uniformity of the surrounding dark ring (avoid half-bright/half-dark wall edges)
        const innerVariance =
          innerSamples.reduce((acc, v) => acc + Math.pow(v - innerAvg, 2), 0) /
          innerSamples.length;
        if (Math.sqrt(innerVariance) > 42) {
          continue;
        }

        // Pad normalized bounding box slightly so the UI box frames the candidate without covering it
        const normCx = centerPxX / width;
        const normCy = centerPxY / height;
        const normW = Math.max(0.06, (blobW + 6) / width);
        const normH = Math.max(0.08, (blobH + 6) / height);

        rawDetections.push({
          cx: normCx,
          cy: normCy,
          boxX: Math.max(0, normCx - normW / 2),
          boxY: Math.max(0, normCy - normH / 2),
          boxW: Math.min(1, normW),
          boxH: Math.min(1, normH),
          peakBrightness: Math.round(peakLuma),
          localContrast: Math.round(localContrast),
          circularityScore: Number(circularityScore.toFixed(2)),
          indicatorsMatched: [
            'Concentrated point brightness',
            `High local aperture contrast (+${Math.round(localContrast)})`,
            `Compact circular geometry (${Math.round(circularityScore * 100)}%)`,
            'Dark concentric surround'
          ]
        });
      }
    }

    // 3. Duplicate Candidate Suppression (Spatial Non-Maximum Suppression)
    rawDetections.sort((a, b) => b.localContrast - a.localContrast);
    const suppressedDetections: typeof rawDetections = [];
    for (const det of rawDetections) {
      const duplicate = suppressedDetections.some(
        (kept) => Math.hypot(kept.cx - det.cx, kept.cy - det.cy) < 0.1
      );
      if (!duplicate) {
        suppressedDetections.push(det);
      }
      if (suppressedDetections.length >= 3) break;
    }

    // 4. Multi-Frame Temporal Stability Tracking
    const matchedTrackIds = new Set<string>();

    for (const det of suppressedDetections) {
      let bestTrack: InternalTrack | null = null;
      let bestDist = 0.065; // Max normalized movement between consecutive frames

      for (const track of this.tracks) {
        if (matchedTrackIds.has(track.id)) continue;
        const dist = Math.hypot(track.cx - det.cx, track.cy - det.cy);
        if (dist < bestDist) {
          bestDist = dist;
          bestTrack = track;
        }
      }

      if (bestTrack) {
        matchedTrackIds.add(bestTrack.id);
        // Smooth coordinates with exponential moving average
        bestTrack.cx = bestTrack.cx * 0.6 + det.cx * 0.4;
        bestTrack.cy = bestTrack.cy * 0.6 + det.cy * 0.4;
        bestTrack.boxX = bestTrack.boxX * 0.6 + det.boxX * 0.4;
        bestTrack.boxY = bestTrack.boxY * 0.6 + det.boxY * 0.4;
        bestTrack.boxW = bestTrack.boxW * 0.6 + det.boxW * 0.4;
        bestTrack.boxH = bestTrack.boxH * 0.6 + det.boxH * 0.4;
        bestTrack.peakBrightness = Math.round(
          bestTrack.peakBrightness * 0.5 + det.peakBrightness * 0.5
        );
        bestTrack.localContrast = Math.round(
          bestTrack.localContrast * 0.5 + det.localContrast * 0.5
        );
        bestTrack.circularityScore = det.circularityScore;
        bestTrack.stableFrames += 1;
        bestTrack.missedFrames = 0;
        bestTrack.indicatorsMatched = [
          ...det.indicatorsMatched,
          `Multi-frame stability (${bestTrack.stableFrames} frames)`
        ];
      } else {
        const newId = `cand-${this.nextTrackSeq++}`;
        matchedTrackIds.add(newId);
        this.tracks.push({
          id: newId,
          cx: det.cx,
          cy: det.cy,
          boxX: det.boxX,
          boxY: det.boxY,
          boxW: det.boxW,
          boxH: det.boxH,
          peakBrightness: det.peakBrightness,
          localContrast: det.localContrast,
          circularityScore: det.circularityScore,
          stableFrames: 1,
          missedFrames: 0,
          firstDetectedAt: Date.now(),
          indicatorsMatched: det.indicatorsMatched
        });
      }
    }

    // Age unmatched tracks and prune lost ones
    for (const track of this.tracks) {
      if (!matchedTrackIds.has(track.id)) {
        track.missedFrames += 1;
        track.stableFrames = Math.max(0, track.stableFrames - 1);
      }
    }
    this.tracks = this.tracks.filter((t) => t.missedFrames <= 2 && t.stableFrames > 0);

    // Require at least 4 consecutive stable frames before classifying as POSSIBLE_CANDIDATE
    const MIN_STABLE_FRAMES = 4;
    const stableCandidates: LensCandidateRegion[] = this.tracks
      .filter((t) => t.stableFrames >= MIN_STABLE_FRAMES)
      .map((t) => ({
        id: t.id,
        cx: t.cx,
        cy: t.cy,
        boxX: t.boxX,
        boxY: t.boxY,
        boxW: t.boxW,
        boxH: t.boxH,
        peakBrightness: t.peakBrightness,
        localContrast: t.localContrast,
        circularityScore: t.circularityScore,
        stableFrames: t.stableFrames,
        indicatorsMatched: t.indicatorsMatched,
        firstDetectedAt: t.firstDetectedAt
      }));

    if (stableCandidates.length > 0) {
      return {
        scanState: 'POSSIBLE_CANDIDATE',
        statusMessage: CAMERA_SCAN_STATUS_MESSAGES.POSSIBLE_CANDIDATE,
        qualityDetail: null,
        stableCandidates,
        framesAnalyzed: this.framesAnalyzed
      };
    }

    // While gathering initial frames or when a tentative 1-3 frame candidate is being verified:
    if (this.framesAnalyzed < 10 || this.tracks.some((t) => t.stableFrames >= 2)) {
      return {
        scanState: 'SCANNING',
        statusMessage: CAMERA_SCAN_STATUS_MESSAGES.SCANNING,
        qualityDetail: null,
        stableCandidates: [],
        framesAnalyzed: this.framesAnalyzed
      };
    }

    return {
      scanState: 'NO_CANDIDATE',
      statusMessage: CAMERA_SCAN_STATUS_MESSAGES.NO_CANDIDATE,
      qualityDetail: null,
      stableCandidates: [],
      framesAnalyzed: this.framesAnalyzed
    };
  }

  private decayAllTracks(): void {
    for (const track of this.tracks) {
      track.missedFrames += 1;
      track.stableFrames = Math.max(0, track.stableFrames - 1);
    }
    this.tracks = this.tracks.filter((t) => t.missedFrames <= 2 && t.stableFrames > 0);
  }
}
