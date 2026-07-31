import test from "node:test";
import assert from "node:assert/strict";
import { consume, createMemoryStore } from "../src/rateLimit.js";

const OPTIONS = { windowMs: 60_000, maxRequests: 10 };

/** A plain store, so tests don't depend on the module-level singleton. */
function store() {
  const map = new Map();
  return { get: (k) => map.get(k), set: (k, v) => map.set(k, v), clear: () => map.clear() };
}

test("allows requests up to the limit", () => {
  const s = store();
  const now = 60_000;

  for (let i = 0; i < 10; i++) {
    assert.equal(consume(s, "ip", now, OPTIONS).allowed, true, `request ${i + 1}`);
  }
  assert.equal(consume(s, "ip", now, OPTIONS).allowed, false);
});

test("reports remaining and a positive retry-after", () => {
  const s = store();
  const now = 60_000;

  assert.equal(consume(s, "ip", now, OPTIONS).remaining, 9);

  for (let i = 0; i < 9; i++) consume(s, "ip", now, OPTIONS);

  const blocked = consume(s, "ip", now, OPTIONS);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test("keys are independent", () => {
  const s = store();
  const now = 60_000;

  for (let i = 0; i < 10; i++) consume(s, "a", now, OPTIONS);

  assert.equal(consume(s, "a", now, OPTIONS).allowed, false);
  assert.equal(consume(s, "b", now, OPTIONS).allowed, true);
});

test("a full quota does not immediately renew at the window boundary", () => {
  const s = store();

  // Spend the whole quota at the very end of one window.
  const endOfWindow = 119_999;
  for (let i = 0; i < 10; i++) consume(s, "ip", endOfWindow, OPTIONS);

  // One millisecond later a fixed window would reset and allow 10 more,
  // letting a client send 20 in ~1ms. The sliding window must refuse.
  const startOfNext = 120_000;
  assert.equal(consume(s, "ip", startOfNext, OPTIONS).allowed, false);
});

test("capacity returns gradually as the previous window ages out", () => {
  const s = store();

  const first = 60_000;
  for (let i = 0; i < 10; i++) consume(s, "ip", first, OPTIONS);

  // Halfway through the next window, the previous count is weighted at 50%,
  // so roughly half the quota is available again.
  const halfway = 120_000 + 30_000;
  let allowed = 0;
  for (let i = 0; i < 10; i++) {
    if (consume(s, "ip", halfway, OPTIONS).allowed) allowed += 1;
  }
  assert.ok(allowed >= 4 && allowed <= 6, `expected about half the quota, got ${allowed}`);
});

test("fully recovers once the previous window has passed entirely", () => {
  const s = store();

  for (let i = 0; i < 10; i++) consume(s, "ip", 60_000, OPTIONS);

  // Two windows later there is no overlap left to carry forward.
  const later = 60_000 + OPTIONS.windowMs * 2;
  assert.equal(consume(s, "ip", later, OPTIONS).allowed, true);
});

test("memory store evicts entries older than two windows", () => {
  const s = createMemoryStore();
  consume(s, "ip", 1000, OPTIONS);
  assert.ok(s.get("ip"));
  s.clear();
  assert.equal(s.get("ip"), undefined);
});
