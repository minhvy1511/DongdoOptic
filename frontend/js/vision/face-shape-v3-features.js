export const FACE_SHAPE_V3_FEATURE_NAMES = Object.freeze([
  "faceLengthToCheek",
  "lowerJawToCheek",
  "jawSideSlope",
  "jawTaper",
  "cheekProminence",
  "foreheadToCheek",
  "jawToForehead",
  "chinWidthToCheek",
  "upperFaceToCheek",
  "jawSlopeAsymmetry",
  "jawContourCurvature",
  "chinJawAngularity"
]);

export function extractFaceShapeV3Features(landmarks, frameSize = {}) {
  if (!Array.isArray(landmarks) || landmarks.length <= 454) {
    throw new TypeError("V3 feature extraction requires a complete MediaPipe face landmark array.");
  }

  const width = Number(frameSize.width);
  const height = Number(frameSize.height);
  const aspect = width > 0 && height > 0 ? width / height : 1;
  const point = (index) => ({ x: landmarks[index].x * aspect, y: landmarks[index].y });
  const top = point(10);
  const chin = point(152);
  const axisX = chin.x - top.x;
  const axisY = chin.y - top.y;
  const faceLength = Math.hypot(axisX, axisY);
  if (!Number.isFinite(faceLength) || faceLength <= 1e-8) {
    throw new RangeError("V3 feature extraction requires a non-zero face axis.");
  }

  const verticalX = axisX / faceLength;
  const verticalY = axisY / faceLength;
  const horizontalX = axisY / faceLength;
  const horizontalY = -axisX / faceLength;
  const horizontal = (index) => {
    const value = point(index);
    return (value.x - top.x) * horizontalX + (value.y - top.y) * horizontalY;
  };
  const vertical = (index) => {
    const value = point(index);
    return (value.x - top.x) * verticalX + (value.y - top.y) * verticalY;
  };
  const segmentWidth = (left, right) => Math.abs(horizontal(right) - horizontal(left));
  const centerVertical = (left, right) => (vertical(left) + vertical(right)) / 2;

  const cheekWidth = segmentWidth(234, 454);
  const foreheadWidth = segmentWidth(70, 300);
  const upperFaceWidth = segmentWidth(127, 356);
  const outerJawWidth = segmentWidth(132, 361);
  const jawWidth = segmentWidth(172, 397);
  const lowerJawWidth = segmentWidth(136, 365);
  const chinMidWidth = segmentWidth(150, 379);
  const chinWidth = segmentWidth(148, 377);
  if (!Number.isFinite(cheekWidth) || cheekWidth <= 1e-8 || foreheadWidth <= 1e-8) {
    throw new RangeError("V3 feature extraction requires non-zero face widths.");
  }

  const jawDepth = Math.max(centerVertical(136, 365) - centerVertical(132, 361), 1e-4);
  const lowerDepth = Math.max(centerVertical(136, 365) - centerVertical(172, 397), 1e-4);
  const chinDepth = Math.max(centerVertical(150, 379) - centerVertical(136, 365), 1e-4);
  const lowerSlope = ((jawWidth - lowerJawWidth) / 2) / lowerDepth;
  const chinSlope = ((lowerJawWidth - chinMidWidth) / 2) / chinDepth;
  const leftSlope = Math.abs(
    (horizontal(136) - horizontal(132)) / Math.max(vertical(136) - vertical(132), 1e-4)
  );
  const rightSlope = Math.abs(
    (horizontal(365) - horizontal(361)) / Math.max(vertical(365) - vertical(361), 1e-4)
  );

  return [
    faceLength / cheekWidth,
    lowerJawWidth / cheekWidth,
    ((outerJawWidth - lowerJawWidth) / 2) / jawDepth,
    (outerJawWidth - lowerJawWidth) / cheekWidth,
    (cheekWidth - (upperFaceWidth + outerJawWidth) / 2) / cheekWidth,
    foreheadWidth / cheekWidth,
    jawWidth / foreheadWidth,
    chinWidth / cheekWidth,
    upperFaceWidth / cheekWidth,
    Math.abs(leftSlope - rightSlope),
    (outerJawWidth - 2 * jawWidth + lowerJawWidth) / cheekWidth,
    Math.abs(lowerSlope - chinSlope)
  ];
}

export function aggregateFaceShapeV3Features(featureVectors) {
  if (!Array.isArray(featureVectors) || !featureVectors.length) {
    throw new TypeError("At least one V3 feature vector is required.");
  }

  return FACE_SHAPE_V3_FEATURE_NAMES.map((_, index) => median(
    featureVectors.map((vector) => Number(vector?.[index])).filter(Number.isFinite)
  ));
}

function median(values) {
  if (!values.length) {
    throw new TypeError("V3 feature vectors must contain all 12 finite values.");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
