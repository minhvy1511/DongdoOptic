import test from "node:test";
import assert from "node:assert/strict";

import {
  createCustomerPrefillFromQuery,
  findExactPhoneMatches,
  getDuplicateSaveDecision,
  isPhoneLikeQuery,
  normalizeCustomerNameForSearch,
  normalizePhoneForLookup,
  phonesMatchForLookup,
  rankCustomerMatches
} from "../../frontend/js/customer-lookup.js";

const customers = [
  {
    customer_code: "KH-A",
    customer_name: "Do Thi Bich",
    customer_phone: "0911 515 000",
    updated_at: "2026-07-20T10:00:00.000Z"
  },
  {
    customer_code: "KH-B",
    customer_name: "Do Thuy Linh",
    customer_phone: "0901-222-333",
    updated_at: "2026-07-22T10:00:00.000Z"
  },
  {
    customer_code: "KH-C",
    customer_name: "Nguyen Do",
    customer_phone: "084.901.222.333",
    updated_at: "2026-07-23T10:00:00.000Z"
  },
  {
    customer_code: "KH-D",
    customer_name: "Anh Linh",
    customer_phone: "123456789",
    updated_at: "2026-07-24T10:00:00.000Z"
  },
  null,
  { customer_name: "Broken record", customer_phone: "0999" }
];

test("normalizes customer names case, accents, and whitespace", () => {
  assert.equal(normalizeCustomerNameForSearch("  ĐỖ   THÙY Linh  "), "do thuy linh");
  assert.equal(normalizeCustomerNameForSearch("Đỗ Thùy Linh"), normalizeCustomerNameForSearch("do thuy linh"));
});

test("normalizes phone punctuation without mutating display value", () => {
  assert.equal(normalizePhoneForLookup("+84 (911) 515-000"), "84911515000");
});

test("+84, 84, and leading zero can match full Vietnamese phone numbers", () => {
  assert.equal(phonesMatchForLookup("+84 911 515 000", "0911515000"), true);
  assert.equal(phonesMatchForLookup("84911515000", "0911.515.000"), true);
});

test("phone lookup does not match only by tail digits", () => {
  assert.equal(phonesMatchForLookup("0911515000", "515000"), false);
  assert.equal(findExactPhoneMatches(customers, "515000").length, 0);
});

test("exact phone matches are ranked first", () => {
  const results = rankCustomerMatches(customers, "0901 222 333");
  assert.equal(results[0].customer.customer_code, "KH-B");
  assert.equal(results[0].reason, "exact-phone");
});

test("name prefix outranks contains when scores are otherwise similar", () => {
  const results = rankCustomerMatches([
    { customer_code: "KH-prefix", customer_name: "Linh An", updated_at: "2026-07-20T10:00:00.000Z" },
    { customer_code: "KH-contains", customer_name: "Anh Linh", updated_at: "2026-07-24T10:00:00.000Z" }
  ], "linh");
  assert.equal(results[0].customer.customer_code, "KH-prefix");
  assert.equal(results[1].customer.customer_code, "KH-contains");
});

test("search supports accent-insensitive partial names", () => {
  const results = rankCustomerMatches(customers, "thuy linh");
  assert.equal(results[0].customer.customer_code, "KH-B");
});

test("exact duplicate excludes current customer when editing old profile", () => {
  const matches = findExactPhoneMatches(customers, "0901222333", { excludeCustomerId: "KH-B" });
  assert.equal(matches.length, 0);
});

test("multiple exact duplicates are returned without selecting one implicitly", () => {
  const duplicated = [
    ...customers.slice(0, 2),
    { customer_code: "KH-E", customer_name: "Shared Phone", customer_phone: "+84 901 222 333" }
  ];
  const matches = findExactPhoneMatches(duplicated, "0901222333");
  assert.equal(matches.length, 2);
  assert.deepEqual(matches.map((customer) => customer.customer_code).sort(), ["KH-B", "KH-E"]);
});

test("duplicate save decision blocks exact duplicate until explicit override", () => {
  const blocked = getDuplicateSaveDecision(customers, {
    phone: "+84 901 222 333",
    currentCustomerId: "NEW-CUSTOMER"
  });
  assert.equal(blocked.shouldBlock, true);
  assert.equal(blocked.reason, "EXACT_PHONE_DUPLICATE");
  assert.equal(blocked.matches[0].customer_code, "KH-B");

  const override = getDuplicateSaveDecision(customers, {
    phone: "+84 901 222 333",
    currentCustomerId: "NEW-CUSTOMER",
    allowDuplicate: true
  });
  assert.equal(override.shouldBlock, false);
  assert.equal(override.reason, "EXPLICIT_OVERRIDE");
});

test("duplicate save decision excludes the currently edited customer", () => {
  const decision = getDuplicateSaveDecision(customers, {
    phone: "0901222333",
    currentCustomerId: "KH-B"
  });
  assert.equal(decision.shouldBlock, false);
  assert.equal(decision.matches.length, 0);
});

test("query prefill is created only after explicit create-new action", () => {
  assert.deepEqual(createCustomerPrefillFromQuery("0911 515 000"), {
    customerName: "",
    customerPhone: "0911 515 000"
  });
  assert.deepEqual(createCustomerPrefillFromQuery("  Do Thi Bich  "), {
    customerName: "Do Thi Bich",
    customerPhone: ""
  });
});

test("phone-like query detection is conservative", () => {
  assert.equal(isPhoneLikeQuery("091151"), true);
  assert.equal(isPhoneLikeQuery("Do Thi Bich"), false);
});

test("broken customer records do not crash lookup", () => {
  assert.doesNotThrow(() => rankCustomerMatches(customers, "do"));
});
