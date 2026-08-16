import test from "node:test";
import assert from "node:assert/strict";

import { canEnterStep, getNextWorkflowAction } from "../../frontend/js/workflow-state.js";
import { validateProfileSaveState } from "../../frontend/js/operation-validation.js";

const validProfile = { valid: true, errors: [] };
const validNeeds = { valid: true, errors: [] };

test("workflow navigation follows profile to needs to VisionID", () => {
  const fromProfile = getNextWorkflowAction({
    currentStep: "profile",
    profileValidation: validProfile,
    needsValidation: validNeeds
  });
  assert.equal(fromProfile.targetStep, "needs");
  assert.equal(canEnterStep(fromProfile.targetStep, {
    currentStep: "profile",
    profileValidation: validProfile,
    needsValidation: validNeeds
  }).allowed, true);

  const fromNeeds = getNextWorkflowAction({
    currentStep: "needs",
    profileValidation: validProfile,
    needsValidation: validNeeds
  });
  assert.equal(fromNeeds.targetStep, "visionid");
});

test("workflow navigation does not enter consultation from stale or missing analysis", () => {
  const gate = canEnterStep("consultation", {
    currentStep: "visionid",
    profileValidation: validProfile,
    needsValidation: validNeeds,
    confirmedFaceShape: "",
    analysisState: "idle"
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, "CONSULTATION_SOURCE_REQUIRED");
});

test("workflow navigation allows consultation after manual confirmation only", () => {
  const gate = canEnterStep("consultation", {
    currentStep: "visionid",
    profileValidation: validProfile,
    needsValidation: validNeeds,
    manualConsultationMode: true
  });
  assert.equal(gate.allowed, true);
});

test("mobile profile transition leaves duplicate handling to the save dialog", () => {
  const profileValidation = validateProfileSaveState({
    customerName: "Nguyen Van A",
    duplicateBlocked: true
  });
  const gate = canEnterStep("needs", {
    currentStep: "profile",
    profileValidation
  });
  let duplicateDialogCalled = false;

  if (gate.allowed) {
    duplicateDialogCalled = true;
  }

  assert.equal(gate.allowed, true);
  assert.notEqual(gate.reason, "PROFILE_INVALID");
  assert.equal(duplicateDialogCalled, true);
});

test("mobile profile transition saves normally and unlocks needs", () => {
  const profileValidation = validateProfileSaveState({ customerName: "Nguyen Van B" });
  const gate = canEnterStep("needs", {
    currentStep: "profile",
    profileValidation
  });
  const saved = gate.allowed;

  assert.equal(saved, true);
  assert.equal(gate.allowed, true);
});

test("mobile profile transition still blocks invalid name and PD", () => {
  const invalidName = validateProfileSaveState({ customerName: "" });
  const invalidPd = validateProfileSaveState({
    customerName: "Nguyen Van C",
    hasPrescription: true,
    prescriptionPd: ""
  });

  assert.equal(canEnterStep("needs", {
    currentStep: "profile",
    profileValidation: invalidName
  }).reason, "PROFILE_INVALID");
  assert.equal(invalidName.errors[0].code, "CUSTOMER_NAME_REQUIRED");
  assert.equal(canEnterStep("needs", {
    currentStep: "profile",
    profileValidation: invalidPd
  }).reason, "PROFILE_INVALID");
  assert.equal(invalidPd.errors[0].code, "PD_REQUIRED");
});

test("desktop duplicate save validation remains delegated to its dialog", () => {
  const validation = validateProfileSaveState({
    customerName: "Nguyen Van D",
    duplicateBlocked: true
  });
  assert.equal(validation.valid, true);
});
