export function createSyntheticLandmarks(seed = 0) {
  const landmarks = Array.from({ length: 478 }, (_, index) => ({
    x: 0.45 + ((index + seed) % 9) * 0.01,
    y: 0.35 + ((index + seed) % 13) * 0.01,
    z: 0
  }));

  landmarks[10] = { x: 0.5, y: 0.18, z: 0 };
  landmarks[152] = { x: 0.5, y: 0.82, z: 0 };
  landmarks[234] = { x: 0.34, y: 0.52, z: 0 };
  landmarks[454] = { x: 0.66, y: 0.52, z: 0 };
  landmarks[70] = { x: 0.4, y: 0.34, z: 0 };
  landmarks[300] = { x: 0.6, y: 0.34, z: 0 };
  landmarks[172] = { x: 0.39, y: 0.68, z: 0 };
  landmarks[397] = { x: 0.61, y: 0.68, z: 0 };
  landmarks[33] = { x: 0.42, y: 0.43, z: 0 };
  landmarks[263] = { x: 0.58, y: 0.43, z: 0 };
  landmarks[1] = { x: 0.5, y: 0.5, z: 0 };

  return landmarks;
}

export function createMockFaceTrackingSequence(faceCounts = [1]) {
  let index = 0;
  return {
    detectForVideo() {
      const faceCount = faceCounts[Math.min(index, faceCounts.length - 1)];
      index += 1;
      return {
        faceLandmarks: Array.from({ length: faceCount }, (_, faceIndex) =>
          createSyntheticLandmarks(index + faceIndex)
        )
      };
    }
  };
}
