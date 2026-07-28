import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConsentScopedVisionFeedback,
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

test("feedback payload omits VisionID analysis fields without consent", () => {
  const payload = buildConsentScopedVisionFeedback({
    includeVisionAnalysis: false,
    latestAnalysis: { quality: { confidence: 0.81 } },
    diagnostics: { warnings: ["keep only with consent"] },
    classification: { candidates: [{ shape: "oval" }] },
    qualityGate: { passed: true }
  });

  assert.equal("confidence" in payload, false);
  assert.equal("confidence_level" in payload, false);
  assert.equal("top_candidates" in payload, false);
  assert.equal("capture_quality" in payload, false);
  assert.equal("diagnostics" in payload, false);
});

test("feedback payload includes only allowed summarized VisionID fields with consent", () => {
  const payload = buildConsentScopedVisionFeedback({
    includeVisionAnalysis: true,
    latestAnalysis: { quality: { confidence: 0.81 } },
    confidenceState: { level: "high" },
    diagnostics: {
      warnings: ["one", "two", "three", "four", "five", "six", "seven"],
      confidenceComponents: { landmarkQuality: 0.8 },
      confidenceBand: "Cao",
      centerBurst: { sampleCount: 12, totalSamples: 24 },
      scanMode: "center-burst-primary"
    },
    classification: {
      calibrationSource: "rule-based",
      candidates: [
        { shape: "oval", score: 0.8 },
        { shape: "long", score: 0.6 },
        { shape: "round", score: 0.4 },
        { shape: "diamond", score: 0.2 }
      ]
    },
    qualityGate: {
      passed: true,
      score: 0.9,
      failedLabels: [],
      checks: [{ key: "pose", passed: true }]
    }
  });

  assert.equal(payload.confidence, 0.81);
  assert.equal(payload.confidence_level, "high");
  assert.equal(payload.top_candidates.length, 3);
  assert.equal(payload.capture_quality.passed, true);
  assert.equal(payload.capture_quality.checks.length, 1);
  assert.equal(payload.diagnostics.warnings.length, 6);
  assert.equal(payload.diagnostics.confidenceBand, "Cao");
  assert.deepEqual(payload.diagnostics.centerBurst, { sampleCount: 12, totalSamples: 24 });
});
