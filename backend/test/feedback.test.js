import test from "node:test";
import assert from "node:assert/strict";
import {
  recordFeedback,
  feedbackSummary,
  ValidationError,
  _resetForTests,
} from "../src/feedback.js";

test.beforeEach(() => _resetForTests());

test("records an up rating", () => {
  const entry = recordFeedback({ rating: "up", message: "Try restarting." });
  assert.equal(entry.rating, "up");
  assert.ok(entry.at);
});

test("rejects an unknown rating", () => {
  assert.throws(() => recordFeedback({ rating: "sideways" }), ValidationError);
  assert.throws(() => recordFeedback({}), ValidationError);
});

test("truncates stored text rather than rejecting it", () => {
  const entry = recordFeedback({
    rating: "down",
    message: "x".repeat(5000),
    question: "y".repeat(2000),
  });
  assert.equal(entry.message.length, 2000);
  assert.equal(entry.question.length, 500);
});

test("tolerates missing optional context", () => {
  const entry = recordFeedback({ rating: "down" });
  assert.equal(entry.message, null);
  assert.equal(entry.question, null);
});

test("summarises counts by rating", () => {
  recordFeedback({ rating: "up" });
  recordFeedback({ rating: "up" });
  recordFeedback({ rating: "down" });

  assert.deepEqual(feedbackSummary(), { up: 2, down: 1, total: 3 });
});
