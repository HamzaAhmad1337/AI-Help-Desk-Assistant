import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
const STORAGE_KEY = "nova-conversation";
const MAX_STORED_MESSAGES = 50;

export const WELCOME_MESSAGE = {
  role: "assistant",
  content:
    "Hey there 👋 I'm Nova, your AI help desk assistant. Tell me what's going on and " +
    "I'll help you fix it — password resets, VPN, WiFi, email, printers, and more.\n\n" +
    "If we can't solve it here, I can open a support ticket for you.",
  time: Date.now(),
};

/** Human-readable labels for in-progress tool calls. */
const TOOL_LABELS = {
  search_knowledge_base: "Searching the knowledge base",
  check_service_status: "Checking service status",
  create_support_ticket: "Opening a support ticket",
};

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function useChat() {
  const [messages, setMessages] = useState(() => loadStored() ?? [WELCOME_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState(null);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const lastUserMessage = useRef(null);

  // Persist the conversation so a refresh doesn't lose the thread.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))
      );
    } catch {
      // Storage full or unavailable - the conversation still works in memory.
    }
  }, [messages]);

  // Abort any in-flight request if the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      lastUserMessage.current = trimmed;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage = { role: "user", content: trimmed, time: Date.now() };

      // Snapshot the history to send before appending, so the new message
      // isn't duplicated in the payload.
      const history = messages
        .filter((m) => !m.isError)
        .slice(-12)
        .map(({ role, content }) => ({ role, content }));

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError(null);
      setToolStatus(null);

      let started = false;

      const beginAssistant = () => {
        started = true;
        setLoading(false);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", streaming: true, time: Date.now() },
        ]);
      };

      const updateLast = (patch) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] =
            typeof patch === "function" ? patch(last) : { ...last, ...patch };
          return next;
        });
      };

      try {
        const res = await fetch(`${API_BASE}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const eventLine = chunk.split("\n").find((l) => l.startsWith("event:"));
            const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!eventLine || !dataLine) continue; // heartbeat or partial frame

            const event = eventLine.slice(6).trim();
            let data;
            try {
              data = JSON.parse(dataLine.slice(5).trim());
            } catch {
              continue;
            }

            if (event === "delta") {
              if (!started) beginAssistant();
              setToolStatus(null);
              updateLast((last) => ({ ...last, content: last.content + data.text }));
            } else if (event === "tool") {
              setToolStatus(
                data.status === "running" ? TOOL_LABELS[data.name] ?? "Working" : null
              );
            } else if (event === "ticket") {
              if (!started) beginAssistant();
              updateLast({ ticket: data.ticket });
            } else if (event === "done") {
              if (!started) beginAssistant();
              updateLast((last) => ({
                ...last,
                streaming: false,
                articles: data.articles,
                ticket: data.ticket ?? last.ticket,
              }));
            } else if (event === "error") {
              throw new Error(data.error);
            }
          }
        }

        // Stream ended without a done event - close the bubble anyway.
        if (started) updateLast({ streaming: false });
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message || "Couldn't reach the help desk. Check your connection.");
        // Drop an empty placeholder bubble so the error isn't shown twice.
        if (started) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            return last?.role === "assistant" && !last.content ? prev.slice(0, -1) : prev;
          });
        }
      } finally {
        setLoading(false);
        setToolStatus(null);
      }
    },
    [loading, messages]
  );

  const retry = useCallback(() => {
    if (lastUserMessage.current) {
      // Remove the failed user turn before resending it.
      setMessages((prev) => {
        const index = prev.findLastIndex((m) => m.role === "user");
        return index === -1 ? prev : prev.slice(0, index);
      });
      const text = lastUserMessage.current;
      setError(null);
      setTimeout(() => send(text), 0);
    }
  }, [send]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([{ ...WELCOME_MESSAGE, time: Date.now() }]);
    setError(null);
    setLoading(false);
    setToolStatus(null);
  }, []);

  return { messages, loading, toolStatus, error, send, retry, reset };
}
