const FACE_SHAPE_ADVICE = {
  oval: {
    principle: "Khuôn mặt cân đối, ưu tiên giữ tỷ lệ tự nhiên thay vì tạo tương phản quá mạnh.",
    choose: ["Gọng chữ nhật mềm", "Wellington", "Oval bản vừa", "Cat-eye nhẹ"],
    avoid: ["Gọng quá nhỏ", "Gọng quá rộng hoặc quá nổi làm phá tỷ lệ mặt"],
    fit: ["Bề ngang gọng nên xấp xỉ điểm rộng nhất của mặt", "Đỉnh gọng nên đi dưới hoặc theo đường chân mày"]
  },
  round: {
    principle: "Mặt mềm và ít góc, nên dùng đường thẳng hoặc góc cạnh để tạo cảm giác thon gọn.",
    choose: ["Chữ nhật", "Vuông bo nhẹ", "Browline", "Cat-eye nhẹ"],
    avoid: ["Gọng tròn/oval quá mềm", "Gọng nhỏ làm mặt trông to hơn"],
    fit: ["Nên chọn cầu kính chắc và tròng hơi ngang", "Tránh tròng quá thấp làm mặt tròn thêm"]
  },
  square: {
    principle: "Mặt có hàm rõ và nhiều góc, nên làm mềm bằng đường cong.",
    choose: ["Tròn", "Oval", "Rimless", "Browline cong nhẹ"],
    avoid: ["Gọng vuông sắc", "Gọng chữ nhật dày làm hàm cứng hơn"],
    fit: ["Ưu tiên viền mảnh hoặc bo góc", "Không để gọng ép sát hai bên thái dương"]
  },
  long: {
    principle: "Mặt dài cần gọng có chiều cao tròng tốt để cân lại chiều dọc.",
    choose: ["Wellington", "Tròn bản vừa", "Oval cao", "Gọng có điểm nhấn phía trên"],
    avoid: ["Gọng dẹt/mỏng theo chiều ngang", "Half-rim dưới làm mặt dài hơn"],
    fit: ["Chiều cao tròng nên đủ sâu", "Tránh gọng quá hẹp so với gò má"]
  },
  heart: {
    principle: "Trán rộng và cằm hẹp, nên giảm cảm giác nặng ở phần trên và cân phần dưới.",
    choose: ["Cat-eye nhẹ", "Oval", "Gọng đáy nhẹ", "Tròn nhỏ vừa"],
    avoid: ["Oversized nặng phần trên", "Gọng quá nổi ở đỉnh"],
    fit: ["Đường trên gọng không nên che chân mày", "Ưu tiên màu/viền không quá nặng ở phía trên"]
  },
  diamond: {
    principle: "Gò má là điểm rộng nhất, nên làm mềm gò má và tôn vùng mắt.",
    choose: ["Oval", "Cat-eye", "Rimless", "Browline mềm"],
    avoid: ["Gọng hẹp bó sát gò má", "Gọng quá nhỏ"],
    fit: ["Bề ngang gọng nên nhỉnh nhẹ hơn gò má", "Viền dưới nên mềm để không nhấn thêm gò má"]
  },
  triangle: {
    principle: "Hàm rộng hơn trán, nên kéo điểm nhìn lên phần trên khuôn mặt.",
    choose: ["Browline", "Cat-eye", "Gọng có màu/chi tiết phía trên"],
    avoid: ["Gọng đáy nặng", "Viền dưới tối và dày"],
    fit: ["Ưu tiên phần trên rõ nét", "Không chọn form kéo nặng xuống cằm"]
  }
};

const FRAME_CATALOG = [
  {
    id: "DDO-001",
    name: "Gọng chữ nhật mỏng",
    faceShapes: ["round", "oval"],
    style: "Công sở",
    reason: "Đường cạnh thẳng giúp khuôn mặt trông gọn và rõ nét hơn.",
    fitNote: "Hợp khi khách muốn vẻ gọn, sáng và dễ đeo hằng ngày."
  },
  {
    id: "DDO-002",
    name: "Gọng tròn kim loại",
    faceShapes: ["square", "long"],
    style: "Cổ điển",
    reason: "Bo tròn các góc hàm, tạo cảm giác mềm hơn cho tổng thể.",
    fitNote: "Nên chọn đường kính tròng vừa đủ, không quá nhỏ so với gò má."
  },
  {
    id: "DDO-003",
    name: "Gọng oval bản vừa",
    faceShapes: ["square", "heart", "diamond"],
    style: "Hằng ngày",
    reason: "Dáng oval cân bằng trán, gò má và đường hàm.",
    fitNote: "Dễ hợp mặt Á Đông, nhất là khi đường trên gọng đi dưới chân mày."
  },
  {
    id: "DDO-004",
    name: "Gọng cat-eye nhẹ",
    faceShapes: ["oval", "heart", "diamond", "triangle"],
    style: "Thanh lịch",
    reason: "Nhấn nhẹ phần trên khuôn mặt, giúp vùng mắt sáng và có điểm nâng.",
    fitNote: "Chọn độ xếch vừa phải để không làm tổng thể quá sắc."
  },
  {
    id: "DDO-005",
    name: "Gọng browline",
    faceShapes: ["round", "oval", "long", "triangle"],
    style: "Smart casual",
    reason: "Tạo điểm nhấn ở chân mày và tăng độ sắc nét khi nhìn trực diện.",
    fitNote: "Cần kiểm tra đường trên gọng có ăn với chân mày hay không."
  },
  {
    id: "DDO-006",
    name: "Gọng không viền",
    faceShapes: ["square", "long", "diamond"],
    style: "Tối giản",
    reason: "Nhẹ mắt, không làm gò má hoặc chiều dài mặt bị nhấn mạnh quá mức.",
    fitNote: "Phù hợp khách thích tự nhiên, ít cảm giác đang đeo kính."
  },
  {
    id: "DDO-007",
    name: "Gọng wellington cao vừa",
    faceShapes: ["long", "oval", "round"],
    style: "Hiện đại",
    reason: "Chiều cao tròng tốt giúp cân lại tỷ lệ mặt, nhất là mặt dài hoặc cần vẻ trưởng thành.",
    fitNote: "Chiều cao tròng nên gần 1/3 khoảng chân mày đến cằm."
  }
];

const MATERIAL_CATALOG = [
  {
    id: "tr90",
    name: "TR90",
    tagline: "Siêu nhẹ, dẻo, bền",
    priceTier: "low-medium",
    strengths: ["cực nhẹ", "đàn hồi tốt", "khó gãy", "hợp vận động"],
    cautions: ["ít hoạ tiết cao cấp hơn acetate"],
    bestFor: ["active", "daily", "budget"],
    preferences: ["light", "minimal"],
    score: {
      active: 3,
      daily: 1.4,
      budget: 1.5,
      low: 1.2,
      medium: 0.8,
      light: 2.2,
      minimal: 0.8,
      child: 2
    },
    reason: "Hợp khi khách cần gọng nhẹ, dẻo và bền để đeo lâu hoặc vận động nhiều."
  },
  {
    id: "ultem",
    name: "Ultem",
    tagline: "Nhẹ, dẻo, chịu nhiệt",
    priceTier: "medium",
    strengths: ["rất nhẹ", "đàn hồi", "chịu nhiệt", "ổn định form"],
    cautions: ["màu sắc không sâu bằng acetate"],
    bestFor: ["active", "daily", "high_rx"],
    preferences: ["light", "minimal"],
    score: {
      active: 2.4,
      daily: 1.3,
      high_rx: 1.2,
      medium: 1,
      light: 2.4,
      minimal: 1,
      child: 1.4
    },
    reason: "Nên thử khi muốn cảm giác nhẹ như TR90 nhưng cần form chắc và chịu nhiệt tốt hơn."
  },
  {
    id: "acetate",
    name: "Acetate",
    tagline: "Đẹp màu, thời trang",
    priceTier: "medium",
    strengths: ["màu sắc sâu", "hoạ tiết đa dạng", "cảm giác đeo ấm", "dễ chỉnh bằng nhiệt"],
    cautions: ["có thể nặng hơn nhựa dẻo", "cần tránh mồ hôi/hoá chất lâu ngày"],
    bestFor: ["fashion", "daily"],
    preferences: ["bold", "office"],
    score: {
      fashion: 2.8,
      daily: 1,
      medium: 1.1,
      high: 1.3,
      bold: 2.5,
      office: 0.9,
      oval: 0.8,
      long: 0.7
    },
    reason: "Phù hợp khi khách ưu tiên vẻ sang, màu đẹp, tortoise/trong suốt hoặc gọng bản rõ."
  },
  {
    id: "titanium",
    name: "Titanium",
    tagline: "Cao cấp, chống dị ứng",
    priceTier: "high",
    strengths: ["rất nhẹ", "bền", "chống gỉ", "hiếm gây dị ứng"],
    cautions: ["giá cao", "khó sửa nếu gãy"],
    bestFor: ["daily", "screen", "high_rx"],
    preferences: ["light", "minimal", "office"],
    score: {
      daily: 1.7,
      screen: 1.5,
      high_rx: 2.4,
      high: 1.8,
      premium: 2.8,
      light: 2.6,
      minimal: 1.6,
      office: 1.5,
      square: 0.9,
      long: 0.8,
      diamond: 0.8
    },
    reason: "Rất hợp khách đeo cả ngày, da nhạy cảm, độ cao hoặc muốn đầu tư gọng lâu dài."
  },
  {
    id: "metal-alloy",
    name: "Hợp kim / Monel",
    tagline: "Mảnh, dễ tiếp cận",
    priceTier: "low-medium",
    strengths: ["mảnh", "dễ chỉnh", "giá dễ chịu", "tạo chi tiết tốt"],
    cautions: ["có thể dị ứng niken", "cần lớp mạ tốt để hạn chế oxy hoá"],
    bestFor: ["daily", "office", "budget"],
    preferences: ["office", "minimal"],
    score: {
      daily: 1,
      office: 1.7,
      budget: 1.6,
      low: 1.6,
      medium: 0.8,
      minimal: 1,
      round: 0.8
    },
    reason: "Tốt cho khách cần gọng kim loại mảnh, thanh lịch và ngân sách vừa phải."
  },
  {
    id: "rimless",
    name: "Không viền / nửa viền",
    tagline: "Nhẹ mặt, ít hiện diện",
    priceTier: "medium-high",
    strengths: ["rất nhẹ", "kín đáo", "giảm cảm giác nặng trên mặt"],
    cautions: ["kém bền khi va đập", "tròng khoan/dây cước cần bảo dưỡng kỹ"],
    bestFor: ["office", "daily"],
    preferences: ["minimal", "light"],
    score: {
      office: 1.6,
      daily: 1,
      high: 0.8,
      premium: 1,
      minimal: 2.4,
      light: 1.8,
      square: 1,
      diamond: 1,
      long: 0.8
    },
    reason: "Hợp khi cần làm gọng nhẹ mắt, giảm độ hiện diện của kính trên khuôn mặt."
  },
  {
    id: "natural",
    name: "Gỗ / sừng tự nhiên",
    tagline: "Độc bản, khác biệt",
    priceTier: "high",
    strengths: ["vân độc bản", "cảm giác ấm", "khác biệt rõ"],
    cautions: ["giá cao", "kén bảo quản", "nguồn hàng hạn chế"],
    bestFor: ["fashion"],
    preferences: ["bold"],
    score: {
      fashion: 1.5,
      premium: 1.4,
      bold: 1.7
    },
    reason: "Chỉ nên đưa vào khi khách muốn phong cách độc đáo, cao cấp hoặc thiên về tự nhiên."
  }
];

export function getFaceShapeAdvice(faceShape) {
  return FACE_SHAPE_ADVICE[faceShape] || FACE_SHAPE_ADVICE.oval;
}

export function getFrameRecommendations(faceShape) {
  const matchedFrames = FRAME_CATALOG.filter((frame) =>
    frame.faceShapes.includes(faceShape)
  );

  return matchedFrames.length ? matchedFrames : FRAME_CATALOG.slice(0, 3);
}

export function getMaterialRecommendations({ faceShape = "", preferences = {}, prescription = {}, ageGroup = "" } = {}) {
  const totalPower = Math.max(Math.abs(Number(prescription.sph || 0)), Math.abs(Number(prescription.cyl || 0)));
  const context = {
    faceShape,
    purpose: preferences.purpose || "daily",
    budget: preferences.budget || "medium",
    preference: preferences.frame_preference || "balanced",
    prescriptionLevel: preferences.prescription_level || "unknown",
    ageGroup,
    highRx: totalPower >= 4 || preferences.prescription_level === "high",
    child: ["preschool", "primary", "secondary"].includes(ageGroup)
  };

  return MATERIAL_CATALOG
    .map((material) => {
      const score = scoreMaterial(material, context);
      return {
        ...material,
        score,
        fitReason: buildMaterialReason(material, context)
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function getFitGuidance({ faceShape, metrics = {}, frameWidthMm = 0, prescription = {}, preference = "balanced" } = {}) {
  const advice = getFaceShapeAdvice(faceShape);
  const notes = [...advice.fit];
  const lengthToWidth = Number(metrics.lengthToWidth || 0);
  const cheekToJaw = Number(metrics.cheekToJaw || 0);
  const width = Number(frameWidthMm || 0);
  const pd = Number(prescription.pd || 0);

  if (width) {
    notes.push(width < 48
      ? "Gọng dự kiến khá nhỏ, cần thử kỹ để tránh làm mặt trông lớn hơn."
      : width > 56
        ? "Gọng dự kiến rộng, cần kiểm tra không trượt và không vượt quá thái dương."
        : "Rộng gọng đang ở vùng dễ thử, nên so với điểm rộng nhất của mặt khi đeo thật.");
  } else {
    notes.push("Nếu chưa có số gọng, hãy ưu tiên bề ngang gọng xấp xỉ hoặc nhỉnh nhẹ hơn điểm rộng nhất khuôn mặt.");
  }

  if (pd && width) {
    const pdGap = Math.abs(width - pd / 2);
    if (pdGap > 6) {
      notes.push("PD và rộng gọng có thể lệch, cần kiểm tra vị trí đồng tử trong tròng trước khi chốt.");
    }
  }

  if (lengthToWidth >= 1.55) {
    notes.push("Mặt có xu hướng dài, tránh tròng quá dẹt; ưu tiên tròng có chiều cao.");
  }

  if (cheekToJaw >= 1.16) {
    notes.push("Gò má nổi bật, tránh gọng bó ngang gò má.");
  }

  if (preference === "bold") {
    notes.push("Khách thích nổi bật: chọn điểm nhấn ở màu hoặc dáng, không nên quá mạnh cả hai.");
  }

  return notes.slice(0, 5);
}

function scoreMaterial(material, context) {
  let score = 1;
  const weights = material.score || {};

  score += Number(weights[context.purpose] || 0);
  score += Number(weights[context.budget] || 0);
  score += Number(weights[context.preference] || 0);
  score += Number(weights[context.faceShape] || 0);

  if (context.highRx) {
    score += Number(weights.high_rx || 0);
  }

  if (context.child) {
    score += Number(weights.child || 0);
  }

  if (context.budget === "low" && material.priceTier === "high") {
    score -= 1.6;
  }

  if (context.preference === "bold" && ["tr90", "ultem", "metal-alloy"].includes(material.id)) {
    score -= 0.35;
  }

  if (context.highRx && ["acetate", "natural"].includes(material.id)) {
    score -= 0.5;
  }

  return Math.max(0, score);
}

function buildMaterialReason(material, context) {
  if (material.id === "tr90" && (context.child || context.purpose === "active")) {
    return "Ưu tiên vì nhẹ, dẻo, khó gãy khi trẻ em hoặc khách vận động nhiều.";
  }

  if (material.id === "ultem" && (context.preference === "light" || context.highRx)) {
    return "Cân bằng tốt giữa nhẹ, đàn hồi và giữ form, hợp khách cần đeo lâu.";
  }

  if (material.id === "titanium" && (context.highRx || context.budget === "premium")) {
    return "Đáng tư vấn khi khách muốn cao cấp, nhẹ, bền và ít kích ứng da.";
  }

  if (material.id === "acetate" && (context.purpose === "fashion" || context.preference === "bold")) {
    return "Hợp khi khách muốn màu sắc, hoạ tiết và cảm giác thời trang rõ hơn.";
  }

  if (material.id === "rimless" && context.preference === "minimal") {
    return "Giúp kính nhẹ mặt và ít lấn khuôn mặt, hợp phong cách tối giản.";
  }

  return material.reason;
}

export function getColorGuidance(preference = "balanced") {
  if (preference === "office" || preference === "minimal") {
    return "Màu nên ưu tiên: đen mềm, xám, nâu trong, champagne hoặc titanium để dễ phối và không lấn khuôn mặt.";
  }

  if (preference === "bold") {
    return "Có thể thử đỏ rượu vang, xanh navy, tortoise hoặc vàng bơ; nên đặt cạnh da thật để kiểm tra độ tôn da.";
  }

  return "Màu an toàn cho khách Việt/Á Đông: tortoise, nâu trà, đen mảnh, xám khói, champagne; nếu da sáng lạnh có thể thử bạc/navy.";
}

export function buildConsultationScript({ customerName = "Anh/chị", faceShape, faceShapeLabel = "dạng mặt này", purposeLabel = "đeo hằng ngày", preference = "balanced" } = {}) {
  const advice = getFaceShapeAdvice(faceShape);
  const chooseText = advice.choose.slice(0, 3).join(", ");
  return `${customerName} thuộc nhóm ${faceShapeLabel}, nên ưu tiên ${chooseText} để ${advice.principle.toLowerCase()} Với nhu cầu ${purposeLabel.toLowerCase()}, nhân viên nên kiểm tra thêm chân mày, độ rộng gọng và vị trí đồng tử trong tròng trước khi chốt. ${getColorGuidance(preference)}`;
}
