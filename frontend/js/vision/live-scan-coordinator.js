export function createLiveScanCoordinator() {
  let cameraRequested = false;
  let streamActive = false;
  let videoReady = false;
  let modelReady = false;
  let documentVisible = true;
  let runningMode = "VIDEO";
  let sessionValid = true;
  let loopRunning = false;
  let activeSessionId = null;

  function setCameraRequested(value) {
    cameraRequested = Boolean(value);
  }

  function updateReadiness(next = {}) {
    if (Object.prototype.hasOwnProperty.call(next, "streamActive")) {
      streamActive = Boolean(next.streamActive);
    }
    if (Object.prototype.hasOwnProperty.call(next, "videoReady")) {
      videoReady = Boolean(next.videoReady);
    }
    if (Object.prototype.hasOwnProperty.call(next, "modelReady")) {
      modelReady = Boolean(next.modelReady);
    }
    if (Object.prototype.hasOwnProperty.call(next, "documentVisible")) {
      documentVisible = Boolean(next.documentVisible);
    }
    if (Object.prototype.hasOwnProperty.call(next, "runningMode")) {
      runningMode = next.runningMode || "";
    }
    if (Object.prototype.hasOwnProperty.call(next, "sessionValid")) {
      sessionValid = Boolean(next.sessionValid);
    }
  }

  function canStart() {
    return cameraRequested
      && documentVisible
      && streamActive
      && videoReady
      && modelReady
      && runningMode === "VIDEO"
      && sessionValid
      && !loopRunning;
  }

  function start(sessionId) {
    if (!canStart()) {
      return false;
    }
    loopRunning = true;
    activeSessionId = sessionId;
    return true;
  }

  function stop() {
    loopRunning = false;
    activeSessionId = null;
  }

  function reset() {
    cameraRequested = false;
    streamActive = false;
    videoReady = false;
    modelReady = false;
    stop();
  }

  function getState() {
    return {
      cameraRequested,
      streamActive,
      videoReady,
      modelReady,
      documentVisible,
      runningMode,
      sessionValid,
      loopRunning,
      activeSessionId
    };
  }

  return {
    setCameraRequested,
    updateReadiness,
    canStart,
    start,
    stop,
    reset,
    getState
  };
}
