import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";

const wasmPath = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const modelPath = "./assets/models/face_landmarker.task";

export async function createFaceLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(wasmPath);

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: modelPath,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  });
}

export function createDrawingUtils(canvasContext) {
  return new DrawingUtils(canvasContext);
}

export { FaceLandmarker };
