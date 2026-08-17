const FACE_LENGTH_SHORT_MAX = 1.28;
const FACE_LENGTH_LONG_MIN = 1.5;
const JAW_NARROW_MAX = 0.82;
const JAW_BROAD_MIN = 0.9;
const CHEEK_PROMINENT_MAX = 0.9;
const UPPER_FACE_PROMINENT_MIN = 0.96;

export function buildConsultationContext({
  scanId = "",
  sessionId = "",
  legacyFaceShape = "",
  legacyConfidence = 0,
  v3Shadow = null,
  faceMetrics = {},
  rankingProfile = null,
  rankedTopProducts = [],
  productSource = "legacy"
} = {}) {
  const metrics = finiteMetrics(faceMetrics);
  const traits = deriveGeometryTraits(metrics).slice(0, 3);
  const context = {
    scanId: text(scanId),
    sessionId: text(sessionId),
    legacyFaceShape: text(legacyFaceShape),
    legacyConfidence: finiteNumber(legacyConfidence),
    v3: normalizeV3Shadow(v3Shadow),
    faceMetrics: metrics,
    traits,
    headline: buildTraitHeadline({ legacyFaceShape, traits }),
    adviceBullets: traits.map((trait) => trait.advice),
    rankingProfile: cloneValue(rankingProfile),
    rankedTopProducts: cloneValue(Array.isArray(rankedTopProducts) ? rankedTopProducts : []).slice(0, 3),
    productSource: text(productSource) || "legacy"
  };
  return deepFreeze(context);
}

export function updateConsultationContextRanking(context, {
  scanId = "",
  rankingProfile = null,
  rankedTopProducts = [],
  productSource = "ranked"
} = {}) {
  if (!context || !scanId || context.scanId !== scanId) return context;
  return buildConsultationContext({
    ...context,
    v3Shadow: context.v3,
    rankingProfile,
    rankedTopProducts,
    productSource
  });
}

export function deriveGeometryTraits(metrics = {}) {
  const traits = [];
  const lengthToWidth = finiteMetric(metrics.lengthToWidth);
  const jawToCheek = finiteMetric(metrics.jawToCheek);
  const foreheadToCheek = finiteMetric(metrics.foreheadToCheek);

  if (lengthToWidth != null) {
    const state = lengthToWidth <= FACE_LENGTH_SHORT_MAX
      ? "short"
      : lengthToWidth >= FACE_LENGTH_LONG_MIN ? "long" : "balanced";
    traits.push(buildTrait({
      id: "face-length",
      label: "Tỷ lệ dài/rộng",
      state,
      metric: "lengthToWidth",
      value: lengthToWidth,
      strength: Math.abs(lengthToWidth - 1.39) / 0.22,
      advice: state === "long"
        ? `Tỷ lệ dài/rộng ${formatRatio(lengthToWidth)} cho thấy khuôn mặt thiên dài; ưu tiên gọng có chiều cao tròng vừa để cân lại chiều dọc.`
        : state === "short"
          ? `Tỷ lệ dài/rộng ${formatRatio(lengthToWidth)} cho thấy khuôn mặt tương đối ngắn; ưu tiên đường gọng gọn và có nét dọc vừa phải.`
          : `Tỷ lệ dài/rộng ${formatRatio(lengthToWidth)} đang cân bằng; giữ chiều cao tròng vừa và tránh form quá dẹt hoặc quá cao.`
    }));
  }

  if (jawToCheek != null) {
    const state = jawToCheek <= JAW_NARROW_MAX
      ? "narrow"
      : jawToCheek >= JAW_BROAD_MIN ? "broad" : "balanced";
    traits.push(buildTrait({
      id: "jaw-balance",
      label: "Cân bằng hàm/gò má",
      state,
      metric: "jawToCheek",
      value: jawToCheek,
      strength: Math.abs(jawToCheek - 0.86) / 0.08,
      advice: state === "broad"
        ? `Tỷ lệ hàm/gò má ${formatRatio(jawToCheek)} cho thấy phần hàm tương đối rộng; ưu tiên góc bo mềm và viền không quá dày.`
        : state === "narrow"
          ? `Tỷ lệ hàm/gò má ${formatRatio(jawToCheek)} cho thấy phần hàm thon; ưu tiên gọng có độ mở vừa để cân bằng phần dưới.`
          : `Tỷ lệ hàm/gò má ${formatRatio(jawToCheek)} khá cân bằng; chọn bề ngang gọng vừa khuôn mặt và kiểm tra fit thực tế.`
    }));
  }

  if (foreheadToCheek != null) {
    const state = foreheadToCheek <= CHEEK_PROMINENT_MAX
      ? "cheek-prominent"
      : foreheadToCheek >= UPPER_FACE_PROMINENT_MIN ? "upper-face-prominent" : "balanced";
    traits.push(buildTrait({
      id: "cheek-upper-balance",
      label: "Cân bằng phần trên/gò má",
      state,
      metric: "foreheadToCheek",
      value: foreheadToCheek,
      strength: Math.abs(foreheadToCheek - 0.93) / 0.1,
      advice: state === "cheek-prominent"
        ? `Tỷ lệ trán/gò má ${formatRatio(foreheadToCheek)} cho thấy gò má nổi bật hơn phần trên; ưu tiên gọng đủ rộng và viền dưới mềm.`
        : state === "upper-face-prominent"
          ? `Tỷ lệ trán/gò má ${formatRatio(foreheadToCheek)} cho thấy phần trên nổi bật; ưu tiên đường chân mày nhẹ và cân bằng trọng lượng xuống dưới.`
          : `Tỷ lệ trán/gò má ${formatRatio(foreheadToCheek)} khá cân bằng; giữ gọng theo đường chân mày và tránh bó hai bên gò má.`
    }));
  }

  return traits.sort((left, right) => right.strength - left.strength || left.id.localeCompare(right.id));
}

export function buildTraitHeadline({ legacyFaceShape = "", traits = [] } = {}) {
  const category = text(legacyFaceShape);
  const states = new Set(traits.slice(0, 2).map((trait) => trait.state));
  let headline = category
    ? `Giữ tỷ lệ hài hòa cho nhóm mặt ${category}`
    : "Giữ tỷ lệ khuôn mặt hài hòa";

  if (states.has("long")) headline = "Ưu tiên chiều cao gọng để cân bằng khuôn mặt dài";
  else if (states.has("short")) headline = "Tạo nét dọc gọn cho tỷ lệ khuôn mặt ngắn";

  if (states.has("broad")) {
    headline = states.has("long")
      ? "Cân bằng chiều dài và làm mềm đường hàm"
      : "Giữ tỷ lệ cân đối, làm mềm đường hàm";
  } else if (states.has("narrow")) {
    headline = "Cân bằng phần hàm thon với độ mở gọng vừa";
  }

  if (states.has("cheek-prominent") && !states.has("long") && !states.has("broad")) {
    headline = "Cân bằng vùng gò má và phần hàm";
  } else if (states.has("upper-face-prominent") && !states.has("long") && !states.has("broad")) {
    headline = "Giữ phần trên nhẹ, cân bằng vùng hàm";
  }
  return headline;
}

function buildTrait(trait) {
  return {
    ...trait,
    strength: Math.max(0, Math.min(1, finiteNumber(trait.strength)))
  };
}

function normalizeV3Shadow(value) {
  if (!value) return null;
  return cloneValue({
    label: value.v3Label ?? value.label ?? value.predictedLabel ?? "",
    probabilities: value.v3Probabilities ?? value.probabilities ?? null,
    confidence: value.v3TopProbability ?? value.confidence ?? value.topProbability ?? null,
    margin: value.v3Margin ?? value.margin ?? null,
    unknownReason: value.v3UnknownReason ?? value.unknownReason ?? null
  });
}

function finiteMetrics(metrics) {
  return Object.fromEntries(Object.entries(metrics || {}).filter(([, value]) => finiteMetric(value) != null));
}

function finiteMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatRatio(value) {
  return finiteNumber(value).toFixed(2);
}

function text(value) {
  return String(value ?? "").trim();
}

function cloneValue(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
