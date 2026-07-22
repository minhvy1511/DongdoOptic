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
  const confidenceGate = 0.64;
  const marginGate = bestShape === "diamond" ? 0.18 : 0.08;
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
  return Object.entries(scoreRuleBasedShapes(metrics)).sort((a, b) => b[1] - a[1]);
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

function scoreRuleBasedShapes(metrics = {}) {
  const lengthToWidth = Number(metrics.lengthToWidth || 0);
  const foreheadToCheek = Number(metrics.foreheadToCheek || 0);
  const jawToCheek = Number(metrics.jawToCheek || 0);
  const jawToForehead = Number(metrics.jawToForehead || 0);
  const cheekToJaw = Number(metrics.cheekToJaw || 0);

  const longScore = scoreLongFace(lengthToWidth, jawToCheek, foreheadToCheek);
  const roundScore = scoreRoundFace(lengthToWidth, jawToCheek, foreheadToCheek);
  const squareScore = scoreSquareFace(lengthToWidth, jawToCheek, foreheadToCheek);
  const heartScore = scoreHeartFace(lengthToWidth, foreheadToCheek, jawToForehead, jawToCheek);
  const diamondScore = scoreDiamondFace(lengthToWidth, foreheadToCheek, jawToCheek, cheekToJaw);
  const ovalScore = scoreOvalFace(lengthToWidth, foreheadToCheek, jawToCheek);

  return {
    oval: ovalScore,
    round: roundScore,
    square: squareScore,
    long: longScore,
    heart: heartScore,
    diamond: diamondScore
  };
}

function scoreLongFace(lengthToWidth, jawToCheek, foreheadToCheek) {
  const lengthScore = ramp(lengthToWidth, 1.42, 1.64);
  const notTooAngular = 1 - Math.max(
    ramp(jawToCheek, 0.92, 1.02) * 0.35,
    ramp(0.84 - foreheadToCheek, 0, 0.12) * 0.24
  );
  return clamp(lengthScore * 0.86 + notTooAngular * 0.14, 0, 1);
}

function scoreRoundFace(lengthToWidth, jawToCheek, foreheadToCheek) {
  return clamp(
    closeness(lengthToWidth, 1.13, 0.2) * 0.58 +
    clamp((jawToCheek - 0.74) / 0.2, 0, 1) * 0.24 +
    closeness(foreheadToCheek, 0.88, 0.16) * 0.18,
    0,
    1
  );
}

function scoreSquareFace(lengthToWidth, jawToCheek, foreheadToCheek) {
  const jawScore = ramp(jawToCheek, 0.84, 0.96);
  const compactScore = 1 - ramp(lengthToWidth, 1.42, 1.58);
  const foreheadBalance = closeness(foreheadToCheek, 0.9, 0.16);
  return clamp(jawScore * 0.52 + compactScore * 0.3 + foreheadBalance * 0.18, 0, 1);
}

function scoreHeartFace(lengthToWidth, foreheadToCheek, jawToForehead, jawToCheek) {
  const foreheadWide = ramp(foreheadToCheek, 0.95, 1.04);
  const chinNarrow = ramp(0.92 - jawToForehead, 0, 0.16);
  const notRound = ramp(lengthToWidth, 1.22, 1.38);
  const notSquare = 1 - ramp(jawToCheek, 0.9, 1);
  return clamp(foreheadWide * 0.38 + chinNarrow * 0.32 + notRound * 0.18 + notSquare * 0.12, 0, 1);
}

function scoreDiamondFace(lengthToWidth, foreheadToCheek, jawToCheek, cheekToJaw) {
  const cheekBeatsForehead = ramp(0.86 - foreheadToCheek, 0, 0.1);
  const cheekBeatsJaw = ramp(0.76 - jawToCheek, 0, 0.12);
  const cheekDominance = ramp(cheekToJaw, 1.28, 1.42);
  const midLength = closeness(lengthToWidth, 1.34, 0.24);

  if (cheekBeatsForehead < 0.5 || cheekBeatsJaw < 0.5 || cheekDominance < 0.5) {
    return 0.12 * midLength;
  }

  return clamp(
    cheekBeatsForehead * 0.3 +
    cheekBeatsJaw * 0.3 +
    cheekDominance * 0.24 +
    midLength * 0.16,
    0,
    0.92
  );
}

function scoreOvalFace(lengthToWidth, foreheadToCheek, jawToCheek) {
  const lengthScore = closeness(lengthToWidth, 1.38, 0.24);
  const foreheadBalance = closeness(foreheadToCheek, 0.93, 0.16);
  const jawSoftness = closeness(jawToCheek, 0.84, 0.16);
  const notRound = ramp(lengthToWidth, 1.22, 1.34);
  const heartLikePenalty = ramp(foreheadToCheek, 0.98, 1.06) * ramp(0.88 - jawToCheek, 0, 0.12);
  return clamp(
    (lengthScore * 0.4 + foreheadBalance * 0.24 + jawSoftness * 0.22 + notRound * 0.14) *
      (1 - heartLikePenalty * 0.34),
    0,
    1
  );
}

function ramp(value, start, end) {
  return clamp((Number(value || 0) - start) / Math.max(end - start, 0.0001), 0, 1);
}

function closeness(value, target, tolerance) {
  return clamp(1 - Math.abs(Number(value || 0) - target) / tolerance, 0, 1);
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
