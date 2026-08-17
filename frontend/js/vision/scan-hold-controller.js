export const MOBILE_HOLD_GRACE_MS = 220;

const TRANSIENT_MOBILE_REASONS = new Set([
  "IMAGE_BLURRY",
  "LOW_CONFIDENCE"
]);

export function advanceScanHold(state = {}, {
  now = 0,
  ready = false,
  reasonCode = "",
  mobile = false,
  holdDurationMs = 320,
  graceMs = MOBILE_HOLD_GRACE_MS
} = {}) {
  const current = {
    holdStartedAt: Number(state.holdStartedAt || 0),
    lastReadyAt: Number(state.lastReadyAt || 0),
    pauseStartedAt: Number(state.pauseStartedAt || 0),
    progress: Number(state.progress || 0)
  };

  if (ready) {
    let holdStartedAt = current.holdStartedAt || now;
    if (current.pauseStartedAt) {
      holdStartedAt += Math.max(0, now - current.pauseStartedAt);
    }
    const progress = clamp01((now - holdStartedAt) / Math.max(1, holdDurationMs));
    return {
      holdStartedAt,
      lastReadyAt: now,
      pauseStartedAt: 0,
      progress,
      bridged: false,
      reset: false,
      complete: progress >= 1
    };
  }

  const canBridge = mobile
    && current.holdStartedAt > 0
    && current.lastReadyAt > 0
    && TRANSIENT_MOBILE_REASONS.has(reasonCode)
    && now - current.lastReadyAt <= graceMs;
  if (canBridge) {
    return {
      ...current,
      pauseStartedAt: current.pauseStartedAt || now,
      bridged: true,
      reset: false,
      complete: false
    };
  }

  return {
    holdStartedAt: 0,
    lastReadyAt: 0,
    pauseStartedAt: 0,
    progress: 0,
    bridged: false,
    reset: true,
    complete: false
  };
}

export function isMobileScanViewport(windowLike = globalThis.window) {
  return Boolean(windowLike?.matchMedia?.("(max-width: 767px)")?.matches);
}

export function hasVideoFrameAdvanced(previousTime, currentTime) {
  const current = Number(currentTime);
  return Number.isFinite(current) && current !== Number(previousTime);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}
