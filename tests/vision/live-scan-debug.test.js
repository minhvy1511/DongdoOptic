import assert from "node:assert/strict";
import test from "node:test";

import {
  createLiveScanDebugController,
  formatLiveScanDebug
} from "../../frontend/js/vision/live-scan-debug.js";

const blockerSnapshot = {
  state: "CENTERING",
  progress: 0,
  gatePassed: false,
  reasonCode: "OFF_CENTER",
  sourceFaceCenterX: 0.51,
  sourceFaceCenterY: 0.49,
  faceCenterRenderedX: 186,
  faceCenterRenderedY: 347,
  guideCenterRenderedX: 195,
  guideCenterRenderedY: 343,
  guideWidth: 241.8,
  guideHeight: 546,
  centerDx: 0.037,
  centerDy: 0.007,
  centerLimitX: 0.258,
  centerLimitY: 0.205,
  centerPassed: false,
  distanceStatus: "PASS",
  posePassed: true,
  coverage: 0.31,
  yaw: 2.1,
  roll: 0.7,
  brightness: 0.54,
  contrast: 0.22,
  sharpness: 118,
  imageQualityPass: true,
  lowerFacePassed: true,
  usableSampleCount: 0,
  holdElapsedMs: 0,
  burstSampleCount: 0,
  burstRequired: 8,
  videoWidth: 1280,
  videoHeight: 720,
  renderedWidth: 390,
  renderedHeight: 700,
  canvasWidth: 390,
  canvasHeight: 700,
  cropOffsetX: -427.2,
  cropOffsetY: 0,
  mirror: true
};

test("debug overlay receives the exact current blocker and requested metrics", () => {
  const overlay = { textContent: "" };
  const controller = createLiveScanDebugController({
    enabled: true,
    mountOverlay: () => overlay,
    log: () => {}
  });

  controller.update(blockerSnapshot);

  assert.match(overlay.textContent, /STATE: CENTERING/);
  assert.match(overlay.textContent, /CENTER: FAIL/);
  assert.match(overlay.textContent, /BLOCKER: OFF_CENTER/);
  assert.match(overlay.textContent, /dx: 0\.037 limitX: 0\.258/);
  assert.match(overlay.textContent, /faceRendered: x=186\.000 y=347\.000/);
  assert.match(overlay.textContent, /guideRendered: x=195\.000 y=343\.000/);
  assert.match(overlay.textContent, /coverage: 0\.310/);
  assert.match(overlay.textContent, /LOWER_FACE: PASS/);
});

test("disabled debug mode mounts nothing and does not mutate scan input", () => {
  let mounts = 0;
  let logs = 0;
  const snapshot = structuredClone(blockerSnapshot);
  const original = structuredClone(snapshot);
  const controller = createLiveScanDebugController({
    enabled: false,
    mountOverlay: () => {
      mounts += 1;
      return { textContent: "" };
    },
    log: () => { logs += 1; }
  });

  assert.equal(controller.update(snapshot), null);
  assert.equal(mounts, 0);
  assert.equal(logs, 0);
  assert.deepEqual(snapshot, original);
});

test("state transitions and reset reasons are logged only in debug mode", () => {
  const messages = [];
  const controller = createLiveScanDebugController({
    enabled: true,
    mountOverlay: () => ({ textContent: "" }),
    log: (message) => messages.push(message)
  });

  controller.update(blockerSnapshot);
  controller.update({ ...blockerSnapshot, state: "HOLDING", gatePassed: true, reasonCode: "OK" });
  controller.update({ ...blockerSnapshot, state: "BURST", gatePassed: true, reasonCode: "BURST_COLLECTING" });
  controller.update({ ...blockerSnapshot, state: "COMPLETE", gatePassed: true, reasonCode: "OK" });
  controller.update({ ...blockerSnapshot, reasonCode: "TOO_CLOSE" });

  assert.deepEqual(messages, [
    "[VisionID][live] CENTERING → HOLDING",
    "[VisionID][live] HOLDING → BURST",
    "[VisionID][live] BURST → COMPLETE",
    "[VisionID][live] COMPLETE → CENTERING",
    "[VisionID][live] reset to CENTERING: TOO_CLOSE"
  ]);
});

test("formatter exposes only the compact approved field set", () => {
  const lines = formatLiveScanDebug(blockerSnapshot).split("\n");
  assert.deepEqual(lines.map((line) => line.split(":", 1)[0]), [
    "STATE",
    "progress",
    "CENTER",
    "dx",
    "dy",
    "DISTANCE",
    "POSE",
    "QUALITY",
    "LOWER_FACE",
    "BURST",
    "BLOCKER",
    "faceSource",
    "faceRendered",
    "guideRendered",
    "guideSize",
    "video",
    "rendered",
    "canvas",
    "crop",
    "mirror",
    "coverage",
    "yaw",
    "roll",
    "brightness",
    "contrast",
    "sharpness",
    "usableSamples",
    "holdElapsedMs"
  ]);
});
