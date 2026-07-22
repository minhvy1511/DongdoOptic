import { startUserCamera } from "./camera.js?v=20260720-39";
import { clearCanvas, drawCalibrationGuide, resizeCanvasToVideo } from "./drawing.js?v=20260720-39";
import { analyzeFaceShape, classifyFaceShapeFromMetrics, estimateHeadPose, getClassificationDetail, getFaceShapeLabel } from "./face-analysis.js?v=20260722-62";
import {
  getColorGuidance,
  getFaceShapeAdvice,
  getFitGuidance,
  getFrameRecommendations,
  getMaterialRecommendations,
  getPublicAdviceEvidence,
  getPublicAdviceSourceLabel
} from "./recommendations.js?v=20260722-64";
import { analyzeLensNeeds, getLensRecommendations } from "./lens-catalog.js?v=20260722-67";
import {
  createCustomerCode,
  createSessionCode,
  deleteCustomer,
  setCurrentCustomer,
  loadCustomers,
  loadCurrentCustomer,
  saveCustomer,
  todayInputValue
} from "./customer-store.js?v=20260720-39";

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
const manualConsultButton = document.getElementById("manualConsultButton");
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
const scanHud = document.getElementById("scanHud");
const scanStepLabel = document.getElementById("scanStepLabel");
const scanPromptLabel = document.getElementById("scanPromptLabel");
const scanProgressFill = document.getElementById("scanProgressFill");
const scanSubLabel = document.getElementById("scanSubLabel");
const confirmedFaceShapeInput = document.getElementById("confirmedFaceShape");
const customerViewToggle = document.getElementById("customerViewToggle");
const customerResultCard = document.getElementById("customerResultCard");
const customerFaceShape = document.getElementById("customerFaceShape");
const customerResultSummary = document.getElementById("customerResultSummary");
const faceShapeIcon = document.getElementById("faceShapeIcon");
const captureQualityGate = document.getElementById("captureQualityGate");
const shapeCandidateStack = document.getElementById("shapeCandidateStack");
const shapeReferenceGrid = document.getElementById("shapeReferenceGrid");
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
const workflowAssistant = document.getElementById("workflowAssistant");
const workflowStepLabel = document.getElementById("workflowStepLabel");
const workflowNextLabel = document.getElementById("workflowNextLabel");
const workflowNextButton = document.getElementById("workflowNextButton");
const mobileNewButton = document.getElementById("mobileNewButton");
const mobileSaveButton = document.getElementById("mobileSaveButton");
const mobileScanButton = document.getElementById("mobileScanButton");
const mobileConsultButton = document.getElementById("mobileConsultButton");
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
let confirmedFaceShapeSource = "";
let manualConsultationMode = false;
let autoScanState = createAutoScanState();

const CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  medium: 0.5
};

const SCAN_CONFIG = {
  TARGET_YAW_DEG: 14,
  YAW_TOLERANCE_DEG: 9,
  CENTER_YAW_TOLERANCE_DEG: 8,
  ROLL_TOLERANCE_DEG: 12,
  HOLD_DURATION_MS: 320,
  CENTER_BURST_FRAMES: 24,
  CENTER_BURST_DURATION_MS: 2200,
  CENTER_BURST_MIN_SAMPLES: 8,
  CENTER_BURST_MIN_CONFIDENCE: 0.25,
  STEP_TIMEOUT_MS: 5200,
  TIMEOUT_EXTENSION_MS: 5000,
  MIN_FRAME_CONFIDENCE: 0.34,
  REQUIRED_CAPTURED_FRAMES: 1
};

const DISTANCE_CONFIG = {
  GUIDE_LEFT_RATIO: 0.19,
  GUIDE_TOP_RATIO: 0.1,
  GUIDE_WIDTH_RATIO: 0.62,
  GUIDE_HEIGHT_RATIO: 0.78,
  MIN_FACE_WIDTH_RATIO: 0.2,
  MAX_FACE_WIDTH_RATIO: 0.78,
  MIN_TOP_MARGIN_RATIO: -0.08,
  MAX_TOP_MARGIN_RATIO: 0.32,
  CHIN_POSITION_RATIO_MIN: 0.5,
  CHIN_POSITION_RATIO_MAX: 0.92
};

const DISTANCE_LANDMARKS = {
  topFace: 10,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
  leftTemple: 127,
  rightTemple: 356,
  leftBrowOuter: 70,
  rightBrowOuter: 300
};

const SCAN_STEPS = [
  { key: "center", label: "Nhìn thẳng vào camera", shortLabel: "Thẳng", targetYaw: 0, tolerance: SCAN_CONFIG.CENTER_YAW_TOLERANCE_DEG }
];

const FACE_SHAPE_ICONS = {
  oval: "OV",
  round: "TR",
  square: "VU",
  long: "CN",
  heart: "TT",
  diamond: "KC",
  unknown: "?"
};

const FACE_SHAPE_REFERENCE = {
  oval: {
    label: "Trái xoan",
    note: "Dài hơn rộng, đường nét mềm.",
    path: "M50 10 C70 10 82 28 82 50 C82 76 68 92 50 92 C32 92 18 76 18 50 C18 28 30 10 50 10 Z"
  },
  round: {
    label: "Tròn",
    note: "Chiều dài và rộng gần nhau.",
    path: "M50 14 C72 14 88 30 88 50 C88 72 72 88 50 88 C28 88 12 72 12 50 C12 30 28 14 50 14 Z"
  },
  square: {
    label: "Vuông",
    note: "Trán và hàm khá cân, hàm rõ.",
    path: "M28 16 C42 9 58 9 72 16 C82 28 84 72 72 84 C58 91 42 91 28 84 C16 72 18 28 28 16 Z"
  },
  long: {
    label: "Dài",
    note: "Chiều dài nổi bật hơn chiều rộng.",
    path: "M50 6 C68 6 78 26 78 50 C78 80 66 96 50 96 C34 96 22 80 22 50 C22 26 32 6 50 6 Z"
  },
  heart: {
    label: "Trái tim",
    note: "Trán rộng hơn, cằm gọn.",
    path: "M50 12 C74 12 88 28 82 52 C78 70 62 88 50 94 C38 88 22 70 18 52 C12 28 26 12 50 12 Z"
  },
  diamond: {
    label: "Kim cương",
    note: "Gò má rộng, trán và hàm hẹp.",
    path: "M50 8 C66 16 84 34 88 50 C82 70 66 88 50 94 C34 88 18 70 12 50 C16 34 34 16 50 8 Z"
  },
  unknown: {
    label: "Chưa rõ",
    note: "Cần nhân viên xác nhận.",
    path: "M50 14 C70 14 84 30 84 50 C84 72 70 88 50 88 C30 88 16 72 16 50 C16 30 30 14 50 14 Z"
  }
};

const FEEDBACK_STORAGE_KEY = "dongdo_optic_feedback";
const FEEDBACK_API_URL = "/api/feedback";

function createAutoScanState() {
  return {
    active: false,
    phase: "IDLE",
    token: 0,
    stepIndex: 0,
    stepStartedAt: 0,
    stepTimeoutMs: 0,
    holdStartedAt: 0,
    holdStepKey: "",
    transitionUntil: 0,
    progress: 0,
    status: "prompt",
    prompt: "Bật camera để bắt đầu quét.",
    detail: "Hệ thống sẽ tự chụp khi khuôn mặt ổn định.",
    error: "",
    errorReason: "",
    captures: {},
    captureList: [],
    timeoutExtensions: {},
    centerBurstActive: false,
    lastPose: null,
    lastAnalysis: null,
    lastDistanceCheckedAt: 0,
    distance: createDistanceState()
  };
}

function createDistanceState() {
  return {
    ready: false,
    status: "prompt",
    reason: "NO_FACE",
    message: "Đưa mặt vào khung hướng dẫn.",
    metrics: null
  };
}

function startAutoScanFlow(reason = "auto") {
  if (!video?.srcObject) {
    statusText.textContent = "Cần bật camera trước";
    updateScanHud();
    updateWorkflowAssistant();
    return;
  }

  const token = autoScanState.token + 1;
  autoScanState = createAutoScanState();
  autoScanState.active = true;
  autoScanState.phase = "CHECK_DISTANCE";
  autoScanState.token = token;
  autoScanState.stepStartedAt = performance.now();
  autoScanState.stepTimeoutMs = SCAN_CONFIG.STEP_TIMEOUT_MS;
  autoScanState.prompt = "Căn khoảng cách camera";
  autoScanState.detail = "Đưa khuôn mặt vừa khung oval trước khi quét.";
  isAnalyzingFace = true;
  manualConsultationMode = false;
  clearConfirmedFaceShape();
  latestAnalysis = null;
  latestAiFaceShape = "";
  renderCustomerResult();
  if (confirmedFaceShapeInput) {
    confirmedFaceShapeInput.disabled = true;
  }
  setAnalyzingState(true);
  renderConfidenceNotice(null, { level: "low", percent: 0 }, false, "Đang lấy ảnh thẳng chất lượng cao.");
  updateScanHud();
  updateWorkflowAssistant();
  console.debug(`[VisionID] Multi-angle scan started: ${reason}`);
}

function stopAutoScanFlow() {
  autoScanState = createAutoScanState();
  isAnalyzingFace = false;
  setAnalyzingState(false);
  updateScanHud();
}

function updateAutoScanFlow(analysis, landmarks, faceCount) {
  if (!autoScanState.active || autoScanState.phase === "ERROR" || autoScanState.phase === "RESULT") {
    return;
  }

  const now = performance.now();
  if (autoScanState.transitionUntil && now < autoScanState.transitionUntil) {
    return;
  }

  const step = SCAN_STEPS[autoScanState.stepIndex];
  if (!step) {
    finalizeMultiAngleScan();
    return;
  }

  const pose = landmarks?.length ? estimateHeadPose(landmarks) : null;
  if (analysis && pose) {
    analysis.diagnostics = {
      ...analysis.diagnostics,
      headPose: pose,
      headPoseLabel: formatPoseLabel(pose)
    };
  }

  autoScanState.lastPose = pose;
  autoScanState.lastAnalysis = analysis;
  if (!autoScanState.lastDistanceCheckedAt || now - autoScanState.lastDistanceCheckedAt >= 100) {
    autoScanState.distance = evaluateDistanceGuide(landmarks, faceCount);
    autoScanState.lastDistanceCheckedAt = now;
  }

  if (autoScanState.centerBurstActive) {
    autoScanState.prompt = "Đang lấy khung thẳng";
    autoScanState.detail = "Giữ yên, nhìn vào camera để hệ thống lấy nhiều frame ổn định.";
    autoScanState.status = "hold";
    updateScanHud();
    return;
  }

  if (autoScanState.phase === "CHECK_DISTANCE") {
    const canContinueWithWarning = autoScanState.distance?.metrics
      && autoScanState.distance.reason !== "NO_FACE"
      && autoScanState.distance.reason !== "MULTIPLE_FACES"
      && autoScanState.distance.reason !== "MISSING_LANDMARKS";
    autoScanState.prompt = "Căn khoảng cách camera";
    autoScanState.detail = canContinueWithWarning && !autoScanState.distance.ready
      ? `${autoScanState.distance.message} Vẫn cho phép quét, nhân viên kiểm tra lại kết quả sau.`
      : autoScanState.distance.message;
    autoScanState.status = canContinueWithWarning && !autoScanState.distance.ready ? "near" : autoScanState.distance.status;
    autoScanState.progress = autoScanState.distance.ready ? 1 : (canContinueWithWarning ? 0.68 : 0);
    autoScanState.holdStartedAt = 0;
    autoScanState.holdStepKey = "";

    if (autoScanState.distance.ready || canContinueWithWarning) {
      if (!autoScanState.distance.ready) {
        autoScanState.distance = {
          ...autoScanState.distance,
          ready: true,
          advisoryOnly: true,
          status: "near",
          message: "Đã nới kiểm tra khoảng cách để tiếp tục quét."
        };
        console.debug("[VisionID][distance] advisory gate passed", {
          reason: autoScanState.distance.reason,
          metrics: autoScanState.distance.metrics,
          videoWidth: video?.videoWidth || 0,
          videoHeight: video?.videoHeight || 0
        });
      }
      autoScanState.phase = "CENTERING";
      autoScanState.stepStartedAt = now;
      autoScanState.stepTimeoutMs = SCAN_CONFIG.STEP_TIMEOUT_MS;
      autoScanState.progress = 0;
      autoScanState.status = "prompt";
      autoScanState.prompt = step.label;
      autoScanState.detail = "Khoảng cách đã ổn. Giữ mặt giữa khung để máy tự chụp.";
      updateScanHud();
      return;
    }

    updateScanHud();
    return;
  }

  const condition = resolveScanCondition(step, analysis, pose, faceCount);
  const captureStep = condition.step || step;
  autoScanState.prompt = step.label;
  autoScanState.detail = condition.detail;
  autoScanState.status = condition.status;

  if (condition.ready) {
    if (autoScanState.holdStepKey !== captureStep.key) {
      autoScanState.holdStartedAt = 0;
      autoScanState.holdStepKey = captureStep.key;
    }

    if (!autoScanState.holdStartedAt) {
      autoScanState.holdStartedAt = now;
    }
    autoScanState.progress = clamp01((now - autoScanState.holdStartedAt) / SCAN_CONFIG.HOLD_DURATION_MS);

    if (autoScanState.progress >= 1) {
      captureScanStep(captureStep, analysis, pose, { promptedStep: step });
    }
  } else {
    autoScanState.holdStartedAt = 0;
    autoScanState.holdStepKey = "";
    autoScanState.progress = condition.near ? 0.32 : 0;
  }

  const stepElapsedMs = now - autoScanState.stepStartedAt;
  if (stepElapsedMs > autoScanState.stepTimeoutMs) {
    if (!autoScanState.timeoutExtensions[step.key]) {
      autoScanState.timeoutExtensions[step.key] = 1;
      autoScanState.stepStartedAt = now;
      autoScanState.stepTimeoutMs = SCAN_CONFIG.TIMEOUT_EXTENSION_MS;
      autoScanState.holdStartedAt = 0;
      autoScanState.progress = 0;
      autoScanState.status = "near";
      autoScanState.detail = "Cố lên, quay thêm chút nữa. Hệ thống gia hạn một lần cho góc này.";
      console.debug(`[VisionID] Timeout extension granted for ${step.key}`, {
        capturedFrames: autoScanState.captureList.length,
        stepIndex: autoScanState.stepIndex,
        condition
      });
      updateScanHud();
      return;
    }

    failIncompleteScan(step, condition.timeoutDetail || "Không bắt được đủ góc cần quét.");
    return;
  }

  updateScanHud();
}

function resolveScanCondition(step, analysis, pose, faceCount) {
  const primary = {
    ...evaluateScanFrame(step, analysis, pose, faceCount),
    step
  };

  if (step.key === "center" || primary.ready || primary.near) {
    return primary;
  }

  const alternate = SCAN_STEPS
    .filter((candidate) =>
      candidate.key !== "center"
      && candidate.key !== step.key
      && !autoScanState.captures[candidate.key]
    )
    .map((candidate) => ({
      ...evaluateScanFrame(candidate, analysis, pose, faceCount),
      step: candidate
    }))
    .find((candidate) => candidate.ready || candidate.near);

  if (!alternate) {
    return primary;
  }

  return {
    ...alternate,
    detail: alternate.ready
      ? `Đang nhận góc ${alternate.step.shortLabel.toLowerCase()} trước, giữ yên để máy tự chụp.`
      : `Máy đang thấy gần đúng góc ${alternate.step.shortLabel.toLowerCase()}; giữ chậm để ghi nhận góc này trước.`
  };
}

function evaluateScanFrame(step, analysis, pose, faceCount) {
  if (faceCount !== 1 || !analysis || !pose) {
    return {
      ready: false,
      near: false,
      status: "prompt",
      detail: faceCount > 1 ? "Chỉ giữ một khuôn mặt trong khung." : "Đưa mặt vào giữa khung camera.",
      timeoutDetail: "Không nhận diện được rõ một khuôn mặt."
    };
  }

  const quality = analysis.quality || {};
  const confidence = Number(quality.confidence || 0);
  const coverage = Number(quality.coverage || 0);
  const centerOk = Math.abs(Number(quality.centerOffsetX || 0)) <= 0.16
    && Math.abs(Number(quality.centerOffsetY || 0)) <= 0.16;
  const distanceOk = coverage >= 0.035 && coverage <= 0.62;
  const rollOk = Math.abs(Number(pose.rollDeg || 0)) <= SCAN_CONFIG.ROLL_TOLERANCE_DEG;
  const confidenceOk = confidence >= SCAN_CONFIG.MIN_FRAME_CONFIDENCE;
  const yawDiff = Math.abs(Number(pose.yawDeg || 0) - step.targetYaw);
  const yawOk = yawDiff <= step.tolerance;
  const yawNear = yawDiff <= step.tolerance + 7;
  const frameOk = centerOk && distanceOk && rollOk && confidenceOk;

  if (frameOk && yawOk) {
    return { ready: true, near: true, status: "hold", detail: "Giữ nguyên một chút để máy tự chụp." };
  }

  if (frameOk && yawNear) {
    return { ready: false, near: true, status: "near", detail: "Gần đúng rồi, quay chậm thêm một chút." };
  }

  if (!confidenceOk) {
    return { ready: false, near: false, status: "prompt", detail: "Giữ đủ sáng, nhìn rõ mắt và mũi.", timeoutDetail: "Tín hiệu khuôn mặt còn yếu." };
  }

  if (!centerOk) {
    return { ready: false, near: false, status: "prompt", detail: "Đưa mặt vào giữa khung trước khi quét.", timeoutDetail: "Khuôn mặt chưa nằm giữa khung." };
  }

  if (!distanceOk) {
    return { ready: false, near: false, status: "prompt", detail: coverage < 0.08 ? "Đưa mặt gần camera hơn." : "Lùi mặt ra xa camera hơn.", timeoutDetail: "Khoảng cách khuôn mặt chưa phù hợp." };
  }

  if (!rollOk) {
    return { ready: false, near: false, status: "prompt", detail: "Giữ đầu thẳng, không nghiêng vai.", timeoutDetail: "Đầu đang nghiêng quá nhiều." };
  }

  return {
    ready: false,
    near: false,
    status: "prompt",
    detail: getYawGuidance(step, pose.yawDeg),
    timeoutDetail: "Chưa đạt đúng hướng mặt cần quét."
  };
}

function evaluateDistanceGuide(landmarks, faceCount) {
  if (faceCount !== 1 || !landmarks?.length) {
    return {
      ready: false,
      status: "prompt",
      reason: faceCount > 1 ? "MULTIPLE_FACES" : "NO_FACE",
      message: faceCount > 1 ? "Chỉ giữ một khuôn mặt trong khung." : "Đưa mặt vào khung oval hướng dẫn.",
      metrics: null
    };
  }

  const guide = getDistanceGuideBox();
  const topPoint = landmarks[DISTANCE_LANDMARKS.topFace];
  const chinPoint = landmarks[DISTANCE_LANDMARKS.chin];
  const leftWidthPoint = landmarks[DISTANCE_LANDMARKS.leftTemple] || landmarks[DISTANCE_LANDMARKS.leftCheek];
  const rightWidthPoint = landmarks[DISTANCE_LANDMARKS.rightTemple] || landmarks[DISTANCE_LANDMARKS.rightCheek];

  if (!isValidPoint(chinPoint) || !isValidPoint(leftWidthPoint) || !isValidPoint(rightWidthPoint)) {
    return {
      ready: false,
      status: "prompt",
      reason: "MISSING_LANDMARKS",
      message: "Giữ rõ mặt, mắt và cằm trong khung.",
      metrics: null
    };
  }

  const browTopY = Math.min(
    ...[
      landmarks[DISTANCE_LANDMARKS.leftBrowOuter]?.y,
      landmarks[DISTANCE_LANDMARKS.rightBrowOuter]?.y
    ].filter(Number.isFinite)
  );
  const foreheadY = Number.isFinite(topPoint?.y) ? topPoint.y : browTopY - Math.abs(chinPoint.y - browTopY) * 0.3;
  const foreheadCut = !Number.isFinite(foreheadY) || foreheadY <= 0.015;
  const faceWidth = Math.abs(rightWidthPoint.x - leftWidthPoint.x);
  const faceWidthRatio = faceWidth / guide.width;
  const topMarginRatio = (foreheadY - guide.top) / guide.height;
  const chinPositionRatio = (chinPoint.y - guide.top) / guide.height;
  const metrics = {
    faceWidthRatio,
    topMarginRatio,
    chinPositionRatio,
    videoWidth: video?.videoWidth || 0,
    videoHeight: video?.videoHeight || 0,
    guide
  };

  if (foreheadCut || topMarginRatio < DISTANCE_CONFIG.MIN_TOP_MARGIN_RATIO) {
    debugDistanceGuide("FOREHEAD_CUT", metrics);
    return {
      ready: false,
      status: "near",
      reason: "FOREHEAD_CUT",
      message: "Hạ camera xuống hoặc lùi ra để thấy cả trán.",
      metrics
    };
  }

  if (faceWidthRatio < DISTANCE_CONFIG.MIN_FACE_WIDTH_RATIO) {
    debugDistanceGuide("TOO_FAR", metrics);
    return {
      ready: false,
      status: "near",
      reason: "TOO_FAR",
      message: "Tiến lại gần hơn.",
      metrics
    };
  }

  if (faceWidthRatio > DISTANCE_CONFIG.MAX_FACE_WIDTH_RATIO) {
    debugDistanceGuide("TOO_CLOSE", metrics);
    return {
      ready: false,
      status: "near",
      reason: "TOO_CLOSE",
      message: "Lùi ra xa hơn.",
      metrics
    };
  }

  if (topMarginRatio > DISTANCE_CONFIG.MAX_TOP_MARGIN_RATIO) {
    debugDistanceGuide("FACE_TOO_LOW", metrics);
    return {
      ready: false,
      status: "near",
      reason: "FACE_TOO_LOW",
      message: "Nâng mặt lên gần giữa khung hơn.",
      metrics
    };
  }

  if (chinPositionRatio < DISTANCE_CONFIG.CHIN_POSITION_RATIO_MIN) {
    debugDistanceGuide("CHIN_TOO_HIGH", metrics);
    return {
      ready: false,
      status: "near",
      reason: "CHIN_TOO_HIGH",
      message: "Hạ mặt xuống một chút để cằm nằm đúng khung.",
      metrics
    };
  }

  if (chinPositionRatio > DISTANCE_CONFIG.CHIN_POSITION_RATIO_MAX) {
    debugDistanceGuide("CHIN_TOO_LOW", metrics);
    return {
      ready: false,
      status: "near",
      reason: "CHIN_TOO_LOW",
      message: "Nâng mặt lên một chút để cằm không sát mép dưới.",
      metrics
    };
  }

  debugDistanceGuide("OK", metrics);
  return {
    ready: true,
    status: "captured",
    reason: "OK",
    message: "Khoảng cách đã ổn, giữ yên để quét.",
    metrics
  };
}

function debugDistanceGuide(reason, metrics = {}) {
  console.debug("[VisionID][distance]", {
    reason,
    faceWidthRatio: roundDebug(metrics.faceWidthRatio),
    topMarginRatio: roundDebug(metrics.topMarginRatio),
    chinPositionRatio: roundDebug(metrics.chinPositionRatio),
    videoWidth: metrics.videoWidth || 0,
    videoHeight: metrics.videoHeight || 0,
    guide: metrics.guide,
    thresholds: {
      minFaceWidth: DISTANCE_CONFIG.MIN_FACE_WIDTH_RATIO,
      maxFaceWidth: DISTANCE_CONFIG.MAX_FACE_WIDTH_RATIO,
      minTopMargin: DISTANCE_CONFIG.MIN_TOP_MARGIN_RATIO,
      maxTopMargin: DISTANCE_CONFIG.MAX_TOP_MARGIN_RATIO,
      chinMin: DISTANCE_CONFIG.CHIN_POSITION_RATIO_MIN,
      chinMax: DISTANCE_CONFIG.CHIN_POSITION_RATIO_MAX
    }
  });
}

function roundDebug(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value) * 1000) / 1000 : null;
}

function getDistanceGuideBox() {
  return {
    left: DISTANCE_CONFIG.GUIDE_LEFT_RATIO,
    top: DISTANCE_CONFIG.GUIDE_TOP_RATIO,
    width: DISTANCE_CONFIG.GUIDE_WIDTH_RATIO,
    height: DISTANCE_CONFIG.GUIDE_HEIGHT_RATIO
  };
}

function isValidPoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

async function captureCenterBurst(step, initialAnalysis, initialPose, options = {}) {
  if (autoScanState.centerBurstActive || autoScanState.captures[step.key]) {
    return;
  }

  const token = autoScanState.token;
  autoScanState.centerBurstActive = true;
  autoScanState.status = "hold";
  autoScanState.progress = 0.5;
  autoScanState.prompt = "Đang chụp chuẩn tư vấn";
  autoScanState.detail = "Giữ mặt thẳng, đủ sáng trong khoảng 2 giây.";
  updateScanHud();

  const samples = await captureCenterBurstSamples(
    SCAN_CONFIG.CENTER_BURST_FRAMES,
    SCAN_CONFIG.CENTER_BURST_DURATION_MS
  );

  if (autoScanState.token !== token || autoScanState.captures[step.key]) {
    autoScanState.centerBurstActive = false;
    return;
  }

  autoScanState.centerBurstActive = false;
  const stableCapture = buildCenterBurstCapture(samples, step, initialAnalysis, initialPose);
  if (!stableCapture) {
    autoScanState.status = "near";
    autoScanState.progress = 0.25;
    autoScanState.detail = "Chưa lấy được khung thẳng rõ, giữ mặt giữa camera thêm chút nữa.";
    updateScanHud();
    return;
  }

  console.debug("[VisionID] Center burst captured", {
    totalSamples: samples.length,
    usableSamples: stableCapture.sampleCount,
    fallbackUsed: stableCapture.fallbackUsed,
    confidence: Math.round((stableCapture.analysis.quality?.confidence || 0) * 100)
  });

  captureScanStep(step, stableCapture.analysis, stableCapture.pose, {
    ...options,
    fromCenterBurst: true,
    burst: {
      sampleCount: stableCapture.sampleCount,
      totalSamples: samples.length,
      fallbackUsed: stableCapture.fallbackUsed
    }
  });
}

async function captureCenterBurstSamples(targetFrames, durationMs) {
  const samples = [];
  const delayMs = Math.max(60, Math.round(durationMs / targetFrames));

  for (let index = 0; index < targetFrames; index += 1) {
    const results = faceLandmarker.detectForVideo(video, performance.now());
    const faces = results.faceLandmarks ?? [];
    if (faces.length === 1) {
      const landmarks = faces[0];
      const analysis = analyzeFaceShape(landmarks, getVideoFrameSize());
      const pose = estimateHeadPose(landmarks);
      samples.push({ analysis, pose, landmarks });
    }

    if (index < targetFrames - 1) {
      await delay(delayMs);
    }
  }

  return samples;
}

function buildCenterBurstCapture(samples, step, initialAnalysis, initialPose) {
  const usableSamples = samples.filter(isUsableCenterBurstSample);
  const fallbackSamples = samples
    .filter((sample) => sample?.analysis?.metrics)
    .sort((a, b) => Number(b.analysis?.quality?.confidence || 0) - Number(a.analysis?.quality?.confidence || 0));
  const selectedSamples = usableSamples.length >= SCAN_CONFIG.CENTER_BURST_MIN_SAMPLES
    ? usableSamples
    : fallbackSamples.slice(0, Math.max(1, Math.min(fallbackSamples.length, SCAN_CONFIG.CENTER_BURST_MIN_SAMPLES)));

  if (!selectedSamples.length && initialAnalysis) {
    return {
      analysis: cloneAnalysis(initialAnalysis),
      pose: { ...(initialPose || emptyPose()) },
      sampleCount: 1,
      fallbackUsed: true
    };
  }

  if (!selectedSamples.length) {
    return null;
  }

  const metrics = medianMetrics(selectedSamples.map((sample) => sample.analysis.metrics));
  const quality = averageQuality(selectedSamples.map((sample) => sample.analysis.quality));
  const pose = averagePose(selectedSamples.map((sample) => sample.pose));
  const qualityGate = buildCaptureQualityGate({
    selectedSamples,
    allSamples: samples,
    quality,
    pose,
    fallbackUsed: usableSamples.length < SCAN_CONFIG.CENTER_BURST_MIN_SAMPLES
  });
  quality.confidence = Math.max(
    quality.confidence || 0,
    Math.min(0.72, average(selectedSamples.map((sample) => Number(sample.analysis.quality?.confidence || 0))) + 0.08)
  );
  if (!qualityGate.passed) {
    quality.confidence = Math.min(quality.confidence, 0.62);
  }
  const frameClassifications = selectedSamples
    .map((sample) => sample?.analysis?.metrics ? getClassificationDetail(sample.analysis.metrics) : null)
    .filter(Boolean);
  const classification = aggregateTemporalClassification(frameClassifications, metrics);
  const shape = classification.shape;
  const analysis = analyzeFaceShapeFromMetrics(shape, metrics, quality);
  analysis.diagnostics = {
    ...analysis.diagnostics,
    classification,
    centerBurst: {
      sampleCount: selectedSamples.length,
      totalSamples: samples.length,
      fallbackUsed: usableSamples.length < SCAN_CONFIG.CENTER_BURST_MIN_SAMPLES,
      temporalStability: classification.temporalStability ?? null,
      frameVotes: classification.frameVotes || {}
    },
    qualityGate,
    warnings: analysis.diagnostics.warnings || []
  };
  if (!qualityGate.passed) {
    analysis.diagnostics.warnings = [
      `Ảnh tư vấn cần rà lại: ${qualityGate.failedLabels.join(", ")}.`,
      ...analysis.diagnostics.warnings
    ].slice(0, 4);
  }
  analysis.warnings = analysis.diagnostics.warnings;

  return {
    analysis,
    pose,
    sampleCount: selectedSamples.length,
    fallbackUsed: usableSamples.length < SCAN_CONFIG.CENTER_BURST_MIN_SAMPLES
  };
}

function aggregateTemporalClassification(classifications, fallbackMetrics) {
  if (!classifications.length) {
    return getClassificationDetail(fallbackMetrics);
  }

  const scoreTotals = new Map();
  const frameVotes = {};
  classifications.forEach((classification) => {
    const frameShape = classification.shape !== "unknown"
      ? classification.shape
      : classification.bestShape;
    if (frameShape && frameShape !== "unknown") {
      frameVotes[frameShape] = (frameVotes[frameShape] || 0) + 1;
    }

    (classification.candidates || []).forEach((candidate) => {
      if (!candidate?.name || candidate.name === "unknown") {
        return;
      }
      scoreTotals.set(candidate.name, (scoreTotals.get(candidate.name) || 0) + Number(candidate.score || 0));
    });
  });

  const averaged = [...scoreTotals.entries()]
    .map(([name, total]) => [name, total / classifications.length])
    .sort((a, b) => b[1] - a[1]);
  const [bestShape, bestScore] = averaged[0] || ["unknown", 0];
  const [secondShape, secondScore] = averaged[1] || ["unknown", 0];
  const topVoteCount = Math.max(...Object.values(frameVotes), 0);
  const temporalStability = classifications.length ? topVoteCount / classifications.length : 0;
  const margin = bestScore - secondScore;
  const marginGate = bestShape === "diamond" ? 0.1 : 0.04;
  const confidenceGate = 0.52;
  const stabilityGate = bestShape === "diamond" ? 0.42 : 0.36;
  const clarity = clamp01(
    ((margin - marginGate) / 0.22) * 0.72 +
    ((temporalStability - stabilityGate) / 0.44) * 0.28
  ) * clamp01(bestScore / 0.84);
  const shape = bestScore < confidenceGate || margin < marginGate || temporalStability < stabilityGate
    ? "unknown"
    : bestShape;

  return {
    shape,
    bestShape,
    secondShape,
    bestScore,
    secondScore,
    margin,
    clarity,
    temporalStability,
    frameVotes,
    calibrationSource: getClassificationDetail(fallbackMetrics).calibrationSource,
    candidates: averaged.map(([name, score]) => ({ name, score }))
  };
}

function buildCaptureQualityGate({ selectedSamples = [], allSamples = [], quality = {}, pose = {}, fallbackUsed = false } = {}) {
  const sampleCount = selectedSamples.length;
  const totalSamples = allSamples.length;
  const checks = [
    {
      key: "samples",
      label: "Ổn định",
      passed: sampleCount >= SCAN_CONFIG.CENTER_BURST_MIN_SAMPLES,
      value: `${sampleCount}/${Math.max(totalSamples, SCAN_CONFIG.CENTER_BURST_FRAMES)} frame`
    },
    {
      key: "landmark",
      label: "Nét mặt rõ",
      passed: Number(quality.confidence || 0) >= 0.5 && !fallbackUsed,
      value: formatPercent(Number(quality.confidence || 0))
    },
    {
      key: "pose",
      label: "Nhìn thẳng",
      passed: Math.abs(Number(pose.yawDeg || 0)) <= 8 && Math.abs(Number(pose.rollDeg || 0)) <= 10,
      value: `${Math.round(Number(pose.yawDeg || 0))}° / ${Math.round(Number(pose.rollDeg || 0))}°`
    },
    {
      key: "center",
      label: "Giữa khung",
      passed: Math.abs(Number(quality.centerOffsetX || 0)) <= 0.14 && Math.abs(Number(quality.centerOffsetY || 0)) <= 0.14,
      value: `${Math.round(Math.abs(Number(quality.centerOffsetX || 0)) * 100)}% ngang`
    },
    {
      key: "distance",
      label: "Khoảng cách",
      passed: Number(quality.coverage || 0) >= 0.08 && Number(quality.coverage || 0) <= 0.42,
      value: getDistanceLabel(Number(quality.coverage || 0))
    }
  ];
  const passedCount = checks.filter((item) => item.passed).length;
  const score = clamp01(passedCount / checks.length);
  const failedLabels = checks.filter((item) => !item.passed).map((item) => item.label.toLowerCase());

  return {
    passed: score >= 0.8 && checks.find((item) => item.key === "pose")?.passed && checks.find((item) => item.key === "landmark")?.passed,
    score,
    checks,
    failedLabels
  };
}

function isUsableCenterBurstSample(sample) {
  const quality = sample?.analysis?.quality || {};
  const pose = sample?.pose || {};
  const confidence = Number(quality.confidence || 0);
  return Boolean(sample?.analysis?.metrics)
    && confidence >= SCAN_CONFIG.CENTER_BURST_MIN_CONFIDENCE
    && Math.abs(Number(pose.yawDeg || 0)) <= SCAN_CONFIG.CENTER_YAW_TOLERANCE_DEG + 5
    && Math.abs(Number(pose.rollDeg || 0)) <= SCAN_CONFIG.ROLL_TOLERANCE_DEG + 4
    && Math.abs(Number(quality.centerOffsetX || 0)) <= 0.22
    && Math.abs(Number(quality.centerOffsetY || 0)) <= 0.22
    && Number(quality.coverage || 0) >= 0.03
    && Number(quality.coverage || 0) <= 0.66;
}

function captureScanStep(step, analysis, pose, options = {}) {
  if (autoScanState.captures[step.key]) {
    return;
  }

  if (step.key === "center" && !options.fromCenterBurst) {
    captureCenterBurst(step, analysis, pose, options);
    return;
  }

  const capture = {
    key: step.key,
    label: step.shortLabel,
    capturedAt: Date.now(),
    pose: { ...pose },
    analysis: cloneAnalysis(analysis),
    burst: options.burst || null
  };

  autoScanState.captures[step.key] = capture;
  autoScanState.captureList = SCAN_STEPS.map((item) => autoScanState.captures[item.key]).filter(Boolean);
  autoScanState.status = "captured";
  autoScanState.progress = 1;
  autoScanState.phase = `CAPTURED_${step.key.toUpperCase()}`;
  autoScanState.detail = options.promptedStep?.key && options.promptedStep.key !== step.key
    ? `Đã chụp góc ${step.shortLabel.toLowerCase()} trước.`
    : `Đã chụp góc ${step.shortLabel.toLowerCase()}.`;
  autoScanState.transitionUntil = performance.now() + 420;
  console.debug(`[VisionID] Captured ${step.key}`, {
    capturedFrames: autoScanState.captureList.length,
    capturedKeys: autoScanState.captureList.map((item) => item.key),
    promptedStep: options.promptedStep?.key || step.key
  });
  updateScanHud();

  const token = autoScanState.token;
  window.setTimeout(() => {
    if (autoScanState.token !== token) {
      return;
    }

    if (autoScanState.captureList.length >= SCAN_CONFIG.REQUIRED_CAPTURED_FRAMES) {
      finalizeMultiAngleScan();
      return;
    }

    const nextStepIndex = getNextMissingStepIndex();
    if (nextStepIndex < 0) {
      failIncompleteScan(step, "Chưa lấy được ảnh thẳng đủ rõ.");
      return;
    }

    autoScanState.stepIndex = nextStepIndex;
    autoScanState.phase = `PROMPT_${SCAN_STEPS[autoScanState.stepIndex].key.toUpperCase()}`;
    autoScanState.stepStartedAt = performance.now();
    autoScanState.stepTimeoutMs = SCAN_CONFIG.STEP_TIMEOUT_MS;
    autoScanState.holdStartedAt = 0;
    autoScanState.holdStepKey = "";
    autoScanState.progress = 0;
    autoScanState.transitionUntil = 0;
    autoScanState.status = "prompt";
    autoScanState.prompt = SCAN_STEPS[autoScanState.stepIndex].label;
    autoScanState.detail = "Di chuyển chậm, máy sẽ tự bắt đúng góc.";
    updateScanHud();
  }, 420);
}

function getNextMissingStepIndex() {
  return SCAN_STEPS.findIndex((step) => !autoScanState.captures[step.key]);
}

function finalizeMultiAngleScan() {
  const capturedCount = autoScanState.captureList.length;
  if (capturedCount < SCAN_CONFIG.REQUIRED_CAPTURED_FRAMES) {
    failIncompleteScan(SCAN_STEPS[autoScanState.stepIndex], "Chưa lấy được ảnh thẳng đủ rõ, vui lòng quét lại.");
    return;
  }

  autoScanState.phase = "AGGREGATING";
  autoScanState.active = false;
  autoScanState.progress = 1;
  autoScanState.status = "captured";
  autoScanState.prompt = "Đang tổng hợp kết quả";
  autoScanState.detail = "Đã lấy ảnh thẳng chất lượng cao.";
  updateScanHud();
  console.debug("[VisionID] Aggregating scan", {
    capturedFrames: capturedCount,
    capturedKeys: autoScanState.captureList.map((item) => item.key)
  });

  const finalAnalysis = buildMultiAngleAnalysis(autoScanState.captureList);
  isAnalyzingFace = false;
  setAnalyzingState(false);

  if (!finalAnalysis) {
    failAutoScan("Chưa đủ tin cậy, vui lòng quét lại với ánh sáng đều và giữ mặt rõ hơn.");
    return;
  }

  latestAnalysis = finalAnalysis;
  latestAiFaceShape = finalAnalysis.faceShape_ai;
  renderMetricsV2(finalAnalysis.metrics, finalAnalysis.quality, finalAnalysis.diagnostics);
  applyAnalysisConfidence(finalAnalysis, true);
  syncCurrentCustomer("customerUpdated");
  autoScanState.phase = "RESULT";
  autoScanState.status = "captured";
  autoScanState.prompt = "Đã quét xong";
  autoScanState.detail = "Kiểm tra kết quả và xác nhận dạng mặt trước khi tư vấn.";
  updateScanHud();
  updateWorkflowAssistant();
}

function failIncompleteScan(step, message) {
  const capturedKeys = autoScanState.captureList.map((capture) => capture.key);
  const missingSteps = SCAN_STEPS.filter((item) => !capturedKeys.includes(item.key));
  const missingLabels = missingSteps.map((item) => item.shortLabel.toLowerCase()).join(", ");
  console.debug("[VisionID] Incomplete scan blocked", {
    reason: "INCOMPLETE_FRAMES",
    capturedFrames: autoScanState.captureList.length,
    capturedKeys,
    missingKeys: missingSteps.map((item) => item.key),
    step: step?.key || ""
  });

  latestAnalysis = null;
  latestAiFaceShape = "";
  clearConfirmedFaceShape();
  autoScanState.active = false;
  autoScanState.phase = "ERROR";
  autoScanState.status = "error";
  autoScanState.progress = 0;
  autoScanState.errorReason = "INCOMPLETE_FRAMES";
  autoScanState.error = message;
  autoScanState.prompt = "Chụp thiếu khung";
  autoScanState.detail = `${message} Thiếu góc: ${missingLabels || "chưa xác định"}.`;
  isAnalyzingFace = false;
  setAnalyzingState(false);
  statusText.textContent = "Cần quét lại từ đầu";
  faceShapeText.textContent = "Chưa đủ dữ liệu";
  renderConfidenceNotice(null, { level: "low", percent: 0 }, false, autoScanState.detail);
  renderCustomerResult();
  renderMetricsV2({
    lengthToWidth: 0,
    foreheadToCheek: 0,
    jawToCheek: 0,
    jawToForehead: 0,
    cheekToJaw: 0
  });
  if (confirmedFaceShapeInput) {
    confirmedFaceShapeInput.value = "";
    confirmedFaceShapeInput.disabled = true;
  }
  if (markMeasuredButton) {
    markMeasuredButton.disabled = true;
  }
  frameList.innerHTML = `<p class="empty-state">VisionID chưa lấy được ảnh thẳng đủ rõ. Hãy quét lại để nhận gợi ý gọng.</p>`;
  renderConsultationSummary();
  updateScanHud();
  updateWorkflowAssistant();
}

function failAutoScan(message) {
  autoScanState.active = false;
  autoScanState.phase = "ERROR";
  autoScanState.status = "error";
  autoScanState.progress = 0;
  autoScanState.error = message;
  autoScanState.prompt = "Cần quét lại";
  autoScanState.detail = message;
  isAnalyzingFace = false;
  setAnalyzingState(false);
  statusText.textContent = "Cần quét lại";
  renderConfidenceNotice(null, { level: "low", percent: 0 }, true, message);
  updateScanHud();
  updateWorkflowAssistant();
}

function buildMultiAngleAnalysis(captures) {
  const usableCaptures = captures.filter((capture) => {
    const confidence = Number(capture?.analysis?.quality?.confidence || 0);
    return capture?.analysis?.metrics && confidence >= SCAN_CONFIG.MIN_FRAME_CONFIDENCE;
  });
  const centerCapture = usableCaptures.find((capture) => capture.key === "center");

  if (!centerCapture) {
    return null;
  }

  const metrics = { ...centerCapture.analysis.metrics };
  const centerClassification = getClassificationDetail(metrics);
  const shapeFromMetrics = centerClassification.shape;
  const resolvedShape = shapeFromMetrics;
  const isAdvisoryShape = false;
  const sideAnalysis = buildSideFrameSupport(usableCaptures, resolvedShape);
  const sideAgreement = sideAnalysis.agreement;
  const poseStability = calculatePoseStability(usableCaptures);
  const landmarkQuality = Number(centerCapture.analysis.quality?.confidence || 0);
  const classificationClarity = Number(centerClassification.clarity || 0);
  const temporalStability = Number(centerClassification.temporalStability ?? centerCapture.analysis?.diagnostics?.centerBurst?.temporalStability ?? 0.82);
  const sideAgreementScore = Number.isFinite(sideAgreement) ? sideAgreement : 0.82;
  const qualityGate = centerCapture.analysis?.diagnostics?.qualityGate || null;
  const gateScore = Number.isFinite(qualityGate?.score) ? qualityGate.score : 1;
  const compositeConfidence = clamp01(
    landmarkQuality * 0.42 +
    poseStability * 0.22 +
    classificationClarity * 0.24 +
    sideAgreementScore * 0.08 +
    gateScore * 0.04
  );
  const quality = {
    ...centerCapture.analysis.quality,
    confidence: qualityGate && !qualityGate.passed ? Math.min(compositeConfidence, 0.66) : compositeConfidence,
    confidenceComponents: {
      landmarkQuality,
      poseStability,
      classificationClarity,
      temporalStability,
      sideAgreement: sideAgreementScore,
      captureQuality: gateScore
    }
  };
  const baseAnalysis = analyzeFaceShapeFromMetrics(resolvedShape, metrics, quality);
  const diagnostics = {
    ...baseAnalysis.diagnostics,
    confidenceBand: getConfidenceBandLabel(quality.confidence),
    sampleCount: centerCapture.burst?.sampleCount || usableCaptures.length,
    totalSamples: centerCapture.burst?.totalSamples || SCAN_CONFIG.CENTER_BURST_FRAMES,
    shapeConsistency: temporalStability,
    sideAgreement: sideAgreementScore,
    sideAnalysis: sideAnalysis.items,
    confidenceComponents: quality.confidenceComponents,
    classification: centerClassification,
    advisoryShape: isAdvisoryShape,
    qualityGate,
    autoConfirmed: resolvedShape !== "unknown" && !isAdvisoryShape && (!qualityGate || qualityGate.passed) && quality.confidence >= CONFIDENCE_THRESHOLDS.high && classificationClarity >= 0.55 && sideAgreementScore >= 0.5,
    partialScan: false,
    scanMode: "center-burst-primary",
    centerBurst: centerCapture.burst || centerCapture.analysis?.diagnostics?.centerBurst || null,
    capturedAngles: usableCaptures.map((capture) => capture.label).join(", "),
    headPose: {
      center: usableCaptures.find((capture) => capture.key === "center")?.pose || null,
      left: usableCaptures.find((capture) => capture.key === "left")?.pose || null,
      right: usableCaptures.find((capture) => capture.key === "right")?.pose || null
    }
  };

  if (isAdvisoryShape) {
    diagnostics.warnings = [
      `AI nghiêng về ${getFaceShapeLabel(resolvedShape)} nhưng ranh giới còn mập mờ, cần nhân viên xác nhận.`,
      ...getConfidenceReasons({ ...baseAnalysis, quality, diagnostics })
    ].slice(0, 4);
  } else {
    diagnostics.warnings = getConfidenceReasons({ ...baseAnalysis, quality, diagnostics }).slice(0, 4);
  }

  return {
    ...baseAnalysis,
    shape: resolvedShape,
    label: getFaceShapeLabel(resolvedShape),
    quality,
    diagnostics,
    warnings: diagnostics.warnings,
    faceShape_ai: resolvedShape,
    faceShape_confirmed: diagnostics.autoConfirmed ? resolvedShape : ""
  };
}

function buildSideFrameSupport(captures, centerShape) {
  const sideCaptures = captures.filter((capture) => capture.key === "left" || capture.key === "right");
  const usableShape = centerShape && centerShape !== "unknown" ? centerShape : "";
  const items = sideCaptures.map((capture) => {
    const compensatedMetrics = compensateSideMetrics(capture.analysis.metrics, capture.pose?.yawDeg);
    const shape = classifyFaceShapeFromMetrics(compensatedMetrics);
    return {
      key: capture.key,
      label: capture.label,
      yawDeg: capture.pose?.yawDeg || 0,
      shape,
      compensatedMetrics,
      supportsCenter: usableShape ? isAdjacentFaceShape(usableShape, shape) : false
    };
  });
  const comparable = items.filter((item) => item.shape && item.shape !== "unknown");
  const agreement = usableShape && comparable.length
    ? comparable.filter((item) => item.supportsCenter).length / comparable.length
    : 0.82;

  return { items, agreement };
}

function compensateSideMetrics(metrics = {}, yawDeg = 0) {
  const yawRadians = Math.abs(Number(yawDeg || 0)) * Math.PI / 180;
  const widthCorrection = 1 / Math.max(0.78, Math.cos(yawRadians));

  return {
    ...metrics,
    lengthToWidth: Number(metrics.lengthToWidth || 0) / widthCorrection
  };
}

function isAdjacentFaceShape(primaryShape, supportShape) {
  if (!primaryShape || !supportShape || supportShape === "unknown") {
    return false;
  }

  if (primaryShape === supportShape) {
    return true;
  }

  const adjacentShapes = {
    oval: ["long", "round", "heart"],
    long: ["oval", "diamond"],
    round: ["oval", "square"],
    square: ["round", "oval"],
    heart: ["oval", "diamond"],
    diamond: ["heart", "oval", "long"]
  };

  return adjacentShapes[primaryShape]?.includes(supportShape) || false;
}

function calculatePoseStability(captures) {
  if (!captures.length) {
    return 0;
  }

  const scores = captures.map((capture) => {
    const step = SCAN_STEPS.find((item) => item.key === capture.key);
    const targetYaw = Number(step?.targetYaw || 0);
    const tolerance = Number(step?.tolerance || SCAN_CONFIG.YAW_TOLERANCE_DEG);
    const yawError = Math.abs(Number(capture.pose?.yawDeg || 0) - targetYaw);
    const rollError = Math.abs(Number(capture.pose?.rollDeg || 0));
    const yawScore = clamp01(1 - yawError / (tolerance + 10));
    const rollScore = clamp01(1 - rollError / 18);
    return yawScore * 0.76 + rollScore * 0.24;
  });

  return average(scores);
}

function cloneAnalysis(analysis) {
  return {
    ...analysis,
    metrics: { ...(analysis?.metrics || {}) },
    quality: {
      ...(analysis?.quality || {}),
      faceBox: analysis?.quality?.faceBox ? { ...analysis.quality.faceBox } : null
    },
    diagnostics: {
      ...(analysis?.diagnostics || {}),
      headPose: analysis?.diagnostics?.headPose ? { ...analysis.diagnostics.headPose } : null,
      warnings: Array.isArray(analysis?.diagnostics?.warnings) ? [...analysis.diagnostics.warnings] : []
    },
    warnings: Array.isArray(analysis?.warnings) ? [...analysis.warnings] : []
  };
}

function getYawGuidance(step, yawDeg = 0) {
  if (step.key === "center") {
    return yawDeg > 0 ? "Quay mặt về giữa thêm một chút." : "Quay mặt về giữa thêm một chút.";
  }

  const needsMore = Math.abs(yawDeg) < Math.abs(step.targetYaw);
  if (needsMore) {
    return step.key === "left" ? "Quay nhẹ thêm sang trái." : "Quay nhẹ thêm sang phải.";
  }

  return "Quay lại nhẹ một chút để đúng góc.";
}

function formatPoseLabel(pose) {
  if (!pose) {
    return "Chưa có";
  }

  const yaw = Math.round(pose.yawDeg || 0);
  const roll = Math.round(pose.rollDeg || 0);
  return `${yaw}° ngang, ${roll}° nghiêng`;
}

function getScanGuideState() {
  const step = SCAN_STEPS[autoScanState.stepIndex] || SCAN_STEPS[0];
  const label = autoScanState.phase === "RESULT"
    ? "Đã quét xong"
    : autoScanState.phase === "ERROR"
      ? "Cần quét lại"
      : autoScanState.phase === "CHECK_DISTANCE"
        ? "Canh khoảng cách"
        : `${step.shortLabel || ""} ${Math.round(autoScanState.progress * 100)}%`;
  return {
    mode: autoScanState.phase !== "IDLE" ? "scan" : "",
    phase: autoScanState.phase,
    status: autoScanState.status,
    progress: autoScanState.progress,
    distance: autoScanState.distance,
    label: autoScanState.active || autoScanState.phase === "ERROR" || autoScanState.phase === "RESULT"
      ? label
      : ""
  };
}

function updateScanHud() {
  if (!scanHud || !scanStepLabel || !scanPromptLabel || !scanProgressFill || !scanSubLabel) {
    return;
  }

  const step = SCAN_STEPS[autoScanState.stepIndex] || SCAN_STEPS[0];
  const isIdle = autoScanState.phase === "IDLE";
  const isCheckingDistance = autoScanState.phase === "CHECK_DISTANCE";
  const completeCount = autoScanState.captureList?.length || 0;
  scanHud.classList.toggle("is-idle", isIdle);
  scanStepLabel.textContent = isIdle
    ? "VisionID"
    : isCheckingDistance
      ? "Canh khoảng cách"
      : `Ảnh thẳng · ${completeCount}/${SCAN_CONFIG.REQUIRED_CAPTURED_FRAMES} đã chụp`;
  scanPromptLabel.textContent = autoScanState.prompt || step.label;
  scanSubLabel.textContent = autoScanState.detail || "Hệ thống sẽ tự chụp khi khuôn mặt ổn định.";
  scanProgressFill.style.width = `${Math.round(clamp01(autoScanState.progress) * 100)}%`;
  scanProgressFill.style.background = autoScanState.status === "error"
    ? "#e03131"
    : autoScanState.status === "captured"
      ? "#2f9e44"
      : autoScanState.status === "hold"
        ? "#2f9e44"
        : autoScanState.status === "near"
          ? "#f59f00"
          : "linear-gradient(90deg, #74c0fc, #20c997)";
}

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
  const landmarkerModule = await import("./face-landmarker.js?v=20260720-39");
  faceLandmarker = await landmarkerModule.createFaceLandmarker();
  drawingUtils = landmarkerModule.createDrawingUtils(canvasContext);
  FaceLandmarkerApi = landmarkerModule.FaceLandmarker;
  statusText.textContent = "Sẵn sàng";
}

function updateCameraStartButton({ active = false, loading = false } = {}) {
  if (!startButton) {
    return;
  }

  if (loading) {
    startButton.disabled = true;
    startButton.textContent = "Đang mở...";
    return;
  }

  startButton.disabled = false;
  startButton.textContent = active ? "Tắt camera" : "Bật camera";
}

async function enableCamera() {
  updateCameraStartButton({ loading: true });

  if (!faceLandmarker) {
    await initialize();
  }

  statusText.textContent = "Đang mở camera";
  stopCurrentCameraStream({ silent: true });
  const sessionToken = ++cameraSessionToken;
  currentCameraStream = await startUserCamera(video, { facingMode: currentCameraMode });
  resizeCanvasToVideo(canvas, video);
  cameraPanel?.classList.add("camera-active");
  statusText.textContent = "Đang nhận diện";
  if (analyzeFaceButton) {
    analyzeFaceButton.disabled = false;
  }
  updateCameraStartButton({ active: true });
  startAutoScanFlow("camera-start");
  requestAnimationFrame(() => detectFrame(sessionToken));
}

function stopCurrentCameraStream(options = {}) {
  const stream = currentCameraStream || video?.srcObject;
  if (!stream) {
    if (!options.silent) {
      updateCameraStartButton({ active: false });
    }
    return;
  }

  if (stream && typeof stream.getTracks === "function") {
    stream.getTracks().forEach((track) => track.stop());
  }

  video.srcObject = null;
  currentCameraStream = null;
  cameraPanel?.classList.remove("camera-active");
  stopAutoScanFlow();
  if (analyzeFaceButton) {
    analyzeFaceButton.disabled = true;
  }
  if (!options.silent) {
    updateCameraStartButton({ active: false });
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
  faceCountText.textContent = String(faces.length);
  landmarkCountText.textContent = faces[0] ? String(faces[0].length) : "0";

  if (!faces.length) {
    updateAutoScanFlow(null, null, 0);
    drawCalibrationGuide(canvas, null, getScanGuideState(), FaceLandmarkerApi.FACE_LANDMARKS_FACE_OVAL);
    if ((autoScanState.phase === "RESULT" || autoScanState.phase === "ERROR") && !isAnalyzingFace) {
      return;
    }
    faceShapeText.textContent = "Không thấy mặt";
    renderConfidenceNotice(null, { level: "low", percent: 0 }, false);
    updateCameraStatus(0, null);
    return;
  }

  const analysis = analyzeFaceShape(faces[0], getVideoFrameSize());
  const headPose = estimateHeadPose(faces[0]);
  analysis.diagnostics = {
    ...analysis.diagnostics,
    headPose,
    headPoseLabel: formatPoseLabel(headPose)
  };
  updateAutoScanFlow(analysis, faces[0], faces.length);
  drawCalibrationGuide(canvas, faces[0] || null, getScanGuideState(), FaceLandmarkerApi.FACE_LANDMARKS_FACE_OVAL);
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
  if ((autoScanState.phase === "RESULT" || autoScanState.phase === "ERROR") && !isAnalyzingFace) {
    return;
  }

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
  if (!video.srcObject) {
    statusText.textContent = "Cần bật camera trước";
    return;
  }
  startAutoScanFlow("manual-restart");
}

async function captureAnalysisSamples(targetFrames, durationMs) {
  const samples = [];
  const delayMs = Math.max(80, Math.round(durationMs / targetFrames));

  for (let index = 0; index < targetFrames; index += 1) {
    const results = faceLandmarker.detectForVideo(video, performance.now());
    const faces = results.faceLandmarks ?? [];
    if (faces.length === 1) {
      const analysis = analyzeFaceShape(faces[0], getVideoFrameSize());
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
  const shapeConsistency = usableSamples.length ? shapeSamples.length / usableSamples.length : 0;
  const baseAnalysis = analyzeFaceShapeFromMetrics(shape, metrics, quality);
  const autoConfirmed = quality.confidence >= CONFIDENCE_THRESHOLDS.high
    && shapeConsistency >= 0.8
    && usableSamples.length >= 6;
  const diagnostics = {
    ...baseAnalysis.diagnostics,
    warnings: getConfidenceReasons({ ...baseAnalysis, quality }).slice(0, 3),
    confidenceBand: getConfidenceBandLabel(quality.confidence),
    sampleCount: usableSamples.length,
    totalSamples: samples.length,
    shapeConsistency,
    autoConfirmed
  };

  return {
    ...baseAnalysis,
    shape,
    label: getFaceShapeLabel(shape),
    quality,
    diagnostics,
    warnings: diagnostics.warnings,
    faceShape_ai: shape,
    faceShape_confirmed: autoConfirmed ? shape : ""
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
  const diagnostics = analysis?.diagnostics || {};
  const autoConfirmed = Boolean(diagnostics.autoConfirmed);
  const sampleCount = Number(diagnostics.sampleCount || 0);
  const hasAiShape = analysis?.shape && analysis.shape !== "unknown";

  if (confidenceState.level === "low") {
    if (confirmedFaceShapeSource !== "manual") {
      clearConfirmedFaceShape();
    }
    if (hasAiShape) {
      confirmedFaceShape = analysis.shape;
      confirmedFaceShapeSource = "suggested";
      latestAnalysis.faceShape_confirmed = confirmedFaceShape;
      faceShapeText.textContent = "Gợi ý sơ bộ";
      statusText.textContent = "Cần xác nhận";
      if (confirmedFaceShapeInput) {
        confirmedFaceShapeInput.disabled = false;
        confirmedFaceShapeInput.value = analysis.shape;
      }
    } else {
      faceShapeText.textContent = confirmedFaceShape ? getFaceShapeLabel(confirmedFaceShape) : "Không đủ dữ liệu";
      statusText.textContent = confirmedFaceShape ? "Đã xác nhận thủ công" : "Không đủ dữ liệu";
    }
  } else if (!autoConfirmed && confirmedFaceShapeSource !== "manual") {
    confirmedFaceShape = hasAiShape ? analysis.shape : "";
    confirmedFaceShapeSource = hasAiShape ? "suggested" : "";
    latestAnalysis.faceShape_confirmed = confirmedFaceShape;
    if (confirmedFaceShapeInput) {
      confirmedFaceShapeInput.value = confirmedFaceShape;
      confirmedFaceShapeInput.disabled = !hasAiShape;
    }
    faceShapeText.textContent = "Gợi ý sơ bộ";
    statusText.textContent = "Cần xác nhận";
  } else {
    faceShapeText.textContent = confirmedFaceShape ? getFaceShapeLabel(confirmedFaceShape) : analysis.label;
    if (shouldDefaultConfirmed && !confirmedFaceShape) {
      confirmedFaceShape = analysis.shape;
      confirmedFaceShapeSource = "auto";
      if (confirmedFaceShapeInput) {
        confirmedFaceShapeInput.value = analysis.shape;
        confirmedFaceShapeInput.disabled = false;
      }
      latestAnalysis.faceShape_confirmed = confirmedFaceShape;
    }
    statusText.textContent = confirmedFaceShapeSource === "manual"
      ? "Đã xác nhận thủ công"
      : `Đã phân tích · ${sampleCount}/${sampleCount || 1} khung`;
  }

  renderConfidenceNotice(analysis, confidenceState, autoConfirmed || confirmedFaceShapeSource === "manual");
  renderCustomerResult();
  if (markMeasuredButton) {
    markMeasuredButton.disabled = !confirmedFaceShape && !manualConsultationMode;
  }
  updateAdvice();
}

function setAnalyzingState(isActive) {
  isAnalyzingFace = isActive;
  if (analyzeFaceButton) {
    analyzeFaceButton.disabled = isActive || !video.srcObject;
    analyzeFaceButton.classList.toggle("is-loading", isActive);
    analyzeFaceButton.textContent = isActive
      ? "Đang quét..."
      : (video.srcObject ? "Quét lại từ đầu" : "Phân tích");
  }
  statusText.textContent = isActive ? "Đang quét khuôn mặt..." : statusText.textContent;
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
  const diagnostics = analysis?.diagnostics || {};
  const sampleText = diagnostics.sampleCount ? `${diagnostics.sampleCount}/${diagnostics.totalSamples || diagnostics.sampleCount} khung` : "";
  const consistencyText = Number.isFinite(diagnostics.sideAgreement ?? diagnostics.shapeConsistency)
    ? `${Math.round((diagnostics.sideAgreement ?? diagnostics.shapeConsistency) * 100)}% tín hiệu bổ trợ`
    : "";
  const partialText = diagnostics.scanMode === "center-burst-primary" ? "Nguồn chính: ảnh thẳng đạt chuẩn tư vấn." : "";
  const hasDraftShape = diagnostics.partialScan && analysis?.shape && analysis.shape !== "unknown";
  const messages = {
    high: `Độ tin cậy ${confidenceState.percent}% - đây là gợi ý mạnh, vẫn nên rà lại.`,
    medium: `Độ tin cậy ${confidenceState.percent}% - nên xác nhận thủ công.`,
    low: hasDraftShape
      ? `Độ tin cậy ${confidenceState.percent}% - có gợi ý nháp, cần xác nhận thủ công.`
      : `Không đủ dữ liệu để xác định, vui lòng chụp lại.`
  };

  confidenceNotice.className = `confidence-notice ${confidenceState.level}`;
  confidenceNotice.innerHTML = `
    <strong>${overrideMessage || messages[confidenceState.level]}</strong>
    <span>${reasons.join(" ")}</span>
    <em>${[sampleText, consistencyText, partialText, finalResult ? "Đã đủ để chốt." : "Chỉ là gợi ý sơ bộ."].filter(Boolean).join(" · ")}</em>
  `;
  renderCameraConfidenceOverlay(analysis, confidenceState, overrideMessage);
}

function renderCameraConfidenceOverlay(analysis, confidenceState = { level: "low", percent: 0 }, overrideMessage = "") {
  if (!cameraConfidenceOverlay) {
    return;
  }

  const diagnostics = analysis?.diagnostics || {};
  const canShowDraftShape = diagnostics.partialScan && latestAiFaceShape && latestAiFaceShape !== "unknown";
  const shape = confirmedFaceShape || (confidenceState.level === "low" && !canShowDraftShape ? "" : latestAiFaceShape);
  const shapeLabel = shape ? getFaceShapeLabel(shape) : "Chưa đủ dữ liệu";
  const percentLabel = confidenceState.percent ? `${confidenceState.percent}%` : "--";
  const sampleLabel = diagnostics.sampleCount ? `${diagnostics.sampleCount}/${diagnostics.totalSamples || diagnostics.sampleCount} khung` : "";
  const consistencyLabel = Number.isFinite(diagnostics.sideAgreement ?? diagnostics.shapeConsistency)
    ? `${Math.round((diagnostics.sideAgreement ?? diagnostics.shapeConsistency) * 100)}% tín hiệu bổ trợ`
    : "";
  const partialLabel = diagnostics.scanMode === "center-burst-primary" ? "Ảnh tư vấn là nguồn chính" : "";
  const statusTextValue = overrideMessage || (
    confirmedFaceShape
      ? `Đã xác nhận - ${shapeLabel}`
      : confidenceState.level === "high"
        ? `Gợi ý mạnh - ${shapeLabel}`
        : confidenceState.level === "medium"
          ? `Gợi ý sơ bộ - ${shapeLabel}`
          : "Cần chụp lại hoặc căn mặt"
  );

  cameraConfidenceOverlay.className = `camera-confidence-overlay ${confidenceState.level || "low"}`;
  cameraConfidenceOverlay.innerHTML = `
    <span>Độ tin cậy</span>
    <strong>${percentLabel}</strong>
    <em>${[statusTextValue, sampleLabel, consistencyLabel, partialLabel].filter(Boolean).join(" · ")}</em>
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

  const components = diagnostics.confidenceComponents || quality.confidenceComponents || {};
  const classification = diagnostics.classification || {};
  if (Number(components.classificationClarity || 0) < 0.45 && classification.bestShape && classification.secondShape) {
    reasons.push(`Ranh giới dạng mặt mập mờ giữa ${getFaceShapeLabel(classification.bestShape)} và ${getFaceShapeLabel(classification.secondShape)}.`);
  }

  if (Number(components.temporalStability ?? diagnostics.centerBurst?.temporalStability ?? 1) < 0.55) {
    reasons.push("Các frame trong chuỗi quét chưa đồng thuận cao, nên giữ mặt ổn định hơn hoặc xác nhận thủ công.");
  }

  if (Number(components.poseStability || 0) < 0.55) {
    reasons.push("Góc quay khi chụp chưa ổn định, nên giữ đúng hướng được nhắc.");
  }

  if (Number(components.sideAgreement || 0) < 0.5) {
    reasons.push("Tín hiệu bổ trợ chưa đủ mạnh, cần nhân viên xác nhận thủ công.");
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

  const diagnostics = latestAnalysis?.diagnostics || {};
  const preferences = readPreferences();
  const shape = confirmedFaceShape || "";
  const directAdvice = manualConsultationMode && !shape
    ? getManualDirectFrameAdvice(preferences)
    : getDirectFrameAdvice(latestAnalysis?.metrics || {}, confirmedFaceShape || latestAiFaceShape);
  const confidenceState = latestAnalysis ? getConfidenceState(latestAnalysis) : { level: "low" };
  const canShowAiShape = Boolean(latestAiFaceShape && latestAiFaceShape !== "unknown");
  const sampleText = diagnostics.sampleCount ? `${diagnostics.sampleCount}/${diagnostics.totalSamples || diagnostics.sampleCount} khung` : "";
  const consistencyText = Number.isFinite(diagnostics.sideAgreement ?? diagnostics.shapeConsistency)
    ? `${Math.round((diagnostics.sideAgreement ?? diagnostics.shapeConsistency) * 100)}% tín hiệu bổ trợ`
    : "";
  const resultLabel = manualConsultationMode && !shape
    ? directAdvice.headline
    : shape
    ? directAdvice.headline
    : confidenceState.level === "low"
      ? "Chưa đủ dữ liệu"
      : directAdvice.headline;

  customerFaceShape.textContent = resultLabel;
  faceShapeIcon.innerHTML = getFrameSketchSvg(directAdvice.choose[0] || "", 0);
  renderShapeReference(shape || latestAiFaceShape || "");
  customerResultSummary.textContent = manualConsultationMode && !shape
    ? directAdvice.summary
    : shape
    ? directAdvice.summary
    : canShowAiShape
      ? `${directAdvice.summary} ${[sampleText, consistencyText].filter(Boolean).join(" · ")}.`
      : `AI chưa đủ dữ liệu để tư vấn gọng. Hãy chụp lại rõ hơn.`;
  renderCaptureQualityGate(latestAnalysis);
  renderShapeCandidateStack(latestAnalysis);
  customerResultCard?.classList.toggle("has-result", Boolean(shape));
}

function getDirectFrameAdvice(metrics = {}, fallbackShape = "") {
  const lengthToWidth = Number(metrics.lengthToWidth || 0);
  const foreheadToCheek = Number(metrics.foreheadToCheek || 0);
  const jawToCheek = Number(metrics.jawToCheek || 0);
  const cheekToJaw = Number(metrics.cheekToJaw || 0);
  const shapeAdvice = fallbackShape && fallbackShape !== "unknown" ? getFaceShapeAdvice(fallbackShape) : getFaceShapeAdvice("oval");
  const advice = {
    headline: "Ưu tiên gọng cân bằng tự nhiên",
    principle: shapeAdvice.principle,
    choose: [...shapeAdvice.choose],
    avoid: [...shapeAdvice.avoid],
    fit: [...shapeAdvice.fit],
    summary: "Tỷ lệ khuôn mặt khá cân bằng, nên bắt đầu bằng các form dễ đeo rồi tinh chỉnh theo độ rộng gò má và chân mày."
  };

  if (lengthToWidth >= 1.5) {
    advice.headline = "Ưu tiên gọng có chiều cao tròng";
    advice.summary = "Khuôn mặt có xu hướng dài theo chiều dọc, nên thử gọng có tròng cao vừa để cân lại tỷ lệ.";
    advice.choose = ["Wellington cao vừa", "Oval cao", "Browline mềm", "Gọng có điểm nhấn phía trên"];
    advice.avoid = ["Gọng quá dẹt", "Gọng quá mảnh theo chiều ngang", "Tròng quá thấp"];
  } else if (lengthToWidth <= 1.28) {
    advice.headline = "Ưu tiên gọng tạo nét gọn";
    advice.summary = "Chiều dài và chiều rộng khá gần nhau, nên thử gọng có đường thẳng hoặc góc bo nhẹ để khuôn mặt gọn hơn.";
    advice.choose = ["Chữ nhật bo nhẹ", "Vuông mềm", "Browline", "Cat-eye nhẹ"];
    advice.avoid = ["Gọng tròn quá mềm", "Gọng quá nhỏ", "Tròng quá thấp"];
  }

  if (jawToCheek >= 0.9) {
    advice.headline = lengthToWidth >= 1.5 ? advice.headline : "Ưu tiên gọng bo mềm đường hàm";
    advice.summary += " Đường hàm tương đối rõ, nên tránh form quá sắc hoặc quá dày ở góc ngoài.";
    advice.choose = uniqueList(["Oval", "Tròn bản vừa", "Rimless", ...advice.choose]);
    advice.avoid = uniqueList(["Gọng vuông sắc", ...advice.avoid]);
  }

  if (cheekToJaw >= 1.14) {
    advice.headline = "Ưu tiên gọng không bó gò má";
    advice.summary += " Gò má là vùng nổi bật, cần chọn bề ngang gọng nhỉnh nhẹ và viền dưới mềm.";
    advice.choose = uniqueList(["Oval bản vừa", "Cat-eye nhẹ", "Rimless", "Browline mềm", ...advice.choose]);
    advice.avoid = uniqueList(["Gọng hẹp bó sát gò má", "Gọng quá nhỏ", ...advice.avoid]);
  }

  if (foreheadToCheek >= 0.96 && jawToCheek <= 0.88) {
    advice.headline = "Ưu tiên gọng nhẹ phần trên";
    advice.summary += " Phần trên khuôn mặt nổi bật hơn phần dưới, nên tránh gọng quá nặng ở đường chân mày.";
    advice.choose = uniqueList(["Oval", "Cat-eye nhẹ", "Gọng đáy nhẹ", ...advice.choose]);
    advice.avoid = uniqueList(["Oversized nặng phần trên", ...advice.avoid]);
  }

  advice.choose = advice.choose.slice(0, 4);
  advice.avoid = advice.avoid.slice(0, 3);
  advice.fit = uniqueList([
    "Bề ngang gọng nên xấp xỉ hoặc nhỉnh nhẹ hơn điểm rộng nhất khuôn mặt.",
    "Đường trên gọng nên đi theo chân mày, không che biểu cảm mắt.",
    ...advice.fit
  ]).slice(0, 4);

  return advice;
}

function getManualDirectFrameAdvice(preferences = {}) {
  const isOffice = preferences.frame_preference === "office" || preferences.purpose === "screen";
  const isLight = preferences.frame_preference === "light" || preferences.purpose === "active";
  const isBold = preferences.frame_preference === "bold" || preferences.purpose === "fashion";

  const choose = isLight
    ? ["Gọng oval bản vừa", "Gọng không viền nhẹ", "Gọng chữ nhật mềm", "Gọng browline mảnh"]
    : isBold
      ? ["Gọng browline mềm", "Gọng cat-eye nhẹ", "Gọng oval bản vừa", "Gọng chữ nhật mềm"]
      : isOffice
        ? ["Gọng chữ nhật mềm", "Gọng oval bản vừa", "Gọng browline mềm", "Gọng không viền nhẹ"]
        : ["Gọng oval bản vừa", "Gọng chữ nhật mềm", "Gọng browline mềm", "Gọng cat-eye nhẹ"];

  return {
    headline: "Tư vấn theo nhu cầu & fitting tại quầy",
    principle: "Chưa dùng VisionID để chốt hình thái khuôn mặt. Ưu tiên độ rộng gọng, vị trí đồng tử, bridge, chân mày và cảm giác đeo thực tế.",
    choose,
    avoid: [
      "Gọng quá hẹp bó sát gò má",
      "Gọng quá nặng làm trượt sống mũi",
      "Tròng quá dẹt nếu khách có khuôn mặt dài hoặc cần vùng nhìn rộng"
    ],
    fit: [
      "Bề ngang gọng nên xấp xỉ hoặc nhỉnh nhẹ hơn điểm rộng nhất khuôn mặt.",
      "Đồng tử nên nằm gần vùng trung tâm tròng, không lệch sát mép trong/ngoài.",
      "Bridge phải ngồi chắc trên sống mũi, không tạo vết hằn và không trượt khi cúi đầu.",
      "Đường trên gọng nên đi theo chân mày, không che biểu cảm mắt."
    ],
    summary: "Dùng quy trình thủ công khi camera/AI chưa sẵn sàng: thử nhanh 2-3 form dễ đeo, loại form gây bó gò má hoặc trượt mũi, sau đó ghi góp ý để hiệu chuẩn app."
  };
}

function getManualFrameRecommendations(preferences = {}) {
  const baseShapes = ["oval", "round", "long", "square", "diamond"];
  const framesById = new Map();
  baseShapes.flatMap((shape) => getFrameRecommendations(shape)).forEach((frame) => {
    framesById.set(frame.id, frame);
  });

  return [...framesById.values()]
    .map((frame) => {
      const name = frame.name.toLowerCase();
      let score = 0;
      if (preferences.frame_preference === "office" && /chữ nhật|browline|oval/.test(name)) score += 4;
      if (preferences.frame_preference === "light" && /không viền|oval|tròn/.test(name)) score += 4;
      if (preferences.frame_preference === "minimal" && /không viền|oval|tròn/.test(name)) score += 3;
      if (preferences.frame_preference === "bold" && /browline|cat-eye|wellington/.test(name)) score += 3;
      if (preferences.purpose === "screen" && /chữ nhật|browline|oval/.test(name)) score += 3;
      if (preferences.purpose === "fashion" && /cat-eye|wellington|browline/.test(name)) score += 3;
      if (preferences.purpose === "active" && /oval|không viền|chữ nhật/.test(name)) score += 2;
      if (preferences.budget === "low" && /chữ nhật|oval/.test(name)) score += 1;
      if (preferences.budget === "premium" && /browline|không viền|wellington/.test(name)) score += 1;
      return {
        ...frame,
        score,
        reason: `${frame.reason} Dùng làm form thử nền khi tư vấn thủ công, chưa phụ thuộc nhận diện dạng mặt.`
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function uniqueList(items) {
  return [...new Set(items.filter(Boolean))];
}

function renderCaptureQualityGate(analysis) {
  if (!captureQualityGate) {
    return;
  }

  const gate = analysis?.diagnostics?.qualityGate;
  if (!gate?.checks?.length) {
    captureQualityGate.innerHTML = "";
    captureQualityGate.hidden = true;
    return;
  }

  captureQualityGate.hidden = false;
  captureQualityGate.className = `capture-quality-gate ${gate.passed ? "is-passed" : "is-warning"}`;
  captureQualityGate.innerHTML = `
    <div class="capture-quality-heading">
      <span>${gate.passed ? "Ảnh đạt chuẩn tư vấn" : "Ảnh cần rà lại"}</span>
      <strong>${Math.round(gate.score * 100)}%</strong>
    </div>
    <div class="capture-quality-list">
      ${gate.checks.map((check) => `
        <span class="${check.passed ? "is-ok" : "is-bad"}">
          <i>${check.passed ? "✓" : "!"}</i>
          ${check.label}
          <em>${check.value}</em>
        </span>
      `).join("")}
    </div>
  `;
}

function renderShapeCandidateStack(analysis) {
  if (!shapeCandidateStack) {
    return;
  }

  const signals = getFrameAdviceSignals(analysis?.metrics || {});

  if (!signals.length) {
    shapeCandidateStack.innerHTML = "";
    shapeCandidateStack.hidden = true;
    return;
  }

  shapeCandidateStack.hidden = false;
  shapeCandidateStack.innerHTML = `
    <div class="shape-candidate-heading">
      <span>Tín hiệu tư vấn</span>
      <em>Không hiển thị nhãn dạng mặt cho khách</em>
    </div>
    <div class="shape-candidate-list">
      ${signals.map((signal, index) => renderFrameAdviceSignal(signal, index)).join("")}
    </div>
  `;
}

function renderFrameAdviceSignal(signal, index) {
  const relativeScore = clamp01(signal.score);
  const isPrimary = index === 0;
  return `
    <article class="shape-candidate ${isPrimary ? "is-primary" : ""}">
      <div class="shape-candidate-topline">
        <strong>${signal.title}</strong>
        <span>${formatPercent(relativeScore)}</span>
      </div>
      <div class="shape-candidate-bar" aria-hidden="true">
        <i style="width: ${Math.max(8, Math.round(relativeScore * 100))}%"></i>
      </div>
      <p>${signal.note}</p>
    </article>
  `;
}

function getFrameAdviceSignals(metrics = {}) {
  const lengthToWidth = Number(metrics.lengthToWidth || 0);
  const foreheadToCheek = Number(metrics.foreheadToCheek || 0);
  const jawToCheek = Number(metrics.jawToCheek || 0);
  const cheekToJaw = Number(metrics.cheekToJaw || 0);
  const signals = [];

  signals.push({
    title: lengthToWidth >= 1.5 ? "Cần tròng cao hơn" : lengthToWidth <= 1.28 ? "Cần tạo nét gọn" : "Tỷ lệ dễ cân bằng",
    score: lengthToWidth >= 1.5 ? clamp01((lengthToWidth - 1.32) / 0.42) : lengthToWidth <= 1.28 ? clamp01((1.42 - lengthToWidth) / 0.32) : 0.72,
    note: lengthToWidth >= 1.5
      ? "Nên thử Wellington/oval cao vừa, tránh gọng quá dẹt."
      : lengthToWidth <= 1.28
        ? "Nên thử chữ nhật bo nhẹ, vuông mềm hoặc browline."
        : "Có thể bắt đầu bằng oval, Wellington hoặc chữ nhật mềm."
  });

  signals.push({
    title: cheekToJaw >= 1.14 ? "Không bó ngang gò má" : "Kiểm tra bề ngang gọng",
    score: cheekToJaw >= 1.14 ? clamp01((cheekToJaw - 1.02) / 0.32) : 0.62,
    note: cheekToJaw >= 1.14
      ? "Bề ngang gọng nên nhỉnh nhẹ hơn vùng gò má, viền dưới nên mềm."
      : "Bề ngang gọng nên xấp xỉ điểm rộng nhất khuôn mặt."
  });

  signals.push({
    title: jawToCheek >= 0.9 ? "Làm mềm đường hàm" : "Giữ nét nhẹ tự nhiên",
    score: jawToCheek >= 0.9 ? clamp01((jawToCheek - 0.78) / 0.24) : 0.56,
    note: jawToCheek >= 0.9
      ? "Nên thử oval/tròn bản vừa/rimless, tránh góc vuông quá sắc."
      : "Ưu tiên gọng không quá nặng ở viền dưới."
  });

  if (foreheadToCheek >= 0.96) {
    signals.push({
      title: "Giảm nặng phần trên",
      score: clamp01((foreheadToCheek - 0.88) / 0.22),
      note: "Tránh browline quá dày hoặc oversized nặng phần chân mày."
    });
  }

  return signals.sort((a, b) => b.score - a.score).slice(0, 3);
}

function getShapeEvidenceText(shape, metrics = {}) {
  const lengthToWidth = Number(metrics.lengthToWidth || 0);
  const foreheadToCheek = Number(metrics.foreheadToCheek || 0);
  const jawToCheek = Number(metrics.jawToCheek || 0);
  const cheekToJaw = Number(metrics.cheekToJaw || 0);

  if (shape === "long") {
    return lengthToWidth >= 1.48
      ? "Chiều dài mặt nổi bật hơn chiều rộng."
      : "Có xu hướng dài, nhưng cần kiểm tra lại tỷ lệ.";
  }

  if (shape === "round") {
    return lengthToWidth <= 1.28
      ? "Dài và rộng khá gần nhau, đường nét mềm."
      : "Đường nét mềm nhưng chưa thật sự tròn.";
  }

  if (shape === "square") {
    return jawToCheek >= 0.84
      ? "Hàm gần bằng gò má, tổng thể rõ góc."
      : "Có tín hiệu hàm rõ, cần xác nhận thêm.";
  }

  if (shape === "heart") {
    return foreheadToCheek >= 0.96 && jawToCheek <= 0.9
      ? "Phần trên rộng hơn, cằm/hàm gọn hơn."
      : "Có xu hướng phần trên nổi bật hơn phần dưới.";
  }

  if (shape === "diamond") {
    return cheekToJaw >= 1.12 && foreheadToCheek <= 0.92
      ? "Gò má là điểm rộng nhất, trán và hàm hẹp hơn."
      : "Có tín hiệu gò má nổi, cần xem thêm hàm/trán.";
  }

  return "Tỷ lệ cân bằng, ít cực trị giữa trán, gò má và hàm.";
}

function renderFaceShapeIcon(target, shape, includeText = false) {
  if (!target) {
    return;
  }

  target.innerHTML = getFaceShapeSvg(shape, includeText);
}

function getFaceShapeSvg(shape, includeText = false) {
  const key = FACE_SHAPE_REFERENCE[shape] ? shape : "unknown";
  const reference = FACE_SHAPE_REFERENCE[key];
  const code = FACE_SHAPE_ICONS[key] || "?";
  return `
    <svg viewBox="0 0 100 100" role="img" aria-label="${reference.label}">
      <path class="shape-line" d="${reference.path}"></path>
      <path class="shape-axis" d="M50 20 L50 84"></path>
      <path class="shape-axis" d="M34 48 L66 48"></path>
      ${includeText ? `<text x="50" y="57" text-anchor="middle" font-size="18" font-weight="800" fill="currentColor">${code}</text>` : ""}
    </svg>
  `;
}

function renderShapeReference(activeShape = "") {
  if (!shapeReferenceGrid) {
    return;
  }

  const shapes = ["oval", "round", "square", "long", "heart", "diamond"];
  shapeReferenceGrid.innerHTML = shapes
    .map((shape) => {
      const reference = FACE_SHAPE_REFERENCE[shape];
      return `
        <article class="shape-reference-item ${shape === activeShape ? "is-active" : ""}">
          <div class="shape-reference-icon">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <path class="shape-line" d="${reference.path}"></path>
              <path class="shape-axis" d="M50 20 L50 84"></path>
            </svg>
          </div>
          <div>
            <strong>${reference.label}</strong>
            <span>${reference.note}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function getFrameSketchSvg(frameName = "", index = 0) {
  const name = String(frameName || "").toLowerCase();
  const type = name.includes("cat") || name.includes("mắt mèo")
    ? "cat"
    : name.includes("brow") || name.includes("nửa")
      ? "brow"
      : name.includes("rimless") || name.includes("không viền")
        ? "rimless"
        : name.includes("vuông") || name.includes("chữ nhật") || name.includes("rectangle")
        ? "square"
        : "oval";
  const accent = ["#6f4e37", "#b49a6a", "#4b5563"][index % 3];
  const sketches = {
    oval: {
      lens: `
        <ellipse class="frame-lens" cx="37" cy="49" rx="24" ry="18"></ellipse>
        <ellipse class="frame-lens" cx="73" cy="49" rx="24" ry="18"></ellipse>
      `,
      rim: `
        <ellipse class="frame-rim" cx="37" cy="49" rx="24" ry="18"></ellipse>
        <ellipse class="frame-rim" cx="73" cy="49" rx="24" ry="18"></ellipse>
      `
    },
    square: {
      lens: `
        <rect class="frame-lens" x="14" y="33" width="45" height="32" rx="10"></rect>
        <rect class="frame-lens" x="61" y="33" width="45" height="32" rx="10"></rect>
      `,
      rim: `
        <rect class="frame-rim" x="14" y="33" width="45" height="32" rx="10"></rect>
        <rect class="frame-rim" x="61" y="33" width="45" height="32" rx="10"></rect>
      `
    },
    cat: {
      lens: `
        <path class="frame-lens" d="M12 48 C20 27 47 31 62 43 C56 63 28 69 12 48 Z"></path>
        <path class="frame-lens" d="M108 48 C100 27 73 31 58 43 C64 63 92 69 108 48 Z"></path>
      `,
      rim: `
        <path class="frame-rim" d="M12 48 C20 27 47 31 62 43 C56 63 28 69 12 48 Z"></path>
        <path class="frame-rim" d="M108 48 C100 27 73 31 58 43 C64 63 92 69 108 48 Z"></path>
      `
    },
    brow: {
      lens: `
        <path class="frame-lens" d="M15 47 C22 33 50 33 59 46 C55 65 25 68 15 47 Z"></path>
        <path class="frame-lens" d="M105 47 C98 33 70 33 61 46 C65 65 95 68 105 47 Z"></path>
      `,
      rim: `
        <path class="frame-rim light" d="M15 47 C22 33 50 33 59 46 C55 65 25 68 15 47 Z"></path>
        <path class="frame-rim light" d="M105 47 C98 33 70 33 61 46 C65 65 95 68 105 47 Z"></path>
        <path class="frame-brow" d="M16 39 C30 26 48 28 60 42 M60 42 C72 28 90 26 104 39"></path>
      `
    },
    rimless: {
      lens: `
        <ellipse class="frame-lens rimless" cx="37" cy="49" rx="23" ry="17"></ellipse>
        <ellipse class="frame-lens rimless" cx="73" cy="49" rx="23" ry="17"></ellipse>
      `,
      rim: `
        <ellipse class="frame-rim rimless" cx="37" cy="49" rx="23" ry="17"></ellipse>
        <ellipse class="frame-rim rimless" cx="73" cy="49" rx="23" ry="17"></ellipse>
      `
    }
  };
  const sketch = sketches[type] || sketches.oval;

  return `
    <svg class="frame-sketch" viewBox="0 0 120 86" role="img" aria-label="Mô phỏng ${frameName || "gọng kính"}" style="--frame-accent:${accent}">
      <ellipse class="frame-shadow" cx="60" cy="72" rx="45" ry="7"></ellipse>
      <g>
        <path class="frame-temple" d="M15 49 L4 42"></path>
        <path class="frame-temple" d="M105 49 L116 42"></path>
        ${sketch.lens.replaceAll("frame-lens", `frame-lens lens-${index}`)}
        ${sketch.rim}
        <path class="frame-bridge" d="M58 48 C60 44 62 44 64 48"></path>
        <path class="frame-pad" d="M55 53 C52 55 51 59 52 62"></path>
        <path class="frame-pad" d="M65 53 C68 55 69 59 68 62"></path>
        <path class="frame-highlight" d="M27 39 C35 34 45 35 52 39"></path>
      </g>
    </svg>
  `;
}

function getFramePresentationLabel(frameName = "") {
  const name = String(frameName || "").toLowerCase();
  if (name.includes("cat") || name.includes("mắt mèo")) {
    return "Cat-eye nâng mắt";
  }

  if (name.includes("rimless") || name.includes("không viền")) {
    return "Không viền nhẹ mặt";
  }

  if (name.includes("brow") || name.includes("nửa")) {
    return "Browline mềm";
  }

  if (name.includes("vuông") || name.includes("chữ nhật") || name.includes("rectangle")) {
    return "Vuông cân nét";
  }

  return "Oval cân bằng";
}

function getSummaryHighlights(shapeAdvice, topFrames, preferences) {
  const frameLabels = topFrames.map((frame) => getFramePresentationLabel(frame.name));
  return [
    shapeAdvice.principle,
    frameLabels.length ? `Ưu tiên ${frameLabels.join(", ")}.` : "Ưu tiên gọng làm mềm tỷ lệ khuôn mặt.",
    `Màu gợi ý: ${getColorGuidance(preferences.frame_preference)}`
  ];
}

function buildFrameTrialPlan(directAdvice = {}, topFrames = [], publicEvidence = []) {
  const firstFrame = topFrames[0]?.name || directAdvice.choose?.[0] || "Form cân bằng";
  const secondFrame = topFrames[1]?.name || directAdvice.choose?.[1] || "Form thay thế";
  const avoid = directAdvice.avoid?.[0] || "Gọng lệch tỷ lệ khuôn mặt";
  const fit = directAdvice.fit?.[0] || "Kiểm tra độ rộng gọng và vị trí đồng tử trong tròng.";
  const evidence = publicEvidence.length ? publicEvidence : [getPublicAdviceSourceLabel()];

  return {
    steps: [
      {
        label: "Thử trước",
        title: firstFrame,
        note: `Dùng làm mốc chính vì khớp hướng: ${directAdvice.headline || "cân bằng tổng thể"}.`
      },
      {
        label: "So sánh",
        title: secondFrame,
        note: "Cho khách đeo cạnh form đầu tiên để so độ sáng vùng mắt, độ rộng hai bên và cảm giác tự nhiên."
      },
      {
        label: "Loại nhanh",
        title: avoid,
        note: `${fit} Nếu gọng làm gò má/hàm bị nặng hơn, chuyển sang form mềm hoặc rộng hơn.`
      }
    ],
    evidence: evidence.slice(0, 3)
  };
}

function clearConfirmedFaceShape() {
  confirmedFaceShape = "";
  confirmedFaceShapeSource = "";
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
    cameraGuidance.textContent = autoScanState.phase !== "IDLE"
      ? `${autoScanState.prompt} ${autoScanState.detail}`
      : getCameraGuidanceV2(faceCount, stability, quality, ready, diagnostics);
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
  const confidenceComponents = diagnostics?.confidenceComponents || quality?.confidenceComponents || {};
  const componentRows = quality
    ? [
        ["Landmark", formatPercent(confidenceComponents.landmarkQuality)],
        ["Pose", formatPercent(confidenceComponents.poseStability)],
        ["Phan loai", formatPercent(confidenceComponents.classificationClarity)],
        ["On dinh chuoi", formatPercent(confidenceComponents.temporalStability ?? diagnostics?.centerBurst?.temporalStability)],
        ["Bổ trợ", formatPercent(confidenceComponents.sideAgreement)],
        ["Chất lượng ảnh", formatPercent(confidenceComponents.captureQuality)],
        ["Center burst", diagnostics?.centerBurst ? `${diagnostics.centerBurst.sampleCount || 0}/${diagnostics.centerBurst.totalSamples || 0}` : "--"],
        ["Nguồn chuẩn", diagnostics?.calibrationSource || diagnostics?.classification?.calibrationSource || "--"]
      ].filter(([, value]) => value !== "--")
    : [];
  const qualityRows = quality
    ? [
        ["Độ tin cậy", diagnostics?.confidenceBand || `${Math.round((quality.confidence || 0) * 100)}%`],
        ["Tâm khung", diagnostics?.centerLabel || getCenterLabelV2(quality)],
        ["Khoảng cách", diagnostics?.distanceLabel || getDistanceLabel(quality.coverage || 0)],
        ["Góc đầu", diagnostics?.headPoseLabel || "Chưa có"],
        ...componentRows
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

function renderRecommendations(frames, isDraft = false) {
  const draftNotice = isDraft
    ? `<p class="draft-advice-note">Gợi ý nháp từ AI. Hãy xác nhận dạng mặt ở VisionID trước khi đánh dấu đã đo hoặc chốt tư vấn.</p>`
    : "";
  const adviceFaceShape = confirmedFaceShape || getDraftFaceShapeForAdvice();
  const directAdvice = getDirectFrameAdvice(latestAnalysis?.metrics || {}, adviceFaceShape);

  frameList.innerHTML = draftNotice + frames
    .map(
      (frame) => `
        <article class="frame-card">
          <div class="frame-visual">${frame.id}</div>
          <div>
            <h3>${frame.name}</h3>
            <p>${frame.style}</p>
          </div>
          <p>${frame.reason}</p>
          <div class="frame-details">
            <span>Nên tránh: ${frame.avoidNote || directAdvice.avoid?.[0] || "Gọng lệch tỷ lệ khuôn mặt"}</span>
            <span>Fit: ${frame.fitNote || directAdvice.fit?.[0] || "Kiểm tra chân mày, độ rộng và vị trí mắt trong tròng"}</span>
          </div>
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
          ${lens.brandEvidence ? `<p class="lens-evidence">${lens.brandEvidence}</p>` : ""}
        </article>
      `
    )
    .join("");
}

function formatMetric(value) {
  return value ? value.toFixed(2) : "--";
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}%` : "--";
}

function getVideoFrameSize() {
  return {
    width: video?.videoWidth || canvas?.width || video?.clientWidth || 0,
    height: video?.videoHeight || canvas?.height || video?.clientHeight || 0
  };
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

function medianMetrics(metricsListValue) {
  return {
    lengthToWidth: median(metricsListValue.map((metrics) => metrics.lengthToWidth)),
    foreheadToCheek: median(metricsListValue.map((metrics) => metrics.foreheadToCheek)),
    jawToCheek: median(metricsListValue.map((metrics) => metrics.jawToCheek)),
    jawToForehead: median(metricsListValue.map((metrics) => metrics.jawToForehead)),
    cheekToJaw: median(metricsListValue.map((metrics) => metrics.cheekToJaw))
  };
}

function median(values) {
  const numericValues = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!numericValues.length) {
    return 0;
  }

  const middle = Math.floor(numericValues.length / 2);
  return numericValues.length % 2
    ? numericValues[middle]
    : (numericValues[middle - 1] + numericValues[middle]) / 2;
}

function averagePose(poses) {
  return {
    yawDeg: average(poses.map((pose) => pose?.yawDeg)),
    rollDeg: average(poses.map((pose) => pose?.rollDeg)),
    yawOffset: average(poses.map((pose) => pose?.yawOffset)),
    eyeDistance: average(poses.map((pose) => pose?.eyeDistance)),
    centerX: average(poses.map((pose) => pose?.centerX)),
    centerY: average(poses.map((pose) => pose?.centerY)),
    confidence: average(poses.map((pose) => pose?.confidence))
  };
}

function emptyPose() {
  return {
    yawDeg: 0,
    rollDeg: 0,
    yawOffset: 0,
    eyeDistance: 0,
    centerX: 0.5,
    centerY: 0.5,
    confidence: 0
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
  confirmedFaceShapeSource = "";
  manualConsultationMode = false;
  autoScanState = createAutoScanState();
  updateScanHud();
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
    consultation_mode: manualConsultationMode ? "manual" : "visionid",
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
  updateWorkflowAssistant();
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
            <button type="button" data-load-customer="${record.customer_code}">Mở lại</button>
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
  manualConsultationMode = record.consultation_mode === "manual";

  if (record.analysis) {
    latestAnalysis = record.analysis;
    latestAiFaceShape = record.faceShape_ai || record.analysis.faceShape_ai || record.analysis.shape || "";
    confirmedFaceShape = record.faceShape_confirmed || record.analysis.faceShape_confirmed || "";
    confirmedFaceShapeSource = confirmedFaceShape ? "manual" : "";
    autoScanState = createAutoScanState();
    autoScanState.phase = "RESULT";
    autoScanState.status = "captured";
    autoScanState.progress = 1;
    autoScanState.prompt = "Đã mở kết quả đã lưu";
    autoScanState.detail = "Có thể quét lại nếu muốn cập nhật VisionID.";
    updateScanHud();
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
    confirmedFaceShapeSource = confirmedFaceShape ? "manual" : "";
    autoScanState = createAutoScanState();
    updateScanHud();
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

  if (manualConsultationMode && !record.analysis) {
    updateAdvice();
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
  updateWorkflowAssistant();
}

function getActiveTabId() {
  return [...tabPanels].find((panel) => panel.classList.contains("active"))?.id || "tab-0";
}

function getWorkflowState() {
  const activeTabId = getActiveTabId();
  const hasIdentity = Boolean(customerNameInput.value.trim() || customerPhoneInput.value.trim());
  const hasPreferences = Boolean(purposeInput.value || budgetInput.value || customerNotesInput.value.trim());
  const hasDraftVisionId = Boolean(getDraftFaceShapeForAdvice());
  const hasConfirmedVisionId = Boolean(confirmedFaceShape);
  const hasManualConsultation = Boolean(manualConsultationMode);

  if (activeTabId === "tab-0") {
    return {
      step: hasIdentity ? "Hồ sơ đã có dữ liệu" : "Bước 1 · Hồ sơ",
      next: hasIdentity ? "Lưu hồ sơ và sang Nhu cầu" : "Nhập tên hoặc SĐT, rồi sang Nhu cầu",
      action: "Lưu & sang Nhu cầu",
      tone: hasIdentity ? "ready" : "neutral"
    };
  }

  if (activeTabId === "tab-1") {
    return {
      step: hasPreferences ? "Bước 2 · Nhu cầu" : "Bước 2 · Bổ sung nhu cầu",
      next: "Kiểm tra tròng kính nhanh, rồi sang VisionID",
      action: "Sang VisionID",
      tone: "ready"
    };
  }

  if (activeTabId === "tab-3") {
    if (hasConfirmedVisionId || hasManualConsultation) {
      return {
        step: hasManualConsultation ? "Tư vấn thủ công đã sẵn sàng" : "VisionID đã xác nhận",
        next: "Sang Tư vấn để xem kết luận và sản phẩm gợi ý",
        action: "Sang Tư vấn",
        tone: "ready"
      };
    }

    if (hasDraftVisionId) {
      return {
        step: "VisionID có gợi ý nháp",
        next: "Xác nhận dạng mặt để mở khóa kết luận chính thức",
        action: "Xác nhận dạng mặt",
        tone: "warning"
      };
    }

    return {
      step: "Bước 3 · VisionID",
      next: video?.srcObject ? "Giữ mặt thẳng để lấy ảnh chất lượng cao" : "Bật camera để bắt đầu quét",
      action: video?.srcObject ? "Quét lại từ đầu" : "Bật camera",
      tone: video?.srcObject ? "warning" : "neutral"
    };
  }

  if (activeTabId === "tab-4") {
    const canComplete = hasConfirmedVisionId || hasManualConsultation;
    return {
      step: canComplete ? "Bước 4 · Tư vấn" : "Tư vấn đang ở dạng nháp",
      next: canComplete ? "Lưu trạng thái đã đo sau khi tư vấn xong" : "Quay lại VisionID để xác nhận hoặc tư vấn thủ công",
      action: canComplete ? "Lưu đã đo" : "Quay lại VisionID",
      tone: canComplete ? "ready" : "warning"
    };
  }

  return {
    step: "Quy trình tư vấn",
    next: "Tiếp tục theo bước đang mở",
    action: "Tiếp theo",
    tone: "neutral"
  };
}

function updateWorkflowAssistant() {
  if (!workflowAssistant || !workflowStepLabel || !workflowNextLabel || !workflowNextButton) {
    return;
  }

  const state = getWorkflowState();
  workflowAssistant.className = `workflow-assistant ${state.tone || "neutral"}`;
  workflowStepLabel.textContent = state.step;
  workflowNextLabel.textContent = state.next;
  workflowNextButton.textContent = state.action;
  updateMobileActionBar();
}

function updateMobileActionBar() {
  if (!mobileNewButton || !mobileSaveButton || !mobileScanButton || !mobileConsultButton) {
    return;
  }

  const activeTabId = getActiveTabId();
  mobileNewButton.classList.toggle("is-active", activeTabId === "tab-0");
  mobileSaveButton.classList.toggle("is-active", activeTabId === "tab-1");
  mobileScanButton.classList.toggle("is-active", activeTabId === "tab-3");
  mobileConsultButton.classList.toggle("is-active", activeTabId === "tab-4");
  mobileConsultButton.disabled = !Boolean(confirmedFaceShape || getDraftFaceShapeForAdvice() || manualConsultationMode);
}

async function handleWorkflowNext() {
  const activeTabId = getActiveTabId();

  if (activeTabId === "tab-0") {
    saveCurrentCustomer();
    showTab("tab-1");
    return;
  }

  if (activeTabId === "tab-1") {
    syncCurrentCustomer("customerUpdated");
    updateAdvice();
    showTab("tab-3");
    return;
  }

  if (activeTabId === "tab-3") {
    if (confirmedFaceShape || manualConsultationMode) {
      showTab("tab-4");
      return;
    }

    if (getDraftFaceShapeForAdvice() && confirmedFaceShapeInput) {
      confirmedFaceShapeInput.disabled = false;
      confirmedFaceShapeInput.focus();
      statusText.textContent = "Chọn dạng mặt xác nhận";
      updateWorkflowAssistant();
      return;
    }

    if (!video?.srcObject) {
      await enableCamera();
    } else {
      startAutoScanFlow("workflow-restart");
    }
    updateWorkflowAssistant();
    return;
  }

  if (activeTabId === "tab-4") {
    if (confirmedFaceShape || manualConsultationMode) {
      markCustomerAsMeasured();
    } else {
      showTab("tab-3");
    }
    updateWorkflowAssistant();
  }
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
    consultation_mode: manualConsultationMode ? "manual" : "visionid",
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
  updateWorkflowAssistant();
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
  const selectedBrands = preferences.brands || ["Fano", "Essilor Element", "Essilor", "Carl Zeiss", "Gọng kính 101"];
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

  const draftFaceShape = getDraftFaceShapeForAdvice();
  const adviceFaceShape = confirmedFaceShape || draftFaceShape || (latestAnalysis?.metrics ? "oval" : "");

  if (!adviceFaceShape && !manualConsultationMode) {
    latestRecommendations = [];
    frameList.innerHTML = `<p class="empty-state">Hoàn tất VisionID để lấy gợi ý kiểu gọng nên thử.</p>`;
    renderConsultationSummary();
    updateWorkflowAssistant();
    return;
  }

  latestRecommendations = manualConsultationMode && !adviceFaceShape
    ? getManualFrameRecommendations(preferences)
    : getFrameRecommendations(adviceFaceShape);
  renderRecommendations(enrichFrameRecommendations(latestRecommendations, preferences), !latestAnalysis && !manualConsultationMode);
  renderConsultationSummary();
  updateWorkflowAssistant();
}

function getDraftFaceShapeForAdvice() {
  if (!latestAiFaceShape || latestAiFaceShape === "unknown" || !latestAnalysis) {
    return "";
  }

  const confidenceState = getConfidenceState(latestAnalysis);
  if (confidenceState.level === "low" && !latestAnalysis.diagnostics?.partialScan) {
    return "";
  }

  return latestAiFaceShape;
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
          <strong>${formatLensDisplayName(lens)}</strong>
          ${lens.brandEvidence ? `<small>${lens.brandEvidence}</small>` : ""}
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

  const draftFaceShape = getDraftFaceShapeForAdvice();
  const summaryFaceShape = confirmedFaceShape || draftFaceShape || (latestAnalysis?.metrics ? "oval" : "");
  const isManualConsultation = manualConsultationMode && !summaryFaceShape;
  const isDraft = !confirmedFaceShape && Boolean(draftFaceShape);

  if (!summaryFaceShape && !isManualConsultation) {
    consultationSummary.innerHTML = `
      <p class="empty-state">Hoàn tất VisionID để tạo kết luận tư vấn gọng.</p>
    `;
    return;
  }

  const customer = readCustomerSnapshot();
  const preferences = readPreferences();
  const shapeAdvice = isManualConsultation
    ? { principle: "Tư vấn theo nhu cầu và fitting thực tế, không chốt nhãn dạng mặt khi chưa có VisionID." }
    : getFaceShapeAdvice(summaryFaceShape);
  const directAdvice = isManualConsultation
    ? getManualDirectFrameAdvice(preferences)
    : getDirectFrameAdvice(latestAnalysis?.metrics || {}, summaryFaceShape);
  const publicEvidence = isManualConsultation
    ? [getPublicAdviceSourceLabel()]
    : getPublicAdviceEvidence(latestAnalysis?.metrics || {});
  const fitNotes = getFitGuidance({
    faceShape: summaryFaceShape,
    metrics: latestAnalysis?.metrics || {},
    frameWidthMm: customer.frame_width_mm,
    prescription: customer.prescription || {},
    preference: preferences.frame_preference
  });
  const topFrames = (latestRecommendations.length
    ? latestRecommendations
    : (isManualConsultation ? getManualFrameRecommendations(preferences) : getFrameRecommendations(summaryFaceShape)))
    .slice(0, 3);
  const trialPlan = buildFrameTrialPlan(directAdvice, topFrames, publicEvidence);
  const materialRecommendations = getMaterialRecommendations({
    faceShape: summaryFaceShape,
    preferences,
    prescription: customer.prescription || {},
    ageGroup: customer.age_group
  });
  const summaryHighlights = uniqueList([
    directAdvice.principle,
    ...directAdvice.fit,
    ...(isManualConsultation
      ? [`Bắt đầu bằng ${topFrames.map((frame) => getFramePresentationLabel(frame.name)).join(", ")} để so nhanh cảm giác đeo.`]
      : getSummaryHighlights(shapeAdvice, topFrames, preferences))
  ]).slice(0, 5);
  const lensLine = latestLensRecommendations[0]
    ? formatLensDisplayName(latestLensRecommendations[0])
    : "Chưa cần chốt tròng, bổ sung đơn kính nếu có.";

  consultationSummary.innerHTML = `
    <div class="summary-showcase">
      <div>
        <span>Kết luận tư vấn gọng</span>
        <div class="summary-face-visual">
          <div class="face-icon large clean">${getFrameSketchSvg(topFrames[0]?.name || directAdvice.choose[0] || "", 0)}</div>
          <div>
            <strong>${directAdvice.headline}</strong>
            <em>${isManualConsultation ? "Tư vấn thủ công, kiểm tra fit tại quầy" : (isDraft ? "Gợi ý từ VisionID, nhân viên kiểm tra fit khi thử gọng" : "Dùng trực tiếp để chọn gọng thử")}</em>
          </div>
        </div>
        <ul class="summary-highlights">
          ${summaryHighlights.map((item) => `<li>${item}</li>`).join("")}
          ${isManualConsultation ? "<li>Chưa dùng VisionID; sau khi thử gọng hãy lưu góp ý để hiệu chuẩn app.</li>" : ""}
          ${isDraft ? "<li>Không chốt theo nhãn dạng mặt; ưu tiên thử gọng thật và ghi nhận phản hồi.</li>" : ""}
        </ul>
      </div>
      <div>
        <span>Mô phỏng gọng nên chọn</span>
        <div class="summary-frame-visuals">
          ${topFrames.map((frame, index) => `
            <article>
              ${getFrameSketchSvg(frame.name, index)}
              <strong>${getFramePresentationLabel(frame.name)}</strong>
              <span>${frame.name}</span>
            </article>
          `).join("")}
        </div>
      </div>
    </div>
    <div class="trial-plan">
      <div class="trial-plan-heading">
        <span>Lộ trình thử gọng</span>
        <strong>Chọn nhanh 3 bước tại quầy</strong>
      </div>
      <div class="trial-plan-grid">
        ${trialPlan.steps.map((step, index) => `
          <article>
            <i>${index + 1}</i>
            <span>${step.label}</span>
            <strong>${step.title}</strong>
            <p>${step.note}</p>
          </article>
        `).join("")}
      </div>
      <div class="evidence-strip">
        ${trialPlan.evidence.map((item) => `<span>${item}</span>`).join("")}
      </div>
    </div>
    <div class="summary-grid">
      <div><span>Hướng gọng</span><strong>${directAdvice.choose.slice(0, 2).join(" · ")}</strong></div>
      <div><span>Tròng kính</span><strong>${lensLine}</strong></div>
      <div><span>Kiểm tra fit</span><strong>${directAdvice.fit.slice(0, 1).join(" · ")}</strong></div>
      <div><span>Trạng thái</span><strong>${statusLabel(customer.customer_status)}</strong></div>
    </div>
    <div class="aesthetic-advice visual-advice">
      <div>
        <span>Nguyên tắc</span>
        <strong>${directAdvice.summary}</strong>
      </div>
      <div>
        <span>Nên chọn</span>
        <strong>${directAdvice.choose.join(" · ")}</strong>
      </div>
      <div>
        <span>Màu gọng</span>
        <strong>${getColorGuidance(preferences.frame_preference)}</strong>
      </div>
      <div>
        <span>Căn cứ tư vấn</span>
        <strong>${getPublicAdviceSourceLabel()}</strong>
      </div>
    </div>
    <div class="material-advice">
      <div class="material-heading">
        <span>Chất liệu gọng</span>
        <strong>Nên tư vấn theo cảm giác đeo và ngân sách</strong>
      </div>
      <div class="material-grid">
        ${materialRecommendations.map((material) => `
          <article>
            <span>${material.tagline}</span>
            <strong>${material.name}</strong>
            <p>${material.fitReason}</p>
            <em>${material.strengths.slice(0, 3).join(" · ")}</em>
          </article>
        `).join("")}
      </div>
    </div>
    <div class="fit-checklist">
      ${fitNotes.map((note) => `<span>${note}</span>`).join("")}
    </div>
    <div class="summary-picks">
      ${topFrames.map((frame) => `<span>${frame.name}</span>`).join("")}
    </div>
  `;
}

function buildFeedbackRecord() {
  const confidenceState = latestAnalysis
    ? getConfidenceState(latestAnalysis)
    : { level: "low", percent: 0 };
  const diagnostics = latestAnalysis?.diagnostics || {};
  const classification = diagnostics.classification || {};
  const qualityGate = diagnostics.qualityGate || null;

  return {
    id: `FB-${Date.now()}`,
    type: feedbackTypeInput?.value || "other",
    notes: feedbackNotesInput?.value.trim() || "",
    customer_code: customerCodeInput.value || "",
    session_code: currentSessionCode || "",
    faceShape_ai: latestAiFaceShape || latestAnalysis?.faceShape_ai || latestAnalysis?.shape || "",
    faceShape_confirmed: confirmedFaceShape || latestAnalysis?.faceShape_confirmed || "",
    consultation_mode: manualConsultationMode ? "manual" : "visionid",
    confidence: latestAnalysis?.quality?.confidence ?? null,
    confidence_level: confidenceState.level || "low",
    top_candidates: Array.isArray(classification.candidates)
      ? classification.candidates.slice(0, 3)
      : [],
    capture_quality: qualityGate
      ? {
          passed: Boolean(qualityGate.passed),
          score: qualityGate.score ?? null,
          failed_labels: Array.isArray(qualityGate.failedLabels) ? qualityGate.failedLabels : [],
          checks: Array.isArray(qualityGate.checks) ? qualityGate.checks : []
        }
      : {},
    diagnostics: {
      warnings: Array.isArray(diagnostics.warnings) ? diagnostics.warnings.slice(0, 6) : [],
      confidenceComponents: diagnostics.confidenceComponents || {},
      confidenceBand: diagnostics.confidenceBand || "",
      calibrationSource: diagnostics.calibrationSource || classification.calibrationSource || "",
      centerBurst: diagnostics.centerBurst || null,
      scanMode: diagnostics.scanMode || ""
    },
    preferences: {
      ...readPreferences(),
      age_group: ageGroupInput.value || "",
      frame_width_mm: parseOptionalNumber(frameWidthMmInput.value),
      has_prescription: Boolean(hasPrescriptionInput.checked),
      prescription: readPrescriptionData()
    },
    customer_status: customerStatusInput.value || "waiting",
    source: "frontend",
    created_at: new Date().toISOString()
  };
}

async function postFeedbackRecord(feedback) {
  const response = await fetch(FEEDBACK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(feedback)
  });

  if (!response.ok) {
    throw new Error(`Feedback API failed: ${response.status}`);
  }

  return response.json();
}

async function saveFeedback() {
  const feedback = {
    ...buildFeedbackRecord(),
    sync_status: "pending"
  };

  const records = loadFeedbackRecords();
  records.unshift(feedback);
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(records.slice(0, 200)));

  if (saveFeedbackButton) {
    saveFeedbackButton.disabled = true;
    saveFeedbackButton.textContent = "Đang lưu...";
  }

  if (feedbackStatus) {
    feedbackStatus.textContent = "Đang lưu góp ý về bộ dữ liệu hiệu chuẩn...";
  }

  try {
    const savedFeedback = await postFeedbackRecord(feedback);
    const updatedRecords = loadFeedbackRecords().map((record) => (
      record.id === feedback.id
        ? { ...record, ...savedFeedback, sync_status: "synced" }
        : record
    ));
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updatedRecords.slice(0, 200)));

    if (feedbackNotesInput) {
      feedbackNotesInput.value = "";
    }

    if (feedbackStatus) {
      feedbackStatus.textContent = "Đã lưu góp ý vào bộ dữ liệu hiệu chuẩn.";
    }
  } catch (error) {
    console.error(error);
    if (feedbackStatus) {
      feedbackStatus.textContent = "Đã lưu cục bộ. Chưa gửi được lên server, vui lòng thử lại khi mạng ổn định.";
    }
  } finally {
    if (saveFeedbackButton) {
      saveFeedbackButton.disabled = false;
      saveFeedbackButton.textContent = "Lưu góp ý";
    }
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
  const adviceFaceShape = confirmedFaceShape || getDraftFaceShapeForAdvice();
  const shapeAdvice = adviceFaceShape ? getFaceShapeAdvice(adviceFaceShape) : null;
  const manualAdvice = manualConsultationMode && !adviceFaceShape
    ? getManualDirectFrameAdvice(preferences)
    : null;
  const customer = readCustomerSnapshot();
  const fitNotes = getFitGuidance({
    faceShape: adviceFaceShape,
    metrics: latestAnalysis?.metrics || {},
    frameWidthMm: customer.frame_width_mm,
    prescription: customer.prescription || {},
    preference: preferences.frame_preference
  });

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
      reason: extra.length ? `${frame.reason} Gợi ý thêm: ${extra.join(", ")}.` : frame.reason,
      avoidNote: manualAdvice?.avoid?.[0] || shapeAdvice?.avoid?.[0] || "",
      fitNote: [frame.fitNote, manualAdvice?.fit?.[0] || fitNotes[0]].filter(Boolean).join(" ")
    };
  });
}

function resetAdviceState() {
  latestAnalysis = null;
  latestAiFaceShape = "";
  confirmedFaceShape = "";
  manualConsultationMode = false;
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
  if (!latestAnalysis?.metrics && !manualConsultationMode) {
    statusText.textContent = "Cần hoàn tất VisionID hoặc chọn tư vấn thủ công trước";
    return;
  }

  customerStatusInput.value = "measured";
  syncCurrentCustomer("customerUpdated");
  saveCurrentCustomer();
  renderCustomers();
  statusText.textContent = "Đã chuyển sang trạng thái đã đo";
  showTab("tab-4");
  updateWorkflowAssistant();
}

function enableManualConsultation() {
  manualConsultationMode = true;
  statusText.textContent = "Đang tư vấn thủ công";
  faceShapeText.textContent = "Tư vấn thủ công";
  if (markMeasuredButton) {
    markMeasuredButton.disabled = false;
  }
  renderConfidenceNotice(null, { level: "medium", percent: 0 }, false, "Đã bỏ qua VisionID. Hãy thử gọng thật và lưu góp ý sau tư vấn.");
  renderCustomerResult();
  updateAdvice();
  syncCurrentCustomer("manualConsultation");
  showTab("tab-4");
}

function budgetLabel(value) {
  const labels = {
    low: "Tiết kiệm",
    medium: "Cân bằng",
    high: "Cao cấp",
    premium: "Siêu cao cấp"
  };

  return labels[value] || "Cân bằng";
}

function formatLensDisplayName(lens = {}) {
  const brand = String(lens.brand || "").trim();
  const line = String(lens.line || "").trim();
  if (!brand) {
    return line;
  }

  return line.toLowerCase().startsWith(brand.toLowerCase())
    ? line
    : `${brand} ${line}`.trim();
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
customerNameInput.addEventListener("input", () => {
  syncCurrentCustomer("customerUpdated");
  updateWorkflowAssistant();
});
customerPhoneInput.addEventListener("input", () => {
  syncCurrentCustomer("customerUpdated");
  schedulePhoneLookup();
});
customerPhoneInput.addEventListener("change", autoFillFromPhone);
consultDateInput.addEventListener("change", () => {
  syncCurrentCustomer("customerUpdated");
  updateWorkflowAssistant();
});
ageGroupInput.addEventListener("change", () => {
  syncCurrentCustomer("customerUpdated");
  renderCustomers();
  updateWorkflowAssistant();
});
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

if (manualConsultButton) {
  manualConsultButton.addEventListener("click", enableManualConsultation);
}

if (confirmedFaceShapeInput) {
  confirmedFaceShapeInput.addEventListener("change", () => {
    confirmedFaceShape = confirmedFaceShapeInput.value;
    confirmedFaceShapeSource = confirmedFaceShape ? "manual" : "";
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
    updateWorkflowAssistant();
  });
}

if (customerViewToggle) {
  customerViewToggle.addEventListener("change", () => {
    document.getElementById("tab-3")?.classList.toggle("show-debug", customerViewToggle.checked);
  });
}

if (saveFeedbackButton) {
  saveFeedbackButton.addEventListener("click", saveFeedback);
}

if (workflowNextButton) {
  workflowNextButton.addEventListener("click", () => {
    handleWorkflowNext().catch((error) => {
      console.error(error);
      statusText.textContent = "Không thể chuyển bước";
    });
  });
}

if (mobileNewButton) {
  mobileNewButton.addEventListener("click", () => {
    startNewCustomer();
    showTab("tab-0");
  });
}

if (mobileSaveButton) {
  mobileSaveButton.addEventListener("click", () => {
    saveCurrentCustomer();
    showTab("tab-1");
  });
}

if (mobileScanButton) {
  mobileScanButton.addEventListener("click", () => {
    showTab("tab-3");
    if (video?.srcObject) {
      startAutoScanFlow("mobile-action");
      return;
    }

    enableCamera().catch((error) => {
      console.error(error);
      statusText.textContent = "Không thể bật camera";
    });
  });
}

if (mobileConsultButton) {
  mobileConsultButton.addEventListener("click", () => {
    showTab("tab-4");
  });
}

startButton.addEventListener("click", async () => {
  try {
    if (video?.srcObject) {
      stopCurrentCameraStream();
      return;
    }

    await enableCamera();
  } catch (error) {
    console.error(error);
    statusText.textContent = "Không thể khởi tạo";
    updateCameraStartButton({ active: Boolean(video?.srcObject) });
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
updateCameraStartButton({ active: Boolean(video?.srcObject) });
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
