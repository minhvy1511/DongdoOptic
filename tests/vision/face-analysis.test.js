import test from "node:test";
import assert from "node:assert/strict";

import {
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
  diamond: { faceHeight: 470, cheekWidth: 400, foreheadWidth: 310, jawWidth: 280 }
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
  assert.equal(longCount, 1);
});

test("aspect normalization keeps the same physical face stable across 16:9 and 4:3 frames", () => {
  const wide = analyzeFixture("oval", { width: 1280, height: 720 });
  const fourThree = analyzeFixture("oval", { width: 640, height: 480 });

  assert.equal(wide.diagnostics.classification.bestShape, fourThree.diagnostics.classification.bestShape);
  assert.ok(Math.abs(wide.metrics.lengthToWidth - fourThree.metrics.lengthToWidth) < 0.03);
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
