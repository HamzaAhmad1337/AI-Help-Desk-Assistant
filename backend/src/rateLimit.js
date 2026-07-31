import { RATE_LIMIT } from "./config.js";

/**
 * Sliding-window rate limiter.
 *
 * A fixed window lets a client send the full quota at the very end of one
 * window and again at the start of the next - a 2x burst straddling the
 * boundary. This weights the previous window's count by how much of it still
 * overlaps the trailing period, which smooths that out while staying O(1) per
 * request (no per-request timestamp list).
 *
 * The store is pluggable: the default keeps counters in this process, which
 * guards a single node. A multi-instance deployment can pass a store backed by
 * Redis (INCR + PEXPIRE on the same keys) without touching this logic.
 */
export function createMemoryStore() {
  const windows = new Map();

  const sweeper = setInterval(() => {
    const cutoff = Date.now() - RATE_LIMIT.windowMs * 2;
    for (const [key, entry] of windows) {
      if (entry.windowStart < cutoff) windows.delete(key);
    }
  }, RATE_LIMIT.windowMs);
  sweeper.unref?.();

  return {
    get: (key) => windows.get(key),
    set: (key, value) => windows.set(key, value),
    clear: () => windows.clear(),
  };
}

const defaultStore = createMemoryStore();

/**
 * Returns the decision for a key without mutating anything the caller can't
 * see - exported so the behaviour is directly testable.
 */
export function consume(store, key, now, { windowMs, maxRequests }) {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const entry = store.get(key);

  let previous = 0;
  let current = 0;

  if (entry) {
    if (entry.windowStart === windowStart) {
      previous = entry.previous;
      current = entry.current;
    } else if (entry.windowStart === windowStart - windowMs) {
      // Last window rolls into the "previous" slot; anything older is stale.
      previous = entry.current;
    }
  }

  // Fraction of the previous window still inside the trailing window.
  const elapsed = (now - windowStart) / windowMs;
  const weighted = previous * (1 - elapsed) + current + 1;

  const allowed = weighted <= maxRequests;
  if (allowed) current += 1;

  store.set(key, { windowStart, previous, current });

  const resetAt = windowStart + windowMs;
  return {
    allowed,
    remaining: Math.max(0, Math.floor(maxRequests - weighted)),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

export function createRateLimit({ store = defaultStore, ...overrides } = {}) {
  const options = { ...RATE_LIMIT, ...overrides };

  return function rateLimitMiddleware(req, res, next) {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const result = consume(store, key, Date.now(), options);

    res.setHeader("RateLimit-Limit", options.maxRequests);
    res.setHeader("RateLimit-Remaining", result.remaining);
    res.setHeader("RateLimit-Reset", Math.ceil(result.resetAt / 1000));
    // Retained alongside the standard names for existing clients.
    res.setHeader("X-RateLimit-Limit", options.maxRequests);
    res.setHeader("X-RateLimit-Remaining", result.remaining);

    if (!result.allowed) {
      res.setHeader("Retry-After", result.retryAfterSeconds);
      return res.status(429).json({
        error: `Too many requests. Please wait ${result.retryAfterSeconds}s and try again.`,
      });
    }

    next();
  };
}

export const rateLimit = createRateLimit();

export function _resetForTests() {
  defaultStore.clear();
}
