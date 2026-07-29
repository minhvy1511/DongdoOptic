import test from "node:test";
import assert from "node:assert/strict";

import { startUserCamera, waitForVideoReady } from "../../frontend/js/camera.js";

function createFakeVideo({ readyState = 0, videoWidth = 0, videoHeight = 0 } = {}) {
  const listeners = new Map();
  return {
    readyState,
    videoWidth,
    videoHeight,
    srcObject: null,
    muted: false,
    playsInline: false,
    play: () => Promise.resolve(),
    addEventListener: (eventName, callback) => {
      listeners.set(eventName, callback);
    },
    removeEventListener: (eventName) => {
      listeners.delete(eventName);
    },
    emit: (eventName) => {
      listeners.get(eventName)?.();
    }
  };
}

test("waitForVideoReady resolves when video metadata is available", async () => {
  const video = createFakeVideo();
  const ready = waitForVideoReady(video, 50);

  video.readyState = 1;
  video.videoWidth = 1280;
  video.videoHeight = 720;
  video.emit("loadedmetadata");

  await ready;
});

test("startUserCamera stops stream and rejects when video never becomes ready", async () => {
  const originalNavigator = globalThis.navigator;
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  const stream = { getTracks: () => tracks };

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: () => Promise.resolve(stream)
      }
    }
  });

  const video = createFakeVideo();

  await assert.rejects(
    () => startUserCamera(video, { openTimeoutMs: 50, readyTimeoutMs: 10 }),
    (error) => error.code === "CAMERA_READY_TIMEOUT"
  );

  assert.equal(tracks[0].stopped, true);
  assert.equal(video.srcObject, null);

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator
  });
});
