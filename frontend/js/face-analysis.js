const LANDMARKS = {
  topFace: 10,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
  leftTemple: 127,
  rightTemple: 356,
  leftJaw: 172,
  rightJaw: 397
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
  const faceHeight = distance(landmarks[LANDMARKS.topFace], landmarks[LANDMARKS.chin]);
  const cheekWidth = distance(landmarks[LANDMARKS.leftCheek], landmarks[LANDMARKS.rightCheek]);
  const foreheadWidth = distance(landmarks[LANDMARKS.leftTemple], landmarks[LANDMARKS.rightTemple]);
  const jawWidth = distance(landmarks[LANDMARKS.leftJaw], landmarks[LANDMARKS.rightJaw]);

  if (!faceHeight || !cheekWidth || !foreheadWidth || !jawWidth) {
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
    faceBox: faceBox
  };
  quality.confidence = calculateConfidence(quality);

  const shape = classifyShape({
    lengthToWidth,
    jawToCheek,
    foreheadToCheek,
    jawToForehead
  });
  const diagnostics = buildDiagnostics({
    metrics: {
      lengthToWidth,
      foreheadToCheek,
      jawToCheek,
      jawToForehead,
      cheekToJaw
    },
    quality,
    shape
  });

  return {
    shape,
    label: FACE_SHAPE_LABELS[shape],
    metrics: {
      lengthToWidth,
      foreheadToCheek,
      jawToCheek,
      jawToForehead,
      cheekToJaw
    },
    quality,
    diagnostics,
    warnings: diagnostics.warnings
  };
}

export function getFaceShapeLabel(shape) {
  return FACE_SHAPE_LABELS[shape] ?? FACE_SHAPE_LABELS.unknown;
}

function classifyShape(metrics) {
  const { lengthToWidth, jawToCheek, foreheadToCheek, jawToForehead } = metrics;

  if (lengthToWidth >= 1.52) {
    return "long";
  }

  if (lengthToWidth <= 1.22 && jawToCheek >= 0.82 && foreheadToCheek >= 0.84) {
    return "round";
  }

  if (jawToCheek >= 0.9 && foreheadToCheek >= 0.88 && lengthToWidth <= 1.42) {
    return "square";
  }

  if (foreheadToCheek >= 0.92 && jawToForehead <= 0.82 && jawToCheek <= 0.9) {
    return "heart";
  }

  if (foreheadToCheek <= 0.86 && jawToCheek <= 0.8) {
    return "diamond";
  }

  return "oval";
}

function distance(pointA, pointB) {
  if (!pointA || !pointB) {
    return 0;
  }

  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildDiagnostics({ metrics, quality, shape }) {
  const warnings = [];
  const centerLabel = getCenterLabel(quality);
  const distanceLabel = getDistanceLabel(quality.coverage);
  const confidence = quality.confidence || 0;
  const balance = quality.symmetryScore || 0;

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
  const targets = {
    long: 1.7,
    round: 1.12,
    square: 1.28,
    heart: 1.35,
    diamond: 1.34,
    oval: 1.42,
    unknown: 1.32
  };

  return targets[shape] ?? targets.unknown;
}

function idealForeheadRatio(shape) {
  const targets = {
    long: 0.92,
    round: 0.96,
    square: 0.98,
    heart: 1.04,
    diamond: 0.86,
    oval: 0.94,
    unknown: 0.94
  };

  return targets[shape] ?? targets.unknown;
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
