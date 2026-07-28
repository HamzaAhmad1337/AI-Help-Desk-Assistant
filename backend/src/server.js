import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { searchKnowledgeBase, knowledgeBase } from "./knowledgeBase.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT = `You are an AI Help Desk Assistant for IT support. You help employees troubleshoot
common issues such as password resets, VPN/network connectivity, software installation, email,
printers, and account access. Be concise, friendly, and give clear numbered steps when
troubleshooting. If relevant internal knowledge base articles are provided, use them as the
primary source of truth and cite the fix from them. If a question is outside general IT support
(e.g. personal, legal, or unrelated topics), politely say it's outside the scope of the help desk
and suggest contacting the right team. If a problem can't be solved with these steps, tell the
user to open a support ticket with IT and include what they should have ready (error messages,
device info, screenshots).`;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", aiEnabled: Boolean(anthropic) });
});

app.get("/api/kb", (_req, res) => {
  res.json(knowledgeBase);
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const relevant = searchKnowledgeBase(message);

    if (!anthropic) {
      if (relevant.length > 0) {
        return res.json({
          reply: relevant[0].answer,
          source: "knowledge-base",
          articles: relevant,
        });
      }
      return res.json({
        reply:
          "I couldn't find a matching help article, and AI fallback is not configured " +
          "(missing ANTHROPIC_API_KEY). Please open a support ticket with IT for further help.",
        source: "fallback",
        articles: [],
      });
    }

    const kbContext =
      relevant.length > 0
        ? `Relevant knowledge base articles:\n${relevant
            .map((a) => `- ${a.question}: ${a.answer}`)
            .join("\n")}`
        : "No matching knowledge base articles were found for this question.";

    const messages = [
      ...history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: `${kbContext}\n\nUser question: ${message}` },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    res.json({ reply, source: "ai", articles: relevant });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Something went wrong processing your request." });
  }
});

app.listen(PORT, () => {
  console.log(`AI Help Desk backend running on http://localhost:${PORT}`);
  if (!anthropic) {
    console.warn("ANTHROPIC_API_KEY not set - running in knowledge-base-only mode.");
  }
});
