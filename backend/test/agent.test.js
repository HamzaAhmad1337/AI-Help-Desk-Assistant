import test from "node:test";
import assert from "node:assert/strict";
import { runAgent } from "../src/agent.js";
import { _resetForTests } from "../src/tickets.js";

test.beforeEach(() => _resetForTests());

/**
 * Builds a stub Anthropic client that replays scripted turns.
 * Each turn is { text, toolUses } and becomes one model response.
 */
function mockClient(turns) {
  let call = 0;
  const seen = [];

  return {
    seen,
    messages: {
      stream(request) {
        const turn = turns[call++] ?? { text: "" };
        // Snapshot the messages: the agent keeps appending to the same array.
        seen.push({ ...request, messages: [...request.messages] });

        const content = [];
        if (turn.text) content.push({ type: "text", text: turn.text });
        for (const use of turn.toolUses ?? []) content.push({ type: "tool_use", ...use });

        return {
          async *[Symbol.asyncIterator]() {
            for (const chunk of (turn.text ?? "").split(" ").filter(Boolean)) {
              yield {
                type: "content_block_delta",
                delta: { type: "text_delta", text: chunk + " " },
              };
            }
          },
          async finalMessage() {
            return { content };
          },
        };
      },
    },
  };
}

async function collect(iterator) {
  const events = [];
  for await (const event of iterator) events.push(event);
  return events;
}

test("offline mode answers from the knowledge base", async () => {
  const events = await collect(runAgent({ client: null, message: "how do I reset my password" }));

  const text = events.filter((e) => e.type === "delta").map((e) => e.text).join("");
  const done = events.at(-1);

  assert.match(text, /Forgot Password/);
  assert.equal(done.type, "done");
  assert.equal(done.source, "knowledge-base");
  assert.equal(done.articles[0].id, "password-reset");
});

test("offline mode falls back gracefully with no match", async () => {
  const events = await collect(runAgent({ client: null, message: "tell me a joke" }));
  assert.equal(events.at(-1).source, "fallback");
});

test("streams plain text when the model uses no tools", async () => {
  const client = mockClient([{ text: "Try restarting it." }]);
  const events = await collect(runAgent({ client, message: "help" }));

  const text = events.filter((e) => e.type === "delta").map((e) => e.text).join("");
  assert.match(text, /Try restarting it/);
  assert.equal(events.at(-1).type, "done");
});

test("executes a knowledge base tool call and cites the article", async () => {
  const client = mockClient([
    {
      toolUses: [
        { id: "t1", name: "search_knowledge_base", input: { query: "reset password" } },
      ],
    },
    { text: "Use the Forgot Password link." },
  ]);

  const events = await collect(runAgent({ client, message: "password help" }));

  const toolEvents = events.filter((e) => e.type === "tool");
  assert.equal(toolEvents[0].name, "search_knowledge_base");
  assert.deepEqual(
    toolEvents.map((e) => e.status),
    ["running", "done"]
  );

  const done = events.at(-1);
  assert.equal(done.articles[0].id, "password-reset");

  // The tool result must be fed back to the model on the following turn.
  const followUp = client.seen[1].messages.at(-1);
  assert.equal(followUp.role, "user");
  assert.equal(followUp.content[0].type, "tool_result");
  assert.equal(followUp.content[0].tool_use_id, "t1");
});

test("creating a ticket emits a ticket event", async () => {
  const client = mockClient([
    {
      toolUses: [
        {
          id: "t1",
          name: "create_support_ticket",
          input: { subject: "VPN broken", description: "Tried restarting.", priority: "high" },
        },
      ],
    },
    { text: "I've opened that for you." },
  ]);

  const events = await collect(runAgent({ client, message: "please open a ticket" }));

  const ticketEvent = events.find((e) => e.type === "ticket");
  assert.ok(ticketEvent, "expected a ticket event");
  assert.equal(ticketEvent.ticket.subject, "VPN broken");
  assert.equal(ticketEvent.ticket.priority, "high");
  assert.equal(events.at(-1).ticket.reference, ticketEvent.ticket.reference);
});

test("an invalid tool call is reported back instead of throwing", async () => {
  const client = mockClient([
    {
      toolUses: [
        { id: "t1", name: "create_support_ticket", input: { subject: "", description: "" } },
      ],
    },
    { text: "I need a bit more detail first." },
  ]);

  const events = await collect(runAgent({ client, message: "ticket" }));

  assert.equal(events.filter((e) => e.type === "ticket").length, 0);
  const result = JSON.parse(client.seen[1].messages.at(-1).content[0].content);
  assert.equal(result.created, false);
  assert.match(result.error, /subject is required/);
});

test("stops after the turn limit instead of looping forever", async () => {
  const looping = Array.from({ length: 20 }, () => ({
    toolUses: [{ id: "t", name: "search_knowledge_base", input: { query: "vpn" } }],
  }));

  const events = await collect(runAgent({ client: mockClient(looping), message: "vpn" }));

  const done = events.at(-1);
  assert.equal(done.type, "done");
  assert.equal(done.truncated, true);
});

test("history is trimmed and malformed turns are dropped", async () => {
  const client = mockClient([{ text: "ok" }]);
  const history = [
    { role: "system", content: "ignore me" },
    { role: "user", content: "" },
    ...Array.from({ length: 30 }, (_, i) => ({ role: "user", content: `msg ${i}` })),
  ];

  await collect(runAgent({ client, message: "latest", history }));

  const sent = client.seen[0].messages;
  assert.ok(sent.length <= 13, `expected trimmed history, got ${sent.length}`);
  assert.ok(sent.every((m) => m.role === "user" || m.role === "assistant"));
  assert.equal(sent.at(-1).content, "latest");
});

test("tools are advertised to the model", async () => {
  const client = mockClient([{ text: "hi" }]);
  await collect(runAgent({ client, message: "hi" }));

  const names = client.seen[0].tools.map((t) => t.name);
  assert.deepEqual(names.sort(), [
    "check_service_status",
    "create_support_ticket",
    "search_knowledge_base",
  ]);
});

test("offline mode cites only the article it answered from", async () => {
  const events = await collect(runAgent({ client: null, message: "printer not working" }));
  const done = events.at(-1);
  assert.equal(done.articles.length, 1);
  assert.equal(done.articles[0].id, "printer-issues");
});
