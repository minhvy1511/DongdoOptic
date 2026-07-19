export async function startUserCamera(videoElement, options = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Trình duyệt không hỗ trợ getUserMedia.");
  }

  const facingMode = options.facingMode || "user";
  const width = options.width || 1280;
  const height = options.height || 720;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: width },
      height: { ideal: height },
      aspectRatio: { ideal: width / height },
      resizeMode: "crop-and-scale"
    },
    audio: false
  });

  videoElement.srcObject = stream;

  await new Promise((resolve) => {
    videoElement.onloadeddata = resolve;
  });

  return stream;
}
