import test from "node:test";
import assert from "node:assert/strict";

import {
  computeObjectFitTransform,
  mapNormalizedPointToRenderedVideo,
  resizeCanvasToVideo
} from "../../frontend/js/drawing.js";

function makeContext() {
  return {
    transforms: [],
    setTransform(...args) {
      this.transforms.push(args);
    }
  };
}

function makeCanvas({ rectWidth = 640, rectHeight = 480 } = {}) {
  const context = makeContext();
  return {
    width: 0,
    height: 0,
    clientWidth: rectWidth,
    clientHeight: rectHeight,
    style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ width: rectWidth, height: rectHeight })
  };
}

function makeVideo({ videoWidth = 1280, videoHeight = 720, rectWidth = 640, rectHeight = 480, objectFit = "cover" } = {}) {
  return {
    videoWidth,
    videoHeight,
    clientWidth: rectWidth,
    clientHeight: rectHeight,
    getBoundingClientRect: () => ({ width: rectWidth, height: rectHeight }),
    srcObject: {
      getVideoTracks: () => [{
        getSettings: () => ({ width: videoWidth, height: videoHeight, aspectRatio: videoWidth / videoHeight })
      }]
    },
    _objectFit: objectFit
  };
}

function withWindow({ dpr = 1, objectFit = "cover" } = {}, callback) {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      devicePixelRatio: dpr,
      getComputedStyle: (element) => ({ objectFit: element?._objectFit || objectFit, transform: "none" })
    }
  });

  try {
    callback();
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
  }
}

test("cover transform maps Android-like landscape without non-uniform squeeze", () => {
  const transform = computeObjectFitTransform({
    sourceWidth: 1280,
    sourceHeight: 720,
    destinationWidth: 960,
    destinationHeight: 540,
    objectFit: "cover"
  });

  assert.equal(transform.renderScaleX, transform.renderScaleY);
  assert.equal(transform.cropOffsetX, 0);
  assert.equal(transform.cropOffsetY, 0);
});

test("cover transform preserves face height for Safari portrait destination", () => {
  const transform = computeObjectFitTransform({
    sourceWidth: 1280,
    sourceHeight: 720,
    destinationWidth: 390,
    destinationHeight: 780,
    objectFit: "cover"
  });
  const top = mapNormalizedPointToRenderedVideo({ x: 0.5, y: 0.15 }, transform);
  const chin = mapNormalizedPointToRenderedVideo({ x: 0.5, y: 0.85 }, transform);

  assert.equal(transform.renderScaleX, transform.renderScaleY);
  assert.ok(chin.y - top.y > 500);
  assert.ok(transform.cropOffsetX < 0);
});

test("iPad 4:3 destination uses crop offset instead of squeezing landmarks", () => {
  const transform = computeObjectFitTransform({
    sourceWidth: 1920,
    sourceHeight: 1080,
    destinationWidth: 1024,
    destinationHeight: 768,
    objectFit: "cover"
  });

  assert.equal(transform.renderScaleX, transform.renderScaleY);
  assert.ok(transform.cropOffsetX < 0);
  assert.equal(transform.cropOffsetY, 0);
});

test("contain transform letterboxes without changing normalized face aspect", () => {
  const transform = computeObjectFitTransform({
    sourceWidth: 1280,
    sourceHeight: 720,
    destinationWidth: 390,
    destinationHeight: 780,
    objectFit: "contain"
  });

  assert.equal(transform.renderScaleX, transform.renderScaleY);
  assert.equal(transform.cropOffsetX, 0);
  assert.ok(transform.cropOffsetY > 0);
});

test("resizeCanvasToVideo applies DPR once and resets context transform", () => {
  withWindow({ dpr: 3 }, () => {
    const canvas = makeCanvas({ rectWidth: 320, rectHeight: 240 });
    const video = makeVideo({ rectWidth: 320, rectHeight: 240 });
    const context = canvas.getContext("2d");

    resizeCanvasToVideo(canvas, video, "test");

    assert.equal(canvas.width, 960);
    assert.equal(canvas.height, 720);
    assert.deepEqual(context.transforms.at(-1), [3, 0, 0, 3, 0, 0]);
  });
});

test("mirror maps x once and does not affect y", () => {
  const transform = {
    ...computeObjectFitTransform({
      sourceWidth: 100,
      sourceHeight: 100,
      destinationWidth: 200,
      destinationHeight: 100,
      objectFit: "contain"
    }),
    mirrored: true
  };
  const point = mapNormalizedPointToRenderedVideo({ x: 0.2, y: 0.7 }, transform);

  assert.equal(point.x, 200 - (transform.cropOffsetX + 0.2 * transform.renderWidth));
  assert.equal(point.y, transform.cropOffsetY + 0.7 * transform.renderHeight);
});

test("render mapping does not mutate raw landmarks", () => {
  const landmark = Object.freeze({ x: 0.5, y: 0.2, z: 0.1 });
  const transform = computeObjectFitTransform({
    sourceWidth: 100,
    sourceHeight: 100,
    destinationWidth: 200,
    destinationHeight: 200,
    objectFit: "cover"
  });

  mapNormalizedPointToRenderedVideo(landmark, transform);

  assert.deepEqual(landmark, { x: 0.5, y: 0.2, z: 0.1 });
});
