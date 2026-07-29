export async function startUserCamera(videoElement, options = {}) {
  const runtimeNavigator = typeof navigator !== "undefined" ? navigator : {};
  const mediaDevices = options.mediaDevices || runtimeNavigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    throw enrichCameraError(
      new Error("Trinh duyet khong ho tro getUserMedia."),
      "MEDIA_DEVICES_UNAVAILABLE",
      buildCameraDiagnostics({ options })
    );
  }

  const openTimeoutMs = options.openTimeoutMs || 12000;
  const readyTimeoutMs = options.readyTimeoutMs || 8000;
  const requestedConstraints = buildCameraConstraints(options);
  let fallbackConstraintsUsed = false;
  let stream;

  prepareVideoForInlinePlayback(videoElement);

  try {
    stream = await requestCamera(mediaDevices, requestedConstraints, openTimeoutMs);
  } catch (error) {
    if (!shouldTryLooseFallback(error)) {
      throw enrichCameraError(error, error?.code || error?.name || "CAMERA_OPEN_ERROR", {
        ...buildCameraDiagnostics({ options, requestedConstraints }),
        fallbackConstraintsUsed
      });
    }

    fallbackConstraintsUsed = true;
    try {
      stream = await requestCamera(mediaDevices, { video: true, audio: false }, openTimeoutMs);
    } catch (fallbackError) {
      throw enrichCameraError(fallbackError, fallbackError?.code || fallbackError?.name || "CAMERA_OPEN_ERROR", {
        ...buildCameraDiagnostics({ options, requestedConstraints }),
        fallbackConstraintsUsed
      });
    }
  }

  stream.visionCameraDiagnostics = {
    ...buildCameraDiagnostics({ options, requestedConstraints }),
    fallbackConstraintsUsed
  };

  videoElement.srcObject = stream;

  try {
    await playVideo(videoElement);
    await waitForVideoReady(videoElement, readyTimeoutMs);
  } catch (error) {
    stopStreamTracks(stream);
    videoElement.srcObject = null;
    throw enrichCameraError(error, error?.code || error?.name || "CAMERA_READY_ERROR", {
      ...stream.visionCameraDiagnostics,
      playPromiseError: error?.message || ""
    });
  }

  return stream;
}

export function buildCameraConstraints(options = {}) {
  const facingMode = options.facingMode || "user";
  const width = options.width || 1280;
  const height = options.height || 720;

  return {
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: width },
      height: { ideal: height },
      aspectRatio: { ideal: width / height }
    },
    audio: false
  };
}

export function prepareVideoForInlinePlayback(videoElement) {
  if (!videoElement) {
    return;
  }

  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.playsInline = true;
  videoElement.setAttribute?.("autoplay", "");
  videoElement.setAttribute?.("muted", "");
  videoElement.setAttribute?.("playsinline", "");
  videoElement.setAttribute?.("webkit-playsinline", "");
}

export function stopStreamTracks(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

export function waitForVideoReady(videoElement, timeoutMs = 8000) {
  if (videoElement?.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      videoElement?.removeEventListener?.("loadedmetadata", handleReady);
      videoElement?.removeEventListener?.("loadeddata", handleReady);
      videoElement?.removeEventListener?.("canplay", handleReady);
      clearTimeout(timer);
    };
    const finish = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback(value);
    };
    const handleReady = () => {
      if (videoElement.readyState >= 1 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        finish(resolve);
      }
    };
    const timer = setTimeout(() => {
      const error = new Error("Camera da mo nhung video chua san sang.");
      error.code = "CAMERA_READY_TIMEOUT";
      finish(reject, error);
    }, timeoutMs);

    videoElement?.addEventListener?.("loadedmetadata", handleReady, { once: true });
    videoElement?.addEventListener?.("loadeddata", handleReady, { once: true });
    videoElement?.addEventListener?.("canplay", handleReady, { once: true });
  });
}

async function requestCamera(mediaDevices, constraints, timeoutMs) {
  return withTimeout(
    mediaDevices.getUserMedia(constraints),
    timeoutMs,
    "CAMERA_OPEN_TIMEOUT"
  );
}

async function playVideo(videoElement) {
  if (typeof videoElement?.play !== "function") {
    return;
  }

  await videoElement.play();
}

function shouldTryLooseFallback(error) {
  const code = error?.code || error?.name || "";
  return [
    "OverconstrainedError",
    "ConstraintNotSatisfiedError",
    "NotFoundError",
    "DevicesNotFoundError",
    "TypeError",
    "CAMERA_OPEN_TIMEOUT"
  ].includes(code);
}

function buildCameraDiagnostics({ options = {}, requestedConstraints = null } = {}) {
  const runtimeWindow = typeof window !== "undefined" ? window : {};
  const runtimeNavigator = typeof navigator !== "undefined" ? navigator : {};
  const runtimeDocument = typeof document !== "undefined" ? document : {};
  return {
    requestedFacingMode: options.facingMode || "user",
    requestedConstraints,
    isSecureContext: Boolean(runtimeWindow.isSecureContext),
    userAgent: runtimeNavigator.userAgent || "",
    platform: runtimeNavigator.platform || "",
    documentVisibilityState: runtimeDocument.visibilityState || "",
    hasMediaDevices: Boolean(runtimeNavigator.mediaDevices),
    hasGetUserMedia: Boolean(runtimeNavigator.mediaDevices?.getUserMedia)
  };
}

function enrichCameraError(error, code, diagnostics = {}) {
  const sourceError = error instanceof Error ? error : new Error(String(error || "Camera error"));
  const nextDiagnostics = {
    ...(sourceError.diagnostics || {}),
    ...diagnostics
  };

  try {
    sourceError.code = sourceError.code || code;
    sourceError.diagnostics = nextDiagnostics;
    return sourceError;
  } catch {
    const cameraError = new Error(sourceError.message || "Camera error");
    cameraError.name = sourceError.name || "CameraError";
    cameraError.stack = sourceError.stack;
    cameraError.cause = sourceError;
    cameraError.code = sourceError.code || code;
    cameraError.diagnostics = nextDiagnostics;
    return cameraError;
  }
}

function withTimeout(promise, timeoutMs, code) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("Khong the mo camera trong thoi gian cho phep.");
      error.code = code;
      reject(error);
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
