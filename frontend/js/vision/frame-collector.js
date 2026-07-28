import {
  DEFAULT_SCAN_QUALITY_CONFIG,
  QUALITY_REASON_CODES,
  isFallbackEligibleBurstSample,
  isUsableBurstSample
} from "./quality-gate.js";

export async function collectFrameBurst({
  targetFrames,
  durationMs,
  detectFrame,
  analyzeLandmarks,
  estimatePose,
  delayFn = delay
} = {}) {
  const samples = [];
  const frameCount = Math.max(1, Number(targetFrames || 1));
  const delayMs = Math.max(60, Math.round(Number(durationMs || 0) / frameCount));
  const captureStats = {
    attemptedFrames: frameCount,
    acceptedFrames: 0,
    rejectedFrames: 0,
    rejectionReasons: {}
  };

  for (let index = 0; index < frameCount; index += 1) {
    const frame = await detectFrame?.();
    const faces = Array.isArray(frame?.faces) ? frame.faces : [];

    if (faces.length === 1) {
      const landmarks = faces[0];
      const analysis = analyzeLandmarks?.(landmarks);
      const pose = estimatePose?.(landmarks);
      samples.push({
        analysis,
        pose,
        landmarks,
        timestamp: frame.timestamp ?? performanceNow()
      });
      captureStats.acceptedFrames += 1;
    } else {
      const reason = getFrameDetectionRejectionReason(frame, faces);
      captureStats.rejectedFrames += 1;
      captureStats.rejectionReasons[reason] = (captureStats.rejectionReasons[reason] || 0) + 1;
    }

    if (index < frameCount - 1) {
      await delayFn(delayMs);
    }
  }

  Object.defineProperty(samples, "captureStats", {
    value: captureStats,
    enumerable: false
  });

  return samples;
}

export function selectBurstSamples({
  samples = [],
  minSamples = DEFAULT_SCAN_QUALITY_CONFIG.burstMinSamples,
  config = DEFAULT_SCAN_QUALITY_CONFIG
} = {}) {
  const usableSamples = samples.filter((sample) => isUsableBurstSample(sample, config));
  const fallbackSamples = samples
    .filter((sample) => sample?.analysis?.metrics && isFallbackEligibleBurstSample(sample, config))
    .sort((a, b) => Number(b.analysis?.quality?.confidence || 0) - Number(a.analysis?.quality?.confidence || 0));
  const selectedSamples = usableSamples.length >= minSamples
    ? usableSamples
    : fallbackSamples.slice(0, Math.max(1, Math.min(fallbackSamples.length, minSamples)));

  return {
    usableSamples,
    fallbackSamples,
    selectedSamples,
    fallbackUsed: usableSamples.length < minSamples
  };
}

export function createInitialFallbackSample({ analysis, pose, config = DEFAULT_SCAN_QUALITY_CONFIG } = {}) {
  const sample = {
    analysis,
    pose
  };

  return isFallbackEligibleBurstSample(sample, config) ? sample : null;
}

function getFrameDetectionRejectionReason(frame, faces) {
  if (frame?.error || frame?.reasonCode === "FACE_TRACKING_ERROR") {
    return "FACE_TRACKING_ERROR";
  }

  if (faces.length > 1 || Number(frame?.faceCount || 0) > 1) {
    return QUALITY_REASON_CODES.MULTIPLE_FACES;
  }

  return QUALITY_REASON_CODES.NO_FACE;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function performanceNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
