import assert from "node:assert/strict";
import test from "node:test";

import { buildDiversityShadowTop3 } from "../../frontend/js/frame-diversity-shadow.js";
import { createFrameRankingRequestGuard } from "../../frontend/js/frame-ranking-adapter.js";


test("same scan produces deterministic diversity Top 3", () => {
  const first = buildDiversityShadowTop3(closeRanking(), { scanId: "scan-1" });
  const second = buildDiversityShadowTop3(closeRanking(), { scanId: "scan-1" });
  assert.deepEqual(skus(first.diversityTop3), skus(second.diversityTop3));
});

test("different scan IDs can rotate equivalent products", () => {
  const outcomes = new Set();
  for (let index = 0; index < 20; index += 1) {
    outcomes.add(skus(buildDiversityShadowTop3(closeRanking(), { scanId: `scan-${index}` }).diversityTop3).join("|"));
  }
  assert.ok(outcomes.size > 1);
});

test("materially worse product cannot displace close candidates", () => {
  const result = buildDiversityShadowTop3([
    ranked("A", "A", 100), ranked("B", "B", 99.9), ranked("C", "C", 99), ranked("POOR", "Poor", 80)
  ], { scanId: "scan-poor" });
  assert.equal(skus(result.diversityTop3).includes("POOR"), false);
});

test("candidates outside the quality band fill in frozen ranking order", () => {
  const result = buildDiversityShadowTop3([
    ranked("A", "A", 100), ranked("B", "B", 90), ranked("C", "C", 80), ranked("D", "D", 70)
  ], { scanId: "fallback-order" });
  assert.deepEqual(skus(result.diversityTop3), ["A", "B", "C"]);
});

test("slot one always stays within 0.3 of best", () => {
  for (let index = 0; index < 20; index += 1) {
    const result = buildDiversityShadowTop3(closeRanking(), { scanId: `scan-${index}` });
    assert.ok(100 - result.diversityTop3[0].totalScore <= 0.3);
  }
});

test("slots two and three respect both quality limits when enough candidates exist", () => {
  const result = buildDiversityShadowTop3(closeRanking(), { scanId: "quality-band" });
  for (const item of result.diversityTop3.slice(1)) {
    assert.ok(item.totalScore >= 98);
    assert.ok(100 - item.totalScore <= 1.5);
  }
});

test("model and geometry deduplication happen before rotation", () => {
  const result = buildDiversityShadowTop3([
    ranked("A-RED", "Same Model", 100),
    ranked("A-BLUE", "Same Model", 99.9),
    ranked("B", "", 99.8, { shape: "round", lens_width_mm: 50, bridge_width_mm: 18, frame_width_mm: 136 }),
    ranked("B2", "", 99.7, { shape: "round", lens_width_mm: 50, bridge_width_mm: 18, frame_width_mm: 136 }),
    ranked("C", "C", 99.6)
  ], { scanId: "dedup" });
  assert.equal(result.diversityTop3.filter((item) => item.frame.model === "Same Model").length, 1);
  assert.equal(result.diversityTop3.filter((item) => item.frame.shape === "round").length, 1);
});

test("stale request cannot overwrite current diversity shadow", () => {
  const guard = createFrameRankingRequestGuard();
  const stale = guard.begin();
  const current = guard.begin();
  let rendered = "";
  if (guard.isCurrent(current)) rendered = "CURRENT";
  if (guard.isCurrent(stale)) rendered = "STALE";
  assert.equal(rendered, "CURRENT");
});

test("customer-facing frozen Top 3 remains unchanged", () => {
  const rankedProducts = closeRanking();
  const result = buildDiversityShadowTop3(rankedProducts, { scanId: "rotation" });
  assert.deepEqual(skus(result.frozenTop3), ["A", "B", "C"]);
  assert.deepEqual(rankedProducts.map((item) => item.frame.sku), ["A", "B", "C", "D", "E"]);
  assert.deepEqual(rankedProducts.map((item) => item.totalScore), [100, 99.9, 99.6, 98.6, 90]);
});


function closeRanking() {
  return [
    ranked("A", "A", 100),
    ranked("B", "B", 99.9),
    ranked("C", "C", 99.6),
    ranked("D", "D", 98.6),
    ranked("E", "E", 90)
  ];
}

function ranked(sku, model, totalScore, frame = {}) {
  return {
    frame: { sku, model, name: model || sku, available: true, ...frame },
    eligible: true,
    totalScore,
    confidence: "medium",
    components: { faceCompatibility: 18 },
    reasons: [],
    warnings: []
  };
}

function skus(items) {
  return items.map((item) => item.frame.sku);
}
