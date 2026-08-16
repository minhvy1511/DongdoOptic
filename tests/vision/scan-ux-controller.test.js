import test from "node:test";
import assert from "node:assert/strict";
import {
  createAcceptedScanCommit,
  createAutoConsultationTransition,
  getScanGuidanceMessage,
  getScanHudView,
  isCanonicalVisionSuccess
} from "../../frontend/js/vision/scan-ux-controller.js";

test("accepted scan commits stop, save, and navigation exactly once", () => {
  const completion = createAcceptedScanCommit();
  const calls = [];

  assert.equal(completion.commit({
    accepted: true,
    stopScan: () => calls.push("stop"),
    saveResult: () => calls.push("save"),
    navigate: () => calls.push("navigate")
  }), true);
  assert.equal(completion.commit({ accepted: true, navigate: () => calls.push("duplicate") }), false);
  assert.deepEqual(calls, ["stop", "save", "navigate"]);
});

test("rejected scan does not commit or navigate", () => {
  const completion = createAcceptedScanCommit();
  let navigated = false;

  assert.equal(completion.commit({ accepted: false, navigate: () => { navigated = true; } }), false);
  assert.equal(navigated, false);
  assert.equal(completion.isCommitted(), false);
});

const validAnalysis = {
  metrics: { lengthToWidth: 1.35 },
  quality: { confidence: 0.86 },
  diagnostics: {
    autoConfirmed: true,
    partialScan: false
  }
};

const resultState = {
  phase: "RESULT",
  status: "captured"
};

test("scanning HUD only exposes compact status, confidence, and one guidance message", () => {
  const view = getScanHudView({
    autoScanState: { active: true, phase: "CENTERING", status: "prompt", prompt: "center" },
    confidencePercent: "78%"
  });

  assert.equal(view.status, "Đang quét");
  assert.equal(view.confidence, "78%");
  assert.equal(view.guidance, "Đưa khuôn mặt vào giữa khung");
  assert.equal(view.complete, false);
});

test("guidance maps quality reasons to one concise message", () => {
  assert.equal(getScanGuidanceMessage({ reasonCode: "TOO_CLOSE" }), "Lùi ra xa một chút");
  assert.equal(getScanGuidanceMessage({ reasonCode: "TOO_FAR" }), "Đưa khuôn mặt gần hơn");
  assert.equal(getScanGuidanceMessage({ reasonCode: "BAD_ROLL" }), "Giữ đầu thẳng");
  assert.equal(getScanGuidanceMessage({ reasonCode: "BAD_YAW" }), "Nhìn thẳng vào camera");
  assert.equal(getScanGuidanceMessage({ status: "hold" }), "Giữ nguyên trong giây lát");
});

test("complete HUD shows success and opening consultation state", () => {
  const view = getScanHudView({
    autoScanState: resultState,
    confidencePercent: "86%",
    isComplete: true
  });

  assert.deepEqual(view, {
    status: "Quét thành công",
    confidence: "86%",
    guidance: "Đang mở tư vấn...",
    complete: true
  });
});

test("canonical success requires current auto-confirmed final result", () => {
  assert.equal(isCanonicalVisionSuccess({
    latestAnalysis: validAnalysis,
    confirmedFaceShape: "oval",
    confirmedFaceShapeSource: "auto",
    autoScanState: resultState
  }), true);

  assert.equal(isCanonicalVisionSuccess({
    latestAnalysis: { ...validAnalysis, faceShape_confirmed: "oval" },
    confirmedFaceShape: "",
    confirmedFaceShapeSource: "",
    autoScanState: resultState
  }), true);
});

test("invalid, incomplete, rejected, or manual states do not auto navigate", () => {
  const base = {
    latestAnalysis: validAnalysis,
    confirmedFaceShape: "oval",
    confirmedFaceShapeSource: "auto",
    autoScanState: resultState
  };

  assert.equal(isCanonicalVisionSuccess({ ...base, latestAnalysis: null }), false);
  assert.equal(isCanonicalVisionSuccess({ ...base, confirmedFaceShape: "" }), false);
  assert.equal(isCanonicalVisionSuccess({ ...base, confirmedFaceShapeSource: "manual" }), false);
  assert.equal(isCanonicalVisionSuccess({
    ...base,
    latestAnalysis: { ...validAnalysis, diagnostics: { ...validAnalysis.diagnostics, autoConfirmed: false } }
  }), false);
  assert.equal(isCanonicalVisionSuccess({
    ...base,
    latestAnalysis: { ...validAnalysis, diagnostics: { ...validAnalysis.diagnostics, partialScan: true } }
  }), false);
  assert.equal(isCanonicalVisionSuccess({
    ...base,
    autoScanState: { phase: "ERROR", status: "error", errorReason: "INCOMPLETE_FRAMES" }
  }), false);
});

test("auto transition schedules once and re-render does not schedule twice", async () => {
  const transition = createAutoConsultationTransition();
  const calls = [];

  assert.equal(transition.schedule({ contextKey: "A", delayMs: 1, onTransition: (key) => calls.push(key) }), true);
  assert.equal(transition.schedule({ contextKey: "A", delayMs: 1, onTransition: (key) => calls.push(key) }), false);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(calls, ["A"]);
  assert.equal(transition.schedule({ contextKey: "A", delayMs: 1, onTransition: (key) => calls.push(key) }), false);
});

test("customer switch, reset, rescan, and invalidation cancel pending transition", async () => {
  const transition = createAutoConsultationTransition();
  const calls = [];

  transition.schedule({ contextKey: "customer-a", delayMs: 5, onTransition: (key) => calls.push(key) });
  transition.cancel();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(calls, []);

  transition.schedule({ contextKey: "customer-b", delayMs: 5, onTransition: (key) => calls.push(key) });
  transition.reset();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(calls, []);

  assert.equal(transition.schedule({ contextKey: "customer-c", delayMs: 1, onTransition: (key) => calls.push(key) }), true);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(calls, ["customer-c"]);
});
