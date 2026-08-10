import test from "node:test";
import assert from "node:assert/strict";

import { createLiveScanCoordinator } from "../../frontend/js/vision/live-scan-coordinator.js";

test("live scan does not start before the user requests camera", () => {
  const coordinator = createLiveScanCoordinator();

  coordinator.updateReadiness({ streamActive: true, videoReady: true, modelReady: true });

  assert.equal(coordinator.canStart(), false);
  assert.equal(coordinator.start(1), false);
  assert.deepEqual(coordinator.getState(), {
    cameraRequested: false,
    streamActive: true,
    videoReady: true,
    modelReady: true,
    documentVisible: true,
    runningMode: "VIDEO",
    sessionValid: true,
    loopRunning: false,
    activeSessionId: null
  });
});

test("camera ready before model starts once when model becomes ready", () => {
  const coordinator = createLiveScanCoordinator();

  coordinator.setCameraRequested(true);
  coordinator.updateReadiness({ streamActive: true, videoReady: true, modelReady: false });

  assert.equal(coordinator.start(10), false);

  coordinator.updateReadiness({ modelReady: true });

  assert.equal(coordinator.start(10), true);
  assert.equal(coordinator.start(10), false);
  assert.equal(coordinator.getState().loopRunning, true);
  assert.equal(coordinator.getState().activeSessionId, 10);
});

test("model ready before camera starts once when video becomes ready", () => {
  const coordinator = createLiveScanCoordinator();

  coordinator.setCameraRequested(true);
  coordinator.updateReadiness({ streamActive: false, videoReady: false, modelReady: true });

  assert.equal(coordinator.start(11), false);

  coordinator.updateReadiness({ streamActive: true, videoReady: true });

  assert.equal(coordinator.start(11), true);
  assert.equal(coordinator.start(12), false);
  assert.equal(coordinator.getState().activeSessionId, 11);
});

test("invalid video or inactive stream blocks scan", () => {
  const coordinator = createLiveScanCoordinator();

  coordinator.setCameraRequested(true);
  coordinator.updateReadiness({ streamActive: true, videoReady: false, modelReady: true });
  assert.equal(coordinator.start(20), false);

  coordinator.updateReadiness({ streamActive: false, videoReady: true });
  assert.equal(coordinator.start(20), false);
});

test("stop and reset allow a clean retry session", () => {
  const coordinator = createLiveScanCoordinator();

  coordinator.setCameraRequested(true);
  coordinator.updateReadiness({ streamActive: true, videoReady: true, modelReady: true });
  assert.equal(coordinator.start(30), true);

  coordinator.stop();
  assert.equal(coordinator.getState().loopRunning, false);
  assert.equal(coordinator.getState().activeSessionId, null);
  assert.equal(coordinator.start(31), true);

  coordinator.reset();
  assert.deepEqual(coordinator.getState(), {
    cameraRequested: false,
    streamActive: false,
    videoReady: false,
    modelReady: false,
    documentVisible: true,
    runningMode: "VIDEO",
    sessionValid: true,
    loopRunning: false,
    activeSessionId: null
  });
});

test("hidden document or non-video mode blocks live scan", () => {
  const coordinator = createLiveScanCoordinator();

  coordinator.setCameraRequested(true);
  coordinator.updateReadiness({
    streamActive: true,
    videoReady: true,
    modelReady: true,
    documentVisible: false,
    runningMode: "VIDEO"
  });
  assert.equal(coordinator.start(40), false);

  coordinator.updateReadiness({ documentVisible: true, runningMode: "IMAGE" });
  assert.equal(coordinator.start(40), false);

  coordinator.updateReadiness({ runningMode: "VIDEO" });
  assert.equal(coordinator.start(40), true);
});

test("invalid session blocks live scan until session is valid again", () => {
  const coordinator = createLiveScanCoordinator();

  coordinator.setCameraRequested(true);
  coordinator.updateReadiness({
    streamActive: true,
    videoReady: true,
    modelReady: true,
    sessionValid: false
  });

  assert.equal(coordinator.start(50), false);

  coordinator.updateReadiness({ sessionValid: true });
  assert.equal(coordinator.start(50), true);
});
