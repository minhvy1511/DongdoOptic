export function parseOptionalFiniteNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return { empty: true, valid: true, value: null };
  }

  const number = Number(text.replace(",", "."));
  if (!Number.isFinite(number)) {
    return { empty: false, valid: false, value: null };
  }

  return { empty: false, valid: true, value: number };
}

function createResult(valid, errors = []) {
  return { valid, errors };
}

export function validatePrescriptionState(state = {}) {
  if (!state.hasPrescription) {
    return createResult(true);
  }

  const errors = [];
  const pd = parseOptionalFiniteNumber(state.pd);
  const sph = parseOptionalFiniteNumber(state.sph);
  const cyl = parseOptionalFiniteNumber(state.cyl);

  if (pd.empty) {
    errors.push({ field: "prescriptionPd", code: "PD_REQUIRED", message: "Nhập PD khi khách đã có đơn kính." });
  } else if (!pd.valid || pd.value <= 0) {
    errors.push({ field: "prescriptionPd", code: "PD_INVALID", message: "PD phải là số hợp lệ lớn hơn 0." });
  }

  if (!sph.empty && !sph.valid) {
    errors.push({ field: "prescriptionSph", code: "SPH_INVALID", message: "SPH phải là số hợp lệ." });
  }

  if (!cyl.empty && !cyl.valid) {
    errors.push({ field: "prescriptionCyl", code: "CYL_INVALID", message: "CYL phải là số hợp lệ." });
  }

  return createResult(errors.length === 0, errors);
}

export function validateProfileState(state = {}) {
  const errors = [];
  if (!String(state.customerName ?? "").trim()) {
    errors.push({ field: "customerName", code: "CUSTOMER_NAME_REQUIRED", message: "Nhập tên khách hàng trước khi chuyển bước." });
  }

  if (state.duplicateBlocked) {
    errors.push({ field: "customerPhone", code: "DUPLICATE_PHONE_BLOCKED", message: "Số điện thoại đã tồn tại. Hãy mở hồ sơ cũ hoặc xác nhận tạo hồ sơ riêng." });
  }

  const prescription = validatePrescriptionState({
    hasPrescription: Boolean(state.hasPrescription),
    pd: state.prescriptionPd,
    sph: state.prescriptionSph,
    cyl: state.prescriptionCyl
  });
  errors.push(...prescription.errors);

  return createResult(errors.length === 0, errors);
}

export function validateNeedsState(state = {}) {
  const errors = [];
  if (!String(state.budget ?? "").trim()) {
    errors.push({ field: "budget", code: "BUDGET_REQUIRED", message: "Chọn khoảng giá trước khi sang VisionID." });
  }
  if (!String(state.purpose ?? "").trim()) {
    errors.push({ field: "purpose", code: "PURPOSE_REQUIRED", message: "Chọn mục đích ưu tiên trước khi sang VisionID." });
  }
  if (!String(state.framePreference ?? "").trim()) {
    errors.push({ field: "framePreference", code: "FRAME_PREFERENCE_REQUIRED", message: "Chọn sở thích gọng trước khi sang VisionID." });
  }

  return createResult(errors.length === 0, errors);
}

export function getFirstValidationError(result = {}) {
  return Array.isArray(result.errors) ? result.errors[0] || null : null;
}
