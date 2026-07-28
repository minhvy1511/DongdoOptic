export const QUALITY_REASON_CODES = Object.freeze({
  OK: "OK",
  NO_FACE: "NO_FACE",
  MULTIPLE_FACES: "MULTIPLE_FACES",
  MISSING_LANDMARKS: "MISSING_LANDMARKS",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  OFF_CENTER: "OFF_CENTER",
  BAD_DISTANCE: "BAD_DISTANCE",
  TOO_CLOSE: "TOO_CLOSE",
  TOO_FAR: "TOO_FAR",
  BAD_ROLL: "BAD_ROLL",
  BAD_YAW: "BAD_YAW",
  INSUFFICIENT_SAMPLES: "INSUFFICIENT_SAMPLES",
  FALLBACK_USED: "FALLBACK_USED"
});

export const DEFAULT_SCAN_QUALITY_CONFIG = Object.freeze({
  centerYawToleranceDeg: 8,
  rollToleranceDeg: 12,
  minFrameConfidence: 0.34,
  centerOffsetMax: 0.16,
  minCoverage: 0.035,
  maxCoverage: 0.62,
  burstMinSamples: 8,
  burstMinConfidence: 0.25,
  burstCenterOffsetMax: 0.22,
  burstMinCoverage: 0.03,
  burstMaxCoverage: 0.66
});

export const HARD_REJECT_REASON_CODES = Object.freeze([
  QUALITY_REASON_CODES.NO_FACE,
  QUALITY_REASON_CODES.MULTIPLE_FACES,
  QUALITY_REASON_CODES.MISSING_LANDMARKS,
  "FACE_TRACKING_ERROR",
  QUALITY_REASON_CODES.BAD_YAW,
  QUALITY_REASON_CODES.BAD_ROLL,
  QUALITY_REASON_CODES.TOO_CLOSE,
  QUALITY_REASON_CODES.TOO_FAR
]);

export const SOFT_REJECT_REASON_CODES = Object.freeze([
  QUALITY_REASON_CODES.LOW_CONFIDENCE,
  QUALITY_REASON_CODES.OFF_CENTER,
  QUALITY_REASON_CODES.INSUFFICIENT_SAMPLES,
  QUALITY_REASON_CODES.FALLBACK_USED
]);

export function evaluateScanFrameQuality({
  step,
  analysis,
  pose,
  faceCount,
  config = DEFAULT_SCAN_QUALITY_CONFIG
} = {}) {
  if (faceCount !== 1 || !analysis || !pose) {
    const reason = faceCount > 1 ? QUALITY_REASON_CODES.MULTIPLE_FACES : QUALITY_REASON_CODES.NO_FACE;
    return buildFrameQualityResult({
      reason,
      detail: faceCount > 1 ? "Chỉ giữ một khuôn mặt trong khung." : "Đưa mặt vào giữa khung camera.",
      timeoutDetail: "Không nhận diện được rõ một khuôn mặt."
    });
  }

  const quality = analysis.quality || {};
  const confidence = Number(quality.confidence || 0);
  const coverage = Number(quality.coverage || 0);
  const centerOffsetX = Math.abs(Number(quality.centerOffsetX || 0));
  const centerOffsetY = Math.abs(Number(quality.centerOffsetY || 0));
  const centerOk = centerOffsetX <= config.centerOffsetMax && centerOffsetY <= config.centerOffsetMax;
  const distanceOk = coverage >= config.minCoverage && coverage <= config.maxCoverage;
  const rollOk = Math.abs(Number(pose.rollDeg || 0)) <= config.rollToleranceDeg;
  const confidenceOk = confidence >= config.minFrameConfidence;
  const targetYaw = Number(step?.targetYaw || 0);
  const tolerance = Number(step?.tolerance || config.centerYawToleranceDeg);
  const yawDiff = Math.abs(Number(pose.yawDeg || 0) - targetYaw);
  const yawOk = yawDiff <= tolerance;
  const yawNear = yawDiff <= tolerance + 7;
  const frameOk = centerOk && distanceOk && rollOk && confidenceOk;

  if (frameOk && yawOk) {
    return buildFrameQualityResult({
      ready: true,
      near: true,
      status: "hold",
      reason: QUALITY_REASON_CODES.OK,
      detail: "Giữ nguyên một chút để máy tự chụp."
    });
  }

  if (frameOk && yawNear) {
    return buildFrameQualityResult({
      near: true,
      status: "near",
      reason: QUALITY_REASON_CODES.BAD_YAW,
      detail: "Gần đúng rồi, quay chậm thêm một chút."
    });
  }

  if (!confidenceOk) {
    return buildFrameQualityResult({
      reason: QUALITY_REASON_CODES.LOW_CONFIDENCE,
      detail: "Giữ đủ sáng, nhìn rõ mắt và mũi.",
      timeoutDetail: "Tín hiệu khuôn mặt còn yếu."
    });
  }

  if (!centerOk) {
    return buildFrameQualityResult({
      reason: QUALITY_REASON_CODES.OFF_CENTER,
      detail: "Đưa mặt vào giữa khung trước khi quét.",
      timeoutDetail: "Khuôn mặt chưa nằm giữa khung."
    });
  }

  if (!distanceOk) {
    return buildFrameQualityResult({
      reason: coverage < 0.08 ? QUALITY_REASON_CODES.TOO_FAR : QUALITY_REASON_CODES.TOO_CLOSE,
      detail: coverage < 0.08 ? "Đưa mặt gần camera hơn." : "Lùi mặt ra xa camera hơn.",
      timeoutDetail: "Khoảng cách khuôn mặt chưa phù hợp."
    });
  }

  if (!rollOk) {
    return buildFrameQualityResult({
      reason: QUALITY_REASON_CODES.BAD_ROLL,
      detail: "Giữ đầu thẳng, không nghiêng vai.",
      timeoutDetail: "Đầu đang nghiêng quá nhiều."
    });
  }

  return buildFrameQualityResult({
    reason: QUALITY_REASON_CODES.BAD_YAW,
    detail: "Quay mặt về giữa thêm một chút.",
    timeoutDetail: "Chưa đạt đúng hướng mặt cần quét."
  });
}

export function isUsableBurstSample(sample, config = DEFAULT_SCAN_QUALITY_CONFIG) {
  return getBurstSampleRejectionReason(sample, config) === QUALITY_REASON_CODES.OK;
}

export function isFallbackEligibleBurstSample(sample, config = DEFAULT_SCAN_QUALITY_CONFIG) {
  const reason = getBurstSampleRejectionReason(sample, config);
  return reason === QUALITY_REASON_CODES.OK || SOFT_REJECT_REASON_CODES.includes(reason);
}

export function getBurstSampleRejectionReason(sample, config = DEFAULT_SCAN_QUALITY_CONFIG) {
  if (sample?.error || sample?.reasonCode === "FACE_TRACKING_ERROR") {
    return "FACE_TRACKING_ERROR";
  }

  if (!sample?.analysis?.metrics || !sample?.pose) {
    return QUALITY_REASON_CODES.MISSING_LANDMARKS;
  }

  const quality = sample?.analysis?.quality || {};
  const pose = sample?.pose || {};
  const confidence = Number(quality.confidence || 0);
  const yaw = Math.abs(Number(pose.yawDeg || 0));
  const roll = Math.abs(Number(pose.rollDeg || 0));
  const centerOffsetX = Math.abs(Number(quality.centerOffsetX || 0));
  const centerOffsetY = Math.abs(Number(quality.centerOffsetY || 0));
  const coverage = Number(quality.coverage || 0);

  if (yaw > config.centerYawToleranceDeg + 5) {
    return QUALITY_REASON_CODES.BAD_YAW;
  }

  if (roll > config.rollToleranceDeg + 4) {
    return QUALITY_REASON_CODES.BAD_ROLL;
  }

  if (coverage < config.burstMinCoverage) {
    return QUALITY_REASON_CODES.TOO_FAR;
  }

  if (coverage > config.burstMaxCoverage) {
    return QUALITY_REASON_CODES.TOO_CLOSE;
  }

  if (confidence < config.burstMinConfidence) {
    return QUALITY_REASON_CODES.LOW_CONFIDENCE;
  }

  if (centerOffsetX > config.burstCenterOffsetMax || centerOffsetY > config.burstCenterOffsetMax) {
    return QUALITY_REASON_CODES.OFF_CENTER;
  }

  return QUALITY_REASON_CODES.OK;
}

export function buildCaptureQualityGate({
  selectedSamples = [],
  allSamples = [],
  quality = {},
  pose = {},
  fallbackUsed = false,
  config = DEFAULT_SCAN_QUALITY_CONFIG,
  formatPercent = defaultFormatPercent,
  getDistanceLabel = defaultDistanceLabel
} = {}) {
  const sampleCount = selectedSamples.length;
  const totalSamples = allSamples.length;
  const checks = [
    {
      key: "samples",
      label: "Ổn định",
      reasonCode: QUALITY_REASON_CODES.INSUFFICIENT_SAMPLES,
      passed: sampleCount >= config.burstMinSamples,
      value: `${sampleCount}/${Math.max(totalSamples, config.burstMinSamples)} frame`
    },
    {
      key: "landmark",
      label: "Nét mặt rõ",
      reasonCode: fallbackUsed ? QUALITY_REASON_CODES.FALLBACK_USED : QUALITY_REASON_CODES.LOW_CONFIDENCE,
      passed: Number(quality.confidence || 0) >= 0.5 && !fallbackUsed,
      value: formatPercent(Number(quality.confidence || 0))
    },
    {
      key: "pose",
      label: "Nhìn thẳng",
      reasonCode: QUALITY_REASON_CODES.BAD_YAW,
      passed: Math.abs(Number(pose.yawDeg || 0)) <= 8 && Math.abs(Number(pose.rollDeg || 0)) <= 10,
      value: `${Math.round(Number(pose.yawDeg || 0))}° / ${Math.round(Number(pose.rollDeg || 0))}°`
    },
    {
      key: "center",
      label: "Giữa khung",
      reasonCode: QUALITY_REASON_CODES.OFF_CENTER,
      passed: Math.abs(Number(quality.centerOffsetX || 0)) <= 0.14 && Math.abs(Number(quality.centerOffsetY || 0)) <= 0.14,
      value: `${Math.round(Math.abs(Number(quality.centerOffsetX || 0)) * 100)}% ngang`
    },
    {
      key: "distance",
      label: "Khoảng cách",
      reasonCode: QUALITY_REASON_CODES.BAD_DISTANCE,
      passed: Number(quality.coverage || 0) >= 0.08 && Number(quality.coverage || 0) <= 0.42,
      value: getDistanceLabel(Number(quality.coverage || 0))
    }
  ];
  const passedCount = checks.filter((item) => item.passed).length;
  const score = clamp01(passedCount / checks.length);
  const failed = checks.filter((item) => !item.passed);

  return {
    passed: score >= 0.8
      && checks.find((item) => item.key === "pose")?.passed
      && checks.find((item) => item.key === "landmark")?.passed,
    score,
    checks,
    failedLabels: failed.map((item) => item.label.toLowerCase()),
    reasonCodes: failed.map((item) => item.reasonCode)
  };
}

export function getVisionLimitations({ hasPhysicalCalibration = false } = {}) {
  const limitations = [
    "Hệ thống phân tích tỷ lệ khuôn mặt để tư vấn gọng, không phải phép đo nhân trắc học chính xác."
  ];

  if (!hasPhysicalCalibration) {
    limitations.push("Chưa có calibration hợp lệ, vì vậy không xuất kích thước khuôn mặt theo mm.");
  }

  return limitations;
}

function buildFrameQualityResult({
  ready = false,
  near = false,
  status = "prompt",
  reason,
  detail,
  timeoutDetail
}) {
  return {
    ready,
    near,
    status,
    reasonCode: reason,
    detail,
    timeoutDetail
  };
}

function defaultFormatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : "--";
}

function defaultDistanceLabel(coverage) {
  if (!coverage) {
    return "Chưa có";
  }
  if (coverage < 0.08) {
    return "Quá xa";
  }
  if (coverage <= 0.42) {
    return "Đúng khoảng";
  }
  return "Quá gần";
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
