export function isExplicitConsentGranted(value) {
  if (value === true) {
    return true;
  }

  if (value === false || value === null || typeof value === "undefined") {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return false;
}

export function purgeStoredVisionAnalysis(customer = {}) {
  const cleaned = { ...customer };

  delete cleaned.analysis;
  delete cleaned.latestAnalysis;
  delete cleaned.diagnostics;
  delete cleaned.top_candidates;
  delete cleaned.capture_quality;
  delete cleaned.confidence;
  delete cleaned.confidence_level;

  return cleaned;
}

export function buildConsentScopedVisionFeedback({
  includeVisionAnalysis = false,
  latestAnalysis = null,
  confidenceState = {},
  diagnostics = {},
  classification = {},
  qualityGate = null
} = {}) {
  if (!includeVisionAnalysis) {
    return {};
  }

  return {
    confidence: latestAnalysis?.quality?.confidence ?? null,
    confidence_level: confidenceState.level || "low",
    top_candidates: Array.isArray(classification.candidates)
      ? classification.candidates.slice(0, 3)
      : [],
    capture_quality: qualityGate
      ? {
          passed: Boolean(qualityGate.passed),
          score: qualityGate.score ?? null,
          failed_labels: Array.isArray(qualityGate.failedLabels) ? qualityGate.failedLabels : [],
          checks: Array.isArray(qualityGate.checks) ? qualityGate.checks : []
        }
      : {},
    diagnostics: {
      warnings: Array.isArray(diagnostics.warnings) ? diagnostics.warnings.slice(0, 6) : [],
      confidenceComponents: diagnostics.confidenceComponents || {},
      confidenceBand: diagnostics.confidenceBand || "",
      calibrationSource: diagnostics.calibrationSource || classification.calibrationSource || "",
      centerBurst: diagnostics.centerBurst || null,
      scanMode: diagnostics.scanMode || ""
    }
  };
}
