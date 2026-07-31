import { startUserCamera } from "./camera.js?v=20260729-86";
import {
  clearCanvas,
  drawCalibrationGuide,
  drawLandmarkConnectors,
  drawSafariRenderDiagnostic,
  getRenderContext,
  getRenderContextForImage,
  getRenderDiagnostics,
  resizeCanvasToVideo
} from "./drawing.js?v=20260729-85";
import { analyzeFaceShape, classifyFaceShapeFromMetrics, estimateHeadPose, getAnalysisDebugSummary, getClassificationDetail, getFaceShapeLabel } from "./face-analysis.js?v=20260729-85";
import {
  buildRecommendationDiagnostics,
  getColorGuidance,
  getFaceShapeAdvice,
  getFitGuidance,
  getFrameRecommendations,
  getMaterialRecommendations,
  getPublicAdviceEvidence,
  getPublicAdviceSourceLabel
} from "./recommendations.js?v=20260729-85";
import { analyzeLensNeeds, getLensRecommendations } from "./lens-catalog.js?v=20260729-85";
import { detectFaceLandmarksForImage, detectFaceLandmarksForVideo } from "./vision/face-tracking-adapter.js?v=20260729-85";
import { collectFrameBurst, createInitialFallbackSample, selectBurstSamples } from "./vision/frame-collector.js?v=20260729-85";
import { DISTANCE_LANDMARKS as VISION_DISTANCE_LANDMARKS } from "./vision/landmark-map.js?v=20260729-85";
import {
  DEVICE_PROFILES,
  detectDeviceProfile,
  getSessionDebugOverride,
  sanitizeDeviceContextForDebug,
  setSessionDebugOverride,
  shouldAttemptLiveCamera,
  shouldFallbackToUploadAfterCameraError,
  shouldUseUploadFallback,
  withCameraStartupStatus
} from "./vision/device-profile.js?v=20260729-85";
import { createLiveScanCoordinator } from "./vision/live-scan-coordinator.js?v=20260731-qa2";
import {
  DEFAULT_SCAN_QUALITY_CONFIG,
  buildCaptureQualityGate,
  evaluateScanFrameQuality,
  getVisionLimitations
} from "./vision/quality-gate.js?v=20260729-85";
import { buildConsentScopedVisionFeedback, isExplicitConsentGranted, purgeStoredVisionAnalysis } from "./vision/privacy-policy.js?v=20260729-85";
import {
  clearOperationDraft,
  createDebouncedDraftSaver,
  createOperationDraft,
  createOperationDraftId,
  getDraftResumeSummary,
  hasBusinessStateChanged,
  isMeaningfulOperationDraft,
  normalizeOperationDraft,
  normalizeOperationBusinessState,
  OPERATION_DRAFT_STORAGE_KEY,
  operationStepToTabId,
  readOperationDraft,
  tabIdToOperationStep,
  writeOperationDraft
} from "./operation-draft-store.js?v=20260731-qa1";
import {
  createCustomerPrefillFromQuery,
  findExactPhoneMatches,
  getDuplicateSaveDecision,
  isPhoneLikeQuery,
  rankCustomerMatches
} from "./customer-lookup.js?v=20260731-qa1";
import {
  getFirstValidationError,
  validateNeedsState,
  validateProfileSaveState,
  validateProfileState
} from "./operation-validation.js?v=20260731-qa1";
import {
  STEP_TO_TAB_ID,
  canEnterStep,
  getConsultationSource,
  getNextWorkflowAction,
  getWorkflowStepState,
  normalizeWorkflowStep
} from "./workflow-state.js?v=20260731-qa1";
import {
  buildConsultationResultPayload,
  canCompleteOperation,
  consultationSourceLabel,
  consultationSourceLimitation,
  createConsultationContext,
  getConsultationPresentation,
  getConsultationSaveState,
  getConsultationSignature,
  getConsultationSource as getDetailedConsultationSource,
  getCustomerOperationalStatus,
  getCustomerPrimaryAction,
  isConsultationResultCurrent
} from "./consultation-state.js?v=20260731-qa1";
import {
  createCustomerCode,
  createSessionCode,
  deleteCustomer,
  setCurrentCustomer,
  loadCustomers,
  loadCurrentCustomer,
  saveCustomer,
  todayInputValue
} from "./customer-store.js?v=20260731-qa1";

const video = document.getElementById("webcam");
const uploadedFaceImage = document.getElementById("uploadedFaceImage");
const canvas = document.getElementById("overlay");
const faceImageUploadInput = document.getElementById("faceImageUpload");
const cameraPanel = document.querySelector(".camera-panel");
const startButton = document.getElementById("cameraStartButton");
const imageUploadButton = document.getElementById("imageUploadButton");
const clearImageButton = document.getElementById("clearImageButton");
const compatibilityNotice = document.getElementById("compatibilityNotice");
const visionFallbackActions = document.getElementById("visionFallbackActions");
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
const lensWidthMmInput = document.getElementById("lensWidthMm");
const bridgeWidthMmInput = document.getElementById("bridgeWidthMm");
const sessionCodeValue = document.getElementById("sessionCodeValue");
const newCustomerButton = document.getElementById("newCustomerButton");
const saveCustomerButton = document.getElementById("saveCustomerButton");
const customerList = document.getElementById("customerList");
const customerSearch = document.getElementById("customerSearch");
const customerCount = document.getElementById("customerCount");
const phoneDuplicateNotice = document.getElementById("phoneDuplicateNotice");
const tabButtons = document.querySelectorAll("[data-tab-target]");
const tabPanels = document.querySelectorAll(".tab-panel");
const workflowAssistant = document.getElementById("workflowAssistant");
const workflowStepLabel = document.getElementById("workflowStepLabel");
const workflowNextLabel = document.getElementById("workflowNextLabel");
const workflowNextButton = document.getElementById("workflowNextButton");
const currentCustomerSession = document.getElementById("currentCustomerSession");
const currentCustomerNameLabel = document.getElementById("currentCustomerName");
const currentCustomerPhoneLabel = document.getElementById("currentCustomerPhone");
const currentCustomerStepLabel = document.getElementById("currentCustomerStep");
const currentCustomerSourceLabel = document.getElementById("currentCustomerSource");
const currentCustomerSaveStateLabel = document.getElementById("currentCustomerSaveState");
const switchCustomerButton = document.getElementById("switchCustomerButton");
const startNewSessionButton = document.getElementById("startNewSessionButton");
const operationDraftDialog = document.getElementById("operationDraftDialog");
const operationDraftDialogPanel = operationDraftDialog?.querySelector(".operation-dialog");
const operationDraftDialogSummary = document.getElementById("operationDraftDialogSummary");
const resumeDraftButton = document.getElementById("resumeDraftButton");
const discardDraftButton = document.getElementById("discardDraftButton");
const contextChangeDialog = document.getElementById("contextChangeDialog");
const contextChangeDialogPanel = contextChangeDialog?.querySelector(".operation-dialog");
const contextChangeDialogSummary = document.getElementById("contextChangeDialogSummary");
const keepDraftButton = document.getElementById("keepDraftButton");
const discardChangesButton = document.getElementById("discardChangesButton");
const cancelContextChangeButton = document.getElementById("cancelContextChangeButton");
const duplicateCustomerDialog = document.getElementById("duplicateCustomerDialog");
const duplicateCustomerDialogPanel = duplicateCustomerDialog?.querySelector(".operation-dialog");
const duplicateCustomerDialogSummary = document.getElementById("duplicateCustomerDialogSummary");
const duplicateCustomerDialogMatches = document.getElementById("duplicateCustomerDialogMatches");
const openExistingDuplicateButton = document.getElementById("openExistingDuplicateButton");
const reviewDuplicateButton = document.getElementById("reviewDuplicateButton");
const createSeparateDuplicateButton = document.getElementById("createSeparateDuplicateButton");
const manualConsultationDialog = document.getElementById("manualConsultationDialog");
const manualConsultationDialogPanel = manualConsultationDialog?.querySelector(".operation-dialog");
const confirmManualConsultationButton = document.getElementById("confirmManualConsultationButton");
const cancelManualConsultationButton = document.getElementById("cancelManualConsultationButton");
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
const consultationActionPanel = document.getElementById("consultationActionPanel");
const consultationSourceBadge = document.getElementById("consultationSourceBadge");
const consultationResultState = document.getElementById("consultationResultState");
const consultationSavedState = document.getElementById("consultationSavedState");
const consultationMeasuredState = document.getElementById("consultationMeasuredState");
const saveConsultationButton = document.getElementById("saveConsultationButton");
const adjustNeedsButton = document.getElementById("adjustNeedsButton");
const revisitVisionButton = document.getElementById("revisitVisionButton");
const startNextCustomerButton = document.getElementById("startNextCustomerButton");
const consultationSaveStatus = document.getElementById("consultationSaveStatus");
const feedbackTypeInput = document.getElementById("feedbackType");
const feedbackNotesInput = document.getElementById("feedbackNotes");
const saveFeedbackButton = document.getElementById("saveFeedbackButton");
const feedbackStatus = document.getElementById("feedbackStatus");

const canvasContext = canvas.getContext("2d");

let faceLandmarker;
let imageFaceLandmarker;
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
let cameraRequestInFlight = null;
let cameraSessionToken = 0;
let isAnalyzingFace = false;
const liveScanCoordinator = createLiveScanCoordinator();
let liveScanAnimationFrameId = 0;
let confirmedFaceShapeSource = "";
let manualConsultationMode = false;
let latestCameraDebug = {};
let latestRecommendationDebug = null;
let latestRenderDebug = {};
let latestDebugLandmarks = null;
let latestRenderContext = null;
let currentDeviceContext = null;
let deviceProfileOverride = "";
let deviceProfileOverrideControl = null;
let uploadedImageObjectUrl = "";
let latestImageDebug = createImageDebugState();
let activeLandmarkerMode = "none";
let landmarkerModeSwitchInFlight = false;
let renderDiagnosticOverlayUntil = 0;
let workflowNavigationInFlight = false;
let saveCustomerInFlight = false;
let manualConsultationDialogTrigger = null;
let visionExperienceState = "idle";
const renderLifecycleCounts = {
  loadedmetadata: 0,
  canplay: 0,
  resize: 0,
  orientationchange: 0,
  visualViewportResize: 0
};
let autoScanState = createAutoScanState();
let operationDraftId = createOperationDraftId();
let operationDraftCreatedAt = new Date().toISOString();
let operationCustomerId = null;
let operationDraftSource = "new";
let lastOperationBusinessBaseline = null;
let operationSaveState = "idle";
let lastDraftSavedAt = null;
let lastCustomerSavedAt = null;
let suppressOperationDraftTracking = false;
let operationCompletedContext = null;
let pendingContextChangeAction = null;
let latestResultContext = null;
let latestRecommendationContext = null;
let persistedConsultationResult = null;
let persistedConsultationContext = null;
let savedConsultationSignature = "";
let consultationSaveInFlight = false;
let consultationSaveError = "";
let modalReturnFocusElement = null;
let customerSearchTimer = 0;
let duplicatePhoneMatches = [];
let allowDuplicateCustomerSaveOnce = false;
const operationDraftSaver = createDebouncedDraftSaver({
  delayMs: 750,
  saveFn: () => flushOperationDraftSave("debounce")
});

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
  ...VISION_DISTANCE_LANDMARKS
};

const SCAN_QUALITY_CONFIG = {
  ...DEFAULT_SCAN_QUALITY_CONFIG,
  centerYawToleranceDeg: SCAN_CONFIG.CENTER_YAW_TOLERANCE_DEG,
  rollToleranceDeg: SCAN_CONFIG.ROLL_TOLERANCE_DEG,
  minFrameConfidence: SCAN_CONFIG.MIN_FRAME_CONFIDENCE,
  burstMinSamples: SCAN_CONFIG.CENTER_BURST_MIN_SAMPLES,
  burstMinConfidence: SCAN_CONFIG.CENTER_BURST_MIN_CONFIDENCE
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
const VISION_DEBUG_ENABLED = new URLSearchParams(window.location.search).get("visionDebug") === "1";
let visionDebugPanel = null;
let visionDebugCameraButton = null;
let visionDebugRenderButton = null;

function createImageDebugState() {
  return {
    analysisSource: "video",
    imageNaturalWidth: 0,
    imageNaturalHeight: 0,
    imageOrientation: "-",
    imageDecodeStatus: "-",
    imageFaceCount: "-",
    imageQualityReason: "-",
    objectUrlActive: false,
    previousObjectUrlRevoked: false,
    fallbackReason: "-"
  };
}

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
  cancelLiveScanLoop();
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
      updateVisionDebugPanel({
        faceCount,
        reasonCode: autoScanState.distance.reason,
        limitation: "distance advisory"
      });
      return;
    }

    updateScanHud();
    updateVisionDebugPanel({
      faceCount,
      reasonCode: autoScanState.distance?.reason,
      limitation: "distance gate"
    });
    return;
  }

  const condition = resolveScanCondition(step, analysis, pose, faceCount);
  const captureStep = condition.step || step;
  autoScanState.prompt = step.label;
  autoScanState.detail = condition.detail;
  autoScanState.status = condition.status;
  updateVisionDebugPanel({
    faceCount,
    reasonCode: condition.reasonCode,
    confidence: analysis?.quality?.confidence,
    limitation: Array.isArray(analysis?.diagnostics?.limitations)
      ? analysis.diagnostics.limitations.join(" | ")
      : ""
  });

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
  const result = evaluateScanFrameQuality({
    step,
    analysis,
    pose,
    faceCount,
    config: SCAN_QUALITY_CONFIG
  });

  if (result.reasonCode === "BAD_YAW" && !result.ready && !result.near && pose) {
    return {
      ...result,
      detail: getYawGuidance(step, pose.yawDeg)
    };
  }

  return result;
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
    totalSamples: samples.captureStats?.attemptedFrames ?? samples.length,
    usableSamples: stableCapture.sampleCount,
    fallbackUsed: stableCapture.fallbackUsed,
    confidence: Math.round((stableCapture.analysis.quality?.confidence || 0) * 100)
  });
  updateVisionDebugPanel({
    analysis: stableCapture.analysis,
    scanId: autoScanState.token,
    attemptedFrames: samples.captureStats?.attemptedFrames ?? samples.length,
    acceptedFrames: stableCapture.sampleCount,
    rejectedFrames: samples.captureStats?.rejectedFrames ?? Math.max(0, samples.length - stableCapture.sampleCount),
    usableSamples: stableCapture.sampleCount,
    fallbackUsed: stableCapture.fallbackUsed,
    rejectionReasons: samples.captureStats?.rejectionReasons || {},
    confidence: stableCapture.analysis.quality?.confidence,
    reasonCode: stableCapture.analysis.diagnostics?.qualityGate?.reasonCodes?.join(", ")
      || Object.keys(samples.captureStats?.rejectionReasons || {}).join(", ")
      || "OK"
  });

  captureScanStep(step, stableCapture.analysis, stableCapture.pose, {
    ...options,
    fromCenterBurst: true,
    burst: {
      sampleCount: stableCapture.sampleCount,
      totalSamples: samples.captureStats?.attemptedFrames ?? samples.length,
      fallbackUsed: stableCapture.fallbackUsed,
      rejectedFrames: samples.captureStats?.rejectedFrames ?? Math.max(0, samples.length - stableCapture.sampleCount),
      rejectionReasons: samples.captureStats?.rejectionReasons || {}
    }
  });
}

async function captureCenterBurstSamples(targetFrames, durationMs) {
  return collectFrameBurst({
    targetFrames,
    durationMs,
    detectFrame: () => detectFaceLandmarksForVideo(faceLandmarker, video, performance.now()),
    analyzeLandmarks: (landmarks) => analyzeFaceShape(landmarks, getVideoFrameSize()),
    estimatePose: (landmarks) => estimateHeadPose(landmarks),
    delayFn: delay
  });
}

function buildCenterBurstCapture(samples, step, initialAnalysis, initialPose) {
  const {
    usableSamples,
    selectedSamples,
    fallbackUsed
  } = selectBurstSamples({
    samples,
    minSamples: SCAN_CONFIG.CENTER_BURST_MIN_SAMPLES,
    config: SCAN_QUALITY_CONFIG
  });

  const initialFallbackSample = createInitialFallbackSample({
    analysis: initialAnalysis,
    pose: initialPose,
    config: SCAN_QUALITY_CONFIG
  });

  if (!selectedSamples.length && initialFallbackSample) {
    return {
      analysis: cloneAnalysis(initialFallbackSample.analysis),
      pose: { ...(initialFallbackSample.pose || emptyPose()) },
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
    fallbackUsed,
    config: SCAN_QUALITY_CONFIG,
    formatPercent,
    getDistanceLabel
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
      totalSamples: samples.captureStats?.attemptedFrames ?? samples.length,
      fallbackUsed,
      rejectedFrames: samples.captureStats?.rejectedFrames ?? Math.max(0, samples.length - selectedSamples.length),
      rejectionReasons: samples.captureStats?.rejectionReasons || {},
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
  attachRuntimeDebugSummary(analysis, buildAggregateDebugSummary({
    selectedSamples,
    metrics,
    classification,
    quality,
    samples
  }));

  return {
    analysis,
    pose,
    sampleCount: selectedSamples.length,
    fallbackUsed
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
  stampCurrentResultContext();
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
  syncMarkMeasuredButtonState();
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
    limitations: getVisionLimitations({ hasPhysicalCalibration: false }),
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
  const cloned = {
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
  const debugSummary = getAnalysisDebugSummary(analysis);
  if (debugSummary) {
    attachRuntimeDebugSummary(cloned, { ...debugSummary });
  }

  return cloned;
}

function attachRuntimeDebugSummary(analysis, debugSummary) {
  if (!analysis || !debugSummary) {
    return analysis;
  }

  Object.defineProperty(analysis, "__visionDebug", {
    value: debugSummary,
    enumerable: false,
    configurable: true
  });

  return analysis;
}

function buildAggregateDebugSummary({ selectedSamples = [], metrics = {}, classification = {}, quality = {}, samples = [] } = {}) {
  const summaries = selectedSamples
    .map((sample) => getAnalysisDebugSummary(sample.analysis))
    .filter(Boolean);
  const representative = summaries.at(-1) || {};
  const scoreMap = Object.fromEntries(
    (classification.candidates || []).map((candidate) => [candidate.name, candidate.score])
  );

  return {
    ...representative,
    scanId: autoScanState.token,
    inputWidth: medianDebugValue(summaries, "inputWidth") ?? representative.inputWidth ?? 0,
    inputHeight: medianDebugValue(summaries, "inputHeight") ?? representative.inputHeight ?? 0,
    inputAspectRatio: medianDebugValue(summaries, "inputAspectRatio") ?? representative.inputAspectRatio ?? 1,
    rawFaceHeight: medianDebugValue(summaries, "rawFaceHeight"),
    rawFaceWidth: medianDebugValue(summaries, "rawFaceWidth"),
    rawLengthWidthRatio: medianDebugValue(summaries, "rawLengthWidthRatio"),
    aspectCorrectionFactor: medianDebugValue(summaries, "aspectCorrectionFactor") ?? representative.aspectCorrectionFactor ?? 1,
    correctedFaceHeight: medianDebugValue(summaries, "correctedFaceHeight"),
    correctedFaceWidth: medianDebugValue(summaries, "correctedFaceWidth"),
    correctedLengthWidthRatio: metrics.lengthToWidth ?? representative.correctedLengthWidthRatio ?? null,
    foreheadWidthRatio: metrics.foreheadToCheek ?? representative.foreheadWidthRatio ?? null,
    jawWidthRatio: metrics.jawToCheek ?? representative.jawWidthRatio ?? null,
    cheekWidthRatio: metrics.cheekToJaw ?? representative.cheekWidthRatio ?? null,
    scores: scoreMap,
    winningLabel: classification.bestShape || classification.shape || "unknown",
    secondLabel: classification.secondShape || "unknown",
    scoreMargin: classification.margin ?? 0,
    invalidMetricReason: classification.invalidMetricReason || "",
    analysisInstanceId: `scan-${autoScanState.token}-aggregate`,
    attemptedFrames: samples.captureStats?.attemptedFrames ?? selectedSamples.length,
    acceptedFrames: selectedSamples.length,
    confidence: quality.confidence ?? null
  };
}

function medianDebugValue(summaries, key) {
  const values = summaries
    .map((summary) => Number(summary?.[key]))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!values.length) {
    return null;
  }

  const middle = Math.floor(values.length / 2);
  return values.length % 2
    ? values[middle]
    : (values[middle - 1] + values[middle]) / 2;
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

function getCurrentConsultationContext() {
  return createConsultationContext({
    customerId: operationCustomerId || customerCodeInput.value || "",
    draftId: operationDraftId,
    sessionCode: ensureCurrentSessionCode()
  });
}

function stampCurrentResultContext() {
  latestResultContext = getCurrentConsultationContext();
  latestRecommendationContext = latestResultContext;
  consultationSaveError = "";
  if (consultationSaveStateIsSaved()) {
    savedConsultationSignature = "";
  }
}

function consultationSaveStateIsSaved() {
  const state = getCurrentConsultationSaveState();
  return state.state === "saved" || state.state === "measured";
}

function resetVolatileConsultationState({ keepPersisted = false } = {}) {
  latestAnalysis = null;
  latestAiFaceShape = "";
  confirmedFaceShape = "";
  confirmedFaceShapeSource = "";
  manualConsultationMode = false;
  latestRecommendations = [];
  latestLensRecommendations = [];
  latestResultContext = null;
  latestRecommendationContext = null;
  consultationSaveError = "";
  if (!keepPersisted) {
    persistedConsultationResult = null;
    persistedConsultationContext = null;
    savedConsultationSignature = "";
  }
}

function getCurrentDetailedConsultationSource() {
  const currentContext = getCurrentConsultationContext();
  const hasCurrentLiveResult = isConsultationResultCurrent({
    resultContext: latestResultContext,
    currentContext
  });
  const hasCurrentPersistedResult = persistedConsultationResult && isConsultationResultCurrent({
    resultContext: persistedConsultationContext,
    currentContext,
    allowMissingDraft: true
  });

  if (hasCurrentPersistedResult && (!latestAnalysis || !hasCurrentLiveResult)) {
    const source = persistedConsultationResult.consultationSource || "none";
    return {
      source,
      valid: source !== "none",
      label: consultationSourceLabel(source),
      limitation: consultationSourceLimitation(source)
    };
  }

  return getDetailedConsultationSource({
    manualConsultationMode,
    manualConfirmed: manualConsultationMode,
    confirmedFaceShape,
    analysis: latestAnalysis,
    resultContext: latestResultContext,
    currentContext,
    imageAnalysisState: latestImageDebug.imageDecodeStatus === "analyzed" ? "analysis_complete" : ""
  });
}

function getCurrentConsultationPayload(savedAt = new Date().toISOString()) {
  return buildConsultationResultPayload({
    source: getCurrentDetailedConsultationSource(),
    confirmedFaceShape,
    recommendations: latestRecommendations,
    lensRecommendations: latestLensRecommendations,
    needsSnapshot: readPreferences(),
    prescriptionSnapshot: readPrescriptionData(),
    savedAt
  });
}

function getCurrentConsultationSignature() {
  return getConsultationSignature(getCurrentConsultationPayload(persistedConsultationResult?.savedAt || "pending"));
}

function getCurrentConsultationSaveState() {
  return getConsultationSaveState({
    source: getCurrentDetailedConsultationSource(),
    currentSignature: getCurrentConsultationSignature(),
    savedSignature: savedConsultationSignature,
    saving: consultationSaveInFlight,
    error: consultationSaveError,
    measured: customerStatusInput?.value === "measured"
  });
}

function getConsultationStatusText() {
  const source = getCurrentDetailedConsultationSource();
  const saveState = getCurrentConsultationSaveState();
  return {
    sourceLabel: source.label,
    resultLabel: source.valid ? "Co ket qua tu van" : "Chua co ket qua",
    saveLabel: saveState.label,
    measuredLabel: customerStatusInput?.value === "measured" ? "Da do" : "Chua danh dau da do",
    limitation: source.limitation
  };
}

function findCurrentCustomerRecord() {
  const customerId = operationCustomerId || customerCodeInput.value;
  if (!customerId) {
    return null;
  }
  return loadCustomers().find((item) => item.customer_code === customerId) || null;
}

function completeCurrentOperationDraft(savedAt) {
  const completedDraft = buildOperationDraftFromForm({ completedAt: savedAt });
  const completed = writeCompletedOperationDraft(completedDraft);
  if (completed.ok) {
    setCompletedOperationContext(completedDraft, savedAt);
    operationDraftSaver.cancel();
    clearOperationDraft();
  }
  return completed;
}

function setCompletedOperationContext(draft, completedAt) {
  operationCompletedContext = {
    draftId: draft.draftId,
    sessionCode: draft.sessionCode,
    customerId: draft.customerId,
    completedAt
  };
}

function isCurrentCompletedOperationContext() {
  if (!operationCompletedContext) {
    return false;
  }
  return operationCompletedContext.draftId === operationDraftId
    && operationCompletedContext.sessionCode === ensureCurrentSessionCode()
    && (operationCompletedContext.customerId || null) === (operationCustomerId || null);
}

function startNewDraftAfterCompletedOperation() {
  operationCompletedContext = null;
  operationDraftId = createOperationDraftId();
  operationDraftCreatedAt = new Date().toISOString();
}

function writeCompletedOperationDraft(draft) {
  try {
    localStorage.setItem(OPERATION_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return { ok: true, draft };
  } catch (error) {
    return { ok: false, reason: "STORAGE_ERROR", error };
  }
}

async function initialize() {
  statusText.textContent = "Đang tải mô hình";
  landmarkerModeSwitchInFlight = true;
  const landmarkerModule = await import("./face-landmarker.js?v=20260729-85");
  try {
    faceLandmarker = await landmarkerModule.createFaceLandmarker();
    drawingUtils = landmarkerModule.createDrawingUtils(canvasContext);
    FaceLandmarkerApi = landmarkerModule.FaceLandmarker;
    activeLandmarkerMode = "VIDEO";
    maybeStartLiveScan("model-ready");
    statusText.textContent = "Sẵn sàng";
  } finally {
    landmarkerModeSwitchInFlight = false;
    refreshLiveScanReadiness();
    maybeStartLiveScan("model-ready");
  }
}

async function initializeImageLandmarker() {
  if (imageFaceLandmarker) {
    activeLandmarkerMode = "IMAGE";
    return imageFaceLandmarker;
  }

  statusText.textContent = "Đang tải mô hình ảnh";
  landmarkerModeSwitchInFlight = true;
  const landmarkerModule = await import("./face-landmarker.js?v=20260729-85");
  try {
    imageFaceLandmarker = await landmarkerModule.createFaceLandmarker({ runningMode: "IMAGE" });
    FaceLandmarkerApi = landmarkerModule.FaceLandmarker;
    activeLandmarkerMode = "IMAGE";
    statusText.textContent = "Sẵn sàng tải ảnh";
    return imageFaceLandmarker;
  } finally {
    landmarkerModeSwitchInFlight = false;
  }
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

function refreshDeviceProfile(extra = {}) {
  deviceProfileOverride = getSessionDebugOverride({
    debugEnabled: VISION_DEBUG_ENABLED
  });
  currentDeviceContext = detectDeviceProfile({
    debugEnabled: VISION_DEBUG_ENABLED,
    override: deviceProfileOverride,
    videoElement: video,
    stream: currentCameraStream,
    ...extra
  });
  renderDeviceProfileUi();
  updateVisionDebugPanel({
    deviceContext: sanitizeDeviceContextForDebug(currentDeviceContext)
  });
  return currentDeviceContext;
}

function renderDeviceProfileUi() {
  if (!currentDeviceContext) {
    return;
  }

  const uploadOnly = shouldUseUploadFallback(currentDeviceContext);
  if (compatibilityNotice) {
    compatibilityNotice.hidden = !uploadOnly;
    compatibilityNotice.textContent = currentDeviceContext.deviceProfile === DEVICE_PROFILES.IOS_SAFARI_LIMITED
      ? "Thiết bị này đang dùng chế độ tương thích. Vui lòng chụp hoặc chọn một ảnh chính diện, đủ sáng và không đeo kính."
      : "Đang dùng chế độ tương thích bằng ảnh tĩnh. Vui lòng tải ảnh chính diện để VisionID phân tích.";
  }

  if (startButton) {
    startButton.hidden = uploadOnly;
    startButton.disabled = uploadOnly;
  }

  if (cameraModeButton) {
    cameraModeButton.disabled = uploadOnly;
  }

  if (cameraModeHint) {
    if (uploadOnly) {
      cameraModeHint.textContent = "Chế độ tương thích dùng ảnh tĩnh, không tự mở live camera.";
    } else {
      updateCameraModeButton();
    }
  }

  if (imageUploadButton) {
    imageUploadButton.hidden = false;
    imageUploadButton.textContent = uploadOnly ? "Chụp hoặc chọn ảnh" : "Tải ảnh";
  }

  if (clearImageButton) {
    clearImageButton.hidden = !latestImageDebug.objectUrlActive;
  }

  if (cameraGuidance && uploadOnly && !latestAnalysis) {
    cameraGuidance.textContent = "Chọn hoặc chụp một ảnh chính diện, đủ sáng để tiếp tục.";
  }
}

function ensureDeviceProfileDebugOverride() {
  if (!VISION_DEBUG_ENABLED || deviceProfileOverrideControl) {
    return;
  }

  const container = document.createElement("label");
  container.className = "debug-device-profile";
  container.innerHTML = `
    <span>Device profile override</span>
    <select aria-label="VisionID device profile override">
      <option value="">Auto</option>
      <option value="${DEVICE_PROFILES.DESKTOP_CHROMIUM}">Desktop Chromium</option>
      <option value="${DEVICE_PROFILES.ANDROID_CHROMIUM}">Android Chromium</option>
      <option value="${DEVICE_PROFILES.IOS_SAFARI_LIMITED}">iOS Safari limited</option>
      <option value="${DEVICE_PROFILES.UPLOAD_ONLY}">Upload-only</option>
    </select>
  `;
  const select = container.querySelector("select");
  select.value = getSessionDebugOverride({ debugEnabled: VISION_DEBUG_ENABLED });
  select.addEventListener("change", () => {
    setSessionDebugOverride(select.value, { debugEnabled: VISION_DEBUG_ENABLED });
    refreshDeviceProfile();
    statusText.textContent = select.value ? "Đang override device profile trong phiên debug" : "Device profile: Auto";
  });
  compatibilityNotice?.after(container);
  deviceProfileOverrideControl = select;
}

function openImageUploadFallback(reason = "manual-upload") {
  refreshDeviceProfile({
    override: VISION_DEBUG_ENABLED ? deviceProfileOverride : null
  });
  currentDeviceContext = withCameraStartupStatus(currentDeviceContext, "upload_prompt", {
    compatibilityFallbackUsed: true
  });
  updateVisionDebugPanel({
    deviceContext: sanitizeDeviceContextForDebug(currentDeviceContext),
    pageLifecycleEvent: reason
  });
  renderDeviceProfileUi();
  faceImageUploadInput?.click();
}

async function enableCamera() {
  if (cameraRequestInFlight) {
    return cameraRequestInFlight;
  }

  const profileContext = refreshDeviceProfile();
  if (shouldUseUploadFallback(profileContext)) {
    setVisionExperienceState("camera_unavailable", { message: "Thiết bị này dùng chế độ tải ảnh để tiếp tục." });
    openImageUploadFallback("profile-upload-fallback");
    return Promise.resolve();
  }

  setVisionExperienceState("requesting_permission");
  cameraRequestInFlight = openCameraFlow().finally(() => {
    cameraRequestInFlight = null;
  });
  return cameraRequestInFlight;
}

async function openCameraFlow() {
  const profileContext = refreshDeviceProfile();
  if (!shouldAttemptLiveCamera(profileContext) || shouldUseUploadFallback(profileContext)) {
    openImageUploadFallback("camera-blocked-by-profile");
    return;
  }

  updateCameraStartButton({ loading: true });
  setVisionExperienceState("starting_camera");
  const sessionToken = ++cameraSessionToken;
  liveScanCoordinator.reset();
  liveScanCoordinator.setCameraRequested(true);
  updateCameraDebug({
    permissionRequestPhase: "before-request",
    requestedFacingMode: currentCameraMode,
    scanId: sessionToken
  });

  try {
    statusText.textContent = "Đang mở camera";
    stopCurrentCameraStream({ silent: true });
    clearUploadedImagePreview({ revoke: true, clearOverlay: true, reason: "open-live-camera" });
    if (video) {
      video.hidden = false;
    }
    currentCameraStream = await startUserCamera(video, { facingMode: currentCameraMode });
    currentDeviceContext = withCameraStartupStatus(refreshDeviceProfile({ stream: currentCameraStream }), "camera_opened", {
      compatibilityFallbackUsed: false,
      videoWidth: video?.videoWidth || 0,
      videoHeight: video?.videoHeight || 0,
      trackWidth: currentCameraStream?.getVideoTracks?.()[0]?.getSettings?.().width || 0,
      trackHeight: currentCameraStream?.getVideoTracks?.()[0]?.getSettings?.().height || 0,
      facingMode: currentCameraStream?.getVideoTracks?.()[0]?.getSettings?.().facingMode || currentCameraMode
    });
    updateCameraDebug({
      permissionRequestPhase: "camera-opened",
      requestedConstraints: currentCameraStream?.visionCameraDiagnostics?.requestedConstraints || null,
      fallbackConstraintsUsed: Boolean(currentCameraStream?.visionCameraDiagnostics?.fallbackConstraintsUsed)
    });

    latestRenderContext = resizeCanvasToVideo(canvas, video, "camera-start");
    cameraPanel?.classList.add("camera-active");
    statusText.textContent = "Đang nhận diện";
    if (analyzeFaceButton) {
      analyzeFaceButton.disabled = false;
    }
    updateCameraStartButton({ active: true });
    setVisionExperienceState("camera_ready");
    maybeStartLiveScan("camera-ready");

    if (!faceLandmarker) {
      initialize().catch((error) => {
        console.error(error);
        cancelLiveScanLoop();
        setVisionExperienceState("analysis_error", { message: "Không thể tải bộ phân tích khuôn mặt." });
        statusText.textContent = "Không thể tải bộ phân tích";
        updateVisionDebugPanel({
          reasonCode: error?.code || error?.name || "MODEL_LOAD_ERROR",
          mediaPipeError: error?.message || "model load failed"
        });
      });
    } else {
      activeLandmarkerMode = "VIDEO";
      maybeStartLiveScan("camera-ready-model-cached");
    }
  } catch (error) {
    handleCameraOpenError(error);
    const latestProfile = refreshDeviceProfile();
    if (shouldFallbackToUploadAfterCameraError(latestProfile)) {
      openImageUploadFallback("camera-error-upload-fallback");
    }
    throw error;
  }
}

function handleCameraOpenError(error) {
  console.error(error);
  updateCameraDebug({
    permissionRequestPhase: "failed",
    cameraErrorName: error?.name || "",
    cameraErrorCode: error?.code || "",
    cameraErrorMessage: error?.message || "",
    cameraErrorConstraint: error?.constraint || "",
    requestedConstraints: error?.diagnostics?.requestedConstraints || null,
    fallbackConstraintsUsed: Boolean(error?.diagnostics?.fallbackConstraintsUsed),
    playPromiseError: error?.diagnostics?.playPromiseError || ""
  });
  stopCurrentCameraStream({ silent: true });
  updateCameraStartButton({ active: false });
  if (analyzeFaceButton) {
    analyzeFaceButton.disabled = true;
  }
  statusText.textContent = getCameraErrorMessage(error);
  if (cameraGuidance) {
    cameraGuidance.textContent = getCameraErrorGuidance(error);
  }
  setVisionExperienceState(
    error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError"
      ? "permission_denied"
      : "camera_unavailable",
    { message: getCameraErrorMessage(error) }
  );
  updateVisionDebugPanel({
    reasonCode: error?.code || error?.name || "CAMERA_OPEN_ERROR",
    mediaPipeError: error?.message || "camera open failed",
    cameraErrorName: error?.name || "",
    cameraErrorCode: error?.code || "",
    cameraErrorMessage: error?.message || ""
  });
}

function updateCameraDebug(details = {}) {
  latestCameraDebug = {
    ...latestCameraDebug,
    ...details,
    userAgent: navigator.userAgent || "",
    platform: navigator.platform || "",
    isSecureContext: Boolean(window.isSecureContext),
    documentVisibilityState: document.visibilityState || "",
    documentHasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : null,
    hasMediaDevices: Boolean(navigator.mediaDevices),
    hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    activeStreamCount: currentCameraStream?.getTracks?.().filter((track) => track.readyState === "live").length || 0,
    currentTrackReadyState: currentCameraStream?.getVideoTracks?.()[0]?.readyState || "",
    currentTrackMuted: currentCameraStream?.getVideoTracks?.()[0]?.muted ?? null,
    currentTrackEnabled: currentCameraStream?.getVideoTracks?.()[0]?.enabled ?? null,
    videoReadyState: video?.readyState ?? null,
    videoWidth: video?.videoWidth || 0,
    videoHeight: video?.videoHeight || 0,
    videoPaused: video?.paused ?? null,
    videoEnded: video?.ended ?? null
  };
  updateVisionDebugPanel({ cameraDebug: latestCameraDebug });
}

function hasActiveLiveCameraStream() {
  const stream = currentCameraStream || video?.srcObject;
  const tracks = stream?.getVideoTracks?.() || [];
  return tracks.some((track) => track.readyState === "live" && track.enabled !== false);
}

function isVideoReadyForLiveScan() {
  return Boolean(video?.srcObject)
    && video.readyState >= 2
    && Number(video.videoWidth) > 0
    && Number(video.videoHeight) > 0
    && video.paused !== true
    && video.ended !== true;
}

function isVideoLandmarkerReady() {
  return Boolean(faceLandmarker) && activeLandmarkerMode === "VIDEO" && !landmarkerModeSwitchInFlight;
}

function refreshLiveScanReadiness() {
  liveScanCoordinator.updateReadiness({
    streamActive: hasActiveLiveCameraStream(),
    videoReady: isVideoReadyForLiveScan(),
    modelReady: isVideoLandmarkerReady()
  });
  const state = liveScanCoordinator.getState();
  updateCameraDebug({
    scanLoopRunning: state.loopRunning,
    activeScanSessionId: state.activeSessionId || "",
    modelReady: state.modelReady,
    visionExperienceState
  });
  return state;
}

function queueLiveScanFrame(sessionToken) {
  if (liveScanAnimationFrameId) {
    return;
  }
  liveScanAnimationFrameId = requestAnimationFrame(() => {
    liveScanAnimationFrameId = 0;
    detectFrame(sessionToken);
  });
}

function cancelLiveScanLoop() {
  if (liveScanAnimationFrameId) {
    cancelAnimationFrame(liveScanAnimationFrameId);
    liveScanAnimationFrameId = 0;
  }
  liveScanCoordinator.stop();
  updateCameraDebug({
    scanLoopRunning: false,
    activeScanSessionId: "",
    visionExperienceState
  });
}

function maybeStartLiveScan(reason = "readiness") {
  const readiness = refreshLiveScanReadiness();

  if (!readiness.cameraRequested) {
    return false;
  }

  if (!readiness.streamActive || !readiness.videoReady) {
    setVisionExperienceState("starting_camera", { message: "Camera chưa sẵn sàng." });
    statusText.textContent = "Đang chuẩn bị camera";
    if (scanPromptLabel) {
      scanPromptLabel.textContent = "Đang chuẩn bị camera";
    }
    if (scanSubLabel) {
      scanSubLabel.textContent = "Chờ video sẵn sàng trước khi quét.";
    }
    return false;
  }

  if (!readiness.modelReady) {
    setVisionExperienceState("camera_ready", { message: "Đang tải bộ phân tích khuôn mặt." });
    statusText.textContent = "Đang tải bộ phân tích";
    if (scanHud) {
      scanHud.classList.remove("is-idle");
    }
    if (scanStepLabel) {
      scanStepLabel.textContent = "VisionID";
    }
    if (scanPromptLabel) {
      scanPromptLabel.textContent = "Giữ khuôn mặt chính diện trong khung.";
    }
    if (scanSubLabel) {
      scanSubLabel.textContent = "Camera đã sẵn sàng, đang tải bộ phân tích.";
    }
    updateWorkflowAssistant();
    return false;
  }

  if (!liveScanCoordinator.start(cameraSessionToken)) {
    return false;
  }

  setVisionExperienceState("scanning");
  statusText.textContent = "Đang kiểm tra độ ổn định khuôn mặt";
  startAutoScanFlow(reason);
  queueLiveScanFrame(cameraSessionToken);
  updateCameraDebug({
    scanLoopRunning: true,
    activeScanSessionId: cameraSessionToken,
    visionExperienceState: "scanning"
  });
  return true;
}

function getCameraErrorMessage(error) {
  const code = error?.code || error?.name || "";
  if (code === "NotAllowedError" || code === "PermissionDeniedError") {
    return "Chưa được cấp quyền camera";
  }
  if (code === "NotFoundError" || code === "DevicesNotFoundError") {
    return "Không tìm thấy camera";
  }
  if (code === "NotReadableError" || code === "TrackStartError") {
    return "Camera đang bị ứng dụng khác sử dụng";
  }
  if (code === "CAMERA_OPEN_TIMEOUT" || code === "CAMERA_READY_TIMEOUT") {
    return "Camera mở quá lâu";
  }
  return "Không thể bật camera";
}

function getCameraErrorGuidance(error) {
  const code = error?.code || error?.name || "";
  if (code === "NotAllowedError" || code === "PermissionDeniedError") {
    return "Vào cài đặt trang web và cho phép quyền Camera, sau đó tải lại trang.";
  }
  if (code === "NotFoundError" || code === "DevicesNotFoundError") {
    return "Kiểm tra thiết bị có camera hoặc thử đổi sang camera khác.";
  }
  if (code === "NotReadableError" || code === "TrackStartError") {
    return "Đóng ứng dụng đang dùng camera như Zalo, Meet hoặc Camera rồi thử lại.";
  }
  if (code === "CAMERA_OPEN_TIMEOUT" || code === "CAMERA_READY_TIMEOUT") {
    return "Tải lại trang, mở bằng Chrome/Safari thật và cấp quyền camera khi được hỏi.";
  }
  return "Mở bằng Chrome/Safari, kiểm tra quyền Camera và thử lại.";
}

function stopCurrentCameraStream(options = {}) {
  const stream = currentCameraStream || video?.srcObject;
  if (!stream) {
    cancelLiveScanLoop();
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
  cancelLiveScanLoop();
  stopAutoScanFlow();
  if (analyzeFaceButton) {
    analyzeFaceButton.disabled = true;
  }
  if (!options.silent) {
    updateCameraStartButton({ active: false });
  }
}

function clearUploadedImagePreview({ revoke = true, clearOverlay = false, reason = "clear-image" } = {}) {
  const hadObjectUrl = Boolean(uploadedImageObjectUrl);
  let revoked = false;
  if (revoke && uploadedImageObjectUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(uploadedImageObjectUrl);
    revoked = true;
  }
  uploadedImageObjectUrl = "";
  if (uploadedFaceImage) {
    uploadedFaceImage.hidden = true;
    uploadedFaceImage.removeAttribute("src");
  }
  if (faceImageUploadInput) {
    faceImageUploadInput.value = "";
  }
  if (clearImageButton) {
    clearImageButton.hidden = true;
  }
  if (clearOverlay) {
    clearCanvas(canvas);
  }
  latestImageDebug = {
    ...createImageDebugState(),
    imageDecodeStatus: hadObjectUrl ? "cleared" : "-",
    previousObjectUrlRevoked: revoked || latestImageDebug.previousObjectUrlRevoked,
    fallbackReason: reason
  };
  updateVisionDebugPanel({
    imageDebug: latestImageDebug,
    pageLifecycleEvent: reason
  });
}

function resizeCanvasToImage(canvasElement, imageElement, reason = "image-sync") {
  const context = canvasElement?.getContext?.("2d");
  if (!canvasElement || !imageElement || !context) {
    return null;
  }

  const rect = imageElement.getBoundingClientRect?.() || {};
  const dpr = Number(window.devicePixelRatio || 1);
  const cssWidth = Math.max(1, Math.round(rect.width || imageElement.clientWidth || imageElement.naturalWidth || 0));
  const cssHeight = Math.max(1, Math.round(rect.height || imageElement.clientHeight || imageElement.naturalHeight || 0));
  canvasElement.width = Math.max(1, Math.round(cssWidth * dpr));
  canvasElement.height = Math.max(1, Math.round(cssHeight * dpr));
  canvasElement.style.width = `${cssWidth}px`;
  canvasElement.style.height = `${cssHeight}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  latestRenderDebug = {
    ...latestRenderDebug,
    lastCanvasResizeReason: reason
  };
  return getRenderContextForImage(canvasElement, imageElement);
}

async function analyzeUploadedFaceImage(file) {
  if (!file || !file.type?.startsWith("image/")) {
    statusText.textContent = "Vui lòng chọn một ảnh khuôn mặt hợp lệ";
    setVisionExperienceState("analysis_error", { message: "\u1ea2nh t\u1ea3i l\u00ean ch\u01b0a h\u1ee3p l\u1ec7." });
    return;
  }

  setAnalyzingState(true);
  stopCurrentCameraStream({ silent: true });
  currentDeviceContext = withCameraStartupStatus(refreshDeviceProfile(), "image_upload_selected", {
    compatibilityFallbackUsed: true
  });
  updateVisionDebugPanel({
    deviceContext: sanitizeDeviceContextForDebug(currentDeviceContext),
    pageLifecycleEvent: "image-upload-selected"
  });

  const hadPreviousObjectUrl = Boolean(uploadedImageObjectUrl);
  clearUploadedImagePreview({ revoke: true, clearOverlay: true, reason: "replace-upload-image" });
  uploadedImageObjectUrl = URL.createObjectURL(file);
  latestImageDebug = {
    ...createImageDebugState(),
    analysisSource: "image",
    imageDecodeStatus: "loading",
    objectUrlActive: true,
    previousObjectUrlRevoked: hadPreviousObjectUrl,
    fallbackReason: currentDeviceContext?.cameraStartupStatus || "image_upload_selected"
  };

  try {
    statusText.textContent = "Đang đọc ảnh";
    await loadImageIntoStage(uploadedImageObjectUrl);
    await initializeImageLandmarker();
    const results = detectFaceLandmarksForImage(imageFaceLandmarker, uploadedFaceImage, performance.now());
    renderStaticImageResults(results);
  } catch (error) {
    console.error(error);
    statusText.textContent = "Không thể phân tích ảnh";
    renderConfidenceNotice(null, { level: "low", percent: 0 }, false, "Không đọc được ảnh. Vui lòng chọn ảnh chính diện, đủ sáng.");
    latestImageDebug = {
      ...latestImageDebug,
      imageDecodeStatus: "error",
      imageQualityReason: error?.code || error?.name || "IMAGE_UPLOAD_ERROR"
    };
    latestAnalysis = null;
    latestAiFaceShape = "";
    clearConfirmedFaceShape();
    latestResultContext = null;
    latestRecommendationContext = null;
    consultationSaveError = "";
    setVisionExperienceState("analysis_error", { message: "Kh\u00f4ng th\u1ec3 ph\u00e2n t\u00edch \u1ea3nh. H\u00e3y ch\u1ecdn \u1ea3nh kh\u00e1c ho\u1eb7c t\u01b0 v\u1ea5n th\u1ee7 c\u00f4ng." });
    updateVisionDebugPanel({
      imageDebug: latestImageDebug,
      reasonCode: error?.code || error?.name || "IMAGE_UPLOAD_ERROR",
      mediaPipeError: error?.message || "image upload failed"
    });
  } finally {
    setAnalyzingState(false);
  }
}

function loadImageIntoStage(objectUrl) {
  return new Promise((resolve, reject) => {
    if (!uploadedFaceImage) {
      reject(new Error("Image stage is not available"));
      return;
    }

    uploadedFaceImage.onload = () => {
      uploadedFaceImage.hidden = false;
      if (video) {
        video.hidden = true;
      }
      cameraPanel?.classList.add("camera-active");
      latestRenderContext = resizeCanvasToImage(canvas, uploadedFaceImage, "image-upload");
      latestImageDebug = {
        ...latestImageDebug,
        imageNaturalWidth: uploadedFaceImage.naturalWidth || 0,
        imageNaturalHeight: uploadedFaceImage.naturalHeight || 0,
        imageOrientation: (uploadedFaceImage.naturalWidth || 0) >= (uploadedFaceImage.naturalHeight || 0) ? "landscape" : "portrait",
        imageDecodeStatus: "loaded",
        objectUrlActive: Boolean(uploadedImageObjectUrl)
      };
      if (clearImageButton) {
        clearImageButton.hidden = false;
      }
      updateVisionDebugPanel({ imageDebug: latestImageDebug });
      resolve();
    };
    uploadedFaceImage.onerror = () => {
      latestImageDebug = {
        ...latestImageDebug,
        imageDecodeStatus: "decode_error",
        imageQualityReason: "IMAGE_DECODE_ERROR"
      };
      updateVisionDebugPanel({ imageDebug: latestImageDebug });
      reject(new Error("Cannot load selected image"));
    };
    uploadedFaceImage.src = objectUrl;
  });
}

function renderStaticImageResults(results) {
  const faces = results.faces ?? [];
  clearCanvas(canvas);
  faceCountText.textContent = String(faces.length);
  landmarkCountText.textContent = faces[0] ? String(faces[0].length) : "0";
  latestImageDebug = {
    ...latestImageDebug,
    analysisSource: "image",
    imageFaceCount: faces.length
  };

  if (results.error || faces.length !== 1) {
    const reasonCode = results.error ? "FACE_TRACKING_ERROR" : faces.length > 1 ? "MULTIPLE_FACES" : "NO_FACE";
    latestImageDebug = {
      ...latestImageDebug,
      imageDecodeStatus: results.error ? "tracking_error" : "loaded",
      imageQualityReason: reasonCode
    };
    latestAnalysis = null;
    latestAiFaceShape = "";
    clearConfirmedFaceShape();
    statusText.textContent = "Ảnh chưa đạt";
    faceShapeText.textContent = "Không đủ dữ liệu";
    renderConfidenceNotice(null, { level: "low", percent: 0 }, false, faces.length > 1
      ? "Ảnh có hơn một khuôn mặt. Vui lòng chọn ảnh chỉ có một khách hàng."
      : "Không thấy rõ khuôn mặt. Vui lòng chọn ảnh chính diện, đủ sáng.");
    drawCalibrationGuide(canvas, null, getStaticImageScanGuideState("ERROR"), FaceLandmarkerApi.FACE_LANDMARKS_FACE_OVAL, latestRenderContext);
    updateVisionDebugPanel({
      imageDebug: latestImageDebug,
      faceCount: faces.length,
      reasonCode,
      mediaPipeError: results.error?.message || ""
    });
    setVisionExperienceState(faces.length > 1 ? "low_quality" : "no_face", {
      message: faces.length > 1 ? "\u1ea2nh c\u00f3 h\u01a1n m\u1ed9t khu\u00f4n m\u1eb7t." : "Kh\u00f4ng th\u1ea5y r\u00f5 khu\u00f4n m\u1eb7t trong \u1ea3nh."
    });
    updateWorkflowAssistant();
    return;
  }

  const landmarks = faces[0];
  latestDebugLandmarks = landmarks;
  latestRenderContext = resizeCanvasToImage(canvas, uploadedFaceImage, "image-analysis") || latestRenderContext;
  const analysis = analyzeFaceShape(landmarks, getImageFrameSize());
  const pose = estimateHeadPose(landmarks);
  const qualityGate = evaluateScanFrameQuality({
    step: SCAN_STEPS[0],
    analysis,
    pose,
    faceCount: faces.length,
    config: SCAN_QUALITY_CONFIG
  });
  const qualityPassed = qualityGate.ready !== false && qualityGate.reasonCode === "OK";
  if (!qualityPassed) {
    latestImageDebug = {
      ...latestImageDebug,
      imageDecodeStatus: "loaded",
      imageQualityReason: qualityGate.reasonCode || "IMAGE_QUALITY_WARNING"
    };
    latestAnalysis = null;
    latestAiFaceShape = "";
    clearConfirmedFaceShape();
    statusText.textContent = "Ảnh chưa đạt";
    faceShapeText.textContent = "Không đủ dữ liệu";
    drawCalibrationGuide(canvas, landmarks, getStaticImageScanGuideState("ERROR"), FaceLandmarkerApi.FACE_LANDMARKS_FACE_OVAL, latestRenderContext);
    drawStaticLandmarkOverlay(landmarks);
    renderConfidenceNotice(null, { level: "low", percent: 0 }, false, "Ảnh chưa đủ rõ hoặc chưa chính diện. Vui lòng chọn ảnh chính diện, đủ sáng.");
    updateCameraStatus(1, null);
    updateVisionDebugPanel({
      imageDebug: latestImageDebug,
      faceCount: faces.length,
      reasonCode: qualityGate.reasonCode || "IMAGE_QUALITY_WARNING",
      confidence: analysis?.quality?.confidence || 0,
      limitation: "static image quality gate"
    });
    setVisionExperienceState("low_quality", { message: "\u1ea2nh ch\u01b0a \u0111\u1ee7 r\u00f5 ho\u1eb7c ch\u01b0a ch\u00ednh di\u1ec7n." });
    updateWorkflowAssistant();
    return;
  }
  analysis.diagnostics = {
    ...analysis.diagnostics,
    headPose: pose,
    headPoseLabel: formatPoseLabel(pose),
    qualityGate,
    scanMode: "static-image-primary",
    limitations: [
      "Phân tích từ ảnh tĩnh, không phải đo kích thước vật lý.",
      ...getVisionLimitations({ hasPhysicalCalibration: false })
    ],
    warnings: [
      ...(analysis.diagnostics?.warnings || []),
      "Nguồn ảnh tĩnh: nên dùng ảnh chính diện, đủ sáng, không nghiêng đầu."
    ]
  };

  const finalAnalysis = buildMultiAngleAnalysis([{
    key: "center",
    label: "Ảnh tĩnh",
    analysis,
    pose,
    burst: {
      sampleCount: 1,
      totalSamples: 1,
      fallbackUsed: false,
      rejectedFrames: qualityPassed ? 0 : 1,
      rejectionReasons: qualityPassed ? {} : { [qualityGate.reasonCode || "IMAGE_QUALITY_WARNING"]: 1 }
    }
  }]);

  if (!finalAnalysis) {
    renderStaticImageResults({ faces: [] });
    return;
  }

  finalAnalysis.diagnostics = {
    ...finalAnalysis.diagnostics,
    scanMode: "static-image-primary",
    limitations: analysis.diagnostics.limitations,
    imageSource: "upload",
    qualityGate
  };
  finalAnalysis.warnings = finalAnalysis.diagnostics.warnings || [];
  latestAnalysis = finalAnalysis;
  latestAiFaceShape = finalAnalysis.faceShape_ai;
  stampCurrentResultContext();
  latestImageDebug = {
    ...latestImageDebug,
    imageDecodeStatus: "analyzed",
    imageQualityReason: "OK"
  };
  latestRenderDebug = getRenderDiagnostics({
    canvas,
    video: uploadedFaceImage,
    landmarks,
    renderContext: latestRenderContext
  });
  drawCalibrationGuide(canvas, landmarks, getStaticImageScanGuideState("RESULT"), FaceLandmarkerApi.FACE_LANDMARKS_FACE_OVAL, latestRenderContext);
  drawStaticLandmarkOverlay(landmarks);
  renderMetricsV2(finalAnalysis.metrics, finalAnalysis.quality, finalAnalysis.diagnostics);
  applyAnalysisConfidence(finalAnalysis, true);
  renderConfidenceNotice(finalAnalysis, getConfidenceState(finalAnalysis), false, "Kết quả lấy từ ảnh tĩnh. Hãy xác nhận trước khi tư vấn.");
  updateCameraStatus(1, finalAnalysis);
  syncCurrentCustomer("customerUpdated");
  statusText.textContent = "Đã phân tích ảnh";
  setVisionExperienceState("analysis_complete");
  autoScanState.active = false;
  autoScanState.phase = "RESULT";
  autoScanState.status = "captured";
  autoScanState.progress = 1;
  autoScanState.prompt = "Đã phân tích ảnh";
  autoScanState.detail = "Kiểm tra kết quả và xác nhận trước khi tư vấn.";
  updateScanHud();
  updateWorkflowAssistant();
  updateVisionDebugPanel({ imageDebug: latestImageDebug });
}

function drawStaticLandmarkOverlay(landmarks) {
  [
    [FaceLandmarkerApi.FACE_LANDMARKS_TESSELATION, { color: "rgba(32, 201, 151, 0.28)", lineWidth: 1 }],
    [FaceLandmarkerApi.FACE_LANDMARKS_LEFT_EYE, { color: "#4dabf7", lineWidth: 2 }],
    [FaceLandmarkerApi.FACE_LANDMARKS_RIGHT_EYE, { color: "#4dabf7", lineWidth: 2 }],
    [FaceLandmarkerApi.FACE_LANDMARKS_LIPS, { color: "#ff6b6b", lineWidth: 2 }]
  ].forEach(([connections, style]) => {
    drawLandmarkConnectors(canvasContext, landmarks, connections, latestRenderContext, style);
  });
}

function getStaticImageScanGuideState(phase = "IDLE") {
  return {
    mode: "scan",
    phase,
    status: phase === "ERROR" ? "error" : "captured",
    progress: phase === "RESULT" ? 1 : 0,
    label: phase === "RESULT" ? "Ảnh đã phân tích" : "Cần ảnh chính diện",
    distance: { status: phase === "RESULT" ? "ready" : "near" }
  };
}

function getImageFrameSize() {
  return {
    width: uploadedFaceImage?.naturalWidth || uploadedFaceImage?.width || 0,
    height: uploadedFaceImage?.naturalHeight || uploadedFaceImage?.height || 0
  };
}
function detectFrame(sessionToken) {
  const liveScanState = liveScanCoordinator.getState();
  if (sessionToken !== cameraSessionToken || !liveScanState.loopRunning || liveScanState.activeSessionId !== sessionToken) {
    return;
  }

  if (!hasActiveLiveCameraStream() || !isVideoReadyForLiveScan() || !isVideoLandmarkerReady()) {
    cancelLiveScanLoop();
    setVisionExperienceState("analysis_error", { message: "Camera hoặc bộ phân tích chưa sẵn sàng." });
    statusText.textContent = "Cần thử lại camera";
    updateVisionDebugPanel({
      reasonCode: "LIVE_SCAN_NOT_READY",
      mediaPipeError: "live scan prerequisites lost"
    });
    return;
  }

  latestRenderContext = resizeCanvasToVideo(canvas, video, "animation-frame") || latestRenderContext || getRenderContext(canvas, video);

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const results = detectFaceLandmarksForVideo(faceLandmarker, video, performance.now());
    drawResults(results);
  }

  updateCameraDebug({
    lastDetectTimestamp: performance.now(),
    scanLoopRunning: true,
    activeScanSessionId: sessionToken
  });
  queueLiveScanFrame(sessionToken);
}

function drawResults(results) {
  const faces = results.faces ?? results.faceLandmarks ?? [];
  clearCanvas(canvas);
  faceCountText.textContent = String(faces.length);
  landmarkCountText.textContent = faces[0] ? String(faces[0].length) : "0";

  if (results.error) {
    updateAutoScanFlow(null, null, 0);
    drawCalibrationGuide(canvas, null, getScanGuideState(), FaceLandmarkerApi.FACE_LANDMARKS_FACE_OVAL, latestRenderContext);
    faceShapeText.textContent = "Không đủ dữ liệu";
    renderConfidenceNotice(null, { level: "low", percent: 0 }, false, "MediaPipe chưa xử lý được khung hình này.");
    updateCameraStatus(0, null);
    updateVisionDebugPanel({
      faceCount: 0,
      reasonCode: results.reasonCode,
      mediaPipeError: results.error?.message || "unknown"
    });
    return;
  }

  if (!faces.length) {
    updateAutoScanFlow(null, null, 0);
    drawCalibrationGuide(canvas, null, getScanGuideState(), FaceLandmarkerApi.FACE_LANDMARKS_FACE_OVAL, latestRenderContext);
    if ((autoScanState.phase === "RESULT" || autoScanState.phase === "ERROR") && !isAnalyzingFace) {
      return;
    }
    faceShapeText.textContent = "Không thấy mặt";
    renderConfidenceNotice(null, { level: "low", percent: 0 }, false);
    updateCameraStatus(0, null);
    updateVisionDebugPanel({
      faceCount: 0,
      reasonCode: "NO_FACE"
    });
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
  latestDebugLandmarks = faces[0] || null;
  latestRenderDebug = getRenderDiagnostics({
    canvas,
    video,
    landmarks: latestDebugLandmarks || [],
    renderContext: latestRenderContext
  });
  drawCalibrationGuide(canvas, faces[0] || null, getScanGuideState(), FaceLandmarkerApi.FACE_LANDMARKS_FACE_OVAL, latestRenderContext);
  renderAnalysis(analysis);
  recordAnalysisSnapshot(analysis, faces.length);
  updateCameraStatus(faces.length, analysis);

  for (const landmarks of faces) {
    drawLandmarkConnectors(
      canvasContext,
      landmarks,
      FaceLandmarkerApi.FACE_LANDMARKS_TESSELATION,
      latestRenderContext,
      { color: "rgba(32, 201, 151, 0.28)", lineWidth: 1 }
    );

    drawLandmarkConnectors(
      canvasContext,
      landmarks,
      FaceLandmarkerApi.FACE_LANDMARKS_LEFT_EYE,
      latestRenderContext,
      { color: "#4dabf7", lineWidth: 2 }
    );

    drawLandmarkConnectors(
      canvasContext,
      landmarks,
      FaceLandmarkerApi.FACE_LANDMARKS_RIGHT_EYE,
      latestRenderContext,
      { color: "#4dabf7", lineWidth: 2 }
    );

    drawLandmarkConnectors(
      canvasContext,
      landmarks,
      FaceLandmarkerApi.FACE_LANDMARKS_LIPS,
      latestRenderContext,
      { color: "#ff6b6b", lineWidth: 2 }
    );
  }

  if (VISION_DEBUG_ENABLED && performance.now() < renderDiagnosticOverlayUntil) {
    const diagnostic = drawSafariRenderDiagnostic(canvasContext, latestDebugLandmarks || [], latestRenderContext);
    latestRenderDebug = {
      ...latestRenderDebug,
      ...(diagnostic || {})
    };
    updateVisionDebugPanel({ renderDebug: latestRenderDebug });
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
    const results = detectFaceLandmarksForVideo(faceLandmarker, video, performance.now());
    const faces = results.faces ?? [];
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
    limitations: getVisionLimitations({ hasPhysicalCalibration: false }),
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
  syncMarkMeasuredButtonState();
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
  const limitationText = Array.isArray(diagnostics.limitations) ? diagnostics.limitations[1] || diagnostics.limitations[0] : "";
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
    <em>${[sampleText, consistencyText, partialText, limitationText, finalResult ? "Đã đủ để chốt." : "Chỉ là gợi ý sơ bộ."].filter(Boolean).join(" · ")}</em>
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
  const limitationLabel = Array.isArray(diagnostics.limitations) ? "Chưa đo mm" : "";
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
    <em>${[statusTextValue, sampleLabel, consistencyLabel, partialLabel, limitationLabel].filter(Boolean).join(" · ")}</em>
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

function getDirectFrameAdvice(metrics = {}, fallbackShape = "", options = {}) {
  const lengthToWidth = Number(metrics.lengthToWidth || 0);
  const foreheadToCheek = Number(metrics.foreheadToCheek || 0);
  const jawToCheek = Number(metrics.jawToCheek || 0);
  const recommendationDiagnostics = buildRecommendationDiagnostics({
    metrics,
    classification: options.classification || getAnalysisDebugSummary(latestAnalysis) || {},
    confidence: options.confidence ?? latestAnalysis?.quality?.confidence ?? 0,
    adviceSource: options.adviceSource || (latestAnalysis ? "visionid" : "manual-or-generic"),
    hasPhysicalCalibration: false
  });
  const cheekToJaw = Number(metrics.cheekToJaw || 0);
  const shapeAdvice = fallbackShape && fallbackShape !== "unknown" ? getFaceShapeAdvice(fallbackShape) : getFaceShapeAdvice("oval");
  const advice = {
    headline: "Ưu tiên gọng cân bằng tự nhiên",
    principle: shapeAdvice.principle,
    choose: [...shapeAdvice.choose],
    avoid: [...shapeAdvice.avoid],
    fit: [...shapeAdvice.fit],
    summary: "Tỷ lệ khuôn mặt khá cân bằng, nên bắt đầu bằng các form dễ đeo rồi tinh chỉnh theo độ rộng gọng, bridge và chân mày.",
    personalizedAdvice: [...recommendationDiagnostics.personalizedAdvice],
    genericAdvice: [...recommendationDiagnostics.genericAdvice],
    recommendationDiagnostics
  };

  if (lengthToWidth >= 1.5) {
    advice.headline = "Ưu tiên gọng có chiều cao tròng";
    advice.summary = "Khuôn mặt có xu hướng dài theo chiều dọc, nên thử gọng có tròng cao vừa để cân lại tỷ lệ.";
    advice.choose = ["Wellington cao vừa", "Aviator mảnh", "Oval cao", "Browline mềm"];
    advice.avoid = ["Gọng quá dẹt", "Gọng quá mảnh theo chiều ngang", "Tròng quá thấp"];
  } else if (lengthToWidth <= 1.28) {
    advice.headline = "Ưu tiên gọng tạo nét gọn";
    advice.summary = "Chiều dài và chiều rộng khá gần nhau, nên thử gọng có đường thẳng hoặc góc bo nhẹ để khuôn mặt gọn hơn.";
    advice.choose = ["Chữ nhật bo nhẹ", "Rounded-square", "Browline", "Geometric nhẹ"];
    advice.avoid = ["Gọng tròn quá mềm", "Gọng quá nhỏ", "Tròng quá thấp"];
  }

  if (jawToCheek >= 0.9) {
    advice.headline = lengthToWidth >= 1.5 ? advice.headline : "Ưu tiên gọng bo mềm đường hàm";
    advice.summary += " Đường hàm tương đối rõ, nên tránh form quá sắc hoặc quá dày ở góc ngoài.";
    advice.choose = uniqueList(["Oval", "Tròn bản vừa", "Aviator mảnh", "Rimless", ...advice.choose]);
    advice.avoid = uniqueList(["Gọng vuông sắc", ...advice.avoid]);
  }

  if (recommendationDiagnostics.cheekWarningTriggered) {
    advice.headline = "Ưu tiên gọng làm mềm vùng gò má";
    advice.summary += " VisionID ghi nhận tín hiệu gò má nổi bật; khi thử gọng, kiểm tra bề ngang không ép vùng gò má.";
    advice.choose = uniqueList(["Oval bản vừa", "Cat-eye nhẹ", "Rimless", "Browline mềm", ...advice.choose]);
    advice.avoid = uniqueList(["Form quá hẹp ở hai bên", "Gọng quá nhỏ", ...advice.avoid]);
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
    ...advice.personalizedAdvice,
    "Đường trên gọng nên đi theo chân mày, không che biểu cảm mắt.",
    ...advice.fit
  ]).slice(0, 4);

  if (!recommendationDiagnostics.cheekWarningTriggered) {
    advice.avoid = advice.avoid.filter((item) => !isCheekSpecificAdvice(item));
    advice.fit = advice.fit.filter((item) => !isCheekSpecificAdvice(item));
  }

  latestRecommendationDebug = recommendationDiagnostics;
  updateVisionDebugPanel({ recommendationDebug: latestRecommendationDebug });

  return advice;
}

function isCheekSpecificAdvice(text = "") {
  const value = String(text).toLowerCase();
  return value.includes("gò má") || value.includes("go ma");
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
      "Gọng quá hẹp hoặc ép hai bên thái dương",
      "Gọng quá nặng làm trượt sống mũi",
      "Tròng quá dẹt nếu khách có khuôn mặt dài hoặc cần vùng nhìn rộng"
    ],
    fit: [
      "Bề ngang gọng nên xấp xỉ hoặc nhỉnh nhẹ hơn điểm rộng nhất khuôn mặt.",
      "Đồng tử nên nằm gần vùng trung tâm tròng, không lệch sát mép trong/ngoài.",
      "Bridge phải ngồi chắc trên sống mũi, không tạo vết hằn và không trượt khi cúi đầu.",
      "Đường trên gọng nên đi theo chân mày, không che biểu cảm mắt."
    ],
    summary: "Dùng quy trình thủ công khi camera/AI chưa sẵn sàng: thử nhanh 2-3 form dễ đeo, loại form ép hai bên mặt hoặc trượt mũi, sau đó ghi góp ý để hiệu chuẩn app."
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
      if (preferences.frame_preference === "bold" && /browline|cat-eye|wellington|geometric|aviator/.test(name)) score += 3;
      if (preferences.purpose === "screen" && /chữ nhật|browline|oval|rounded/.test(name)) score += 3;
      if (preferences.purpose === "fashion" && /cat-eye|wellington|browline|geometric|aviator/.test(name)) score += 3;
      if (preferences.purpose === "active" && /oval|không viền|chữ nhật|rounded/.test(name)) score += 2;
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
  const scorePercent = Math.round(gate.score * 100);
  captureQualityGate.innerHTML = `
    <div class="capture-quality-heading">
      <div class="quality-gauge" style="--quality:${scorePercent}" aria-hidden="true">
        <strong>${scorePercent}%</strong>
      </div>
      <span>${gate.passed ? "Ảnh đạt chuẩn tư vấn" : "Ảnh cần rà lại"}</span>
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

const REAL_FRAME_REFERENCES = [
  {
    keywords: ["chữ nhật", "rectangle", "wellington"],
    model: "EyeBuyDirect Algorithm",
    kind: "Rectangle / browline mảnh",
    source: "EyeBuyDirect",
    image: "https://img.ebdcdn.com/product/frame/gray/hmts0094_0.jpg?im=Resize%2Cwidth%3D720%2Cheight%3D360%2Caspect%3Dfill%3BUnsharpMask%2Csigma%3D1.0%2Cgain%3D1.0&q=85",
    link: "https://www.eyebuydirect.com/eyeglasses/frames/algorithm-gunmetal-l-18619"
  },
  {
    keywords: ["tròn", "round"],
    model: "Ray-Ban Round Metal RX3447V",
    kind: "Round metal",
    source: "Visio-Net / Ray-Ban reference",
    image: "https://media.visio-net.com/oscommerce/images/viewerxxl_new/ray-ban-Round-Metal-RX3447V-2500-47_2.jpg",
    link: "https://www.ray-ban.com/usa/eyeglasses/RX3447V%20UNISEX%20round%20metal%20optics-arista%20gold/8053672727692"
  },
  {
    keywords: ["oval", "bản vừa"],
    model: "EyeBuyDirect St Michel",
    kind: "Oval-round metal",
    source: "EyeBuyDirect",
    image: "https://img.ebdcdn.com/product/frame/gray/mt6567_0.jpg?im=Resize%2Cwidth%3D720%2Cheight%3D360%2Caspect%3Dfill%3BUnsharpMask%2Csigma%3D1.0%2Cgain%3D1.0&q=85",
    link: "https://www.eyebuydirect.com/eyeglasses"
  },
  {
    keywords: ["cat", "mắt mèo"],
    model: "Warby Parker Daisy",
    kind: "Soft cat-eye",
    source: "Eyewear Collections / Warby Parker reference",
    image: "https://eyewear-collections.com/cdn/shop/files/9683c604-56b9-5b36-9e9b-4cfc6d3e00e3.jpg?v=1717638948&width=900",
    link: "https://eyewear-collections.com/products/warby-parker-daisy-m-lbf-52-16-140"
  },
  {
    keywords: ["brow", "nửa", "half-rim", "nhấn chân mày"],
    model: "EyeBuyDirect Algorithm",
    kind: "Browline / half-rim",
    source: "EyeBuyDirect",
    image: "https://img.ebdcdn.com/product/frame/gray/hmts0094_0.jpg?im=Resize%2Cwidth%3D720%2Cheight%3D360%2Caspect%3Dfill%3BUnsharpMask%2Csigma%3D1.0%2Cgain%3D1.0&q=85",
    link: "https://www.eyebuydirect.com/eyeglasses/frames/algorithm-gunmetal-l-18619"
  },
  {
    keywords: ["không viền", "rimless"],
    model: "EyeBuyDirect rimless reference",
    kind: "Rimless",
    source: "EyeBuyDirect",
    image: "https://img.ebdcdn.com/product/frame/gray/rm3075_0.jpg?im=Resize%2Cwidth%3D720%2Cheight%3D360%2Caspect%3Dfill%3BUnsharpMask%2Csigma%3D1.0%2Cgain%3D1.0&q=85",
    link: "https://www.eyebuydirect.com/eyeglasses"
  },
  {
    keywords: ["rounded-square", "vuông", "square", "geometric"],
    model: "EyeBuyDirect Uptown",
    kind: "Rounded-square",
    source: "EyeBuyDirect",
    image: "https://img.ebdcdn.com/product/frame/gray/pl6603_0.jpg?im=Resize%2Cwidth%3D720%2Cheight%3D360%2Caspect%3Dfill%3BUnsharpMask%2Csigma%3D1.0%2Cgain%3D1.0&q=85",
    link: "https://www.eyebuydirect.com/eyeglasses"
  },
  {
    keywords: ["aviator"],
    model: "EyeBuyDirect aviator reference",
    kind: "Aviator optical",
    source: "EyeBuyDirect",
    image: "https://img.ebdcdn.com/product/frame/gray/rm3075_0.jpg?im=Resize%2Cwidth%3D720%2Cheight%3D360%2Caspect%3Dfill%3BUnsharpMask%2Csigma%3D1.0%2Cgain%3D1.0&q=85",
    link: "https://www.eyebuydirect.com/eyeglasses"
  }
];

function getFrameReference(frameName = "") {
  const name = String(frameName || "").toLowerCase();
  return REAL_FRAME_REFERENCES.find((reference) =>
    reference.keywords.some((keyword) => name.includes(keyword))
  ) || REAL_FRAME_REFERENCES[0];
}

function renderFrameReferenceVisual(frameName = "", index = 0) {
  const reference = getFrameReference(frameName);
  const fallback = getFrameSketchSvg(frameName, index);
  return `
    <figure class="frame-real-reference">
      <img src="${reference.image}" alt="${reference.kind} - ${reference.model}" loading="lazy" decoding="async" onerror="this.closest('figure').classList.add('is-fallback')">
      <figcaption>
        <span>${reference.kind}</span>
        <strong>${reference.model}</strong>
        <em>${reference.source}</em>
      </figcaption>
      <div class="frame-reference-fallback">${fallback}</div>
    </figure>
  `;
}

function renderFrameReferenceThumb(frameName = "", index = 0) {
  const reference = getFrameReference(frameName);
  const fallback = getFrameSketchSvg(frameName, index);
  return `
    <figure class="frame-reference-thumb">
      <img src="${reference.image}" alt="${reference.kind} - ${reference.model}" loading="lazy" decoding="async" onerror="this.closest('figure').classList.add('is-fallback')">
      <figcaption>${reference.model}</figcaption>
      <div class="frame-reference-fallback">${fallback}</div>
    </figure>
  `;
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
        note: `${fit} Nếu gọng làm hai bên mặt hoặc đường hàm bị nặng hơn, chuyển sang form mềm hoặc rộng hơn.`
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

  syncMarkMeasuredButtonState();
}

function updateVisionDebugPanel(payload = {}) {
  if (!VISION_DEBUG_ENABLED) {
    return;
  }

  if (!visionDebugPanel) {
    visionDebugPanel = document.createElement("pre");
    visionDebugPanel.setAttribute("aria-label", "VisionID QA debug");
    visionDebugPanel.style.cssText = [
      "position:fixed",
      "right:12px",
      "bottom:12px",
      "z-index:9999",
      "max-width:360px",
      "max-height:45vh",
      "overflow:auto",
      "margin:0",
      "padding:10px 12px",
      "border-radius:8px",
      "background:rgba(7,20,26,0.92)",
      "color:#d8fff4",
      "font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace",
      "box-shadow:0 12px 40px rgba(0,0,0,0.28)",
      "white-space:pre-wrap",
      "pointer-events:none"
    ].join(";");
    document.body.appendChild(visionDebugPanel);
  }

  ensureVisionDebugCameraButton();

  const debugSummary = getAnalysisDebugSummary(payload.analysis || latestAnalysis) || {};
  const diagnostics = (payload.analysis || latestAnalysis)?.diagnostics || {};
  const qualityGate = diagnostics.qualityGate || {};
  const cameraDebug = payload.cameraDebug || latestCameraDebug || {};
  const recommendationDebug = payload.recommendationDebug || latestRecommendationDebug || {};
  const renderDebug = payload.renderDebug || latestRenderDebug || {};
  const deviceDebug = payload.deviceContext || sanitizeDeviceContextForDebug(currentDeviceContext || {});
  const imageDebug = payload.imageDebug || latestImageDebug || {};
  const formatMetric = (value, digits = 3) => Number.isFinite(Number(value))
    ? Number(value).toFixed(digits)
    : "-";
  const debugData = {
    scanId: payload.scanId ?? debugSummary.scanId ?? autoScanState.token,
    analysisInstanceId: debugSummary.analysisInstanceId || "-",
    phase: autoScanState.phase,
    step: SCAN_STEPS[autoScanState.stepIndex]?.key || "-",
    faceCount: payload.faceCount ?? Number(faceCountText?.textContent || 0),
    reasonCode: payload.reasonCode || qualityGate.reasonCodes?.join(", ") || "-",
    attemptedFrames: payload.attemptedFrames ?? debugSummary.attemptedFrames ?? "-",
    acceptedFrames: payload.acceptedFrames ?? diagnostics.centerBurst?.sampleCount ?? "-",
    rejectedFrames: payload.rejectedFrames ?? (
      diagnostics.centerBurst
        ? Math.max(0, Number(diagnostics.centerBurst.totalSamples || 0) - Number(diagnostics.centerBurst.sampleCount || 0))
        : "-"
    ),
    rejectionReasons: payload.rejectionReasons
      ? JSON.stringify(payload.rejectionReasons)
      : (diagnostics.centerBurst?.rejectionReasons ? JSON.stringify(diagnostics.centerBurst.rejectionReasons) : "-"),
    usableSamples: payload.usableSamples ?? diagnostics.centerBurst?.sampleCount ?? "-",
    fallbackUsed: payload.fallbackUsed ?? diagnostics.centerBurst?.fallbackUsed ?? false,
    confidence: Number.isFinite(Number(payload.confidence ?? (payload.analysis || latestAnalysis)?.quality?.confidence))
      ? `${Math.round(Number(payload.confidence ?? (payload.analysis || latestAnalysis)?.quality?.confidence) * 100)}%`
      : "-",
    limitation: payload.limitation || (Array.isArray(diagnostics.limitations) ? diagnostics.limitations.join(" | ") : ""),
    mediaPipeError: payload.mediaPipeError || "",
    visionExperienceState: cameraDebug.visionExperienceState || visionExperienceState || "-",
    scanLoopRunning: cameraDebug.scanLoopRunning ?? false,
    activeScanSessionId: cameraDebug.activeScanSessionId || "-",
    modelReady: cameraDebug.modelReady ?? isVideoLandmarkerReady(),
    lastDetectTimestamp: cameraDebug.lastDetectTimestamp ? Math.round(cameraDebug.lastDetectTimestamp) : "-",
    detectedProfile: deviceDebug.deviceProfile || "-",
    effectiveProfile: deviceDebug.overrideActive ? deviceDebug.overrideProfile || deviceDebug.deviceProfile || "-" : deviceDebug.deviceProfile || "-",
    deviceProfile: deviceDebug.deviceProfile || "-",
    devicePipeline: deviceDebug.pipeline || "-",
    profileReason: deviceDebug.profileReason || "-",
    cameraCapability: deviceDebug.cameraCapability || "-",
    fallbackReason: imageDebug.fallbackReason || deviceDebug.cameraStartupStatus || "-",
    browserFamily: deviceDebug.browserFamily || "-",
    osFamily: deviceDebug.osFamily || "-",
    deviceClass: deviceDebug.deviceClass || "-",
    deviceOrientation: deviceDebug.orientation || "-",
    renderProfile: deviceDebug.renderProfile || "-",
    cameraStartupStatus: deviceDebug.cameraStartupStatus || "-",
    compatibilityFallbackUsed: deviceDebug.compatibilityFallbackUsed ?? false,
    deviceOverrideActive: deviceDebug.overrideActive ?? false,
    deviceOverrideProfile: deviceDebug.overrideProfile || "-",
    deviceHasMediaDevices: deviceDebug.hasMediaDevices ?? "-",
    deviceHasGetUserMedia: deviceDebug.hasGetUserMedia ?? "-",
    supportedMediaConstraints: deviceDebug.supportedMediaConstraints ? JSON.stringify(deviceDebug.supportedMediaConstraints) : "-",
    analysisSource: imageDebug.analysisSource || (latestAnalysis?.diagnostics?.imageSource ? "image" : "video"),
    imageNaturalWidth: imageDebug.imageNaturalWidth ?? "-",
    imageNaturalHeight: imageDebug.imageNaturalHeight ?? "-",
    imageOrientation: imageDebug.imageOrientation || "-",
    imageDecodeStatus: imageDebug.imageDecodeStatus || "-",
    imageFaceCount: imageDebug.imageFaceCount ?? "-",
    imageQualityReason: imageDebug.imageQualityReason || "-",
    activeLandmarkerMode,
    modeSwitchInFlight: landmarkerModeSwitchInFlight,
    objectUrlActive: imageDebug.objectUrlActive ?? Boolean(uploadedImageObjectUrl),
    previousObjectUrlRevoked: imageDebug.previousObjectUrlRevoked ?? false,
    inputWidth: debugSummary.inputWidth ?? "-",
    inputHeight: debugSummary.inputHeight ?? "-",
    inputAspectRatio: formatMetric(debugSummary.inputAspectRatio),
    rawFaceHeight: formatMetric(debugSummary.rawFaceHeight),
    rawFaceWidth: formatMetric(debugSummary.rawFaceWidth),
    rawLengthWidthRatio: formatMetric(debugSummary.rawLengthWidthRatio),
    aspectCorrectionFactor: formatMetric(debugSummary.aspectCorrectionFactor),
    correctedFaceHeight: formatMetric(debugSummary.correctedFaceHeight),
    correctedFaceWidth: formatMetric(debugSummary.correctedFaceWidth),
    correctedLengthWidthRatio: formatMetric(debugSummary.correctedLengthWidthRatio),
    foreheadWidthRatio: formatMetric(debugSummary.foreheadWidthRatio),
    jawWidthRatio: formatMetric(debugSummary.jawWidthRatio),
    cheekWidthRatio: formatMetric(debugSummary.cheekWidthRatio),
    scoreRound: formatMetric(debugSummary.scores?.round),
    scoreOval: formatMetric(debugSummary.scores?.oval),
    scoreLong: formatMetric(debugSummary.scores?.long),
    scoreSquare: formatMetric(debugSummary.scores?.square),
    scoreHeart: formatMetric(debugSummary.scores?.heart),
    scoreDiamond: formatMetric(debugSummary.scores?.diamond),
    winningLabel: debugSummary.winningLabel || "-",
    secondLabel: debugSummary.secondLabel || "-",
    scoreMargin: formatMetric(debugSummary.scoreMargin),
    invalidMetricReason: debugSummary.invalidMetricReason || "-",
    cameraPhase: cameraDebug.permissionRequestPhase || "-",
    cameraErrorName: payload.cameraErrorName || cameraDebug.cameraErrorName || "-",
    cameraErrorCode: payload.cameraErrorCode || cameraDebug.cameraErrorCode || "-",
    cameraErrorMessage: payload.cameraErrorMessage || cameraDebug.cameraErrorMessage || "-",
    cameraErrorConstraint: cameraDebug.cameraErrorConstraint || "-",
    requestedConstraints: cameraDebug.requestedConstraints ? JSON.stringify(cameraDebug.requestedConstraints) : "-",
    fallbackConstraintsUsed: cameraDebug.fallbackConstraintsUsed ?? false,
    activeStreamCount: cameraDebug.activeStreamCount ?? "-",
    currentTrackReadyState: cameraDebug.currentTrackReadyState || "-",
    currentTrackMuted: cameraDebug.currentTrackMuted ?? "-",
    currentTrackEnabled: cameraDebug.currentTrackEnabled ?? "-",
    videoReadyState: cameraDebug.videoReadyState ?? "-",
    videoWidth: cameraDebug.videoWidth ?? "-",
    videoHeight: cameraDebug.videoHeight ?? "-",
    videoPaused: cameraDebug.videoPaused ?? "-",
    videoEnded: cameraDebug.videoEnded ?? "-",
    playPromiseError: cameraDebug.playPromiseError || "-",
    pageLifecycleEvent: cameraDebug.pageLifecycleEvent || "-",
    userAgent: cameraDebug.userAgent || navigator.userAgent || "-",
    platform: cameraDebug.platform || navigator.platform || "-",
    isSecureContext: cameraDebug.isSecureContext ?? Boolean(window.isSecureContext),
    documentVisibilityState: cameraDebug.documentVisibilityState || document.visibilityState || "-",
    hasMediaDevices: cameraDebug.hasMediaDevices ?? Boolean(navigator.mediaDevices),
    hasGetUserMedia: cameraDebug.hasGetUserMedia ?? Boolean(navigator.mediaDevices?.getUserMedia),
    winningFaceLabel: recommendationDebug.winningFaceLabel || "-",
    secondFaceLabel: recommendationDebug.secondFaceLabel || "-",
    faceLabelMargin: formatMetric(recommendationDebug.faceLabelMargin),
    recommendationCheekWidthRatio: formatMetric(recommendationDebug.cheekWidthRatio),
    jawToCheekRatio: formatMetric(recommendationDebug.jawToCheekRatio),
    foreheadToCheekRatio: formatMetric(recommendationDebug.foreheadToCheekRatio),
    cheekProminenceScore: formatMetric(recommendationDebug.cheekProminenceScore),
    cheekWarningThreshold: formatMetric(recommendationDebug.cheekWarningThreshold),
    cheekWarningTriggered: recommendationDebug.cheekWarningTriggered ?? false,
    recommendationRuleIds: recommendationDebug.recommendationRuleIds?.join(", ") || "-",
    personalizedAdvice: recommendationDebug.personalizedAdvice?.join(" | ") || "-",
    genericAdvice: recommendationDebug.genericAdvice?.join(" | ") || "-",
    adviceSource: recommendationDebug.adviceSource || "-",
    invalidRecommendationMetric: recommendationDebug.invalidRecommendationMetric || "-",
    detectedBrowser: renderDebug.detectedBrowser || "-",
    isSafari: renderDebug.isSafari ?? "-",
    isIOS: renderDebug.isIOS ?? "-",
    isIPadOS: renderDebug.isIPadOS ?? "-",
    orientation: renderDebug.orientation || "-",
    screenWidth: renderDebug.screenWidth ?? "-",
    screenHeight: renderDebug.screenHeight ?? "-",
    windowInnerWidth: renderDebug.windowInnerWidth ?? "-",
    windowInnerHeight: renderDebug.windowInnerHeight ?? "-",
    devicePixelRatio: renderDebug.devicePixelRatio ?? cameraDebug.devicePixelRatio ?? "-",
    videoClientWidth: renderDebug.videoClientWidth ?? "-",
    videoClientHeight: renderDebug.videoClientHeight ?? "-",
    videoOffsetWidth: renderDebug.videoOffsetWidth ?? "-",
    videoOffsetHeight: renderDebug.videoOffsetHeight ?? "-",
    videoRectWidth: renderDebug.videoRectWidth ?? "-",
    videoRectHeight: renderDebug.videoRectHeight ?? "-",
    videoPlaysInline: renderDebug.videoPlaysInline ?? "-",
    hasVideoSrcObject: renderDebug.hasVideoSrcObject ?? "-",
    trackWidth: renderDebug.trackWidth ?? "-",
    trackHeight: renderDebug.trackHeight ?? "-",
    trackAspectRatio: formatMetric(renderDebug.trackAspectRatio),
    trackFacingMode: renderDebug.trackFacingMode || "-",
    canvasWidth: renderDebug.canvasWidth ?? "-",
    canvasHeight: renderDebug.canvasHeight ?? "-",
    canvasClientWidth: renderDebug.canvasClientWidth ?? "-",
    canvasClientHeight: renderDebug.canvasClientHeight ?? "-",
    canvasOffsetWidth: renderDebug.canvasOffsetWidth ?? "-",
    canvasOffsetHeight: renderDebug.canvasOffsetHeight ?? "-",
    canvasRectWidth: renderDebug.canvasRectWidth ?? "-",
    canvasRectHeight: renderDebug.canvasRectHeight ?? "-",
    selectedSourceWidth: renderDebug.selectedSourceWidth ?? "-",
    selectedSourceHeight: renderDebug.selectedSourceHeight ?? "-",
    selectedDestinationWidth: renderDebug.selectedDestinationWidth ?? "-",
    selectedDestinationHeight: renderDebug.selectedDestinationHeight ?? "-",
    sourceAspectRatio: formatMetric(renderDebug.sourceAspectRatio),
    destinationAspectRatio: formatMetric(renderDebug.destinationAspectRatio),
    objectFit: renderDebug.objectFit || "-",
    renderScaleX: formatMetric(renderDebug.renderScaleX),
    renderScaleY: formatMetric(renderDebug.renderScaleY),
    uniformRenderScale: formatMetric(renderDebug.uniformRenderScale),
    cropOffsetX: formatMetric(renderDebug.cropOffsetX),
    cropOffsetY: formatMetric(renderDebug.cropOffsetY),
    mirrored: renderDebug.mirrored ?? "-",
    faceBoundingBoxRendered: renderDebug.faceBoundingBoxRendered ? JSON.stringify(renderDebug.faceBoundingBoxRendered) : "-",
    renderedFaceWidth: formatMetric(renderDebug.renderedFaceWidth),
    renderedFaceHeight: formatMetric(renderDebug.renderedFaceHeight),
    renderedFaceAspectRatio: formatMetric(renderDebug.renderedFaceAspectRatio),
    loadedmetadataCount: renderLifecycleCounts.loadedmetadata,
    canplayCount: renderLifecycleCounts.canplay,
    resizeEventCount: renderLifecycleCounts.resize,
    orientationchangeCount: renderLifecycleCounts.orientationchange,
    visualViewportResizeCount: renderLifecycleCounts.visualViewportResize,
    canvasResizeCount: renderDebug.canvasResizeCount ?? "-",
    lastCanvasResizeReason: renderDebug.lastCanvasResizeReason || "-"
  };

  visionDebugPanel.textContent = Object.entries(debugData)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function ensureVisionDebugCameraButton() {
  if (!VISION_DEBUG_ENABLED) {
    return;
  }

  if (!visionDebugCameraButton) {
    visionDebugCameraButton = createVisionDebugButton("Kiểm tra camera", "calc(45vh + 28px)");
    visionDebugCameraButton.addEventListener("click", runVisionDebugCameraCheck);
    document.body.appendChild(visionDebugCameraButton);
  }

  if (!visionDebugRenderButton) {
    visionDebugRenderButton = createVisionDebugButton("Kiểm tra lớp quét", "calc(45vh + 70px)");
    visionDebugRenderButton.addEventListener("click", runVisionDebugRenderCheck);
    document.body.appendChild(visionDebugRenderButton);
  }
}

function createVisionDebugButton(label, bottom) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText = [
    "position:fixed",
    "right:12px",
    `bottom:${bottom}`,
    "z-index:10000",
    "min-height:36px",
    "padding:8px 12px",
    "border-radius:8px",
    "border:1px solid rgba(216,255,244,0.4)",
    "background:#0b695f",
    "color:#fff",
    "font:600 12px system-ui,sans-serif",
    "box-shadow:0 8px 24px rgba(0,0,0,0.22)"
  ].join(";");
  return button;
}

async function runVisionDebugCameraCheck() {
  if (!VISION_DEBUG_ENABLED || !video) {
    return;
  }

  visionDebugCameraButton.disabled = true;
  visionDebugCameraButton.textContent = "Đang kiểm tra...";
  updateCameraDebug({
    permissionRequestPhase: "debug-check-start",
    pageLifecycleEvent: "debug-camera-check"
  });
  let stream = null;

  try {
    stream = await startUserCamera(video, { facingMode: currentCameraMode, readyTimeoutMs: 5000 });
    currentCameraStream = stream;
    updateCameraDebug({
      permissionRequestPhase: "debug-check-ok",
      requestedConstraints: stream?.visionCameraDiagnostics?.requestedConstraints || null,
      fallbackConstraintsUsed: Boolean(stream?.visionCameraDiagnostics?.fallbackConstraintsUsed)
    });
    statusText.textContent = "Camera debug OK";
  } catch (error) {
    handleCameraOpenError(error);
  } finally {
    visionDebugCameraButton.disabled = false;
    visionDebugCameraButton.textContent = "Kiểm tra camera";
  }
}

function runVisionDebugRenderCheck() {
  if (!VISION_DEBUG_ENABLED) {
    return;
  }

  latestRenderContext = getRenderContext(canvas, video);
  latestRenderDebug = getRenderDiagnostics({
    canvas,
    video,
    landmarks: latestDebugLandmarks || [],
    renderContext: latestRenderContext
  });
  renderDiagnosticOverlayUntil = performance.now() + 3500;
  updateVisionDebugPanel({
    renderDebug: latestRenderDebug,
    pageLifecycleEvent: "debug-render-check"
  });
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
      (frame, index) => `
        <article class="frame-card">
          <div class="frame-visual is-reference">${renderFrameReferenceThumb(frame.name, index)}</div>
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
            ${lens.priceVnd ? `<span>${formatLensPrice(lens)}</span>` : ""}
          </div>
          <p>${lens.note}</p>
          ${formatLensCatalogDetail(lens) ? `<p class="lens-evidence">${formatLensCatalogDetail(lens)}</p>` : ""}
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
  return "user";
}

function updateCameraModeButton() {
  if (!cameraModeButton) {
    return;
  }

  const isRear = currentCameraMode === "environment";
  cameraModeButton.textContent = isRear ? "Đổi sang camera trước" : "Đổi sang camera sau";
  cameraModeButton.setAttribute("aria-pressed", String(isRear));

  if (cameraModeHint) {
    cameraModeHint.textContent = isRear
      ? "Đang dùng camera sau; nếu khó căn mặt hãy đổi về camera trước."
      : "Đang dùng camera trước để khách dễ tự căn mặt trên màn hình.";
  }
}

function toggleCameraMode() {
  currentCameraMode = currentCameraMode === "environment" ? "user" : "environment";
  updateCameraModeButton();
  if (video.srcObject) {
    enableCamera().catch((error) => {
      console.debug("[VisionID] Camera switch failed", error?.code || error?.name || error?.message);
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
  clearUploadedImagePreview({ revoke: true, clearOverlay: true, reason: "new-customer" });
  customerCodeInput.value = createCustomerCode();
  currentSessionCode = createSessionCode();
  ensureCurrentSessionCode();
  customerNameInput.value = "";
  customerPhoneInput.value = "";
  duplicatePhoneMatches = [];
  renderPhoneDuplicateNotice([]);
  consultDateInput.value = todayInputValue();
  ageGroupInput.value = "";
  customerNotesInput.value = "";
  frameWidthMmInput.value = "";
  lensWidthMmInput.value = "";
  bridgeWidthMmInput.value = "";
  customerStatusInput.value = "waiting";
  hasPrescriptionInput.checked = false;
  setPrescriptionSectionVisible(false);
  clearPrescriptionInputs();
  analysisHistory = [];
  resetVolatileConsultationState();
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
  const duplicateDecision = getDuplicateSaveDecision(loadCustomers(), {
    phone: customerPhoneInput.value,
    currentCustomerId: operationCustomerId || customerCodeInput.value,
    allowDuplicate: allowDuplicateCustomerSaveOnce
  });
  if (duplicateDecision.shouldBlock) {
    showDuplicateSaveDialog(duplicateDecision.matches);
    return null;
  }

  allowDuplicateCustomerSaveOnce = false;
  updateAdvice();
  const existingRecord = findCurrentCustomerRecord();
  const persistableAnalysis = getPersistableVisionAnalysis();
  const customerDraft = {
    customer_code: customerCodeInput.value,
    session_code: currentSessionCode,
    customer_name: customerNameInput.value.trim(),
    customer_phone: customerPhoneInput.value.trim(),
    consult_date: consultDateInput.value,
    age_group: ageGroupInput.value,
    customer_notes: customerNotesInput.value.trim(),
    customer_status: customerStatusInput.value,
    frame_width_mm: parseOptionalNumber(frameWidthMmInput.value),
    lens_width_mm: parseOptionalNumber(lensWidthMmInput.value),
    bridge_width_mm: parseOptionalNumber(bridgeWidthMmInput.value),
    has_prescription: hasPrescriptionInput.checked,
    prescription: readPrescriptionData(),
    preferences: readPreferences(),
    analysis: persistableAnalysis,
    faceShape_ai: latestAiFaceShape || latestAnalysis?.faceShape_ai || latestAnalysis?.shape || "",
    faceShape_confirmed: confirmedFaceShape || latestAnalysis?.faceShape_confirmed || "",
    consultation_mode: manualConsultationMode ? "manual" : "visionid",
    recommendations: latestRecommendations,
    lens_recommendations: latestLensRecommendations,
    consultation_result: existingRecord?.consultation_result || persistedConsultationResult || null,
    consultation_saved_at: existingRecord?.consultation_saved_at || persistedConsultationResult?.savedAt || "",
    consultation_source: existingRecord?.consultation_source || persistedConsultationResult?.consultationSource || "",
    snapshot: {
      face_count: Number(faceCountText.textContent || 0),
      landmark_count: Number(landmarkCountText.textContent || 0)
    }
  };
  const record = saveCustomer(
    hasVisionAnalysisConsent() ? customerDraft : purgeStoredVisionAnalysis(customerDraft)
  );

  customerCodeInput.value = record.customer_code;
  operationCustomerId = record.customer_code;
  operationDraftSource = "existing";
  lastCustomerSavedAt = record.updated_at || new Date().toISOString();
  flushOperationDraftSave("customer-save");
  setOperationBaselineFromCurrent();
  setOperationSaveState("customer-saved", { customerSavedAt: lastCustomerSavedAt });
  duplicatePhoneMatches = [];
  renderPhoneDuplicateNotice([]);
  renderCustomers();
  statusText.textContent = "Đã lưu hồ sơ";
  updateWorkflowAssistant();
  return record;
}

function getPersistableVisionAnalysis() {
  if (!hasVisionAnalysisConsent()) {
    return null;
  }

  return latestAnalysis;
}

async function saveConsultationResult() {
  if (consultationSaveInFlight) {
    return null;
  }

  consultationSaveInFlight = true;
  consultationSaveError = "";
  renderConsultationActions();

  try {
    if (!operationCustomerId) {
      const savedCustomer = saveCurrentCustomerWithLock();
      if (!savedCustomer) {
        consultationSaveError = "Can luu ho so khach truoc khi luu ket qua tu van.";
        renderConsultationActions();
        return null;
      }
      latestResultContext = getCurrentConsultationContext();
      latestRecommendationContext = latestResultContext;
    }

    const source = getCurrentDetailedConsultationSource();
    const contextMatches = isConsultationResultCurrent({
      resultContext: latestRecommendationContext || latestResultContext,
      currentContext: getCurrentConsultationContext(),
      allowMissingDraft: Boolean(persistedConsultationResult)
    });
    const completionGate = canCompleteOperation({
      customerExists: Boolean(findCurrentCustomerRecord()),
      source,
      saveInFlight: false,
      contextMatches
    });

    if (!completionGate.allowed) {
      consultationSaveError = completionGate.reason === "CONTEXT_MISMATCH"
        ? "Ket qua hien tai khong thuoc dung khach/phien dang mo."
        : "Can co nguon tu van hop le truoc khi luu ket qua.";
      renderConsultationActions();
      return null;
    }

    updateAdvice();
    const savedAt = new Date().toISOString();
    const payload = getCurrentConsultationPayload(savedAt);
    if (!payload) {
      consultationSaveError = "Chua co goi y gong hop le de luu.";
      renderConsultationActions();
      return null;
    }

    const existing = findCurrentCustomerRecord() || readCustomerSnapshot();
    const record = saveCustomer({
      ...existing,
      ...readCustomerSnapshot(),
      customer_code: operationCustomerId || customerCodeInput.value,
      session_code: ensureCurrentSessionCode(),
      consultation_result: payload,
      consultation_saved_at: savedAt,
      consultation_source: payload.consultationSource,
      recommendations: latestRecommendations,
      lens_recommendations: latestLensRecommendations
    });

    operationCustomerId = record.customer_code;
    persistedConsultationResult = payload;
    persistedConsultationContext = getCurrentConsultationContext();
    savedConsultationSignature = getConsultationSignature({ ...payload, savedAt: "pending" });
    lastCustomerSavedAt = record.updated_at || savedAt;
    setOperationSaveState("customer-saved", { customerSavedAt: lastCustomerSavedAt });
    const completed = completeCurrentOperationDraft(savedAt);
    if (!completed.ok) {
      consultationSaveError = "Da luu ket qua, nhung chua the dong ban nhap thao tac.";
    } else {
      operationSaveState = "customer-saved";
      lastOperationBusinessBaseline = getCurrentOperationBusinessState();
    }
    renderCustomers();
    renderConsultationActions();
    renderCustomerSessionHeader();
    if (consultationSaveStatus) {
      consultationSaveStatus.textContent = `Da luu ket qua tu van cho ${record.customer_name || "khach hang"}.`;
      consultationSaveStatus.focus?.();
    }
    return record;
  } catch (error) {
    console.error(error);
    consultationSaveError = "Luu ket qua that bai. Du lieu tren man hinh van duoc giu lai.";
    renderConsultationActions();
    return null;
  } finally {
    consultationSaveInFlight = false;
    renderConsultationActions();
    updateWorkflowAssistant();
  }
}

function hasVisionAnalysisConsent() {
  return isExplicitConsentGranted(latestAnalysis?.privacyConsent?.analysisStorage);
}

function renderCustomers() {
  const query = customerSearch.value;
  const customers = loadCustomers();
  const activeDraft = readOperationDraft();
  const rankedRecords = rankCustomerMatches(customers, query, { limit: 8 });
  const records = rankedRecords.map((match) => match.customer);
  const total = customers.length;
  customerCount.textContent = `${records.length}/${total} hồ sơ`;

  if (!records.length) {
    customerList.innerHTML = query.trim()
      ? renderNoCustomerMatches(query)
      : `<p class="empty-state">${total ? "Không tìm thấy hồ sơ phù hợp." : "Chưa có hồ sơ nào."}</p>`;
    return;
  }

  customerList.innerHTML = rankedRecords
    .map(({ customer: record }) => {
      const label = record.faceShape_confirmed
        ? getFaceShapeLabel(record.faceShape_confirmed)
        : (record.analysis?.label || "Chưa phân tích");
      const purpose = purposeLabel(record.preferences?.purpose);
      const rxTag = record.has_prescription ? "Có đơn kính" : "Chưa có đơn kính";
      const operationalStatus = getCustomerOperationalStatus(record, activeDraft);
      const primaryAction = getCustomerPrimaryAction(record, activeDraft);
      const updatedAt = new Date(record.updated_at).toLocaleString("vi-VN");
      const consultDate = record.consult_date ? formatConsultDate(record.consult_date) : "Chưa có ngày";
      const ageGroup = ageGroupLabel(record.age_group);
      return `
        <article class="customer-card">
          <div>
            <strong>${escapeHtml(record.customer_name || "Chưa nhập")} - ${escapeHtml(record.customer_code)} <span class="status-chip">${escapeHtml(operationalStatus.label)}</span></strong>
            <span>${escapeHtml(record.customer_phone || "Chưa có SĐT")} | ${escapeHtml(consultDate)} | ${escapeHtml(ageGroup)} | ${escapeHtml(label)} | ${escapeHtml(purpose)} | ${escapeHtml(rxTag)}</span>
            <span class="customer-note">${escapeHtml(record.customer_notes || "Chưa có ghi chú")}</span>
            <span>Bước tiếp: ${escapeHtml(operationalStatus.nextStep)}</span>
            <span>Cập nhật: ${escapeHtml(updatedAt)}</span>
          </div>
          <div class="customer-actions">
            <button type="button" data-load-customer="${escapeHtml(record.customer_code)}" data-open-intent="${escapeHtml(primaryAction.status)}">${escapeHtml(primaryAction.label)}</button>
            <button type="button" class="danger-action" data-delete-customer="${escapeHtml(record.customer_code)}">Xóa</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderNoCustomerMatches(query) {
  const prefill = createCustomerPrefillFromQuery(query);
  const prefillPayload = encodeURIComponent(JSON.stringify(prefill));
  return `
    <div class="empty-state customer-search-empty">
      <strong>Không tìm thấy khách hàng phù hợp.</strong>
      <span>Tạo khách mới chỉ sau khi đã kiểm tra kỹ kết quả tìm kiếm.</span>
      <div class="empty-search-actions">
        <button type="button" data-create-customer-from-search="${prefillPayload}">Tạo khách hàng mới</button>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loadCustomerRecord(customerCode) {
  const record = loadCustomers().find((item) => item.customer_code === customerCode);
  if (!record) {
    return false;
  }

  isLoadingCustomer = true;
  suppressOperationDraftTracking = true;
  operationCompletedContext = null;
  analysisHistory = [];
  customerCodeInput.value = record.customer_code;
  customerNameInput.value = record.customer_name || "";
  customerPhoneInput.value = record.customer_phone || "";
  duplicatePhoneMatches = [];
  renderPhoneDuplicateNotice([]);
  consultDateInput.value = record.consult_date || todayInputValue();
  ageGroupInput.value = record.age_group || "";
  customerNotesInput.value = record.customer_notes || "";
  frameWidthMmInput.value = record.frame_width_mm ?? "";
  customerStatusInput.value = record.customer_status || "waiting";
  hasPrescriptionInput.checked = Boolean(record.has_prescription);
  applyPrescriptionData(record.prescription || {});
  setPrescriptionSectionVisible(hasPrescriptionInput.checked);
  applyPreferences(record.preferences);
  lensWidthMmInput.value = record.lens_width_mm ?? record.preferences?.lens_width_mm ?? "";
  bridgeWidthMmInput.value = record.bridge_width_mm ?? record.preferences?.bridge_width_mm ?? "";
  currentSessionCode = record.session_code || createSessionCode();
  ensureCurrentSessionCode();
  manualConsultationMode = record.consultation_mode === "manual";
  persistedConsultationResult = record.consultation_result || null;
  persistedConsultationContext = persistedConsultationResult
    ? createConsultationContext({
        customerId: record.customer_code,
        draftId: "",
        sessionCode: record.session_code || currentSessionCode
      })
    : null;
  savedConsultationSignature = persistedConsultationResult
    ? getConsultationSignature({
        ...persistedConsultationResult,
        savedAt: "pending"
      })
    : "";
  consultationSaveError = "";

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
    latestResultContext = createConsultationContext({
      customerId: record.customer_code,
      draftId: "",
      sessionCode: record.session_code || currentSessionCode
    });
    latestRecommendationContext = latestResultContext;
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
    latestRecommendations = persistedConsultationResult
      ? [
          persistedConsultationResult.primaryFrameRecommendation,
          ...(persistedConsultationResult.alternativeFrameRecommendations || [])
        ].filter(Boolean)
      : [];
    latestRecommendationContext = null;
    latestLensRecommendations = persistedConsultationResult?.lensRecommendations || [];
    latestResultContext = persistedConsultationResult
      ? createConsultationContext({
          customerId: record.customer_code,
          draftId: "",
          sessionCode: record.session_code || currentSessionCode
        })
      : null;
    latestRecommendationContext = null;
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

  operationDraftId = createOperationDraftId();
  operationDraftCreatedAt = new Date().toISOString();
  operationCustomerId = record.customer_code;
  operationDraftSource = "existing";
  lastCustomerSavedAt = record.updated_at || null;
  lastDraftSavedAt = null;
  operationSaveState = "idle";
  syncCurrentCustomer("customerSelected", record);
  lastOperationBusinessBaseline = getCurrentOperationBusinessState();
  suppressOperationDraftTracking = false;
  renderCustomerSessionHeader();
  statusText.textContent = "Đã mở hồ sơ";
  isLoadingCustomer = false;
  return true;
}

function showTab(tabId) {
  if (!suppressOperationDraftTracking) {
    flushOperationDraftSave("before-tab-change");
  }
  tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === tabId);
  });
  if (!suppressOperationDraftTracking) {
    scheduleOperationDraftSave("tab-change");
  }
  updateWorkflowAssistant();
  renderCustomerSessionHeader();
}

function getActiveTabId() {
  return [...tabPanels].find((panel) => panel.classList.contains("active"))?.id || "tab-0";
}

function getCurrentWorkflowStep() {
  return normalizeWorkflowStep(getActiveTabId());
}

function getCurrentVisionAnalysisState() {
  if (isAnalyzingFace) return "analyzing";
  if (manualConsultationMode) return "manual_mode";
  if (latestAnalysis && confirmedFaceShape) return "analysis_complete";
  if (latestAnalysis) return "low_quality";
  if (latestImageDebug.imageDecodeStatus === "analyzed") return "analysis_complete";
  if (latestImageDebug.imageDecodeStatus === "loaded") return "image_ready";
  if (latestImageDebug.imageDecodeStatus === "error" || latestImageDebug.imageDecodeStatus === "decode_error") return "analysis_error";
  if (video?.srcObject) return "camera_ready";
  return visionExperienceState || "idle";
}

function getProfileValidation(options = {}) {
  const includeDuplicateBlock = options.includeDuplicateBlock !== false;
  const duplicateBlocked = includeDuplicateBlock
    && Boolean((duplicatePhoneMatches.length ? duplicatePhoneMatches : getDuplicateMatchesForCurrentPhone()).length)
    && !allowDuplicateCustomerSaveOnce;
  return validateProfileState({
    customerName: customerNameInput.value,
    customerPhone: customerPhoneInput.value,
    hasPrescription: hasPrescriptionInput.checked,
    prescriptionPd: prescriptionPdInput.value,
    prescriptionSph: prescriptionSphInput.value,
    prescriptionCyl: prescriptionCylInput.value,
    duplicateBlocked
  });
}

function getNeedsValidation() {
  return validateNeedsState({
    budget: budgetInput.value,
    purpose: purposeInput.value,
    framePreference: framePreferenceInput.value
  });
}

function buildWorkflowContext() {
  const visionState = getCurrentVisionAnalysisState();
  return {
    currentStep: getCurrentWorkflowStep(),
    hasProfileData: Boolean(customerNameInput.value.trim() || customerPhoneInput.value.trim()),
    hasNeedsData: Boolean(purposeInput.value || budgetInput.value || customerNotesInput.value.trim() || hasPrescriptionInput.checked),
    profileValidation: getProfileValidation(),
    needsValidation: getNeedsValidation(),
    confirmedFaceShape,
    draftFaceShape: getDraftFaceShapeForAdvice(),
    manualConsultationMode,
    analysisState: visionState,
    imageAnalysisState: latestImageDebug.imageDecodeStatus === "analyzed" ? "analysis_complete" : visionState,
    cameraActive: Boolean(video?.srcObject && !video.hidden),
    consultationComplete: ["measured", "closed"].includes(customerStatusInput.value),
    actionInFlight: workflowNavigationInFlight || saveCustomerInFlight || isAnalyzingFace || Boolean(cameraRequestInFlight)
  };
}

function clearInlineValidationErrors() {
  document.querySelectorAll(".field-error").forEach((element) => element.remove());
  document.querySelectorAll("[aria-invalid='true']").forEach((element) => {
    element.removeAttribute("aria-invalid");
    element.removeAttribute("aria-describedby");
  });
}

function showInlineValidationErrors(validation) {
  clearInlineValidationErrors();
  const firstError = getFirstValidationError(validation);
  (validation?.errors || []).forEach((error) => {
    const field = document.getElementById(error.field);
    if (!field) return;
    const errorId = `${error.field}Error`;
    const message = document.createElement("p");
    message.id = errorId;
    message.className = "field-error";
    message.setAttribute("role", "alert");
    message.textContent = error.message;
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", errorId);
    field.insertAdjacentElement("afterend", message);
  });

  if (firstError) {
    const field = document.getElementById(firstError.field);
    field?.focus?.();
    statusText.textContent = firstError.message;
  }
}

function setWorkflowActionLock(locked) {
  workflowNavigationInFlight = locked;
  [workflowNextButton, mobileSaveButton, mobileScanButton, mobileConsultButton].forEach((button) => {
    if (button) button.classList.toggle("is-loading", locked);
  });
}

function saveCurrentCustomerWithLock() {
  if (saveCustomerInFlight) {
    return null;
  }
  saveCustomerInFlight = true;
  saveCustomerButton.disabled = true;
  try {
    const validation = validateProfileSaveState({
      customerName: customerNameInput.value,
      customerPhone: customerPhoneInput.value,
      hasPrescription: hasPrescriptionInput.checked,
      prescriptionPd: prescriptionPdInput.value,
      prescriptionSph: prescriptionSphInput.value,
      prescriptionCyl: prescriptionCylInput.value
    });
    if (!validation.valid) {
      showInlineValidationErrors(validation);
      return null;
    }
    clearInlineValidationErrors();
    return saveCurrentCustomer();
  } finally {
    saveCustomerInFlight = false;
    saveCustomerButton.disabled = false;
    updateWorkflowAssistant();
  }
}

function renderVisionFallbackActions(state, message = "") {
  if (!visionFallbackActions) return;

  const fallbackStates = new Set([
    "camera_unavailable",
    "permission_denied",
    "analysis_error",
    "no_face",
    "low_quality"
  ]);

  if (!fallbackStates.has(state)) {
    visionFallbackActions.hidden = true;
    visionFallbackActions.innerHTML = "";
    return;
  }

  visionFallbackActions.hidden = false;
  visionFallbackActions.innerHTML = `
    <strong>${escapeHtml(message || "VisionID ch\u01b0a \u0111\u1ee7 d\u1eef li\u1ec7u \u0111\u1ec3 t\u01b0 v\u1ea5n.")}</strong>
    <div class="vision-fallback-buttons">
      <button type="button" data-vision-fallback-action="retry-camera">Th\u1eed l\u1ea1i camera</button>
      <button type="button" data-vision-fallback-action="upload-image" class="secondary-action">T\u1ea3i \u1ea3nh</button>
      <button type="button" data-vision-fallback-action="manual-consult" class="secondary-action">T\u01b0 v\u1ea5n th\u1ee7 c\u00f4ng</button>
    </div>
  `;
}

function setVisionExperienceState(state, options = {}) {
  visionExperienceState = state;
  renderVisionFallbackActions(state, options.message || "");
  updateWorkflowAssistant();
}

async function requestWorkflowNavigation(targetStep, source = "unknown", options = {}) {
  const normalizedTarget = normalizeWorkflowStep(targetStep);
  if (workflowNavigationInFlight && !options.skipLock) {
    return false;
  }

  setWorkflowActionLock(true);
  try {
    flushOperationDraftSave(`workflow-${source}`);
    const context = buildWorkflowContext();
    const targetOrder = Object.keys(STEP_TO_TAB_ID);
    const movingForward = targetOrder.indexOf(normalizedTarget) > targetOrder.indexOf(context.currentStep);

    if (movingForward || normalizedTarget !== "profile") {
      const gate = canEnterStep(normalizedTarget, context);
      if (!gate.allowed) {
        showInlineValidationErrors(gate.validation || { valid: false, errors: [] });
        if (gate.reason === "CONSULTATION_SOURCE_REQUIRED") {
          setVisionExperienceState("low_quality", { message: "C\u1ea7n VisionID ho\u00e0n t\u1ea5t ho\u1eb7c x\u00e1c nh\u1eadn t\u01b0 v\u1ea5n th\u1ee7 c\u00f4ng tr\u01b0\u1edbc khi sang T\u01b0 v\u1ea5n." });
        }
        updateWorkflowAssistant();
        return false;
      }
    }

    if (movingForward && context.currentStep === "profile") {
      const saved = saveCurrentCustomerWithLock();
      if (!saved) return false;
    }

    if (movingForward && context.currentStep === "needs") {
      syncCurrentCustomer("customerUpdated");
      updateAdvice();
    }

    showTab(STEP_TO_TAB_ID[normalizedTarget] || "tab-0");
    return true;
  } finally {
    setWorkflowActionLock(false);
  }
}

function getWorkflowState() {
  const context = buildWorkflowContext();
  const action = getNextWorkflowAction(context);
  const activeStep = getCurrentWorkflowStep();
  const source = getConsultationSource(context);
  const stepLabels = {
    profile: context.profileValidation.valid ? "B\u01b0\u1edbc 1 \u00b7 H\u1ed3 s\u01a1" : "B\u01b0\u1edbc 1 \u00b7 C\u1ea7n ho\u00e0n thi\u1ec7n h\u1ed3 s\u01a1",
    needs: context.needsValidation.valid ? "B\u01b0\u1edbc 2 \u00b7 Nhu c\u1ea7u" : "B\u01b0\u1edbc 2 \u00b7 C\u1ea7n ho\u00e0n thi\u1ec7n nhu c\u1ea7u",
    visionid: source.valid ? source.label : "B\u01b0\u1edbc 3 \u00b7 VisionID",
    consultation: source.valid ? "B\u01b0\u1edbc 4 \u00b7 T\u01b0 v\u1ea5n" : "T\u01b0 v\u1ea5n \u0111ang b\u1ecb kh\u00f3a"
  };

  return {
    step: stepLabels[activeStep] || "Quy tr\u00ecnh t\u01b0 v\u1ea5n",
    next: action.title,
    action: action.label,
    tone: action.tone || "neutral"
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
  workflowNextButton.disabled = Boolean(buildWorkflowContext().actionInFlight);
  updateProcessStepper();
  updateMobileActionBar();
}

function updateProcessStepper() {
  const context = buildWorkflowContext();
  const states = getWorkflowStepState(context);
  const labels = {
    complete: "\u0110\u00e3 xong",
    current: "\u0110ang l\u00e0m",
    available: "C\u00f3 th\u1ec3 m\u1edf",
    locked: "Ch\u1edd"
  };

  tabButtons.forEach((button) => {
    const target = button.dataset.tabTarget;
    const step = normalizeWorkflowStep(target);
    const state = states[step] || { status: "locked", locked: true };
    const isWarning = step === "visionid" && Boolean(context.draftFaceShape) && !getConsultationSource(context).valid;
    button.classList.toggle("is-complete", state.status === "complete");
    button.classList.toggle("is-warning", isWarning);
    button.classList.toggle("is-locked", state.locked);
    button.setAttribute("aria-disabled", state.locked ? "true" : "false");
    button.dataset.statusLabel = labels[state.status] || "Ch?";
  });
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
  if (activeTabId !== "tab-4") {
    mobileConsultButton.textContent = "Tư vấn";
  }
  mobileConsultButton.disabled = !getConsultationSource(buildWorkflowContext()).valid;
}

async function handleWorkflowNext() {
  const action = getNextWorkflowAction(buildWorkflowContext());
  if (action.action === "navigate") {
    await requestWorkflowNavigation(action.targetStep, "workflow-next");
    return;
  }

  if (action.action === "confirm_face_shape") {
    if (getDraftFaceShapeForAdvice() && confirmedFaceShapeInput) {
      confirmedFaceShapeInput.disabled = false;
      confirmedFaceShapeInput.focus();
      statusText.textContent = "Ch?n d?ng m?t x?c nh?n";
      updateWorkflowAssistant();
    }
    return;
  }

  if (action.action === "start_camera") {
    if (!video?.srcObject) {
      await enableCamera();
    }
    updateWorkflowAssistant();
    return;
  }

  if (action.action === "restart_scan") {
    startAutoScanFlow("workflow-restart");
    updateWorkflowAssistant();
    return;
  }

  if (action.action === "complete_consultation") {
    markCustomerAsMeasuredSafely();
  }
}

function readPreferences() {
  const prescriptionLevel = derivePrescriptionLevel();
  prescriptionLevelInput.value = prescriptionLevel;
  const prescription = readPrescriptionData();
  return {
    budget: budgetInput.value,
    purpose: purposeInput.value,
    prescription_level: prescriptionLevel,
    prescription,
    frame_width_mm: parseOptionalNumber(frameWidthMmInput.value),
    lens_width_mm: parseOptionalNumber(lensWidthMmInput.value),
    bridge_width_mm: parseOptionalNumber(bridgeWidthMmInput.value),
    notes: customerNotesInput.value.trim(),
    frame_preference: framePreferenceInput.value,
    brands: [...preferenceForm.querySelectorAll('input[name="brands"]:checked')].map(
      (input) => input.value
    )
  };
}

function readCustomerSnapshot() {
  const snapshot = {
    customer_code: customerCodeInput.value || "",
    customer_name: customerNameInput.value.trim() || "",
    customer_phone: customerPhoneInput.value.trim() || "",
    consult_date: consultDateInput.value || todayInputValue(),
    age_group: ageGroupInput.value || "",
    customer_notes: customerNotesInput.value.trim() || "",
    customer_status: customerStatusInput.value || "waiting",
    session_code: ensureCurrentSessionCode(),
    frame_width_mm: parseOptionalNumber(frameWidthMmInput.value),
    lens_width_mm: parseOptionalNumber(lensWidthMmInput.value),
    bridge_width_mm: parseOptionalNumber(bridgeWidthMmInput.value),
    has_prescription: hasPrescriptionInput.checked,
    prescription: readPrescriptionData(),
    preferences: readPreferences(),
    analysis: getPersistableVisionAnalysis(),
    faceShape_ai: latestAiFaceShape || latestAnalysis?.faceShape_ai || latestAnalysis?.shape || "",
    faceShape_confirmed: confirmedFaceShape || latestAnalysis?.faceShape_confirmed || "",
    consultation_mode: manualConsultationMode ? "manual" : "visionid",
    recommendations: latestRecommendations,
    lens_recommendations: latestLensRecommendations,
    consultation_result: persistedConsultationResult,
    consultation_saved_at: persistedConsultationResult?.savedAt || "",
    consultation_source: persistedConsultationResult?.consultationSource || ""
  };

  return hasVisionAnalysisConsent() ? snapshot : purgeStoredVisionAnalysis(snapshot);
}

function buildOperationDraftFromForm(overrides = {}) {
  return createOperationDraft({
    draftId: operationDraftId,
    customerId: operationCustomerId,
    sessionCode: ensureCurrentSessionCode(),
    source: operationDraftSource,
    currentStep: tabIdToOperationStep(getActiveTabId()),
    customer: {
      name: customerNameInput.value,
      phone: customerPhoneInput.value,
      consultDate: consultDateInput.value,
      ageGroup: ageGroupInput.value,
      status: customerStatusInput.value,
      notes: customerNotesInput.value,
      frameWidthMm: frameWidthMmInput.value,
      lensWidthMm: lensWidthMmInput.value,
      bridgeWidthMm: bridgeWidthMmInput.value,
      hasPrescription: hasPrescriptionInput.checked,
      prescription: {
        pd: prescriptionPdInput.value,
        sph: prescriptionSphInput.value,
        cyl: prescriptionCylInput.value
      }
    },
    needs: {
      budget: budgetInput.value,
      purpose: purposeInput.value,
      prescriptionLevel: prescriptionLevelInput.value || derivePrescriptionLevel(),
      framePreference: framePreferenceInput.value,
      brands: [...preferenceForm.querySelectorAll('input[name="brands"]:checked')].map((input) => input.value)
    },
    consultation: {
      manualMode: manualConsultationMode
    },
    consent: {
      analysisPersistenceAllowed: hasVisionAnalysisConsent()
    },
    createdAt: operationDraftCreatedAt,
    lastSavedCustomerAt: lastCustomerSavedAt,
    ...overrides
  });
}

function getCurrentOperationBusinessState() {
  return normalizeOperationBusinessState(buildOperationDraftFromForm());
}

function setOperationBaselineFromCurrent() {
  lastOperationBusinessBaseline = getCurrentOperationBusinessState();
  renderCustomerSessionHeader();
}

function hasUnsavedOperationChanges() {
  const currentState = getCurrentOperationBusinessState();
  return hasBusinessStateChanged(currentState, lastOperationBusinessBaseline);
}

function setOperationSaveState(state, options = {}) {
  operationSaveState = state;
  if (options.draftSavedAt) {
    lastDraftSavedAt = options.draftSavedAt;
  }
  if (options.customerSavedAt) {
    lastCustomerSavedAt = options.customerSavedAt;
  }
  renderCustomerSessionHeader();
}

function scheduleOperationDraftSave(reason = "change") {
  if (suppressOperationDraftTracking) {
    return;
  }

  if (operationCompletedContext && !isCurrentCompletedOperationContext()) {
    operationCompletedContext = null;
  }

  if (operationCompletedContext) {
    if (!hasUnsavedOperationChanges()) {
      updateCameraDebug({ operationDraftSaveSkipped: "completed-operation", operationDraftSaveScheduled: reason });
      return;
    }
    startNewDraftAfterCompletedOperation();
  }

  const draft = buildOperationDraftFromForm();
  if (!isMeaningfulOperationDraft(draft)) {
    renderCustomerSessionHeader();
    return;
  }

  if (hasUnsavedOperationChanges()) {
    setOperationSaveState("dirty");
  }
  operationDraftSaver.schedule();
  updateCameraDebug({ operationDraftSaveScheduled: reason });
}

function flushOperationDraftSave(reason = "manual") {
  if (suppressOperationDraftTracking) {
    return { ok: false, reason: "SUPPRESSED" };
  }

  if (operationCompletedContext && !isCurrentCompletedOperationContext()) {
    operationCompletedContext = null;
  }

  if (operationCompletedContext) {
    if (!hasUnsavedOperationChanges()) {
      updateCameraDebug({ operationDraftLastFlush: reason, operationDraftSaved: false, operationDraftSkipReason: "completed-operation" });
      return { ok: false, reason: "COMPLETED_OPERATION" };
    }
    startNewDraftAfterCompletedOperation();
  }

  const draft = buildOperationDraftFromForm();
  if (!isMeaningfulOperationDraft(draft)) {
    renderCustomerSessionHeader();
    return { ok: false, reason: "EMPTY_DRAFT" };
  }

  setOperationSaveState("saving");
  const result = writeOperationDraft(draft);
  if (result.ok) {
    operationDraftId = result.draft.draftId;
    operationDraftCreatedAt = result.draft.createdAt;
    lastDraftSavedAt = result.draft.updatedAt;
    lastOperationBusinessBaseline = normalizeOperationBusinessState(result.draft);
    setOperationSaveState("draft-saved", { draftSavedAt: result.draft.updatedAt });
  } else {
    setOperationSaveState("error");
  }
  updateCameraDebug({ operationDraftLastFlush: reason, operationDraftSaved: Boolean(result.ok) });
  return result;
}

function renderCustomerSessionHeader() {
  if (!currentCustomerSession) {
    return;
  }

  const name = customerNameInput.value.trim() || "Khach moi chua dat ten";
  const phone = customerPhoneInput.value.trim() || "Chua co so dien thoai";
  const stepLabel = {
    profile: "Ho so",
    needs: "Nhu cau",
    visionid: "VisionID",
    consultation: "Tu van"
  }[tabIdToOperationStep(getActiveTabId())] || "Ho so";

  if (currentCustomerNameLabel) currentCustomerNameLabel.textContent = name;
  if (currentCustomerPhoneLabel) currentCustomerPhoneLabel.textContent = phone;
  if (currentCustomerStepLabel) currentCustomerStepLabel.textContent = stepLabel;
  if (currentCustomerSourceLabel) {
    currentCustomerSourceLabel.textContent = getCurrentDetailedConsultationSource().valid
      ? getCurrentDetailedConsultationSource().label
      : (operationCustomerId ? "Ho so da luu" : "Phien moi");
  }
  if (currentCustomerSaveStateLabel) {
    const label = getActiveTabId() === "tab-4" ? getCurrentConsultationSaveState() : getOperationSaveStateLabel();
    currentCustomerSaveStateLabel.textContent = label.text || label.label;
    currentCustomerSaveStateLabel.dataset.state = label.state;
  }
}

function getOperationSaveStateLabel() {
  if (operationSaveState === "dirty") {
    return { state: "dirty", text: "Co thay doi chua luu" };
  }
  if (operationSaveState === "saving") {
    return { state: "saving", text: "Dang luu ban nhap..." };
  }
  if (operationSaveState === "draft-saved" && lastDraftSavedAt) {
    return { state: "draft-saved", text: `Da luu ban nhap luc ${formatTime(lastDraftSavedAt)}` };
  }
  if (operationSaveState === "customer-saved" && lastCustomerSavedAt) {
    return { state: "customer-saved", text: `Ho so da luu luc ${formatTime(lastCustomerSavedAt)}` };
  }
  if (operationSaveState === "error") {
    return { state: "error", text: "Khong the luu ban nhap" };
  }
  return { state: "idle", text: "Chua co thay doi" };
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function hydrateOperationDraft(draft) {
  const normalized = normalizeOperationDraft(draft);
  if (!normalized) {
    return;
  }
  operationCompletedContext = null;
  suppressOperationDraftTracking = true;
  clearUploadedImagePreview({ revoke: true, clearOverlay: true, reason: "resume-draft" });
  operationDraftId = normalized.draftId;
  operationDraftCreatedAt = normalized.createdAt;
  operationCustomerId = normalized.customerId;
  operationDraftSource = normalized.source;
  lastCustomerSavedAt = normalized.lastSavedCustomerAt;
  lastDraftSavedAt = normalized.updatedAt;
  currentSessionCode = normalized.sessionCode || createSessionCode();
  ensureCurrentSessionCode();
  customerCodeInput.value = normalized.customerId || createCustomerCode();
  customerNameInput.value = normalized.customer.name;
  customerPhoneInput.value = normalized.customer.phone;
  consultDateInput.value = normalized.customer.consultDate || todayInputValue();
  ageGroupInput.value = normalized.customer.ageGroup;
  customerNotesInput.value = normalized.customer.notes;
  frameWidthMmInput.value = normalized.customer.frameWidthMm;
  lensWidthMmInput.value = normalized.customer.lensWidthMm;
  bridgeWidthMmInput.value = normalized.customer.bridgeWidthMm;
  customerStatusInput.value = normalized.customer.status || "waiting";
  hasPrescriptionInput.checked = normalized.customer.hasPrescription;
  setPrescriptionSectionVisible(hasPrescriptionInput.checked);
  prescriptionPdInput.value = normalized.customer.prescription.pd;
  prescriptionSphInput.value = normalized.customer.prescription.sph;
  prescriptionCylInput.value = normalized.customer.prescription.cyl;
  budgetInput.value = normalized.needs.budget;
  purposeInput.value = normalized.needs.purpose;
  prescriptionLevelInput.value = normalized.needs.prescriptionLevel;
  framePreferenceInput.value = normalized.needs.framePreference;
  preferenceForm.querySelectorAll('input[name="brands"]').forEach((input) => {
    input.checked = normalized.needs.brands.length ? normalized.needs.brands.includes(input.value) : input.checked;
  });
  manualConsultationMode = normalized.consultation.manualMode;
  analysisHistory = [];
  latestAnalysis = null;
  latestAiFaceShape = "";
  confirmedFaceShape = "";
  confirmedFaceShapeSource = "";
  latestRecommendations = [];
  latestLensRecommendations = [];
  resetAdviceState();
  renderConfidenceNotice(null, { level: "low", percent: 0 }, false, "Da khoi phuc ban nhap. Hay quet lai VisionID neu can.");
  renderCustomerResult();
  updateAdvice();
  showTab(operationStepToTabId(normalized.currentStep));
  syncCurrentCustomer("customerSelected");
  lastOperationBusinessBaseline = normalizeOperationBusinessState(normalized);
  operationSaveState = "draft-saved";
  suppressOperationDraftTracking = false;
  renderCustomerSessionHeader();
}

function startNewOperationSession({ clearDraft = false } = {}) {
  operationDraftSaver.cancel();
  suppressOperationDraftTracking = true;
  operationCompletedContext = null;
  startNewCustomer();
  operationDraftId = createOperationDraftId();
  operationDraftCreatedAt = new Date().toISOString();
  operationCustomerId = null;
  operationDraftSource = "new";
  lastDraftSavedAt = null;
  lastCustomerSavedAt = null;
  operationSaveState = "idle";
  if (clearDraft) {
    clearOperationDraft();
  }
  lastOperationBusinessBaseline = getCurrentOperationBusinessState();
  suppressOperationDraftTracking = false;
  renderCustomerSessionHeader();
}

function requestCustomerContextChange(action) {
  const currentDraft = buildOperationDraftFromForm();
  const shouldGuard = isMeaningfulOperationDraft(currentDraft)
    && (hasUnsavedOperationChanges() || operationSaveState === "draft-saved" || operationSaveState === "dirty");
  if (!shouldGuard) {
    action();
    return;
  }

  pendingContextChangeAction = action;
  showContextChangeDialog();
}

function showContextChangeDialog() {
  if (!contextChangeDialog || !contextChangeDialogPanel) {
    flushOperationDraftSave("context-change-fallback");
    pendingContextChangeAction?.();
    pendingContextChangeAction = null;
    return;
  }

  modalReturnFocusElement = document.activeElement;
  if (contextChangeDialogSummary) {
    contextChangeDialogSummary.textContent = "Ban co thay doi chua luu trong phien hien tai. Luu ban nhap de tiep tuc sau, hoac bo thay doi neu khong can giu.";
  }
  contextChangeDialog.hidden = false;
  trapDialogFocus(contextChangeDialog, contextChangeDialogPanel);
}

function closeContextChangeDialog({ restoreFocus = true } = {}) {
  if (contextChangeDialog) {
    contextChangeDialog.hidden = true;
  }
  releaseDialogFocus();
  if (restoreFocus) {
    modalReturnFocusElement?.focus?.();
  }
  modalReturnFocusElement = null;
}

function requestOpenCustomer(customerId, source = "customer-list", intent = "") {
  if (!customerId) {
    return;
  }
  requestCustomerContextChange(() => {
    loadCustomerRecord(customerId);
    operationDraftSource = "existing";
    if (intent === "result_saved") {
      showTab("tab-4");
    } else if (intent === "consulting") {
      showTab("tab-1");
    } else {
      showTab("tab-0");
    }
    renderCustomerSessionHeader();
    updateCameraDebug({ customerOpenSource: source });
  });
}

function startNewFromSearchQuery(query) {
  const prefill = createCustomerPrefillFromQuery(query);
  requestCustomerContextChange(() => {
    startNewOperationSession({ clearDraft: true });
    if (prefill.customerName) {
      customerNameInput.value = prefill.customerName;
    }
    if (prefill.customerPhone) {
      customerPhoneInput.value = prefill.customerPhone;
      checkPhoneDuplicate();
    }
    syncCurrentCustomer("customerUpdated");
    renderCustomerSessionHeader();
  });
}

function showDuplicateSaveDialog(matches = []) {
  duplicatePhoneMatches = matches;
  if (!duplicateCustomerDialog || !duplicateCustomerDialogPanel) {
    renderPhoneDuplicateNotice(matches);
    statusText.textContent = "Đã tồn tại hồ sơ có số điện thoại này.";
    return;
  }

  modalReturnFocusElement = document.activeElement;
  if (duplicateCustomerDialogSummary) {
    const firstMatch = matches[0];
    duplicateCustomerDialogSummary.textContent = matches.length > 1
      ? `Có ${matches.length} hồ sơ dùng số này. Vui lòng chọn rõ hồ sơ cần mở hoặc xác nhận tạo hồ sơ riêng.`
      : `${firstMatch?.customer_name || "Khách đã lưu"} đang dùng số ${firstMatch?.customer_phone || customerPhoneInput.value}.`;
  }
  if (duplicateCustomerDialogMatches) {
    duplicateCustomerDialogMatches.innerHTML = matches.slice(0, 4).map(renderDuplicateMatchCard).join("");
  }
  if (openExistingDuplicateButton) {
    openExistingDuplicateButton.disabled = matches.length !== 1;
    openExistingDuplicateButton.textContent = matches.length === 1 ? "Mở hồ sơ đã có" : "Chọn một hồ sơ bên trên";
  }
  duplicateCustomerDialog.hidden = false;
  trapDialogFocus(duplicateCustomerDialog, duplicateCustomerDialogPanel);
}

function closeDuplicateSaveDialog({ restoreFocus = true } = {}) {
  if (duplicateCustomerDialog) {
    duplicateCustomerDialog.hidden = true;
  }
  releaseDialogFocus();
  if (restoreFocus) {
    modalReturnFocusElement?.focus?.();
  }
  modalReturnFocusElement = null;
}

function renderDuplicateMatchCard(record) {
  return `
    <div class="duplicate-match-card">
      <strong>${escapeHtml(record.customer_name || "Chưa nhập")}</strong>
      <span>${escapeHtml(record.customer_phone || "Chưa có SĐT")} - ${escapeHtml(statusLabel(record.customer_status))}</span>
      <span>${escapeHtml(record.customer_code)}</span>
      <button type="button" data-dialog-open-duplicate="${escapeHtml(record.customer_code)}">Mở hồ sơ này</button>
    </div>
  `;
}

function maybeShowResumeDraftDialog() {
  const draft = readOperationDraft();
  if (!draft || !isMeaningfulOperationDraft(draft)) {
    return;
  }

  const summary = getDraftResumeSummary(draft);
  if (!summary || !operationDraftDialog || !operationDraftDialogPanel) {
    return;
  }

  modalReturnFocusElement = document.activeElement;
  if (operationDraftDialogSummary) {
    const updatedAt = formatTime(summary.updatedAt);
    operationDraftDialogSummary.textContent = `${summary.name}${summary.phone ? ` - ${summary.phone}` : ""}. Buoc gan nhat: ${summary.step}. Cap nhat luc ${updatedAt}.`;
  }
  operationDraftDialog.hidden = false;
  trapDialogFocus(operationDraftDialog, operationDraftDialogPanel);
}

function closeResumeDraftDialog({ restoreFocus = true } = {}) {
  if (operationDraftDialog) {
    operationDraftDialog.hidden = true;
  }
  releaseDialogFocus();
  if (restoreFocus) {
    modalReturnFocusElement?.focus?.();
  }
  modalReturnFocusElement = null;
}

let activeDialogCleanup = null;

function trapDialogFocus(backdrop, panel) {
  releaseDialogFocus();
  const focusableSelector = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";
  const focusFirst = () => {
    const focusable = [...panel.querySelectorAll(focusableSelector)].filter((element) => !element.disabled);
    (focusable[0] || panel).focus();
  };
  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      if (backdrop === contextChangeDialog) {
        closeContextChangeDialog();
      } else if (backdrop === duplicateCustomerDialog) {
        closeDuplicateSaveDialog();
      } else {
        closeResumeDraftDialog();
      }
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const focusable = [...panel.querySelectorAll(focusableSelector)].filter((element) => !element.disabled);
    if (!focusable.length) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  backdrop.addEventListener("keydown", handleKeydown);
  activeDialogCleanup = () => backdrop.removeEventListener("keydown", handleKeydown);
  focusFirst();
}

function releaseDialogFocus() {
  activeDialogCleanup?.();
  activeDialogCleanup = null;
}

function syncCurrentCustomer(eventName, sourceRecord = null) {
  if (suppressCurrentCustomerSync) {
    return;
  }

  const customer = sourceRecord || readCustomerSnapshot();
  customer.session_code = customer.session_code || ensureCurrentSessionCode();
  setCurrentCustomer(customer, eventName);
  renderCurrentCustomerSummary(customer);
  renderCustomerSessionHeader();
  scheduleOperationDraftSave(eventName || "customer-sync");
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
      <div><strong>Lens / bridge</strong><span>${formatLensBridgeSummary(customer)}</span></div>
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
  prescriptionLevelInput.value = derivePrescriptionLevel();
  framePreferenceInput.value = preferences.frame_preference || "balanced";
  frameWidthMmInput.value = preferences.frame_width_mm ?? "";
  lensWidthMmInput.value = preferences.lens_width_mm ?? "";
  bridgeWidthMmInput.value = preferences.bridge_width_mm ?? "";
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

function formatLensBridgeSummary(customer = {}) {
  const lens = customer.lens_width_mm ?? customer.preferences?.lens_width_mm;
  const bridge = customer.bridge_width_mm ?? customer.preferences?.bridge_width_mm;
  if (!lens && !bridge) {
    return "--";
  }
  return `${lens || "?"}□${bridge || "?"}`;
}

function parseOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMm(value) {
  return Number(value || 0).toFixed(1).replace(".0", "");
}

function derivePrescriptionLevel() {
  if (!hasPrescriptionInput.checked) {
    return "unknown";
  }

  const prescription = readPrescriptionData();
  const sphere = Math.abs(Number(prescription.sph || 0));
  const cylinder = Math.abs(Number(prescription.cyl || 0));
  const totalPower = sphere + cylinder;

  if (totalPower >= 4) return "high";
  if (totalPower >= 2) return "medium";
  if (totalPower > 0) return "low";
  return "unknown";
}

function updateAdvice() {
  const preferences = readPreferences();
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
    latestRecommendationContext = null;
    frameList.innerHTML = `<p class="empty-state">Hoàn tất VisionID để lấy gợi ý kiểu gọng nên thử.</p>`;
    renderConsultationSummary();
    updateWorkflowAssistant();
    return;
  }

  latestRecommendations = manualConsultationMode && !adviceFaceShape
    ? getManualFrameRecommendations(preferences)
    : getFrameRecommendations(adviceFaceShape);
  latestRecommendationContext = latestResultContext || getCurrentConsultationContext();
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
          <span>Chiết suất ${lens.index} - ${budgetLabel(lens.budget)}${lens.priceVnd ? ` - ${formatLensPrice(lens)}` : ""}</span>
        </div>
      `
    )
    .join("");

  const warningItems = hasWarnings
    ? lensAdvice.warnings
        .map((warning) => `<div class="lens-preview-item warning">${warning}</div>`)
        .join("")
    : "";
  const fitSummary = lensAdvice.fit?.decentration
    ? `
      <div class="lens-preview-item">
        <strong>Fit PD / gọng</strong>
        <span>${lensAdvice.fit.decentrationLabel} · lệch tâm ${formatMm(lensAdvice.fit.decentration)}mm/tròng</span>
      </div>
    `
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
      ${fitSummary}
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

function renderConsultationActions() {
  const labels = getConsultationStatusText();
  const saveState = getCurrentConsultationSaveState();
  const source = getCurrentDetailedConsultationSource();
  const canSave = source.valid && Boolean(latestRecommendations.length) && !consultationSaveInFlight;

  if (consultationSourceBadge) consultationSourceBadge.textContent = labels.sourceLabel;
  if (consultationResultState) consultationResultState.textContent = labels.resultLabel;
  if (consultationSavedState) {
    consultationSavedState.textContent = labels.saveLabel;
    consultationSavedState.dataset.state = saveState.state;
  }
  if (consultationMeasuredState) consultationMeasuredState.textContent = labels.measuredLabel;
  if (consultationSaveStatus) {
    consultationSaveStatus.textContent = consultationSaveError || labels.limitation;
    consultationSaveStatus.setAttribute("role", consultationSaveError ? "alert" : "status");
  }
  if (saveConsultationButton) {
    saveConsultationButton.disabled = !canSave;
    saveConsultationButton.textContent = saveState.actionLabel;
    saveConsultationButton.setAttribute("aria-busy", consultationSaveInFlight ? "true" : "false");
  }
  if (startNextCustomerButton) {
    startNextCustomerButton.hidden = saveState.state !== "saved" && saveState.state !== "measured";
  }
  syncMarkMeasuredButtonState(saveState);
  if (consultationActionPanel) {
    consultationActionPanel.dataset.saveState = saveState.state;
  }
  updateMobileConsultationCta(saveState, canSave);
}

function updateMobileConsultationCta(saveState, canSave) {
  if (!mobileConsultButton || getActiveTabId() !== "tab-4") {
    return;
  }
  mobileConsultButton.textContent = canSave ? saveState.actionLabel : "Tư vấn";
  mobileConsultButton.disabled = !canSave && !getCurrentDetailedConsultationSource().valid;
}

function syncMarkMeasuredButtonState(saveState = null) {
  if (!markMeasuredButton) {
    return;
  }
  const state = saveState || getCurrentConsultationSaveState();
  markMeasuredButton.disabled = state.state !== "saved" && state.state !== "measured";
}

function renderConsultationSummary() {
  if (!consultationSummary) {
    return;
  }

  renderConsultationActions();
  const source = getCurrentDetailedConsultationSource();
  const presentation = getConsultationPresentation(
    source.valid ? latestRecommendations : [],
    source,
    { lensRecommendations: latestLensRecommendations }
  );
  const draftFaceShape = getDraftFaceShapeForAdvice();
  const summaryFaceShape = confirmedFaceShape || draftFaceShape || (latestAnalysis?.metrics ? "oval" : "");
  const isManualConsultation = manualConsultationMode && !summaryFaceShape;
  const isDraft = !confirmedFaceShape && Boolean(draftFaceShape);

  if (presentation.empty || (!summaryFaceShape && !isManualConsultation)) {
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
    lensWidthMm: customer.lens_width_mm,
    bridgeWidthMm: customer.bridge_width_mm,
    prescription: customer.prescription || {},
    preference: preferences.frame_preference
  });
  const topFrames = ([presentation.primary, ...presentation.alternatives].filter(Boolean).length
    ? [presentation.primary, ...presentation.alternatives].filter(Boolean)
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
    <div class="consult-command-strip">
      <div>
        <span>Chế độ tư vấn</span>
        <strong>${isManualConsultation ? "Thủ công tại quầy" : (isDraft ? "VisionID nháp" : "VisionID đã chốt")}</strong>
      </div>
      <div>
        <span>Tròng ưu tiên</span>
        <strong>${lensLine}</strong>
      </div>
      <div>
        <span>Việc cần làm</span>
        <strong>Thử 3 form · Chọn tròng · Lưu góp ý</strong>
      </div>
    </div>
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
              ${renderFrameReferenceVisual(frame.name, index)}
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
  const includeVisionAnalysis = hasVisionAnalysisConsent();

  return {
    id: `FB-${Date.now()}`,
    type: feedbackTypeInput?.value || "other",
    notes: feedbackNotesInput?.value.trim() || "",
    customer_code: customerCodeInput.value || "",
    session_code: currentSessionCode || "",
    faceShape_ai: latestAiFaceShape || latestAnalysis?.faceShape_ai || latestAnalysis?.shape || "",
    faceShape_confirmed: confirmedFaceShape || latestAnalysis?.faceShape_confirmed || "",
    consultation_mode: manualConsultationMode ? "manual" : "visionid",
    ...buildConsentScopedVisionFeedback({
      includeVisionAnalysis,
      latestAnalysis,
      confidenceState,
      diagnostics,
      classification,
      qualityGate
    }),
    preferences: {
      ...readPreferences(),
      age_group: ageGroupInput.value || "",
      frame_width_mm: parseOptionalNumber(frameWidthMmInput.value),
      lens_width_mm: parseOptionalNumber(lensWidthMmInput.value),
      bridge_width_mm: parseOptionalNumber(bridgeWidthMmInput.value),
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
    lensWidthMm: customer.lens_width_mm,
    bridgeWidthMm: customer.bridge_width_mm,
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
  clearUploadedImagePreview({ revoke: true, clearOverlay: true, reason: "reset-advice" });
  resetVolatileConsultationState({ keepPersisted: true });
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

function markCustomerAsMeasuredSafely() {
  const record = findCurrentCustomerRecord();
  if (!record) {
    statusText.textContent = "Can luu ho so khach truoc khi danh dau da do";
    return;
  }

  const source = getCurrentDetailedConsultationSource();
  if (!source.valid && !record.consultation_result) {
    statusText.textContent = "Can co ket qua tu van hoac tu van thu cong truoc khi danh dau da do";
    return;
  }

  customerStatusInput.value = "measured";
  const updatedRecord = saveCustomer({
    ...record,
    ...readCustomerSnapshot(),
    customer_code: record.customer_code,
    customer_status: "measured",
    consultation_result: record.consultation_result || persistedConsultationResult,
    consultation_saved_at: record.consultation_saved_at || persistedConsultationResult?.savedAt || "",
    consultation_source: record.consultation_source || persistedConsultationResult?.consultationSource || ""
  });
  persistedConsultationResult = updatedRecord.consultation_result || persistedConsultationResult;
  persistedConsultationContext = persistedConsultationResult ? getCurrentConsultationContext() : persistedConsultationContext;
  renderCustomers();
  renderConsultationActions();
  const measuredAt = updatedRecord.updated_at || new Date().toISOString();
  setCompletedOperationContext(buildOperationDraftFromForm({ completedAt: measuredAt }), measuredAt);
  const wasSuppressingDraftTracking = suppressOperationDraftTracking;
  suppressOperationDraftTracking = true;
  syncCurrentCustomer("customerUpdated", updatedRecord);
  suppressOperationDraftTracking = wasSuppressingDraftTracking;
  operationDraftSaver.cancel();
  clearOperationDraft();
  setOperationBaselineFromCurrent();
  statusText.textContent = "Da chuyen sang trang thai da do";
  showTab("tab-4");
  operationDraftSaver.cancel();
  clearOperationDraft();
  setOperationBaselineFromCurrent();
  updateWorkflowAssistant();
}

function openManualConsultationDialog(trigger = null) {
  if (!manualConsultationDialog || !manualConsultationDialogPanel) {
    enableManualConsultation();
    return;
  }
  manualConsultationDialogTrigger = trigger || document.activeElement;
  manualConsultationDialog.hidden = false;
  manualConsultationDialogPanel.focus();
}

function closeManualConsultationDialog({ restoreFocus = true } = {}) {
  if (!manualConsultationDialog) return;
  manualConsultationDialog.hidden = true;
  if (restoreFocus) {
    manualConsultationDialogTrigger?.focus?.();
  }
  manualConsultationDialogTrigger = null;
}

function enableManualConsultation() {
  manualConsultationMode = true;
  latestAnalysis = null;
  latestAiFaceShape = "";
  confirmedFaceShape = "";
  confirmedFaceShapeSource = "";
  stampCurrentResultContext();
  statusText.textContent = "\u0110ang t\u01b0 v\u1ea5n th\u1ee7 c\u00f4ng";
  faceShapeText.textContent = "T\u01b0 v\u1ea5n th\u1ee7 c\u00f4ng";
  if (confirmedFaceShapeInput) {
    confirmedFaceShapeInput.value = "";
    confirmedFaceShapeInput.disabled = true;
  }
  syncMarkMeasuredButtonState();
  renderConfidenceNotice(null, { level: "medium", percent: 0 }, false, "\u0110\u00e3 b\u1ecf qua VisionID. H\u00e3y th\u1eed g\u1ecdng th\u1eadt v\u00e0 l\u01b0u g\u00f3p \u00fd sau t\u01b0 v\u1ea5n.");
  renderCustomerResult();
  updateAdvice();
  syncCurrentCustomer("manualConsultation");
  setVisionExperienceState("manual_mode");
  requestWorkflowNavigation("consultation", "manual-consultation", { skipLock: true });
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

function formatLensPrice(lens = {}) {
  const price = Number(lens.priceVnd || 0);
  if (!price) {
    return "";
  }

  return `Giá ${price.toLocaleString("vi-VN")}đ`;
}

function formatLensCatalogDetail(lens = {}) {
  const details = [];
  if (lens.rxRange) details.push(`Dải độ ${lens.rxRange}`);
  if (lens.diameter) details.push(`Phi ${lens.diameter}`);
  if (lens.mComp) details.push(`M.Comp ${lens.mComp}`);
  if (lens.priceSource) details.push(lens.priceSource);
  return details.join(" · ");
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

function schedulePhoneLookup() {
  window.clearTimeout(phoneLookupTimer);
  phoneLookupTimer = window.setTimeout(checkPhoneDuplicate, 250);
}

function checkPhoneDuplicate() {
  if (isLoadingCustomer) {
    return;
  }

  duplicatePhoneMatches = getDuplicateMatchesForCurrentPhone();
  renderPhoneDuplicateNotice(duplicatePhoneMatches);
}

function getDuplicateMatchesForCurrentPhone() {
  const phone = customerPhoneInput.value;
  if (!isPhoneLikeQuery(phone)) {
    return [];
  }

  return findExactPhoneMatches(loadCustomers(), phone, {
    excludeCustomerId: operationCustomerId || customerCodeInput.value
  });
}

function renderPhoneDuplicateNotice(matches = []) {
  if (!phoneDuplicateNotice) {
    return;
  }

  if (!matches.length) {
    phoneDuplicateNotice.hidden = true;
    phoneDuplicateNotice.innerHTML = "";
    return;
  }

  const [firstMatch] = matches;
  const moreText = matches.length > 1 ? ` Có ${matches.length} hồ sơ dùng số này, vui lòng chọn rõ.` : "";
  phoneDuplicateNotice.hidden = false;
  phoneDuplicateNotice.innerHTML = `
    <div>
      <strong>Đã có khách hàng sử dụng số điện thoại này.</strong>
      <span>${escapeHtml(firstMatch.customer_name || "Chưa nhập")} - ${escapeHtml(firstMatch.customer_phone || "Chưa có SĐT")}.${moreText}</span>
    </div>
    <div class="duplicate-notice-actions">
      ${matches.slice(0, 3).map((match) => `
        <button type="button" data-open-duplicate-customer="${escapeHtml(match.customer_code)}">Tiếp tục hồ sơ này</button>
      `).join("")}
    </div>
  `;
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
customerPhoneInput.addEventListener("change", checkPhoneDuplicate);
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
lensWidthMmInput.addEventListener("input", () => {
  syncCurrentCustomer("customerUpdated");
  updateAdvice();
});
bridgeWidthMmInput.addEventListener("input", () => {
  syncCurrentCustomer("customerUpdated");
  updateAdvice();
});
customerStatusInput.addEventListener("change", () => {
  syncCurrentCustomer("customerUpdated");
  renderCustomers();
});

if (markMeasuredButton) {
  markMeasuredButton.addEventListener("click", markCustomerAsMeasuredSafely);
}

if (cameraModeButton) {
  cameraModeButton.addEventListener("click", toggleCameraMode);
}

if (analyzeFaceButton) {
  analyzeFaceButton.addEventListener("click", analyzeFaceSequence);
}

if (manualConsultButton) {
  manualConsultButton.addEventListener("click", () => openManualConsultationDialog(manualConsultButton));
}

if (confirmManualConsultationButton) {
  confirmManualConsultationButton.addEventListener("click", () => {
    closeManualConsultationDialog({ restoreFocus: false });
    enableManualConsultation();
  });
}

if (cancelManualConsultationButton) {
  cancelManualConsultationButton.addEventListener("click", () => {
    closeManualConsultationDialog();
  });
}

if (manualConsultationDialog) {
  manualConsultationDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeManualConsultationDialog();
    }
    if (event.key === "Tab") {
      const focusable = [...manualConsultationDialog.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
        .filter((element) => !element.disabled && !element.hidden);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

if (visionFallbackActions) {
  visionFallbackActions.addEventListener("click", (event) => {
    const action = event.target?.dataset?.visionFallbackAction;
    if (action === "retry-camera") {
      enableCamera().catch((error) => {
        console.debug("[VisionID] Camera retry failed", error?.code || error?.name || error?.message);
      });
    }
    if (action === "upload-image") {
      openImageUploadFallback("vision-fallback-action");
    }
    if (action === "manual-consult") {
      openManualConsultationDialog(event.target);
    }
  });
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
    syncMarkMeasuredButtonState();
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

if (saveConsultationButton) {
  saveConsultationButton.addEventListener("click", () => {
    saveConsultationResult();
  });
}

if (adjustNeedsButton) {
  adjustNeedsButton.addEventListener("click", () => {
    requestWorkflowNavigation("needs", "consultation-adjust-needs");
  });
}

if (revisitVisionButton) {
  revisitVisionButton.addEventListener("click", () => {
    requestWorkflowNavigation("visionid", "consultation-revisit-vision");
  });
}

if (startNextCustomerButton) {
  startNextCustomerButton.addEventListener("click", () => {
    const saveState = getCurrentConsultationSaveState();
    if (saveState.state !== "saved" && saveState.state !== "measured") {
      return;
    }
    startNewOperationSession({ clearDraft: true });
    showTab("tab-0");
    customerNameInput?.focus?.();
  });
}

if (consultationSummary) {
  consultationSummary.addEventListener("click", (event) => {
    const action = event.target?.dataset?.consultationAction;
    if (action === "needs") {
      requestWorkflowNavigation("needs", "consultation-empty-needs");
    }
    if (action === "visionid") {
      requestWorkflowNavigation("visionid", "consultation-empty-visionid");
    }
    if (action === "manual") {
      openManualConsultationDialog(event.target);
    }
  });
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
    requestCustomerContextChange(() => {
      startNewOperationSession({ clearDraft: true });
      showTab("tab-0");
    });
  });
}

if (startNewSessionButton) {
  startNewSessionButton.addEventListener("click", () => {
    requestCustomerContextChange(() => {
      startNewOperationSession({ clearDraft: true });
      showTab("tab-0");
    });
  });
}

if (switchCustomerButton) {
  switchCustomerButton.addEventListener("click", () => {
    requestWorkflowNavigation("profile", "switch-customer").then(() => customerSearch?.focus());
  });
}

if (keepDraftButton) {
  keepDraftButton.addEventListener("click", () => {
    flushOperationDraftSave("context-keep-draft");
    closeContextChangeDialog({ restoreFocus: false });
    const action = pendingContextChangeAction;
    pendingContextChangeAction = null;
    action?.();
  });
}

if (discardChangesButton) {
  discardChangesButton.addEventListener("click", () => {
    operationDraftSaver.cancel();
    clearOperationDraft();
    closeContextChangeDialog({ restoreFocus: false });
    const action = pendingContextChangeAction;
    pendingContextChangeAction = null;
    action?.();
  });
}

if (cancelContextChangeButton) {
  cancelContextChangeButton.addEventListener("click", () => {
    pendingContextChangeAction = null;
    closeContextChangeDialog();
  });
}

if (resumeDraftButton) {
  resumeDraftButton.addEventListener("click", () => {
    const draft = readOperationDraft();
    closeResumeDraftDialog({ restoreFocus: false });
    if (draft && isMeaningfulOperationDraft(draft)) {
      hydrateOperationDraft(draft);
    }
  });
}

if (discardDraftButton) {
  discardDraftButton.addEventListener("click", () => {
    operationDraftSaver.cancel();
    clearOperationDraft();
    closeResumeDraftDialog({ restoreFocus: false });
    startNewOperationSession({ clearDraft: true });
    showTab("tab-0");
  });
}

if (mobileSaveButton) {
  mobileSaveButton.addEventListener("click", () => {
    requestWorkflowNavigation("needs", "mobile-save");
  });
}

if (mobileScanButton) {
  mobileScanButton.addEventListener("click", () => {
    requestWorkflowNavigation("visionid", "mobile-scan").then((entered) => {
      if (!entered) return;
      if (video?.srcObject && !video.hidden) {
        startAutoScanFlow("mobile-action");
      }
    });
  });
}

if (mobileConsultButton) {
  mobileConsultButton.addEventListener("click", () => {
    requestWorkflowNavigation("consultation", "mobile-consult");
  });
}

if (imageUploadButton) {
  imageUploadButton.addEventListener("click", () => openImageUploadFallback("upload-button"));
}

if (clearImageButton) {
  clearImageButton.addEventListener("click", () => {
    clearUploadedImagePreview({ revoke: true, clearOverlay: true, reason: "clear-image-button" });
    latestAnalysis = null;
    latestAiFaceShape = "";
    clearConfirmedFaceShape();
    faceShapeText.textContent = "Đang chờ";
    renderConfidenceNotice(null, { level: "low", percent: 0 }, false, "Ảnh đã được xóa. Hãy chụp hoặc chọn ảnh mới để tiếp tục.");
    updateWorkflowAssistant();
  });
}

if (faceImageUploadInput) {
  faceImageUploadInput.addEventListener("change", () => {
    const file = faceImageUploadInput.files?.[0] || null;
    faceImageUploadInput.value = "";
    analyzeUploadedFaceImage(file).catch((error) => {
      console.debug("[VisionID] Image upload failed", error?.code || error?.name || error?.message);
    });
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
    console.debug("[VisionID] Camera start failed", error?.code || error?.name || error?.message);
  }
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    requestWorkflowNavigation(normalizeWorkflowStep(button.dataset.tabTarget), "tab-navigation");
  });
});

newCustomerButton.addEventListener("click", () => {
  requestCustomerContextChange(() => startNewOperationSession({ clearDraft: true }));
});
saveCustomerButton.addEventListener("click", saveCurrentCustomerWithLock);
customerSearch.addEventListener("input", () => {
  window.clearTimeout(customerSearchTimer);
  customerSearchTimer = window.setTimeout(renderCustomers, 200);
});
customerSearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    customerSearch.value = "";
    renderCustomers();
  }
  if (event.key === "Enter") {
    event.preventDefault();
  }
});
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
  const createFromSearchButton = event.target.closest("[data-create-customer-from-search]");

  if (loadButton) {
    requestOpenCustomer(loadButton.dataset.loadCustomer, "customer-list", loadButton.dataset.openIntent || "");
  }

  if (createFromSearchButton) {
    try {
      const payload = JSON.parse(decodeURIComponent(createFromSearchButton.dataset.createCustomerFromSearch || ""));
      const query = payload.customerPhone || payload.customerName || customerSearch.value;
      startNewFromSearchQuery(query);
    } catch {
      startNewFromSearchQuery(customerSearch.value);
    }
  }

  if (deleteButton) {
    const deletedCustomerCode = deleteButton.dataset.deleteCustomer;
    deleteCustomer(deletedCustomerCode);
    if (deletedCustomerCode === customerCodeInput.value) {
      startNewOperationSession({ clearDraft: true });
    }
    renderCustomers();
  }
});

const initialCurrentCustomer = loadCurrentCustomer();
if (!initialCurrentCustomer?.customer_code || !loadCustomerRecord(initialCurrentCustomer.customer_code)) {
  startNewOperationSession();
}
updateCameraModeButton();
updateCameraStartButton({ active: Boolean(video?.srcObject) });
ensureDeviceProfileDebugOverride();
refreshDeviceProfile();
renderCurrentCustomerSummary();
renderCustomers();
setOperationBaselineFromCurrent();
maybeShowResumeDraftDialog();

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

document.addEventListener("visibilitychange", () => {
  updateCameraDebug({ pageLifecycleEvent: `visibility:${document.visibilityState}` });
  if (document.visibilityState === "hidden") {
    operationDraftSaver.flush();
  }
});

if (phoneDuplicateNotice) {
  phoneDuplicateNotice.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-duplicate-customer]");
    if (!button) {
      return;
    }
    requestOpenCustomer(button.dataset.openDuplicateCustomer, "duplicate-warning");
  });
}

if (openExistingDuplicateButton) {
  openExistingDuplicateButton.addEventListener("click", () => {
    const target = duplicatePhoneMatches[0];
    closeDuplicateSaveDialog({ restoreFocus: false });
    if (target?.customer_code) {
      requestOpenCustomer(target.customer_code, "duplicate-save-blocker");
    }
  });
}

if (duplicateCustomerDialogMatches) {
  duplicateCustomerDialogMatches.addEventListener("click", (event) => {
    const button = event.target.closest("[data-dialog-open-duplicate]");
    if (!button) {
      return;
    }
    closeDuplicateSaveDialog({ restoreFocus: false });
    requestOpenCustomer(button.dataset.dialogOpenDuplicate, "duplicate-save-blocker");
  });
}

if (reviewDuplicateButton) {
  reviewDuplicateButton.addEventListener("click", () => {
    closeDuplicateSaveDialog();
  });
}

if (createSeparateDuplicateButton) {
  createSeparateDuplicateButton.addEventListener("click", () => {
    allowDuplicateCustomerSaveOnce = true;
    closeDuplicateSaveDialog({ restoreFocus: false });
    saveCurrentCustomer();
    statusText.textContent = "Đã lưu hồ sơ riêng dùng chung số điện thoại.";
  });
}

video?.addEventListener("loadedmetadata", () => {
  renderLifecycleCounts.loadedmetadata += 1;
  latestRenderContext = resizeCanvasToVideo(canvas, video, "loadedmetadata") || latestRenderContext;
  latestRenderDebug = getRenderDiagnostics({ canvas, video, landmarks: latestDebugLandmarks || [], renderContext: latestRenderContext });
  updateVisionDebugPanel({ renderDebug: latestRenderDebug });
});

video?.addEventListener("canplay", () => {
  renderLifecycleCounts.canplay += 1;
  latestRenderContext = resizeCanvasToVideo(canvas, video, "canplay") || latestRenderContext;
  latestRenderDebug = getRenderDiagnostics({ canvas, video, landmarks: latestDebugLandmarks || [], renderContext: latestRenderContext });
  updateVisionDebugPanel({ renderDebug: latestRenderDebug });
});

window.addEventListener("resize", () => {
  renderLifecycleCounts.resize += 1;
  refreshDeviceProfile();
  latestRenderContext = uploadedFaceImage && !uploadedFaceImage.hidden
    ? resizeCanvasToImage(canvas, uploadedFaceImage, "window-resize-image") || latestRenderContext
    : resizeCanvasToVideo(canvas, video, "window-resize") || latestRenderContext;
  latestRenderDebug = getRenderDiagnostics({ canvas, video: uploadedFaceImage && !uploadedFaceImage.hidden ? uploadedFaceImage : video, landmarks: latestDebugLandmarks || [], renderContext: latestRenderContext });
  updateVisionDebugPanel({ renderDebug: latestRenderDebug });
});

window.addEventListener("orientationchange", () => {
  renderLifecycleCounts.orientationchange += 1;
  requestAnimationFrame(() => {
    refreshDeviceProfile();
    latestRenderContext = uploadedFaceImage && !uploadedFaceImage.hidden
      ? resizeCanvasToImage(canvas, uploadedFaceImage, "orientationchange-image") || latestRenderContext
      : resizeCanvasToVideo(canvas, video, "orientationchange") || latestRenderContext;
    latestRenderDebug = getRenderDiagnostics({ canvas, video: uploadedFaceImage && !uploadedFaceImage.hidden ? uploadedFaceImage : video, landmarks: latestDebugLandmarks || [], renderContext: latestRenderContext });
    updateVisionDebugPanel({ renderDebug: latestRenderDebug });
  });
});

window.visualViewport?.addEventListener("resize", () => {
  renderLifecycleCounts.visualViewportResize += 1;
  refreshDeviceProfile();
  latestRenderContext = uploadedFaceImage && !uploadedFaceImage.hidden
    ? resizeCanvasToImage(canvas, uploadedFaceImage, "visual-viewport-resize-image") || latestRenderContext
    : latestRenderContext;
  latestRenderDebug = getRenderDiagnostics({ canvas, video: uploadedFaceImage && !uploadedFaceImage.hidden ? uploadedFaceImage : video, landmarks: latestDebugLandmarks || [], renderContext: latestRenderContext });
  updateVisionDebugPanel({ renderDebug: latestRenderDebug });
});

window.addEventListener("pagehide", () => {
  operationDraftSaver.flush();
  clearUploadedImagePreview({ revoke: true, clearOverlay: false, reason: "pagehide" });
  updateCameraDebug({ pageLifecycleEvent: "pagehide" });
});

window.addEventListener("pageshow", () => {
  updateCameraDebug({ pageLifecycleEvent: "pageshow" });
});
