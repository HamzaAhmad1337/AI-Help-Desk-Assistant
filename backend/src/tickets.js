import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const ticketsPath = path.join(dataDir, "tickets.json");

export const PRIORITIES = ["low", "normal", "high", "urgent"];
export const STATUSES = ["open", "in_progress", "resolved", "closed"];

/** Tests run against an in-memory store so they never touch the data file. */
const inMemoryOnly = process.env.NODE_ENV === "test";

function load() {
  if (inMemoryOnly || !existsSync(ticketsPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(ticketsPath, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Could not read tickets store, starting empty:", err.message);
    return [];
  }
}

let tickets = load();

function persist() {
  if (inMemoryOnly) return;
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
}

function nextReference() {
  const year = new Date().getFullYear();
  // Reference numbers restart each year, so only count this year's tickets.
  const countThisYear = tickets.filter((t) => t.reference.includes(`-${year}-`)).length;
  return `HD-${year}-${String(countThisYear + 1).padStart(4, "0")}`;
}

export class ValidationError extends Error {}

export function createTicket({ subject, description, priority = "normal", category, contact }) {
  if (!subject || !String(subject).trim()) {
    throw new ValidationError("A ticket subject is required.");
  }
  if (!description || !String(description).trim()) {
    throw new ValidationError("A ticket description is required.");
  }
  if (!PRIORITIES.includes(priority)) {
    throw new ValidationError(`Priority must be one of: ${PRIORITIES.join(", ")}.`);
  }

  const ticket = {
    reference: nextReference(),
    subject: String(subject).trim().slice(0, 200),
    description: String(description).trim().slice(0, 4000),
    priority,
    category: category ? String(category).trim().slice(0, 60) : "General",
    contact: contact ? String(contact).trim().slice(0, 200) : null,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  tickets.push(ticket);
  persist();
  return ticket;
}

export function listTickets({ limit = 50 } = {}) {
  return [...tickets].reverse().slice(0, limit);
}

export function getTicket(reference) {
  return tickets.find((t) => t.reference === reference) ?? null;
}

/** Test hook - clears the in-memory store without touching disk. */
export function _resetForTests() {
  tickets = [];
}
