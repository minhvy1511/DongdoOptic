const COMPONENT_LABELS = Object.freeze({
  availability: "availability",
  faceCompatibility: "face",
  fit: "fit",
  prescription: "prescription",
  purpose: "purpose",
  budget: "budget",
  style: "style"
});


export function buildFrameRankingDebugSummary(shadowResult = null, { debugEnabled = false } = {}) {
  if (!debugEnabled || !shadowResult) {
    return "";
  }

  if (shadowResult.status === "error") {
    return [
      "Frame Ranking Shadow",
      `Status: error`,
      `Error: ${shadowResult.error || "-"}`
    ].join("\n");
  }

  const profiles = shadowResult.profiles || {};
  const topProducts = Array.isArray(shadowResult.topProducts) ? shadowResult.topProducts : [];
  return [
    "Frame Ranking Shadow",
    renderCustomerSnapshot(profiles.customerProfile || {}),
    renderVisionSnapshot(profiles.visionProfile || {}),
    renderLegacyComparison(shadowResult),
    "Top 3:",
    ...(topProducts.length ? topProducts.slice(0, 3).map(renderRankedProduct) : ["- No eligible products"])
  ].join("\n");
}


function renderCustomerSnapshot(profile) {
  return [
    "Customer:",
    `- budget: ${formatValue(profile.budget)}`,
    `- purpose: ${formatValue(profile.purpose)}`,
    `- preference: ${formatValue(profile.frame_preference || profile.stylePreference)}`,
    `- PD: ${formatValue(profile.pd ?? profile.prescription?.pd)}`,
    `- SPH/CYL: ${formatValue(profile.sph ?? profile.prescription?.sph)} / ${formatValue(profile.cyl ?? profile.prescription?.cyl)}`,
    `- frame/lens/bridge: ${formatValue(profile.frame_width_mm)} / ${formatValue(profile.lens_width_mm)} / ${formatValue(profile.bridge_width_mm)}`
  ].join("\n");
}


function renderVisionSnapshot(profile) {
  return [
    "Vision:",
    `- faceShape: ${formatValue(profile.faceShape || profile.shape)}`,
    `- faceShapeConfidence: ${formatScore(profile.faceShapeConfidence ?? profile.confidence)}`
  ].join("\n");
}


function renderLegacyComparison(shadowResult) {
  const legacy = Array.isArray(shadowResult.legacyRecommendations)
    ? shadowResult.legacyRecommendations.slice(0, 5)
    : [];
  const ranked = Array.isArray(shadowResult.topSkus)
    ? shadowResult.topSkus.slice(0, 3)
    : [];
  return [
    "Legacy:",
    ...(legacy.length ? legacy.map((item) => `- ${item}`) : ["- -"]),
    "Product Ranking:",
    ...(ranked.length ? ranked.map((sku, index) => `${index + 1}. ${sku}`) : ["- -"])
  ].join("\n");
}


function renderRankedProduct(item) {
  const frame = item.frame || {};
  return [
    `#${item.rank || "-"} ${formatValue(frame.sku)} - ${formatValue(frame.name)} - ${formatScore(item.totalScore)} - ${formatValue(item.confidence)}`,
    renderComponents(item.components || {}),
    renderScoreDiagnostics(item.components || {}),
    renderList("reasons", item.reasons, 3, "+"),
    renderList("warnings", item.warnings, 5, "!")
  ].filter(Boolean).join("\n");
}


function renderComponents(components) {
  const pairs = Object.entries(COMPONENT_LABELS).map(([key, label]) => (
    `${label}:${formatScore(components[key])}`
  ));
  return `components: ${pairs.join(" | ")}`;
}


function renderScoreDiagnostics(components) {
  const entries = Object.entries(components)
    .filter(([, value]) => Number.isFinite(Number(value)));
  if (!entries.length) {
    return "";
  }

  const sorted = [...entries].sort((a, b) => Number(b[1]) - Number(a[1]));
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  return `strongest: ${componentLabel(strongest[0])} ${formatScore(strongest[1])} | weakest: ${componentLabel(weakest[0])} ${formatScore(weakest[1])}`;
}


function renderList(label, values, limit, prefix) {
  const items = Array.isArray(values) ? values.filter(Boolean).slice(0, limit) : [];
  if (!items.length) {
    return "";
  }
  return [
    `${label}:`,
    ...items.map((item) => `${prefix} ${item}`)
  ].join("\n");
}


function componentLabel(key) {
  return COMPONENT_LABELS[key] || key;
}


function formatScore(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return "-";
  }
  return Math.round(numberValue * 10) / 10;
}


function formatValue(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.join(", ") || "-";
  }
  return String(value);
}
