import test from "node:test";
import assert from "node:assert/strict";

import {
  CHEEK_WARNING_CONFIDENCE_MIN,
  CHEEK_WARNING_THRESHOLD,
  buildRecommendationDiagnostics,
  getFitGuidance
} from "../../frontend/js/recommendations.js";

const baseMetrics = {
  lengthToWidth: 1.36,
  foreheadToCheek: 0.92,
  jawToCheek: 0.86,
  cheekToJaw: 1.08
};

test("recommendation diagnostics keep generic fitting separate from personalized cheek advice", () => {
  const diagnostics = buildRecommendationDiagnostics({
    metrics: baseMetrics,
    confidence: 0.9,
    classification: { winningLabel: "oval", secondLabel: "round", scoreMargin: 0.18 }
  });

  assert.equal(diagnostics.cheekWarningTriggered, false);
  assert.deepEqual(diagnostics.personalizedAdvice, []);
  assert.ok(diagnostics.genericAdvice.length > 0);
  assert.equal(diagnostics.winningFaceLabel, "oval");
  assert.equal(diagnostics.secondFaceLabel, "round");
});

test("personalized cheek warning requires valid metric and minimum confidence", () => {
  const lowConfidence = buildRecommendationDiagnostics({
    metrics: { ...baseMetrics, cheekToJaw: CHEEK_WARNING_THRESHOLD + 0.02 },
    confidence: CHEEK_WARNING_CONFIDENCE_MIN - 0.01
  });
  const accepted = buildRecommendationDiagnostics({
    metrics: { ...baseMetrics, cheekToJaw: CHEEK_WARNING_THRESHOLD + 0.02 },
    confidence: CHEEK_WARNING_CONFIDENCE_MIN
  });

  assert.equal(lowConfidence.cheekWarningTriggered, false);
  assert.deepEqual(lowConfidence.personalizedAdvice, []);
  assert.equal(accepted.cheekWarningTriggered, true);
  assert.equal(accepted.recommendationRuleIds.includes("CHEEK_PROMINENCE_PERSONALIZED"), true);
  assert.ok(accepted.personalizedAdvice.length > 0);
});

test("missing or invalid metrics never trigger personalized cheek warning", () => {
  for (const value of [undefined, null, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
    const diagnostics = buildRecommendationDiagnostics({
      metrics: { ...baseMetrics, cheekToJaw: value },
      confidence: 0.95
    });

    assert.equal(diagnostics.cheekWarningTriggered, false);
    assert.equal(diagnostics.personalizedAdvice.length, 0);
    assert.match(diagnostics.invalidRecommendationMetric, /cheekToJaw/);
  }
});

test("recommendation diagnostics do not inherit state between scans", () => {
  const cheekScan = buildRecommendationDiagnostics({
    metrics: { ...baseMetrics, cheekToJaw: CHEEK_WARNING_THRESHOLD + 0.04 },
    confidence: 0.9
  });
  const neutralScan = buildRecommendationDiagnostics({
    metrics: baseMetrics,
    confidence: 0.9
  });

  assert.equal(cheekScan.cheekWarningTriggered, true);
  assert.equal(neutralScan.cheekWarningTriggered, false);
  assert.deepEqual(neutralScan.personalizedAdvice, []);
});

test("fit guidance does not surface cheek-specific copy unless the metric rule is active", () => {
  const neutralNotes = getFitGuidance({
    faceShape: "diamond",
    metrics: baseMetrics
  });
  const cheekNotes = getFitGuidance({
    faceShape: "diamond",
    metrics: { ...baseMetrics, cheekToJaw: 1.18 }
  });

  assert.equal(neutralNotes.some((note) => /gò má|go ma/i.test(note)), false);
  assert.equal(cheekNotes.some((note) => /gò má|go ma/i.test(note)), true);
});
