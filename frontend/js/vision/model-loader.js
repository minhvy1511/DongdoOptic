const DEFAULT_MODEL_TIMEOUT_MS = 15000;

export const MODEL_LOAD_STATES = Object.freeze({
  IDLE: "idle",
  LOADING_WASM: "loading_wasm",
  LOADING_MODEL: "loading_model",
  INITIALIZING: "initializing",
  READY: "ready",
  ERROR: "error"
});

export function createVisionModelLoader(options = {}) {
  const importLandmarkerModule = options.importLandmarkerModule;
  if (typeof importLandmarkerModule !== "function") {
    throw new TypeError("importLandmarkerModule is required");
  }

  const timeoutMs = Number(options.timeoutMs || DEFAULT_MODEL_TIMEOUT_MS);
  const now = typeof options.now === "function" ? options.now : defaultNow;
  const setTimer = options.setTimeout || globalThis.setTimeout?.bind(globalThis);
  const clearTimer = options.clearTimeout || globalThis.clearTimeout?.bind(globalThis);
  const onStateChange = typeof options.onStateChange === "function" ? options.onStateChange : () => {};
  const runningMode = options.runningMode === "IMAGE" ? "IMAGE" : "VIDEO";

  let state = MODEL_LOAD_STATES.IDLE;
  let initPromise = null;
  let moduleRef = null;
  let landmarker = null;
  let startedAt = 0;
  let completedAt = 0;
  let attempt = 0;
  let lastError = null;
  let wasmReady = false;
  let modelAssetReady = false;
  let initSequence = 0;
  let activeInitId = 0;

  function snapshot(extra = {}) {
    return {
      modelLoadState: state,
      modelLoadStartedAt: startedAt || 0,
      modelLoadDurationMs: startedAt && completedAt ? Math.max(0, completedAt - startedAt) : 0,
      modelReady: state === MODEL_LOAD_STATES.READY && Boolean(landmarker),
      modelInitInFlight: Boolean(initPromise),
      modelInitAttempt: attempt,
      modelInitError: lastError ? (lastError.message || String(lastError)) : "",
      wasmReady,
      modelAssetReady,
      runningMode,
      lastModelReadyAt: state === MODEL_LOAD_STATES.READY ? completedAt : 0,
      ...extra
    };
  }

  function publish(nextState, extra = {}) {
    state = nextState;
    onStateChange(snapshot(extra));
  }

  function publishForInit(initId, nextState, extra = {}) {
    if (initId !== activeInitId) {
      return false;
    }
    publish(nextState, extra);
    return true;
  }

  async function initialize(initOptions = {}) {
    if (landmarker && state === MODEL_LOAD_STATES.READY && !initOptions.retry) {
      return { module: moduleRef, landmarker, state: snapshot() };
    }

    if (initPromise && !initOptions.retry) {
      return initPromise;
    }

    if (initOptions.retry && initPromise) {
      throw new Error("Cannot retry while initialization is already in flight.");
    }

    attempt += 1;
    const initId = ++initSequence;
    activeInitId = initId;
    startedAt = now();
    completedAt = 0;
    lastError = null;
    wasmReady = false;
    modelAssetReady = false;
    landmarker = null;
    moduleRef = null;
    publishForInit(initId, MODEL_LOAD_STATES.LOADING_WASM);

    initPromise = withTimeout((async () => {
      const importedModule = await importLandmarkerModule();
      if (initId !== activeInitId) {
        throw createStaleInitError();
      }
      moduleRef = importedModule;
      wasmReady = true;
      publishForInit(initId, MODEL_LOAD_STATES.LOADING_MODEL);
      publishForInit(initId, MODEL_LOAD_STATES.INITIALIZING);
      const createdLandmarker = await importedModule.createFaceLandmarker({ runningMode });
      if (initId !== activeInitId) {
        throw createStaleInitError();
      }
      landmarker = createdLandmarker;
      modelAssetReady = true;
      completedAt = now();
      publishForInit(initId, MODEL_LOAD_STATES.READY);
      return { module: moduleRef, landmarker, state: snapshot() };
    })(), timeoutMs, "MODEL_LOAD_TIMEOUT", setTimer, clearTimer)
      .catch((error) => {
        if (error?.code === "STALE_MODEL_INIT") {
          throw error;
        }
        lastError = error;
        completedAt = now();
        publishForInit(initId, MODEL_LOAD_STATES.ERROR);
        activeInitId = 0;
        throw error;
      })
      .finally(() => {
        initPromise = null;
        if (activeInitId === initId && state === MODEL_LOAD_STATES.READY) {
          activeInitId = 0;
        }
      });

    return initPromise;
  }

  function getState() {
    return snapshot();
  }

  function resetAfterError() {
    if (initPromise) {
      return false;
    }
    if (state !== MODEL_LOAD_STATES.ERROR) {
      return false;
    }
    lastError = null;
    startedAt = 0;
    completedAt = 0;
    wasmReady = false;
    modelAssetReady = false;
    publish(MODEL_LOAD_STATES.IDLE);
    return true;
  }

  return {
    initialize,
    getState,
    resetAfterError
  };
}

function withTimeout(promise, timeoutMs, code, setTimer, clearTimer) {
  if (!setTimer || !clearTimer || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.resolve(promise);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimer(() => {
      const error = new Error("VisionID model loading timed out.");
      error.code = code;
      reject(error);
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimer(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimer(timer);
        reject(error);
      });
  });
}

function defaultNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function createStaleInitError() {
  const error = new Error("Stale VisionID model initialization ignored.");
  error.code = "STALE_MODEL_INIT";
  return error;
}
