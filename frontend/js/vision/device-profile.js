export const DEVICE_PROFILES = Object.freeze({
  DESKTOP_CHROMIUM: "desktop_chromium",
  ANDROID_CHROMIUM: "android_chromium",
  IOS_SAFARI_LIMITED: "ios_safari_limited",
  UNKNOWN: "unknown",
  UPLOAD_ONLY: "upload_only"
});

export const PIPELINES = Object.freeze({
  LIVE_CAMERA: "live_camera",
  IMAGE_UPLOAD: "image_upload",
  TRY_CAMERA_THEN_UPLOAD: "try_camera_then_upload"
});

const DEBUG_OVERRIDE_KEY = "visionDeviceProfileOverride";

export function detectDeviceProfile({
  navigatorLike = getNavigator(),
  windowLike = getWindow(),
  screenLike = getScreen(),
  isSecureContext = getSecureContext(),
  supportedConstraints = getSupportedMediaConstraints(navigatorLike),
  videoElement = null,
  stream = null,
  debugEnabled = false,
  override = null
} = {}) {
  const runtime = buildRuntimeDeviceContext({
    navigatorLike,
    windowLike,
    screenLike,
    isSecureContext,
    supportedConstraints,
    videoElement,
    stream
  });
  const overrideProfile = normalizeOverride(override);

  if (debugEnabled && overrideProfile) {
    return {
      ...runtime,
      deviceProfile: overrideProfile,
      pipeline: pipelineForProfile(overrideProfile, runtime),
      renderProfile: renderProfileForProfile(overrideProfile),
      overrideActive: true,
      overrideProfile,
      compatibilityFallbackUsed: overrideProfile === DEVICE_PROFILES.IOS_SAFARI_LIMITED || overrideProfile === DEVICE_PROFILES.UPLOAD_ONLY
    };
  }

  const deviceProfile = resolveProfile(runtime);

  return {
    ...runtime,
    deviceProfile,
    pipeline: pipelineForProfile(deviceProfile, runtime),
    renderProfile: renderProfileForProfile(deviceProfile),
    overrideActive: false,
    overrideProfile: "",
    compatibilityFallbackUsed: deviceProfile === DEVICE_PROFILES.IOS_SAFARI_LIMITED
  };
}

export function buildRuntimeDeviceContext({
  navigatorLike = getNavigator(),
  windowLike = getWindow(),
  screenLike = getScreen(),
  isSecureContext = getSecureContext(),
  supportedConstraints = getSupportedMediaConstraints(navigatorLike),
  videoElement = null,
  stream = null
} = {}) {
  const browserFamily = detectBrowserFamily(navigatorLike);
  const osFamily = detectOsFamily(navigatorLike);
  const deviceClass = detectDeviceClass({ navigatorLike, windowLike, osFamily });
  const track = stream?.getVideoTracks?.()[0] || videoElement?.srcObject?.getVideoTracks?.()[0] || null;
  const settings = track?.getSettings?.() || {};

  return {
    deviceProfile: DEVICE_PROFILES.UNKNOWN,
    browserFamily,
    osFamily,
    deviceClass,
    orientation: getOrientation(windowLike, screenLike),
    devicePixelRatio: Number(windowLike?.devicePixelRatio || 1),
    isSecureContext: Boolean(isSecureContext),
    hasMediaDevices: Boolean(navigatorLike?.mediaDevices),
    hasGetUserMedia: typeof navigatorLike?.mediaDevices?.getUserMedia === "function",
    supportedMediaConstraints: normalizeSupportedConstraints(supportedConstraints),
    videoWidth: Number(videoElement?.videoWidth || 0),
    videoHeight: Number(videoElement?.videoHeight || 0),
    trackWidth: Number(settings.width || 0),
    trackHeight: Number(settings.height || 0),
    facingMode: settings.facingMode || "",
    renderProfile: "standard",
    cameraStartupStatus: "not_started",
    compatibilityFallbackUsed: false
  };
}

export function shouldUseUploadFallback(profileContext = {}) {
  return profileContext.pipeline === PIPELINES.IMAGE_UPLOAD
    || profileContext.deviceProfile === DEVICE_PROFILES.IOS_SAFARI_LIMITED
    || profileContext.deviceProfile === DEVICE_PROFILES.UPLOAD_ONLY;
}

export function shouldAttemptLiveCamera(profileContext = {}) {
  return profileContext.pipeline === PIPELINES.LIVE_CAMERA
    || profileContext.pipeline === PIPELINES.TRY_CAMERA_THEN_UPLOAD;
}

export function shouldFallbackToUploadAfterCameraError(profileContext = {}) {
  return profileContext.pipeline === PIPELINES.TRY_CAMERA_THEN_UPLOAD
    || !profileContext.hasMediaDevices
    || !profileContext.hasGetUserMedia;
}

export function withCameraStartupStatus(profileContext = {}, status = "", details = {}) {
  return {
    ...profileContext,
    ...pickDeviceContextDetails(details),
    cameraStartupStatus: status || profileContext.cameraStartupStatus || "unknown",
    compatibilityFallbackUsed: Boolean(details.compatibilityFallbackUsed ?? profileContext.compatibilityFallbackUsed)
  };
}

export function getSessionDebugOverride({ debugEnabled = false, storage = getSessionStorage() } = {}) {
  if (!debugEnabled || !storage) {
    return "";
  }

  try {
    return normalizeOverride(storage.getItem(DEBUG_OVERRIDE_KEY)) || "";
  } catch {
    return "";
  }
}

export function setSessionDebugOverride(value, { debugEnabled = false, storage = getSessionStorage() } = {}) {
  if (!debugEnabled || !storage) {
    return "";
  }

  const profile = normalizeOverride(value);
  try {
    if (!profile) {
      storage.removeItem(DEBUG_OVERRIDE_KEY);
      return "";
    }
    storage.setItem(DEBUG_OVERRIDE_KEY, profile);
  } catch {
    return profile || "";
  }

  return profile;
}

export function sanitizeDeviceContextForDebug(profileContext = {}) {
  const allowedKeys = [
    "deviceProfile",
    "browserFamily",
    "osFamily",
    "deviceClass",
    "orientation",
    "devicePixelRatio",
    "isSecureContext",
    "hasMediaDevices",
    "hasGetUserMedia",
    "supportedMediaConstraints",
    "videoWidth",
    "videoHeight",
    "trackWidth",
    "trackHeight",
    "facingMode",
    "renderProfile",
    "cameraStartupStatus",
    "compatibilityFallbackUsed",
    "pipeline",
    "overrideActive",
    "overrideProfile"
  ];

  return Object.fromEntries(
    allowedKeys.map((key) => [key, profileContext[key]]).filter(([, value]) => value !== undefined)
  );
}

function resolveProfile(context) {
  if (context.osFamily === "ios" && context.browserFamily === "safari") {
    return DEVICE_PROFILES.IOS_SAFARI_LIMITED;
  }

  if (context.osFamily === "android" && context.browserFamily === "chromium") {
    return DEVICE_PROFILES.ANDROID_CHROMIUM;
  }

  if (context.deviceClass === "desktop" && context.browserFamily === "chromium") {
    return DEVICE_PROFILES.DESKTOP_CHROMIUM;
  }

  if (!context.hasMediaDevices || !context.hasGetUserMedia) {
    return DEVICE_PROFILES.UNKNOWN;
  }

  return DEVICE_PROFILES.UNKNOWN;
}

function pipelineForProfile(profile, context = {}) {
  if (profile === DEVICE_PROFILES.DESKTOP_CHROMIUM || profile === DEVICE_PROFILES.ANDROID_CHROMIUM) {
    return PIPELINES.LIVE_CAMERA;
  }
  if (profile === DEVICE_PROFILES.IOS_SAFARI_LIMITED || profile === DEVICE_PROFILES.UPLOAD_ONLY) {
    return PIPELINES.IMAGE_UPLOAD;
  }
  if (!context.hasMediaDevices || !context.hasGetUserMedia) {
    return PIPELINES.IMAGE_UPLOAD;
  }
  return PIPELINES.TRY_CAMERA_THEN_UPLOAD;
}

function renderProfileForProfile(profile) {
  if (profile === DEVICE_PROFILES.IOS_SAFARI_LIMITED || profile === DEVICE_PROFILES.UPLOAD_ONLY) {
    return "static-image";
  }
  return "live-video";
}

function detectBrowserFamily(navigatorLike) {
  const ua = String(navigatorLike?.userAgent || "");
  const brands = getBrands(navigatorLike);

  if (brands.some((brand) => /Chromium|Google Chrome|Microsoft Edge/i.test(brand)) || /Chrome\/|CriOS|Edg\//.test(ua)) {
    return "chromium";
  }
  if (/Firefox\/|FxiOS/.test(ua)) {
    return "firefox";
  }
  if (/Safari\//.test(ua) && !/Chrome\/|CriOS|FxiOS|Edg\//.test(ua)) {
    return "safari";
  }

  return "unknown";
}

function detectOsFamily(navigatorLike) {
  const ua = String(navigatorLike?.userAgent || "");
  const platform = String(navigatorLike?.platform || "");
  const maxTouchPoints = Number(navigatorLike?.maxTouchPoints || 0);

  if (/Android/i.test(ua)) {
    return "android";
  }
  if (/iPhone|iPad|iPod/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return "windows";
  }
  if (/Mac/i.test(platform)) {
    return "macos";
  }
  if (/Linux/i.test(platform)) {
    return "linux";
  }
  return "unknown";
}

function detectDeviceClass({ navigatorLike, windowLike, osFamily }) {
  const ua = String(navigatorLike?.userAgent || "");
  const width = Number(windowLike?.innerWidth || 0);
  const height = Number(windowLike?.innerHeight || 0);
  const shortSide = Math.min(width || 9999, height || 9999);
  const maxTouchPoints = Number(navigatorLike?.maxTouchPoints || 0);

  if (/Mobile|iPhone|Android.*Mobile/i.test(ua) || (osFamily === "ios" && shortSide < 768)) {
    return "mobile";
  }
  if (/iPad|Tablet/i.test(ua) || (maxTouchPoints > 1 && shortSide >= 768) || (osFamily === "android" && !/Mobile/i.test(ua))) {
    return "tablet";
  }
  return "desktop";
}

function getOrientation(windowLike, screenLike) {
  if (screenLike?.orientation?.type) {
    return screenLike.orientation.type;
  }
  const width = Number(windowLike?.innerWidth || 0);
  const height = Number(windowLike?.innerHeight || 0);
  if (!width || !height) {
    return "unknown";
  }
  return width >= height ? "landscape" : "portrait";
}

function normalizeOverride(value) {
  const normalized = String(value || "").trim();
  return Object.values(DEVICE_PROFILES).includes(normalized) ? normalized : "";
}

function getBrands(navigatorLike) {
  const brands = navigatorLike?.userAgentData?.brands || [];
  return Array.isArray(brands) ? brands.map((item) => item.brand || "") : [];
}

function getSupportedMediaConstraints(navigatorLike) {
  try {
    return navigatorLike?.mediaDevices?.getSupportedConstraints?.() || {};
  } catch {
    return {};
  }
}

function normalizeSupportedConstraints(value = {}) {
  return {
    width: Boolean(value.width),
    height: Boolean(value.height),
    aspectRatio: Boolean(value.aspectRatio),
    facingMode: Boolean(value.facingMode),
    deviceId: Boolean(value.deviceId)
  };
}

function pickDeviceContextDetails(details = {}) {
  const result = {};
  ["videoWidth", "videoHeight", "trackWidth", "trackHeight", "facingMode"].forEach((key) => {
    if (details[key] !== undefined) {
      result[key] = details[key];
    }
  });
  return result;
}

function getNavigator() {
  return typeof navigator !== "undefined" ? navigator : {};
}

function getWindow() {
  return typeof window !== "undefined" ? window : {};
}

function getScreen() {
  return typeof screen !== "undefined" ? screen : {};
}

function getSecureContext() {
  return typeof window !== "undefined" ? Boolean(window.isSecureContext) : false;
}

function getSessionStorage() {
  return typeof sessionStorage !== "undefined" ? sessionStorage : null;
}
