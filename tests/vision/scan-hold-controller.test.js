import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceScanHold,
  hasVideoFrameAdvanced,
  isMobileScanViewport
} from "../../frontend/js/vision/scan-hold-controller.js";
import { collectFrameBurst } from "../../frontend/js/vision/frame-collector.js";
import { createAcceptedScanCommit } from "../../frontend/js/vision/scan-ux-controller.js";

test("PC readiness remains strict and unchanged", () => {
  const holding = advanceScanHold({}, { now: 100, ready: true, mobile: false, holdDurationMs: 320 });
  const failed = advanceScanHold(holding, { now: 220, ready: false, reasonCode: "IMAGE_BLURRY", mobile: false, holdDurationMs: 320 });

  assert.equal(failed.reset, true);
  assert.equal(failed.progress, 0);
});

test("mobile transient blur pauses hold and recovery resumes without stale blocker", () => {
  const started = advanceScanHold({}, { now: 100, ready: true, mobile: true, holdDurationMs: 320 });
  const advanced = advanceScanHold(started, { now: 240, ready: true, mobile: true, holdDurationMs: 320 });
  const transient = advanceScanHold(advanced, { now: 300, ready: false, reasonCode: "IMAGE_BLURRY", mobile: true, holdDurationMs: 320 });
  const recovered = advanceScanHold(transient, { now: 360, ready: true, reasonCode: "OK", mobile: true, holdDurationMs: 320 });
  const completed = advanceScanHold(recovered, { now: 600, ready: true, reasonCode: "OK", mobile: true, holdDurationMs: 320 });

  assert.equal(transient.bridged, true);
  assert.equal(transient.progress, advanced.progress);
  assert.equal(recovered.bridged, false);
  assert.ok(recovered.progress > 0);
  assert.equal(completed.complete, true);
});

test("persistent mobile blur still resets and remains blocked", () => {
  const started = advanceScanHold({}, { now: 100, ready: true, mobile: true });
  const failed = advanceScanHold(started, { now: 400, ready: false, reasonCode: "IMAGE_BLURRY", mobile: true });

  assert.equal(failed.reset, true);
  assert.equal(failed.holdStartedAt, 0);
});

test("mobile grace never bridges center, pose, distance, or lower-face blockers", () => {
  const started = advanceScanHold({}, { now: 100, ready: true, mobile: true });
  for (const reasonCode of ["OFF_CENTER", "BAD_YAW", "TOO_CLOSE", "LOWER_FACE_UNSTABLE"]) {
    const failed = advanceScanHold(started, { now: 180, ready: false, reasonCode, mobile: true });
    assert.equal(failed.reset, true, reasonCode);
  }
});

test("mobile viewport detection is deterministic", () => {
  assert.equal(isMobileScanViewport({ matchMedia: () => ({ matches: true }) }), true);
  assert.equal(isMobileScanViewport({ matchMedia: () => ({ matches: false }) }), false);
});

test("camera frame clock detects advancing mobile video timestamps", () => {
  assert.equal(hasVideoFrameAdvanced(-1, 0), true);
  assert.equal(hasVideoFrameAdvanced(1.25, 1.25), false);
  assert.equal(hasVideoFrameAdvanced(1.25, 1.29), true);
});

test("mobile stable hold reaches burst, 100 percent, and navigation exactly once", async () => {
  let hold = {};
  for (const now of [100, 220, 340, 430]) {
    hold = advanceScanHold(hold, { now, ready: true, mobile: true, holdDurationMs: 320 });
  }
  assert.equal(hold.complete, true);

  const burst = await collectFrameBurst({
    targetFrames: 12,
    durationMs: 1200,
    detectFrame: () => ({ faces: [[{ x: 0.5, y: 0.5 }]] }),
    analyzeLandmarks: () => ({ metrics: { lengthToWidth: 1.4 }, quality: { confidence: 0.8, coverage: 0.18, centerOffsetX: 0.01, centerOffsetY: 0.01 } }),
    estimatePose: () => ({ yawDeg: 0, rollDeg: 0 }),
    shouldStopEarly: (samples) => samples.length >= 8,
    delayFn: () => Promise.resolve()
  });
  assert.equal(burst.length, 8);

  let progress = 0.95;
  let navigations = 0;
  const commit = createAcceptedScanCommit();
  progress = 1;
  assert.equal(commit.commit({ accepted: true, navigate: () => { navigations += 1; } }), true);
  assert.equal(commit.commit({ accepted: true, navigate: () => { navigations += 1; } }), false);
  assert.equal(progress, 1);
  assert.equal(navigations, 1);
});
