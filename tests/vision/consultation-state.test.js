import test from "node:test";
import assert from "node:assert/strict";

import {
  CONSULTATION_SAVE_STATES,
  CONSULTATION_SOURCES,
  CUSTOMER_OPERATIONAL_STATUSES,
  buildConsultationResultPayload,
  canCompleteOperation,
  createConsultationContext,
  getConsultationPresentation,
  getConsultationSaveState,
  getConsultationSignature,
  getConsultationSource,
  getCustomerOperationalStatus,
  getCustomerPrimaryAction,
  isConsultationResultCurrent
} from "../../frontend/js/consultation-state.js";

const currentContext = createConsultationContext({
  customerId: "KH-1",
  draftId: "OD-1",
  sessionCode: "PC-1"
});

test("camera confirmed returns visionid_camera", () => {
  const source = getConsultationSource({
    confirmedFaceShape: "oval",
    analysis: { diagnostics: { scanMode: "center-burst-primary" } },
    resultContext: currentContext,
    currentContext
  });

  assert.equal(source.valid, true);
  assert.equal(source.source, CONSULTATION_SOURCES.CAMERA);
});

test("image confirmed returns visionid_image", () => {
  const source = getConsultationSource({
    confirmedFaceShape: "round",
    analysis: { diagnostics: { imageSource: "upload", scanMode: "static-image-primary" } },
    resultContext: currentContext,
    currentContext
  });

  assert.equal(source.valid, true);
  assert.equal(source.source, CONSULTATION_SOURCES.IMAGE);
});

test("manual confirmed returns manual without creating a fake face shape", () => {
  const source = getConsultationSource({
    manualConsultationMode: true,
    manualConfirmed: true,
    resultContext: currentContext,
    currentContext
  });
  const payload = buildConsultationResultPayload({
    source,
    confirmedFaceShape: "diamond",
    recommendations: [{ name: "Oval can bang", reason: "Can bang ti le" }]
  });

  assert.equal(source.source, CONSULTATION_SOURCES.MANUAL);
  assert.equal(payload.confirmedFaceShape, "");
});

test("missing source, camera opened, or image selected without confirmation returns none", () => {
  assert.equal(getConsultationSource({ currentContext }).source, CONSULTATION_SOURCES.NONE);
  assert.equal(getConsultationSource({ cameraActive: true, currentContext }).source, CONSULTATION_SOURCES.NONE);
  assert.equal(getConsultationSource({ imageAnalysisState: "loaded", currentContext }).source, CONSULTATION_SOURCES.NONE);
});

test("previous customer or mismatched draft is not current", () => {
  assert.equal(isConsultationResultCurrent({
    resultContext: { ...currentContext, customerId: "KH-2" },
    currentContext
  }), false);
  assert.equal(isConsultationResultCurrent({
    resultContext: { ...currentContext, draftId: "OD-OLD" },
    currentContext
  }), false);
  assert.equal(getConsultationSource({
    confirmedFaceShape: "oval",
    analysis: { diagnostics: {} },
    resultContext: { ...currentContext, customerId: "KH-2" },
    currentContext
  }).source, CONSULTATION_SOURCES.NONE);
});

test("persisted result can be current without a draft id when customer and session match", () => {
  assert.equal(isConsultationResultCurrent({
    resultContext: { customerId: "KH-1", sessionCode: "PC-1" },
    currentContext,
    allowMissingDraft: true
  }), true);
});

test("presentation promotes first recommendation and limits alternatives", () => {
  const presentation = getConsultationPresentation([
    { name: "A", reason: "main" },
    { name: "B", reason: "alt 1" },
    { name: "C", reason: "alt 2" },
    { name: "D", reason: "hidden" }
  ], { valid: true, source: CONSULTATION_SOURCES.CAMERA, limitation: "No mm" });

  assert.equal(presentation.primary.name, "A");
  assert.deepEqual(presentation.alternatives.map((item) => item.name), ["B", "C"]);
  assert.deepEqual(presentation.hiddenRecommendations.map((item) => item.name), ["D"]);
});

test("empty recommendation returns safe empty state", () => {
  const presentation = getConsultationPresentation([], {
    valid: true,
    source: CONSULTATION_SOURCES.MANUAL,
    limitation: "Manual"
  });

  assert.equal(presentation.empty, true);
  assert.match(presentation.reason, /Chua co goi y/);
});

test("camera and image limitations do not claim physical measurement", () => {
  assert.match(getConsultationSource({
    confirmedFaceShape: "oval",
    analysis: { diagnostics: {} },
    resultContext: currentContext,
    currentContext
  }).limitation, /khong phai phep do kich thuoc vat ly/);
  assert.match(getConsultationSource({
    confirmedFaceShape: "oval",
    analysis: { diagnostics: { imageSource: "upload" } },
    resultContext: currentContext,
    currentContext
  }).limitation, /anh tinh/);
});

test("invalid source or stale recommendation cannot save", () => {
  assert.equal(buildConsultationResultPayload({
    source: { valid: false, source: CONSULTATION_SOURCES.NONE },
    recommendations: [{ name: "A" }]
  }), null);
  assert.equal(buildConsultationResultPayload({
    source: { valid: true, source: CONSULTATION_SOURCES.CAMERA },
    recommendations: []
  }), null);
});

test("payload stores only business summary and blocks image, landmark, mesh, and debug fields", () => {
  const payload = buildConsultationResultPayload({
    source: { valid: true, source: CONSULTATION_SOURCES.CAMERA },
    confirmedFaceShape: "oval",
    recommendations: [{
      name: "Oval",
      reason: "Can bang",
      image: "data:image/png;base64,abc",
      landmarks: [{ x: 1 }],
      debugScore: 0.7
    }],
    lensRecommendations: [{ name: "1.67", mesh: [1, 2] }],
    needsSnapshot: { purpose: "daily", userAgent: "blocked" },
    prescriptionSnapshot: { pd: "62", sph: "-3.00" },
    savedAt: "2026-07-30T00:00:00.000Z"
  });

  assert.equal(payload.confirmedFaceShape, "oval");
  assert.equal(payload.primaryFrameRecommendation.name, "Oval");
  assert.equal("image" in payload.primaryFrameRecommendation, false);
  assert.equal("landmarks" in payload.primaryFrameRecommendation, false);
  assert.equal("debugScore" in payload.primaryFrameRecommendation, false);
  assert.equal("mesh" in payload.lensRecommendations[0], false);
  assert.equal("userAgent" in payload.needsSnapshot, false);
});

test("save state differentiates unsaved, saved, update required, saving, and errors", () => {
  const source = { valid: true };
  const signature = "abc";
  assert.equal(getConsultationSaveState({ source, currentSignature: signature }).state, CONSULTATION_SAVE_STATES.UNSAVED);
  assert.equal(getConsultationSaveState({ source, currentSignature: signature, savedSignature: signature }).state, CONSULTATION_SAVE_STATES.SAVED);
  assert.equal(getConsultationSaveState({ source, currentSignature: "new", savedSignature: signature }).state, CONSULTATION_SAVE_STATES.UPDATE_REQUIRED);
  assert.equal(getConsultationSaveState({ saving: true }).state, CONSULTATION_SAVE_STATES.SAVING);
  assert.equal(getConsultationSaveState({ error: "quota" }).state, CONSULTATION_SAVE_STATES.ERROR);
});

test("feedback and measured actions do not complete operation by themselves", () => {
  assert.deepEqual(canCompleteOperation({
    customerExists: true,
    source: { valid: false },
    contextMatches: true
  }), { allowed: false, reason: "CONSULTATION_SOURCE_REQUIRED" });
  assert.equal(canCompleteOperation({
    customerExists: true,
    source: { valid: true },
    contextMatches: true
  }).allowed, true);
});

test("customer operational statuses and actions follow saved data", () => {
  assert.equal(getCustomerOperationalStatus({
    customer_code: "KH-1",
    customer_status: "measured"
  }).status, CUSTOMER_OPERATIONAL_STATUSES.MEASURED);
  assert.equal(getCustomerOperationalStatus({
    customer_code: "KH-1",
    consultation_result: { savedAt: "2026-07-30T00:00:00.000Z" }
  }).status, CUSTOMER_OPERATIONAL_STATUSES.RESULT_SAVED);
  assert.equal(getCustomerOperationalStatus({
    customer_code: "KH-1"
  }, { customerId: "KH-1" }).status, CUSTOMER_OPERATIONAL_STATUSES.DRAFT);
  assert.equal(getCustomerPrimaryAction({
    customer_code: "KH-1",
    consultation_result: { savedAt: "2026-07-30T00:00:00.000Z" }
  }).label, "Xem ket qua");
});

test("consultation signature changes when recommendation changes", () => {
  const source = { valid: true, source: CONSULTATION_SOURCES.CAMERA };
  const first = buildConsultationResultPayload({
    source,
    recommendations: [{ name: "A" }]
  });
  const second = buildConsultationResultPayload({
    source,
    recommendations: [{ name: "B" }]
  });

  assert.notEqual(getConsultationSignature(first), getConsultationSignature(second));
});
