import {
  DEFAULT_SCAN_QUALITY_CONFIG,
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
    }

    if (index < frameCount - 1) {
      await delayFn(delayMs);
    }
  }

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function performanceNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
