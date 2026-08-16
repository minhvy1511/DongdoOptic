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
    const topProducts = rankProducts(frames, customerProfile, visionProfile, { limit });

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
