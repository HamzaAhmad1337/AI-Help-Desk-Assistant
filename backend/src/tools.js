import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { searchKnowledgeBase } from "./knowledgeBase.js";
import { createTicket, ValidationError } from "./tickets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceStatus = JSON.parse(
  readFileSync(path.join(__dirname, "..", "data", "service-status.json"), "utf-8")
);

/** Tool schemas advertised to the model. */
export const toolDefinitions = [
  {
    name: "search_knowledge_base",
    description:
      "Search the internal IT knowledge base for troubleshooting articles. Use this " +
      "whenever the user describes a technical problem, so your answer is grounded in " +
      "documented company procedures rather than generic advice.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The user's problem, in plain language. e.g. 'cannot connect to vpn'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "check_service_status",
    description:
      "Check whether a company IT service is currently degraded or down. Use this before " +
      "walking a user through lengthy troubleshooting, so you don't send them chasing a " +
      "problem that is actually a known outage.",
    input_schema: {
      type: "object",
      properties: {
        service: {
          type: "string",
          enum: Object.keys(serviceStatus),
          description: "The service to check.",
        },
      },
      required: ["service"],
    },
  },
  {
    name: "create_support_ticket",
    description:
      "Open a support ticket with the IT team. Only call this after you have tried to " +
      "resolve the issue in chat and either it did not work or the user explicitly asks " +
      "for a ticket. Always confirm with the user before opening a ticket.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Short one-line summary of the issue." },
        description: {
          type: "string",
          description:
            "Full details: what the user reported, what troubleshooting was already " +
            "attempted, and any error messages.",
        },
        priority: {
          type: "string",
          enum: ["low", "normal", "high", "urgent"],
          description:
            "urgent = user fully blocked from working; high = major feature broken; " +
            "normal = standard request; low = cosmetic or informational.",
        },
        category: {
          type: "string",
          description: "e.g. Account, Network, Hardware, Software, Email",
        },
      },
      required: ["subject", "description", "priority"],
    },
  },
];

/**
 * Executes a tool call. Errors are returned as tool results rather than thrown,
 * so the model can recover and explain the problem to the user.
 */
export async function executeTool(name, input) {
  switch (name) {
    case "search_knowledge_base": {
      const articles = searchKnowledgeBase(String(input.query ?? ""));
      if (articles.length === 0) {
        return {
          result: { found: false, message: "No matching knowledge base articles." },
          articles: [],
        };
      }
      return {
        result: {
          found: true,
          articles: articles.map((a) => ({
            id: a.id,
            category: a.category,
            question: a.question,
            answer: a.answer,
          })),
        },
        articles,
      };
    }

    case "check_service_status": {
      const service = serviceStatus[input.service];
      if (!service) {
        return { result: { error: `Unknown service '${input.service}'.` }, articles: [] };
      }
      return { result: service, articles: [] };
    }

    case "create_support_ticket": {
      try {
        const ticket = createTicket({
          subject: input.subject,
          description: input.description,
          priority: input.priority,
          category: input.category,
        });
        return { result: { created: true, ...ticket }, articles: [], ticket };
      } catch (err) {
        if (err instanceof ValidationError) {
          return { result: { created: false, error: err.message }, articles: [] };
        }
        throw err;
      }
    }

    default:
      return { result: { error: `Unknown tool '${name}'.` }, articles: [] };
  }
}

export { serviceStatus };
