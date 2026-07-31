# Nova — AI Help Desk Assistant

An IT help desk assistant that actually resolves things. Nova troubleshoots in chat
using a retrieval-backed knowledge base, checks live service status before sending
anyone down a rabbit hole, and opens a real support ticket when chat isn't enough.

## Stack

- **Backend** — Node.js + Express, `@anthropic-ai/sdk`, streaming over SSE
- **Frontend** — React + Vite, no runtime dependencies beyond React

## Quick start

```bash
# Backend
cd backend
npm install
cp .env.example .env      # add ANTHROPIC_API_KEY
npm start                 # http://localhost:3001

# Frontend (second terminal)
cd frontend
npm install
cp .env.example .env
npm run dev               # http://localhost:5173
```

Without an `ANTHROPIC_API_KEY` the app still runs end to end: it answers directly from
the knowledge base and streams those answers word by word, so the UX is identical.

## Architecture

```
backend/src/
  server.js        HTTP routes, SSE transport, validation
  agent.js         agentic loop - streams text, runs tools, feeds results back
  tools.js         tool schemas + executors exposed to the model
  knowledgeBase.js article loading and retrieval
  lib/search.js    BM25 retrieval with stemming and synonym expansion
  tickets.js       ticket store with references, priorities, persistence
  rateLimit.js     per-IP sliding-window limiter, pluggable store
  serviceStatus.js health probes with TTL caching
  feedback.js      append-only answer ratings
  config.js        env-driven configuration

frontend/src/
  App.jsx              landing page, theme handling
  ChatWidget.jsx       chat panel, focus management, keyboard handling
  lib/useChat.js       conversation state, SSE parsing, persistence, retry
  lib/markdown.jsx     safe Markdown -> React renderer
  components/          Message, Icons, ErrorBoundary,
                       ServiceStatus, TicketPanel
```

### The agent loop

Nova is an agent, not a scripted bot. Each user message runs a tool-use loop
(bounded to 5 turns) where the model can call:

| Tool | Purpose |
| --- | --- |
| `search_knowledge_base` | Ground answers in documented procedure |
| `check_service_status` | Detect a known outage before troubleshooting |
| `create_support_ticket` | Escalate with full context attached |

Tool activity is streamed to the UI, so the user sees "Searching the knowledge
base…" rather than an unexplained pause.

### Service status

Each service may declare a probe URL, overridable per service via
`STATUS_PROBE_<SERVICE>`. Where one is configured the service is checked over
HTTP (with a timeout) and the result cached; where it isn't, the status
declared in the data file is reported and flagged `checked: false`. The board
never claims to have checked something it didn't, and the model's
`check_service_status` tool reads the same board the status page shows, so the
two can't disagree.

### Rate limiting

A sliding window, not a fixed one: a fixed window lets a client spend its
whole quota at the end of one window and again at the start of the next, a 2x
burst across the boundary. The previous window's count is weighted by how much
of it still overlaps, which stays O(1) per request. The store is pluggable, so
a multi-instance deployment can swap in Redis without touching the logic.

### Retrieval

`lib/search.js` implements BM25 over the article set with three additions that
measurably improved routing:

- **Stemming**, applied repeatedly, so `printers` → `printer` → `print`
- **Weighted synonym expansion** — synonyms count for less than words the user
  actually typed, so a term with many synonyms can't outvote a rare, specific one
- **A coordination factor**, rewarding documents that match more distinct query
  terms, which is what separates "VPN is slow" from generic slowness

Queries with no indexed terms return nothing rather than a spurious article.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Status and whether AI is enabled |
| `GET` | `/api/kb` | Categories and articles |
| `GET` | `/api/status` | Service status board |
| `POST` | `/api/chat/stream` | Streaming chat (SSE) |
| `POST` | `/api/chat` | Non-streaming chat |
| `GET` | `/api/tickets` | List tickets |
| `POST` | `/api/tickets` | Create a ticket |
| `GET` | `/api/tickets/:reference` | Fetch one ticket |
| `PATCH` | `/api/tickets/:reference` | Move a ticket's status |
| `POST` | `/api/feedback` | Rate an answer (thumbs up/down) |
| `GET` | `/api/feedback/summary` | Aggregate rating counts |

SSE events: `delta` (text), `tool` (activity), `ticket` (created), `done`, `error`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Enables AI answers; omit for KB-only mode |
| `PORT` | `3001` | Backend port |
| `CLAUDE_MODEL` | `claude-sonnet-5` | Model id |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS allowlist |
| `RATE_LIMIT_MAX` | `20` | Requests per window per IP |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window length |
| `TRUST_PROXY` | unset | Set only when behind a proxy, e.g. `1` |
| `STATUS_PROBE_<SERVICE>` | unset | Health check URL, e.g. `STATUS_PROBE_VPN` |
| `STATUS_CACHE_MS` | `15000` | How long a probed board stays cached |
| `STATUS_PROBE_TIMEOUT_MS` | `3000` | Per-service probe timeout |

## Tests

```bash
cd backend  && npm test    # 72 tests
cd frontend && npm test    # 18 tests
```

The backend suite covers retrieval quality, the agent tool loop, ticket
validation, request validation, SSE framing, and rate limiting. The frontend
suite covers the Markdown renderer, including that injected markup and
`javascript:` URLs are never turned into live elements.

CI runs both suites (backend on Node 22 and 24), plus lint, a production
build, and a JSON validity check on the data files. See
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Security

Responses set `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Cross-Origin-Resource-Policy` and a `default-src 'none'` CSP, and the
`X-Powered-By` fingerprint is removed. Assistant output is rendered through a
Markdown renderer that builds React elements directly — nothing reaches
`dangerouslySetInnerHTML`, and only `http(s)`/`mailto` links are ever made
clickable.

## Accessibility

Escape closes the widget, Tab is trapped inside it while open, replies are
announced via an ARIA live region once settled (never mid-stream), focus is
visible throughout, and all motion respects `prefers-reduced-motion`.
Hover-revealed controls are shown outright under `(hover: none)`, so they stay
reachable on touch devices. Light and dark themes both ship, and the layout is
verified at mobile width.

## Extending

- Add articles to `backend/data/knowledge-base.json` (`id`, `category`,
  `question`, `keywords`, `answer`). Use `\n`-separated steps for numbered lists.
- Add a tool in `backend/src/tools.js` — define the schema, add a case to
  `executeTool`, and give it a label in `frontend/src/lib/useChat.js`.
- Swap `lib/search.js` for embeddings if the knowledge base outgrows BM25.
