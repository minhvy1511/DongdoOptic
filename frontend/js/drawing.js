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

export function drawCalibrationGuide(canvas, landmarks = null, scanState = null) {
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
  const guideMode = scanState?.mode || (faceBox ? "tracking" : "idle");
  const guideColor = getGuideColor(scanState);
  const progress = clamp01(Number(scanState?.progress || 0));
  const guideLabel = scanState?.label || "";

  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.025)";
  context.fillRect(inset, inset, width - inset * 2, height - inset * 2);
  context.strokeStyle = guideColor;
  context.lineWidth = Math.max(2, Math.min(width, height) * 0.006);
  context.setLineDash(guideMode === "idle" ? [10, 12] : []);
  context.beginPath();
  context.ellipse(centerX, centerY, guideWidth / 2, guideHeight / 2, 0, 0, Math.PI * 2);
  context.stroke();

  if (progress > 0) {
    context.save();
    context.strokeStyle = guideColor;
    context.globalAlpha = 0.9;
    context.lineWidth = Math.max(4, Math.min(width, height) * 0.01);
    context.beginPath();
    context.arc(centerX, centerY, Math.min(guideWidth, guideHeight) * 0.58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    context.stroke();
    context.restore();
  }

  context.setLineDash([]);
  context.strokeStyle = "rgba(32, 201, 151, 0.24)";
  context.beginPath();
  context.moveTo(centerX - guideWidth * 0.58, centerY);
  context.lineTo(centerX + guideWidth * 0.58, centerY);
  context.moveTo(centerX, centerY - guideHeight * 0.58);
  context.lineTo(centerX, centerY + guideHeight * 0.58);
  context.stroke();

  if (guideLabel) {
    context.fillStyle = "rgba(12, 18, 24, 0.72)";
    context.strokeStyle = "rgba(255, 255, 255, 0.16)";
    context.lineWidth = 1;
    const chipWidth = Math.min(width * 0.48, Math.max(180, guideLabel.length * 8.5));
    const chipX = centerX - chipWidth / 2;
    const chipY = Math.max(inset + 6, centerY - guideHeight * 0.65 - 26);
    roundRect(context, chipX, chipY, chipWidth, 24, 12);
    context.fill();
    context.stroke();
    context.fillStyle = "#fff";
    context.font = "700 12px Segoe UI, Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(guideLabel, centerX, chipY + 12);
  }
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

function getGuideColor(scanState) {
  if (scanState?.status === "error") {
    return "#e03131";
  }

  if (scanState?.status === "captured") {
    return "#2f9e44";
  }

  if (scanState?.status === "hold" || scanState?.status === "near") {
    return "#f59f00";
  }

  if (scanState?.status === "prompt") {
    return "#74c0fc";
  }

  return scanState?.mode ? "#20c997" : "rgba(47, 100, 240, 0.2)";
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
