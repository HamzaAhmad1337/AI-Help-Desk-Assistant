import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { STATUS_CACHE_MS, STATUS_PROBE_TIMEOUT_MS } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const definitionsPath = path.join(__dirname, "..", "data", "service-status.json");

/**
 * Service health.
 *
 * Each service may declare a `probe` URL, overridable per service with an env
 * var (e.g. STATUS_PROBE_VPN). Where a probe is configured the service is
 * checked over HTTP and the result cached briefly; where it isn't, the status
 * declared in the data file is reported as-is. That keeps the board honest:
 * it never claims to have checked something it didn't.
 */
export const definitions = JSON.parse(readFileSync(definitionsPath, "utf-8"));

function probeUrlFor(key, definition) {
  return process.env[`STATUS_PROBE_${key.toUpperCase()}`] || definition.probe || null;
}

let cache = { at: 0, value: null };

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STATUS_PROBE_TIMEOUT_MS);

  const startedAt = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    return {
      status: res.ok ? "operational" : "degraded",
      note: res.ok ? "No known issues." : `Health check returned HTTP ${res.status}.`,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      status: "down",
      note:
        err.name === "AbortError"
          ? `Health check timed out after ${STATUS_PROBE_TIMEOUT_MS}ms.`
          : "Health check could not reach the service.",
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the current board. Results are cached for STATUS_CACHE_MS so a burst
 * of page loads doesn't turn into a burst of health checks.
 */
export async function getServiceStatus({ now = Date.now() } = {}) {
  if (cache.value && now - cache.at < STATUS_CACHE_MS) return cache.value;

  const entries = await Promise.all(
    Object.entries(definitions).map(async ([key, definition]) => {
      const url = probeUrlFor(key, definition);

      if (!url) {
        return [key, { name: definition.name, status: definition.status, note: definition.note, checked: false }];
      }

      const result = await probe(url);
      return [key, { name: definition.name, ...result, checked: true }];
    })
  );

  cache = { at: now, value: Object.fromEntries(entries) };
  return cache.value;
}

/** Synchronous view of declared status, used by the model's status tool. */
export function declaredStatus(key) {
  const definition = definitions[key];
  if (!definition) return null;
  return { name: definition.name, status: definition.status, note: definition.note };
}

export function _resetForTests() {
  cache = { at: 0, value: null };
}
