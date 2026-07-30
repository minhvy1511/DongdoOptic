export const CONSULTATION_SOURCES = Object.freeze({
  CAMERA: "visionid_camera",
  IMAGE: "visionid_image",
  MANUAL: "manual",
  NONE: "none"
});

export const CONSULTATION_SAVE_STATES = Object.freeze({
  EMPTY: "empty",
  UNSAVED: "unsaved",
  SAVING: "saving",
  SAVED: "saved",
  UPDATE_REQUIRED: "update_required",
  ERROR: "error",
  MEASURED: "measured"
});

export const CUSTOMER_OPERATIONAL_STATUSES = Object.freeze({
  DRAFT: "draft",
  CONSULTING: "consulting",
  RESULT_SAVED: "result_saved",
  MEASURED: "measured",
  SAVED_PROFILE: "saved_profile"
});

const SOURCE_LABELS = {
  [CONSULTATION_SOURCES.CAMERA]: "VisionID - Camera",
  [CONSULTATION_SOURCES.IMAGE]: "VisionID - Anh tinh",
  [CONSULTATION_SOURCES.MANUAL]: "Tu van thu cong",
  [CONSULTATION_SOURCES.NONE]: "Chua co nguon tu van"
};

const SOURCE_LIMITATIONS = {
  [CONSULTATION_SOURCES.CAMERA]: "Phan tich ty le tuong doi tu hinh anh camera, khong phai phep do kich thuoc vat ly.",
  [CONSULTATION_SOURCES.IMAGE]: "Phan tich tu anh tinh, khong phai phep do kich thuoc khuon mat.",
  [CONSULTATION_SOURCES.MANUAL]: "Goi y nay dua tren nhu cau va thong tin don kinh, khong su dung phan tich khuon mat tu dong.",
  [CONSULTATION_SOURCES.NONE]: "Can hoan tat VisionID hoac chon tu van thu cong truoc khi luu ket qua."
};

export function createConsultationContext({
  customerId = "",
  draftId = "",
  sessionCode = ""
} = {}) {
  return {
    customerId: text(customerId),
    draftId: text(draftId),
    sessionCode: text(sessionCode)
  };
}

export function isConsultationResultCurrent({
  resultContext,
  currentContext,
  allowMissingDraft = false
} = {}) {
  if (!resultContext || !currentContext) {
    return false;
  }

  const customerMatches = text(resultContext.customerId) && text(resultContext.customerId) === text(currentContext.customerId);
  const sessionMatches = text(resultContext.sessionCode) && text(resultContext.sessionCode) === text(currentContext.sessionCode);
  const draftMatches = allowMissingDraft && !text(resultContext.draftId)
    ? true
    : text(resultContext.draftId) && text(resultContext.draftId) === text(currentContext.draftId);

  return Boolean(customerMatches && sessionMatches && draftMatches);
}

export function getConsultationSource(context = {}) {
  const current = isConsultationResultCurrent({
    resultContext: context.resultContext,
    currentContext: context.currentContext,
    allowMissingDraft: Boolean(context.allowPersistedResult)
  });

  if (context.manualConsultationMode && (current || context.manualConfirmed)) {
    return buildSource(CONSULTATION_SOURCES.MANUAL, true);
  }

  if (!context.confirmedFaceShape || !context.analysis || !current) {
    return buildSource(CONSULTATION_SOURCES.NONE, false);
  }

  const diagnostics = context.analysis.diagnostics || {};
  const isImage = diagnostics.imageSource === "upload"
    || diagnostics.scanMode === "static-image-primary"
    || context.imageAnalysisState === "analysis_complete";

  return buildSource(isImage ? CONSULTATION_SOURCES.IMAGE : CONSULTATION_SOURCES.CAMERA, true);
}

export function getConsultationPresentation(recommendations = [], source = buildSource(), options = {}) {
  const validRecommendations = Array.isArray(recommendations)
    ? recommendations.filter(Boolean)
    : [];
  const primary = validRecommendations[0] || null;
  const alternatives = validRecommendations.slice(1, 3);

  if (!source.valid || !primary) {
    return {
      empty: true,
      primary: null,
      alternatives: [],
      hiddenRecommendations: [],
      source,
      title: "Chua co ket qua tu van hop le",
      reason: source.valid
        ? "Chua co goi y gong phu hop de hien thi."
        : source.limitation,
      limitation: source.limitation,
      lensPrimary: options.lensRecommendations?.[0] || null
    };
  }

  return {
    empty: false,
    primary,
    alternatives,
    hiddenRecommendations: validRecommendations.slice(3),
    source,
    title: options.title || primary.name || "Goi y gong chinh",
    reason: primary.reason || options.reason || "",
    limitation: source.limitation,
    lensPrimary: options.lensRecommendations?.[0] || null
  };
}

export function getConsultationSaveState({
  source,
  currentSignature = "",
  savedSignature = "",
  saving = false,
  error = "",
  measured = false
} = {}) {
  if (saving) {
    return { state: CONSULTATION_SAVE_STATES.SAVING, label: "Dang luu...", actionLabel: "Dang luu..." };
  }

  if (error) {
    return { state: CONSULTATION_SAVE_STATES.ERROR, label: "Luu that bai", actionLabel: "Thu luu lai" };
  }

  if (measured) {
    return { state: CONSULTATION_SAVE_STATES.MEASURED, label: "Da do", actionLabel: "Cap nhat ket qua tu van" };
  }

  if (!source?.valid || !currentSignature) {
    return { state: CONSULTATION_SAVE_STATES.EMPTY, label: "Chua co ket qua", actionLabel: "Luu ket qua tu van" };
  }

  if (savedSignature && savedSignature === currentSignature) {
    return { state: CONSULTATION_SAVE_STATES.SAVED, label: "Da luu ket qua tu van", actionLabel: "Cap nhat ket qua tu van" };
  }

  if (savedSignature && savedSignature !== currentSignature) {
    return { state: CONSULTATION_SAVE_STATES.UPDATE_REQUIRED, label: "Can cap nhat ket qua", actionLabel: "Cap nhat ket qua tu van" };
  }

  return { state: CONSULTATION_SAVE_STATES.UNSAVED, label: "Ket qua chua luu", actionLabel: "Luu ket qua tu van" };
}

export function buildConsultationResultPayload({
  source,
  confirmedFaceShape = "",
  recommendations = [],
  lensRecommendations = [],
  needsSnapshot = {},
  prescriptionSnapshot = {},
  savedAt = new Date().toISOString()
} = {}) {
  if (!source?.valid || source.source === CONSULTATION_SOURCES.NONE) {
    return null;
  }

  const safeRecommendations = sanitizeRecommendations(recommendations);
  if (!safeRecommendations.length) {
    return null;
  }

  return {
    consultationSource: source.source,
    confirmedFaceShape: source.source === CONSULTATION_SOURCES.MANUAL ? "" : text(confirmedFaceShape),
    primaryFrameRecommendation: safeRecommendations[0],
    alternativeFrameRecommendations: safeRecommendations.slice(1, 3),
    lensRecommendations: sanitizeRecommendations(lensRecommendations).slice(0, 3),
    needsSnapshot: sanitizePlainObject(needsSnapshot),
    prescriptionSnapshot: sanitizePlainObject(prescriptionSnapshot),
    savedAt
  };
}

export function getConsultationSignature(payload) {
  if (!payload) {
    return "";
  }
  return stableStringify(stripSignatureVolatileFields(payload));
}

export function getCustomerOperationalStatus(customer = {}, activeDraft = null) {
  if (isMeasuredCustomer(customer)) {
    return {
      status: CUSTOMER_OPERATIONAL_STATUSES.MEASURED,
      label: "Da do",
      nextStep: "Mo ho so"
    };
  }

  if (customer.consultation_result?.savedAt || customer.consultation_saved_at) {
    return {
      status: CUSTOMER_OPERATIONAL_STATUSES.RESULT_SAVED,
      label: "Da co ket qua",
      nextStep: "Xem ket qua"
    };
  }

  if (activeDraft?.customerId && activeDraft.customerId === customer.customer_code) {
    return {
      status: CUSTOMER_OPERATIONAL_STATUSES.DRAFT,
      label: "Ban nhap",
      nextStep: "Tiep tuc phien"
    };
  }

  if (customer.customer_code) {
    const hasOnlyLegacyData = !customer.preferences && !customer.recommendations?.length && !customer.analysis;
    return hasOnlyLegacyData
      ? { status: CUSTOMER_OPERATIONAL_STATUSES.SAVED_PROFILE, label: "Ho so da luu", nextStep: "Mo ho so" }
      : { status: CUSTOMER_OPERATIONAL_STATUSES.CONSULTING, label: "Dang tu van", nextStep: "Tiep tuc tu van" };
  }

  return {
    status: CUSTOMER_OPERATIONAL_STATUSES.DRAFT,
    label: "Ban nhap",
    nextStep: "Tiep tuc phien"
  };
}

export function getCustomerPrimaryAction(customer = {}, activeDraft = null) {
  const status = getCustomerOperationalStatus(customer, activeDraft);
  const labels = {
    [CUSTOMER_OPERATIONAL_STATUSES.DRAFT]: "Tiep tuc phien",
    [CUSTOMER_OPERATIONAL_STATUSES.CONSULTING]: "Tiep tuc tu van",
    [CUSTOMER_OPERATIONAL_STATUSES.RESULT_SAVED]: "Xem ket qua",
    [CUSTOMER_OPERATIONAL_STATUSES.MEASURED]: "Mo ho so",
    [CUSTOMER_OPERATIONAL_STATUSES.SAVED_PROFILE]: "Mo ho so"
  };

  return {
    label: labels[status.status] || "Mo ho so",
    status: status.status,
    targetStep: status.status === CUSTOMER_OPERATIONAL_STATUSES.RESULT_SAVED ? "consultation" : "profile"
  };
}

export function canCompleteOperation({
  customerExists = false,
  source,
  saveInFlight = false,
  contextMatches = false,
  persistError = ""
} = {}) {
  if (saveInFlight) return { allowed: false, reason: "SAVE_IN_FLIGHT" };
  if (persistError) return { allowed: false, reason: "PERSIST_ERROR" };
  if (!customerExists) return { allowed: false, reason: "CUSTOMER_REQUIRED" };
  if (!source?.valid) return { allowed: false, reason: "CONSULTATION_SOURCE_REQUIRED" };
  if (!contextMatches) return { allowed: false, reason: "CONTEXT_MISMATCH" };
  return { allowed: true, reason: "OK" };
}

export function consultationSourceLabel(sourceValue) {
  return SOURCE_LABELS[sourceValue] || SOURCE_LABELS[CONSULTATION_SOURCES.NONE];
}

export function consultationSourceLimitation(sourceValue) {
  return SOURCE_LIMITATIONS[sourceValue] || SOURCE_LIMITATIONS[CONSULTATION_SOURCES.NONE];
}

function buildSource(source = CONSULTATION_SOURCES.NONE, valid = false) {
  return {
    source,
    valid,
    label: consultationSourceLabel(source),
    limitation: consultationSourceLimitation(source)
  };
}

function sanitizeRecommendations(items) {
  return (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .map((item) => sanitizePlainObject(item));
}

function sanitizePlainObject(input) {
  if (!input || typeof input !== "object") {
    return {};
  }

  const blocked = /(image|video|file|blob|base64|objecturl|landmark|mesh|vertices|pixel|canvas|debug|diagnostic|useragent)/i;
  return Object.entries(input).reduce((result, [key, value]) => {
    if (blocked.test(key)) {
      return result;
    }
    if (Array.isArray(value)) {
      result[key] = value
        .filter((item) => item === null || ["string", "number", "boolean"].includes(typeof item))
        .map((item) => item);
      return result;
    }
    if (value && typeof value === "object") {
      result[key] = sanitizePlainObject(value);
      return result;
    }
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      result[key] = value;
    }
    return result;
  }, {});
}

function isMeasuredCustomer(customer) {
  return ["measured", "closed", "done"].includes(text(customer.customer_status || customer.status).toLowerCase());
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortValue(value[key]);
    return result;
  }, {});
}

function stripSignatureVolatileFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripSignatureVolatileFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.entries(value).reduce((result, [key, item]) => {
    if (key === "savedAt") {
      return result;
    }
    result[key] = stripSignatureVolatileFields(item);
    return result;
  }, {});
}

function text(value) {
  if (value === null || typeof value === "undefined") {
    return "";
  }
  return String(value);
}
