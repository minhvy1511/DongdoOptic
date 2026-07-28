import test from "node:test";
import assert from "node:assert/strict";

import {
  HARD_REJECT_REASON_CODES,
  QUALITY_REASON_CODES,
  SOFT_REJECT_REASON_CODES,
  buildCaptureQualityGate,
  evaluateScanFrameQuality,
  getBurstSampleRejectionReason,
  getVisionLimitations,
  isFallbackEligibleBurstSample,
  isUsableBurstSample
} from "../../frontend/js/vision/quality-gate.js";

const step = { key: "center", targetYaw: 0, tolerance: 8 };

function analysis(overrides = {}) {
  return {
    metrics: { lengthToWidth: 1.4 },
    quality: {
      confidence: 0.72,
      coverage: 0.18,
      centerOffsetX: 0.03,
      centerOffsetY: 0.04,
      ...overrides
    }
  };
}

function pose(overrides = {}) {
  return {
    yawDeg: 1,
    rollDeg: 2,
    ...overrides
  };
}

test("passes centered and stable scan frame", () => {
  const result = evaluateScanFrameQuality({
    step,
    analysis: analysis(),
    pose: pose(),
    faceCount: 1
  });

  assert.equal(result.ready, true);
  assert.equal(result.reasonCode, QUALITY_REASON_CODES.OK);
});

test("returns specific reason code for low confidence", () => {
  const result = evaluateScanFrameQuality({
    step,
    analysis: analysis({ confidence: 0.1 }),
    pose: pose(),
    faceCount: 1
  });

  assert.equal(result.ready, false);
  assert.equal(result.reasonCode, QUALITY_REASON_CODES.LOW_CONFIDENCE);
});

test("regression matrix keeps old scan outcomes for common inputs", () => {
  const cases = [
    ["front good", analysis(), pose(), 1, true, QUALITY_REASON_CODES.OK],
    ["left yaw near", analysis(), pose({ yawDeg: -10 }), 1, false, QUALITY_REASON_CODES.BAD_YAW],
    ["right yaw near", analysis(), pose({ yawDeg: 10 }), 1, false, QUALITY_REASON_CODES.BAD_YAW],
    ["too close", analysis({ coverage: 0.8 }), pose(), 1, false, QUALITY_REASON_CODES.TOO_CLOSE],
    ["too far", analysis({ coverage: 0.01 }), pose(), 1, false, QUALITY_REASON_CODES.TOO_FAR],
    ["two faces", analysis(), pose(), 2, false, QUALITY_REASON_CODES.MULTIPLE_FACES],
    ["no face", null, null, 0, false, QUALITY_REASON_CODES.NO_FACE],
    ["high confidence bad pose", analysis({ confidence: 0.95 }), pose({ yawDeg: 30 }), 1, false, QUALITY_REASON_CODES.BAD_YAW]
  ];

  cases.forEach(([label, inputAnalysis, inputPose, faceCount, ready, reason]) => {
    const result = evaluateScanFrameQuality({
      step,
      analysis: inputAnalysis,
      pose: inputPose,
      faceCount
    });

    assert.equal(result.ready, ready, label);
    assert.equal(result.reasonCode, reason, label);
  });
});

test("rejects burst outliers and marks fallback quality", () => {
  assert.equal(isUsableBurstSample({ analysis: analysis(), pose: pose() }), true);
  assert.equal(isUsableBurstSample({ analysis: analysis({ centerOffsetX: 0.6 }), pose: pose() }), false);

  const gate = buildCaptureQualityGate({
    selectedSamples: [{ analysis: analysis(), pose: pose() }],
    allSamples: [{ analysis: analysis(), pose: pose() }],
    quality: analysis({ confidence: 0.61 }).quality,
    pose: pose(),
    fallbackUsed: true
  });

  assert.equal(gate.passed, false);
  assert.ok(gate.reasonCodes.includes(QUALITY_REASON_CODES.INSUFFICIENT_SAMPLES));
  assert.ok(gate.reasonCodes.includes(QUALITY_REASON_CODES.FALLBACK_USED));
});

test("classifies hard and soft burst rejection reasons", () => {
  const soft = { analysis: analysis({ confidence: 0.1 }), pose: pose() };
  const hard = { analysis: analysis({ confidence: 0.95 }), pose: pose({ yawDeg: 28 }) };

  assert.equal(getBurstSampleRejectionReason(soft), QUALITY_REASON_CODES.LOW_CONFIDENCE);
  assert.equal(SOFT_REJECT_REASON_CODES.includes(getBurstSampleRejectionReason(soft)), true);
  assert.equal(isFallbackEligibleBurstSample(soft), true);

  assert.equal(getBurstSampleRejectionReason(hard), QUALITY_REASON_CODES.BAD_YAW);
  assert.equal(HARD_REJECT_REASON_CODES.includes(getBurstSampleRejectionReason(hard)), true);
  assert.equal(isFallbackEligibleBurstSample(hard), false);
});

test("declares physical measurement limitation without calibration", () => {
  const limitations = getVisionLimitations({ hasPhysicalCalibration: false });

  assert.ok(limitations.some((item) => item.includes("không xuất kích thước")));
});
