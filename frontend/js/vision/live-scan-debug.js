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
    `GATE: ${snapshot.gatePassed ? "PASS" : "FAIL"}`,
    `BLOCKER: ${snapshot.reasonCode || "-"}`,
    `centerSource: ${formatPair(snapshot.centerSourceX, snapshot.centerSourceY)}`,
    `centerRendered: ${formatPair(snapshot.centerRenderedX, snapshot.centerRenderedY)}`,
    `coverage: ${formatNumber(snapshot.coverage)}`,
    `yaw: ${formatNumber(snapshot.yaw, 1)}`,
    `roll: ${formatNumber(snapshot.roll, 1)}`,
    `brightness: ${formatNumber(snapshot.brightness, 1)}`,
    `contrast: ${formatNumber(snapshot.contrast, 1)}`,
    `sharpness: ${formatNumber(snapshot.sharpness, 1)}`,
    `imageQuality: ${formatPass(imageQualityPass)}`,
    `lowerFace: ${formatPass(snapshot.lowerFacePassed)}`,
    `usableSamples: ${Number(snapshot.usableSampleCount || 0)}`,
    `holdElapsedMs: ${Math.max(0, Math.round(Number(snapshot.holdElapsedMs || 0)))}`,
    `burstSamples: ${Number(snapshot.burstSampleCount || 0)}`
  ].join("\n");
}

function formatNumber(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "-";
}

function formatPair(x, y) {
  return `x=${formatNumber(x)} y=${formatNumber(y)}`;
}

function formatPercent(value) {
  return `${Math.round(Math.max(0, Math.min(1, Number(value || 0))) * 100)}%`;
}

function formatPass(value) {
  if (value === "-" || value === undefined || value === null) return "-";
  return value ? "PASS" : "FAIL";
}
