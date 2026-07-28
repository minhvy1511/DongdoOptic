import test from "node:test";
import assert from "node:assert/strict";

import { collectFrameBurst, createInitialFallbackSample, selectBurstSamples } from "../../frontend/js/vision/frame-collector.js";
import { createMockFaceTrackingSequence } from "../fixtures/vision/mock-face-tracking.js";

function sample(confidence, overrides = {}) {
  return {
    analysis: {
      metrics: { lengthToWidth: 1.4 },
      quality: {
        confidence,
        coverage: 0.18,
        centerOffsetX: 0.02,
        centerOffsetY: 0.02,
        ...overrides.quality
      }
    },
    pose: {
      yawDeg: 0,
      rollDeg: 0,
      ...overrides.pose
    }
  };
}

test("collects only single-face frames", async () => {
  const landmarker = createMockFaceTrackingSequence([1, 0, 2, 1]);

  const collected = await collectFrameBurst({
    targetFrames: 4,
    durationMs: 1,
    detectFrame: () => {
      const result = landmarker.detectForVideo();
      return {
        faces: result.faceLandmarks,
        timestamp: result.faceLandmarks.length
      };
    },
    analyzeLandmarks: () => sample(0.8).analysis,
    estimatePose: () => sample(0.8).pose,
    delayFn: () => Promise.resolve()
  });

  assert.equal(collected.length, 2);
  assert.equal(collected[0].timestamp, 1);
  assert.equal(collected[1].timestamp, 1);
  assert.equal(collected.captureStats.attemptedFrames, 4);
  assert.equal(collected.captureStats.acceptedFrames, 2);
  assert.equal(collected.captureStats.rejectedFrames, 2);
  assert.equal(collected.captureStats.rejectionReasons.NO_FACE, 1);
  assert.equal(collected.captureStats.rejectionReasons.MULTIPLE_FACES, 1);
});

test("selects usable burst samples and removes pose outliers", () => {
  const samples = [
    sample(0.7),
    sample(0.71),
    sample(0.72),
    sample(0.73),
    sample(0.74),
    sample(0.75),
    sample(0.76),
    sample(0.77),
    sample(0.8, { pose: { yawDeg: 30 } })
  ];

  const result = selectBurstSamples({ samples, minSamples: 8 });

  assert.equal(result.usableSamples.length, 8);
  assert.equal(result.selectedSamples.length, 8);
  assert.equal(result.fallbackUsed, false);
});

test("falls back to highest-confidence frames when usable sample count is low", () => {
  const samples = [
    sample(0.2),
    sample(0.6, { quality: { centerOffsetX: 0.3 } }),
    sample(0.8, { quality: { centerOffsetY: 0.3 } })
  ];

  const result = selectBurstSamples({ samples, minSamples: 5 });

  assert.equal(result.fallbackUsed, true);
  assert.equal(result.selectedSamples.length, 3);
  assert.equal(result.selectedSamples[0].analysis.quality.confidence, 0.8);
});

test("never falls back to hard-reject pose or distance frames", () => {
  const samples = [
    sample(0.95, { pose: { yawDeg: 30 } }),
    sample(0.94, { pose: { rollDeg: 30 } }),
    sample(0.93, { quality: { coverage: 0.9 } }),
    sample(0.92, { quality: { coverage: 0.01 } }),
    sample(0.4)
  ];

  const result = selectBurstSamples({ samples, minSamples: 5 });

  assert.equal(result.fallbackUsed, true);
  assert.equal(result.selectedSamples.length, 1);
  assert.equal(result.selectedSamples[0].analysis.quality.confidence, 0.4);
});

test("initial fallback sample is blocked for hard rejects", () => {
  const badYawFallback = createInitialFallbackSample({
    analysis: sample(0.95).analysis,
    pose: sample(0.95, { pose: { yawDeg: 30 } }).pose
  });
  const tooCloseFallback = createInitialFallbackSample({
    analysis: sample(0.95, { quality: { coverage: 0.9 } }).analysis,
    pose: sample(0.95).pose
  });
  const softFallback = createInitialFallbackSample({
    analysis: sample(0.2).analysis,
    pose: sample(0.2).pose
  });

  assert.equal(badYawFallback, null);
  assert.equal(tooCloseFallback, null);
  assert.ok(softFallback);
});
