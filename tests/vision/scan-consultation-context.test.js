import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConsultationContext,
  updateConsultationContextRanking
} from "../../frontend/js/scan-consultation-context.js";

const base = {
  scanId: "scan-1",
  sessionId: "session-1",
  legacyFaceShape: "oval",
  legacyConfidence: 0.8
};

test("same legacy shape produces different advice for meaningfully different geometry", () => {
  const longBroad = buildConsultationContext({
    ...base,
    faceMetrics: { lengthToWidth: 1.58, jawToCheek: 0.93, foreheadToCheek: 0.94 }
  });
  const shortNarrow = buildConsultationContext({
    ...base,
    faceMetrics: { lengthToWidth: 1.22, jawToCheek: 0.79, foreheadToCheek: 0.98 }
  });

  assert.notEqual(longBroad.headline, shortNarrow.headline);
  assert.notDeepEqual(longBroad.adviceBullets, shortNarrow.adviceBullets);
});

test("identical scan inputs produce deterministic identical advice", () => {
  const input = { ...base, faceMetrics: { lengthToWidth: 1.36, jawToCheek: 0.86, foreheadToCheek: 0.93 } };
  const first = buildConsultationContext(input);
  const second = buildConsultationContext(input);

  assert.equal(first.headline, second.headline);
  assert.deepEqual(first.adviceBullets, second.adviceBullets);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.traits), true);
});

test("new scan creates a new context without previous advice", () => {
  const first = buildConsultationContext({ ...base, faceMetrics: { lengthToWidth: 1.58 } });
  const second = buildConsultationContext({ ...base, scanId: "scan-2", faceMetrics: { jawToCheek: 0.79 } });

  assert.notEqual(first.scanId, second.scanId);
  assert.equal(second.traits.some((trait) => trait.metric === "lengthToWidth"), false);
  assert.equal(second.adviceBullets.some((bullet) => bullet.includes("1.58")), false);
});

test("cheek signal cannot overwrite stronger long and broad traits", () => {
  const context = buildConsultationContext({
    ...base,
    faceMetrics: { lengthToWidth: 1.6, jawToCheek: 0.94, foreheadToCheek: 0.86 }
  });

  assert.equal(context.headline, "Cân bằng chiều dài và làm mềm đường hàm");
  assert.notEqual(context.headline, "Cân bằng vùng gò má và phần hàm");
});

test("stale ranking cannot update a newer scan context", () => {
  const current = buildConsultationContext({ ...base, scanId: "scan-2" });
  const stale = updateConsultationContextRanking(current, {
    scanId: "scan-1",
    rankedTopProducts: [{ frame: { sku: "STALE" } }]
  });
  const fresh = updateConsultationContextRanking(current, {
    scanId: "scan-2",
    rankedTopProducts: [{ frame: { sku: "CURRENT" } }]
  });

  assert.equal(stale, current);
  assert.equal(fresh.rankedTopProducts[0].frame.sku, "CURRENT");
});

test("ranking context preserves the frozen deduplicated Top 3 order", () => {
  const current = buildConsultationContext({ ...base, scanId: "scan-2" });
  const ranked = ["A", "B", "C"].map((sku) => ({ frame: { sku } }));
  const updated = updateConsultationContextRanking(current, {
    scanId: "scan-2",
    rankedTopProducts: ranked
  });

  assert.deepEqual(updated.rankedTopProducts.map((item) => item.frame.sku), ["A", "B", "C"]);
  assert.deepEqual(ranked.map((item) => item.frame.sku), ["A", "B", "C"]);
});

test("missing metrics produce reduced safe advice and keep V3 diagnostic only", () => {
  const context = buildConsultationContext({
    ...base,
    faceMetrics: { lengthToWidth: 1.4 },
    v3Shadow: { v3Label: "heart", v3TopProbability: 0.72 }
  });

  assert.equal(context.traits.length, 1);
  assert.equal(context.adviceBullets.length, 1);
  assert.equal(context.v3.label, "heart");
  assert.equal(context.headline.includes("heart"), false);
});
