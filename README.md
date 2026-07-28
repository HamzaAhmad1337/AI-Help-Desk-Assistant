# AI Help Desk Assistant

A full-stack IT help desk chatbot. It answers common IT support questions
(password resets, VPN, WiFi, email, printers, MFA, account lockouts, etc.)
using a built-in knowledge base, and falls back to Claude (Anthropic API)
for anything the knowledge base doesn't cover.

## Stack

- **Backend**: Node.js + Express, `@anthropic-ai/sdk`
- **Frontend**: React + Vite

## Project structure

```
backend/    Express API, knowledge base, Claude integration
frontend/   React chat UI
```

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm start               # runs on http://localhost:3001
```

If `ANTHROPIC_API_KEY` is not set, the backend still runs and answers using
the knowledge base only (no AI fallback).

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # points at the backend URL
npm run dev              # runs on http://localhost:5173
```

Open http://localhost:5173 in your browser.

## How it works

1. Every user message is matched against `backend/data/knowledge-base.json`
   using keyword scoring.
2. If Claude is configured, the matched articles are passed to Claude as
   context so it can give a grounded, natural-language answer with
   troubleshooting steps.
3. If Claude is not configured, the best-matching knowledge base article is
   returned directly.

## Extending

- Add more articles to `backend/data/knowledge-base.json` (id, category,
  question, keywords, answer).
- Adjust the system prompt in `backend/src/server.js` to change tone/scope.
- Swap the naive keyword search in `backend/src/knowledgeBase.js` for a
  vector/embedding search if the knowledge base grows large.
