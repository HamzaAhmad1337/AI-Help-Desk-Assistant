import { toolDefinitions, executeTool } from "./tools.js";
import { searchKnowledgeBase } from "./knowledgeBase.js";
import { MODEL, MAX_TOKENS, MAX_AGENT_TURNS, MAX_HISTORY_MESSAGES } from "./config.js";

export const SYSTEM_PROMPT = `You are Nova, the AI help desk assistant for an IT support team.

Your job is to resolve the user's IT problem in chat whenever possible.

How to work:
- Call search_knowledge_base for any technical problem before answering, so your advice
  matches documented company procedure instead of generic troubleshooting.
- If the problem involves a shared service (email, VPN, WiFi, SSO, printing, file shares),
  call check_service_status first. If that service is degraded or down, say so immediately
  rather than making the user troubleshoot a problem on their end.
- Only call create_support_ticket after in-chat troubleshooting has failed or the user asks
  for a ticket. Always ask the user to confirm before you open one, and include what was
  already tried in the description.

How to write:
- Be warm, direct, and brief. Lead with the fix, not with preamble.
- Use short numbered steps for troubleshooting. Use **bold** for anything the user must
  click, type, or select.
- Never invent policies, URLs, phone numbers, or ticket references. If you don't know
  something, say so and offer to open a ticket.
- If a request is outside IT support, say it's outside the help desk's scope and point the
  user to the right team.`;

/** Trims history to the recent window and strips anything that isn't a plain turn. */
function normalizeHistory(history) {
  return history
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Runs the assistant without an API key: answers straight from the knowledge
 * base so the product still works end to end in local/demo setups.
 */
async function* runOffline(message, history = []) {
  // Short follow-ups ("what about step 3?") carry no searchable terms on their
  // own, so fold in the previous user turn to keep retrieval on topic.
  const previousUserTurn = [...normalizeHistory(history)]
    .reverse()
    .find((m) => m.role === "user");

  const isFollowUp = message.trim().split(/\s+/).length <= 4;
  const query =
    isFollowUp && previousUserTurn ? `${previousUserTurn.content} ${message}` : message;

  const articles = searchKnowledgeBase(query);

  const reply =
    articles.length > 0
      ? articles[0].answer
      : "I couldn't find a matching help article for that, and AI answers aren't " +
        "configured on this server (no ANTHROPIC_API_KEY). Please open a ticket with IT " +
        "and include any error message you're seeing.";

  // Emit word by word so the offline path streams like the AI path.
  for (const word of reply.split(" ")) {
    yield { type: "delta", text: word + " " };
    await new Promise((resolve) => setTimeout(resolve, 15));
  }

  yield {
    type: "done",
    source: articles.length > 0 ? "knowledge-base" : "fallback",
    // Cite only the article the answer actually came from. The remaining
    // matches were ranked but never used, so listing them would misattribute.
    articles: articles.slice(0, 1),
  };
}

/**
 * Streams an agent turn as a sequence of events:
 *   { type: "delta", text }        incremental assistant text
 *   { type: "tool", name, status } a tool started / finished
 *   { type: "ticket", ticket }     a support ticket was opened
 *   { type: "done", articles }     turn complete
 *   { type: "error", error }       unrecoverable failure
 */
export async function* runAgent({ client, message, history = [] }) {
  if (!client) {
    yield* runOffline(message, history);
    return;
  }

  const messages = [...normalizeHistory(history), { role: "user", content: message }];
  const citedArticles = new Map();
  let createdTicket = null;

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "delta", text: event.delta.text };
      }
    }

    const final = await stream.finalMessage();
    messages.push({ role: "assistant", content: final.content });

    const toolUses = final.content.filter((block) => block.type === "tool_use");
    if (toolUses.length === 0) {
      yield {
        type: "done",
        source: "ai",
        articles: [...citedArticles.values()],
        ticket: createdTicket,
      };
      return;
    }

    const toolResults = [];
    for (const toolUse of toolUses) {
      yield { type: "tool", name: toolUse.name, status: "running" };

      const { result, articles = [], ticket } = await executeTool(toolUse.name, toolUse.input);

      for (const article of articles) {
        citedArticles.set(article.id, article);
      }
      if (ticket) {
        createdTicket = ticket;
        yield { type: "ticket", ticket };
      }

      yield { type: "tool", name: toolUse.name, status: "done" };

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  // Ran out of turns - close the conversation cleanly rather than hanging.
  yield {
    type: "done",
    source: "ai",
    articles: [...citedArticles.values()],
    ticket: createdTicket,
    truncated: true,
  };
}
