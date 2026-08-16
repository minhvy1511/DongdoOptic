import test from "node:test";
import assert from "node:assert/strict";

import { fetchFrameProducts, rankFrameProducts } from "../../frontend/js/frame-ranking.js";

const baseFrame = Object.freeze({
  available: true,
  stock: 1,
  shape: "rounded-square",
  material: "TR90",
  rim_type: "full-rim",
  lens_width_mm: 50,
  lens_height_mm: 38,
  bridge_width_mm: 18,
  frame_width_mm: 135,
  price: 600000,
  style_tags: ["daily", "office", "lightweight"]
});

const customer = Object.freeze({
  budget: "low",
  purpose: "daily",
  prescription: { pd: 62 }
});

const vision = Object.freeze({
  faceShape: "round",
  faceShapeConfidence: 0.85
});

test("fetchFrameProducts returns cloned item array from the API contract", async () => {
  const products = [{ sku: "DEMO-001" }];
  const result = await fetchFrameProducts({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ items: products, count: 1 })
    })
  });

  assert.deepEqual(result, products);
  assert.notEqual(result[0], products[0]);
});

test("fetchFrameProducts rejects invalid response shape", async () => {
  await assert.rejects(
    () => fetchFrameProducts({
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ items: {}, count: 0 })
      })
    }),
    /items array/
  );
});

test("eligible products are sorted descending by score", () => {
  const ranked = rankFrameProducts([
    { ...baseFrame, sku: "DEMO-PREMIUM", price: 1900000, material: "acetate", style_tags: ["fashion"] },
    { ...baseFrame, sku: "DEMO-AFFORDABLE", price: 520000 }
  ], customer, vision);

  assert.equal(ranked[0].frame.sku, "DEMO-AFFORDABLE");
  assert.ok(ranked[0].totalScore >= ranked[1].totalScore);
});

test("unavailable product does not appear in Top N", () => {
  const ranked = rankFrameProducts([
    { ...baseFrame, sku: "DEMO-OFF", available: false },
    { ...baseFrame, sku: "DEMO-ON" }
  ], customer, vision, { topN: 5 });

  assert.deepEqual(ranked.map((item) => item.frame.sku), ["DEMO-ON"]);
});

test("default returns Top 3", () => {
  const frames = ["A", "B", "C", "D"].map((suffix, index) => ({
    ...baseFrame,
    sku: `DEMO-${suffix}`,
    price: 520000 + index * 10000
  }));

  const ranked = rankFrameProducts(frames, customer, vision);

  assert.equal(ranked.length, 3);
  assert.deepEqual(ranked.map((item) => item.rank), [1, 2, 3]);
});

test("tie-break is deterministic by confidence then SKU", () => {
  const frames = [
    { ...baseFrame, sku: "DEMO-B" },
    { ...baseFrame, sku: "DEMO-A" }
  ];

  const ranked = rankFrameProducts(frames, customer, vision, { topN: 2 });

  assert.deepEqual(ranked.map((item) => item.frame.sku), ["DEMO-A", "DEMO-B"]);
});

test("input array and frame objects are not mutated", () => {
  const frames = [
    { ...baseFrame, sku: "DEMO-A" },
    { ...baseFrame, sku: "DEMO-B", available: false }
  ];
  const before = JSON.stringify(frames);

  const ranked = rankFrameProducts(frames, customer, vision, { topN: 2 });
  ranked[0].frame.sku = "MUTATED";

  assert.equal(JSON.stringify(frames), before);
});
