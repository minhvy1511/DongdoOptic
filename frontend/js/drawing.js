const DEFAULT_OBJECT_FIT = "cover";
let canvasResizeCount = 0;
let lastCanvasResizeReason = "";

export function resizeCanvasToVideo(canvas, video, reason = "sync") {
  const context = canvas?.getContext?.("2d");
  if (!canvas || !video || !context) {
    return null;
  }

  const rect = getElementRect(video);
  const dpr = getDevicePixelRatio();
  const cssWidth = Math.max(1, Math.round(rect.width || video.clientWidth || canvas.clientWidth || video.videoWidth || 0));
  const cssHeight = Math.max(1, Math.round(rect.height || video.clientHeight || canvas.clientHeight || video.videoHeight || 0));
  const intrinsicWidth = Math.max(1, Math.round(cssWidth * dpr));
  const intrinsicHeight = Math.max(1, Math.round(cssHeight * dpr));

  if (canvas.width !== intrinsicWidth || canvas.height !== intrinsicHeight) {
    canvas.width = intrinsicWidth;
    canvas.height = intrinsicHeight;
    canvasResizeCount += 1;
    lastCanvasResizeReason = reason;
  }

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  return getRenderContext(canvas, video);
}

export function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  const size = getCanvasCssSize(canvas);
  context.clearRect(0, 0, size.width, size.height);
}

export function drawCalibrationGuide(canvas, landmarks = null, scanState = null, faceOvalConnections = null, renderContext = null) {
  const context = canvas.getContext("2d");
  const size = getCanvasCssSize(canvas);
  const width = size.width;
  const height = size.height;

  if (!width || !height) {
    return;
  }

  const activeRenderContext = renderContext || getFallbackRenderContext(canvas);
  const faceBox = landmarks?.length ? getLandmarkBox(landmarks, activeRenderContext) : null;
  const contourPoints = getFaceContourPoints(landmarks, faceOvalConnections, activeRenderContext);
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

export function drawLandmarkConnectors(context, landmarks = [], connections = [], renderContext = null, style = {}) {
  if (!context || !landmarks?.length || !connections?.length) {
    return;
  }

  const edges = connections
    .map(normalizeConnection)
    .filter((edge) => Number.isInteger(edge.start) && Number.isInteger(edge.end));

  context.save();
  context.strokeStyle = style.color || "#20c997";
  context.lineWidth = Number(style.lineWidth || 1);
  context.lineCap = "round";
  context.lineJoin = "round";
  edges.forEach(({ start, end }) => {
    const from = mapNormalizedPointToRenderedVideo(landmarks[start], renderContext);
    const to = mapNormalizedPointToRenderedVideo(landmarks[end], renderContext);
    if (!from || !to) {
      return;
    }
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  });
  context.restore();
}

export function drawSafariRenderDiagnostic(context, landmarks = [], renderContext = null) {
  if (!context || !landmarks?.length) {
    return null;
  }

  const box = getLandmarkBox(landmarks, renderContext);
  const size = renderContext?.destination || { width: 0, height: 0 };
  const points = {
    topFace: mapNormalizedPointToRenderedVideo(landmarks[10], renderContext),
    chin: mapNormalizedPointToRenderedVideo(landmarks[152], renderContext),
    leftEye: mapNormalizedPointToRenderedVideo(landmarks[33], renderContext),
    rightEye: mapNormalizedPointToRenderedVideo(landmarks[263], renderContext),
    mouth: mapNormalizedPointToRenderedVideo(landmarks[13] || landmarks[14], renderContext)
  };

  context.save();
  context.strokeStyle = "rgba(255,255,255,0.85)";
  context.lineWidth = 2;
  context.setLineDash([6, 5]);
  context.strokeRect(1, 1, Math.max(1, size.width - 2), Math.max(1, size.height - 2));

  if (box) {
    context.strokeStyle = "rgba(255, 193, 7, 0.95)";
    context.setLineDash([]);
    context.strokeRect(box.left, box.top, box.width, box.height);
  }

  Object.entries(points).forEach(([label, point]) => {
    if (!point) {
      return;
    }
    context.fillStyle = label === "topFace" ? "#ffd43b" : label === "chin" ? "#ff6b6b" : "#74c0fc";
    context.beginPath();
    context.arc(point.x, point.y, 5, 0, Math.PI * 2);
    context.fill();
    context.font = "700 11px Segoe UI, Arial, sans-serif";
    context.fillText(label, point.x + 7, point.y - 7);
  });
  context.restore();

  return {
    faceBoundingBoxRendered: box,
    renderedFaceWidth: box?.width || 0,
    renderedFaceHeight: box?.height || 0,
    renderedFaceAspectRatio: box?.width && box?.height ? box.width / box.height : 0
  };
}

export function getRenderContext(canvas, video) {
  const canvasSize = getCanvasCssSize(canvas);
  const videoRect = getElementRect(video);
  const sourceWidth = Number(video?.videoWidth || video?.srcObject?.getVideoTracks?.()[0]?.getSettings?.().width || 0);
  const sourceHeight = Number(video?.videoHeight || video?.srcObject?.getVideoTracks?.()[0]?.getSettings?.().height || 0);
  const destinationWidth = Math.max(1, videoRect.width || canvasSize.width);
  const destinationHeight = Math.max(1, videoRect.height || canvasSize.height);
  const objectFit = getObjectFit(video);
  const transform = computeObjectFitTransform({
    sourceWidth,
    sourceHeight,
    destinationWidth,
    destinationHeight,
    objectFit
  });

  return {
    ...transform,
    canvas: canvasSize,
    videoRect,
    objectFit,
    mirrored: isMirrored(video),
    devicePixelRatio: getDevicePixelRatio(),
    canvasResizeCount,
    lastCanvasResizeReason
  };
}

export function computeObjectFitTransform({
  sourceWidth,
  sourceHeight,
  destinationWidth,
  destinationHeight,
  objectFit = DEFAULT_OBJECT_FIT
} = {}) {
  const safeSourceWidth = Math.max(1, Number(sourceWidth || 0));
  const safeSourceHeight = Math.max(1, Number(sourceHeight || 0));
  const safeDestinationWidth = Math.max(1, Number(destinationWidth || 0));
  const safeDestinationHeight = Math.max(1, Number(destinationHeight || 0));
  const sourceAspectRatio = safeSourceWidth / safeSourceHeight;
  const destinationAspectRatio = safeDestinationWidth / safeDestinationHeight;
  const fitMode = ["contain", "scale-down"].includes(objectFit) ? "contain" : "cover";
  const uniformRenderScale = fitMode === "contain"
    ? Math.min(safeDestinationWidth / safeSourceWidth, safeDestinationHeight / safeSourceHeight)
    : Math.max(safeDestinationWidth / safeSourceWidth, safeDestinationHeight / safeSourceHeight);
  const renderWidth = safeSourceWidth * uniformRenderScale;
  const renderHeight = safeSourceHeight * uniformRenderScale;
  const cropOffsetX = (safeDestinationWidth - renderWidth) / 2;
  const cropOffsetY = (safeDestinationHeight - renderHeight) / 2;

  return {
    source: { width: safeSourceWidth, height: safeSourceHeight },
    destination: { width: safeDestinationWidth, height: safeDestinationHeight },
    selectedSourceWidth: safeSourceWidth,
    selectedSourceHeight: safeSourceHeight,
    selectedDestinationWidth: safeDestinationWidth,
    selectedDestinationHeight: safeDestinationHeight,
    sourceAspectRatio,
    destinationAspectRatio,
    renderScaleX: uniformRenderScale,
    renderScaleY: uniformRenderScale,
    uniformRenderScale,
    renderWidth,
    renderHeight,
    cropOffsetX,
    cropOffsetY,
    objectFit: fitMode
  };
}

export function mapNormalizedPointToRenderedVideo(point, renderContext = null) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }

  const context = renderContext || getFallbackRenderContext();
  const x = context.cropOffsetX + point.x * context.renderWidth;
  const y = context.cropOffsetY + point.y * context.renderHeight;
  const mappedX = context.mirrored ? context.destination.width - x : x;
  return { x: mappedX, y };
}

export function getRenderDiagnostics({ canvas, video, landmarks = [], renderContext = null } = {}) {
  const context = renderContext || (canvas && video ? getRenderContext(canvas, video) : null);
  if (!context) {
    return {};
  }

  const track = video?.srcObject?.getVideoTracks?.()[0] || null;
  const settings = track?.getSettings?.() || {};
  const faceBox = landmarks?.length ? getLandmarkBox(landmarks, context) : null;

  return {
    detectedBrowser: detectBrowser(),
    isSafari: isSafariBrowser(),
    isIOS: isIOS(),
    isIPadOS: isIPadOS(),
    orientation: getOrientationLabel(),
    screenWidth: typeof screen !== "undefined" ? screen.width : 0,
    screenHeight: typeof screen !== "undefined" ? screen.height : 0,
    windowInnerWidth: typeof window !== "undefined" ? window.innerWidth : 0,
    windowInnerHeight: typeof window !== "undefined" ? window.innerHeight : 0,
    devicePixelRatio: context.devicePixelRatio,
    videoClientWidth: video?.clientWidth || 0,
    videoClientHeight: video?.clientHeight || 0,
    videoOffsetWidth: video?.offsetWidth || 0,
    videoOffsetHeight: video?.offsetHeight || 0,
    videoRectWidth: context.videoRect?.width || 0,
    videoRectHeight: context.videoRect?.height || 0,
    videoReadyState: video?.readyState ?? null,
    videoPaused: video?.paused ?? null,
    videoPlaysInline: video?.playsInline ?? null,
    hasVideoSrcObject: Boolean(video?.srcObject),
    trackWidth: settings.width || 0,
    trackHeight: settings.height || 0,
    trackAspectRatio: settings.aspectRatio || 0,
    trackFacingMode: settings.facingMode || "",
    canvasWidth: canvas?.width || 0,
    canvasHeight: canvas?.height || 0,
    canvasClientWidth: canvas?.clientWidth || 0,
    canvasClientHeight: canvas?.clientHeight || 0,
    canvasOffsetWidth: canvas?.offsetWidth || 0,
    canvasOffsetHeight: canvas?.offsetHeight || 0,
    canvasRectWidth: getElementRect(canvas).width || 0,
    canvasRectHeight: getElementRect(canvas).height || 0,
    selectedSourceWidth: context.selectedSourceWidth,
    selectedSourceHeight: context.selectedSourceHeight,
    selectedDestinationWidth: context.selectedDestinationWidth,
    selectedDestinationHeight: context.selectedDestinationHeight,
    sourceAspectRatio: context.sourceAspectRatio,
    destinationAspectRatio: context.destinationAspectRatio,
    objectFit: context.objectFit,
    renderScaleX: context.renderScaleX,
    renderScaleY: context.renderScaleY,
    uniformRenderScale: context.uniformRenderScale,
    cropOffsetX: context.cropOffsetX,
    cropOffsetY: context.cropOffsetY,
    mirrored: context.mirrored,
    faceBoundingBoxRendered: faceBox,
    renderedFaceWidth: faceBox?.width || 0,
    renderedFaceHeight: faceBox?.height || 0,
    renderedFaceAspectRatio: faceBox?.width && faceBox?.height ? faceBox.width / faceBox.height : 0,
    canvasResizeCount: context.canvasResizeCount,
    lastCanvasResizeReason: context.lastCanvasResizeReason
  };
}

function getFaceContourPoints(landmarks, connections, renderContext) {
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
    .map((point) => mapNormalizedPointToRenderedVideo(point, renderContext))
    .filter(Boolean);
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

function getLandmarkBox(landmarks, renderContext) {
  const points = landmarks
    .map((point) => mapNormalizedPointToRenderedVideo(point, renderContext))
    .filter(Boolean);

  if (!points.length) {
    return null;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
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

function getCanvasCssSize(canvas) {
  const rect = getElementRect(canvas);
  const dpr = getDevicePixelRatio();
  return {
    width: Math.max(1, rect.width || canvas.clientWidth || canvas.width / dpr || 0),
    height: Math.max(1, rect.height || canvas.clientHeight || canvas.height / dpr || 0)
  };
}

function getFallbackRenderContext(canvas = null) {
  const size = canvas ? getCanvasCssSize(canvas) : { width: 1, height: 1 };
  return computeObjectFitTransform({
    sourceWidth: size.width,
    sourceHeight: size.height,
    destinationWidth: size.width,
    destinationHeight: size.height,
    objectFit: "contain"
  });
}

function getElementRect(element) {
  const rect = element?.getBoundingClientRect?.();
  return {
    width: Number(rect?.width || 0),
    height: Number(rect?.height || 0),
    left: Number(rect?.left || 0),
    top: Number(rect?.top || 0)
  };
}

function getObjectFit(element) {
  const style = typeof window !== "undefined" && element ? window.getComputedStyle?.(element) : null;
  return style?.objectFit || DEFAULT_OBJECT_FIT;
}

function isMirrored(element) {
  const style = typeof window !== "undefined" && element ? window.getComputedStyle?.(element) : null;
  return String(style?.transform || "").includes("matrix(-1") || String(style?.transform || "").includes("scaleX(-1");
}

function getDevicePixelRatio() {
  return typeof window !== "undefined" && Number.isFinite(Number(window.devicePixelRatio))
    ? Math.max(1, Number(window.devicePixelRatio))
    : 1;
}

function detectBrowser() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  if (/CriOS|Chrome\//.test(ua)) return "chrome";
  if (/FxiOS|Firefox\//.test(ua)) return "firefox";
  if (/EdgiOS|Edg\//.test(ua)) return "edge";
  if (/Safari\//.test(ua)) return "safari";
  return "unknown";
}

function isSafariBrowser() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  return /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome\//.test(ua);
}

function isIOS() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  return /iPhone|iPad|iPod/.test(ua);
}

function isIPadOS() {
  const runtimeNavigator = typeof navigator !== "undefined" ? navigator : {};
  return /iPad/.test(runtimeNavigator.userAgent || "")
    || (runtimeNavigator.platform === "MacIntel" && Number(runtimeNavigator.maxTouchPoints || 0) > 1);
}

function getOrientationLabel() {
  if (typeof screen !== "undefined" && screen.orientation?.type) {
    return screen.orientation.type;
  }
  if (typeof window !== "undefined") {
    return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
  }
  return "unknown";
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
