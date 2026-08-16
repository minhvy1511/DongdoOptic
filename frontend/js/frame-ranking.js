import { scoreFrame } from "./frame-scoring.js";


const DEFAULT_FRAME_PRODUCTS_URL = "/api/frame-products";
const DEFAULT_TOP_N = 3;


export async function fetchFrameProducts({
  url = DEFAULT_FRAME_PRODUCTS_URL,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetchFrameProducts requires a fetch implementation.");
  }

  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!response?.ok) {
    throw new Error(`Frame products request failed with status ${response?.status || "unknown"}.`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error("Frame products response must contain an items array.");
  }

  if (payload.count != null && Number(payload.count) !== payload.items.length) {
    throw new Error("Frame products response count does not match items length.");
  }

  return payload.items.map((item) => ({ ...item }));
}


export function rankFrameProducts(
  frames = [],
  customerProfile = {},
  visionProfile = {},
  options = {}
) {
  const limit = normalizeLimit(options.limit ?? options.topN ?? DEFAULT_TOP_N);

  return frames
    .map((frame, index) => {
      const result = scoreFrame(frame, customerProfile, visionProfile);
      return {
        frame: { ...frame },
        eligible: result.eligible !== false,
        totalScore: result.totalScore,
        confidence: result.confidence,
        components: { ...(result.components || {}) },
        reasons: [...(result.reasons || [])],
        warnings: [...(result.warnings || [])],
        _sourceIndex: index
      };
    })
    .filter((item) => item.eligible)
    .sort(compareRankedItems)
    .slice(0, limit)
    .map(({ _sourceIndex, ...item }, index) => ({
      ...item,
      rank: index + 1
    }));
}


function compareRankedItems(a, b) {
  const scoreDelta = Number(b.totalScore || 0) - Number(a.totalScore || 0);
  if (scoreDelta !== 0) return scoreDelta;

  const confidenceDelta = confidenceRank(b.confidence) - confidenceRank(a.confidence);
  if (confidenceDelta !== 0) return confidenceDelta;

  const skuDelta = String(a.frame?.sku || "").localeCompare(String(b.frame?.sku || ""));
  if (skuDelta !== 0) return skuDelta;

  return a._sourceIndex - b._sourceIndex;
}


function confidenceRank(value) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  if (value === "low") return 1;
  return 0;
}


function normalizeLimit(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return DEFAULT_TOP_N;
  }
  return Math.floor(numberValue);
}
