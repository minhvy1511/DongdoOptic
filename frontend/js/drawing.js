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

export function drawCalibrationGuide(canvas) {
  const context = canvas.getContext("2d");
  const width = canvas.width || canvas.clientWidth;
  const height = canvas.height || canvas.clientHeight;

  if (!width || !height) {
    return;
  }

  const centerX = width / 2;
  const centerY = height * 0.5;
  const guideWidth = width * 0.34;
  const guideHeight = height * 0.52;
  const inset = Math.min(width, height) * 0.08;

  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.04)";
  context.fillRect(inset, inset, width - inset * 2, height - inset * 2);
  context.strokeStyle = "rgba(47, 100, 240, 0.24)";
  context.lineWidth = Math.max(1, Math.min(width, height) * 0.004);
  context.setLineDash([10, 12]);
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
