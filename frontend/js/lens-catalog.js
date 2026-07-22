import { getBrandEvidenceLine, getBrandKnowledge } from "./brand-knowledge.js?v=20260722-67";

export const LENS_CATALOG = [
  {
    brand: "Fano",
    line: "Fano 1.56 HMC",
    index: "1.56",
    tier: "Tiết kiệm",
    budget: "low",
    purposes: ["daily", "budget"],
    note: "Lựa chọn phổ thông, hợp đơn nhẹ đến trung bình và khách ưu tiên chi phí."
  },
  {
    brand: "Fano",
    line: "Fano 1.60 Aspheric HMC",
    index: "1.60",
    tier: "Mỏng nhẹ",
    budget: "medium",
    purposes: ["daily", "screen", "fashion"],
    note: "Gợi ý cân bằng cho đơn trung bình, cần tròng mỏng hơn 1.56 nhưng vẫn dễ tư vấn chi phí."
  },
  {
    brand: "Fano",
    line: "Fano 1.67 Super Thin",
    index: "1.67",
    tier: "Chiết suất cao",
    budget: "high",
    purposes: ["fashion", "high_rx"],
    note: "Ưu tiên khi tổng độ cao, khách cần giảm dày rìa và giữ thẩm mỹ sau khi lắp gọng."
  },
  {
    brand: "Essilor Element",
    line: "Element 1.56 Blue UV",
    index: "1.56",
    tier: "Phổ thông",
    budget: "low",
    purposes: ["screen", "daily", "budget"],
    note: "Hợp khách dùng màn hình nhiều, cần mức giá dễ tiếp cận."
  },
  {
    brand: "Essilor",
    line: "Eyezen / Crizal 1.59",
    index: "1.59",
    tier: "Nhẹ, bền",
    budget: "medium",
    purposes: ["screen", "active"],
    note: "1.59 thường được biết đến như polycarbonate, ưu tiên nhẹ và chịu va đập."
  },
  {
    brand: "Essilor",
    line: "Crizal 1.60",
    index: "1.60",
    tier: "Cân bằng",
    budget: "medium",
    purposes: ["daily", "screen", "fashion"],
    note: "Cân bằng giữa độ mỏng, chất lượng phủ và chi phí."
  },
  {
    brand: "Carl Zeiss",
    line: "ZEISS ClearView / DuraVision 1.60",
    index: "1.60",
    tier: "Cân bằng cao cấp",
    budget: "medium",
    purposes: ["daily", "fashion", "driving"],
    note: "Phù hợp khách cần tầm nhìn rõ, lớp phủ tốt và kính gọn."
  },
  {
    brand: "Essilor",
    line: "Crizal 1.67 chiết suất cao",
    index: "1.67",
    tier: "Mỏng hơn",
    budget: "high",
    purposes: ["fashion", "driving", "high_rx"],
    note: "Hợp đơn cao, cân trọng lượng và thẩm mỹ tốt hơn 1.56/1.60."
  },
  {
    brand: "Carl Zeiss",
    line: "ZEISS 1.67 chiết suất cao",
    index: "1.67",
    tier: "Mỏng cao cấp",
    budget: "high",
    purposes: ["fashion", "driving", "high_rx"],
    note: "Phù hợp khách ưu tiên mỏng, nhẹ, thẩm mỹ và thương hiệu cao cấp."
  },
  {
    brand: "Essilor",
    line: "Thin & Lite / Crizal 1.74",
    index: "1.74",
    tier: "Siêu mỏng",
    budget: "premium",
    purposes: ["fashion", "high_rx"],
    note: "Dành cho đơn rất cao, cần giảm độ dày tối đa và chấp nhận chi phí cao."
  },
  {
    brand: "Carl Zeiss",
    line: "ZEISS 1.74 siêu mỏng",
    index: "1.74",
    tier: "Siêu mỏng cao cấp",
    budget: "premium",
    purposes: ["fashion", "high_rx"],
    note: "Lựa chọn premium khi thẩm mỹ và độ mỏng là ưu tiên lớn nhất."
  }
];

export function analyzeLensNeeds(input = {}) {
  const prescription = input.prescription || {};
  const notes = String(input.notes || "").toLowerCase();
  const pd = toNumber(prescription.pd);
  const sph = Math.abs(toNumber(prescription.sph));
  const cyl = Math.abs(toNumber(prescription.cyl));
  const frameWidthMm = toNumber(input.frameWidthMm ?? input.frame_width_mm);
  const totalPower = sph + cyl;
  const isComputerHeavy = /máy tính|may tinh|màn hình|man hinh|screen|office|văn phòng|van phong/.test(notes);

  let recommendedIndex = "1.60";
  if (totalPower >= 4) {
    recommendedIndex = totalPower >= 6 ? "1.74" : "1.67";
  } else if (totalPower >= 2) {
    recommendedIndex = "1.60";
  } else if (totalPower > 0) {
    recommendedIndex = "1.56";
  }

  const warnings = [];
  if (pd && frameWidthMm && frameWidthMm - pd >= 18 && totalPower >= 2) {
    warnings.push("PD nhỏ hơn nhiều so với gọng dự kiến. Nên cân nhắc gọng nhỏ hơn hoặc chiết suất cao hơn để giảm dày viền.");
  }

  if (isComputerHeavy) {
    warnings.push("Khách làm việc máy tính nhiều. Nên ưu tiên lớp phủ chống ánh sáng xanh hoặc dòng tối ưu cho màn hình.");
  }

  const fallbackIndexes = recommendedIndex === "1.56"
    ? ["1.56", "1.59", "1.60"]
    : recommendedIndex === "1.60"
      ? ["1.60", "1.67"]
      : ["1.67", "1.74"];

  const summary = totalPower >= 4
    ? "Độ đơn cao, ưu tiên chiết suất mỏng hơn để giảm dày kính."
    : totalPower >= 2
      ? "Độ đơn trung bình, chọn 1.60 để cân bằng độ mỏng và chi phí."
      : "Độ đơn thấp, 1.56 thường đủ và kinh tế.";

  return {
    totalPower,
    recommendedIndex,
    fallbackIndexes,
    warnings,
    summary,
    isComputerHeavy
  };
}

export function getLensRecommendations(options = {}) {
  const budgetRank = { low: 1, medium: 2, high: 3, premium: 4 };
  const selectedBudget = options.budget || "medium";
  const purpose = options.purpose || "daily";
  const preferredBrands = options.brands || [];
  const prescriptionLevel = options.prescription_level || "unknown";
  const lensAdvice = analyzeLensNeeds(options);
  const recommendedRank = indexRank(lensAdvice.recommendedIndex);

  return LENS_CATALOG.map((lens) => {
    let score = 0;
    const currentRank = indexRank(lens.index);
    if (lens.budget === selectedBudget) score += 4;
    if (budgetRank[lens.budget] <= budgetRank[selectedBudget]) score += 2;
    if (lens.purposes.includes(purpose)) score += 3;
    if (preferredBrands.includes(lens.brand)) score += 2;
    if (prescriptionLevel === "high" && ["1.67", "1.74"].includes(lens.index)) score += 3;
    if (prescriptionLevel === "medium" && ["1.60", "1.67"].includes(lens.index)) score += 2;
    if (prescriptionLevel === "low" && ["1.56", "1.59", "1.60"].includes(lens.index)) score += 2;
    if (lens.index === lensAdvice.recommendedIndex) score += 10;
    if (lensAdvice.fallbackIndexes.includes(lens.index)) score += 1;
    if (lensAdvice.totalPower >= 4 && currentRank < recommendedRank) score -= 6;
    const brandProfile = getBrandKnowledge(lens.brand);
    return {
      ...lens,
      score,
      brandEvidence: getBrandEvidenceLine(lens.brand),
      brandSegment: brandProfile?.segment || "",
      brandStrengths: brandProfile?.strengths?.slice(0, 4) || [],
      brandSource: brandProfile?.sourceLabel || ""
    };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function indexRank(index) {
  const ranks = {
    "1.56": 1,
    "1.59": 2,
    "1.60": 3,
    "1.67": 4,
    "1.74": 5
  };

  return ranks[index] || 0;
}
