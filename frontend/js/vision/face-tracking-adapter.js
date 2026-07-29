export function detectFaceLandmarksForVideo(faceLandmarker, video, timestamp = performanceNow()) {
  if (!faceLandmarker || typeof faceLandmarker.detectForVideo !== "function") {
    return normalizeFaceTrackingResult({
      error: new Error("FaceLandmarker chưa sẵn sàng.")
    });
  }

  try {
    return normalizeFaceTrackingResult(faceLandmarker.detectForVideo(video, timestamp), timestamp);
  } catch (error) {
    return normalizeFaceTrackingResult({ error }, timestamp);
  }
}

export function detectFaceLandmarksForImage(faceLandmarker, image, timestamp = performanceNow()) {
  if (!faceLandmarker || typeof faceLandmarker.detect !== "function") {
    return normalizeFaceTrackingResult({
      error: new Error("FaceLandmarker chưa sẵn sàng.")
    }, timestamp);
  }

  try {
    return normalizeFaceTrackingResult(faceLandmarker.detect(image), timestamp);
  } catch (error) {
    return normalizeFaceTrackingResult({ error }, timestamp);
  }
}

export function normalizeFaceTrackingResult(result = {}, timestamp = performanceNow()) {
  const faces = Array.isArray(result.faceLandmarks) ? result.faceLandmarks : [];
  const error = result.error || null;

  return {
    faces,
    faceCount: faces.length,
    raw: error ? null : result,
    error,
    reasonCode: error ? "FACE_TRACKING_ERROR" : "OK",
    timestamp
  };
}

function performanceNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
