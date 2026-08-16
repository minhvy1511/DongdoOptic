import assert from "node:assert/strict";
import test from "node:test";

import { buildFrameRankingDebugSummary } from "../../frontend/js/frame-ranking-debug.js";


test("does not render shadow evaluation when debug is off", () => {
  const output = buildFrameRankingDebugSummary(createShadowResult(), { debugEnabled: false });

  assert.equal(output, "");
});


test("renders top 3, score and confidence when debug is on", () => {
  const output = buildFrameRankingDebugSummary(createShadowResult(), { debugEnabled: true });

  assert.match(output, /Frame Ranking Shadow/);
  assert.match(output, /#1 DEMO-003 - Demo Ultem - 84 - medium/);
  assert.match(output, /#2 DEMO-001 - Demo Acetate - 79 - high/);
  assert.match(output, /#3 DEMO-004 - Demo Sport - 74 - medium/);
});


test("component breakdown uses existing result values", () => {
  const output = buildFrameRankingDebugSummary(createShadowResult(), { debugEnabled: true });

  assert.match(output, /components: availability:15 \| face:12\.5 \| fit:18 \| prescription:10 \| purpose:14 \| budget:9 \| style:5/);
  assert.match(output, /strongest: fit 18 \| weakest: style 5/);
});


test("renders warnings when present", () => {
  const output = buildFrameRankingDebugSummary(createShadowResult(), { debugEnabled: true });

  assert.match(output, /warnings:/);
  assert.match(output, /! Thiếu PD hoặc lens\/bridge nên fit score đang ở mức trung tính\./);
});


test("does not render unrelated customer PII", () => {
  const output = buildFrameRankingDebugSummary({
    ...createShadowResult(),
    profiles: {
      customerProfile: {
        budget: "medium",
        purpose: "daily",
        customer_name: "Nguyen Van A",
        customer_phone: "0912345678",
        address: "private address"
      },
      visionProfile: { faceShape: "oval", faceShapeConfidence: 0.82 }
    }
  }, { debugEnabled: true });

  assert.doesNotMatch(output, /Nguyen Van A/);
  assert.doesNotMatch(output, /0912345678/);
  assert.doesNotMatch(output, /private address/);
});


function createShadowResult() {
  return {
    status: "ready",
    topSkus: ["DEMO-003", "DEMO-001", "DEMO-004"],
    legacyRecommendations: ["Rounded-square", "Browline", "Rectangle"],
    profiles: {
      customerProfile: {
        budget: "medium",
        purpose: "daily",
        frame_preference: "light",
        pd: 62,
        sph: -3.5,
        cyl: -1,
        frame_width_mm: 136,
        lens_width_mm: 51,
        bridge_width_mm: 18
      },
      visionProfile: {
        faceShape: "oval",
        faceShapeConfidence: 0.82
      }
    },
    topProducts: [
      rankedProduct(1, "DEMO-003", "Demo Ultem", 84, "medium", {
        availability: 15,
        faceCompatibility: 12.5,
        fit: 18,
        prescription: 10,
        purpose: 14,
        budget: 9,
        style: 5
      }),
      rankedProduct(2, "DEMO-001", "Demo Acetate", 79, "high"),
      rankedProduct(3, "DEMO-004", "Demo Sport", 74, "medium")
    ]
  };
}


function rankedProduct(rank, sku, name, totalScore, confidence, components = {}) {
  return {
    rank,
    frame: { sku, name },
    totalScore,
    confidence,
    components,
    reasons: ["Giá nằm trong vùng ngân sách đã chọn."],
    warnings: ["Thiếu PD hoặc lens/bridge nên fit score đang ở mức trung tính."]
  };
}
