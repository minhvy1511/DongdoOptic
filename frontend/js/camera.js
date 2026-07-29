export async function startUserCamera(videoElement, options = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Trình duyệt không hỗ trợ getUserMedia.");
  }

  const facingMode = options.facingMode || "user";
  const width = options.width || 1280;
  const height = options.height || 720;
  const openTimeoutMs = options.openTimeoutMs || 12000;
  const readyTimeoutMs = options.readyTimeoutMs || 8000;

  const stream = await withTimeout(
    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: width },
        height: { ideal: height },
        aspectRatio: { ideal: width / height },
        resizeMode: "crop-and-scale"
      },
      audio: false
    }),
    openTimeoutMs,
    "CAMERA_OPEN_TIMEOUT"
  );

  videoElement.srcObject = stream;

  try {
    videoElement.muted = true;
    videoElement.playsInline = true;
    await Promise.resolve(videoElement.play?.()).catch(() => {});
    await waitForVideoReady(videoElement, readyTimeoutMs);
  } catch (error) {
    stream.getTracks?.().forEach((track) => track.stop());
    videoElement.srcObject = null;
    throw error;
  }

  return stream;
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
      if (videoElement.readyState >= 1) {
        finish(resolve);
      }
    };
    const timer = setTimeout(() => {
      const error = new Error("Camera đã mở nhưng video chưa sẵn sàng.");
      error.code = "CAMERA_READY_TIMEOUT";
      finish(reject, error);
    }, timeoutMs);

    videoElement?.addEventListener?.("loadedmetadata", handleReady, { once: true });
    videoElement?.addEventListener?.("loadeddata", handleReady, { once: true });
    videoElement?.addEventListener?.("canplay", handleReady, { once: true });
  });
}

function withTimeout(promise, timeoutMs, code) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("Không thể mở camera trong thời gian cho phép.");
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
