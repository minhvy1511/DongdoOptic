import { fetchFrameProducts, rankFrameProducts } from "./frame-ranking.js";


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
    confidence: readVisionConfidence(visionAnalysis)
  });

  return {
    customerProfile,
    visionProfile
  };
}


export async function runShadowFrameRanking({
  customer = {},
  preferences = {},
  visionAnalysis = null,
  confirmedFaceShape = "",
  aiFaceShape = "",
  legacyRecommendations = [],
  limit = 3,
  fetchCatalog = fetchFrameProducts,
  rankProducts = rankFrameProducts,
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

    return {
      status: "ready",
      topProducts,
      topSkus: topProducts.map((item) => item.frame?.sku).filter(Boolean),
      topNames: topProducts.map((item) => item.frame?.name).filter(Boolean),
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
  if (result.status !== "ready" || !result.topProducts?.length) {
    return legacyFallback;
  }
  return result.topProducts.map(({ frame = {}, totalScore = 0, components = {}, reasons = [], warnings = [] }) => ({
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
