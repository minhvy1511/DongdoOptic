export function isScanDiagnosticsExportEnabled(search = "") {
  return new URLSearchParams(search).get("visionDebug") === "1";
}

export function buildScanDiagnosticsExport({
  timestamp = new Date().toISOString(),
  visionProfile = {},
  faceConfidence = null,
  faceMetrics = {},
  v3Shadow = null,
  rankingResult = {},
  legacyRecommendations = [],
  rankingRequestId = null,
  recentScans = []
} = {}) {
  return {
    currentScan: {
      timestamp,
      visionProfile: {
        faceShape: cleanText(visionProfile.faceShape)
      },
      faceConfidence: finiteOrNull(faceConfidence),
      faceMetrics: cleanNumberMap(faceMetrics),
      v3Shadow: sanitizeV3Shadow(v3Shadow),
      topRankedProducts: (rankingResult.topProducts || []).slice(0, 3).map(sanitizeRankedProduct),
      legacyRecommendation: legacyRecommendations.map(sanitizeLegacyRecommendation),
      rankingRequestId: rankingRequestId == null ? null : cleanText(rankingRequestId)
    },
    recentScans: recentScans.slice(-10).map(sanitizeRecentScan)
  };
}

export function createScanDiagnosticsFilename(timestamp = new Date().toISOString()) {
  return `visionid-scan-diagnostics-${String(timestamp).replace(/[:.]/g, "-")}.json`;
}

export function downloadScanDiagnostics(payload, {
  documentRef = globalThis.document,
  urlApi = globalThis.URL,
  blobCtor = globalThis.Blob
} = {}) {
  const blob = new blobCtor([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = urlApi.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = url;
  link.download = createScanDiagnosticsFilename(payload?.currentScan?.timestamp);
  link.click();
  urlApi.revokeObjectURL(url);
  return link.download;
}

function sanitizeRankedProduct(item = {}) {
  const frame = item.frame || {};
  return {
    sku: cleanText(frame.sku),
    model: cleanText(frame.model || frame.name),
    totalScore: finiteOrNull(item.totalScore),
    components: cleanNumberMap(item.components),
    reasons: cleanTextList(item.reasons),
    warnings: cleanTextList(item.warnings)
  };
}

function sanitizeV3Shadow(scan) {
  if (!scan) return null;
  return {
    label: cleanText(scan.v3Label || scan.predictedLabel),
    probabilities: cleanNumberMap(scan.v3Probabilities || scan.probabilities)
  };
}

function sanitizeRecentScan(scan = {}) {
  return {
    timestamp: cleanText(scan.timestamp),
    legacyLabel: cleanText(scan.legacyLabel),
    v3Label: cleanText(scan.v3Label),
    v3Probabilities: cleanNumberMap(scan.v3Probabilities),
    v3TopProbability: finiteOrNull(scan.v3TopProbability),
    featureVector: Array.isArray(scan.featureVector)
      ? scan.featureVector.map(finiteOrNull)
      : []
  };
}

function sanitizeLegacyRecommendation(item) {
  if (typeof item === "string") return item;
  return cleanText(item?.name || item?.title || item?.label);
}

function cleanNumberMap(value = {}) {
  return Object.fromEntries(Object.entries(value || {}).flatMap(([key, number]) => (
    Number.isFinite(Number(number)) ? [[cleanText(key), Number(number)]] : []
  )));
}

function cleanTextList(values = []) {
  return Array.isArray(values) ? values.map(cleanText).filter(Boolean) : [];
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function finiteOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}
