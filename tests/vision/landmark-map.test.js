import test from "node:test";
import assert from "node:assert/strict";

import {
  FACE_LANDMARKS,
  FACE_RATIO_REQUIRED_KEYS,
  getLandmark,
  getMissingLandmarkKeys,
  hasRequiredLandmarks,
  isValidLandmarkPoint,
  mapLandmarks
} from "../../frontend/js/vision/landmark-map.js";

function makeLandmarks(size = 500) {
  return Array.from({ length: size }, (_, index) => ({
    x: index / size,
    y: index / (size * 2),
    z: 0
  }));
}

test("maps named landmarks to MediaPipe indexes", () => {
  const landmarks = makeLandmarks();
  const named = mapLandmarks(landmarks);

  assert.equal(getLandmark(landmarks, "chin"), landmarks[152]);
  assert.equal(named.leftCheek, landmarks[234]);
  assert.equal(named.rightCheek, landmarks[454]);
  assert.equal(FACE_LANDMARKS.topFace, 10);
});

test("detects missing required landmarks", () => {
  const landmarks = makeLandmarks(200);
  const missing = getMissingLandmarkKeys(landmarks, FACE_RATIO_REQUIRED_KEYS);

  assert.ok(missing.includes("rightCheek"));
  assert.equal(hasRequiredLandmarks(landmarks, FACE_RATIO_REQUIRED_KEYS), false);
});

test("valid landmark requires finite x and y only", () => {
  assert.equal(isValidLandmarkPoint({ x: 0.2, y: 0.4 }), true);
  assert.equal(isValidLandmarkPoint({ x: 0.2, y: Number.NaN }), false);
  assert.equal(isValidLandmarkPoint(null), false);
});
