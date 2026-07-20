export function resizeCanvasToVideo(canvas, video) {
  const width = video.videoWidth || video.clientWidth;
  const height = video.videoHeight || video.clientHeight;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawCalibrationGuide(canvas, landmarks = null) {
  const context = canvas.getContext("2d");
  const width = canvas.width || canvas.clientWidth;
  const height = canvas.height || canvas.clientHeight;

  if (!width || !height) {
    return;
  }

  const faceBox = landmarks?.length ? getLandmarkBox(landmarks, width, height) : null;
  const centerX = faceBox ? faceBox.centerX : width / 2;
  const centerY = faceBox ? faceBox.centerY : height * 0.5;
  const guideWidth = faceBox ? Math.min(width * 0.82, faceBox.width * 1.18) : width * 0.38;
  const guideHeight = faceBox ? Math.min(height * 0.82, faceBox.height * 1.12) : height * 0.56;
  const inset = Math.min(width, height) * 0.08;

  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.025)";
  context.fillRect(inset, inset, width - inset * 2, height - inset * 2);
  context.strokeStyle = faceBox ? "rgba(245, 159, 0, 0.42)" : "rgba(47, 100, 240, 0.2)";
  context.lineWidth = Math.max(1, Math.min(width, height) * 0.004);
  context.setLineDash(faceBox ? [] : [10, 12]);
  context.beginPath();
  context.ellipse(centerX, centerY, guideWidth / 2, guideHeight / 2, 0, 0, Math.PI * 2);
  context.stroke();

  context.setLineDash([]);
  context.strokeStyle = "rgba(32, 201, 151, 0.24)";
  context.beginPath();
  context.moveTo(centerX - guideWidth * 0.58, centerY);
  context.lineTo(centerX + guideWidth * 0.58, centerY);
  context.moveTo(centerX, centerY - guideHeight * 0.58);
  context.lineTo(centerX, centerY + guideHeight * 0.58);
  context.stroke();
  context.restore();
}

function getLandmarkBox(landmarks, canvasWidth, canvasHeight) {
  const xs = landmarks.map((point) => point?.x).filter(Number.isFinite);
  const ys = landmarks.map((point) => point?.y).filter(Number.isFinite);

  if (!xs.length || !ys.length) {
    return null;
  }

  const minX = Math.min(...xs) * canvasWidth;
  const maxX = Math.max(...xs) * canvasWidth;
  const minY = Math.min(...ys) * canvasHeight;
  const maxY = Math.max(...ys) * canvasHeight;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return {
    centerX: minX + width / 2,
    centerY: minY + height / 2,
    width,
    height
  };
}
