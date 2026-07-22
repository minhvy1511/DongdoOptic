import { PUBLIC_FACE_SHAPE_CALIBRATION, getCalibrationSourceLabel } from "./face-calibration.js?v=20260721-40";

const LANDMARKS = {
  topFace: 10,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
  leftBrowOuter: 70,
  rightBrowOuter: 300,
  leftTemple: 127,
  rightTemple: 356,
  leftJaw: 172,
  rightJaw: 397
};

const HEAD_POSE_LANDMARKS = {
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  noseTip: 1
};

const FACE_SHAPE_LABELS = {
  oval: "Trái xoan",
  round: "Tròn",
  square: "Vuông",
  long: "Dài",
  heart: "Trái tim",
  diamond: "Kim cương",
  unknown: "Chưa rõ"
};

export function analyzeFaceShape(landmarks) {
  if (!landmarks?.length) {
    return emptyAnalysis();
  }

  const faceBox = getFaceBox(landmarks);
  const browCenter = midpoint(landmarks[LANDMARKS.leftBrowOuter], landmarks[LANDMARKS.rightBrowOuter]);
  const browToChin = distance(browCenter, landmarks[LANDMARKS.chin]);
  const faceHeight = browToChin * 1.42;
  const cheekWidth = distance(landmarks[LANDMARKS.leftCheek], landmarks[LANDMARKS.rightCheek]);
  const foreheadWidth = distance(landmarks[LANDMARKS.leftBrowOuter], landmarks[LANDMARKS.rightBrowOuter])
    || distance(landmarks[LANDMARKS.leftTemple], landmarks[LANDMARKS.rightTemple]);
  const jawWidth = distance(landmarks[LANDMARKS.leftJaw], landmarks[LANDMARKS.rightJaw]);

  if (!browToChin || !faceHeight || !cheekWidth || !foreheadWidth || !jawWidth) {
    return emptyAnalysis();
  }

  const lengthToWidth = faceHeight / cheekWidth;
  const jawToCheek = jawWidth / cheekWidth;
  const foreheadToCheek = foreheadWidth / cheekWidth;
  const jawToForehead = jawWidth / foreheadWidth;
  const cheekToJaw = cheekWidth / Math.max(jawWidth, 0.0001);
  const quality = {
    centerOffsetX: Math.abs(faceBox.centerX - 0.5),
    centerOffsetY: Math.abs(faceBox.centerY - 0.5),
    coverage: faceBox.width * faceBox.height,
    symmetryScore: calculateSymmetryScore(landmarks),
    measurementSource: "brow_to_chin_estimate",
    faceBox: faceBox
  };
  quality.confidence = calculateConfidence(quality);

  const metrics = {
    lengthToWidth,
    jawToCheek,
    foreheadToCheek,
    jawToForehead,
    cheekToJaw
  };
  const classification = getClassificationDetail(metrics);
  const shape = classification.shape;
  const diagnostics = buildDiagnostics({
    metrics,
    quality,
    shape,
    classification
  });

  return {
    shape,
    label: FACE_SHAPE_LABELS[shape],
    metrics,
    quality,
    diagnostics,
    warnings: diagnostics.warnings
  };
}

export function getFaceShapeLabel(shape) {
  return FACE_SHAPE_LABELS[shape] ?? FACE_SHAPE_LABELS.unknown;
}

export function classifyFaceShapeFromMetrics(metrics) {
  return classifyShape(metrics);
}

export function getClassificationDetail(metrics) {
  const ordered = getShapeCandidates(metrics);
  const [bestShape, bestScore] = ordered[0] || ["unknown", 0];
  const [secondShape, secondScore] = ordered[1] || ["unknown", 0];
  const margin = bestScore - secondScore;
  const confidenceGate = PUBLIC_FACE_SHAPE_CALIBRATION.scoreGates.confidence;
  const marginGate = PUBLIC_FACE_SHAPE_CALIBRATION.scoreGates.margin;
  const claritySpan = PUBLIC_FACE_SHAPE_CALIBRATION.scoreGates.claritySpan;
  const clarity = clamp((margin - marginGate) / claritySpan, 0, 1) * clamp(bestScore / 0.84, 0, 1);
  const shape = bestScore < confidenceGate || margin < marginGate ? "unknown" : bestShape;

  return {
    shape,
    bestShape,
    secondShape,
    bestScore,
    secondScore,
    margin,
    clarity,
    calibrationSource: getCalibrationSourceLabel(),
    candidates: ordered.map(([name, score]) => ({ name, score }))
  };
}

export function estimateHeadPose(landmarks) {
  const leftEye = landmarks?.[HEAD_POSE_LANDMARKS.leftEyeOuter];
  const rightEye = landmarks?.[HEAD_POSE_LANDMARKS.rightEyeOuter];
  const noseTip = landmarks?.[HEAD_POSE_LANDMARKS.noseTip];

  if (!leftEye || !rightEye || !noseTip) {
    return emptyHeadPose();
  }

  const eyeDistance = distance(leftEye, rightEye);
  if (!eyeDistance) {
    return emptyHeadPose();
  }

  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const yawOffset = (noseTip.x - eyeCenterX) / eyeDistance;
  const yawDeg = clamp(yawOffset * 65, -35, 35);
  const rollDeg = clamp(Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI), -25, 25);

  return {
    yawDeg,
    rollDeg,
    yawOffset,
    eyeDistance,
    centerX: eyeCenterX,
    centerY: eyeCenterY,
    confidence: clamp(1 - Math.min(1, Math.abs(yawDeg) / 40) * 0.35 - Math.min(1, Math.abs(rollDeg) / 30) * 0.2, 0, 1)
  };
}

function classifyShape(metrics) {
  return getClassificationDetail(metrics).shape;
}

function getShapeCandidates(metrics) {
  const candidates = Object.fromEntries(
    Object.entries(PUBLIC_FACE_SHAPE_CALIBRATION.shapeTargets).map(([shape, profile]) => [
      shape,
      scoreCalibratedShape(metrics, profile)
    ])
  );

  return Object.entries(applyShapeGuardrails(metrics, candidates)).sort((a, b) => b[1] - a[1]);
}

function emptyHeadPose() {
  return {
    yawDeg: 0,
    rollDeg: 0,
    yawOffset: 0,
    eyeDistance: 0,
    centerX: 0.5,
    centerY: 0.5,
    confidence: 0
  };
}

function distance(pointA, pointB) {
  if (!pointA || !pointB) {
    return 0;
  }

  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

function midpoint(pointA, pointB) {
  if (!pointA || !pointB) {
    return null;
  }

  return {
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2
  };
}

function getFaceBox(landmarks) {
  const xs = landmarks.map((point) => point?.x).filter((value) => Number.isFinite(value));
  const ys = landmarks.map((point) => point?.y).filter((value) => Number.isFinite(value));

  if (!xs.length || !ys.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, centerX: 0.5, centerY: 0.5 };
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2
  };
}

function calculateSymmetryScore(landmarks) {
  const cheekBalance = pairBalance(landmarks[LANDMARKS.leftCheek], landmarks[LANDMARKS.rightCheek]);
  const templeBalance = pairBalance(landmarks[LANDMARKS.leftTemple], landmarks[LANDMARKS.rightTemple]);
  const jawBalance = pairBalance(landmarks[LANDMARKS.leftJaw], landmarks[LANDMARKS.rightJaw]);
  return clamp(1 - ((cheekBalance + templeBalance + jawBalance) / 3) * 1.9, 0, 1);
}

function calculateConfidence(quality) {
  const coverageScore = clamp((quality.coverage - 0.07) / 0.22, 0, 1);
  const centerScore = clamp(1 - ((quality.centerOffsetX + quality.centerOffsetY) / 2) * 5.5, 0, 1);
  const balanceScore = clamp(1 - Math.abs((quality.centerOffsetX || 0) - (quality.centerOffsetY || 0)) * 4, 0, 1);
  return clamp(
    coverageScore * 0.34 +
    centerScore * 0.3 +
    quality.symmetryScore * 0.22 +
    balanceScore * 0.14,
    0,
    1
  );
}

function pairBalance(pointA, pointB) {
  if (!pointA || !pointB) {
    return 1;
  }

  return Math.min(1, Math.hypot(Math.abs(pointA.x - pointB.x), Math.abs(pointA.y - pointB.y)));
}

function scoreShapeMatch(metrics, targets) {
  const scores = Object.entries(targets).map(([name, [target, tolerance, weight = 1]]) => {
    const value = Number(metrics?.[name] || 0);
    if (!value) {
      return 0.55 * weight;
    }

    return clamp(1 - Math.abs(value - target) / tolerance, 0, 1) * weight;
  });

  if (!scores.length) {
    return 0;
  }

  const totalWeight = Object.values(targets).reduce((sum, [, , weight = 1]) => sum + weight, 0);
  const averageScore = scores.reduce((sum, value) => sum + value, 0) / Math.max(totalWeight, 0.0001);
  const weakestScore = Math.min(...scores);
  return clamp(averageScore * 0.82 + weakestScore * 0.18, 0, 1);
}

function scoreCalibratedShape(metrics, profile = {}) {
  const baseScore = scoreShapeMatch(metrics, profile.targets || {});
  const evidenceScore = scoreEvidence(metrics, profile.evidence || {});
  return clamp(baseScore * evidenceScore * Number(profile.prior || 1), 0, 1);
}

function applyShapeGuardrails(metrics, candidates = {}) {
  const guarded = { ...candidates };
  const diamondEvidence = getDiamondSpecificEvidence(metrics);
  const sortedWithoutDiamond = Object.entries(guarded)
    .filter(([shape]) => shape !== "diamond")
    .sort((a, b) => b[1] - a[1]);
  const [, nextBestScore = 0] = sortedWithoutDiamond[0] || [];
  const diamondScore = Number(guarded.diamond || 0);
  const diamondMargin = diamondScore - nextBestScore;

  // MediaPipe jaw landmarks often sit inside the real gonion line. Without this
  // guard, many ordinary oval/round faces look like "wide cheek + narrow jaw".
  if (diamondScore > 0 && (diamondEvidence < 0.78 || diamondMargin < 0.16)) {
    guarded.diamond = diamondScore * clamp(0.52 + diamondEvidence * 0.34 + Math.max(diamondMargin, 0) * 0.5, 0.45, 0.82);
  }

  return guarded;
}

function getDiamondSpecificEvidence(metrics = {}) {
  const lengthToWidth = Number(metrics.lengthToWidth || 0);
  const foreheadToCheek = Number(metrics.foreheadToCheek || 0);
  const jawToCheek = Number(metrics.jawToCheek || 0);
  const cheekToJaw = Number(metrics.cheekToJaw || 0);
  const cheekDominatesForehead = clamp((0.92 - foreheadToCheek) / 0.12, 0, 1);
  const cheekDominatesJaw = clamp((0.84 - jawToCheek) / 0.14, 0, 1);
  const cheekToJawStrength = clamp((cheekToJaw - 1.18) / 0.18, 0, 1);
  const balancedLength = clamp(1 - Math.abs(lengthToWidth - 1.34) / 0.28, 0, 1);

  return clamp(
    cheekDominatesForehead * 0.34 +
    cheekDominatesJaw * 0.28 +
    cheekToJawStrength * 0.24 +
    balancedLength * 0.14,
    0,
    1
  );
}

function scoreEvidence(metrics, evidence = {}) {
  const checks = [];

  if (Number.isFinite(evidence.minLengthToWidth)) {
    checks.push(edgeScore(metrics.lengthToWidth, evidence.minLengthToWidth, "min", 0.1));
  }

  if (Number.isFinite(evidence.maxLengthToWidth)) {
    checks.push(edgeScore(metrics.lengthToWidth, evidence.maxLengthToWidth, "max", 0.1));
  }

  if (Number.isFinite(evidence.minJawToCheek)) {
    checks.push(edgeScore(metrics.jawToCheek, evidence.minJawToCheek, "min", 0.08));
  }

  if (Number.isFinite(evidence.maxJawToCheek)) {
    checks.push(edgeScore(metrics.jawToCheek, evidence.maxJawToCheek, "max", 0.08));
  }

  if (Number.isFinite(evidence.minForeheadToCheek)) {
    checks.push(edgeScore(metrics.foreheadToCheek, evidence.minForeheadToCheek, "min", 0.08));
  }

  if (Number.isFinite(evidence.maxForeheadToCheek)) {
    checks.push(edgeScore(metrics.foreheadToCheek, evidence.maxForeheadToCheek, "max", 0.08));
  }

  if (Number.isFinite(evidence.maxJawToForehead)) {
    checks.push(edgeScore(metrics.jawToForehead, evidence.maxJawToForehead, "max", 0.08));
  }

  if (Number.isFinite(evidence.minCheekToJaw)) {
    checks.push(edgeScore(metrics.cheekToJaw, evidence.minCheekToJaw, "min", 0.12));
  }

  if (!checks.length) {
    return 1;
  }

  return clamp(checks.reduce((sum, value) => sum + value, 0) / checks.length, 0.45, 1);
}

function edgeScore(value, edge, direction, softness) {
  const metricValue = Number(value || 0);
  if (!metricValue) {
    return 0.7;
  }

  const delta = direction === "min" ? metricValue - edge : edge - metricValue;
  return clamp(0.7 + delta / softness * 0.3, 0.55, 1);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildDiagnostics({ metrics, quality, shape, classification = null }) {
  const warnings = [];
  const centerLabel = getCenterLabel(quality);
  const distanceLabel = getDistanceLabel(quality.coverage);
  const confidence = quality.confidence || 0;
  const balance = quality.symmetryScore || 0;
  const classificationDetail = classification || getClassificationDetail(metrics);

  if (quality.coverage < 0.08) {
    warnings.push("Khuôn mặt còn quá nhỏ trong khung.");
  } else if (quality.coverage > 0.4) {
    warnings.push("Khuôn mặt đang quá gần camera.");
  }

  if (quality.centerOffsetX > 0.16) {
    warnings.push("Mặt đang lệch ngang khỏi tâm khung.");
  }

  if (quality.centerOffsetY > 0.16) {
    warnings.push("Mặt đang lệch dọc khỏi tâm khung.");
  }

  if (balance < 0.52) {
    warnings.push("Độ đối xứng chưa đủ tốt để chốt dáng mặt.");
  }

  if (confidence < 0.55) {
    warnings.push("Tín hiệu khuôn mặt còn yếu, nên giữ yên thêm.");
  }

  if (classificationDetail.clarity < 0.45) {
    warnings.push(`Ranh giới dạng mặt còn mập mờ giữa ${getFaceShapeLabel(classificationDetail.bestShape)} và ${getFaceShapeLabel(classificationDetail.secondShape)}.`);
  }

  const readinessScore = clamp(
    confidence * 0.48 +
    balance * 0.24 +
    clamp(1 - Math.abs(metrics.lengthToWidth - idealLengthRatio(shape)) / 0.55, 0, 1) * 0.16 +
    clamp(1 - Math.abs(metrics.foreheadToCheek - idealForeheadRatio(shape)) / 0.28, 0, 1) * 0.12,
    0,
    1
  );

  return {
    confidenceBand: getConfidenceBand(confidence),
    distanceLabel,
    centerLabel,
    ready: readinessScore >= 0.7 && confidence >= 0.52,
    readinessScore,
    classification: classificationDetail,
    calibrationSource: getCalibrationSourceLabel(),
    measurementSource: "center_browline_estimated_height",
    warnings: warnings.slice(0, 3),
    summary: warnings[0] || (shape === "unknown" ? "Cần thêm tín hiệu khuôn mặt." : "Khung đo đã sẵn sàng.")
  };
}

function getCenterLabel(quality = {}) {
  const offsetX = Number(quality.centerOffsetX || 0);
  const offsetY = Number(quality.centerOffsetY || 0);

  if (offsetX <= 0.07 && offsetY <= 0.07) {
    return "Rất giữa";
  }

  if (offsetX <= 0.12 && offsetY <= 0.12) {
    return "Khá giữa";
  }

  if (offsetX > offsetY) {
    return offsetX > 0.18 ? "Lệch ngang nhiều" : "Lệch ngang nhẹ";
  }

  return offsetY > 0.18 ? "Lệch dọc nhiều" : "Lệch dọc nhẹ";
}

function getDistanceLabel(coverage = 0) {
  if (coverage < 0.08) {
    return "Quá xa";
  }

  if (coverage < 0.11) {
    return "Hơi xa";
  }

  if (coverage <= 0.34) {
    return "Đúng khoảng";
  }

  if (coverage <= 0.4) {
    return "Hơi gần";
  }

  return "Quá gần";
}

function getConfidenceBand(confidence = 0) {
  if (confidence >= 0.8) {
    return "Rất tốt";
  }

  if (confidence >= 0.65) {
    return "Tốt";
  }

  if (confidence >= 0.5) {
    return "Trung bình";
  }

  return "Yếu";
}

function idealLengthRatio(shape) {
  return PUBLIC_FACE_SHAPE_CALIBRATION.shapeTargets[shape]?.targets?.lengthToWidth?.[0] ?? 1.32;
}

function idealForeheadRatio(shape) {
  return PUBLIC_FACE_SHAPE_CALIBRATION.shapeTargets[shape]?.targets?.foreheadToCheek?.[0] ?? 0.94;
}

function emptyAnalysis() {
  return {
    shape: "unknown",
    label: FACE_SHAPE_LABELS.unknown,
    metrics: {
      lengthToWidth: 0,
      foreheadToCheek: 0,
      jawToCheek: 0,
      jawToForehead: 0,
      cheekToJaw: 0
    },
    quality: {
      centerOffsetX: 0,
      centerOffsetY: 0,
      coverage: 0,
      symmetryScore: 0,
      confidence: 0,
      faceBox: {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        width: 0,
        height: 0,
        centerX: 0.5,
        centerY: 0.5
      }
    },
    diagnostics: {
      confidenceBand: "Yếu",
      distanceLabel: "Chưa thấy",
      centerLabel: "Chưa thấy",
      ready: false,
      readinessScore: 0,
      warnings: [],
      summary: "Cần đưa mặt vào khung."
    },
    warnings: []
  };
}
