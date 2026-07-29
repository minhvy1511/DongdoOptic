import test from "node:test";
import assert from "node:assert/strict";

import {
  detectFaceLandmarksForImage,
  detectFaceLandmarksForVideo,
  normalizeFaceTrackingResult
} from "../../frontend/js/vision/face-tracking-adapter.js";

test("normalizes MediaPipe face landmark results", () => {
  const result = normalizeFaceTrackingResult({
    faceLandmarks: [[{ x: 0.1, y: 0.2, z: 0 }]]
  }, 123);

  assert.equal(result.faceCount, 1);
  assert.equal(result.faces.length, 1);
  assert.equal(result.reasonCode, "OK");
  assert.equal(result.timestamp, 123);
});

test("returns tracking error instead of throwing when MediaPipe fails", () => {
  const landmarker = {
    detectForVideo() {
      throw new Error("model failed");
    }
  };

  const result = detectFaceLandmarksForVideo(landmarker, {}, 456);

  assert.equal(result.faceCount, 0);
  assert.equal(result.faces.length, 0);
  assert.equal(result.reasonCode, "FACE_TRACKING_ERROR");
  assert.equal(result.error.message, "model failed");
  assert.equal(result.raw, null);
});

test("returns tracking error when landmarker is unavailable", () => {
  const result = detectFaceLandmarksForVideo(null, {}, 789);

  assert.equal(result.faceCount, 0);
  assert.equal(result.reasonCode, "FACE_TRACKING_ERROR");
  assert.equal(result.raw, null);
});

test("detects image landmarks through MediaPipe IMAGE mode adapter", () => {
  const image = { naturalWidth: 100, naturalHeight: 100 };
  const landmarker = {
    detect(input) {
      assert.equal(input, image);
      return { faceLandmarks: [[{ x: 0.4, y: 0.5, z: 0 }]] };
    }
  };

  const result = detectFaceLandmarksForImage(landmarker, image, 321);

  assert.equal(result.faceCount, 1);
  assert.equal(result.reasonCode, "OK");
  assert.equal(result.faces[0][0].x, 0.4);
  assert.equal(result.timestamp, 321);
});
