import test from "node:test";
import assert from "node:assert/strict";

import { MODEL_LOAD_STATES, createVisionModelLoader } from "../../frontend/js/vision/model-loader.js";

function createFakeModule(createFaceLandmarker) {
  return {
    createFaceLandmarker,
    createDrawingUtils: () => ({}),
    FaceLandmarker: {}
  };
}

test("concurrent initialization reuses a single in-flight promise", async () => {
  let importCalls = 0;
  let createCalls = 0;
  const model = { id: "video-model" };
  const loader = createVisionModelLoader({
    importLandmarkerModule: async () => {
      importCalls += 1;
      return createFakeModule(async () => {
        createCalls += 1;
        return model;
      });
    }
  });

  const [first, second] = await Promise.all([
    loader.initialize(),
    loader.initialize()
  ]);

  assert.equal(first.landmarker, model);
  assert.equal(second.landmarker, model);
  assert.equal(importCalls, 1);
  assert.equal(createCalls, 1);
  assert.equal(loader.getState().modelLoadState, MODEL_LOAD_STATES.READY);
});

test("failed initialization clears in-flight promise and retry creates a new attempt", async () => {
  let attempt = 0;
  const loader = createVisionModelLoader({
    importLandmarkerModule: async () => createFakeModule(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error("model failed");
      }
      return { id: "retry-model" };
    })
  });

  await assert.rejects(() => loader.initialize(), /model failed/);
  assert.equal(loader.getState().modelLoadState, MODEL_LOAD_STATES.ERROR);
  assert.equal(loader.getState().modelInitInFlight, false);

  const result = await loader.initialize({ retry: true });

  assert.equal(result.landmarker.id, "retry-model");
  assert.equal(loader.getState().modelLoadState, MODEL_LOAD_STATES.READY);
  assert.equal(loader.getState().modelInitAttempt, 2);
});

test("state changes expose wasm, model asset and ready milestones", async () => {
  const states = [];
  const loader = createVisionModelLoader({
    onStateChange: (state) => states.push(state),
    importLandmarkerModule: async () => createFakeModule(async () => ({ id: "ok" }))
  });

  await loader.initialize();

  assert.deepEqual(
    states.map((state) => state.modelLoadState),
    [
      MODEL_LOAD_STATES.LOADING_WASM,
      MODEL_LOAD_STATES.LOADING_MODEL,
      MODEL_LOAD_STATES.INITIALIZING,
      MODEL_LOAD_STATES.READY
    ]
  );
  assert.equal(states.at(-1).wasmReady, true);
  assert.equal(states.at(-1).modelAssetReady, true);
  assert.equal(states.at(-1).modelReady, true);
});

test("timeout reports error and does not leave an in-flight promise", async () => {
  const loader = createVisionModelLoader({
    timeoutMs: 1,
    importLandmarkerModule: async () => createFakeModule(() => new Promise(() => {}))
  });

  await assert.rejects(
    () => loader.initialize(),
    (error) => error.code === "MODEL_LOAD_TIMEOUT"
  );

  assert.equal(loader.getState().modelLoadState, MODEL_LOAD_STATES.ERROR);
  assert.equal(loader.getState().modelInitInFlight, false);
  assert.match(loader.getState().modelInitError, /timed out/i);
});
