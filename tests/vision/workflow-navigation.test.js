import test from "node:test";
import assert from "node:assert/strict";

import { canEnterStep, getNextWorkflowAction } from "../../frontend/js/workflow-state.js";

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
