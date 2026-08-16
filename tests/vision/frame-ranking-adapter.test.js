import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFrameScoringProfiles,
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
      quality: { confidence: 0.82 }
    },
    confirmedFaceShape: "oval"
  });

  assert.deepEqual(profiles.customerProfile.prescription, { pd: 62, sph: -3.5, cyl: -1 });
  assert.equal(profiles.customerProfile.budget, "medium");
  assert.equal(profiles.customerProfile.purpose, "daily");
  assert.equal(profiles.customerProfile.frame_preference, "light");
  assert.equal(profiles.visionProfile.faceShape, "oval");
  assert.equal(profiles.visionProfile.faceShapeConfidence, 0.82);
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
    fetchCatalog: async () => catalog
  });

  assert.equal(result.status, "ready");
  assert.equal(result.topProducts.length, 3);
  assert.equal(result.topProducts.every((item) => item.eligible), true);
  assert.equal(result.topSkus.includes("DEMO-005"), false);
  assert.deepEqual(result.legacyRecommendations, ["Legacy oval"]);
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
