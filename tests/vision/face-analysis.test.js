import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateStableLengthToWidth,
  analyzeFaceShape,
  getAnalysisDebugSummary,
  getClassificationDetail
} from "../../frontend/js/face-analysis.js";

const DEFAULT_FRAME = Object.freeze({ width: 1280, height: 720 });

const FIXTURES = Object.freeze({
  round: { faceHeight: 400, cheekWidth: 380, foreheadWidth: 330, jawWidth: 330 },
  oval: { faceHeight: 480, cheekWidth: 360, foreheadWidth: 340, jawWidth: 310 },
  long: { faceHeight: 580, cheekWidth: 340, foreheadWidth: 310, jawWidth: 290 },
  square: { faceHeight: 430, cheekWidth: 360, foreheadWidth: 330, jawWidth: 350 },
  heart: { faceHeight: 480, cheekWidth: 360, foreheadWidth: 390, jawWidth: 280 },
  diamond: { faceHeight: 470, cheekWidth: 400, foreheadWidth: 310, jawWidth: 280 },
  triangle: { faceHeight: 480, cheekWidth: 360, foreheadWidth: 280, jawWidth: 360 }
});

function makePhysicalLandmarks({
  frame = DEFAULT_FRAME,
  faceHeight,
  cheekWidth,
  foreheadWidth,
  jawWidth,
  centerX = frame.width / 2,
  top = frame.height * 0.18
}) {
  const centerY = top + faceHeight / 2;
  const points = Array.from({ length: 478 }, () => ({
    x: centerX / frame.width,
    y: centerY / frame.height,
    z: 0
  }));

  const set = (index, px, py) => {
    points[index] = {
      x: px / frame.width,
      y: py / frame.height,
      z: 0
    };
  };

  set(10, centerX, top);
  set(152, centerX, top + faceHeight);
  set(234, centerX - cheekWidth / 2, top + faceHeight * 0.5);
  set(454, centerX + cheekWidth / 2, top + faceHeight * 0.5);
  set(70, centerX - foreheadWidth / 2, top + faceHeight * 0.28);
  set(300, centerX + foreheadWidth / 2, top + faceHeight * 0.28);
  set(127, centerX - foreheadWidth / 2, top + faceHeight * 0.28);
  set(356, centerX + foreheadWidth / 2, top + faceHeight * 0.28);
  set(172, centerX - jawWidth / 2, top + faceHeight * 0.78);
  set(397, centerX + jawWidth / 2, top + faceHeight * 0.78);

  return points;
}

function analyzeFixture(name, frame = DEFAULT_FRAME, overrides = {}) {
  const landmarks = makePhysicalLandmarks({
    frame,
    ...FIXTURES[name],
    ...overrides
  });
  return analyzeFaceShape(landmarks, frame);
}

function mirrorLandmarks(landmarks) {
  return landmarks.map((point) => ({ ...point, x: 1 - point.x }));
}

function jitterTopAndChin(landmarks, frame, topDeltaPx = 0, chinDeltaPx = 0) {
  const jittered = landmarks.map((point) => ({ ...point }));
  jittered[10] = { ...jittered[10], y: jittered[10].y + topDeltaPx / frame.height };
  jittered[152] = { ...jittered[152], y: jittered[152].y + chinDeltaPx / frame.height };
  return jittered;
}

function shiftLandmark(landmarks, frame, index, deltaX = 0, deltaY = 0) {
  const shifted = landmarks.map((point) => ({ ...point }));
  shifted[index] = {
    ...shifted[index],
    x: shifted[index].x + deltaX / frame.width,
    y: shifted[index].y + deltaY / frame.height
  };
  return shifted;
}

function metricRange(values) {
  return Math.max(...values) - Math.min(...values);
}

test("synthetic face fixtures do not collapse to long", () => {
  const results = Object.fromEntries(
    Object.keys(FIXTURES).map((name) => [name, analyzeFixture(name)])
  );
  const bestShapes = Object.values(results).map((analysis) => analysis.diagnostics.classification.bestShape);
  const longCount = bestShapes.filter((shape) => shape === "long").length;

  assert.equal(results.round.diagnostics.classification.bestShape, "round");
  assert.equal(results.oval.diagnostics.classification.bestShape, "oval");
  assert.equal(results.long.diagnostics.classification.bestShape, "long");
  assert.equal(results.square.diagnostics.classification.bestShape, "square");
  assert.equal(results.heart.diagnostics.classification.bestShape, "heart");
  assert.equal(results.diamond.diagnostics.classification.bestShape, "diamond");
  assert.equal(results.triangle.diagnostics.classification.bestShape, "triangle");
  assert.equal(longCount, 1);
});

test("clear triangle geometry wins with the triangle-specific margin", () => {
  const classification = analyzeFixture("triangle").diagnostics.classification;

  assert.equal(classification.shape, "triangle");
  assert.equal(classification.bestShape, "triangle");
  assert.ok(classification.margin >= 0.08);
});

test("triangle-square boundary does not produce a confident triangle", () => {
  const classification = getClassificationDetail({
    lengthToWidth: 1.2,
    jawToCheek: 0.97,
    foreheadToCheek: 0.92,
    jawToForehead: 1.06,
    cheekToJaw: 1 / 0.97
  });

  assert.notEqual(classification.shape, "triangle");
  assert.ok(classification.bestShape === "square" || classification.shape === "unknown");
});

test("heart inverse pattern keeps triangle score near zero", () => {
  const classification = getClassificationDetail({
    lengthToWidth: 1.33,
    jawToCheek: 0.78,
    foreheadToCheek: 1.08,
    jawToForehead: 0.72,
    cheekToJaw: 1 / 0.78
  });
  const triangle = classification.candidates.find((candidate) => candidate.name === "triangle");

  assert.equal(classification.shape, "heart");
  assert.ok(triangle.score <= 0.11);
});

test("oval-square calibration preserves clear fixtures and rejects ambiguous winners", () => {
  const oval = analyzeFixture("oval").diagnostics.classification;
  const square = analyzeFixture("square").diagnostics.classification;
  const ambiguousOval = getClassificationDetail({
    lengthToWidth: 1.3,
    jawToCheek: 0.9,
    foreheadToCheek: 0.92,
    jawToForehead: 0.9 / 0.92,
    cheekToJaw: 1 / 0.9
  });
  const ambiguousSquare = getClassificationDetail({
    lengthToWidth: 1.3,
    jawToCheek: 0.91,
    foreheadToCheek: 0.9,
    jawToForehead: 0.91 / 0.9,
    cheekToJaw: 1 / 0.91
  });

  assert.equal(oval.shape, "oval");
  assert.equal(square.shape, "square");
  assert.equal(ambiguousOval.bestShape, "oval");
  assert.equal(ambiguousOval.shape, "unknown");
  assert.equal(ambiguousSquare.bestShape, "square");
  assert.equal(ambiguousSquare.shape, "unknown");
});

test("round-oval calibration preserves clear fixtures and rejects a low-margin boundary", () => {
  const round = analyzeFixture("round").diagnostics.classification;
  const oval = analyzeFixture("oval").diagnostics.classification;
  const ambiguous = getClassificationDetail({
    lengthToWidth: 1.24,
    jawToCheek: 0.86,
    foreheadToCheek: 0.92,
    jawToForehead: 0.86 / 0.92,
    cheekToJaw: 1 / 0.86
  });

  assert.equal(round.shape, "round");
  assert.equal(oval.shape, "oval");
  assert.equal(ambiguous.bestShape, "oval");
  assert.ok(ambiguous.margin < 0.08);
  assert.equal(ambiguous.shape, "unknown");
});

test("aspect normalization keeps the same physical face stable across 16:9 and 4:3 frames", () => {
  const wide = analyzeFixture("oval", { width: 1280, height: 720 });
  const fourThree = analyzeFixture("oval", { width: 640, height: 480 });

  assert.equal(wide.diagnostics.classification.bestShape, fourThree.diagnostics.classification.bestShape);
  assert.ok(Math.abs(wide.metrics.lengthToWidth - fourThree.metrics.lengthToWidth) < 0.03);
});

test("same normalized landmarks stay stable when frame resolution keeps the same aspect", () => {
  const landmarks = makePhysicalLandmarks({ frame: DEFAULT_FRAME, ...FIXTURES.oval });
  const hd = analyzeFaceShape(landmarks, { width: 1280, height: 720 });
  const fullHd = analyzeFaceShape(landmarks, { width: 1920, height: 1080 });

  assert.equal(hd.diagnostics.classification.bestShape, fullHd.diagnostics.classification.bestShape);
  assert.ok(Math.abs(hd.metrics.lengthToWidth - fullHd.metrics.lengthToWidth) < 0.001);
  assert.ok(Math.abs(hd.metrics.jawToCheek - fullHd.metrics.jawToCheek) < 0.001);
  assert.ok(Math.abs(hd.metrics.foreheadToCheek - fullHd.metrics.foreheadToCheek) < 0.001);
});

test("mobile portrait and landscape frame normalization stay equivalent", () => {
  const landscape = analyzeFixture("square", { width: 1280, height: 720 });
  const portrait = analyzeFixture("square", { width: 720, height: 1280 }, {
    faceHeight: 430 * 0.7,
    cheekWidth: 360 * 0.7,
    foreheadWidth: 330 * 0.7,
    jawWidth: 350 * 0.7
  });

  assert.equal(landscape.diagnostics.classification.bestShape, portrait.diagnostics.classification.bestShape);
  assert.ok(Math.abs(landscape.metrics.lengthToWidth - portrait.metrics.lengthToWidth) < 0.03);
});

test("equivalent live video and uploaded image frame sizes produce matching metrics", () => {
  const frame = { width: 1440, height: 1080 };
  const landmarks = makePhysicalLandmarks({ frame, ...FIXTURES.round });
  const liveVideo = analyzeFaceShape(landmarks, frame);
  const uploadedImage = analyzeFaceShape(landmarks, { ...frame });

  assert.equal(liveVideo.diagnostics.classification.bestShape, uploadedImage.diagnostics.classification.bestShape);
  assert.deepEqual(liveVideo.metrics, uploadedImage.metrics);
});

test("scale, translation, and mirror do not change the classification", () => {
  const baseline = analyzeFixture("heart");
  const scaledTranslated = analyzeFixture("heart", DEFAULT_FRAME, {
    faceHeight: FIXTURES.heart.faceHeight * 0.82,
    cheekWidth: FIXTURES.heart.cheekWidth * 0.82,
    foreheadWidth: FIXTURES.heart.foreheadWidth * 0.82,
    jawWidth: FIXTURES.heart.jawWidth * 0.82,
    centerX: 760,
    top: 92
  });
  const mirrored = analyzeFaceShape(
    mirrorLandmarks(makePhysicalLandmarks({ frame: DEFAULT_FRAME, ...FIXTURES.heart })),
    DEFAULT_FRAME
  );

  assert.equal(scaledTranslated.diagnostics.classification.bestShape, baseline.diagnostics.classification.bestShape);
  assert.equal(mirrored.diagnostics.classification.bestShape, baseline.diagnostics.classification.bestShape);
  assert.ok(Math.abs(scaledTranslated.metrics.lengthToWidth - baseline.metrics.lengthToWidth) < 0.02);
  assert.ok(Math.abs(mirrored.metrics.lengthToWidth - baseline.metrics.lengthToWidth) < 0.001);
});

test("sequential scans do not reuse previous face ratios or labels", () => {
  const wideFirst = analyzeFixture("round");
  const longSecond = analyzeFixture("long");
  const wideAgain = analyzeFixture("round");
  const longFirst = analyzeFixture("long");
  const wideSecond = analyzeFixture("round");

  assert.equal(wideFirst.diagnostics.classification.bestShape, "round");
  assert.equal(longSecond.diagnostics.classification.bestShape, "long");
  assert.equal(wideAgain.diagnostics.classification.bestShape, "round");
  assert.equal(longFirst.diagnostics.classification.bestShape, "long");
  assert.equal(wideSecond.diagnostics.classification.bestShape, "round");
  assert.equal(wideFirst.metrics.lengthToWidth, wideAgain.metrics.lengthToWidth);
});

test("invalid, NaN, and tied metrics do not default to long", () => {
  const nanDetail = getClassificationDetail({
    lengthToWidth: NaN,
    jawToCheek: 1,
    foreheadToCheek: 1,
    jawToForehead: 1,
    cheekToJaw: 1
  });
  const zeroDetail = getClassificationDetail({
    lengthToWidth: 0,
    jawToCheek: 0,
    foreheadToCheek: 0,
    jawToForehead: 0,
    cheekToJaw: 0
  });

  assert.equal(nanDetail.shape, "unknown");
  assert.equal(nanDetail.bestShape, "unknown");
  assert.notEqual(nanDetail.bestShape, "long");
  assert.equal(zeroDetail.shape, "unknown");
  assert.equal(zeroDetail.bestShape, "unknown");
  assert.notEqual(zeroDetail.bestShape, "long");
});

test("debug summary exposes aggregate-safe metrics without entering JSON persistence", () => {
  const analysis = analyzeFixture("diamond");
  const debug = getAnalysisDebugSummary(analysis);
  const serialized = JSON.stringify(analysis);

  assert.equal(debug.winningLabel, "diamond");
  assert.equal(debug.inputWidth, DEFAULT_FRAME.width);
  assert.ok(debug.correctedLengthWidthRatio > 0);
  assert.ok(!serialized.includes("__visionDebug"));
});

test("lower-face geometry is stable for normal synthetic fixtures", () => {
  const analysis = analyzeFixture("oval");
  const lowerFaceGeometry = analysis.quality.lowerFaceGeometry;

  assert.equal(lowerFaceGeometry.available, true);
  assert.ok(lowerFaceGeometry.chinOffsetRatio < 0.01);
  assert.ok(lowerFaceGeometry.jawChinAsymmetryRatio < 0.01);
  assert.ok(lowerFaceGeometry.jawWidthToCheek > 0.8);
  assert.ok(lowerFaceGeometry.jawWidthToCheek < 0.9);
});

test("lower-face geometry exposes displaced chin and jaw/chin asymmetry", () => {
  const cleanLandmarks = makePhysicalLandmarks({ frame: DEFAULT_FRAME, ...FIXTURES.oval });
  const displacedChin = shiftLandmark(cleanLandmarks, DEFAULT_FRAME, 152, 92, 0);
  const analysis = analyzeFaceShape(displacedChin, DEFAULT_FRAME);
  const lowerFaceGeometry = analysis.quality.lowerFaceGeometry;

  assert.equal(lowerFaceGeometry.available, true);
  assert.ok(lowerFaceGeometry.chinOffsetRatio > 0.16);
  assert.ok(lowerFaceGeometry.jawChinAsymmetryRatio > 0.32);
});

test("stable length-to-width aggregation clamps top and chin jitter", () => {
  const cleanLandmarks = makePhysicalLandmarks({ frame: DEFAULT_FRAME, ...FIXTURES.oval });
  const cleanLengthToWidth = analyzeFaceShape(cleanLandmarks, DEFAULT_FRAME).metrics.lengthToWidth;
  const jitterPattern = [
    -36, 42, -30, 34, -22, 28, -16, 18,
    -10, 12, -6, 8, 0, 4, -4, 6,
    -52, 58, -46, 50, -14, 16, -8, 10
  ];
  const burstLengthToWidth = jitterPattern.map((delta) => {
    const landmarks = jitterTopAndChin(cleanLandmarks, DEFAULT_FRAME, -delta / 2, delta / 2);
    return analyzeFaceShape(landmarks, DEFAULT_FRAME).metrics.lengthToWidth;
  });
  const stableLengthToWidth = aggregateStableLengthToWidth(burstLengthToWidth);

  assert.ok(metricRange(burstLengthToWidth) > 0.25);
  assert.ok(Math.abs(stableLengthToWidth - cleanLengthToWidth) < 0.025);
  assert.ok(Math.abs(stableLengthToWidth - cleanLengthToWidth) < metricRange(burstLengthToWidth) / 10);
});

test("stable length-to-width aggregation leaves clean burst nearly unchanged", () => {
  const cleanLandmarks = makePhysicalLandmarks({ frame: DEFAULT_FRAME, ...FIXTURES.oval });
  const cleanLengthToWidth = analyzeFaceShape(cleanLandmarks, DEFAULT_FRAME).metrics.lengthToWidth;
  const cleanBurst = Array.from({ length: 24 }, () => cleanLengthToWidth);
  const stableLengthToWidth = aggregateStableLengthToWidth(cleanBurst);

  assert.ok(Math.abs(stableLengthToWidth - cleanLengthToWidth) < 0.0001);
});

test("stable length-to-width aggregation reduces round-oval boundary flips from outlier frames", () => {
  const boundaryMetrics = {
    foreheadToCheek: 0.93,
    jawToCheek: 0.84,
    jawToForehead: 0.9,
    cheekToJaw: 1.19
  };
  const boundaryBurst = [
    1.22, 1.23, 1.23, 1.24, 1.22, 1.23, 1.24, 1.23,
    1.22, 1.23, 1.24, 1.23, 1.2, 1.19, 1.18, 1.17,
    1.16, 1.15, 1.32, 1.34, 1.35, 1.36, 1.37, 1.38
  ];
  const rawShapes = new Set(
    boundaryBurst.map((lengthToWidth) => getClassificationDetail({
      ...boundaryMetrics,
      lengthToWidth
    }).bestShape)
  );
  const stableShape = getClassificationDetail({
    ...boundaryMetrics,
    lengthToWidth: aggregateStableLengthToWidth(boundaryBurst)
  }).bestShape;

  assert.ok(rawShapes.has("round"));
  assert.ok(rawShapes.has("oval"));
  assert.equal(stableShape, "oval");
});
