export const FRAME_SCORE_WEIGHTS = Object.freeze({
  availability: 15,
  faceCompatibility: 20,
  fit: 20,
  prescription: 15,
  purpose: 15,
  budget: 10,
  style: 5
});

const TOTAL_WEIGHT = Object.values(FRAME_SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
const NEUTRAL_SCORE = 0.62;

const FACE_SHAPE_COMPATIBILITY = Object.freeze({
  oval: { browline: 0.95, rectangle: 0.87, "rounded-square": 0.9, oval: 0.86, round: 0.75, wellington: 0.78, rimless: 0.78 },
  round: { rectangle: 0.88, "rounded-square": 0.92, browline: 0.86, geometric: 0.84, wellington: 0.78, oval: 0.68, round: 0.48 },
  square: { round: 0.95, oval: 0.92, aviator: 0.88, rimless: 0.84, "rounded-square": 0.72, rectangle: 0.48 },
  long: { wellington: 0.95, aviator: 0.9, round: 0.86, oval: 0.82, browline: 0.74, rectangle: 0.55 },
  heart: { rectangle: 0.88, oval: 0.88, aviator: 0.84, "cat-eye": 0.84, rimless: 0.76, browline: 0.58 },
  diamond: { oval: 0.95, "cat-eye": 0.9, browline: 0.84, "rounded-square": 0.82, rimless: 0.8, rectangle: 0.62 },
  triangle: { browline: 0.95, "cat-eye": 0.9, aviator: 0.84, "half-rim": 0.84, "rounded-square": 0.72, rimless: 0.64 }
});

const PURPOSE_TAGS = Object.freeze({
  daily: ["daily", "lightweight", "minimal"],
  office: ["office", "daily", "minimal", "classic"],
  screen: ["office", "daily", "lightweight"],
  active: ["active", "sport", "lightweight", "child-friendly"],
  fashion: ["fashion", "bold", "premium"],
  reading: ["daily", "classic", "lightweight"]
});

const BUDGET_BANDS = Object.freeze({
  low: { target: 500000, max: 800000 },
  medium: { target: 900000, max: 1500000 },
  balanced: { target: 900000, max: 1500000 },
  high: { target: 1500000, max: 2500000 },
  premium: { target: 2200000, max: Number.POSITIVE_INFINITY }
});

export function scoreFrame(frame = {}, customerProfile = {}, visionProfile = {}) {
  const reasons = [];
  const warnings = [];
  const components = {};

  const availability = scoreAvailability(frame, warnings, reasons);
  components.availability = availability.points;

  if (!availability.eligible) {
    return {
      eligible: false,
      totalScore: 0,
      confidence: "low",
      components,
      reasons,
      warnings
    };
  }

  const face = scoreFaceCompatibility(frame, visionProfile, warnings, reasons);
  const fit = scoreFit(frame, customerProfile, warnings, reasons);
  const prescription = scorePrescription(frame, customerProfile, warnings, reasons);
  const purpose = scorePurpose(frame, customerProfile, warnings, reasons);
  const budget = scoreBudget(frame, customerProfile, warnings, reasons);
  const style = scoreStyle(frame, customerProfile, reasons);

  components.faceCompatibility = face.points;
  components.fit = fit.points;
  components.prescription = prescription.points;
  components.purpose = purpose.points;
  components.budget = budget.points;
  components.style = style.points;

  const totalScore = clamp(
    Object.values(components).reduce((sum, value) => sum + Number(value || 0), 0),
    0,
    TOTAL_WEIGHT
  );

  const confidence = classifyConfidence([
    availability.confidence,
    face.confidence,
    fit.confidence,
    prescription.confidence,
    purpose.confidence,
    budget.confidence,
    style.confidence
  ]);

  return {
    eligible: true,
    totalScore: roundScore(totalScore),
    confidence,
    components: roundComponents(components),
    reasons: uniqueList(reasons).slice(0, 3),
    warnings: uniqueList(warnings).slice(0, 5)
  };
}

export function rankFrames(frames = [], customerProfile = {}, visionProfile = {}) {
  return frames
    .map((frame) => ({
      frame,
      score: scoreFrame(frame, customerProfile, visionProfile)
    }))
    .sort((a, b) => b.score.totalScore - a.score.totalScore)
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }));
}

function scoreAvailability(frame, warnings, reasons) {
  if (frame.available === false) {
    warnings.push("Gọng hiện không khả dụng.");
    return { eligible: false, points: 0, confidence: 1 };
  }

  if (frame.stock === 0) {
    warnings.push("Gọng hết tồn kho.");
    return { eligible: false, points: 0, confidence: 1 };
  }

  if (frame.available === true) {
    reasons.push("Gọng đang khả dụng để tư vấn.");
    return { eligible: true, points: FRAME_SCORE_WEIGHTS.availability, confidence: frame.stock == null ? 0.75 : 1 };
  }

  warnings.push("Chưa rõ trạng thái khả dụng của gọng.");
  return { eligible: true, points: FRAME_SCORE_WEIGHTS.availability * 0.55, confidence: 0.35 };
}

function scoreFaceCompatibility(frame, visionProfile, warnings, reasons) {
  const faceShape = normalizeToken(visionProfile.faceShape || visionProfile.face_shape || visionProfile.shape);
  const frameShape = normalizeFrameShape(frame.shape);
  const confidence = normalizeConfidence(
    visionProfile.faceShapeConfidence ?? visionProfile.confidence ?? visionProfile.face_shape_confidence
  );

  if (!faceShape || faceShape === "unknown" || !frameShape) {
    warnings.push("Chưa đủ dữ liệu VisionID để chấm độ hợp dáng mặt.");
    return {
      points: FRAME_SCORE_WEIGHTS.faceCompatibility * NEUTRAL_SCORE,
      confidence: 0.25
    };
  }

  const compatibility = FACE_SHAPE_COMPATIBILITY[faceShape]?.[frameShape] ?? 0.65;
  const effectiveCompatibility = NEUTRAL_SCORE * (1 - confidence) + compatibility * confidence;
  if (confidence < 0.55) {
    warnings.push("VisionID confidence thấp, điểm dáng mặt đã được giảm ảnh hưởng.");
  }
  if (effectiveCompatibility >= 0.78) {
    reasons.push("Form gọng tương thích tốt với tín hiệu khuôn mặt.");
  }

  return {
    points: FRAME_SCORE_WEIGHTS.faceCompatibility * effectiveCompatibility,
    confidence: Math.max(0.2, confidence)
  };
}

function scoreFit(frame, customerProfile, warnings, reasons) {
  const pd = positiveNumber(customerProfile.pd ?? customerProfile.prescription?.pd);
  const lensWidth = positiveNumber(frame.lens_width_mm ?? frame.lensWidthMm);
  const bridgeWidth = positiveNumber(frame.bridge_width_mm ?? frame.bridgeWidthMm);
  const frameWidth = positiveNumber(frame.frame_width_mm ?? frame.frameWidthMm);

  let score = NEUTRAL_SCORE;
  let confidence = 0.35;

  if (pd && lensWidth && bridgeWidth) {
    const decentration = Math.abs(lensWidth + bridgeWidth - pd) / 2;
    confidence += 0.35;
    if (decentration <= 1) {
      score = 0.95;
      reasons.push("PD và lens/bridge cho lệch tâm rất đẹp.");
    } else if (decentration <= 3) {
      score = 0.84;
      reasons.push("PD và lens/bridge nằm trong vùng dễ fitting.");
    } else if (decentration <= 5) {
      score = 0.58;
      warnings.push("Cần kiểm tra lệch tâm khi thử gọng thật.");
    } else {
      score = 0.34;
      warnings.push("Lệch tâm dự kiến cao, nên đo fitting kỹ trước khi chốt.");
    }
  } else {
    warnings.push("Thiếu PD hoặc lens/bridge nên fit score đang ở mức trung tính.");
  }

  if (frameWidth) {
    confidence += 0.15;
  } else {
    warnings.push("Thiếu frame_width_mm, chưa đánh giá được bề ngang gọng.");
  }

  return {
    points: FRAME_SCORE_WEIGHTS.fit * score,
    confidence: clamp01(confidence)
  };
}

function scorePrescription(frame, customerProfile, warnings, reasons) {
  const prescription = customerProfile.prescription || customerProfile;
  const sph = Math.abs(Number(prescription.sph ?? prescription.SPH ?? 0));
  const cyl = Math.abs(Number(prescription.cyl ?? prescription.CYL ?? 0));
  const hasPrescription = Boolean(prescription.has_prescription || customerProfile.has_prescription || sph || cyl);
  const power = Math.max(sph, cyl);

  if (!hasPrescription) {
    warnings.push("Chưa có đơn kính, điểm kỹ thuật theo độ chưa được cá nhân hóa.");
    return {
      points: FRAME_SCORE_WEIGHTS.prescription * NEUTRAL_SCORE,
      confidence: 0.25
    };
  }

  const lensWidth = positiveNumber(frame.lens_width_mm);
  const lensHeight = positiveNumber(frame.lens_height_mm);
  const rimType = normalizeToken(frame.rim_type);
  let score = 0.76;

  if (power >= 4) {
    score = 0.72;
    if (rimType === "full-rim") score += 0.12;
    if (rimType === "rimless") score -= 0.24;
    if (lensWidth && lensWidth <= 51) score += 0.1;
    if (lensWidth && lensWidth >= 54) score -= 0.14;
    if (lensHeight && lensHeight >= 44) score -= 0.06;
    if (score >= 0.82) {
      reasons.push("Đơn cao được ưu tiên gọng nhỏ/vừa và full-rim hơn.");
    } else {
      warnings.push("Đơn cao cần kiểm tra kích thước tròng và kiểu viền khi thử.");
    }
  } else {
    reasons.push("Đơn kính không tạo ràng buộc kỹ thuật lớn cho gọng này.");
  }

  return {
    points: FRAME_SCORE_WEIGHTS.prescription * clamp01(score),
    confidence: 0.85
  };
}

function scorePurpose(frame, customerProfile, warnings, reasons) {
  const purpose = normalizeToken(customerProfile.purpose || customerProfile.need || customerProfile.needs || customerProfile.occupation);
  const tags = normalizedTags(frame.style_tags);
  const material = normalizeToken(frame.material);

  if (!purpose) {
    warnings.push("Chưa có nhu cầu sử dụng, điểm lifestyle ở mức trung tính.");
    return {
      points: FRAME_SCORE_WEIGHTS.purpose * NEUTRAL_SCORE,
      confidence: 0.35
    };
  }

  const preferredTags = PURPOSE_TAGS[purpose] || [purpose];
  let matches = preferredTags.filter((tag) => tags.includes(tag)).length;
  if (purpose === "active" && ["tr90", "ultem"].includes(material)) matches += 1;
  if (purpose === "fashion" && ["acetate"].includes(material)) matches += 1;
  if (purpose === "office" && ["titanium", "metal-alloy", "rimless"].includes(material)) matches += 0.5;

  const score = clamp(0.48 + matches * 0.18, 0.35, 0.96);
  if (score >= 0.78) {
    reasons.push("Chất liệu/phong cách phù hợp nhu cầu sử dụng.");
  }

  return {
    points: FRAME_SCORE_WEIGHTS.purpose * score,
    confidence: 0.8
  };
}

function scoreBudget(frame, customerProfile, warnings, reasons) {
  const price = nonNegativeNumber(frame.price);
  const hardMax = positiveNumber(customerProfile.maxBudget ?? customerProfile.budget_max ?? customerProfile.hardMaxBudget);
  const budget = normalizeToken(customerProfile.budget || customerProfile.budgetRange);

  if (price == null) {
    warnings.push("Thiếu giá gọng, điểm ngân sách ở mức trung tính.");
    return {
      points: FRAME_SCORE_WEIGHTS.budget * NEUTRAL_SCORE,
      confidence: 0.25
    };
  }

  if (hardMax && price > hardMax) {
    warnings.push("Giá vượt ngân sách tối đa khách đặt ra.");
    return {
      points: FRAME_SCORE_WEIGHTS.budget * 0.12,
      confidence: 0.95
    };
  }

  const band = BUDGET_BANDS[budget];
  if (!band) {
    warnings.push("Chưa có ngân sách, điểm giá ở mức trung tính.");
    return {
      points: FRAME_SCORE_WEIGHTS.budget * NEUTRAL_SCORE,
      confidence: 0.35
    };
  }

  let score;
  if (price <= band.max) {
    const distance = Math.abs(price - band.target) / Math.max(band.target, 1);
    score = clamp(0.92 - distance * 0.35, 0.55, 0.96);
    reasons.push("Giá nằm trong vùng ngân sách đã chọn.");
  } else {
    score = clamp(0.46 - (price - band.max) / Math.max(band.max, 1) * 0.25, 0.2, 0.46);
    warnings.push("Giá cao hơn vùng ngân sách ưu tiên.");
  }

  return {
    points: FRAME_SCORE_WEIGHTS.budget * score,
    confidence: 0.9
  };
}

function scoreStyle(frame, customerProfile, reasons) {
  const preference = normalizeToken(
    customerProfile.frame_preference
    || customerProfile.stylePreference
    || customerProfile.style
    || customerProfile.preferredShape
  );
  const preferredShapes = normalizedTags(customerProfile.preferredShapes || customerProfile.preferred_shapes);
  const preferredMaterials = normalizedTags(customerProfile.preferredMaterials || customerProfile.preferred_materials);
  const preferredColors = normalizedTags(customerProfile.preferredColors || customerProfile.preferred_colors);
  const tags = normalizedTags(frame.style_tags);
  const shape = normalizeFrameShape(frame.shape);
  const material = normalizeToken(frame.material);
  const color = normalizeToken(frame.color_family || frame.color);

  let score = NEUTRAL_SCORE;
  let confidence = 0.35;

  if (preference) {
    confidence = 0.75;
    if (tags.includes(preference) || shape === preference || material === preference || color === preference) {
      score += 0.22;
    }
    if (preference === "light" && (tags.includes("lightweight") || ["tr90", "ultem", "titanium"].includes(material))) {
      score += 0.18;
    }
    if (preference === "bold" && (tags.includes("bold") || tags.includes("fashion") || material === "acetate")) {
      score += 0.18;
    }
  }

  if (preferredShapes.includes(shape)) score += 0.24;
  if (preferredMaterials.includes(material)) score += 0.2;
  if (preferredColors.includes(color)) score += 0.16;

  score = clamp01(score);
  if (score >= 0.82) {
    reasons.unshift("Gọng khớp sở thích phong cách của khách.");
  }

  return {
    points: FRAME_SCORE_WEIGHTS.style * score,
    confidence
  };
}

function normalizeFrameShape(value) {
  const token = normalizeToken(value);
  const aliases = {
    "rounded square": "rounded-square",
    rounded_square: "rounded-square",
    square: "rounded-square",
    "cat eye": "cat-eye",
    cateye: "cat-eye",
    "half rim": "half-rim",
    half_rim: "half-rim",
    "full rim": "full-rim",
    full_rim: "full-rim",
    rectangular: "rectangle"
  };
  return aliases[token] || token;
}

function normalizeToken(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizedTags(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map(normalizeFrameShape).filter(Boolean);
}

function positiveNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function nonNegativeNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
}

function normalizeConfidence(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0.45;
  return clamp01(numberValue > 1 ? numberValue / 100 : numberValue);
}

function classifyConfidence(values) {
  const average = values.reduce((sum, value) => sum + clamp01(Number(value || 0)), 0) / Math.max(values.length, 1);
  if (average >= 0.72) return "high";
  if (average >= 0.45) return "medium";
  return "low";
}

function roundComponents(components) {
  return Object.fromEntries(
    Object.entries(components).map(([key, value]) => [key, roundScore(value)])
  );
}

function roundScore(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function uniqueList(items) {
  return [...new Set(items.filter(Boolean))];
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function clamp(value, min, max) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return min;
  return Math.min(max, Math.max(min, numberValue));
}
