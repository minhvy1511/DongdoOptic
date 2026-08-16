import test from "node:test";
import assert from "node:assert/strict";

import { scoreFrame } from "../../frontend/js/frame-scoring.js";

const affordableFrame = Object.freeze({
  sku: "DEMO-AFFORDABLE",
  available: true,
  stock: 2,
  shape: "rounded-square",
  material: "TR90",
  rim_type: "full-rim",
  lens_width_mm: 50,
  lens_height_mm: 38,
  bridge_width_mm: 18,
  frame_width_mm: 135,
  price: 520000,
  style_tags: ["daily", "office", "lightweight"]
});

const premiumFrame = Object.freeze({
  sku: "DEMO-PREMIUM",
  available: true,
  stock: 2,
  shape: "rounded-square",
  material: "acetate",
  rim_type: "full-rim",
  lens_width_mm: 53,
  lens_height_mm: 43,
  bridge_width_mm: 19,
  frame_width_mm: 142,
  price: 1800000,
  style_tags: ["fashion", "bold", "premium"]
});

test("same face and low budget improves the affordable frame score", () => {
  const customer = { budget: "low", purpose: "daily", prescription: { pd: 62 } };
  const vision = { faceShape: "round", faceShapeConfidence: 0.9 };

  const affordable = scoreFrame(affordableFrame, customer, vision);
  const premium = scoreFrame(premiumFrame, customer, vision);

  assert.ok(affordable.totalScore > premium.totalScore);
  assert.ok(affordable.components.budget > premium.components.budget);
});

test("high prescription prefers technically safer full-rim smaller lenses", () => {
  const highRxCustomer = {
    budget: "medium",
    purpose: "daily",
    has_prescription: true,
    prescription: { pd: 62, sph: -5.5, cyl: -1.25 }
  };
  const saferFrame = {
    ...affordableFrame,
    sku: "DEMO-HIGH-RX-SAFE",
    lens_width_mm: 49,
    lens_height_mm: 36,
    rim_type: "full-rim"
  };
  const riskyFrame = {
    ...premiumFrame,
    sku: "DEMO-HIGH-RX-RISKY",
    lens_width_mm: 56,
    lens_height_mm: 46,
    rim_type: "rimless",
    price: 900000
  };

  const safer = scoreFrame(saferFrame, highRxCustomer, { faceShape: "oval", faceShapeConfidence: 0.85 });
  const risky = scoreFrame(riskyFrame, highRxCustomer, { faceShape: "oval", faceShapeConfidence: 0.85 });

  assert.ok(safer.totalScore > risky.totalScore);
  assert.ok(safer.components.prescription > risky.components.prescription);
  assert.ok(risky.warnings.some((warning) => warning.includes("Đơn cao")));
});

test("low VisionID confidence reduces face compatibility influence", () => {
  const customer = { budget: "medium", purpose: "daily", prescription: { pd: 62 } };
  const compatible = { ...affordableFrame, sku: "DEMO-FACE-COMPATIBLE", shape: "rectangle" };
  const lessCompatible = { ...affordableFrame, sku: "DEMO-FACE-LESS", shape: "round" };

  const highCompatible = scoreFrame(compatible, customer, { faceShape: "round", faceShapeConfidence: 0.95 });
  const highLessCompatible = scoreFrame(lessCompatible, customer, { faceShape: "round", faceShapeConfidence: 0.95 });
  const lowCompatible = scoreFrame(compatible, customer, { faceShape: "round", faceShapeConfidence: 0.2 });
  const lowLessCompatible = scoreFrame(lessCompatible, customer, { faceShape: "round", faceShapeConfidence: 0.2 });

  const highGap = highCompatible.components.faceCompatibility - highLessCompatible.components.faceCompatibility;
  const lowGap = lowCompatible.components.faceCompatibility - lowLessCompatible.components.faceCompatibility;

  assert.ok(highGap > lowGap);
  assert.ok(lowLessCompatible.warnings.some((warning) => warning.includes("VisionID confidence thấp")));
});

test("fit scoring treats narrow and wide PD mismatch symmetrically", () => {
  const customer = { budget: "medium", purpose: "daily", prescription: { pd: 62 } };
  const vision = { faceShape: "oval", faceShapeConfidence: 0.85 };
  const perfectFrame = {
    ...affordableFrame,
    sku: "DEMO-FIT-PERFECT",
    lens_width_mm: 44,
    bridge_width_mm: 18
  };
  const tooNarrowFrame = {
    ...affordableFrame,
    sku: "DEMO-FIT-NARROW",
    lens_width_mm: 40,
    bridge_width_mm: 16
  };
  const tooWideFrame = {
    ...affordableFrame,
    sku: "DEMO-FIT-WIDE",
    lens_width_mm: 48,
    bridge_width_mm: 20
  };

  const perfect = scoreFrame(perfectFrame, customer, vision);
  const tooNarrow = scoreFrame(tooNarrowFrame, customer, vision);
  const tooWide = scoreFrame(tooWideFrame, customer, vision);

  assert.equal(perfect.components.fit, 19);
  assert.ok(tooNarrow.components.fit < perfect.components.fit);
  assert.equal(tooNarrow.components.fit, tooWide.components.fit);
});

test("customer style can keep a face-shape-disfavored round frame competitive", () => {
  const customer = {
    budget: "low",
    purpose: "daily",
    frame_preference: "round",
    preferredShapes: ["round"],
    prescription: { pd: 68 }
  };
  const vision = { faceShape: "round", faceShapeConfidence: 0.9 };
  const roundFrame = {
    ...affordableFrame,
    sku: "DEMO-ROUND-PREFERRED",
    shape: "round",
    bridge_width_mm: 18,
    style_tags: ["daily", "classic", "round"]
  };
  const rectangleFrame = {
    ...affordableFrame,
    sku: "DEMO-RECTANGLE-AESTHETIC",
    shape: "rectangle",
    price: 760000,
    style_tags: ["daily", "office"]
  };

  const roundScore = scoreFrame(roundFrame, customer, vision);
  const rectangleScore = scoreFrame(rectangleFrame, customer, vision);

  assert.equal(roundScore.eligible, true);
  assert.ok(roundScore.totalScore >= rectangleScore.totalScore - 5);
  assert.ok(roundScore.components.faceCompatibility > 0);
  assert.ok(roundScore.reasons.some((reason) => reason.includes("sở thích")));
});

test("missing data returns a valid score with warnings and low or medium confidence", () => {
  const result = scoreFrame({
    sku: "DEMO-MISSING",
    available: true,
    shape: "oval",
    material: "TR90",
    rim_type: "full-rim",
    lens_width_mm: 51,
    bridge_width_mm: 20,
    price: 700000,
    style_tags: []
  });

  assert.equal(Number.isFinite(result.totalScore), true);
  assert.ok(result.totalScore >= 0 && result.totalScore <= 100);
  assert.ok(["low", "medium"].includes(result.confidence));
  assert.ok(result.warnings.length > 0);
});

test("missing public reference price remains neutral instead of becoming zero", () => {
  const customer = { budget: "low", purpose: "daily", prescription: { pd: 62 } };
  const vision = { faceShape: "round", faceShapeConfidence: 0.9 };
  const baseFrame = {
    ...affordableFrame,
    sku: "DEMO-PUBLIC-REFERENCE",
    source_type: "PUBLIC_REFERENCE"
  };

  const missingNull = scoreFrame({ ...baseFrame, price: null }, customer, vision);
  const missingEmpty = scoreFrame({ ...baseFrame, price: "" }, customer, vision);
  const missingWhitespace = scoreFrame({ ...baseFrame, price: "   " }, customer, vision);
  const numericZero = scoreFrame({ ...baseFrame, price: 0 }, customer, vision);

  assert.equal(missingNull.components.budget, 6.2);
  assert.equal(missingEmpty.components.budget, missingNull.components.budget);
  assert.equal(missingWhitespace.components.budget, missingNull.components.budget);
  assert.ok(missingNull.warnings.some((warning) => warning.includes("Thiếu giá gọng")));
  assert.ok(missingEmpty.warnings.some((warning) => warning.includes("Thiếu giá gọng")));
  assert.ok(missingWhitespace.warnings.some((warning) => warning.includes("Thiếu giá gọng")));

  assert.equal(numericZero.components.budget, 5.7);
  assert.equal(numericZero.warnings.some((warning) => warning.includes("Thiếu giá gọng")), false);
});

test("unavailable frames are marked ineligible", () => {
  const result = scoreFrame({
    ...affordableFrame,
    sku: "DEMO-UNAVAILABLE",
    available: false
  }, { budget: "low" }, { faceShape: "round", faceShapeConfidence: 0.8 });

  assert.equal(result.eligible, false);
  assert.equal(result.totalScore, 0);
  assert.equal(result.confidence, "low");
  assert.ok(result.warnings.some((warning) => warning.includes("không khả dụng")));
});
