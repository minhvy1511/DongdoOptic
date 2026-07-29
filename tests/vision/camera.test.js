import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCameraConstraints,
  prepareVideoForInlinePlayback,
  startUserCamera,
  waitForVideoReady
} from "../../frontend/js/camera.js";

function createFakeVideo({ readyState = 0, videoWidth = 0, videoHeight = 0 } = {}) {
  const listeners = new Map();
  return {
    readyState,
    videoWidth,
    videoHeight,
    srcObject: null,
    muted: false,
    playsInline: false,
    autoplay: false,
    attributes: new Map(),
    play: () => Promise.resolve(),
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
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

test("buildCameraConstraints uses soft ideal constraints only", () => {
  const constraints = buildCameraConstraints({ facingMode: "environment", width: 1920, height: 1080 });

  assert.deepEqual(constraints, {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      aspectRatio: { ideal: 1920 / 1080 }
    },
    audio: false
  });
});

test("prepareVideoForInlinePlayback sets iOS-friendly playback flags", () => {
  const video = createFakeVideo();

  prepareVideoForInlinePlayback(video);

  assert.equal(video.autoplay, true);
  assert.equal(video.muted, true);
  assert.equal(video.playsInline, true);
  assert.equal(video.attributes.has("playsinline"), true);
  assert.equal(video.attributes.has("webkit-playsinline"), true);
});

test("startUserCamera falls back to loose video constraint when ideal constraints fail", async () => {
  const originalNavigator = globalThis.navigator;
  const stream = { getTracks: () => [] };
  const calls = [];
  const constraintError = new Error("constraint failed");
  constraintError.name = "OverconstrainedError";

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: (constraints) => {
          calls.push(constraints);
          return calls.length === 1 ? Promise.reject(constraintError) : Promise.resolve(stream);
        }
      }
    }
  });

  const video = createFakeVideo({ readyState: 2, videoWidth: 1280, videoHeight: 720 });
  const result = await startUserCamera(video, { openTimeoutMs: 50, readyTimeoutMs: 50 });

  assert.equal(result, stream);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], { video: true, audio: false });
  assert.equal(result.visionCameraDiagnostics.fallbackConstraintsUsed, true);

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator
  });
});

test("startUserCamera reports play errors and stops the stream", async () => {
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

  const video = createFakeVideo({ readyState: 2, videoWidth: 1280, videoHeight: 720 });
  video.play = () => Promise.reject(new Error("NotAllowedError from play"));

  await assert.rejects(
    () => startUserCamera(video, { openTimeoutMs: 50, readyTimeoutMs: 50 }),
    (error) => {
      assert.equal(error.diagnostics.playPromiseError, "NotAllowedError from play");
      return true;
    }
  );

  assert.equal(tracks[0].stopped, true);
  assert.equal(video.srcObject, null);

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator
  });
});
