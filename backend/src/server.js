import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { pathToFileURL } from "url";

import { PORT, ALLOWED_ORIGINS, MAX_MESSAGE_LENGTH, TRUST_PROXY } from "./config.js";
import {
  recordFeedback,
  feedbackSummary,
  ValidationError as FeedbackValidationError,
} from "./feedback.js";
import { runAgent } from "./agent.js";
import { knowledgeBase, categories } from "./knowledgeBase.js";
import { serviceStatus } from "./tools.js";
import { createTicket, listTickets, getTicket, ValidationError } from "./tickets.js";
import { rateLimit } from "./rateLimit.js";

export const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export function createApp({ anthropic = client } = {}) {
  const app = express();

  // Behind a load balancer every request arrives from the proxy's address, so
  // without this the rate limiter would treat all users as a single client.
  // Opt-in, because trusting the header unconditionally lets a direct caller
  // spoof X-Forwarded-For and evade the limit entirely.
  if (TRUST_PROXY) app.set("trust proxy", TRUST_PROXY);

  app.use(
    cors({
      origin: ALLOWED_ORIGINS.includes("*") ? true : ALLOWED_ORIGINS,
    })
  );
  app.use(express.json({ limit: "64kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      aiEnabled: Boolean(anthropic),
      articles: knowledgeBase.length,
    });
  });

  app.get("/api/kb", (_req, res) => {
    res.json({ categories, articles: knowledgeBase });
  });

  app.get("/api/status", (_req, res) => {
    res.json(serviceStatus);
  });

  /** Validates the shared chat request body. Returns an error string, or null. */
  function validateChatBody(body) {
    const { message, history } = body ?? {};
    if (typeof message !== "string" || !message.trim()) {
      return "Message is required.";
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`;
    }
    if (history !== undefined && !Array.isArray(history)) {
      return "History must be an array.";
    }
    return null;
  }

  app.post("/api/chat/stream", rateLimit, async (req, res) => {
    const invalid = validateChatBody(req.body);
    if (invalid) return res.status(400).json({ error: invalid });

    const { message, history = [] } = req.body;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Stop generating if the user closes the widget or navigates away.
    // This must listen on the response, not the request: `req` emits "close"
    // as soon as its body has been consumed, which would abort every stream.
    let clientGone = false;
    res.on("close", () => {
      clientGone = true;
    });

    const write = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Keeps intermediaries from closing an idle connection during long tool calls.
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);

    try {
      for await (const event of runAgent({ client: anthropic, message, history })) {
        if (clientGone) break;
        const { type, ...payload } = event;
        write(type, payload);
      }
    } catch (err) {
      console.error("Agent error:", err);
      if (!clientGone) {
        write("error", { error: "Something went wrong processing your request." });
      }
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });

  /** Non-streaming equivalent, for integrations that can't consume SSE. */
  app.post("/api/chat", rateLimit, async (req, res) => {
    const invalid = validateChatBody(req.body);
    if (invalid) return res.status(400).json({ error: invalid });

    const { message, history = [] } = req.body;

    try {
      let reply = "";
      let articles = [];
      let ticket = null;

      for await (const event of runAgent({ client: anthropic, message, history })) {
        if (event.type === "delta") reply += event.text;
        if (event.type === "done") {
          articles = event.articles ?? [];
          ticket = event.ticket ?? null;
        }
        if (event.type === "error") throw new Error(event.error);
      }

      res.json({ reply: reply.trim(), articles, ticket });
    } catch (err) {
      console.error("Chat error:", err);
      res.status(500).json({ error: "Something went wrong processing your request." });
    }
  });

  app.get("/api/tickets", (_req, res) => {
    res.json(listTickets());
  });

  app.get("/api/tickets/:reference", (req, res) => {
    const ticket = getTicket(req.params.reference);
    if (!ticket) return res.status(404).json({ error: "Ticket not found." });
    res.json(ticket);
  });

  app.post("/api/tickets", rateLimit, (req, res) => {
    try {
      res.status(201).json(createTicket(req.body ?? {}));
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({ error: err.message });
      }
      console.error("Ticket error:", err);
      res.status(500).json({ error: "Could not create ticket." });
    }
  });

  app.post("/api/feedback", rateLimit, (req, res) => {
    try {
      recordFeedback(req.body ?? {});
      res.status(204).end();
    } catch (err) {
      if (err instanceof FeedbackValidationError) {
        return res.status(400).json({ error: err.message });
      }
      console.error("Feedback error:", err);
      res.status(500).json({ error: "Could not record feedback." });
    }
  });

  app.get("/api/feedback/summary", (_req, res) => {
    res.json(feedbackSummary());
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found." }));

  // Without this, malformed or oversized JSON bodies fall through to Express's
  // default handler, which replies with an HTML error page that clients parsing
  // JSON cannot read.
  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
  app.use((err, _req, res, _next) => {
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body is too large." });
    }
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "Request body is not valid JSON." });
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Something went wrong." });
  });

  return app;
}

// Only start a server when run directly, so tests can import createApp cleanly.
// Compares resolved paths rather than basenames, which would also match any
// unrelated entrypoint that happened to be called server.js.
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const server = createApp().listen(PORT, () => {
    console.log(`AI Help Desk backend running on http://localhost:${PORT}`);
    if (!client) {
      console.warn("ANTHROPIC_API_KEY not set - running in knowledge-base-only mode.");
    }
  });

  // A port clash is an operator mistake, not a bug worth a raw stack trace.
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Stop the process using it, or set PORT to something else.`
      );
      process.exit(1);
    }
    throw err;
  });

  // Let in-flight replies finish on deploy rather than cutting streams mid-answer.
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => {
      console.log(`\n${signal} received, closing server...`);

      const forceExit = setTimeout(() => {
        console.warn("Shutdown timed out, exiting.");
        process.exit(1);
      }, 10_000);
      forceExit.unref();

      server.close(() => {
        console.log("Closed cleanly.");
        process.exit(0);
      });
    });
  }
}
