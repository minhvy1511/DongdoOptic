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

export function drawCalibrationGuide(canvas, landmarks = null, scanState = null, faceOvalConnections = null) {
  const context = canvas.getContext("2d");
  const width = canvas.width || canvas.clientWidth;
  const height = canvas.height || canvas.clientHeight;

  if (!width || !height) {
    return;
  }

  const faceBox = landmarks?.length ? getLandmarkBox(landmarks, width, height) : null;
  const contourPoints = getFaceContourPoints(landmarks, faceOvalConnections, width, height);
  const guideBox = getFixedGuideBox(width, height);
  const centerX = guideBox.centerX;
  const centerY = guideBox.centerY;
  const guideWidth = guideBox.width;
  const guideHeight = guideBox.height;
  const inset = Math.min(width, height) * 0.08;
  const guideMode = scanState?.mode || (faceBox ? "tracking" : "idle");
  const guideColor = getGuideColor(scanState);
  const distanceColor = getDistanceGuideColor(scanState);
  const progress = clamp01(Number(scanState?.progress || 0));
  const guideLabel = scanState?.label || "";

  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.025)";
  context.fillRect(inset, inset, width - inset * 2, height - inset * 2);
  context.strokeStyle = distanceColor;
  context.globalAlpha = 0.78;
  context.lineWidth = Math.max(2, Math.min(width, height) * 0.005);
  context.setLineDash([12, 12]);
  context.beginPath();
  context.ellipse(centerX, centerY, guideWidth / 2, guideHeight / 2, 0, 0, Math.PI * 2);
  context.stroke();

  context.globalAlpha = 1;
  context.setLineDash(guideMode === "idle" ? [10, 12] : []);
  if (contourPoints.length >= 4) {
    context.strokeStyle = guideColor;
    context.lineWidth = Math.max(2, Math.min(width, height) * 0.006);
    context.beginPath();
    drawSmoothClosedPath(context, contourPoints);
    context.stroke();
  }

  if (progress > 0 && contourPoints.length >= 4) {
    context.save();
    context.strokeStyle = guideColor;
    context.globalAlpha = 0.9;
    context.lineWidth = Math.max(4, Math.min(width, height) * 0.01);
    context.beginPath();
    drawContourProgress(context, contourPoints, progress);
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

function getFaceContourPoints(landmarks, connections, canvasWidth, canvasHeight) {
  if (!landmarks?.length || !connections?.length) {
    return [];
  }

  const edges = connections
    .map(normalizeConnection)
    .filter((edge) => Number.isInteger(edge.start) && Number.isInteger(edge.end));
  const orderedIndexes = orderContourIndexes(edges);
  const indexes = orderedIndexes.length ? orderedIndexes : orderIndexesByAngle([...new Set(edges.flatMap((edge) => [edge.start, edge.end]))], landmarks);

  return indexes
    .map((index) => landmarks[index])
    .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: point.x * canvasWidth, y: point.y * canvasHeight }));
}

function normalizeConnection(connection) {
  if (Array.isArray(connection)) {
    return { start: connection[0], end: connection[1] };
  }

  return {
    start: connection?.start ?? connection?.from,
    end: connection?.end ?? connection?.to
  };
}

function orderContourIndexes(edges) {
  if (!edges.length) {
    return [];
  }

  const adjacency = new Map();
  edges.forEach(({ start, end }) => {
    if (!adjacency.has(start)) {
      adjacency.set(start, []);
    }
    if (!adjacency.has(end)) {
      adjacency.set(end, []);
    }
    adjacency.get(start).push(end);
    adjacency.get(end).push(start);
  });

  const start = edges[0].start;
  const ordered = [start];
  let previous = null;
  let current = start;

  for (let index = 0; index < edges.length + 2; index += 1) {
    const next = (adjacency.get(current) || []).find((candidate) => candidate !== previous);
    if (!Number.isInteger(next) || next === start) {
      break;
    }

    ordered.push(next);
    previous = current;
    current = next;
  }

  return ordered.length >= 4 ? ordered : [];
}

function orderIndexesByAngle(indexes, landmarks) {
  const valid = indexes.filter((index) => {
    const point = landmarks[index];
    return point && Number.isFinite(point.x) && Number.isFinite(point.y);
  });

  if (!valid.length) {
    return [];
  }

  const center = valid.reduce((accumulator, index) => {
    accumulator.x += landmarks[index].x;
    accumulator.y += landmarks[index].y;
    return accumulator;
  }, { x: 0, y: 0 });
  center.x /= valid.length;
  center.y /= valid.length;

  return valid.sort((a, b) => {
    const pointA = landmarks[a];
    const pointB = landmarks[b];
    return Math.atan2(pointA.y - center.y, pointA.x - center.x) - Math.atan2(pointB.y - center.y, pointB.x - center.x);
  });
}

function drawSmoothClosedPath(context, points) {
  context.moveTo(points[0].x, points[0].y);

  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const nextNext = points[(index + 2) % points.length];
    const controlX = next.x + (next.x - point.x) * 0.12;
    const controlY = next.y + (next.y - point.y) * 0.12;
    const nextControlX = next.x - (nextNext.x - point.x) * 0.08;
    const nextControlY = next.y - (nextNext.y - point.y) * 0.08;
    context.bezierCurveTo(controlX, controlY, nextControlX, nextControlY, next.x, next.y);
  });

  context.closePath();
}

function drawContourProgress(context, points, progress) {
  const count = Math.max(2, Math.ceil(points.length * clamp01(progress)));
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < count; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
}

function getFixedGuideBox(canvasWidth, canvasHeight) {
  const guideWidth = canvasWidth * 0.62;
  const guideHeight = canvasHeight * 0.78;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight * 0.49;

  return {
    centerX,
    centerY,
    width: guideWidth,
    height: guideHeight,
    left: centerX - guideWidth / 2,
    top: centerY - guideHeight / 2
  };
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

function getDistanceGuideColor(scanState) {
  if (scanState?.distance?.ready) {
    return "rgba(47, 158, 68, 0.82)";
  }

  if (scanState?.phase === "ERROR" || scanState?.status === "error") {
    return "rgba(224, 49, 49, 0.78)";
  }

  if (scanState?.distance?.status === "near" || scanState?.status === "near") {
    return "rgba(245, 159, 0, 0.86)";
  }

  return "rgba(116, 192, 252, 0.62)";
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
