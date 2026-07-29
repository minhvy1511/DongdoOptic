import test from "node:test";
import assert from "node:assert/strict";

import {
  canEnterStep,
  getConsultationSource,
  getNextWorkflowAction,
  getWorkflowStepState
} from "../../frontend/js/workflow-state.js";

const validProfile = { valid: true, errors: [] };
const validNeeds = { valid: true, errors: [] };

test("profile validation blocks forward workflow navigation", () => {
  const gate = canEnterStep("needs", {
    currentStep: "profile",
    profileValidation: { valid: false, errors: [{ code: "CUSTOMER_NAME_REQUIRED" }] }
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, "PROFILE_INVALID");
});

test("needs validation blocks VisionID entry", () => {
  const gate = canEnterStep("visionid", {
    currentStep: "needs",
    profileValidation: validProfile,
    needsValidation: { valid: false, errors: [{ code: "PURPOSE_REQUIRED" }] }
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, "NEEDS_INVALID");
});

test("consultation requires a confirmed source", () => {
  const gate = canEnterStep("consultation", {
    currentStep: "visionid",
    profileValidation: validProfile,
    needsValidation: validNeeds,
    latestAnalysis: true
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, "CONSULTATION_SOURCE_REQUIRED");
});

test("consultation opens with confirmed VisionID analysis", () => {
  const source = getConsultationSource({
    confirmedFaceShape: "oval",
    analysisState: "analysis_complete"
  });
  assert.equal(source.valid, true);
  assert.equal(source.source, "visionid");
});

test("manual consultation is an explicit valid source", () => {
  const source = getConsultationSource({ manualConsultationMode: true });
  assert.equal(source.valid, true);
  assert.equal(source.source, "manual");
});

test("VisionID action asks for confirmation before consultation when only draft exists", () => {
  const action = getNextWorkflowAction({
    currentStep: "visionid",
    profileValidation: validProfile,
    needsValidation: validNeeds,
    draftFaceShape: "round"
  });
  assert.equal(action.action, "confirm_face_shape");
  assert.equal(action.targetStep, "visionid");
});

test("step state marks future steps locked until gates pass", () => {
  const states = getWorkflowStepState({
    currentStep: "profile",
    hasProfileData: false,
    profileValidation: { valid: false, errors: [{ code: "CUSTOMER_NAME_REQUIRED" }] },
    needsValidation: validNeeds
  });
  assert.equal(states.profile.status, "current");
  assert.equal(states.needs.status, "locked");
  assert.equal(states.visionid.status, "locked");
  assert.equal(states.consultation.status, "locked");
});
