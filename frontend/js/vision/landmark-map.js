export const FACE_LANDMARKS = Object.freeze({
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
});

export const HEAD_POSE_LANDMARKS = Object.freeze({
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  noseTip: 1
});

export const DISTANCE_LANDMARKS = Object.freeze({
  topFace: FACE_LANDMARKS.topFace,
  chin: FACE_LANDMARKS.chin,
  leftCheek: FACE_LANDMARKS.leftCheek,
  rightCheek: FACE_LANDMARKS.rightCheek,
  leftTemple: FACE_LANDMARKS.leftTemple,
  rightTemple: FACE_LANDMARKS.rightTemple,
  leftBrowOuter: FACE_LANDMARKS.leftBrowOuter,
  rightBrowOuter: FACE_LANDMARKS.rightBrowOuter
});

export const FACE_RATIO_REQUIRED_KEYS = Object.freeze([
  "topFace",
  "chin",
  "leftCheek",
  "rightCheek",
  "leftBrowOuter",
  "rightBrowOuter",
  "leftJaw",
  "rightJaw"
]);

export const HEAD_POSE_REQUIRED_KEYS = Object.freeze([
  "leftEyeOuter",
  "rightEyeOuter",
  "noseTip"
]);

export function isValidLandmarkPoint(point) {
  return Boolean(point)
    && Number.isFinite(point.x)
    && Number.isFinite(point.y);
}

export function getLandmark(landmarks, key, map = FACE_LANDMARKS) {
  const index = map[key];
  return Number.isInteger(index) ? landmarks?.[index] || null : null;
}

export function mapLandmarks(landmarks, map = FACE_LANDMARKS) {
  return Object.fromEntries(
    Object.entries(map).map(([key, index]) => [key, landmarks?.[index] || null])
  );
}

export function getMissingLandmarkKeys(landmarks, keys, map = FACE_LANDMARKS) {
  return keys.filter((key) => !isValidLandmarkPoint(getLandmark(landmarks, key, map)));
}

export function hasRequiredLandmarks(landmarks, keys, map = FACE_LANDMARKS) {
  return getMissingLandmarkKeys(landmarks, keys, map).length === 0;
}
