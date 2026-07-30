export const PORT = Number(process.env.PORT) || 3001;

export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
export const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 1024;

/** Upper bound on tool-use round trips per user message. */
export const MAX_AGENT_TURNS = 5;

/** Conversation turns replayed to the model on each request. */
export const MAX_HISTORY_MESSAGES = 12;

/** Rejected above this length to bound token spend per request. */
export const MAX_MESSAGE_LENGTH = 4000;

/** Comma-separated origins, or "*" to allow any. */
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Express "trust proxy" setting. Unset by default: enable it only when the
 * app genuinely sits behind a proxy, e.g. `1` for a single hop, or a CIDR.
 */
export const TRUST_PROXY = process.env.TRUST_PROXY || null;

export const RATE_LIMIT = {
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  maxRequests: Number(process.env.RATE_LIMIT_MAX) || 20,
};
