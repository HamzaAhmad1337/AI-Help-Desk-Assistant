import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server.js";
import { _resetForTests as resetTickets } from "../src/tickets.js";
import { _resetForTests as resetRateLimit } from "../src/rateLimit.js";
import { _resetForTests as resetFeedback } from "../src/feedback.js";

/** Starts the app on an ephemeral port and returns a fetch helper. */
async function withServer(run) {
  const server = createApp({ anthropic: null }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await run((path, init) => fetch(base + path, init));
  } finally {
    server.close();
  }
}

const postJson = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

test.beforeEach(() => {
  resetTickets();
  resetRateLimit();
  resetFeedback();
});

test("health reports status and article count", async () => {
  await withServer(async (request) => {
    const body = await (await request("/api/health")).json();
    assert.equal(body.status, "ok");
    assert.equal(body.aiEnabled, false);
    assert.ok(body.articles > 0);
  });
});

test("kb endpoint returns categories and articles", async () => {
  await withServer(async (request) => {
    const body = await (await request("/api/kb")).json();
    assert.ok(Array.isArray(body.articles));
    assert.ok(body.categories.includes("Account"));
  });
});

test("chat rejects an empty message", async () => {
  await withServer(async (request) => {
    const res = await request("/api/chat", postJson({ message: "   " }));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /required/i);
  });
});

test("chat rejects an overlong message", async () => {
  await withServer(async (request) => {
    const res = await request("/api/chat", postJson({ message: "x".repeat(5000) }));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /too long/i);
  });
});

test("chat rejects a non-array history", async () => {
  await withServer(async (request) => {
    const res = await request("/api/chat", postJson({ message: "hi", history: "nope" }));
    assert.equal(res.status, 400);
  });
});

test("chat answers from the knowledge base", async () => {
  await withServer(async (request) => {
    const res = await request("/api/chat", postJson({ message: "how do I reset my password" }));
    const body = await res.json();
    assert.match(body.reply, /Forgot Password/);
    assert.equal(body.articles[0].id, "password-reset");
  });
});

test("streaming endpoint emits SSE delta and done events", async () => {
  await withServer(async (request) => {
    const res = await request("/api/chat/stream", postJson({ message: "reset my password" }));
    assert.equal(res.headers.get("content-type"), "text/event-stream");

    const text = await res.text();
    assert.match(text, /^event: delta$/m);
    assert.match(text, /^event: done$/m);

    const deltas = [...text.matchAll(/^event: delta\ndata: (.+)$/gm)]
      .map((m) => JSON.parse(m[1]).text)
      .join("");
    assert.match(deltas, /Forgot Password/);
  });
});

test("tickets can be created and read back", async () => {
  await withServer(async (request) => {
    const created = await request(
      "/api/tickets",
      postJson({ subject: "Laptop dead", description: "Won't power on.", priority: "urgent" })
    );
    assert.equal(created.status, 201);

    const ticket = await created.json();
    assert.equal(ticket.priority, "urgent");

    const fetched = await (await request(`/api/tickets/${ticket.reference}`)).json();
    assert.equal(fetched.subject, "Laptop dead");

    const all = await (await request("/api/tickets")).json();
    assert.equal(all.length, 1);
  });
});

test("ticket validation errors return 400", async () => {
  await withServer(async (request) => {
    const res = await request("/api/tickets", postJson({ subject: "no body" }));
    assert.equal(res.status, 400);
  });
});

test("unknown ticket returns 404", async () => {
  await withServer(async (request) => {
    assert.equal((await request("/api/tickets/HD-0000-0001")).status, 404);
  });
});

test("unknown route returns 404 json", async () => {
  await withServer(async (request) => {
    const res = await request("/api/nope");
    assert.equal(res.status, 404);
    assert.match((await res.json()).error, /Not found/);
  });
});

test("rate limiting kicks in and reports headers", async () => {
  await withServer(async (request) => {
    let limited = null;

    for (let i = 0; i < 25; i++) {
      const res = await request("/api/chat", postJson({ message: "hello" }));
      if (res.status === 429) {
        limited = res;
        break;
      }
    }

    assert.ok(limited, "expected a 429 within 25 requests");
    assert.ok(limited.headers.get("retry-after"));
    assert.equal(limited.headers.get("x-ratelimit-remaining"), "0");
  });
});

test("feedback is accepted and summarised", async () => {
  await withServer(async (request) => {
    const res = await request(
      "/api/feedback",
      postJson({ rating: "up", message: "Nice", question: "vpn?" })
    );
    assert.equal(res.status, 204);

    await request("/api/feedback", postJson({ rating: "down" }));

    const summary = await (await request("/api/feedback/summary")).json();
    assert.deepEqual(summary, { up: 1, down: 1, total: 2 });
  });
});

test("feedback rejects an invalid rating", async () => {
  await withServer(async (request) => {
    const res = await request("/api/feedback", postJson({ rating: "meh" }));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Rating must be/);
  });
});

test("responses carry hardening headers and no framework fingerprint", async () => {
  await withServer(async (request) => {
    const res = await request("/api/health");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
    assert.match(res.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.equal(res.headers.get("x-powered-by"), null);
  });
});

test("status endpoint returns the service board", async () => {
  await withServer(async (request) => {
    const body = await (await request("/api/status")).json();
    assert.ok(body.vpn?.name, "expected a named vpn service");
    assert.ok(["operational", "degraded", "down"].includes(body.vpn.status));
  });
});
