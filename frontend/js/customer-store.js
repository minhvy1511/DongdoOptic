const STORAGE_KEY = "dongdo_optic_customers";
const CURRENT_CUSTOMER_KEY = "current_customer";
export const CUSTOMER_SELECTED_EVENT = "customerSelected";
export const CUSTOMER_UPDATED_EVENT = "customerUpdated";

export function createCustomerCode() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `KH-${datePart}-${randomPart}`;
}

export function createSessionCode() {
  const now = new Date();
  const timePart = [
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  ].map((part) => String(part).padStart(2, "0")).join("");
  const randomPart = Math.random().toString(36).slice(2, 4).toUpperCase();

  return `PC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${timePart}-${randomPart}`;
}

export function loadCustomers() {
  try {
    const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(records) ? records.map(normalizeCustomerRecord) : [];
  } catch {
    return [];
  }
}

export function saveCustomer(record) {
  const records = loadCustomers();
  const now = new Date().toISOString();
  const normalizedRecord = {
    ...record,
    customer_code: record.customer_code || createCustomerCode(),
    session_code: record.session_code || createSessionCode(),
    customer_name: record.customer_name || "Chưa nhập",
    customer_status: record.customer_status || "waiting",
    frame_width_mm: record.frame_width_mm ?? null,
    updated_at: now,
    created_at: record.created_at || now
  };
  const existingIndex = records.findIndex(
    (item) => item.customer_code === normalizedRecord.customer_code
  );

  if (existingIndex >= 0) {
    records[existingIndex] = normalizedRecord;
  } else {
    records.unshift(normalizedRecord);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  setCurrentCustomer(normalizedRecord, CUSTOMER_UPDATED_EVENT);
  return normalizedRecord;
}

export function loadCurrentCustomer() {
  try {
    const record = JSON.parse(localStorage.getItem(CURRENT_CUSTOMER_KEY) || "null");
    return record ? normalizeCustomerRecord(record) : null;
  } catch {
    return null;
  }
}

export function setCurrentCustomer(record, eventName = CUSTOMER_SELECTED_EVENT) {
  const normalizedRecord = normalizeCustomerRecord(record);
  localStorage.setItem(CURRENT_CUSTOMER_KEY, JSON.stringify(normalizedRecord));
  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail: { customer: normalizedRecord }
    })
  );

  if (eventName !== CUSTOMER_SELECTED_EVENT) {
    window.dispatchEvent(
      new CustomEvent(CUSTOMER_SELECTED_EVENT, {
        detail: { customer: normalizedRecord }
      })
    );
  }

  return normalizedRecord;
}

export function clearCurrentCustomer() {
  localStorage.removeItem(CURRENT_CUSTOMER_KEY);
}

export function deleteCustomer(customerCode) {
  const records = loadCustomers().filter(
    (item) => item.customer_code !== customerCode
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function normalizeCustomerRecord(record) {
  const now = new Date().toISOString();
  return {
    customer_code: record.customer_code || createCustomerCode(),
    session_code: record.session_code || createSessionCode(),
    customer_name: record.customer_name || "Chưa nhập",
    customer_phone: record.customer_phone || "",
    consult_date: record.consult_date || todayInputValue(),
    age_group: record.age_group || "",
    customer_notes: record.customer_notes || "",
    customer_status: record.customer_status || "waiting",
    frame_width_mm: record.frame_width_mm ?? null,
    has_prescription: Boolean(record.has_prescription),
    prescription: record.prescription || {},
    preferences: record.preferences || {},
    analysis: record.analysis || null,
    recommendations: Array.isArray(record.recommendations) ? record.recommendations : [],
    lens_recommendations: Array.isArray(record.lens_recommendations) ? record.lens_recommendations : [],
    snapshot: record.snapshot || {},
    created_at: record.created_at || now,
    updated_at: record.updated_at || now
  };
}

export function todayInputValue() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}
