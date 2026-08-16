export const QUALITY_REASON_CODES = Object.freeze({
  OK: "OK",
  NO_FACE: "NO_FACE",
  MULTIPLE_FACES: "MULTIPLE_FACES",
  MISSING_LANDMARKS: "MISSING_LANDMARKS",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  OFF_CENTER: "OFF_CENTER",
  BAD_DISTANCE: "BAD_DISTANCE",
  LOWER_FACE_UNSTABLE: "LOWER_FACE_UNSTABLE",
  IMAGE_TOO_DARK: "IMAGE_TOO_DARK",
  IMAGE_TOO_BRIGHT: "IMAGE_TOO_BRIGHT",
  IMAGE_LOW_CONTRAST: "IMAGE_LOW_CONTRAST",
  IMAGE_BLURRY: "IMAGE_BLURRY",
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
  idealMinCoverage: 0.08,
  idealMaxCoverage: 0.42,
  minCoverage: 0.035,
  maxCoverage: 0.62,
  burstMinSamples: 8,
  burstMinConfidence: 0.25,
  burstCenterOffsetMax: 0.22,
  burstMinCoverage: 0.03,
  burstMaxCoverage: 0.66,
  minBrightness: 38,
  maxBrightness: 222,
  minContrast: 18,
  minSharpness: 12,
  maxLowerFaceChinOffsetRatio: 0.16,
  minLowerFaceChinDepthRatio: 0.08,
  maxLowerFaceChinDepthRatio: 0.38,
  maxLowerFaceJawChinAsymmetryRatio: 0.32,
  maxLowerFaceJawWidthRangeRatio: 0.1
});

export const HARD_REJECT_REASON_CODES = Object.freeze([
  QUALITY_REASON_CODES.NO_FACE,
  QUALITY_REASON_CODES.MULTIPLE_FACES,
  QUALITY_REASON_CODES.MISSING_LANDMARKS,
  "FACE_TRACKING_ERROR",
  QUALITY_REASON_CODES.BAD_YAW,
  QUALITY_REASON_CODES.BAD_ROLL,
  QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE,
  QUALITY_REASON_CODES.IMAGE_TOO_DARK,
  QUALITY_REASON_CODES.IMAGE_TOO_BRIGHT,
  QUALITY_REASON_CODES.IMAGE_LOW_CONTRAST,
  QUALITY_REASON_CODES.IMAGE_BLURRY,
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
  const imageQualityReason = getImageQualityRejectionReason(quality.imageQuality, config);
  const lowerFaceReason = getLowerFaceGeometryRejectionReason(quality, config);
  const centerOk = centerOffsetX <= config.centerOffsetMax && centerOffsetY <= config.centerOffsetMax;
  const distanceBand = getDistanceBand(coverage, config);
  const distanceOk = distanceBand !== "blocked";
  const imageOk = !imageQualityReason;
  const lowerFaceOk = !lowerFaceReason;
  const rollOk = Math.abs(Number(pose.rollDeg || 0)) <= config.rollToleranceDeg;
  const confidenceOk = confidence >= config.minFrameConfidence;
  const targetYaw = Number(step?.targetYaw || 0);
  const tolerance = Number(step?.tolerance || config.centerYawToleranceDeg);
  const yawDiff = Math.abs(Number(pose.yawDeg || 0) - targetYaw);
  const yawOk = yawDiff <= tolerance;
  const yawNear = yawDiff <= tolerance + 7;
  const frameOk = centerOk && distanceOk && imageOk && lowerFaceOk && rollOk && confidenceOk;

  if (frameOk && yawOk) {
    return buildFrameQualityResult({
      ready: true,
      near: true,
      status: "hold",
      reason: QUALITY_REASON_CODES.OK,
      detail: distanceBand === "advisory"
        ? "Khoảng cách hơi lệch nhưng khuôn mặt vẫn đủ rõ; giữ nguyên để máy tự chụp."
        : "Giữ nguyên một chút để máy tự chụp.",
      distanceBand
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

  if (!imageOk) {
    return buildFrameQualityResult({
      reason: imageQualityReason,
      detail: "Điều chỉnh ánh sáng để thấy rõ vùng mắt, mũi và viền mặt.",
      timeoutDetail: "Ánh sáng hoặc tương phản ảnh chưa đủ tốt."
    });
  }

  if (!lowerFaceOk) {
    return buildFrameQualityResult({
      reason: lowerFaceReason,
      detail: "Giữ cằm và đường hàm rõ, không che hoặc lệch khỏi khung.",
      timeoutDetail: "Vùng hàm/cằm chưa ổn định."
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

export function getDistanceBand(coverage, config = DEFAULT_SCAN_QUALITY_CONFIG) {
  const value = Number(coverage || 0);
  if (value < config.minCoverage || value > config.maxCoverage) {
    return "blocked";
  }
  if (value < config.idealMinCoverage || value > config.idealMaxCoverage) {
    return "advisory";
  }
  return "ideal";
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
  const imageQualityReason = getImageQualityRejectionReason(quality.imageQuality, config);
  const lowerFaceReason = getLowerFaceGeometryRejectionReason(quality, config);

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

  if (imageQualityReason) {
    return imageQualityReason;
  }

  if (lowerFaceReason) {
    return lowerFaceReason;
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
  const imageQualityReason = getImageQualityRejectionReason(quality.imageQuality, config);
  const lowerFaceReason = getCaptureLowerFaceGeometryRejectionReason(selectedSamples, quality, config);
  const distanceBand = getDistanceBand(Number(quality.coverage || 0), config);
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
      reasonCode: fallbackUsed ? QUALITY_REASON_CODES.FALLBACK_USED : (imageQualityReason || QUALITY_REASON_CODES.LOW_CONFIDENCE),
      passed: Number(quality.confidence || 0) >= 0.5 && !fallbackUsed && !imageQualityReason,
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
      passed: distanceBand !== "blocked",
      value: getDistanceLabel(Number(quality.coverage || 0))
    },
    {
      key: "lowerFaceGeometry",
      label: "Hàm/cằm ổn định",
      reasonCode: QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE,
      passed: !lowerFaceReason,
      value: getLowerFaceGeometryLabel(selectedSamples, quality)
    }
  ];
  const passedCount = checks.filter((item) => item.passed).length;
  const score = clamp01(passedCount / checks.length - (distanceBand === "advisory" ? 0.04 : 0));
  const failed = checks.filter((item) => !item.passed);

  return {
    passed: score >= 0.8
      && checks.find((item) => item.key === "pose")?.passed
      && checks.find((item) => item.key === "landmark")?.passed
      && checks.find((item) => item.key === "distance")?.passed
      && checks.find((item) => item.key === "lowerFaceGeometry")?.passed,
    score,
    checks,
    failedLabels: failed.map((item) => item.label.toLowerCase()),
    reasonCodes: failed.map((item) => item.reasonCode),
    distanceBand,
    warnings: distanceBand === "advisory" ? [QUALITY_REASON_CODES.BAD_DISTANCE] : []
  };
}

function getCaptureLowerFaceGeometryRejectionReason(selectedSamples = [], quality = {}, config = DEFAULT_SCAN_QUALITY_CONFIG) {
  const aggregateReason = getLowerFaceGeometryRejectionReason(quality, config);
  if (aggregateReason) {
    return aggregateReason;
  }

  const geometries = getAvailableLowerFaceGeometries(selectedSamples);
  const frameReason = geometries
    .map((geometry) => getLowerFaceGeometryRejectionReason({ lowerFaceGeometry: geometry }, config))
    .find(Boolean);
  if (frameReason) {
    return frameReason;
  }

  return hasUnstableJawWidthAcrossBurst(geometries, config)
    ? QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE
    : "";
}

function getLowerFaceGeometryRejectionReason(quality = {}, config = DEFAULT_SCAN_QUALITY_CONFIG) {
  const geometry = quality?.lowerFaceGeometry;
  if (!geometry?.available) {
    return "";
  }

  const chinOffsetRatio = Number(geometry.chinOffsetRatio);
  const chinDepthRatio = Number(geometry.chinDepthRatio);
  const jawChinAsymmetryRatio = Number(geometry.jawChinAsymmetryRatio);
  const jawWidthRangeRatio = Number(geometry.jawWidthRangeRatio);

  if (Number.isFinite(chinOffsetRatio) && chinOffsetRatio > config.maxLowerFaceChinOffsetRatio) {
    return QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE;
  }

  if (
    Number.isFinite(chinDepthRatio)
    && (chinDepthRatio < config.minLowerFaceChinDepthRatio || chinDepthRatio > config.maxLowerFaceChinDepthRatio)
  ) {
    return QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE;
  }

  if (
    Number.isFinite(jawChinAsymmetryRatio)
    && jawChinAsymmetryRatio > config.maxLowerFaceJawChinAsymmetryRatio
  ) {
    return QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE;
  }

  if (Number.isFinite(jawWidthRangeRatio) && jawWidthRangeRatio > config.maxLowerFaceJawWidthRangeRatio) {
    return QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE;
  }

  return geometry.passed === false || geometry.reasonCode === QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE
    ? QUALITY_REASON_CODES.LOWER_FACE_UNSTABLE
    : "";
}

function getAvailableLowerFaceGeometries(samples = []) {
  return samples
    .map((sample) => sample?.analysis?.quality?.lowerFaceGeometry)
    .filter((geometry) => geometry?.available);
}

function hasUnstableJawWidthAcrossBurst(geometries = [], config = DEFAULT_SCAN_QUALITY_CONFIG) {
  const jawWidthRatios = geometries
    .map((geometry) => Number(geometry.jawWidthToCheek))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (jawWidthRatios.length < 4) {
    return false;
  }

  return Math.max(...jawWidthRatios) - Math.min(...jawWidthRatios) > config.maxLowerFaceJawWidthRangeRatio;
}

function getLowerFaceGeometryLabel(selectedSamples = [], quality = {}) {
  const geometries = getAvailableLowerFaceGeometries(selectedSamples);
  const jawWidthRatios = geometries
    .map((geometry) => Number(geometry.jawWidthToCheek))
    .filter((value) => Number.isFinite(value) && value > 0);
  const aggregate = quality?.lowerFaceGeometry;

  if (jawWidthRatios.length >= 4) {
    const range = Math.max(...jawWidthRatios) - Math.min(...jawWidthRatios);
    return `${Math.round(range * 100)}% dao động`;
  }

  if (aggregate?.available) {
    return `${Math.round(Number(aggregate.chinOffsetRatio || 0) * 100)}% lệch cằm`;
  }

  return "Chưa có";
}

export function evaluateImageQualityFromImageData(imageData, config = DEFAULT_SCAN_QUALITY_CONFIG) {
  const data = imageData?.data;
  if (!data?.length) {
    return {
      available: false,
      brightness: 0,
      contrast: 0,
      sharpness: 0,
      passed: true,
      reasonCode: ""
    };
  }

  let count = 0;
  let sum = 0;
  let sumSquares = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha === 0) {
      continue;
    }

    const luminance = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
    sum += luminance;
    sumSquares += luminance * luminance;
    count += 1;
  }

  if (!count) {
    return {
      available: false,
      brightness: 0,
      contrast: 0,
      sharpness: 0,
      passed: true,
      reasonCode: ""
    };
  }

  const brightness = sum / count;
  const variance = Math.max(0, sumSquares / count - brightness * brightness);
  const contrast = Math.sqrt(variance);
  const sharpness = calculateEdgeSharpness(imageData);
  const reasonCode = getImageQualityRejectionReason({ brightness, contrast, sharpness, available: true }, config);

  return {
    available: true,
    brightness,
    contrast,
    sharpness,
    passed: !reasonCode,
    reasonCode
  };
}

export function getImageQualityRejectionReason(imageQuality = null, config = DEFAULT_SCAN_QUALITY_CONFIG) {
  if (!imageQuality?.available) {
    return "";
  }

  const brightness = Number(imageQuality.brightness);
  const contrast = Number(imageQuality.contrast);
  const sharpness = Number(imageQuality.sharpness);

  if (Number.isFinite(brightness) && brightness < config.minBrightness) {
    return QUALITY_REASON_CODES.IMAGE_TOO_DARK;
  }

  if (Number.isFinite(brightness) && brightness > config.maxBrightness) {
    return QUALITY_REASON_CODES.IMAGE_TOO_BRIGHT;
  }

  if (Number.isFinite(contrast) && contrast < config.minContrast) {
    return QUALITY_REASON_CODES.IMAGE_LOW_CONTRAST;
  }

  if (Number.isFinite(sharpness) && sharpness < config.minSharpness) {
    return QUALITY_REASON_CODES.IMAGE_BLURRY;
  }

  return "";
}

function calculateEdgeSharpness(imageData) {
  const data = imageData?.data;
  const width = Number(imageData?.width || 0);
  const height = Number(imageData?.height || 0);
  if (!data?.length || !width || !height || width * height < 2) {
    return 255;
  }

  const luminance = new Array(width * height).fill(null);
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4;
    if (data[dataIndex + 3] === 0) {
      continue;
    }
    luminance[pixelIndex] = data[dataIndex] * 0.2126 + data[dataIndex + 1] * 0.7152 + data[dataIndex + 2] * 0.0722;
  }

  const measureAtSpan = (span) => {
    let edgeSum = 0;
    let edgeCount = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const current = luminance[y * width + x];
        if (current === null) continue;

        if (x + span < width) {
          const right = luminance[y * width + x + span];
          if (right !== null) {
            edgeSum += Math.abs(current - right);
            edgeCount += 1;
          }
        }

        if (y + span < height) {
          const down = luminance[(y + span) * width + x];
          if (down !== null) {
            edgeSum += Math.abs(current - down);
            edgeCount += 1;
          }
        }
      }
    }
    return edgeCount ? edgeSum / edgeCount : 0;
  };

  return Math.max(measureAtSpan(1), measureAtSpan(2));
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
  timeoutDetail,
  distanceBand = ""
}) {
  return {
    ready,
    near,
    status,
    reasonCode: reason,
    detail,
    timeoutDetail,
    distanceBand
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
