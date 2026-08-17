import { fetchFrameProducts, rankFrameProducts } from "./frame-ranking.js?v=20260817-frame-geometry1";
import { buildDiversityShadowTop3 } from "./frame-diversity-shadow.js?v=20260817-functional-rc1";


let frameProductsPromise = null;


export function buildFrameScoringProfiles({
  customer = {},
  preferences = {},
  visionAnalysis = null,
  confirmedFaceShape = "",
  aiFaceShape = ""
} = {}) {
  const prescription = customer.prescription || preferences.prescription || {};

  const customerProfile = compactObject({
    budget: preferences.budget ?? customer.preferences?.budget ?? customer.budget,
    purpose: preferences.purpose ?? customer.preferences?.purpose ?? customer.purpose,
    frame_preference: preferences.frame_preference ?? customer.preferences?.frame_preference,
    brands: preferences.brands ?? customer.preferences?.brands,
    frame_width_mm: preferences.frame_width_mm ?? customer.frame_width_mm,
    lens_width_mm: preferences.lens_width_mm ?? customer.lens_width_mm ?? customer.preferences?.lens_width_mm,
    bridge_width_mm: preferences.bridge_width_mm ?? customer.bridge_width_mm ?? customer.preferences?.bridge_width_mm,
    has_prescription: customer.has_prescription,
    pd: prescription.pd,
    sph: prescription.sph,
    cyl: prescription.cyl,
    prescription: compactObject({
      pd: prescription.pd,
      sph: prescription.sph,
      cyl: prescription.cyl
    })
  });

  const visionProfile = compactObject({
    faceShape: confirmedFaceShape
      || visionAnalysis?.faceShape_confirmed
      || aiFaceShape
      || visionAnalysis?.faceShape_ai
      || visionAnalysis?.shape,
    faceShapeConfidence: readVisionConfidence(visionAnalysis),
    confidence: readVisionConfidence(visionAnalysis),
    ...readVisionGeometry(visionAnalysis)
  });

  return {
    customerProfile,
    visionProfile
  };
}


function readVisionGeometry(analysis) {
  const metrics = analysis?.metrics || {};
  return compactObject({
    lengthToWidth: positiveMetric(metrics.lengthToWidth),
    jawToCheek: positiveMetric(metrics.jawToCheek),
    foreheadToCheek: positiveMetric(metrics.foreheadToCheek),
    jawToForehead: positiveMetric(metrics.jawToForehead)
  });
}


function positiveMetric(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}


export async function runShadowFrameRanking({
  customer = {},
  preferences = {},
  visionAnalysis = null,
  confirmedFaceShape = "",
  aiFaceShape = "",
  legacyRecommendations = [],
  scanId = "",
  requestId = null,
  limit = 3,
  fetchCatalog = fetchFrameProducts,
  rankProducts = rankFrameProducts,
  selectDiversity = buildDiversityShadowTop3,
  debugEnabled = false,
  logger = console.debug
} = {}) {
  try {
    const { customerProfile, visionProfile } = buildFrameScoringProfiles({
      customer,
      preferences,
      visionAnalysis,
      confirmedFaceShape,
      aiFaceShape
    });
    const frames = await getFrameProducts(fetchCatalog);
    const rankedProducts = rankProducts(frames, customerProfile, visionProfile, {
      limit: Math.max(frames.length, limit)
    });
    const topProducts = deduplicateRankedProducts(rankedProducts, limit);
    let diversityShadow;
    let finalTopProducts = topProducts;
    let finalSource = "frozen";
    try {
      diversityShadow = selectDiversity(rankedProducts, { scanId });
      if (isValidDiversitySelection(diversityShadow?.diversityTop3, rankedProducts, topProducts, limit)) {
        finalTopProducts = diversityShadow.diversityTop3;
        finalSource = "diversity";
        diversityShadow = { ...diversityShadow, status: "ready" };
      } else {
        diversityShadow = buildDiversityFallback(diversityShadow, topProducts, "INVALID_OR_INCOMPLETE_SELECTION");
      }
    } catch (error) {
      diversityShadow = buildDiversityFallback(null, topProducts, error?.message || "DIVERSITY_SELECTION_FAILED");
    }

    return {
      status: "ready",
      scanId: String(scanId || ""),
      requestId: requestId == null ? null : String(requestId),
      topProducts,
      topSkus: topProducts.map((item) => item.frame?.sku).filter(Boolean),
      topNames: topProducts.map((item) => item.frame?.name).filter(Boolean),
      diversityShadow,
      finalTopProducts,
      finalTopSkus: finalTopProducts.map((item) => item.frame?.sku).filter(Boolean),
      finalSource,
      legacyRecommendations: legacyRecommendations.map((item) => (
        typeof item === "string" ? item : item?.title || item?.name || item?.label || ""
      )).filter(Boolean),
      profiles: {
        customerProfile,
        visionProfile
      }
    };
  } catch (error) {
    if (debugEnabled && typeof logger === "function") {
      logger("[FrameRanking][shadow] failed", error?.message || error);
    }
    return {
      status: "error",
      error: error?.message || "Frame ranking shadow failed.",
      topProducts: [],
      topSkus: [],
      topNames: []
    };
  }
}


export function deduplicateRankedProducts(rankedProducts = [], limit = 3) {
  const seen = new Set();
  const unique = [];
  for (const item of rankedProducts) {
    const key = getFrameProductDedupKey(item?.frame || {});
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...item, rank: unique.length + 1 });
    if (unique.length >= limit) break;
  }
  return unique;
}


export function getFrameProductDedupKey(frame = {}) {
  const model = normalizeKeyPart(frame.model);
  if (model) return `model:${model}`;

  const geometry = [
    normalizeKeyPart(frame.shape),
    normalizeDimension(frame.lens_width_mm),
    normalizeDimension(frame.bridge_width_mm),
    normalizeDimension(frame.frame_width_mm)
  ];
  if (geometry.every(Boolean)) return `geometry:${geometry.join("|")}`;

  return `sku:${normalizeKeyPart(frame.sku) || "unknown"}`;
}


export function buildCustomerFrameRecommendations(result = {}, legacyFallback = []) {
  const finalProducts = Array.isArray(result.finalTopProducts)
    ? result.finalTopProducts
    : result.topProducts;
  if (result.status !== "ready" || !finalProducts?.length) {
    return legacyFallback;
  }
  return finalProducts.map(({ frame = {}, totalScore = 0, components = {}, reasons = [], warnings = [] }) => ({
    id: frame.sku || frame.model || frame.name,
    sku: frame.sku || "",
    model: frame.model || "",
    name: frame.name || frame.model || frame.sku || "Gọng kính",
    style: [frame.brand, frame.material, frame.shape].filter(Boolean).join(" · "),
    reason: selectCustomerRankingReason(reasons, components),
    fitNote: warnings[0] || "Cần thử gọng thực tế để xác nhận độ vừa và vị trí đồng tử.",
    ranking: {
      totalScore,
      components: { ...components },
      reasons: [...reasons],
      warnings: [...warnings]
    },
    rankedProduct: frame
  }));
}


function isValidDiversitySelection(items, rankedProducts, frozenTopProducts, limit) {
  if (!Array.isArray(items)) return false;
  const expectedCount = Math.min(normalizePositiveLimit(limit), frozenTopProducts.length);
  if (items.length < expectedCount) return false;

  const rankedByKey = new Map();
  for (const item of rankedProducts) {
    const key = getFrameProductDedupKey(item?.frame || {});
    if (!rankedByKey.has(key)) rankedByKey.set(key, item);
  }
  const selectedKeys = new Set();
  for (const item of items.slice(0, expectedCount)) {
    const key = getFrameProductDedupKey(item?.frame || {});
    const original = rankedByKey.get(key);
    if (!original || selectedKeys.has(key) || item?.eligible === false) return false;
    if (!Number.isFinite(Number(item.totalScore))) return false;
    if (Math.abs(Number(item.totalScore) - Number(original.totalScore)) > 1e-9) return false;
    selectedKeys.add(key);
  }
  return true;
}


function buildDiversityFallback(shadow, frozenTopProducts, reason) {
  return {
    ...(shadow || {}),
    status: "fallback",
    error: String(reason || "DIVERSITY_SELECTION_FAILED"),
    frozenTop3: frozenTopProducts,
    diversityTop3: Array.isArray(shadow?.diversityTop3) ? shadow.diversityTop3 : []
  };
}


function normalizePositiveLimit(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 3;
}


function selectCustomerRankingReason(reasons = [], components = {}) {
  const specificReason = reasons.find((reason) => !/khả dụng|tồn kho/i.test(String(reason)));
  if (specificReason) return specificReason;
  const labels = {
    faceCompatibility: "Form gọng có điểm tương thích khuôn mặt tốt trong hồ sơ hiện tại.",
    fit: "Kích thước gọng có điểm fitting tốt trong hồ sơ hiện tại.",
    prescription: "Thông số gọng phù hợp với nhu cầu đơn kính hiện tại.",
    purpose: "Gọng phù hợp với mục đích sử dụng đã chọn.",
    budget: "Gọng phù hợp với vùng ngân sách đã chọn.",
    style: "Gọng phù hợp với sở thích kiểu dáng đã chọn."
  };
  const strongest = Object.entries(components)
    .filter(([key, value]) => key !== "availability" && Number.isFinite(Number(value)))
    .sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0];
  return labels[strongest] || reasons[0] || "Sản phẩm có tổng điểm phù hợp cao với hồ sơ tư vấn hiện tại.";
}


export function createFrameRankingRequestGuard() {
  let generation = 0;
  return {
    begin() {
      generation += 1;
      return generation;
    },
    isCurrent(requestId) {
      return requestId === generation;
    },
    invalidate() {
      generation += 1;
    }
  };
}


export function resetFrameProductsCache() {
  frameProductsPromise = null;
}


function getFrameProducts(fetchCatalog) {
  if (!frameProductsPromise) {
    frameProductsPromise = fetchCatalog();
  }
  return frameProductsPromise;
}


function readVisionConfidence(analysis) {
  const value = analysis?.quality?.confidence
    ?? analysis?.confidence
    ?? analysis?.diagnostics?.confidence;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return undefined;
  return numberValue > 1 ? numberValue / 100 : numberValue;
}


function normalizeKeyPart(value) {
  return String(value ?? "").trim().toLowerCase();
}


function normalizeDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : "";
}


function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => (
      value !== undefined
      && value !== null
      && value !== ""
      && !(Array.isArray(value) && value.length === 0)
      && !(isPlainObject(value) && Object.keys(value).length === 0)
    ))
  );
}


function isPlainObject(value) {
  return Boolean(value) && Object.prototype.toString.call(value) === "[object Object]";
}
