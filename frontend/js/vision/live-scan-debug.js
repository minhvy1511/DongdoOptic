export function createLiveScanDebugController({ enabled = false, mountOverlay, log = console.debug } = {}) {
  let overlay = null;
  let previousState = "";

  return {
    update(snapshot = {}) {
      if (!enabled) return null;
      const state = snapshot.state || "IDLE";
      if (state !== previousState) {
        if (previousState) {
          log(`[VisionID][live] ${previousState} → ${state}`);
        }
        if (state === "CENTERING" && previousState && previousState !== "CENTERING") {
          log(`[VisionID][live] reset to CENTERING: ${snapshot.reasonCode || "UNKNOWN"}`);
        }
        previousState = state;
      }
      overlay ||= mountOverlay?.();
      if (overlay) overlay.textContent = formatLiveScanDebug(snapshot);
      return overlay;
    },
    getState() {
      return { enabled, previousState, mounted: Boolean(overlay) };
    }
  };
}

export function formatLiveScanDebug(snapshot = {}) {
  const imageQualityPass = [snapshot.brightness, snapshot.contrast, snapshot.sharpness]
    .every((value) => Number.isFinite(Number(value)))
    ? Boolean(snapshot.imageQualityPass)
    : "-";
  return [
    `STATE: ${snapshot.state || "IDLE"}`,
    `progress: ${formatPercent(snapshot.progress)}`,
    `CENTER: ${formatPass(snapshot.centerPassed)}`,
    `dx: ${formatNumber(snapshot.centerDx)} limitX: ${formatNumber(snapshot.centerLimitX)}`,
    `dy: ${formatNumber(snapshot.centerDy)} limitY: ${formatNumber(snapshot.centerLimitY)}`,
    `DISTANCE: ${snapshot.distanceStatus || "-"}`,
    `POSE: ${formatPass(snapshot.posePassed)}`,
    `QUALITY: ${formatPass(imageQualityPass)}`,
    `LOWER_FACE: ${formatPass(snapshot.lowerFacePassed)}`,
    `BURST: ${Number(snapshot.burstSampleCount || 0)}/${Number(snapshot.burstRequired || 0)}`,
    `BLOCKER: ${snapshot.reasonCode || "-"}`,
    `faceSource: ${formatPair(snapshot.sourceFaceCenterX, snapshot.sourceFaceCenterY)}`,
    `faceRendered: ${formatPair(snapshot.faceCenterRenderedX, snapshot.faceCenterRenderedY)}`,
    `guideRendered: ${formatPair(snapshot.guideCenterRenderedX, snapshot.guideCenterRenderedY)}`,
    `guideSize: ${formatDimension(snapshot.guideWidth, snapshot.guideHeight)}`,
    `video: ${formatDimension(snapshot.videoWidth, snapshot.videoHeight)}`,
    `rendered: ${formatDimension(snapshot.renderedWidth, snapshot.renderedHeight)}`,
    `canvas: ${formatDimension(snapshot.canvasWidth, snapshot.canvasHeight)}`,
    `crop: ${formatPair(snapshot.cropOffsetX, snapshot.cropOffsetY)}`,
    `mirror: ${Boolean(snapshot.mirror)}`,
    `coverage: ${formatNumber(snapshot.coverage)}`,
    `yaw: ${formatNumber(snapshot.yaw, 1)}`,
    `roll: ${formatNumber(snapshot.roll, 1)}`,
    `brightness: ${formatNumber(snapshot.brightness, 1)}`,
    `contrast: ${formatNumber(snapshot.contrast, 1)}`,
    `sharpness: ${formatNumber(snapshot.sharpness, 1)}`,
    `usableSamples: ${Number(snapshot.usableSampleCount || 0)}`,
    `holdElapsedMs: ${Math.max(0, Math.round(Number(snapshot.holdElapsedMs || 0)))}`,
  ].join("\n");
}

function formatNumber(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "-";
}

function formatPair(x, y) {
  return `x=${formatNumber(x)} y=${formatNumber(y)}`;
}

function formatDimension(width, height) {
  return `${Math.round(Number(width || 0))}x${Math.round(Number(height || 0))}`;
}

function formatPercent(value) {
  return `${Math.round(Math.max(0, Math.min(1, Number(value || 0))) * 100)}%`;
}

function formatPass(value) {
  if (value === "-" || value === undefined || value === null) return "-";
  return value ? "PASS" : "FAIL";
}
