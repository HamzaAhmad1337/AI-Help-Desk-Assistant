import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const feedbackPath = path.join(dataDir, "feedback.jsonl");

const inMemoryOnly = process.env.NODE_ENV === "test";

export const RATINGS = ["up", "down"];

export class ValidationError extends Error {}

/** Kept only for tests and the summary endpoint; the file is the record. */
let entries = [];

/**
 * Records a thumbs up/down on an answer.
 *
 * Appends one JSON object per line rather than rewriting a array: feedback is
 * write-heavy and append-only, so this stays cheap and can't lose earlier
 * entries if a write is interrupted.
 */
export function recordFeedback({ rating, message, question }) {
  if (!RATINGS.includes(rating)) {
    throw new ValidationError(`Rating must be one of: ${RATINGS.join(", ")}.`);
  }

  const entry = {
    rating,
    // Truncated: this is a quality signal, not a transcript store.
    message: message ? String(message).slice(0, 2000) : null,
    question: question ? String(question).slice(0, 500) : null,
    at: new Date().toISOString(),
  };

  entries.push(entry);

  if (!inMemoryOnly) {
    try {
      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
      appendFileSync(feedbackPath, JSON.stringify(entry) + "\n");
    } catch (err) {
      // Never fail the user's request because telemetry couldn't be written.
      console.error("Could not persist feedback:", err.message);
    }
  }

  return entry;
}

/** Aggregate counts, for spotting answers that consistently miss. */
export function feedbackSummary() {
  const all = inMemoryOnly ? entries : loadFromDisk();
  const up = all.filter((e) => e.rating === "up").length;
  const down = all.filter((e) => e.rating === "down").length;
  return { up, down, total: all.length };
}

function loadFromDisk() {
  if (!existsSync(feedbackPath)) return [];
  try {
    return readFileSync(feedbackPath, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null; // Skip a torn final line rather than failing the read.
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error("Could not read feedback:", err.message);
    return [];
  }
}

export function _resetForTests() {
  entries = [];
}
