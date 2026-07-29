const PHONE_MIN_EXACT_LENGTH = 8;

export function normalizeCustomerNameForSearch(value = "") {
  return removeVietnameseToneMarks(String(value))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizePhoneForLookup(value = "") {
  return String(value).replace(/[^\d]/g, "");
}

export function getPhoneLookupCandidates(value = "") {
  const normalized = normalizePhoneForLookup(value);
  if (!normalized) {
    return [];
  }

  const candidates = new Set([normalized]);
  if (normalized.startsWith("84") && normalized.length >= 10) {
    candidates.add(`0${normalized.slice(2)}`);
  }
  if (normalized.startsWith("0") && normalized.length >= 9) {
    candidates.add(`84${normalized.slice(1)}`);
  }

  return [...candidates];
}

export function phonesMatchForLookup(left = "", right = "") {
  const leftCandidates = getPhoneLookupCandidates(left);
  const rightCandidates = getPhoneLookupCandidates(right);
  if (!leftCandidates.length || !rightCandidates.length) {
    return false;
  }

  return leftCandidates.some((candidate) => {
    if (candidate.length < PHONE_MIN_EXACT_LENGTH) {
      return false;
    }
    return rightCandidates.includes(candidate);
  });
}

export function findExactPhoneMatches(customers = [], phone = "", options = {}) {
  const excludeCustomerId = options.excludeCustomerId || "";
  if (!getPhoneLookupCandidates(phone).length) {
    return [];
  }

  return customers
    .filter(isLookupableCustomer)
    .filter((customer) => customer.customer_code !== excludeCustomerId)
    .filter((customer) => phonesMatchForLookup(customer.customer_phone, phone))
    .sort(sortByUpdatedAtDesc);
}

export function findCustomerMatches(customers = [], query = "", options = {}) {
  return rankCustomerMatches(customers, query, options).map((match) => match.customer);
}

export function rankCustomerMatches(customers = [], query = "", options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 8;
  const trimmedQuery = String(query || "").trim();
  if (!trimmedQuery) {
    return customers
      .filter(isLookupableCustomer)
      .sort(sortByUpdatedAtDesc)
      .slice(0, limit)
      .map((customer, index) => ({
        customer,
        score: Math.max(1, 1000 - index),
        reason: "recent"
      }));
  }

  const normalizedQuery = normalizeCustomerNameForSearch(trimmedQuery);
  const phoneQuery = normalizePhoneForLookup(trimmedQuery);

  return customers
    .filter(isLookupableCustomer)
    .map((customer) => {
      const score = scoreCustomerMatch(customer, normalizedQuery, phoneQuery);
      return score ? { customer, ...score } : null;
    })
    .filter(Boolean)
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }
      return compareUpdatedAt(second.customer, first.customer);
    })
    .slice(0, limit);
}

export function isPhoneLikeQuery(value = "") {
  return normalizePhoneForLookup(value).length >= 6;
}

export function createCustomerPrefillFromQuery(query = "") {
  const raw = String(query || "").trim().replace(/\s+/g, " ");
  if (!raw) {
    return { customerName: "", customerPhone: "" };
  }
  if (isPhoneLikeQuery(raw)) {
    return { customerName: "", customerPhone: raw };
  }
  return { customerName: raw, customerPhone: "" };
}

export function getDuplicateSaveDecision(customers = [], input = {}) {
  const matches = findExactPhoneMatches(customers, input.phone, {
    excludeCustomerId: input.currentCustomerId
  });

  if (!matches.length) {
    return { shouldBlock: false, matches, reason: "NO_DUPLICATE" };
  }
  if (input.allowDuplicate) {
    return { shouldBlock: false, matches, reason: "EXPLICIT_OVERRIDE" };
  }

  return {
    shouldBlock: true,
    matches,
    reason: matches.length > 1 ? "MULTIPLE_DUPLICATES" : "EXACT_PHONE_DUPLICATE"
  };
}

function scoreCustomerMatch(customer, normalizedQuery, phoneQuery) {
  const searchableName = normalizeCustomerNameForSearch(customer.customer_name);
  const searchableCode = normalizeCustomerNameForSearch(customer.customer_code);
  const searchablePhone = normalizePhoneForLookup(customer.customer_phone);

  if (phoneQuery && phonesMatchForLookup(customer.customer_phone, phoneQuery)) {
    return { score: 1000, reason: "exact-phone" };
  }
  if (phoneQuery && searchablePhone.includes(phoneQuery) && phoneQuery.length >= 4) {
    return { score: 250 + Math.min(phoneQuery.length, 20), reason: "phone-contains" };
  }
  if (searchableName === normalizedQuery) {
    return { score: 800, reason: "exact-name" };
  }
  if (searchableName.startsWith(normalizedQuery)) {
    return { score: 650, reason: "name-starts" };
  }
  if (searchableName.includes(normalizedQuery)) {
    return { score: 450, reason: "name-contains" };
  }
  if (searchableCode.includes(normalizedQuery)) {
    return { score: 300, reason: "code-contains" };
  }

  return null;
}

function isLookupableCustomer(customer) {
  return Boolean(customer && typeof customer === "object" && customer.customer_code);
}

function compareUpdatedAt(left, right) {
  return timestamp(left.updated_at) - timestamp(right.updated_at);
}

function sortByUpdatedAtDesc(first, second) {
  return compareUpdatedAt(second, first);
}

function timestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function removeVietnameseToneMarks(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d");
}
