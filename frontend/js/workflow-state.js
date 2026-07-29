export const WORKFLOW_STEPS = ["profile", "needs", "visionid", "consultation"];

export const STEP_TO_TAB_ID = {
  profile: "tab-0",
  needs: "tab-1",
  visionid: "tab-3",
  consultation: "tab-4"
};

export const TAB_ID_TO_STEP = Object.fromEntries(
  Object.entries(STEP_TO_TAB_ID).map(([step, tabId]) => [tabId, step])
);

export function normalizeWorkflowStep(stepOrTabId) {
  return TAB_ID_TO_STEP[stepOrTabId] || (WORKFLOW_STEPS.includes(stepOrTabId) ? stepOrTabId : "profile");
}

export function getConsultationSource(context = {}) {
  if (context.manualConsultationMode) {
    return { valid: true, source: "manual", label: "Tư vấn thủ công đã xác nhận" };
  }

  if (context.confirmedFaceShape && context.analysisState === "analysis_complete") {
    return { valid: true, source: "visionid", label: "VisionID đã xác nhận" };
  }

  if (context.confirmedFaceShape && context.imageAnalysisState === "analysis_complete") {
    return { valid: true, source: "image", label: "Ảnh tĩnh đã xác nhận" };
  }

  return { valid: false, source: "", label: "Cần VisionID hoặc xác nhận tư vấn thủ công" };
}

export function getStepValidation(step, context = {}) {
  const normalized = normalizeWorkflowStep(step);
  if (normalized === "profile") {
    return context.profileValidation || { valid: true, errors: [] };
  }
  if (normalized === "needs") {
    return context.needsValidation || { valid: true, errors: [] };
  }
  if (normalized === "consultation") {
    const source = getConsultationSource(context);
    return source.valid
      ? { valid: true, errors: [] }
      : { valid: false, errors: [{ field: "confirmedFaceShape", code: "CONSULTATION_SOURCE_REQUIRED", message: source.label }] };
  }
  return { valid: true, errors: [] };
}

export function canEnterStep(targetStep, context = {}) {
  const current = normalizeWorkflowStep(context.currentStep);
  const target = normalizeWorkflowStep(targetStep);
  const currentIndex = WORKFLOW_STEPS.indexOf(current);
  const targetIndex = WORKFLOW_STEPS.indexOf(target);

  if (targetIndex <= currentIndex) {
    return { allowed: true, reason: "PREVIOUS_STEP" };
  }

  const profileValidation = context.profileValidation || { valid: true, errors: [] };
  if (!profileValidation.valid && targetIndex > 0) {
    return { allowed: false, reason: "PROFILE_INVALID", validation: profileValidation };
  }

  const needsValidation = context.needsValidation || { valid: true, errors: [] };
  if (!needsValidation.valid && targetIndex > 1) {
    return { allowed: false, reason: "NEEDS_INVALID", validation: needsValidation };
  }

  if (target === "consultation") {
    const source = getConsultationSource(context);
    if (!source.valid) {
      return { allowed: false, reason: "CONSULTATION_SOURCE_REQUIRED", validation: getStepValidation("consultation", context) };
    }
  }

  return { allowed: true, reason: "OK" };
}

export function getWorkflowStepState(context = {}) {
  const current = normalizeWorkflowStep(context.currentStep);
  const currentIndex = WORKFLOW_STEPS.indexOf(current);
  return WORKFLOW_STEPS.reduce((acc, step, index) => {
    const complete = (
      (step === "profile" && Boolean(context.profileValidation?.valid && context.hasProfileData))
      || (step === "needs" && Boolean(context.needsValidation?.valid && context.hasNeedsData))
      || (step === "visionid" && Boolean(getConsultationSource(context).valid))
      || (step === "consultation" && Boolean(context.consultationComplete))
    );
    const gate = canEnterStep(step, context);
    acc[step] = {
      status: step === current ? "current" : complete ? "complete" : gate.allowed ? "available" : "locked",
      complete,
      current: step === current,
      available: gate.allowed,
      locked: !gate.allowed && index > currentIndex,
      reason: gate.reason
    };
    return acc;
  }, {});
}

export function getNextWorkflowAction(context = {}) {
  const current = normalizeWorkflowStep(context.currentStep);
  if (current === "profile") {
    return {
      targetStep: "needs",
      action: "navigate",
      label: "Lưu & sang Nhu cầu",
      title: context.profileValidation?.valid ? "Lưu hồ sơ và tiếp tục" : "Hoàn thiện hồ sơ trước khi tiếp tục",
      tone: context.profileValidation?.valid ? "ready" : "warning"
    };
  }

  if (current === "needs") {
    return {
      targetStep: "visionid",
      action: "navigate",
      label: "Lưu & sang VisionID",
      title: context.needsValidation?.valid ? "Kiểm tra tròng kính nhanh, rồi sang VisionID" : "Hoàn thiện nhu cầu trước khi tiếp tục",
      tone: context.needsValidation?.valid ? "ready" : "warning"
    };
  }

  if (current === "visionid") {
    const source = getConsultationSource(context);
    if (source.valid) {
      return {
        targetStep: "consultation",
        action: "navigate",
        label: source.source === "manual" ? "Tiếp tục tư vấn thủ công" : "Xem tư vấn",
        title: source.label,
        tone: "ready"
      };
    }

    if (context.draftFaceShape) {
      return {
        targetStep: "visionid",
        action: "confirm_face_shape",
        label: "Xác nhận dạng mặt",
        title: "Chọn dạng mặt xác nhận để mở tư vấn",
        tone: "warning"
      };
    }

    return {
      targetStep: "visionid",
      action: context.cameraActive ? "restart_scan" : "start_camera",
      label: context.cameraActive ? "Quét lại từ đầu" : "Bật camera",
      title: context.cameraActive ? "Giữ mặt thẳng để lấy ảnh chất lượng cao" : "Bật camera hoặc tải ảnh để bắt đầu quét",
      tone: context.cameraActive ? "warning" : "neutral"
    };
  }

  const source = getConsultationSource(context);
  return {
    targetStep: source.valid ? "consultation" : "visionid",
    action: source.valid ? "complete_consultation" : "navigate",
    label: source.valid ? "Lưu đã đo" : "Quay lại VisionID",
    title: source.valid ? "Lưu trạng thái đã đo sau khi tư vấn xong" : "Cần VisionID hoặc tư vấn thủ công trước khi chốt",
    tone: source.valid ? "ready" : "warning"
  };
}
