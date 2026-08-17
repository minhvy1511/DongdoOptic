export const AUTO_CONSULTATION_DELAY_MS = 300;

export function createAcceptedScanCommit() {
  let committed = false;

  return {
    commit({ accepted = false, stopScan, saveResult, navigate } = {}) {
      if (!accepted || committed) {
        return false;
      }
      committed = true;
      stopScan?.();
      saveResult?.();
      navigate?.();
      return true;
    },
    reset() {
      committed = false;
    },
    isCommitted() {
      return committed;
    }
  };
}

export function getStraightPosePercent(pose = {}, { yawToleranceDeg = 8, rollToleranceDeg = 12 } = {}) {
  const yawRatio = Math.abs(Number(pose.yawDeg || 0)) / Math.max(1, yawToleranceDeg);
  const rollRatio = Math.abs(Number(pose.rollDeg || 0)) / Math.max(1, rollToleranceDeg);
  return Math.round(Math.max(0, 1 - Math.max(yawRatio, rollRatio)) * 100);
}

export function getGuideDistanceBand(faceWidthRatio, {
  idealMin = 0.2,
  idealMax = 0.78,
  tolerantMin = 0.15,
  tolerantMax = 0.92
} = {}) {
  const value = Number(faceWidthRatio || 0);
  if (value < tolerantMin || value > tolerantMax) return "blocked";
  if (value < idealMin || value > idealMax) return "advisory";
  return "ideal";
}

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
  if (code === "OFF_CENTER") {
    return "\u0110\u01b0a khu\u00f4n m\u1eb7t v\u00e0o gi\u1eefa khung";
  }
  if (code === "IMAGE_BLURRY") {
    return "Gi\u1eef camera \u1ed5n \u0111\u1ecbnh \u0111\u1ec3 khu\u00f4n m\u1eb7t r\u00f5 n\u00e9t";
  }
  if (["IMAGE_TOO_DARK", "IMAGE_TOO_BRIGHT", "IMAGE_LOW_CONTRAST"].includes(code)) {
    return "\u0110i\u1ec1u ch\u1ec9nh \u00e1nh s\u00e1ng tr\u00ean khu\u00f4n m\u1eb7t";
  }
  if (code === "LOWER_FACE_UNSTABLE") {
    return "Gi\u1eef r\u00f5 to\u00e0n b\u1ed9 c\u1eb1m v\u00e0 vi\u1ec1n h\u00e0m";
  }
  if (code === "LOW_CONFIDENCE") {
    return "Gi\u1eef khu\u00f4n m\u1eb7t r\u00f5 v\u00e0 \u1ed5n \u0111\u1ecbnh";
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
  const resolvedShape = latestAnalysis?.faceShape_ai || latestAnalysis?.shape || finalConfirmedShape;
  const hasAcceptedQualityResult = latestAnalysis?.diagnostics?.qualityGate?.passed === true
    && latestAnalysis?.diagnostics?.advisoryShape !== true
    && resolvedShape
    && resolvedShape !== "unknown";
  const hasAutoReadyResult = latestAnalysis?.diagnostics?.autoConfirmed === true
    && (confirmedFaceShapeSource === "auto" || Boolean(latestAnalysis?.faceShape_confirmed));
  const hasAcceptedScanResult = hasAcceptedQualityResult
    && ["auto", "suggested"].includes(confirmedFaceShapeSource);
  return Boolean(
    latestAnalysis?.metrics
    && latestAnalysis?.diagnostics
    && finalConfirmedShape
    && !isManualOverride
    && (hasAutoReadyResult || hasAcceptedScanResult)
    && autoScanState.phase === "RESULT"
    && autoScanState.status === "captured"
    && !autoScanState.errorReason
    && !latestAnalysis.diagnostics.partialScan
  );
}
