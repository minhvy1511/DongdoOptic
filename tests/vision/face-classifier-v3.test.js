import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { analyzeFaceShape } from "../../frontend/js/face-analysis.js";
import {
  FACE_CLASSIFIER_V3_MODEL,
  FACE_SHAPE_V3_FEATURE_NAMES,
  getFaceShapeV3ShadowScans,
  predictFaceShapeV3,
  recordFaceShapeV3ShadowScan,
  resetFaceShapeV3ShadowScans,
  standardizeFaceShapeV3Features,
  summarizeFaceShapeV3ShadowScans
} from "../../frontend/js/vision/face-classifier-v3.js";
import { extractFaceShapeV3Features } from "../../frontend/js/vision/face-shape-v3-features.js";

const ROOT = new URL("../../", import.meta.url);
const validation = JSON.parse(await readFile(new URL("data/processed/face_shape_v3_mlp_validation_results.json", ROOT), "utf8"));
const artifact = JSON.parse(await readFile(new URL("data/processed/face_shape_v3_mlp_model.json", ROOT), "utf8"));

test("browser V3 feature names and order exactly match the frozen artifact", () => {
  assert.deepEqual(FACE_SHAPE_V3_FEATURE_NAMES, artifact.feature_names);
  assert.deepEqual(FACE_CLASSIFIER_V3_MODEL.class_order, artifact.class_order);
});

test("browser standardization matches the frozen artifact", () => {
  const vector = featureArray(validation.records[0]);
  const expected = vector.map((value, index) => (value - artifact.mean[index]) / artifact.std[index]);
  assertVectorClose(standardizeFaceShapeV3Features(vector), expected, 1e-14);
});

test("browser V3 inference matches persisted offline predictions", () => {
  let maxError = 0;
  for (const record of validation.records.slice(0, 40)) {
    const result = predictFaceShapeV3(featureArray(record));
    assert.equal(result.predictedLabel, record.predicted_label);
    for (const label of artifact.class_order) {
      maxError = Math.max(maxError, Math.abs(result.probabilities[label] - record.probabilities[label]));
    }
  }
  assert.ok(maxError < 1e-12, `maximum probability error was ${maxError}`);
});

test("ReLU and stable softmax produce finite normalized probabilities", () => {
  const result = predictFaceShapeV3(featureArray(validation.records[0]));
  const probabilities = Object.values(result.probabilities);
  assert.ok(probabilities.every(Number.isFinite));
  assert.ok(Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
});

test("browser unknown behavior matches frozen V3 decisions", () => {
  const unknown = validation.records.find((record) => record.predicted_label === "unknown");
  const accepted = validation.records.find((record) => record.predicted_label !== "unknown");
  assert.ok(unknown && accepted);
  assert.equal(predictFaceShapeV3(featureArray(unknown)).predictedLabel, "unknown");
  assert.equal(predictFaceShapeV3(featureArray(accepted)).predictedLabel, accepted.predicted_label);
});

test("shared live feature extraction matches the offline reference formulas", () => {
  const frame = { width: 1280, height: 720 };
  const landmarks = makeFeatureLandmarks(frame);
  const live = extractFaceShapeV3Features(landmarks, frame);
  const offlineReference = referenceFeatures(landmarks, frame);
  assertVectorClose(live, offlineReference, 1e-14);
});

test("repeat-scan collector is memory-only and capped at ten scans", () => {
  let persistenceWrites = 0;
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = { setItem: () => { persistenceWrites += 1; } };
  try {
    resetFaceShapeV3ShadowScans();
    for (let index = 0; index < 12; index += 1) {
      recordFaceShapeV3ShadowScan({
        timestamp: `2026-08-16T00:00:${String(index).padStart(2, "0")}Z`,
        legacyLabel: index % 2 ? "oval" : "round",
        v3Label: "oval",
        v3TopProbability: 0.6,
        v3Probabilities: { oval: 0.6 },
        featureVector: Array(12).fill(index + 1),
        qualityStabilitySummary: { confidence: 0.8 }
      });
    }
    assert.equal(getFaceShapeV3ShadowScans().length, 10);
    assert.equal(summarizeFaceShapeV3ShadowScans().scanCount, 10);
    assert.equal(summarizeFaceShapeV3ShadowScans().v3LabelAgreementRate, 1);
    assert.equal(persistenceWrites, 0);
  } finally {
    resetFaceShapeV3ShadowScans();
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  }
});

test("legacy face analysis is unchanged when V3 shadow inference executes", () => {
  const frame = { width: 1280, height: 720 };
  const landmarks = makeFeatureLandmarks(frame);
  const before = analyzeFaceShape(landmarks, frame);
  predictFaceShapeV3(extractFaceShapeV3Features(landmarks, frame));
  const after = analyzeFaceShape(landmarks, frame);
  assert.deepEqual(after, before);
});

function featureArray(record) {
  return artifact.feature_names.map((name) => record.feature_vector[name]);
}

function makeFeatureLandmarks(frame) {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (index, x, y) => { points[index] = { x: x / frame.width, y: y / frame.height, z: 0 }; };
  const pairs = [
    [234, 430, 350], [454, 850, 350], [70, 470, 225], [300, 810, 225],
    [127, 435, 250], [356, 845, 250], [132, 455, 395], [361, 825, 395],
    [172, 475, 440], [397, 805, 440], [136, 495, 485], [365, 785, 485],
    [150, 555, 545], [379, 725, 545], [148, 600, 565], [377, 680, 565]
  ];
  set(10, 640, 120);
  set(152, 640, 600);
  pairs.forEach(([index, x, y]) => set(index, x, y));
  return points;
}

function referenceFeatures(marks, frame) {
  const aspect = frame.width / frame.height;
  const point = (index) => ({ x: marks[index].x * aspect, y: marks[index].y });
  const top = point(10), chin = point(152);
  const vx = chin.x - top.x, vy = chin.y - top.y, length = Math.hypot(vx, vy);
  const ux = vx / length, uy = vy / length, hx = vy / length, hy = -vx / length;
  const h = (index) => { const q = point(index); return (q.x - top.x) * hx + (q.y - top.y) * hy; };
  const v = (index) => { const q = point(index); return (q.x - top.x) * ux + (q.y - top.y) * uy; };
  const width = (left, right) => Math.abs(h(right) - h(left));
  const centerV = (left, right) => (v(left) + v(right)) / 2;
  const cheek = width(234, 454), forehead = width(70, 300), upper = width(127, 356);
  const outer = width(132, 361), jaw = width(172, 397), lower = width(136, 365);
  const chinMid = width(150, 379), chinWidth = width(148, 377);
  const jawDepth = Math.max(centerV(136, 365) - centerV(132, 361), 1e-4);
  const lowerDepth = Math.max(centerV(136, 365) - centerV(172, 397), 1e-4);
  const chinDepth = Math.max(centerV(150, 379) - centerV(136, 365), 1e-4);
  const lowerSlope = ((jaw - lower) / 2) / lowerDepth;
  const chinSlope = ((lower - chinMid) / 2) / chinDepth;
  const leftSlope = Math.abs((h(136) - h(132)) / Math.max(v(136) - v(132), 1e-4));
  const rightSlope = Math.abs((h(365) - h(361)) / Math.max(v(365) - v(361), 1e-4));
  return [length / cheek, lower / cheek, ((outer - lower) / 2) / jawDepth,
    (outer - lower) / cheek, (cheek - (upper + outer) / 2) / cheek, forehead / cheek,
    jaw / forehead, chinWidth / cheek, upper / cheek, Math.abs(leftSlope - rightSlope),
    (outer - 2 * jaw + lower) / cheek, Math.abs(lowerSlope - chinSlope)];
}

function assertVectorClose(actual, expected, tolerance) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(
    Math.abs(value - expected[index]) <= tolerance,
    `index ${index}: ${value} != ${expected[index]}`
  ));
}
