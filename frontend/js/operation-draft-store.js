export const OPERATION_DRAFT_SCHEMA_VERSION = 1;
export const OPERATION_DRAFT_STORAGE_KEY = "dongdo_optic_operation_draft_v1";

const DEFAULT_NEEDS = {
  budget: "medium",
  purpose: "daily",
  prescriptionLevel: "unknown",
  framePreference: "balanced",
  brands: []
};

const UNSAFE_KEY_PATTERN = /(file|blob|objecturl|imageurl|image|base64|dataurl|pixel|video|landmark|facelandmarks|mesh|vertices|canvas|useragent|debug|diagnostic|mediapipe|render)/i;

export function createOperationDraftId(now = new Date()) {
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OD-${stamp}-${randomPart}`;
}

export function createOperationDraft(input = {}, now = new Date()) {
  const existing = normalizeOperationDraft(input) || {};
  const createdAt = parseIso(existing.createdAt) || now.toISOString();
  const updatedAt = now.toISOString();

  return normalizeOperationDraft({
    schemaVersion: OPERATION_DRAFT_SCHEMA_VERSION,
    draftId: existing.draftId || input.draftId || createOperationDraftId(now),
    customerId: input.customerId ?? existing.customerId ?? null,
    sessionCode: text(input.sessionCode ?? existing.sessionCode),
    source: input.source === "existing" ? "existing" : "new",
    currentStep: normalizeStep(input.currentStep ?? existing.currentStep),
    customer: {
      name: text(input.customer?.name ?? existing.customer?.name),
      phone: text(input.customer?.phone ?? existing.customer?.phone),
      consultDate: text(input.customer?.consultDate ?? existing.customer?.consultDate),
      ageGroup: text(input.customer?.ageGroup ?? existing.customer?.ageGroup),
      status: text((input.customer?.status ?? existing.customer?.status) || "waiting"),
      notes: text(input.customer?.notes ?? existing.customer?.notes),
      frameWidthMm: text(input.customer?.frameWidthMm ?? existing.customer?.frameWidthMm),
      lensWidthMm: text(input.customer?.lensWidthMm ?? existing.customer?.lensWidthMm),
      bridgeWidthMm: text(input.customer?.bridgeWidthMm ?? existing.customer?.bridgeWidthMm),
      hasPrescription: Boolean(input.customer?.hasPrescription ?? existing.customer?.hasPrescription),
      prescription: {
        pd: text(input.customer?.prescription?.pd ?? existing.customer?.prescription?.pd),
        sph: text(input.customer?.prescription?.sph ?? existing.customer?.prescription?.sph),
        cyl: text(input.customer?.prescription?.cyl ?? existing.customer?.prescription?.cyl)
      }
    },
    needs: {
      budget: text((input.needs?.budget ?? existing.needs?.budget) || DEFAULT_NEEDS.budget),
      purpose: text((input.needs?.purpose ?? existing.needs?.purpose) || DEFAULT_NEEDS.purpose),
      prescriptionLevel: text((input.needs?.prescriptionLevel ?? existing.needs?.prescriptionLevel) || DEFAULT_NEEDS.prescriptionLevel),
      framePreference: text((input.needs?.framePreference ?? existing.needs?.framePreference) || DEFAULT_NEEDS.framePreference),
      brands: Array.isArray(input.needs?.brands ?? existing.needs?.brands)
        ? [...(input.needs?.brands ?? existing.needs?.brands)].map(text).filter(Boolean)
        : []
    },
    consultation: {
      manualMode: Boolean(input.consultation?.manualMode ?? existing.consultation?.manualMode)
    },
    consent: {
      analysisPersistenceAllowed: Boolean(input.consent?.analysisPersistenceAllowed ?? existing.consent?.analysisPersistenceAllowed)
    },
    createdAt,
    updatedAt,
    lastSavedCustomerAt: parseIso(input.lastSavedCustomerAt ?? existing.lastSavedCustomerAt) || null,
    completedAt: parseIso(input.completedAt ?? existing.completedAt) || null
  });
}

export function normalizeOperationDraft(draft) {
  if (!draft || typeof draft !== "object") {
    return null;
  }

  if (Number(draft.schemaVersion) !== OPERATION_DRAFT_SCHEMA_VERSION) {
    return null;
  }

  if (containsUnsafeDraftData(draft)) {
    return null;
  }

  const customer = draft.customer && typeof draft.customer === "object" ? draft.customer : {};
  const needs = draft.needs && typeof draft.needs === "object" ? draft.needs : {};
  const consultation = draft.consultation && typeof draft.consultation === "object" ? draft.consultation : {};
  const consent = draft.consent && typeof draft.consent === "object" ? draft.consent : {};

  return {
    schemaVersion: OPERATION_DRAFT_SCHEMA_VERSION,
    draftId: text(draft.draftId),
    customerId: draft.customerId ? text(draft.customerId) : null,
    sessionCode: text(draft.sessionCode),
    source: draft.source === "existing" ? "existing" : "new",
    currentStep: normalizeStep(draft.currentStep),
    customer: {
      name: text(customer.name),
      phone: text(customer.phone),
      consultDate: text(customer.consultDate),
      ageGroup: text(customer.ageGroup),
      status: text(customer.status || "waiting"),
      notes: text(customer.notes),
      frameWidthMm: text(customer.frameWidthMm),
      lensWidthMm: text(customer.lensWidthMm),
      bridgeWidthMm: text(customer.bridgeWidthMm),
      hasPrescription: Boolean(customer.hasPrescription),
      prescription: {
        pd: text(customer.prescription?.pd),
        sph: text(customer.prescription?.sph),
        cyl: text(customer.prescription?.cyl)
      }
    },
    needs: {
      budget: text(needs.budget || DEFAULT_NEEDS.budget),
      purpose: text(needs.purpose || DEFAULT_NEEDS.purpose),
      prescriptionLevel: text(needs.prescriptionLevel || DEFAULT_NEEDS.prescriptionLevel),
      framePreference: text(needs.framePreference || DEFAULT_NEEDS.framePreference),
      brands: Array.isArray(needs.brands) ? needs.brands.map(text).filter(Boolean) : []
    },
    consultation: {
      manualMode: Boolean(consultation.manualMode)
    },
    consent: {
      analysisPersistenceAllowed: Boolean(consent.analysisPersistenceAllowed)
    },
    createdAt: parseIso(draft.createdAt) || new Date(0).toISOString(),
    updatedAt: parseIso(draft.updatedAt) || new Date(0).toISOString(),
    lastSavedCustomerAt: parseIso(draft.lastSavedCustomerAt) || null,
    completedAt: parseIso(draft.completedAt) || null
  };
}

export function normalizeOperationBusinessState(draft) {
  const normalized = normalizeOperationDraft({
    ...draft,
    schemaVersion: OPERATION_DRAFT_SCHEMA_VERSION
  });

  if (!normalized) {
    return null;
  }

  return {
    customerId: normalized.customerId,
    sessionCode: normalized.sessionCode,
    source: normalized.source,
    currentStep: normalized.currentStep,
    customer: {
      name: normalized.customer.name.trim(),
      phone: normalizePhoneForCompare(normalized.customer.phone),
      consultDate: normalized.customer.consultDate,
      ageGroup: normalized.customer.ageGroup,
      status: normalized.customer.status,
      notes: normalized.customer.notes.trim(),
      frameWidthMm: normalized.customer.frameWidthMm.trim(),
      lensWidthMm: normalized.customer.lensWidthMm.trim(),
      bridgeWidthMm: normalized.customer.bridgeWidthMm.trim(),
      hasPrescription: normalized.customer.hasPrescription,
      prescription: {
        pd: normalized.customer.prescription.pd.trim(),
        sph: normalized.customer.prescription.sph.trim(),
        cyl: normalized.customer.prescription.cyl.trim()
      }
    },
    needs: {
      budget: normalized.needs.budget,
      purpose: normalized.needs.purpose,
      prescriptionLevel: normalized.needs.prescriptionLevel,
      framePreference: normalized.needs.framePreference,
      brands: [...normalized.needs.brands].sort()
    },
    consultation: normalized.consultation
  };
}

export function isMeaningfulOperationDraft(draft) {
  const normalized = normalizeOperationDraft(draft);
  if (!normalized || normalized.completedAt) {
    return false;
  }

  const customer = normalized.customer;
  const prescription = customer.prescription;
  const hasPrescriptionData = Boolean(prescription.pd || prescription.sph || prescription.cyl);
  const hasFrameData = Boolean(customer.frameWidthMm || customer.lensWidthMm || customer.bridgeWidthMm);
  const hasNonDefaultNeeds = (
    normalized.needs.budget !== DEFAULT_NEEDS.budget
    || normalized.needs.purpose !== DEFAULT_NEEDS.purpose
    || normalized.needs.prescriptionLevel !== DEFAULT_NEEDS.prescriptionLevel
    || normalized.needs.framePreference !== DEFAULT_NEEDS.framePreference
  );

  return Boolean(
    normalized.customerId
    || customer.name.trim()
    || normalizePhoneForCompare(customer.phone)
    || customer.ageGroup
    || customer.notes.trim()
    || customer.hasPrescription
    || hasPrescriptionData
    || hasFrameData
    || hasNonDefaultNeeds
    || normalized.currentStep !== "profile"
    || normalized.consultation.manualMode
  );
}

export function readOperationDraft(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(OPERATION_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeOperationDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeOperationDraft(draft, storage = globalThis.localStorage) {
  const normalized = normalizeOperationDraft(draft);
  if (!normalized || !isMeaningfulOperationDraft(normalized)) {
    return { ok: false, reason: "EMPTY_OR_INVALID_DRAFT" };
  }

  try {
    storage?.setItem(OPERATION_DRAFT_STORAGE_KEY, JSON.stringify(normalized));
    return { ok: true, draft: normalized };
  } catch (error) {
    return { ok: false, reason: "STORAGE_ERROR", error };
  }
}

export function clearOperationDraft(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(OPERATION_DRAFT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasBusinessStateChanged(current, baseline) {
  return stableStringify(current) !== stableStringify(baseline);
}

export function createDebouncedDraftSaver({
  delayMs = 750,
  saveFn,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout
} = {}) {
  let timer = null;

  return {
    schedule() {
      if (timer) {
        clearTimeoutFn(timer);
      }
      timer = setTimeoutFn(() => {
        timer = null;
        saveFn?.();
      }, delayMs);
    },
    flush() {
      if (timer) {
        clearTimeoutFn(timer);
        timer = null;
      }
      return saveFn?.();
    },
    cancel() {
      if (timer) {
        clearTimeoutFn(timer);
      }
      timer = null;
    }
  };
}

export function getDraftResumeSummary(draft) {
  const normalized = normalizeOperationDraft(draft);
  if (!normalized) {
    return null;
  }

  return {
    name: normalized.customer.name || "Khach moi",
    phone: normalized.customer.phone || "",
    step: normalized.currentStep,
    updatedAt: normalized.updatedAt,
    hasSavedCustomerConflict: false
  };
}

export function containsUnsafeDraftData(value, keyPath = "") {
  if (value === null || typeof value === "undefined") {
    return false;
  }

  if (typeof value === "string") {
    return /^data:image\//i.test(value) || /^blob:/i.test(value);
  }

  if (typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(([key, child]) => {
    const nextPath = keyPath ? `${keyPath}.${key}` : key;
    return UNSAFE_KEY_PATTERN.test(nextPath) || containsUnsafeDraftData(child, nextPath);
  });
}

export function normalizePhoneForCompare(value) {
  return text(value).replace(/\D/g, "");
}

export function normalizeStep(value) {
  const allowed = new Set(["profile", "needs", "visionid", "consultation"]);
  return allowed.has(value) ? value : "profile";
}

export function operationStepToTabId(step) {
  return {
    profile: "tab-0",
    needs: "tab-1",
    visionid: "tab-3",
    consultation: "tab-4"
  }[normalizeStep(step)];
}

export function tabIdToOperationStep(tabId) {
  return {
    "tab-0": "profile",
    "tab-1": "needs",
    "tab-3": "visionid",
    "tab-4": "consultation"
  }[tabId] || "profile";
}

function text(value) {
  if (value === null || typeof value === "undefined") {
    return "";
  }
  return String(value);
}

function parseIso(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = sortValue(value[key]);
      return result;
    }, {});
}
