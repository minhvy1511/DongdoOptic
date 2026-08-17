import test from "node:test";
import assert from "node:assert/strict";

import {
  computeObjectFitTransform,
  getVisibleFaceCenterOffsets,
  getRenderContext,
  getRenderContextForImage,
  mapNormalizedPointToRenderedVideo,
  resizeCanvasToVideo
} from "../../frontend/js/drawing.js";
import {
  evaluateScanFrameQuality,
  getBurstSampleRejectionReason
} from "../../frontend/js/vision/quality-gate.js";

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

function makeImage({ naturalWidth = 3000, naturalHeight = 2000, rectWidth = 300, rectHeight = 200, objectFit = "cover" } = {}) {
  return {
    naturalWidth,
    naturalHeight,
    clientWidth: rectWidth,
    clientHeight: rectHeight,
    getBoundingClientRect: () => ({ width: rectWidth, height: rectHeight }),
    _objectFit: objectFit
  };
}

function withWindow({ dpr = 1, objectFit = "cover" } = {}, callback) {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      devicePixelRatio: dpr,
      getComputedStyle: (element) => ({ objectFit: element?._objectFit || objectFit, transform: element?._transform || "none" })
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

test("image fallback render context uses natural image dimensions, not video dimensions", () => {
  withWindow({ dpr: 2 }, () => {
    const canvas = makeCanvas({ rectWidth: 300, rectHeight: 200 });
    const image = makeImage({ naturalWidth: 4032, naturalHeight: 3024, rectWidth: 300, rectHeight: 200 });
    const context = getRenderContextForImage(canvas, image);

    assert.equal(context.selectedSourceWidth, 4032);
    assert.equal(context.selectedSourceHeight, 3024);
    assert.equal(context.selectedDestinationWidth, 300);
    assert.equal(context.selectedDestinationHeight, 200);
    assert.equal(context.mirrored, false);
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

test("mirrored preview changes render mapping without changing analysis coordinates", () => {
  withWindow({}, () => {
    const canvas = makeCanvas({ rectWidth: 200, rectHeight: 100 });
    const video = makeVideo({ videoWidth: 100, videoHeight: 100, rectWidth: 200, rectHeight: 100 });
    video._transform = "matrix(-1, 0, 0, 1, 0, 0)";
    const landmark = Object.freeze({ x: 0.2, y: 0.7, z: 0.1 });
    const context = getRenderContext(canvas, video);
    const rendered = mapNormalizedPointToRenderedVideo(landmark, context);

    assert.equal(context.mirrored, true);
    assert.equal(rendered.x, 200 - (context.cropOffsetX + landmark.x * context.renderWidth));
    assert.deepEqual(landmark, { x: 0.2, y: 0.7, z: 0.1 });
  });
});

function makeFaceBoxLandmarks(centerX, centerY, width = 0.16, height = 0.28) {
  return [
    { x: centerX - width / 2, y: centerY - height / 2, z: 0 },
    { x: centerX + width / 2, y: centerY + height / 2, z: 0 }
  ];
}

test("mobile portrait visible guide center passes after object-fit cover crop", () => {
  const context = {
    ...computeObjectFitTransform({
      sourceWidth: 1280,
      sourceHeight: 720,
      destinationWidth: 390,
      destinationHeight: 700,
      objectFit: "cover"
    }),
    mirrored: false
  };
  const landmarks = makeFaceBoxLandmarks(0.5, 0.49);
  const center = getVisibleFaceCenterOffsets(landmarks, context);

  assert.ok(context.cropOffsetX < 0);
  assert.ok(center.centerOffsetX < 0.001);
  assert.ok(center.centerOffsetY < 0.001);
  assert.ok(center.guideOffsetX < 0.001);
  assert.ok(center.guideOffsetY < 0.001);
});

test("mirrored front preview preserves analysis landmarks and visual center alignment", () => {
  const context = {
    ...computeObjectFitTransform({
      sourceWidth: 1280,
      sourceHeight: 720,
      destinationWidth: 390,
      destinationHeight: 700,
      objectFit: "cover"
    }),
    mirrored: true
  };
  const landmarks = makeFaceBoxLandmarks(0.5, 0.49).map(Object.freeze);
  const before = JSON.parse(JSON.stringify(landmarks));
  const center = getVisibleFaceCenterOffsets(landmarks, context);

  assert.ok(center.centerOffsetX < 0.001);
  assert.ok(center.guideOffsetX < 0.001);
  assert.deepEqual(landmarks, before);
});

test("clearly off-center rendered face fails center gate while centered face can start hold", () => {
  const context = {
    ...computeObjectFitTransform({
      sourceWidth: 1280,
      sourceHeight: 720,
      destinationWidth: 390,
      destinationHeight: 700,
      objectFit: "cover"
    }),
    mirrored: false
  };
  const centered = getVisibleFaceCenterOffsets(makeFaceBoxLandmarks(0.5, 0.49), context);
  const offCenter = getVisibleFaceCenterOffsets(makeFaceBoxLandmarks(0.62, 0.49), context);
  const makeAnalysis = (center) => ({
    quality: {
      confidence: 0.8,
      coverage: 0.18,
      centerOffsetX: center.centerOffsetX,
      centerOffsetY: center.centerOffsetY,
      centerGuideOffsetX: center.guideOffsetX,
      centerGuideOffsetY: center.guideOffsetY
    }
  });
  const step = { key: "center", targetYaw: 0, tolerance: 8 };
  const pose = { yawDeg: 0, rollDeg: 0 };

  assert.equal(evaluateScanFrameQuality({ step, analysis: makeAnalysis(centered), pose, faceCount: 1 }).ready, true);
  assert.equal(evaluateScanFrameQuality({ step, analysis: makeAnalysis(offCenter), pose, faceCount: 1 }).reasonCode, "OFF_CENTER");
});

test("portrait center gate recovers immediately after horizontal or vertical failure", () => {
  const context = {
    ...computeObjectFitTransform({
      sourceWidth: 1280,
      sourceHeight: 720,
      destinationWidth: 390,
      destinationHeight: 700,
      objectFit: "cover"
    }),
    mirrored: true
  };
  const step = { key: "center", targetYaw: 0, tolerance: 8 };
  const pose = { yawDeg: 0, rollDeg: 0 };
  const evaluate = (x, y) => {
    const center = getVisibleFaceCenterOffsets(makeFaceBoxLandmarks(x, y), context);
    return evaluateScanFrameQuality({
      step,
      pose,
      faceCount: 1,
      analysis: {
        quality: {
          confidence: 0.8,
          coverage: 0.18,
          centerOffsetX: center.centerOffsetX,
          centerOffsetY: center.centerOffsetY,
          centerGuideOffsetX: center.guideOffsetX,
          centerGuideOffsetY: center.guideOffsetY
        }
      }
    });
  };

  assert.equal(evaluate(0.62, 0.49).reasonCode, "OFF_CENTER");
  assert.equal(evaluate(0.5, 0.32).reasonCode, "OFF_CENTER");
  assert.equal(evaluate(0.5, 0.49).ready, true);
});

test("burst acceptance uses visible guide offsets and ignores stale viewport offset", () => {
  const sample = {
    analysis: {
      metrics: { lengthToWidth: 1.4 },
      quality: {
        confidence: 0.8,
        coverage: 0.18,
        centerOffsetX: 0.4,
        centerOffsetY: 0.4,
        centerGuideOffsetX: 0.01,
        centerGuideOffsetY: 0.01
      }
    },
    pose: { yawDeg: 0, rollDeg: 0 }
  };

  assert.equal(getBurstSampleRejectionReason(sample), "OK");
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
