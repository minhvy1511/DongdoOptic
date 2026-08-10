export const AUTO_CONSULTATION_DELAY_MS = 800;

export function createAutoConsultationTransition() {
  let scheduled = false;
  let completed = false;
  let timerId = null;
  let contextKey = "";

  function cancel() {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    scheduled = false;
    timerId = null;
    contextKey = "";
  }

  return {
    schedule({ contextKey: nextContextKey, delayMs = AUTO_CONSULTATION_DELAY_MS, onTransition } = {}) {
      if (completed || scheduled || !nextContextKey || typeof onTransition !== "function") {
        return false;
      }
      scheduled = true;
      contextKey = nextContextKey;
      timerId = setTimeout(() => {
        scheduled = false;
        timerId = null;
        completed = true;
        onTransition(contextKey);
      }, delayMs);
      return true;
    },
    cancel,
    reset() {
      cancel();
      completed = false;
    },
    getState() {
      return { scheduled, completed, contextKey };
    }
  };
}

function normalizeGuideText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();
}

export function getScanGuidanceMessage({ phase = "", status = "", reasonCode = "", distanceReason = "", prompt = "", detail = "" } = {}) {
  const code = reasonCode || distanceReason || "";
  const normalizedDetail = normalizeGuideText(detail);
  const normalizedPrompt = normalizeGuideText(prompt);
  if (code === "TOO_CLOSE" || /qua gan|too_close/.test(normalizedDetail)) {
    return "L\u00f9i ra xa m\u1ed9t ch\u00fat";
  }
  if (code === "TOO_FAR" || /qua xa|too_far/.test(normalizedDetail)) {
    return "\u0110\u01b0a khu\u00f4n m\u1eb7t g\u1ea7n h\u01a1n";
  }
  if (code === "BAD_ROLL" || /nghieng|giu dau/.test(normalizedDetail)) {
    return "Gi\u1eef \u0111\u1ea7u th\u1eb3ng";
  }
  if (code === "BAD_YAW" || /nhin thang|yaw/.test(normalizedDetail)) {
    return "Nh\u00ecn th\u1eb3ng v\u00e0o camera";
  }
  if (phase === "CHECK_DISTANCE" || status === "prompt" || /khoang cach|khung/.test(normalizedPrompt)) {
    return "\u0110\u01b0a khu\u00f4n m\u1eb7t v\u00e0o gi\u1eefa khung";
  }
  if (status === "hold" || phase === "RESULT") {
    return "Gi\u1eef nguy\u00ean trong gi\u00e2y l\u00e1t";
  }
  return "Gi\u1eef m\u1eb7t th\u1eb3ng v\u00e0 nh\u00ecn v\u00e0o camera";
}

export function getScanHudView({ autoScanState = {}, confidencePercent = "--", isComplete = false } = {}) {
  if (isComplete) {
    return {
      status: "Qu\u00e9t th\u00e0nh c\u00f4ng",
      confidence: confidencePercent,
      guidance: "\u0110ang m\u1edf t\u01b0 v\u1ea5n...",
      complete: true
    };
  }
  return {
    status: autoScanState.active ? "\u0110ang qu\u00e9t" : "VisionID",
    confidence: confidencePercent,
    guidance: getScanGuidanceMessage({
      phase: autoScanState.phase,
      status: autoScanState.status,
      reasonCode: autoScanState.reasonCode,
      distanceReason: autoScanState.distance?.reason,
      prompt: autoScanState.prompt,
      detail: autoScanState.detail
    }),
    complete: false
  };
}

export function isCanonicalVisionSuccess({
  latestAnalysis = null,
  confirmedFaceShape = "",
  confirmedFaceShapeSource = "",
  autoScanState = {}
} = {}) {
  const finalConfirmedShape = confirmedFaceShape || latestAnalysis?.faceShape_confirmed || "";
  const isManualOverride = confirmedFaceShapeSource === "manual";
  const hasAutoReadyResult = latestAnalysis?.diagnostics?.autoConfirmed === true
    && (confirmedFaceShapeSource === "auto" || Boolean(latestAnalysis?.faceShape_confirmed));
  return Boolean(
    latestAnalysis?.metrics
    && latestAnalysis?.diagnostics
    && finalConfirmedShape
    && !isManualOverride
    && hasAutoReadyResult
    && autoScanState.phase === "RESULT"
    && autoScanState.status === "captured"
    && !autoScanState.errorReason
    && !latestAnalysis.diagnostics.partialScan
  );
}
