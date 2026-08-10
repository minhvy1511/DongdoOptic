import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";

const wasmPath = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const modelPath = "./assets/models/face_landmarker.task";

export async function createFaceLandmarker(options = {}) {
  const vision = await FilesetResolver.forVisionTasks(wasmPath);
  const runningMode = options.runningMode === "IMAGE" ? "IMAGE" : "VIDEO";
  const delegates = options.delegate ? [options.delegate] : ["GPU", "CPU"];
  let lastError = null;

  for (const delegate of delegates) {
    try {
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate
        },
        runningMode,
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false
      });
      landmarker.visionDelegate = delegate;
      return landmarker;
    } catch (error) {
      lastError = error;
      if (delegate !== delegates.at(-1)) {
        console.debug?.(`[VisionID] FaceLandmarker ${delegate} delegate failed, retrying fallback`, error?.message || error);
      }
    }
  }

  throw lastError || new Error("Cannot create FaceLandmarker.");
}

export function createDrawingUtils(canvasContext) {
  return new DrawingUtils(canvasContext);
}

export { FaceLandmarker };
