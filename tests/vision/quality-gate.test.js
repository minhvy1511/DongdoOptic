import test from "node:test";
import assert from "node:assert/strict";

import {
  HARD_REJECT_REASON_CODES,
  QUALITY_REASON_CODES,
  SOFT_REJECT_REASON_CODES,
  buildCaptureQualityGate,
  evaluateImageQualityFromImageData,
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

function lowerFaceGeometry(overrides = {}) {
  return {
    available: true,
    chinOffsetRatio: 0.02,
    chinDepthRatio: 0.22,
    jawChinAsymmetryRatio: 0.04,
    jawWidth: 0.18,
    jawWidthToCheek: 0.84,
    ...overrides
  };
}

function imageDataFromPixels(pixels, width = pixels.length) {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((value, index) => {
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  });
  return {
    data,
    width,
    height: Math.max(1, Math.ceil(pixels.length / width))
  };
}

function imageDataFromGrid(width, height, getValue) {
  const pixels = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      pixels.push(getValue(x, y));
    }
  }
  return imageDataFromPixels(pixels, width);
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

test("capture quality gate requires valid distance for high confidence pass", () => {
  const samples = Array.from({ length: 12 }, () => ({ analysis: analysis(), pose: pose() }));
  const goodGate = buildCaptureQualityGate({
    selectedSamples: samples,
    allSamples: samples,
    quality: analysis({ confidence: 0.9, coverage: 0.18 }).quality,
    pose: pose()
  });
  const tooFarGate = buildCaptureQualityGate({
    selectedSamples: samples,
    allSamples: samples,
    quality: analysis({ confidence: 0.9, coverage: 0.02 }).quality,
    pose: pose()
  });
  const tooCloseGate = buildCaptureQualityGate({
    selectedSamples: samples,
    allSamples: samples,
    quality: analysis({ confidence: 0.9, coverage: 0.58 }).quality,
    pose: pose()
  });
  const yawGate = buildCaptureQualityGate({
    selectedSamples: samples,
    allSamples: samples,
    quality: analysis({ confidence: 0.9, coverage: 0.18 }).quality,
    pose: pose({ yawDeg: 20 })
  });
  const offCenterGate = buildCaptureQualityGate({
    selectedSamples: samples,
    allSamples: samples,
    quality: analysis({ confidence: 0.9, coverage: 0.18, centerOffsetX: 0.2 }).quality,
    pose: pose()
  });

  assert.equal(goodGate.passed, true);
  assert.equal(tooFarGate.passed, false);
  assert.ok(tooFarGate.reasonCodes.includes(QUALITY_REASON_CODES.BAD_DISTANCE));
  assert.equal(tooCloseGate.passed, false);
  assert.ok(tooCloseGate.reasonCodes.includes(QUALITY_REASON_CODES.BAD_DISTANCE));
  assert.equal(yawGate.passed, false);
  assert.ok(yawGate.reasonCodes.includes(QUALITY_REASON_CODES.BAD_YAW));
  assert.equal(offCenterGate.passed, true);
  assert.ok(offCenterGate.reasonCodes.includes(QUALITY_REASON_CODES.OFF_CENTER));
});

test("lower-face geometry rejects displaced chin and asymmetric jaw/chin samples", () => {
  const displacedChin = analysis({
    lowerFaceGeometry: lowerFaceGeometry({ chinOffsetRatio: 0.22 })
  });
  const asymmetricJaw = {
    analysis: analysis({
      lowerFaceGeometry: lowerFaceGeometry({ jawChinAsymmetryRatio: 0.41 })
    }),
    pose: pose()
  };

  assert.equal(evaluateScanFrameQuality({
    step,
    analysis: displacedChin,
    pose: pose(),
    faceCount: 1
  }).reasonCode, QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE);
  assert.equal(getBurstSampleRejectionReason(asymmetricJaw), QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE);
  assert.equal(HARD_REJECT_REASON_CODES.includes(QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE), true);
  assert.equal(isFallbackEligibleBurstSample(asymmetricJaw), false);
});

test("capture quality gate rejects unstable jaw width across burst but passes normal geometry", () => {
  const makeSample = (jawWidthToCheek) => ({
    analysis: analysis({
      lowerFaceGeometry: lowerFaceGeometry({ jawWidthToCheek })
    }),
    pose: pose()
  });
  const stableSamples = [0.83, 0.84, 0.85, 0.84, 0.83, 0.85, 0.84, 0.83]
    .map(makeSample);
  const unstableSamples = [0.78, 0.79, 0.8, 0.82, 0.96, 0.99, 1.01, 1.03]
    .map(makeSample);

  const stableGate = buildCaptureQualityGate({
    selectedSamples: stableSamples,
    allSamples: stableSamples,
    quality: analysis({ confidence: 0.9, lowerFaceGeometry: lowerFaceGeometry() }).quality,
    pose: pose()
  });
  const unstableGate = buildCaptureQualityGate({
    selectedSamples: unstableSamples,
    allSamples: unstableSamples,
    quality: analysis({ confidence: 0.9, lowerFaceGeometry: lowerFaceGeometry() }).quality,
    pose: pose()
  });

  assert.equal(stableGate.passed, true);
  assert.equal(unstableGate.passed, false);
  assert.ok(unstableGate.reasonCodes.includes(QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE));
  assert.equal(unstableGate.checks.find((item) => item.key === "lowerFaceGeometry")?.passed, false);
});

test("image quality gate rejects dark, overexposed, and low contrast frames", () => {
  const normalQuality = evaluateImageQualityFromImageData(imageDataFromPixels([64, 96, 128, 160, 192]));
  const darkQuality = evaluateImageQualityFromImageData(imageDataFromPixels([8, 12, 15, 20, 24]));
  const brightQuality = evaluateImageQualityFromImageData(imageDataFromPixels([232, 238, 242, 246, 250]));
  const flatQuality = evaluateImageQualityFromImageData(imageDataFromPixels([128, 129, 128, 129, 128]));

  assert.equal(normalQuality.passed, true);
  assert.equal(darkQuality.passed, false);
  assert.equal(darkQuality.reasonCode, QUALITY_REASON_CODES.IMAGE_TOO_DARK);
  assert.equal(brightQuality.passed, false);
  assert.equal(brightQuality.reasonCode, QUALITY_REASON_CODES.IMAGE_TOO_BRIGHT);
  assert.equal(flatQuality.passed, false);
  assert.equal(flatQuality.reasonCode, QUALITY_REASON_CODES.IMAGE_LOW_CONTRAST);

  assert.equal(evaluateScanFrameQuality({
    step,
    analysis: analysis({ imageQuality: normalQuality }),
    pose: pose(),
    faceCount: 1
  }).reasonCode, QUALITY_REASON_CODES.OK);
  assert.equal(evaluateScanFrameQuality({
    step,
    analysis: analysis({ imageQuality: darkQuality }),
    pose: pose(),
    faceCount: 1
  }).reasonCode, QUALITY_REASON_CODES.IMAGE_TOO_DARK);
  assert.equal(evaluateScanFrameQuality({
    step,
    analysis: analysis({ imageQuality: brightQuality }),
    pose: pose(),
    faceCount: 1
  }).reasonCode, QUALITY_REASON_CODES.IMAGE_TOO_BRIGHT);
  assert.equal(evaluateScanFrameQuality({
    step,
    analysis: analysis({ imageQuality: flatQuality }),
    pose: pose(),
    faceCount: 1
  }).reasonCode, QUALITY_REASON_CODES.IMAGE_LOW_CONTRAST);

  const samples = Array.from({ length: 12 }, () => ({ analysis: analysis(), pose: pose() }));
  const darkGate = buildCaptureQualityGate({
    selectedSamples: samples,
    allSamples: samples,
    quality: analysis({ imageQuality: darkQuality }).quality,
    pose: pose()
  });

  assert.equal(darkGate.passed, false);
  assert.ok(darkGate.reasonCodes.includes(QUALITY_REASON_CODES.IMAGE_TOO_DARK));
});

test("image quality gate rejects heavy blur with low edge sharpness", () => {
  const sharpQuality = evaluateImageQualityFromImageData(
    imageDataFromGrid(8, 8, (x, y) => ((x + y) % 2 === 0 ? 80 : 180))
  );
  const blurredQuality = evaluateImageQualityFromImageData(
    imageDataFromGrid(10, 10, (x) => (x < 5 ? 100 : 150))
  );

  assert.equal(sharpQuality.passed, true);
  assert.ok(sharpQuality.sharpness >= 12);
  assert.equal(blurredQuality.passed, false);
  assert.equal(blurredQuality.reasonCode, QUALITY_REASON_CODES.IMAGE_BLURRY);
  assert.ok(blurredQuality.contrast >= 18);
  assert.ok(blurredQuality.sharpness < 12);

  assert.equal(evaluateScanFrameQuality({
    step,
    analysis: analysis({ imageQuality: blurredQuality }),
    pose: pose(),
    faceCount: 1
  }).reasonCode, QUALITY_REASON_CODES.IMAGE_BLURRY);
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
