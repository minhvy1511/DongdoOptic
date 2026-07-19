import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils
} from "../../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs";

const wasmPath = "../../node_modules/@mediapipe/tasks-vision/wasm";
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
