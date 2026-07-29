import test from "node:test";
import assert from "node:assert/strict";

import {
  parseOptionalFiniteNumber,
  validateNeedsState,
  validatePrescriptionState,
  validateProfileState
} from "../../frontend/js/operation-validation.js";

test("profile requires customer name before workflow navigation", () => {
  const result = validateProfileState({ customerName: "", customerPhone: "0911515000" });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, "CUSTOMER_NAME_REQUIRED");
});

test("prescription is ignored until hasPrescription is checked", () => {
  const result = validatePrescriptionState({ hasPrescription: false, pd: "-", sph: "x", cyl: "y" });
  assert.equal(result.valid, true);
});

test("prescription validates PD and numeric fields when enabled", () => {
  const missing = validatePrescriptionState({ hasPrescription: true, pd: "", sph: "", cyl: "" });
  assert.equal(missing.valid, false);
  assert.equal(missing.errors[0].code, "PD_REQUIRED");

  const invalid = validatePrescriptionState({ hasPrescription: true, pd: "62", sph: "-3.50", cyl: "bad" });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors[0].code, "CYL_INVALID");
});

test("duplicate blocker prevents profile from passing", () => {
  const result = validateProfileState({ customerName: "Bui Dang Toan", duplicateBlocked: true });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, "DUPLICATE_PHONE_BLOCKED");
});

test("needs requires the three quick selections", () => {
  const result = validateNeedsState({ budget: "medium", purpose: "", framePreference: "balanced" });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].field, "purpose");
});

test("parseOptionalFiniteNumber handles comma decimal safely", () => {
  assert.deepEqual(parseOptionalFiniteNumber("-1,25"), { empty: false, valid: true, value: -1.25 });
  assert.equal(parseOptionalFiniteNumber("abc").valid, false);
});
