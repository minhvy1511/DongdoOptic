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
  centerSourceX: 0.021,
  centerSourceY: -0.014,
  centerRenderedX: 0.083,
  centerRenderedY: -0.025,
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
  burstSampleCount: 0
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
  assert.match(overlay.textContent, /GATE: FAIL/);
  assert.match(overlay.textContent, /BLOCKER: OFF_CENTER/);
  assert.match(overlay.textContent, /centerRendered: x=0\.083 y=-0\.025/);
  assert.match(overlay.textContent, /coverage: 0\.310/);
  assert.match(overlay.textContent, /lowerFace: PASS/);
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
    "GATE",
    "BLOCKER",
    "centerSource",
    "centerRendered",
    "coverage",
    "yaw",
    "roll",
    "brightness",
    "contrast",
    "sharpness",
    "imageQuality",
    "lowerFace",
    "usableSamples",
    "holdElapsedMs",
    "burstSamples"
  ]);
});
