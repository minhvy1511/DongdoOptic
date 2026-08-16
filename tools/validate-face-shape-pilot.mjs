import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "data", "processed", "face_shape_public_5000_manifest.json");
const VISION_ROOT = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision");
const MODEL_PATH = path.join(ROOT, "frontend", "assets", "models", "face_landmarker.task");
const LABELS = ["heart", "long", "oval", "round", "square"];

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const samples = LABELS.flatMap((label) => manifest.records
  .filter((record) => record.split === "testing_set" && record.label === label)
  .sort((a, b) => a.path.localeCompare(b.path))
  .slice(0, 10));

if (samples.length !== 50 || samples.some((sample) => !existsSync(sample.path))) {
  throw new Error(`Expected 50 accessible testing samples, found ${samples.length}.`);
}

const playwrightRoots = [
  path.join(ROOT, "node_modules", "playwright"),
  path.join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "playwright")
];
const playwrightPath = playwrightRoots.find(existsSync);
if (!playwrightPath) {
  throw new Error("Playwright is not available.");
}
const { chromium } = createRequire(import.meta.url)(playwrightPath);
const browserPath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].find(existsSync);
if (!browserPath) {
  throw new Error("A local Chromium browser is not available.");
}

const contentTypes = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png"
};

function streamFile(response, filePath) {
  response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/") {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("<!doctype html><html><body>validation</body></html>");
    return;
  }
  if (url.pathname === "/vision_bundle.mjs") {
    streamFile(response, path.join(VISION_ROOT, "vision_bundle.mjs"));
    return;
  }
  if (url.pathname.startsWith("/wasm/")) {
    streamFile(response, path.join(VISION_ROOT, "wasm", path.basename(url.pathname)));
    return;
  }
  if (url.pathname === "/face_landmarker.task") {
    streamFile(response, MODEL_PATH);
    return;
  }
  if (url.pathname.startsWith("/js/")) {
    streamFile(response, path.join(ROOT, "frontend", "js", url.pathname.slice(4)));
    return;
  }
  const sampleMatch = url.pathname.match(/^\/sample\/(\d+)$/);
  if (sampleMatch) {
    const sample = samples[Number(sampleMatch[1])];
    if (sample) {
      streamFile(response, sample.path);
      return;
    }
  }
  response.writeHead(404);
  response.end("Not found");
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const browser = await chromium.launch({ headless: true, executablePath: browserPath });

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  const predictions = await page.evaluate(async ({ sampleCount }) => {
    const [{ FaceLandmarker, FilesetResolver }, { analyzeFaceShape }] = await Promise.all([
      import("/vision_bundle.mjs"),
      import("/js/face-analysis.js")
    ]);
    const vision = await FilesetResolver.forVisionTasks("/wasm");
    const landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: "/face_landmarker.task", delegate: "CPU" },
      runningMode: "IMAGE",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false
    });
    const output = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const image = new Image();
      image.src = `/sample/${index}`;
      await image.decode();
      const result = landmarker.detect(image);
      const landmarks = result.faceLandmarks?.[0] || null;
      const analysis = landmarks ? analyzeFaceShape(landmarks, {
        width: image.naturalWidth,
        height: image.naturalHeight
      }) : null;
      output.push({
        detected: Boolean(landmarks),
        predicted: analysis?.shape || null,
        bestShape: analysis?.diagnostics?.classification?.bestShape || null,
        margin: analysis?.diagnostics?.classification?.margin || 0
      });
    }
    landmarker.close();
    return output;
  }, { sampleCount: samples.length });

  const rows = predictions.map((prediction, index) => ({
    actual: samples[index].label,
    ...prediction
  }));
  const matrixLabels = [...LABELS, "unknown", "no_detection"];
  const matrix = Object.fromEntries(LABELS.map((actual) => [
    actual,
    Object.fromEntries(matrixLabels.map((predicted) => [predicted, 0]))
  ]));
  for (const row of rows) {
    const predicted = row.detected ? row.predicted : "no_detection";
    matrix[row.actual][matrixLabels.includes(predicted) ? predicted : "unknown"] += 1;
  }
  const detected = rows.filter((row) => row.detected).length;
  const correct = rows.filter((row) => row.detected && row.predicted === row.actual).length;
  const unknown = rows.filter((row) => row.detected && row.predicted === "unknown").length;
  const perClass = Object.fromEntries(LABELS.map((label) => {
    const classRows = rows.filter((row) => row.actual === label);
    return [label, classRows.filter((row) => row.predicted === label).length / classRows.length];
  }));
  const errors = new Map();
  for (const row of rows.filter((item) => item.detected && item.predicted !== item.actual && item.predicted !== "unknown")) {
    const key = `${row.actual}->${row.predicted}`;
    errors.set(key, (errors.get(key) || 0) + 1);
  }

  console.log(JSON.stringify({
    selection: "first 10 testing_set paths per class after locale sort",
    total: rows.length,
    detected,
    correct,
    accuracy: correct / rows.length,
    perClass,
    unknown,
    unknownRate: unknown / rows.length,
    matrix,
    errors: [...errors.entries()].sort((a, b) => b[1] - a[1])
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
