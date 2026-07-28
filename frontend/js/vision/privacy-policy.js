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
