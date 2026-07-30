import test from "node:test";
import assert from "node:assert/strict";

import {
  OPERATION_DRAFT_SCHEMA_VERSION,
  OPERATION_DRAFT_STORAGE_KEY,
  clearOperationDraft,
  containsUnsafeDraftData,
  createDebouncedDraftSaver,
  createOperationDraft,
  hasBusinessStateChanged,
  isMeaningfulOperationDraft,
  normalizeOperationBusinessState,
  normalizeOperationDraft,
  operationStepToTabId,
  readOperationDraft,
  tabIdToOperationStep,
  writeOperationDraft
} from "../../frontend/js/operation-draft-store.js";

function memoryStorage({ throwOnSet = false } = {}) {
  const data = new Map();
  let shouldThrowOnSet = throwOnSet;
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (shouldThrowOnSet) {
        throw new Error("quota");
      }
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    has(key) {
      return data.has(key);
    },
    setThrowOnSet(value) {
      shouldThrowOnSet = value;
    }
  };
}

test("draft schema has version 1 and stable session identity", () => {
  const draft = createOperationDraft({
    draftId: "OD-1",
    customerId: null,
    sessionCode: "PC-1",
    customer: { name: " Anh " }
  }, new Date("2026-07-29T08:00:00.000Z"));

  assert.equal(draft.schemaVersion, OPERATION_DRAFT_SCHEMA_VERSION);
  assert.equal(draft.draftId, "OD-1");
  assert.equal(draft.customerId, null);
  assert.equal(draft.sessionCode, "PC-1");
  assert.equal(draft.customer.name, " Anh ");
});

test("draft blocks image, landmark, mesh, and debug fields", () => {
  assert.equal(containsUnsafeDraftData({ image: "x" }), true);
  assert.equal(containsUnsafeDraftData({ customer: { name: "A" }, faceLandmarks: [] }), true);
  assert.equal(containsUnsafeDraftData({ diagnostics: { scan: true } }), true);
  assert.equal(containsUnsafeDraftData({ photo: "data:image/png;base64,abc" }), true);
  assert.equal(containsUnsafeDraftData({ mesh: [1, 2] }), true);

  assert.equal(normalizeOperationDraft({
    schemaVersion: 1,
    draftId: "OD-2",
    customer: { name: "A" },
    landmark: [{ x: 1 }]
  }), null);
});

test("empty draft is not meaningful and is not written", () => {
  const storage = memoryStorage();
  const emptyDraft = createOperationDraft({ draftId: "OD-empty", sessionCode: "PC-empty" });

  assert.equal(isMeaningfulOperationDraft(emptyDraft), false);
  assert.deepEqual(writeOperationDraft(emptyDraft, storage), { ok: false, reason: "EMPTY_OR_INVALID_DRAFT" });
  assert.equal(storage.has(OPERATION_DRAFT_STORAGE_KEY), false);
});

test("name, customerId, prescription, later step, or manual mode make draft meaningful", () => {
  assert.equal(isMeaningfulOperationDraft(createOperationDraft({ customer: { name: "Lan" } })), true);
  assert.equal(isMeaningfulOperationDraft(createOperationDraft({ customerId: "KH-1" })), true);
  assert.equal(isMeaningfulOperationDraft(createOperationDraft({ customer: { prescription: { sph: "-2." } } })), true);
  assert.equal(isMeaningfulOperationDraft(createOperationDraft({ currentStep: "visionid" })), true);
  assert.equal(isMeaningfulOperationDraft(createOperationDraft({ consultation: { manualMode: true } })), true);
});

test("customer search query is not business state but form phone remains business state", () => {
  const baseline = normalizeOperationBusinessState(createOperationDraft());
  const searched = normalizeOperationBusinessState(createOperationDraft({ searchQuery: "0911" }));
  const phoneEdited = normalizeOperationBusinessState(createOperationDraft({
    customer: { phone: "0911 515 000" }
  }));

  assert.equal(isMeaningfulOperationDraft(createOperationDraft({ searchQuery: "0911" })), false);
  assert.equal(hasBusinessStateChanged(searched, baseline), false);
  assert.equal(hasBusinessStateChanged(phoneEdited, baseline), true);
  assert.equal(isMeaningfulOperationDraft(createOperationDraft({ customer: { phone: "0911 515 000" } })), true);
});

test("storage exception does not throw and does not clear existing valid draft", () => {
  const failingStorage = memoryStorage();
  const existingDraft = createOperationDraft({ customer: { name: "Existing" } });
  writeOperationDraft(existingDraft, failingStorage);
  failingStorage.setThrowOnSet(true);

  const draft = createOperationDraft({ customer: { name: "Bao" } });
  const result = writeOperationDraft(draft, failingStorage);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "STORAGE_ERROR");
  assert.equal(readOperationDraft(failingStorage).customer.name, "Existing");
});

test("read ignores malformed schema and completed drafts safely", () => {
  const storage = memoryStorage();
  storage.setItem(OPERATION_DRAFT_STORAGE_KEY, JSON.stringify({ schemaVersion: 999, customer: { name: "A" } }));
  assert.equal(readOperationDraft(storage), null);

  const completed = createOperationDraft({
    customer: { name: "Done" },
    completedAt: "2026-07-29T09:00:00.000Z"
  });
  writeOperationDraft(completed, storage);
  assert.equal(isMeaningfulOperationDraft(readOperationDraft(storage)), false);
});

test("completed measured draft is never resume-worthy", () => {
  const completedMeasuredDraft = createOperationDraft({
    draftId: "OD-measured",
    customerId: "KH-measured",
    sessionCode: "PC-measured",
    currentStep: "consultation",
    customer: {
      name: "Measured Customer",
      phone: "0900000000",
      status: "measured"
    },
    consultation: { manualMode: true },
    completedAt: "2026-07-29T10:00:00.000Z"
  });

  assert.equal(isMeaningfulOperationDraft(completedMeasuredDraft), false);
});

test("business state normalization preserves negative prescription strings", () => {
  const state = normalizeOperationBusinessState(createOperationDraft({
    customer: {
      name: "  An  ",
      phone: " 091 111 222 ",
      prescription: { sph: "-3.", cyl: "-0.50" }
    }
  }));

  assert.equal(state.customer.name, "An");
  assert.equal(state.customer.phone, "091111222");
  assert.equal(state.customer.prescription.sph, "-3.");
  assert.equal(state.customer.prescription.cyl, "-0.50");
});

test("dirty comparison detects business edits but ignores timestamp-only changes", () => {
  const first = normalizeOperationBusinessState(createOperationDraft({
    draftId: "OD-1",
    customer: { name: "A" }
  }, new Date("2026-07-29T08:00:00.000Z")));
  const sameBusiness = normalizeOperationBusinessState(createOperationDraft({
    draftId: "OD-1",
    customer: { name: "A" }
  }, new Date("2026-07-29T09:00:00.000Z")));
  const edited = normalizeOperationBusinessState(createOperationDraft({
    draftId: "OD-1",
    customer: { name: "B" }
  }));

  assert.equal(hasBusinessStateChanged(sameBusiness, first), false);
  assert.equal(hasBusinessStateChanged(edited, first), true);
});

test("autosave debounce writes once and flushes synchronously", () => {
  let timeoutCallback = null;
  let clearCount = 0;
  let saveCount = 0;
  const saver = createDebouncedDraftSaver({
    delayMs: 700,
    saveFn: () => {
      saveCount += 1;
      return saveCount;
    },
    setTimeoutFn: (callback) => {
      timeoutCallback = callback;
      return { id: Math.random() };
    },
    clearTimeoutFn: () => {
      clearCount += 1;
    }
  });

  saver.schedule();
  saver.schedule();
  assert.equal(clearCount, 1);
  assert.equal(saveCount, 0);

  timeoutCallback();
  assert.equal(saveCount, 1);

  saver.schedule();
  assert.equal(saver.flush(), 2);
  assert.equal(saveCount, 2);
});

test("autosave debounce cancel prevents stale draft writes after completion", () => {
  let timeoutCallback = null;
  let timerCleared = false;
  let saveCount = 0;
  let clearCount = 0;
  const saver = createDebouncedDraftSaver({
    delayMs: 700,
    saveFn: () => {
      saveCount += 1;
      return saveCount;
    },
    setTimeoutFn: (callback) => {
      timeoutCallback = callback;
      timerCleared = false;
      return { id: "timer" };
    },
    clearTimeoutFn: () => {
      clearCount += 1;
      timerCleared = true;
    }
  });

  saver.schedule();
  saver.cancel();
  if (!timerCleared) {
    timeoutCallback();
  }

  assert.equal(clearCount, 1);
  assert.equal(saveCount, 0);
});

test("step mapping is stable for resume", () => {
  assert.equal(tabIdToOperationStep("tab-0"), "profile");
  assert.equal(tabIdToOperationStep("tab-1"), "needs");
  assert.equal(tabIdToOperationStep("tab-3"), "visionid");
  assert.equal(tabIdToOperationStep("tab-4"), "consultation");
  assert.equal(operationStepToTabId("visionid"), "tab-3");
});

test("clear draft only removes the operation draft key", () => {
  const storage = memoryStorage();
  storage.setItem(OPERATION_DRAFT_STORAGE_KEY, "{}");
  storage.setItem("dongdo_optic_customers", "[{\"customer_name\":\"Keep\"}]");

  assert.equal(clearOperationDraft(storage), true);
  assert.equal(storage.getItem(OPERATION_DRAFT_STORAGE_KEY), null);
  assert.equal(storage.getItem("dongdo_optic_customers"), "[{\"customer_name\":\"Keep\"}]");
});
