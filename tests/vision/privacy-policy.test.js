import test from "node:test";
import assert from "node:assert/strict";

import {
  isExplicitConsentGranted,
  purgeStoredVisionAnalysis
} from "../../frontend/js/vision/privacy-policy.js";

test("requires explicit true for analysis persistence consent", () => {
  assert.equal(isExplicitConsentGranted(true), true);
  assert.equal(isExplicitConsentGranted("true"), true);
  assert.equal(isExplicitConsentGranted(" TRUE "), true);

  assert.equal(isExplicitConsentGranted(false), false);
  assert.equal(isExplicitConsentGranted("false"), false);
  assert.equal(isExplicitConsentGranted(" FALSE "), false);
  assert.equal(isExplicitConsentGranted(null), false);
  assert.equal(isExplicitConsentGranted(undefined), false);
  assert.equal(isExplicitConsentGranted(1), false);
  assert.equal(isExplicitConsentGranted("yes"), false);
});

test("purges stored VisionID analysis after true consent is revoked to false", () => {
  const customer = {
    customer_name: "Test customer",
    analysis: { metrics: { lengthToWidth: 1.4 }, diagnostics: { centerBurst: {} } },
    diagnostics: { confidenceBand: "Cao" },
    top_candidates: [{ shape: "oval" }],
    capture_quality: { passed: true },
    confidence: 0.82,
    confidence_level: "high",
    faceShape_confirmed: "oval",
    preferences: { purpose: "daily" }
  };

  const purged = purgeStoredVisionAnalysis(customer);

  assert.equal("analysis" in purged, false);
  assert.equal("diagnostics" in purged, false);
  assert.equal("top_candidates" in purged, false);
  assert.equal("capture_quality" in purged, false);
  assert.equal("confidence" in purged, false);
  assert.equal("confidence_level" in purged, false);
  assert.equal(purged.customer_name, "Test customer");
  assert.equal(purged.faceShape_confirmed, "oval");
  assert.deepEqual(purged.preferences, { purpose: "daily" });
});

test("purges stored VisionID analysis after string consent changes to false", () => {
  const customer = {
    latestAnalysis: { quality: { confidence: 0.7 } },
    analysis: { diagnostics: { warnings: ["nested"] } },
    customer_notes: "keep"
  };

  assert.equal(isExplicitConsentGranted("true"), true);
  assert.equal(isExplicitConsentGranted("false"), false);

  const purged = purgeStoredVisionAnalysis(customer);
  assert.equal("latestAnalysis" in purged, false);
  assert.equal("analysis" in purged, false);
  assert.equal(purged.customer_notes, "keep");
});

test("purge is idempotent when consent is already false", () => {
  const customer = {
    customer_code: "KH-1",
    faceShape_confirmed: "manual"
  };

  const once = purgeStoredVisionAnalysis(customer);
  const twice = purgeStoredVisionAnalysis(once);

  assert.deepEqual(twice, once);
});

test("purge handles profiles without latest analysis", () => {
  const customer = {
    customer_name: "No analysis",
    preferences: { budget: "balanced" }
  };

  assert.deepEqual(purgeStoredVisionAnalysis(customer), customer);
});

test("purge keeps unrelated customer, prescription, notes, and consultation data", () => {
  const customer = {
    customer_phone: "0900000000",
    prescription: { sph: -2.5, cyl: -0.5 },
    customer_notes: "keep notes",
    recommendations: [{ name: "Oval" }],
    lens_recommendations: [{ index: "1.67" }],
    analysis: { metrics: { nested: { value: 1 } } }
  };

  const purged = purgeStoredVisionAnalysis(customer);

  assert.equal("analysis" in purged, false);
  assert.equal(purged.customer_phone, "0900000000");
  assert.deepEqual(purged.prescription, { sph: -2.5, cyl: -0.5 });
  assert.equal(purged.customer_notes, "keep notes");
  assert.deepEqual(purged.recommendations, [{ name: "Oval" }]);
  assert.deepEqual(purged.lens_recommendations, [{ index: "1.67" }]);
});

test("purge handles nested analysis and profiles without prior consent flag", () => {
  const customer = {
    analysis: {
      quality: { confidence: 0.8 },
      diagnostics: {
        classification: {
          candidates: [{ shape: "diamond" }]
        }
      }
    },
    faceShape_ai: "diamond",
    faceShape_confirmed: "oval"
  };

  const purged = purgeStoredVisionAnalysis(customer);

  assert.equal("analysis" in purged, false);
  assert.equal(purged.faceShape_ai, "diamond");
  assert.equal(purged.faceShape_confirmed, "oval");
});
