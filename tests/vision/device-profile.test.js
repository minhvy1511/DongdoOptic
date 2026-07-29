import test from "node:test";
import assert from "node:assert/strict";

import {
  DEVICE_PROFILES,
  PIPELINES,
  detectDeviceProfile,
  getSessionDebugOverride,
  sanitizeDeviceContextForDebug,
  setSessionDebugOverride,
  shouldAttemptLiveCamera,
  shouldFallbackToUploadAfterCameraError,
  shouldUseUploadFallback
} from "../../frontend/js/vision/device-profile.js";

function makeNavigator({
  userAgent = "",
  platform = "Win32",
  maxTouchPoints = 0,
  brands = [],
  hasMediaDevices = true,
  hasGetUserMedia = true
} = {}) {
  const mediaDevices = hasMediaDevices
    ? {
        getSupportedConstraints: () => ({
          width: true,
          height: true,
          aspectRatio: true,
          facingMode: true,
          deviceId: true
        })
      }
    : undefined;

  if (mediaDevices && hasGetUserMedia) {
    mediaDevices.getUserMedia = async () => ({});
  }

  return {
    userAgent,
    platform,
    maxTouchPoints,
    mediaDevices,
    userAgentData: brands.length ? { brands: brands.map((brand) => ({ brand })) } : undefined
  };
}

function makeWindow({ width = 1366, height = 768, dpr = 1 } = {}) {
  return {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: dpr
  };
}

function makeScreen(type = "landscape-primary") {
  return { orientation: { type } };
}

function makeStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
}

test("desktop Chromium selects live camera pipeline", () => {
  const profile = detectDeviceProfile({
    navigatorLike: makeNavigator({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36",
      brands: ["Chromium", "Google Chrome"]
    }),
    windowLike: makeWindow(),
    screenLike: makeScreen(),
    isSecureContext: true
  });

  assert.equal(profile.deviceProfile, DEVICE_PROFILES.DESKTOP_CHROMIUM);
  assert.equal(profile.pipeline, PIPELINES.LIVE_CAMERA);
  assert.equal(profile.profileReason, "desktop_chromium_live_camera_supported");
  assert.equal(profile.cameraCapability, "getUserMedia_available");
  assert.equal(shouldAttemptLiveCamera(profile), true);
  assert.equal(shouldUseUploadFallback(profile), false);
});

test("Android Chromium selects live camera pipeline", () => {
  const profile = detectDeviceProfile({
    navigatorLike: makeNavigator({
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
      brands: ["Chromium", "Google Chrome"]
    }),
    windowLike: makeWindow({ width: 390, height: 844, dpr: 3 }),
    screenLike: makeScreen("portrait-primary"),
    isSecureContext: true
  });

  assert.equal(profile.deviceProfile, DEVICE_PROFILES.ANDROID_CHROMIUM);
  assert.equal(profile.pipeline, PIPELINES.LIVE_CAMERA);
  assert.equal(shouldAttemptLiveCamera(profile), true);
});

test("iPhone Safari switches to limited upload profile", () => {
  const profile = detectDeviceProfile({
    navigatorLike: makeNavigator({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5
    }),
    windowLike: makeWindow({ width: 390, height: 844, dpr: 3 }),
    screenLike: makeScreen("portrait-primary"),
    isSecureContext: true
  });

  assert.equal(profile.deviceProfile, DEVICE_PROFILES.IOS_SAFARI_LIMITED);
  assert.equal(profile.pipeline, PIPELINES.IMAGE_UPLOAD);
  assert.equal(profile.profileReason, "ios_safari_uses_static_image_fallback");
  assert.equal(shouldUseUploadFallback(profile), true);
  assert.equal(shouldAttemptLiveCamera(profile), false);
});

test("iPadOS Safari switches to limited upload profile without relying only on user agent", () => {
  const profile = detectDeviceProfile({
    navigatorLike: makeNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5
    }),
    windowLike: makeWindow({ width: 1024, height: 768, dpr: 2 }),
    screenLike: makeScreen(),
    isSecureContext: true
  });

  assert.equal(profile.osFamily, "ios");
  assert.equal(profile.deviceClass, "tablet");
  assert.equal(profile.deviceProfile, DEVICE_PROFILES.IOS_SAFARI_LIMITED);
  assert.equal(profile.pipeline, PIPELINES.IMAGE_UPLOAD);
});

test("unknown without mediaDevices uses upload fallback safely", () => {
  const profile = detectDeviceProfile({
    navigatorLike: makeNavigator({
      userAgent: "UnknownBrowser/1.0",
      hasMediaDevices: false
    }),
    windowLike: makeWindow(),
    screenLike: makeScreen(),
    isSecureContext: true
  });

  assert.equal(profile.deviceProfile, DEVICE_PROFILES.UNKNOWN);
  assert.equal(profile.pipeline, PIPELINES.IMAGE_UPLOAD);
  assert.equal(profile.profileReason, "camera_api_unavailable");
  assert.equal(profile.cameraCapability, "no_mediaDevices");
  assert.equal(shouldUseUploadFallback(profile), true);
});

test("unknown with getUserMedia can try camera then fallback after camera error", () => {
  const profile = detectDeviceProfile({
    navigatorLike: makeNavigator({ userAgent: "UnknownBrowser/1.0" }),
    windowLike: makeWindow(),
    screenLike: makeScreen(),
    isSecureContext: true
  });

  assert.equal(profile.deviceProfile, DEVICE_PROFILES.UNKNOWN);
  assert.equal(profile.pipeline, PIPELINES.TRY_CAMERA_THEN_UPLOAD);
  assert.equal(shouldAttemptLiveCamera(profile), true);
  assert.equal(shouldFallbackToUploadAfterCameraError(profile), true);
});

test("debug override only works when visionDebug is enabled and stays session-scoped", () => {
  const storage = makeStorage();
  assert.equal(setSessionDebugOverride(DEVICE_PROFILES.UPLOAD_ONLY, { debugEnabled: false, storage }), "");
  assert.equal(getSessionDebugOverride({ debugEnabled: false, storage }), "");

  assert.equal(setSessionDebugOverride(DEVICE_PROFILES.UPLOAD_ONLY, { debugEnabled: true, storage }), DEVICE_PROFILES.UPLOAD_ONLY);
  assert.equal(getSessionDebugOverride({ debugEnabled: true, storage }), DEVICE_PROFILES.UPLOAD_ONLY);

  const profile = detectDeviceProfile({
    navigatorLike: makeNavigator({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36",
      brands: ["Chromium"]
    }),
    windowLike: makeWindow(),
    screenLike: makeScreen(),
    debugEnabled: true,
    override: getSessionDebugOverride({ debugEnabled: true, storage })
  });

  assert.equal(profile.overrideActive, true);
  assert.equal(profile.deviceProfile, DEVICE_PROFILES.UPLOAD_ONLY);
  assert.equal(profile.pipeline, PIPELINES.IMAGE_UPLOAD);
  assert.equal(profile.profileReason, "debug_override");
});

test("sanitized debug context omits raw user agent and backend-unsafe fields", () => {
  const sanitized = sanitizeDeviceContextForDebug({
    deviceProfile: DEVICE_PROFILES.DESKTOP_CHROMIUM,
    browserFamily: "chromium",
    profileReason: "desktop_chromium_live_camera_supported",
    cameraCapability: "getUserMedia_available",
    rawUserAgent: "secret raw ua",
    faceLandmarks: [{ x: 1 }],
    mesh: [1, 2, 3],
    image: "base64"
  });

  assert.equal(sanitized.deviceProfile, DEVICE_PROFILES.DESKTOP_CHROMIUM);
  assert.equal(sanitized.profileReason, "desktop_chromium_live_camera_supported");
  assert.equal(sanitized.cameraCapability, "getUserMedia_available");
  assert.equal("rawUserAgent" in sanitized, false);
  assert.equal("faceLandmarks" in sanitized, false);
  assert.equal("mesh" in sanitized, false);
  assert.equal("image" in sanitized, false);
});
