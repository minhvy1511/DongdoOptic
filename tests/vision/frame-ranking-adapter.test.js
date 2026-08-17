import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCustomerFrameRecommendations,
  buildFrameScoringProfiles,
  createFrameRankingRequestGuard,
  deduplicateRankedProducts,
  getFrameProductDedupKey,
  resetFrameProductsCache,
  runShadowFrameRanking
} from "../../frontend/js/frame-ranking-adapter.js";


const catalog = [
  availableFrame("DEMO-003", "Demo Ultem", "rectangle", 980000, ["daily", "lightweight"]),
  availableFrame("DEMO-001", "Demo Acetate", "oval", 780000, ["classic", "daily"]),
  availableFrame("DEMO-002", "Demo Titanium", "browline", 1500000, ["office", "premium"]),
  availableFrame("DEMO-004", "Demo Sport", "rounded-square", 620000, ["active", "sport"]),
  { ...availableFrame("DEMO-005", "Unavailable", "round", 500000, ["daily"]), available: false }
];


test("maps representative app state to scoring profiles", () => {
  const profiles = buildFrameScoringProfiles({
    customer: {
      has_prescription: true,
      frame_width_mm: 136,
      prescription: { pd: 62, sph: -3.5, cyl: -1 }
    },
    preferences: {
      budget: "medium",
      purpose: "daily",
      frame_preference: "light",
      lens_width_mm: 51,
      bridge_width_mm: 18,
      brands: ["Demo"]
    },
    visionAnalysis: {
      faceShape_ai: "oval",
      quality: { confidence: 0.82 },
      metrics: {
        lengthToWidth: 1.41,
        jawToCheek: 0.86,
        foreheadToCheek: 0.94,
        jawToForehead: 0.91
      }
    },
    confirmedFaceShape: "oval"
  });

  assert.deepEqual(profiles.customerProfile.prescription, { pd: 62, sph: -3.5, cyl: -1 });
  assert.equal(profiles.customerProfile.budget, "medium");
  assert.equal(profiles.customerProfile.purpose, "daily");
  assert.equal(profiles.customerProfile.frame_preference, "light");
  assert.equal(profiles.visionProfile.faceShape, "oval");
  assert.equal(profiles.visionProfile.faceShapeConfidence, 0.82);
  assert.equal(profiles.visionProfile.lengthToWidth, 1.41);
  assert.equal(profiles.visionProfile.jawToCheek, 0.86);
  assert.equal(profiles.visionProfile.foreheadToCheek, 0.94);
  assert.equal(profiles.visionProfile.jawToForehead, 0.91);
});


test("missing state is not invented by adapter", () => {
  const profiles = buildFrameScoringProfiles({});

  assert.equal("budget" in profiles.customerProfile, false);
  assert.equal("purpose" in profiles.customerProfile, false);
  assert.equal("pd" in profiles.customerProfile, false);
  assert.equal("faceShape" in profiles.visionProfile, false);
  assert.equal("faceShapeConfidence" in profiles.visionProfile, false);
});


test("maps percentage VisionID confidence to scoring confidence", () => {
  const profiles = buildFrameScoringProfiles({
    visionAnalysis: {
      shape: "diamond",
      confidence: 74
    }
  });

  assert.equal(profiles.visionProfile.faceShape, "diamond");
  assert.equal(profiles.visionProfile.faceShapeConfidence, 0.74);
});


test("shadow ranking returns top 3 eligible products", async () => {
  resetFrameProductsCache();
  const result = await runShadowFrameRanking({
    preferences: { budget: "medium", purpose: "daily" },
    visionAnalysis: { faceShape_ai: "oval", quality: { confidence: 0.8 } },
    legacyRecommendations: [{ title: "Legacy oval" }],
    scanId: "scan-shadow-1",
    fetchCatalog: async () => catalog
  });

  assert.equal(result.status, "ready");
  assert.equal(result.topProducts.length, 3);
  assert.equal(result.topProducts.every((item) => item.eligible), true);
  assert.equal(result.topSkus.includes("DEMO-005"), false);
  assert.deepEqual(result.legacyRecommendations, ["Legacy oval"]);
  assert.equal(result.diversityShadow.frozenTop3.length, 3);
  assert.equal(result.diversityShadow.diversityTop3.length, 3);
  assert.equal(result.finalTopProducts.length, 3);
  assert.equal(result.finalSource, "diversity");
});

test("scan-seeded diversity never replaces customer-facing frozen Top 3", async () => {
  resetFrameProductsCache();
  const first = await runShadowFrameRanking({
    scanId: "scan-a",
    fetchCatalog: async () => catalog
  });
  const second = await runShadowFrameRanking({
    scanId: "scan-b",
    fetchCatalog: async () => catalog
  });

  assert.deepEqual(first.topSkus, second.topSkus);
  assert.deepEqual(
    first.topProducts.map((item) => item.frame.sku),
    first.diversityShadow.frozenTop3.map((item) => item.frame.sku)
  );
});

test("customer cards consume the validated final recommendation set", async () => {
  resetFrameProductsCache();
  const result = await runShadowFrameRanking({
    scanId: "scan-final-source",
    fetchCatalog: async () => catalog
  });
  const cards = buildCustomerFrameRecommendations(result, [{ name: "Legacy" }]);
  assert.deepEqual(cards.map((card) => card.sku), result.finalTopSkus);
});

test("diversity exception falls back to frozen Top 3 without emptying ranking", async () => {
  resetFrameProductsCache();
  const result = await runShadowFrameRanking({
    scanId: "scan-selector-error",
    fetchCatalog: async () => catalog,
    selectDiversity: () => { throw new Error("selector failed"); }
  });
  assert.equal(result.status, "ready");
  assert.equal(result.finalSource, "frozen");
  assert.equal(result.diversityShadow.status, "fallback");
  assert.deepEqual(result.finalTopSkus, result.topSkus);
});

test("incomplete or score-mutating diversity result falls back safely", async () => {
  for (const selectDiversity of [
    () => ({ diversityTop3: [] }),
    (ranked) => ({ diversityTop3: ranked.slice(0, 3).map((item, index) => ({
      ...item,
      totalScore: index === 0 ? item.totalScore + 1 : item.totalScore
    })) })
  ]) {
    resetFrameProductsCache();
    const result = await runShadowFrameRanking({
      scanId: "scan-invalid-selector",
      fetchCatalog: async () => catalog,
      selectDiversity
    });
    assert.equal(result.finalSource, "frozen");
    assert.deepEqual(result.finalTopSkus, result.topSkus);
  }
});

test("duplicate model variants collapse before deterministic Top 3", () => {
  const ranked = [
    rankedProduct("A-RED", "Model A", "rectangle", 91),
    rankedProduct("A-BLUE", "Model A", "rectangle", 90),
    rankedProduct("B", "Model B", "oval", 89),
    rankedProduct("C", "Model C", "round", 88)
  ];

  assert.deepEqual(
    deduplicateRankedProducts(ranked, 3).map((item) => item.frame.sku),
    ["A-RED", "B", "C"]
  );
  assert.equal(getFrameProductDedupKey(ranked[0].frame), "model:model a");
});

test("geometry key is used when model is absent", () => {
  assert.equal(getFrameProductDedupKey({
    sku: "A",
    shape: "oval",
    lens_width_mm: 51,
    bridge_width_mm: 18,
    frame_width_mm: 136
  }), "geometry:oval|51|18|136");
});

test("ranked products become customer cards and failure preserves legacy fallback", () => {
  const legacy = [{ name: "Legacy" }];
  const ready = {
    status: "ready",
    topProducts: [rankedProduct("A", "Model A", "oval", 90)]
  };
  assert.equal(buildCustomerFrameRecommendations(ready, legacy)[0].sku, "A");
  assert.equal(buildCustomerFrameRecommendations({ status: "error" }, legacy), legacy);
});

test("customer cards preserve ranking order and expose an actual scoring reason", () => {
  const topProducts = [
    { ...rankedProduct("A", "Model A", "oval", 90), reasons: ["Gọng đang khả dụng để tư vấn."], components: { availability: 15, faceCompatibility: 18, fit: 12.4 } },
    { ...rankedProduct("B", "Model B", "round", 89), reasons: ["Gọng đang khả dụng để tư vấn.", "Chất liệu/phong cách phù hợp nhu cầu sử dụng."], components: { availability: 15, purpose: 13 } },
    { ...rankedProduct("C", "Model C", "square", 88), reasons: [], components: { availability: 15, fit: 17 } }
  ];
  const cards = buildCustomerFrameRecommendations({ status: "ready", topProducts });

  assert.deepEqual(cards.map((card) => card.sku), ["A", "B", "C"]);
  assert.match(cards[0].reason, /tương thích khuôn mặt/);
  assert.equal(cards[1].reason, "Chất liệu/phong cách phù hợp nhu cầu sử dụng.");
  assert.match(cards[2].reason, /fitting/);
  assert.deepEqual(cards[0].ranking.components, topProducts[0].components);
});

test("new ranking request prevents stale customer Top 3 from applying", () => {
  const guard = createFrameRankingRequestGuard();
  const first = guard.begin();
  const second = guard.begin();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
  guard.invalidate();
  assert.equal(guard.isCurrent(second), false);
});


test("catalog fetch failure fails safely without throwing", async () => {
  resetFrameProductsCache();
  const result = await runShadowFrameRanking({
    fetchCatalog: async () => {
      throw new Error("catalog offline");
    }
  });

  assert.equal(result.status, "error");
  assert.equal(result.topProducts.length, 0);
  assert.match(result.error, /catalog offline/);
});


test("shadow failure does not mutate legacy recommendation input", async () => {
  resetFrameProductsCache();
  const legacyRecommendations = [{ title: "Legacy rectangle" }];

  await runShadowFrameRanking({
    legacyRecommendations,
    fetchCatalog: async () => {
      throw new Error("catalog offline");
    }
  });

  assert.deepEqual(legacyRecommendations, [{ title: "Legacy rectangle" }]);
});


function availableFrame(sku, name, shape, price, styleTags) {
  return {
    sku,
    brand: "Demo",
    name,
    shape,
    material: "acetate",
    rim_type: "full-rim",
    lens_width_mm: 51,
    bridge_width_mm: 18,
    price,
    image: "/frontend/assets/demo-frame.svg",
    available: true,
    style_tags: styleTags
  };
}

function rankedProduct(sku, model, shape, totalScore) {
  return {
    frame: {
      sku,
      model,
      name: `${model} ${sku}`,
      shape,
      available: true
    },
    eligible: true,
    totalScore,
    confidence: "medium",
    components: {},
    reasons: ["Ranked reason"],
    warnings: []
  };
}
