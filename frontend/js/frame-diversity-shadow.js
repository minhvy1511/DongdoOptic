const SLOT_ONE_MAX_DELTA = 0.3;
const SLOT_TWO_THREE_MIN_RATIO = 0.98;
const SLOT_TWO_THREE_MAX_DELTA = 1.5;
const SHADOW_LIMIT = 3;


export function buildDiversityShadowTop3(rankedProducts = [], { scanId = "" } = {}) {
  const uniqueRanked = deduplicateAll(rankedProducts);
  const frozenTop3 = cloneRanked(uniqueRanked.slice(0, SHADOW_LIMIT));
  if (!uniqueRanked.length) {
    return emptyResult(frozenTop3, scanId);
  }

  const bestScore = numericScore(uniqueRanked[0]);
  const slotOnePool = uniqueRanked.filter((item) => (
    bestScore - numericScore(item) <= SLOT_ONE_MAX_DELTA + Number.EPSILON
  ));
  const slotTwoThreePool = uniqueRanked.filter((item) => {
    const score = numericScore(item);
    return score >= bestScore * SLOT_TWO_THREE_MIN_RATIO - Number.EPSILON
      && bestScore - score <= SLOT_TWO_THREE_MAX_DELTA + Number.EPSILON;
  });

  const selected = [];
  const usedKeys = new Set();
  takeRotated(slotOnePool, scanId, "slot-1", 1, selected, usedKeys);
  takeRotated(slotTwoThreePool, scanId, "slot-2-3", 2, selected, usedKeys);
  fillInFrozenOrder(uniqueRanked, SHADOW_LIMIT, selected, usedKeys);

  return {
    seedHash: stableHash(String(scanId || "anonymous-scan")),
    frozenTop3,
    diversityTop3: cloneRanked(selected.slice(0, SHADOW_LIMIT)),
    qualityBand: {
      bestScore,
      slotOneMaxDelta: SLOT_ONE_MAX_DELTA,
      slotTwoThreeMinRatio: SLOT_TWO_THREE_MIN_RATIO,
      slotTwoThreeMaxDelta: SLOT_TWO_THREE_MAX_DELTA,
      slotOneCandidates: slotOnePool.length,
      slotTwoThreeCandidates: slotTwoThreePool.length
    }
  };
}


function deduplicateAll(rankedProducts) {
  const seen = new Set();
  const unique = [];
  for (const item of rankedProducts) {
    if (!item || item.eligible === false) continue;
    const key = productDedupKey(item.frame || {});
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}


function productDedupKey(frame) {
  const model = normalize(frame.model);
  if (model) return `model:${model}`;
  const geometry = [
    normalize(frame.shape),
    dimension(frame.lens_width_mm),
    dimension(frame.bridge_width_mm),
    dimension(frame.frame_width_mm)
  ];
  if (geometry.every(Boolean)) return `geometry:${geometry.join("|")}`;
  return `sku:${normalize(frame.sku) || "unknown"}`;
}


function takeRotated(pool, scanId, slot, count, selected, usedKeys) {
  if (!pool.length || count <= 0) return;
  const offset = stableHash(`${scanId || "anonymous-scan"}|${slot}`) % pool.length;
  for (let index = 0; index < pool.length && count > 0; index += 1) {
    const item = pool[(offset + index) % pool.length];
    const key = productDedupKey(item.frame || {});
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    selected.push(item);
    count -= 1;
  }
}


function fillInFrozenOrder(uniqueRanked, limit, selected, usedKeys) {
  for (const item of uniqueRanked) {
    if (selected.length >= limit) return;
    const key = productDedupKey(item.frame || {});
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    selected.push(item);
  }
}


function cloneRanked(items) {
  return items.map((item, index) => ({
    ...item,
    frame: { ...(item.frame || {}) },
    components: { ...(item.components || {}) },
    reasons: [...(item.reasons || [])],
    warnings: [...(item.warnings || [])],
    rank: index + 1
  }));
}


function emptyResult(frozenTop3, scanId) {
  return {
    seedHash: stableHash(String(scanId || "anonymous-scan")),
    frozenTop3,
    diversityTop3: [],
    qualityBand: {
      bestScore: 0,
      slotOneMaxDelta: SLOT_ONE_MAX_DELTA,
      slotTwoThreeMinRatio: SLOT_TWO_THREE_MIN_RATIO,
      slotTwoThreeMaxDelta: SLOT_TWO_THREE_MAX_DELTA,
      slotOneCandidates: 0,
      slotTwoThreeCandidates: 0
    }
  };
}


function stableHash(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}


function numericScore(item) {
  const score = Number(item?.totalScore);
  return Number.isFinite(score) ? score : 0;
}


function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}


function dimension(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : "";
}
