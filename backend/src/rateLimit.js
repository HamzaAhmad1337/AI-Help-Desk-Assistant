import { RATE_LIMIT } from "./config.js";

/**
 * Fixed-window rate limiter, keyed by client IP.
 *
 * In-memory by design: this guards a single node against runaway cost and
 * accidental request loops. A multi-instance deployment should front this
 * with a shared store (Redis) or an edge rate limit.
 */
const buckets = new Map();

// Drop expired buckets periodically so the map doesn't grow without bound.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, RATE_LIMIT.windowMs);
sweeper.unref?.();

export function rateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  const remaining = Math.max(0, RATE_LIMIT.maxRequests - bucket.count);
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT.maxRequests);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

  if (bucket.count > RATE_LIMIT.maxRequests) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader("Retry-After", retryAfter);
    return res.status(429).json({
      error: `Too many requests. Please wait ${retryAfter}s and try again.`,
    });
  }

  next();
}

export function _resetForTests() {
  buckets.clear();
}
