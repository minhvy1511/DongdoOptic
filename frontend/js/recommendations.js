const FRAME_CATALOG = [
  {
    id: "DDO-001",
    name: "Gọng chữ nhật mỏng",
    faceShapes: ["round", "oval"],
    style: "Công sở",
    reason: "Đường cạnh thẳng giúp khuôn mặt trông gọn và rõ nét hơn."
  },
  {
    id: "DDO-002",
    name: "Gọng tròn kim loại",
    faceShapes: ["square", "long"],
    style: "Cổ điển",
    reason: "Bo tròn các góc hàm, tạo cảm giác mềm hơn cho tổng thể."
  },
  {
    id: "DDO-003",
    name: "Gọng oval bản vừa",
    faceShapes: ["square", "heart", "diamond"],
    style: "Hằng ngày",
    reason: "Dáng oval cân bằng trán, gò má và đường hàm."
  },
  {
    id: "DDO-004",
    name: "Gọng cat-eye nhẹ",
    faceShapes: ["oval", "heart"],
    style: "Thanh lịch",
    reason: "Nhấn nhẹ phần trên khuôn mặt, hợp với gu thời trang hiện đại."
  },
  {
    id: "DDO-005",
    name: "Gọng browline",
    faceShapes: ["round", "oval", "long"],
    style: "Smart casual",
    reason: "Tạo điểm nhấn ở chân mày và tăng độ sắc nét khi nhìn trực diện."
  },
  {
    id: "DDO-006",
    name: "Gọng không viền",
    faceShapes: ["long", "diamond"],
    style: "Tối giản",
    reason: "Nhẹ mắt, không làm gò má hoặc chiều dài mặt bị nhấn mạnh quá mức."
  }
];

export function getFrameRecommendations(faceShape) {
  const matchedFrames = FRAME_CATALOG.filter((frame) =>
    frame.faceShapes.includes(faceShape)
  );

  return matchedFrames.length ? matchedFrames : FRAME_CATALOG.slice(0, 3);
}
