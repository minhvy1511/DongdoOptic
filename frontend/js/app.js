import { startUserCamera } from "./camera.js?v=20260720-15";
import { clearCanvas, drawCalibrationGuide, resizeCanvasToVideo } from "./drawing.js?v=20260720-15";
import { analyzeFaceShape, getFaceShapeLabel } from "./face-analysis.js?v=20260720-15";
import { getFrameRecommendations } from "./recommendations.js?v=20260720-15";
import { analyzeLensNeeds, getLensRecommendations } from "./lens-catalog.js?v=20260720-15";
import {
  createCustomerCode,
  createSessionCode,
  deleteCustomer,
  setCurrentCustomer,
  loadCustomers,
  loadCurrentCustomer,
  saveCustomer,
  todayInputValue
} from "./customer-store.js?v=20260720-15";

const video = document.getElementById("webcam");
const canvas = document.getElementById("overlay");
const cameraPanel = document.querySelector(".camera-panel");
const startButton = document.getElementById("cameraStartButton");
const statusText = document.getElementById("status");
const landmarkCountText = document.getElementById("landmarkCount");
const faceCountText = document.getElementById("faceCount");
const faceShapeText = document.getElementById("faceShape");
const metricsList = document.getElementById("metricsList");
const frameList = document.getElementById("frameList");
const cameraFaceState = document.getElementById("cameraFaceState");
const cameraStabilityState = document.getElementById("cameraStabilityState");
const cameraReadyState = document.getElementById("cameraReadyState");
const cameraGuidance = document.getElementById("cameraGuidance");
const cameraCenterState = document.getElementById("cameraCenterState");
const cameraDistanceState = document.getElementById("cameraDistanceState");
const cameraConfidenceState = document.getElementById("cameraConfidenceState");
const cameraModeButton = document.getElementById("cameraModeButton");
const cameraModeHint = document.getElementById("cameraModeHint");
const analyzeFaceButton = document.getElementById("analyzeFaceButton");
const markMeasuredButton = document.getElementById("markMeasuredButton");
const confidenceNotice = document.getElementById("confidenceNotice");
const cameraConfidenceOverlay = document.getElementById("cameraConfidenceOverlay");
const confirmedFaceShapeInput = document.getElementById("confirmedFaceShape");
const customerViewToggle = document.getElementById("customerViewToggle");
const customerResultCard = document.getElementById("customerResultCard");
const customerFaceShape = document.getElementById("customerFaceShape");
const customerResultSummary = document.getElementById("customerResultSummary");
const faceShapeIcon = document.getElementById("faceShapeIcon");
const customerCodeInput = document.getElementById("customerCode");
const customerNameInput = document.getElementById("customerName");
const customerPhoneInput = document.getElementById("customerPhone");
const consultDateInput = document.getElementById("consultDate");
const ageGroupInput = document.getElementById("ageGroup");
const customerNotesInput = document.getElementById("customerNotes");
const customerStatusInput = document.getElementById("customerStatus");
const hasPrescriptionInput = document.getElementById("hasPrescription");
const prescriptionSection = document.getElementById("prescriptionSection");
const prescriptionPdInput = document.getElementById("prescriptionPd");
const prescriptionSphInput = document.getElementById("prescriptionSph");
const prescriptionCylInput = document.getElementById("prescriptionCyl");
const frameWidthMmInput = document.getElementById("frameWidthMm");
const sessionCodeValue = document.getElementById("sessionCodeValue");
const newCustomerButton = document.getElementById("newCustomerButton");
const saveCustomerButton = document.getElementById("saveCustomerButton");
const customerList = document.getElementById("customerList");
const customerSearch = document.getElementById("customerSearch");
const customerCount = document.getElementById("customerCount");
const tabButtons = document.querySelectorAll("[data-tab-target]");
const tabPanels = document.querySelectorAll(".tab-panel");
const preferenceForm = document.getElementById("preferenceForm");
const budgetInput = document.getElementById("budget");
const purposeInput = document.getElementById("purpose");
const prescriptionLevelInput = document.getElementById("prescriptionLevel");
const framePreferenceInput = document.getElementById("framePreference");
const lensList = document.getElementById("lensList");
const lensPreview = document.getElementById("lensPreview");
const currentCustomerSummary = document.getElementById("currentCustomerSummary");
const consultationSummary = document.getElementById("consultationSummary");
const feedbackTypeInput = document.getElementById("feedbackType");
const feedbackNotesInput = document.getElementById("feedbackNotes");
const saveFeedbackButton = document.getElementById("saveFeedbackButton");
const feedbackStatus = document.getElementById("feedbackStatus");

const canvasContext = canvas.getContext("2d");

let faceLandmarker;
let drawingUtils;
let FaceLandmarkerApi;
let lastVideoTime = -1;
let lastRenderedShape = "";
let latestAnalysis = null;
let latestAiFaceShape = "";
let confirmedFaceShape = "";
let latestRecommendations = [];
let latestLensRecommendations = [];
let phoneLookupTimer = null;
let isLoadingCustomer = false;
let suppressCurrentCustomerSync = false;
let currentSessionCode = "";
let analysisHistory = [];
let currentCameraMode = getDefaultCameraMode();
let currentCameraStream = null;
let cameraSessionToken = 0;
let isAnalyzingFace = false;

const CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  medium: 0.5
};

const FACE_SHAPE_ICONS = {
  oval: "OV",
  round: "TR",
  square: "VU",
  long: "CN",
  heart: "TT",
  diamond: "KC",
  unknown: "?"
};

const FEEDBACK_STORAGE_KEY = "dongdo_optic_feedback";

function ensureCurrentSessionCode() {
  if (!currentSessionCode) {
    currentSessionCode = createSessionCode();
  }

  if (sessionCodeValue) {
    sessionCodeValue.textContent = currentSessionCode;
  }

  return currentSessionCode;
}

async function initialize() {
  statusText.textContent = "Đang tải mô hình";
  const landmarkerModule = await import("./face-landmarker.js?v=20260720-15");
  faceLandmarker = await landmarkerModule.createFaceLandmarker();
  drawingUtils = landmarkerModule.createDrawingUtils(canvasContext);
  FaceLandmarkerApi = landmarkerModule.FaceLandmarker;
  statusText.textContent = "Sẵn sàng";
}

async function enableCamera() {
  startButton.disabled = true;

  if (!faceLandmarker) {
    await initialize();
  }

  statusText.textContent = "Đang mở camera";
  stopCurrentCameraStream();
  const sessionToken = ++cameraSessionToken;
  currentCameraStream = await startUserCamera(video, { facingMode: currentCameraMode });
  resizeCanvasToVideo(canvas, video);
  cameraPanel?.classList.add("camera-active");
  statusText.textContent = "Đang nhận diện";
  if (analyzeFaceButton) {
    analyzeFaceButton.disabled = false;
  }
  requestAnimationFrame(() => detectFrame(sessionToken));
}

function stopCurrentCameraStream() {
  const stream = currentCameraStream || video?.srcObject;
  if (!stream) {
    return;
  }

  if (stream && typeof stream.getTracks === "function") {
    stream.getTracks().forEach((track) => track.stop());
  }

  video.srcObject = null;
  currentCameraStream = null;
  cameraPanel?.classList.remove("camera-active");
  if (analyzeFaceButton) {
    analyzeFaceButton.disabled = true;
  }
}

function detectFrame(sessionToken) {
  if (sessionToken !== cameraSessionToken) {
    return;
  }

  resizeCanvasToVideo(canvas, video);

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const results = faceLandmarker.detectForVideo(video, performance.now());
    drawResults(results);
  }

  requestAnimationFrame(() => detectFrame(sessionToken));
}

function drawResults(results) {
  const faces = results.faceLandmarks ?? [];
  clearCanvas(canvas);
  drawCalibrationGuide(canvas, faces[0] || null);
  faceCountText.textContent = String(faces.length);
  landmarkCountText.textContent = faces[0] ? String(faces[0].length) : "0";

  if (!faces.length) {
    faceShapeText.textContent = "Không thấy mặt";
    renderConfidenceNotice(null, { level: "low", percent: 0 }, false);
    updateCameraStatus(0, null);
    return;
  }

  const analysis = analyzeFaceShape(faces[0]);
  renderAnalysis(analysis);
  recordAnalysisSnapshot(analysis, faces.length);
  updateCameraStatus(faces.length, analysis);

  for (const landmarks of faces) {
    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarkerApi.FACE_LANDMARKS_TESSELATION,
      { color: "rgba(32, 201, 151, 0.28)", lineWidth: 1 }
    );

    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarkerApi.FACE_LANDMARKS_FACE_OVAL,
      { color: "#f59f00", lineWidth: 2 }
    );

    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarkerApi.FACE_LANDMARKS_LEFT_EYE,
      { color: "#4dabf7", lineWidth: 2 }
    );

    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarkerApi.FACE_LANDMARKS_RIGHT_EYE,
      { color: "#4dabf7", lineWidth: 2 }
    );

    drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarkerApi.FACE_LANDMARKS_LIPS,
      { color: "#ff6b6b", lineWidth: 2 }
    );
  }
}

function renderAnalysis(analysis) {
  if (confirmedFaceShape && !isAnalyzingFace) {
    return;
  }

  latestAnalysis = analysis;
  latestAiFaceShape = analysis.shape || "unknown";
  const confidenceState = getConfidenceState(analysis);
  faceShapeText.textContent = confidenceState.level === "low" ? "Không đủ dữ liệu" : analysis.label;
  renderConfidenceNotice(analysis, confidenceState, false);
  renderCustomerResult();
  renderMetricsV2(analysis.metrics, analysis.quality, analysis.diagnostics);
}

async function analyzeFaceSequence() {
  if (isAnalyzingFace) {
    return;
  }

  if (!video.srcObject) {
    statusText.textContent = "Cần bật camera trước";
    return;
  }

  isAnalyzingFace = true;
  const startedAt = performance.now();
  setAnalyzingState(true);

  try {
    if (!faceLandmarker) {
      await initialize();
    }

    const samples = await withTimeout(captureAnalysisSamples(8, 1500), 5000);
    const finalAnalysis = buildStableAnalysis(samples);

    if (!finalAnalysis) {
      clearConfirmedFaceShape();
      statusText.textContent = "Không đủ dữ liệu";
      renderConfidenceNotice(null, { level: "low", percent: 0 }, true);
      return;
    }

    const elapsed = Math.round(performance.now() - startedAt);
    console.debug(`[VisionID] Face analysis finished in ${elapsed}ms`, {
      frames: samples.length,
      keptFrames: finalAnalysis.sample_count,
      confidence: finalAnalysis.quality?.confidence,
      aiShape: finalAnalysis.faceShape_ai
    });

    latestAnalysis = finalAnalysis;
    latestAiFaceShape = finalAnalysis.faceShape_ai;
    renderMetricsV2(finalAnalysis.metrics, finalAnalysis.quality, finalAnalysis.diagnostics);
    applyAnalysisConfidence(finalAnalysis, true);
    syncCurrentCustomer("customerUpdated");
  } catch (error) {
    console.error(error);
    statusText.textContent = "Xử lý quá lâu, vui lòng thử lại";
    renderConfidenceNotice(null, { level: "low", percent: 0 }, true, "Xử lý quá lâu, vui lòng thử lại.");
  } finally {
    setAnalyzingState(false);
  }
}

async function captureAnalysisSamples(targetFrames, durationMs) {
  const samples = [];
  const delayMs = Math.max(80, Math.round(durationMs / targetFrames));

  for (let index = 0; index < targetFrames; index += 1) {
    const results = faceLandmarker.detectForVideo(video, performance.now());
    const faces = results.faceLandmarks ?? [];
    if (faces.length === 1) {
      const analysis = analyzeFaceShape(faces[0]);
      samples.push(analysis);
    }

    if (index < targetFrames - 1) {
      await delay(delayMs);
    }
  }

  return samples;
}

function buildStableAnalysis(samples) {
  const validSamples = samples.filter((sample) => {
    const confidence = Number(sample?.quality?.confidence || 0);
    return sample?.shape && sample.shape !== "unknown" && confidence >= 0.35;
  });

  if (!validSamples.length) {
    return null;
  }

  const averageConfidence = average(validSamples.map((sample) => sample.quality.confidence));
  const keptSamples = validSamples.filter((sample) => sample.quality.confidence >= Math.max(0.35, averageConfidence - 0.22));
  const usableSamples = keptSamples.length ? keptSamples : validSamples;
  const shape = mode(usableSamples.map((sample) => sample.shape));
  const shapeSamples = usableSamples.filter((sample) => sample.shape === shape);
  const metricSource = shapeSamples.length ? shapeSamples : usableSamples;
  const metrics = averageMetrics(metricSource.map((sample) => sample.metrics));
  const quality = averageQuality(usableSamples.map((sample) => sample.quality));
  const baseAnalysis = analyzeFaceShapeFromMetrics(shape, metrics, quality);
  const diagnostics = {
    ...baseAnalysis.diagnostics,
    warnings: getConfidenceReasons({ ...baseAnalysis, quality }).slice(0, 3),
    confidenceBand: getConfidenceBandLabel(quality.confidence),
    sampleCount: usableSamples.length,
    totalSamples: samples.length
  };

  return {
    ...baseAnalysis,
    shape,
    label: getFaceShapeLabel(shape),
    quality,
    diagnostics,
    warnings: diagnostics.warnings,
    faceShape_ai: shape,
    faceShape_confirmed: ""
  };
}

function analyzeFaceShapeFromMetrics(shape, metrics, quality) {
  const diagnostics = {
    confidenceBand: getConfidenceBandLabel(quality.confidence),
    distanceLabel: getDistanceLabel(quality.coverage || 0),
    centerLabel: getCenterLabelV2(quality),
    ready: quality.confidence >= CONFIDENCE_THRESHOLDS.medium,
    readinessScore: quality.confidence || 0,
    warnings: [],
    summary: "Đã tổng hợp nhiều khung hình."
  };

  return {
    shape,
    label: getFaceShapeLabel(shape),
    metrics,
    quality,
    diagnostics,
    warnings: diagnostics.warnings
  };
}

function applyAnalysisConfidence(analysis, shouldDefaultConfirmed) {
  const confidenceState = getConfidenceState(analysis);

  if (confidenceState.level === "low") {
    clearConfirmedFaceShape();
    faceShapeText.textContent = "Không đủ dữ liệu";
    statusText.textContent = "Không đủ dữ liệu";
  } else {
    faceShapeText.textContent = analysis.label;
    if (shouldDefaultConfirmed) {
      confirmedFaceShape = analysis.shape;
      if (confirmedFaceShapeInput) {
        confirmedFaceShapeInput.value = analysis.shape;
        confirmedFaceShapeInput.disabled = false;
      }
      latestAnalysis.faceShape_confirmed = confirmedFaceShape;
    }
    statusText.textContent = confidenceState.level === "high" ? "Đã phân tích" : "Cần xác nhận";
  }

  renderConfidenceNotice(analysis, confidenceState, true);
  renderCustomerResult();
  if (markMeasuredButton) {
    markMeasuredButton.disabled = !confirmedFaceShape;
  }
  updateAdvice();
}

function setAnalyzingState(isActive) {
  isAnalyzingFace = isActive;
  if (analyzeFaceButton) {
    analyzeFaceButton.disabled = isActive || !video.srcObject;
    analyzeFaceButton.classList.toggle("is-loading", isActive);
    analyzeFaceButton.textContent = isActive ? "Đang phân tích..." : "Phân tích";
  }
  statusText.textContent = isActive ? "Đang phân tích khuôn mặt..." : statusText.textContent;
}

function getConfidenceState(analysis) {
  const confidence = Number(analysis?.quality?.confidence || 0);
  const percent = Math.round(confidence * 100);

  if (confidence >= CONFIDENCE_THRESHOLDS.high) {
    return { level: "high", percent, label: "Độ tin cậy cao" };
  }

  if (confidence >= CONFIDENCE_THRESHOLDS.medium) {
    return { level: "medium", percent, label: "Độ tin cậy trung bình" };
  }

  return { level: "low", percent, label: "Không đủ dữ liệu" };
}

function renderConfidenceNotice(analysis, confidenceState, finalResult, overrideMessage = "") {
  if (!confidenceNotice) {
    renderCameraConfidenceOverlay(analysis, confidenceState, overrideMessage);
    return;
  }

  const reasons = analysis ? getConfidenceReasons(analysis) : ["Đưa mặt vào giữa khung, đủ sáng và nhìn thẳng camera."];
  const messages = {
    high: `Độ tin cậy ${confidenceState.percent}% - có thể dùng để tư vấn.`,
    medium: `Độ tin cậy ${confidenceState.percent}% - nên chụp lại hoặc xác nhận thủ công.`,
    low: `Không đủ dữ liệu để xác định, vui lòng chụp lại.`
  };

  confidenceNotice.className = `confidence-notice ${confidenceState.level}`;
  confidenceNotice.innerHTML = `
    <strong>${overrideMessage || messages[confidenceState.level]}</strong>
    <span>${reasons.join(" ")}</span>
    ${finalResult ? `<em>Kết quả được tổng hợp từ nhiều khung hình.</em>` : ""}
  `;
  renderCameraConfidenceOverlay(analysis, confidenceState, overrideMessage);
}

function renderCameraConfidenceOverlay(analysis, confidenceState = { level: "low", percent: 0 }, overrideMessage = "") {
  if (!cameraConfidenceOverlay) {
    return;
  }

  const shape = confirmedFaceShape || (confidenceState.level === "low" ? "" : latestAiFaceShape);
  const shapeLabel = shape ? getFaceShapeLabel(shape) : "Chưa đủ dữ liệu";
  const percentLabel = confidenceState.percent ? `${confidenceState.percent}%` : "--";
  const statusTextValue = overrideMessage || (
    confidenceState.level === "high"
      ? `Tin cậy cao - ${shapeLabel}`
      : confidenceState.level === "medium"
        ? `Nên xác nhận - ${shapeLabel}`
        : "Cần chụp lại hoặc căn mặt"
  );

  cameraConfidenceOverlay.className = `camera-confidence-overlay ${confidenceState.level || "low"}`;
  cameraConfidenceOverlay.innerHTML = `
    <span>Độ tin cậy</span>
    <strong>${percentLabel}</strong>
    <em>${statusTextValue}</em>
  `;
}

function getConfidenceReasons(analysis) {
  const quality = analysis?.quality || {};
  const diagnostics = analysis?.diagnostics || {};
  const reasons = [];

  if ((quality.coverage || 0) < 0.08) {
    reasons.push("Khuôn mặt đang quá xa camera.");
  } else if ((quality.coverage || 0) > 0.4) {
    reasons.push("Khuôn mặt đang quá gần camera.");
  }

  if ((quality.centerOffsetX || 0) > 0.16 || (quality.centerOffsetY || 0) > 0.16) {
    reasons.push("Mặt chưa nằm giữa khung.");
  }

  if ((quality.symmetryScore || 0) < 0.52) {
    reasons.push("Có thể đang nghiêng mặt hoặc bị che một phần.");
  }

  if (Array.isArray(diagnostics.warnings)) {
    diagnostics.warnings.forEach((warning) => {
      if (warning && !reasons.includes(warning)) {
        reasons.push(warning);
      }
    });
  }

  return reasons.length ? reasons.slice(0, 3) : ["Khung hình đủ sáng, nhìn thẳng và giữ yên để kết quả ổn định hơn."];
}

function renderCustomerResult() {
  if (!customerFaceShape || !customerResultSummary || !faceShapeIcon) {
    return;
  }

  const shape = confirmedFaceShape || "";
  const confidenceState = latestAnalysis ? getConfidenceState(latestAnalysis) : { level: "low" };
  const canShowAiShape = latestAiFaceShape && confidenceState.level !== "low";
  const aiLabel = canShowAiShape ? getFaceShapeLabel(latestAiFaceShape) : "Chưa đủ dữ liệu";
  const confirmedLabel = shape ? getFaceShapeLabel(shape) : "Chưa xác nhận";
  customerFaceShape.textContent = confirmedLabel;
  faceShapeIcon.textContent = FACE_SHAPE_ICONS[shape || latestAiFaceShape || "unknown"] || "?";
  customerResultSummary.textContent = shape
    ? `AI gợi ý: ${aiLabel}. Nhân viên đã xác nhận: ${confirmedLabel}.`
    : `AI gợi ý: ${aiLabel}. Cần xác nhận trước khi tư vấn gọng.`;
  customerResultCard?.classList.toggle("has-result", Boolean(shape));
}

function clearConfirmedFaceShape() {
  confirmedFaceShape = "";
  if (confirmedFaceShapeInput) {
    confirmedFaceShapeInput.value = "";
    confirmedFaceShapeInput.disabled = !latestAnalysis;
  }
  if (latestAnalysis) {
    latestAnalysis.faceShape_confirmed = "";
  }
  renderCustomerResult();
  updateAdvice();
}

function recordAnalysisSnapshot(analysis, faceCount) {
  if (!analysis || faceCount !== 1) {
    return;
  }

  analysisHistory.push({
    shape: analysis.shape,
    metrics: analysis.metrics,
    quality: analysis.quality,
    diagnostics: analysis.diagnostics,
    timestamp: Date.now()
  });

  if (analysisHistory.length > 18) {
    analysisHistory.shift();
  }
}

function updateCameraStatus(faceCount, analysis) {
  if (cameraFaceState) {
    cameraFaceState.textContent = String(faceCount);
  }

  const stability = getCameraStabilityV2();
  const quality = analysis?.quality || {};
  const diagnostics = analysis?.diagnostics || {};
  if (cameraStabilityState) {
    cameraStabilityState.textContent = stability.label;
  }

  const ready = isCameraReadyV2(faceCount, stability.score, quality, analysis, diagnostics);
  if (cameraReadyState) {
    cameraReadyState.textContent = ready ? "Đạt chuẩn" : (diagnostics.centerLabel || getCenterLabelV2(quality));
  }

  if (cameraCenterState) {
    cameraCenterState.textContent = diagnostics.centerLabel || getCenterLabelV2(quality);
  }

  if (cameraDistanceState) {
    cameraDistanceState.textContent = diagnostics.distanceLabel || getDistanceLabel(quality.coverage || 0);
  }

  if (cameraConfidenceState) {
    const confidence = Math.round((quality.confidence || 0) * 100);
    const band = diagnostics.confidenceBand || getConfidenceBandLabel(quality.confidence || 0);
    cameraConfidenceState.textContent = confidence ? `${confidence}% - ${band}` : "0%";
  }

  if (cameraGuidance) {
    cameraGuidance.textContent = getCameraGuidanceV2(faceCount, stability, quality, ready, diagnostics);
  }

  if (markMeasuredButton) {
    markMeasuredButton.disabled = !confirmedFaceShape;
  }
}

function getCameraStabilityV2() {
  const recent = analysisHistory.slice(-7);
  if (recent.length < 3) {
    return { label: "Chưa đủ", score: 0, details: { readyFrames: recent.length } };
  }

  const values = recent
    .map((item) => Number(item.metrics?.lengthToWidth || 0))
    .filter((value) => value > 0);

  if (values.length < 3) {
    return { label: "Chưa đủ", score: 0.3, details: { readyFrames: values.length } };
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  const deviation = Math.sqrt(variance);
  const deltas = values.slice(1).map((value, index) => Math.abs(value - values[index]));
  const jitter = deltas.length
    ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length
    : 0;
  const confidenceValues = recent
    .map((item) => Number(item.quality?.confidence || 0))
    .filter((value) => value > 0);
  const confidenceAverage = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : 0.35;
  const centerValues = recent
    .map((item) => Number(item.quality?.centerOffsetX || 0) + Number(item.quality?.centerOffsetY || 0))
    .filter((value) => value >= 0);
  const centerAverage = centerValues.length
    ? centerValues.reduce((sum, value) => sum + value, 0) / centerValues.length
    : 0.4;
  const coverageValues = recent
    .map((item) => Number(item.quality?.coverage || 0))
    .filter((value) => value > 0);
  const coverageAverage = coverageValues.length
    ? coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length
    : 0.12;
  const shapeCounts = recent.reduce((counts, item) => {
    counts[item.shape] = (counts[item.shape] || 0) + 1;
    return counts;
  }, {});
  const topShapeCount = Math.max(...Object.values(shapeCounts));
  const shapeConsistency = topShapeCount / recent.length;
  const score = clamp01(
    confidenceAverage * 0.34 +
    (1 - Math.min(1, deviation * 3.6)) * 0.18 +
    (1 - Math.min(1, jitter * 5.8)) * 0.14 +
    (1 - Math.min(1, centerAverage * 3.8)) * 0.18 +
    (1 - Math.min(1, Math.abs(coverageAverage - 0.2) * 4.5)) * 0.08 +
    shapeConsistency * 0.08
  );

  const details = { confidenceAverage, deviation, jitter, centerAverage, coverageAverage, shapeConsistency };

  if (score >= 0.85) {
    return { label: "Rất ổn", score, details };
  }

  if (score >= 0.68) {
    return { label: "Ổn định", score, details };
  }

  if (score >= 0.5) {
    return { label: "Cần giữ yên", score, details };
  }

  return { label: "Dao động", score, details };
}

function getCameraGuidanceV2(faceCount, stability, quality, ready, diagnostics = {}) {
  if (faceCount === 0) {
    return "Đưa mặt vào giữa khung, nhìn thẳng và giữ ánh sáng đều.";
  }

  if (faceCount > 1) {
    return "Chỉ giữ một khuôn mặt trong khung để phân tích chính xác hơn.";
  }

  if (ready) {
    return "Khung đã đủ chuẩn. Có thể chuyển sang bước chốt tư vấn.";
  }

  if (diagnostics.summary) {
    return diagnostics.summary;
  }

  if ((quality.centerOffsetX || 0) > 0.18) {
    return "Di chuyển mặt vào giữa khung thêm một chút.";
  }

  if ((quality.coverage || 0) > 0 && (quality.coverage || 0) < 0.09) {
    return "Đưa mặt gần hơn một chút để landmarks rõ và đủ điểm hơn.";
  }

  if ((quality.coverage || 0) > 0.38) {
    return "Lùi ra một chút để khuôn mặt không quá sát camera.";
  }

  if ((quality.centerOffsetY || 0) > 0.18) {
    return "Đưa mặt lên hoặc xuống để khớp tâm khung hơn.";
  }

  if (stability.score < 0.55) {
    return "Giữ đầu yên thêm một chút để hệ thống bắt ổn định khuôn mặt.";
  }

  return "Đã nhận diện được mặt. Giữ nguyên tư thế thêm 1 giây để chốt chỉ số.";
}

function isCameraReadyV2(faceCount, stabilityScore, quality, analysis, diagnostics = {}) {
  if (faceCount !== 1 || !analysis || analysis.shape === "unknown") {
    return false;
  }

  const confidence = Number(quality.confidence || 0);
  const centered = Number(quality.centerOffsetX || 0) <= 0.1 && Number(quality.centerOffsetY || 0) <= 0.1;
  const coverage = Number(quality.coverage || 0);
  const confidenceBandOk = (diagnostics.confidenceBand || "Yếu") !== "Yếu";
  return stabilityScore >= 0.72 && confidence >= 0.62 && centered && coverage >= 0.09 && coverage <= 0.36 && confidenceBandOk;
}

function getCenterLabelV2(quality = {}) {
  const offsetX = Number(quality.centerOffsetX || 0);
  const offsetY = Number(quality.centerOffsetY || 0);
  const confidence = Number(quality.confidence || 0);

  if (!confidence) {
    return "Chưa";
  }

  if (offsetX <= 0.08 && offsetY <= 0.08) {
    return "Rất giữa";
  }

  if (offsetX <= 0.12 && offsetY <= 0.12) {
    return "Khá giữa";
  }

  if (offsetX > 0.18) {
    return "Lệch ngang";
  }

  if (offsetY > 0.18) {
    return "Lệch dọc";
  }

  return "Lệch nhẹ";
}

function getDistanceLabel(coverage = 0) {
  if (!coverage) {
    return "Chưa có";
  }

  if (coverage < 0.08) {
    return "Quá xa";
  }

  if (coverage < 0.11) {
    return "Hơi xa";
  }

  if (coverage <= 0.34) {
    return "Đúng khoảng";
  }

  if (coverage <= 0.4) {
    return "Hơi gần";
  }

  return "Quá gần";
}

function renderMetrics(metrics) {
  metricsList.innerHTML = `
    <div>
      <dt>Tỷ lệ dài/rộng</dt>
      <dd>${formatMetric(metrics.lengthToWidth)}</dd>
    </div>
    <div>
      <dt>Trán / gò má</dt>
      <dd>${formatMetric(metrics.foreheadToCheek)}</dd>
    </div>
    <div>
      <dt>Hàm / gò má</dt>
      <dd>${formatMetric(metrics.jawToCheek)}</dd>
    </div>
    <div>
      <dt>Hàm / trán</dt>
      <dd>${formatMetric(metrics.jawToForehead)}</dd>
    </div>
  `;
}

function renderMetricsV2(metrics, quality = null, diagnostics = null) {
  const qualityRows = quality
    ? [
        ["Độ tin cậy", diagnostics?.confidenceBand || `${Math.round((quality.confidence || 0) * 100)}%`],
        ["Tâm khung", diagnostics?.centerLabel || getCenterLabelV2(quality)],
        ["Khoảng cách", diagnostics?.distanceLabel || getDistanceLabel(quality.coverage || 0)]
      ]
    : [];

  metricsList.innerHTML = `
    <div>
      <dt>Tỷ lệ dài/rộng</dt>
      <dd>${formatMetric(metrics.lengthToWidth)}</dd>
    </div>
    <div>
      <dt>Trán / gò má</dt>
      <dd>${formatMetric(metrics.foreheadToCheek)}</dd>
    </div>
    <div>
      <dt>Hàm / gò má</dt>
      <dd>${formatMetric(metrics.jawToCheek)}</dd>
    </div>
    <div>
      <dt>Hàm / trán</dt>
      <dd>${formatMetric(metrics.jawToForehead)}</dd>
    </div>
    <div>
      <dt>Hàm / rộng</dt>
      <dd>${formatMetric(metrics.cheekToJaw)}</dd>
    </div>
    ${qualityRows
      .map(
        ([label, value]) => `
          <div>
            <dt>${label}</dt>
            <dd>${value}</dd>
          </div>
        `
      )
      .join("")}
  `;
}

function renderRecommendations(frames) {
  frameList.innerHTML = frames
    .map(
      (frame) => `
        <article class="frame-card">
          <div class="frame-visual">${frame.id}</div>
          <div>
            <h3>${frame.name}</h3>
            <p>${frame.style}</p>
          </div>
          <p>${frame.reason}</p>
        </article>
      `
    )
    .join("");
}

function renderLensRecommendations(lenses, shouldShow = true) {
  if (!shouldShow || !lenses.length) {
    lensList.innerHTML = `<p class="empty-state">Nhập đơn kính ở Hồ sơ hoặc chọn nhu cầu rõ hơn để xem gợi ý tròng kính.</p>`;
    return;
  }

  lensList.innerHTML = lenses
    .map(
      (lens) => `
        <article class="lens-card">
          <div>
            <h3>${lens.line}</h3>
            <p>${lens.brand}</p>
          </div>
          <div class="lens-meta">
            <span>Chiết suất ${lens.index}</span>
            <span>${lens.tier}</span>
            <span>${budgetLabel(lens.budget)}</span>
          </div>
          <p>${lens.note}</p>
        </article>
      `
    )
    .join("");
}

function formatMetric(value) {
  return value ? value.toFixed(2) : "--";
}

function getDefaultCameraMode() {
  const prefersRearCamera = window.matchMedia?.("(max-width: 900px)").matches
    || window.matchMedia?.("(pointer: coarse)").matches;
  return prefersRearCamera ? "environment" : "user";
}

function updateCameraModeButton() {
  if (!cameraModeButton) {
    return;
  }

  const isRear = currentCameraMode === "environment";
  cameraModeButton.textContent = isRear ? "Camera sau" : "Camera trước";
  cameraModeButton.setAttribute("aria-pressed", String(isRear));

  if (cameraModeHint) {
    cameraModeHint.textContent = isRear
      ? "Ưu tiên camera sau trên điện thoại"
      : "Ưu tiên camera trước cho máy bàn";
  }
}

function toggleCameraMode() {
  currentCameraMode = currentCameraMode === "environment" ? "user" : "environment";
  updateCameraModeButton();
  if (video.srcObject) {
    enableCamera().catch((error) => {
      console.error(error);
      statusText.textContent = "Không thể đổi camera";
      startButton.disabled = false;
    });
  }
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Face analysis timeout")), timeoutMs);
    })
  ]);
}

function average(values) {
  const numericValues = values.filter((value) => Number.isFinite(value));
  return numericValues.length
    ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
    : 0;
}

function mode(values) {
  const counts = values.reduce((accumulator, value) => {
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
}

function averageMetrics(metricsListValue) {
  return {
    lengthToWidth: average(metricsListValue.map((metrics) => metrics.lengthToWidth)),
    foreheadToCheek: average(metricsListValue.map((metrics) => metrics.foreheadToCheek)),
    jawToCheek: average(metricsListValue.map((metrics) => metrics.jawToCheek)),
    jawToForehead: average(metricsListValue.map((metrics) => metrics.jawToForehead)),
    cheekToJaw: average(metricsListValue.map((metrics) => metrics.cheekToJaw))
  };
}

function averageQuality(qualityList) {
  return {
    centerOffsetX: average(qualityList.map((quality) => quality.centerOffsetX)),
    centerOffsetY: average(qualityList.map((quality) => quality.centerOffsetY)),
    coverage: average(qualityList.map((quality) => quality.coverage)),
    symmetryScore: average(qualityList.map((quality) => quality.symmetryScore)),
    confidence: average(qualityList.map((quality) => quality.confidence)),
    faceBox: qualityList.at(-1)?.faceBox || null
  };
}

function getConfidenceBandLabel(confidence = 0) {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) {
    return "Cao";
  }

  if (confidence >= CONFIDENCE_THRESHOLDS.medium) {
    return "Trung bình";
  }

  return "Thấp";
}

function startNewCustomer() {
  customerCodeInput.value = createCustomerCode();
  currentSessionCode = createSessionCode();
  ensureCurrentSessionCode();
  customerNameInput.value = "";
  customerPhoneInput.value = "";
  consultDateInput.value = todayInputValue();
  ageGroupInput.value = "";
  customerNotesInput.value = "";
  frameWidthMmInput.value = "";
  customerStatusInput.value = "waiting";
  hasPrescriptionInput.checked = false;
  setPrescriptionSectionVisible(false);
  clearPrescriptionInputs();
  analysisHistory = [];
  latestAiFaceShape = "";
  confirmedFaceShape = "";
  if (confirmedFaceShapeInput) {
    confirmedFaceShapeInput.value = "";
    confirmedFaceShapeInput.disabled = true;
  }
  updateCameraStatus(0, null);
  renderConfidenceNotice(null, { level: "low", percent: 0 }, false, "Chưa có dữ liệu phân tích.");
  renderCustomerResult();
  resetAdviceState();
  syncCurrentCustomer("customerSelected");
  statusText.textContent = "Hồ sơ mới";
}

function saveCurrentCustomer() {
  updateAdvice();
  const record = saveCustomer({
    customer_code: customerCodeInput.value,
    session_code: currentSessionCode,
    customer_name: customerNameInput.value.trim(),
    customer_phone: customerPhoneInput.value.trim(),
    consult_date: consultDateInput.value,
    age_group: ageGroupInput.value,
    customer_notes: customerNotesInput.value.trim(),
    customer_status: customerStatusInput.value,
    frame_width_mm: parseOptionalNumber(frameWidthMmInput.value),
    has_prescription: hasPrescriptionInput.checked,
    prescription: readPrescriptionData(),
    preferences: readPreferences(),
    analysis: latestAnalysis,
    faceShape_ai: latestAiFaceShape || latestAnalysis?.faceShape_ai || latestAnalysis?.shape || "",
    faceShape_confirmed: confirmedFaceShape || latestAnalysis?.faceShape_confirmed || "",
    recommendations: latestRecommendations,
    lens_recommendations: latestLensRecommendations,
    snapshot: {
      face_count: Number(faceCountText.textContent || 0),
      landmark_count: Number(landmarkCountText.textContent || 0)
    }
  });

  customerCodeInput.value = record.customer_code;
  renderCustomers();
  statusText.textContent = "Đã lưu hồ sơ";
}

function renderCustomers() {
  const query = normalizeSearch(customerSearch.value);
  const records = loadCustomers().filter((record) => customerMatches(record, query));
  const total = loadCustomers().length;
    customerCount.textContent = `${records.length}/${total} hồ sơ`;

  if (!records.length) {
    customerList.innerHTML = `<p class="empty-state">${total ? "Không tìm thấy hồ sơ phù hợp." : "Chưa có hồ sơ nào."}</p>`;
    return;
  }

  customerList.innerHTML = records
    .map((record) => {
      const label = record.faceShape_confirmed
        ? getFaceShapeLabel(record.faceShape_confirmed)
        : (record.analysis?.label || "Chưa phân tích");
      const purpose = purposeLabel(record.preferences?.purpose);
      const rxTag = record.has_prescription ? "Có đơn kính" : "Chưa có đơn kính";
      const status = statusLabel(record.customer_status);
      const updatedAt = new Date(record.updated_at).toLocaleString("vi-VN");
      const consultDate = record.consult_date ? formatConsultDate(record.consult_date) : "Chưa có ngày";
      const ageGroup = ageGroupLabel(record.age_group);
      return `
        <article class="customer-card">
          <div>
            <strong>${record.customer_name || "Chưa nhập"} - ${record.customer_code} <span class="status-chip">${status}</span></strong>
            <span>${record.customer_phone || "Chưa có SĐT"} | ${consultDate} | ${ageGroup} | ${label} | ${purpose} | ${rxTag}</span>
            <span class="customer-note">${record.customer_notes || "Chưa có ghi chú"}</span>
            <span>Cập nhật: ${updatedAt}</span>
          </div>
          <div class="customer-actions">
            <button type="button" data-load-customer="${record.customer_code}">Mo lai</button>
            <button type="button" class="danger-action" data-delete-customer="${record.customer_code}">Xóa</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function loadCustomerRecord(customerCode) {
  const record = loadCustomers().find((item) => item.customer_code === customerCode);
  if (!record) {
    return false;
  }

  isLoadingCustomer = true;
  analysisHistory = [];
  customerCodeInput.value = record.customer_code;
  customerNameInput.value = record.customer_name || "";
  customerPhoneInput.value = record.customer_phone || "";
  consultDateInput.value = record.consult_date || todayInputValue();
  ageGroupInput.value = record.age_group || "";
  customerNotesInput.value = record.customer_notes || "";
  frameWidthMmInput.value = record.frame_width_mm ?? "";
  customerStatusInput.value = record.customer_status || "waiting";
  hasPrescriptionInput.checked = Boolean(record.has_prescription);
  applyPrescriptionData(record.prescription || {});
  setPrescriptionSectionVisible(hasPrescriptionInput.checked);
  applyPreferences(record.preferences);

  if (record.analysis) {
    latestAnalysis = record.analysis;
    latestAiFaceShape = record.faceShape_ai || record.analysis.faceShape_ai || record.analysis.shape || "";
    confirmedFaceShape = record.faceShape_confirmed || record.analysis.faceShape_confirmed || "";
    latestAnalysis.faceShape_ai = latestAiFaceShape;
    latestAnalysis.faceShape_confirmed = confirmedFaceShape;
    latestRecommendations = record.recommendations?.length
      ? record.recommendations
      : (confirmedFaceShape ? getFrameRecommendations(confirmedFaceShape) : []);
    latestLensRecommendations = record.lens_recommendations || getLensRecommendations(readPreferences());
    faceShapeText.textContent = confirmedFaceShape ? getFaceShapeLabel(confirmedFaceShape) : record.analysis.label;
    if (confirmedFaceShapeInput) {
      confirmedFaceShapeInput.value = confirmedFaceShape;
      confirmedFaceShapeInput.disabled = false;
    }
    renderMetricsV2(record.analysis.metrics, record.analysis.quality, record.analysis.diagnostics);
    renderConfidenceNotice(record.analysis, getConfidenceState(record.analysis), true);
    renderCustomerResult();
    renderRecommendations(latestRecommendations);
    renderLensRecommendations(latestLensRecommendations);
  } else {
    latestAnalysis = null;
    latestAiFaceShape = record.faceShape_ai || "";
    confirmedFaceShape = record.faceShape_confirmed || "";
    latestRecommendations = [];
    lastRenderedShape = "";
    faceShapeText.textContent = "Đang chờ";
    if (confirmedFaceShapeInput) {
      confirmedFaceShapeInput.value = confirmedFaceShape;
      confirmedFaceShapeInput.disabled = !latestAiFaceShape;
    }
    renderConfidenceNotice(null, { level: "low", percent: 0 }, false, "Chưa có dữ liệu phân tích.");
    renderCustomerResult();
    renderMetricsV2({
      lengthToWidth: 0,
      foreheadToCheek: 0,
      jawToCheek: 0,
      jawToForehead: 0,
      cheekToJaw: 0
    });
  }

  updateCameraStatus(0, record.analysis || null);
  renderConsultationSummary();

  currentSessionCode = record.session_code || createSessionCode();
  ensureCurrentSessionCode();
  syncCurrentCustomer("customerSelected", record);
  statusText.textContent = "Đã mở hồ sơ";
  isLoadingCustomer = false;
  return true;
}

function showTab(tabId) {
  tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === tabId);
  });
}

function readPreferences() {
  const prescriptionLevel = derivePrescriptionLevel();
  const prescription = readPrescriptionData();
  return {
    budget: budgetInput.value,
    purpose: purposeInput.value,
    prescription_level: prescriptionLevel,
    prescription,
    frame_width_mm: parseOptionalNumber(frameWidthMmInput.value),
    notes: customerNotesInput.value.trim(),
    frame_preference: framePreferenceInput.value,
    brands: [...preferenceForm.querySelectorAll('input[name="brands"]:checked')].map(
      (input) => input.value
    )
  };
}

function readCustomerSnapshot() {
  return {
    customer_code: customerCodeInput.value || "",
    customer_name: customerNameInput.value.trim() || "",
    customer_phone: customerPhoneInput.value.trim() || "",
    consult_date: consultDateInput.value || todayInputValue(),
    age_group: ageGroupInput.value || "",
    customer_notes: customerNotesInput.value.trim() || "",
    customer_status: customerStatusInput.value || "waiting",
    session_code: ensureCurrentSessionCode(),
    frame_width_mm: parseOptionalNumber(frameWidthMmInput.value),
    has_prescription: hasPrescriptionInput.checked,
    prescription: readPrescriptionData(),
    preferences: readPreferences(),
    analysis: latestAnalysis,
    faceShape_ai: latestAiFaceShape || latestAnalysis?.faceShape_ai || latestAnalysis?.shape || "",
    faceShape_confirmed: confirmedFaceShape || latestAnalysis?.faceShape_confirmed || "",
    recommendations: latestRecommendations,
    lens_recommendations: latestLensRecommendations
  };
}

function syncCurrentCustomer(eventName, sourceRecord = null) {
  if (suppressCurrentCustomerSync) {
    return;
  }

  const customer = sourceRecord || readCustomerSnapshot();
  customer.session_code = customer.session_code || ensureCurrentSessionCode();
  setCurrentCustomer(customer, eventName);
  renderCurrentCustomerSummary(customer);
}

function renderCurrentCustomerSummary(customer = loadCurrentCustomer() || readCustomerSnapshot()) {
  if (!currentCustomerSummary) {
    return;
  }

  if (sessionCodeValue) {
    sessionCodeValue.textContent = customer.session_code || ensureCurrentSessionCode();
  }

  const prescription = customer.prescription || {};
  const preferences = customer.preferences || {};
  const selectedBrands = Array.isArray(preferences.brands) ? preferences.brands : [];

  currentCustomerSummary.innerHTML = `
    <div class="current-customer-grid">
      <div><strong>Mã</strong><span>${customer.customer_code || "--"}</span></div>
      <div><strong>Tên</strong><span>${customer.customer_name || "--"}</span></div>
      <div><strong>SĐT</strong><span>${customer.customer_phone || "--"}</span></div>
      <div><strong>Trạng thái</strong><span>${statusLabel(customer.customer_status)}</span></div>
      <div><strong>Phiên tư vấn</strong><span>${customer.session_code || currentSessionCode || "--"}</span></div>
      <div><strong>Đơn kính</strong><span>${customer.has_prescription ? "Có" : "Chưa có"}</span></div>
      <div><strong>PD / SPH / CYL</strong><span>${formatPrescriptionSummary(prescription)}</span></div>
      <div><strong>Rộng gọng</strong><span>${customer.frame_width_mm ? `${customer.frame_width_mm} mm` : "--"}</span></div>
      <div><strong>Nhu cầu</strong><span>${purposeLabel(preferences.purpose)}</span></div>
      <div><strong>Ngân sách</strong><span>${budgetLabel(preferences.budget)}</span></div>
      <div><strong>Hãng</strong><span>${selectedBrands.join(", ") || "--"}</span></div>
      <div class="current-customer-wide"><strong>Ghi chú</strong><span>${customer.customer_notes || "--"}</span></div>
    </div>
  `;
}

function applyPreferences(preferences = {}) {
  budgetInput.value = preferences.budget || "medium";
  purposeInput.value = preferences.purpose || "daily";
  prescriptionLevelInput.value = preferences.prescription_level || "unknown";
  framePreferenceInput.value = preferences.frame_preference || "balanced";
  frameWidthMmInput.value = preferences.frame_width_mm ?? "";
  const selectedBrands = preferences.brands || ["Fano", "Essilor Element", "Essilor", "Carl Zeiss"];
  preferenceForm.querySelectorAll('input[name="brands"]').forEach((input) => {
    input.checked = selectedBrands.includes(input.value);
  });
  renderCurrentCustomerSummary(readCustomerSnapshot());
  updateAdvice();
}

function setPrescriptionSectionVisible(visible) {
  prescriptionSection.hidden = !visible;
}

function clearPrescriptionInputs() {
  prescriptionPdInput.value = "";
  prescriptionSphInput.value = "";
  prescriptionCylInput.value = "";
}

function readPrescriptionData() {
  if (!hasPrescriptionInput.checked) {
    return {};
  }

  return {
    pd: parseOptionalNumber(prescriptionPdInput.value),
    sph: parseOptionalNumber(prescriptionSphInput.value),
    cyl: parseOptionalNumber(prescriptionCylInput.value)
  };
}

function applyPrescriptionData(prescription = {}) {
  prescriptionPdInput.value = prescription.pd ?? "";
  prescriptionSphInput.value = prescription.sph ?? "";
  prescriptionCylInput.value = prescription.cyl ?? "";
}

function formatPrescriptionSummary(prescription = {}) {
  const pd = prescription.pd ?? "--";
  const sph = prescription.sph ?? "--";
  const cyl = prescription.cyl ?? "--";
  return `PD ${pd} | SPH ${sph} | CYL ${cyl}`;
}

function parseOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function derivePrescriptionLevel() {
  if (!hasPrescriptionInput.checked) {
    return prescriptionLevelInput.value;
  }

  const prescription = readPrescriptionData();
  const sphere = Math.abs(Number(prescription.sph || 0));
  const cylinder = Math.abs(Number(prescription.cyl || 0));
  const totalPower = sphere + cylinder;

  if (totalPower >= 4) return "high";
  if (totalPower >= 2) return "medium";
  if (totalPower > 0) return "low";
  return prescriptionLevelInput.value;
}

function updateAdvice() {
  const preferences = readPreferences();
  if (hasPrescriptionInput.checked && prescriptionLevelInput.value !== preferences.prescription_level) {
    prescriptionLevelInput.value = preferences.prescription_level;
  }
  const lensAdvice = analyzeLensNeeds(preferences);
  const shouldShowLensAdvice = hasActionableLensData(preferences, lensAdvice);
  latestLensRecommendations = shouldShowLensAdvice ? getLensRecommendations(preferences) : [];
  renderLensRecommendations(latestLensRecommendations, shouldShowLensAdvice);
  renderLensPreview(lensAdvice, latestLensRecommendations);
  renderCurrentCustomerSummary(readCustomerSnapshot());

  if (!confirmedFaceShape) {
    latestRecommendations = [];
    frameList.innerHTML = `<p class="empty-state">Hoàn tất VisionID và xác nhận dạng mặt để lấy gợi ý gọng.</p>`;
    renderConsultationSummary();
    return;
  }

  latestRecommendations = getFrameRecommendations(confirmedFaceShape);
  renderRecommendations(enrichFrameRecommendations(latestRecommendations, preferences));
  renderConsultationSummary();
}

function renderLensPreview(lensAdvice, lenses = []) {
  if (!lensPreview) {
    return;
  }

  const hasPrescriptionData = Number(lensAdvice.totalPower) > 0;
  const hasWarnings = Array.isArray(lensAdvice.warnings) && lensAdvice.warnings.length > 0;

  if (!hasPrescriptionData && !hasWarnings) {
    lensPreview.innerHTML = `
      <p class="empty-state">Nhập PD, SPH, CYL ở Hồ sơ để hệ thống tự đề xuất chiết suất tròng kính.</p>
    `;
    return;
  }

  const productHints = lenses
    .slice(0, 2)
    .map(
      (lens) => `
        <div class="lens-preview-item">
          <strong>${lens.brand} ${lens.line}</strong>
          <span>Chiết suất ${lens.index} - ${budgetLabel(lens.budget)}</span>
        </div>
      `
    )
    .join("");

  const warningItems = hasWarnings
    ? lensAdvice.warnings
        .map((warning) => `<div class="lens-preview-item warning">${warning}</div>`)
        .join("")
    : "";

  lensPreview.innerHTML = `
    <div class="lens-preview-list">
      <div class="lens-preview-item">
        <strong>Tổng độ tham chiếu</strong>
        <span>${lensAdvice.totalPower.toFixed(2)}D</span>
      </div>
      <div class="lens-preview-item">
        <strong>Chiết suất nên ưu tiên</strong>
        <span>${lensAdvice.recommendedIndex || "Cần thêm dữ liệu"}</span>
      </div>
      <div class="lens-preview-item">
        <strong>Nhận định nhanh</strong>
        <span>${lensAdvice.summary}</span>
      </div>
      ${warningItems}
      ${productHints}
    </div>
  `;
}

function hasActionableLensData(preferences, lensAdvice) {
  const hasPrescriptionData = Number(lensAdvice.totalPower) > 0;
  const hasSpecificPurpose = !["daily", "fashion"].includes(preferences.purpose);
  const hasExplicitLevel = preferences.prescription_level && preferences.prescription_level !== "unknown";
  return hasPrescriptionData || hasSpecificPurpose || hasExplicitLevel || preferences.budget === "premium";
}

function renderConsultationSummary() {
  if (!consultationSummary) {
    return;
  }

  if (!confirmedFaceShape) {
    consultationSummary.innerHTML = `
      <p class="empty-state">Hoàn tất VisionID và xác nhận dạng mặt để tạo kết luận tư vấn.</p>
    `;
    return;
  }

  const customer = readCustomerSnapshot();
  const preferences = readPreferences();
  const topFrames = (latestRecommendations.length ? latestRecommendations : getFrameRecommendations(confirmedFaceShape))
    .slice(0, 3);
  const lensLine = latestLensRecommendations[0]
    ? `${latestLensRecommendations[0].brand} ${latestLensRecommendations[0].line}`
    : "Chưa cần chốt tròng, bổ sung đơn kính nếu có.";

  consultationSummary.innerHTML = `
    <div class="summary-hero">
      <div class="face-icon large">${FACE_SHAPE_ICONS[confirmedFaceShape] || "?"}</div>
      <div>
        <span>Kết luận VisionID</span>
        <strong>${getFaceShapeLabel(confirmedFaceShape)}</strong>
        <p>${customer.customer_name || "Khách hàng"} nên thử các form gọng cân bằng với nhu cầu ${purposeLabel(preferences.purpose).toLowerCase()}.</p>
      </div>
    </div>
    <div class="summary-grid">
      <div><span>Dạng mặt AI</span><strong>${latestAiFaceShape ? getFaceShapeLabel(latestAiFaceShape) : "Chưa có"}</strong></div>
      <div><span>Nhân viên xác nhận</span><strong>${getFaceShapeLabel(confirmedFaceShape)}</strong></div>
      <div><span>Tròng kính</span><strong>${lensLine}</strong></div>
      <div><span>Trạng thái</span><strong>${statusLabel(customer.customer_status)}</strong></div>
    </div>
    <div class="summary-picks">
      ${topFrames.map((frame) => `<span>${frame.name}</span>`).join("")}
    </div>
  `;
}

function saveFeedback() {
  const feedback = {
    id: `FB-${Date.now()}`,
    type: feedbackTypeInput?.value || "other",
    notes: feedbackNotesInput?.value.trim() || "",
    customer_code: customerCodeInput.value || "",
    faceShape_ai: latestAiFaceShape || "",
    faceShape_confirmed: confirmedFaceShape || "",
    status: customerStatusInput.value || "waiting",
    created_at: new Date().toISOString()
  };

  const records = loadFeedbackRecords();
  records.unshift(feedback);
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(records.slice(0, 200)));

  if (feedbackNotesInput) {
    feedbackNotesInput.value = "";
  }

  if (feedbackStatus) {
    feedbackStatus.textContent = "Đã lưu góp ý cục bộ cho hồ sơ hiện tại.";
  }
}

function loadFeedbackRecords() {
  try {
    const records = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || "[]");
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function enrichFrameRecommendations(frames, preferences) {
  return frames.map((frame) => {
    const extra = [];
    if (preferences.frame_preference === "light") extra.push("ưu tiên chất liệu titanium hoặc nhựa mỏng nhẹ");
    if (preferences.frame_preference === "bold") extra.push("chọn bản gọng rõ nét, màu đậm vừa phải");
    if (preferences.frame_preference === "minimal") extra.push("chọn gọng thanh mảnh, ít chi tiết");
    if (preferences.frame_preference === "office") extra.push("ưu tiên màu trung tính, dễ phối đồ công sở");
    if (preferences.budget === "low") extra.push("giữ form đơn giản để tối ưu chi phí");
    if (preferences.budget === "premium") extra.push("có thể kết hợp gọng cao cấp và tròng mỏng hơn");

    return {
      ...frame,
      reason: extra.length ? `${frame.reason} Gợi ý thêm: ${extra.join(", ")}.` : frame.reason
    };
  });
}

function resetAdviceState() {
  latestAnalysis = null;
  latestAiFaceShape = "";
  confirmedFaceShape = "";
  latestRecommendations = [];
  latestLensRecommendations = [];
  lastRenderedShape = "";
  faceShapeText.textContent = "Đang chờ";
  if (confirmedFaceShapeInput) {
    confirmedFaceShapeInput.value = "";
    confirmedFaceShapeInput.disabled = true;
  }
  renderCustomerResult();
  renderMetricsV2({
    lengthToWidth: 0,
    foreheadToCheek: 0,
    jawToCheek: 0,
    jawToForehead: 0,
    cheekToJaw: 0
  });
  frameList.innerHTML = `<p class="empty-state">Hoàn tất VisionID để lấy dữ liệu khuôn mặt và gợi ý gọng.</p>`;
  renderConsultationSummary();
  updateAdvice();
}

function markCustomerAsMeasured() {
  if (!confirmedFaceShape) {
    statusText.textContent = "Cần xác nhận dạng mặt trước";
    return;
  }

  customerStatusInput.value = "measured";
  syncCurrentCustomer("customerUpdated");
  saveCurrentCustomer();
  renderCustomers();
  statusText.textContent = "Đã chuyển sang trạng thái đã đo";
}

function budgetLabel(value) {
  const labels = {
    low: "Tiết kiệm",
    medium: "Cân bằng",
    high: "Cao cấp",
    premium: "Cao cấp"
  };

  return labels[value] || "Cân bằng";
}

function purposeLabel(value) {
  const labels = {
    daily: "Đeo hằng ngày",
    screen: "Màn hình",
    driving: "Lái xe",
    fashion: "Thời trang",
    active: "Vận động",
    high_rx: "Độ cao",
    budget: "Tối ưu chi phí"
  };

  return labels[value] || "Chưa chọn mục đích";
}

function normalizeSearch(value) {
  return (value || "").trim().toLowerCase();
}

function customerMatches(record, query) {
  if (!query) {
    return true;
  }

  return [
    record.customer_code,
    record.customer_name,
    record.customer_phone,
    record.session_code,
    statusLabel(record.customer_status),
    record.analysis?.label,
    record.customer_notes,
    record.prescription?.pd,
    record.prescription?.sph,
    record.prescription?.cyl,
    record.frame_width_mm
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function schedulePhoneLookup() {
  window.clearTimeout(phoneLookupTimer);
  phoneLookupTimer = window.setTimeout(autoFillFromPhone, 450);
}

function autoFillFromPhone() {
  if (isLoadingCustomer) {
    return;
  }

  const phone = normalizePhone(customerPhoneInput.value);
  if (phone.length < 8) {
    return;
  }

  const existingRecord = findLatestCustomerByPhone(phone);
  if (!existingRecord || existingRecord.customer_code === customerCodeInput.value) {
    return;
  }

  loadCustomerRecord(existingRecord.customer_code);
  statusText.textContent = "Đã lấy dữ liệu từ đơn cũ";
}

function findLatestCustomerByPhone(phone) {
  return loadCustomers()
    .filter((record) => normalizePhone(record.customer_phone) === phone)
    .sort((first, second) => new Date(second.updated_at) - new Date(first.updated_at))[0];
}

function normalizePhone(value) {
  return (value || "").replace(/\D/g, "");
}

function statusLabel(value) {
  const labels = {
    waiting: "Đang chờ tư vấn",
    measured: "Đã đo đơn",
    closed: "Đã chốt đơn"
  };

  return labels[value] || labels.waiting;
}

function formatConsultDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
}

function ageGroupLabel(value) {
  const labels = {
    preschool: "Mầm non",
    primary: "Tiểu học",
    secondary: "Trung học",
    student: "Sinh viên",
    office: "Văn phòng",
    middle_age: "Trung niên",
    senior: "Người lớn tuổi"
  };

  return labels[value] || "Chưa chọn nhóm tuổi";
}

hasPrescriptionInput.addEventListener("change", () => {
  setPrescriptionSectionVisible(hasPrescriptionInput.checked);
  if (!hasPrescriptionInput.checked) {
    clearPrescriptionInputs();
  }
  syncCurrentCustomer("customerSelected");
  updateAdvice();
});

prescriptionPdInput.addEventListener("input", () => {
  syncCurrentCustomer("customerUpdated");
  updateAdvice();
});
prescriptionSphInput.addEventListener("input", () => {
  syncCurrentCustomer("customerUpdated");
  updateAdvice();
});
prescriptionCylInput.addEventListener("input", () => {
  syncCurrentCustomer("customerUpdated");
  updateAdvice();
});
customerPhoneInput.addEventListener("input", () => {
  syncCurrentCustomer("customerUpdated");
  schedulePhoneLookup();
});
customerPhoneInput.addEventListener("change", autoFillFromPhone);
customerNotesInput.addEventListener("input", () => {
  syncCurrentCustomer("customerUpdated");
  updateAdvice();
});
frameWidthMmInput.addEventListener("input", () => {
  syncCurrentCustomer("customerUpdated");
  updateAdvice();
});
customerStatusInput.addEventListener("change", () => {
  syncCurrentCustomer("customerUpdated");
  renderCustomers();
});

if (markMeasuredButton) {
  markMeasuredButton.addEventListener("click", markCustomerAsMeasured);
}

if (cameraModeButton) {
  cameraModeButton.addEventListener("click", toggleCameraMode);
}

if (analyzeFaceButton) {
  analyzeFaceButton.addEventListener("click", analyzeFaceSequence);
}

if (confirmedFaceShapeInput) {
  confirmedFaceShapeInput.addEventListener("change", () => {
    confirmedFaceShape = confirmedFaceShapeInput.value;
    if (latestAnalysis) {
      latestAnalysis.faceShape_ai = latestAiFaceShape || latestAnalysis.shape || "";
      latestAnalysis.faceShape_confirmed = confirmedFaceShape;
    }
    faceShapeText.textContent = confirmedFaceShape ? getFaceShapeLabel(confirmedFaceShape) : "Chưa xác nhận";
    renderCustomerResult();
    renderCameraConfidenceOverlay(latestAnalysis, latestAnalysis ? getConfidenceState(latestAnalysis) : { level: "low", percent: 0 });
    updateAdvice();
    syncCurrentCustomer("customerUpdated");
    if (markMeasuredButton) {
      markMeasuredButton.disabled = !confirmedFaceShape;
    }
  });
}

if (customerViewToggle) {
  customerViewToggle.addEventListener("change", () => {
    document.getElementById("tab-3")?.classList.toggle("guest-view", customerViewToggle.checked);
  });
}

if (saveFeedbackButton) {
  saveFeedbackButton.addEventListener("click", saveFeedback);
}

startButton.addEventListener("click", async () => {
  try {
    await enableCamera();
  } catch (error) {
    console.error(error);
    statusText.textContent = "Không thể khởi tạo";
    startButton.disabled = false;
  }
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.tabTarget));
});

newCustomerButton.addEventListener("click", startNewCustomer);
saveCustomerButton.addEventListener("click", saveCurrentCustomer);
customerSearch.addEventListener("input", renderCustomers);
preferenceForm.addEventListener("input", () => {
  syncCurrentCustomer("customerUpdated");
  updateAdvice();
});
preferenceForm.addEventListener("change", () => {
  syncCurrentCustomer("customerUpdated");
  updateAdvice();
});

customerList.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-customer]");
  const deleteButton = event.target.closest("[data-delete-customer]");

  if (loadButton) {
    loadCustomerRecord(loadButton.dataset.loadCustomer);
  }

  if (deleteButton) {
    const deletedCustomerCode = deleteButton.dataset.deleteCustomer;
    deleteCustomer(deletedCustomerCode);
    if (deletedCustomerCode === customerCodeInput.value) {
      startNewCustomer();
    }
    renderCustomers();
  }
});

const initialCurrentCustomer = loadCurrentCustomer();
if (!initialCurrentCustomer?.customer_code || !loadCustomerRecord(initialCurrentCustomer.customer_code)) {
  startNewCustomer();
}
updateCameraModeButton();
renderCurrentCustomerSummary();
renderCustomers();

window.addEventListener("customerSelected", (event) => {
  if (!event.detail?.customer) {
    return;
  }
  suppressCurrentCustomerSync = true;
  renderCurrentCustomerSummary(event.detail.customer);
  suppressCurrentCustomerSync = false;
});

window.addEventListener("customerUpdated", (event) => {
  if (!event.detail?.customer) {
    return;
  }
  suppressCurrentCustomerSync = true;
  renderCurrentCustomerSummary(event.detail.customer);
  suppressCurrentCustomerSync = false;
});
