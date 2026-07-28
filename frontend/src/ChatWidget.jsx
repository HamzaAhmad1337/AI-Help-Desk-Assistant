import { useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

const QUICK_QUESTIONS = [
  "Reset my password",
  "VPN won't connect",
  "Printer not working",
  "Set up MFA",
];

const WELCOME_MESSAGE = {
  role: "assistant",
  content:
    "Hey there 👋 I'm Nova, your AI help desk assistant. Tell me what's going on " +
    "and I'll get you sorted — password resets, VPN, WiFi, email, printers, you name it.",
  time: Date.now(),
};

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ role }) {
  if (role === "assistant") {
    return (
      <div className="avatar avatar-bot" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="12" fill="url(#g)" />
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7C5CFF" />
              <stop offset="1" stopColor="#4FD1FF" />
            </linearGradient>
          </defs>
          <path
            d="M8 10.5c0-.83.67-1.5 1.5-1.5S11 9.67 11 10.5 10.33 12 9.5 12 8 11.33 8 10.5zM13 10.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5zM8.5 15.25c1.02.9 2.2 1.35 3.5 1.35s2.48-.45 3.5-1.35"
            stroke="white"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }
  return <div className="avatar avatar-user">You</div>;
}

export default function ChatWidget({ open, onClose }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: "user", content: trimmed, time: Date.now() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: nextMessages.slice(-10).map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          articles: data.articles,
          time: Date.now(),
        },
      ]);
    } catch (err) {
      setError(err.message || "Failed to reach the help desk server.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className={`widget ${open ? "widget-open" : "widget-closed"}`}>
      <div className="widget-header">
        <div className="widget-header-info">
          <div className="widget-status-dot" />
          <div>
            <h2>Nova &middot; Help Desk</h2>
            <p>Usually replies instantly</p>
          </div>
        </div>
        <button className="widget-close" onClick={onClose} aria-label="Close chat">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="widget-body">
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-row ${msg.role}`}>
              {msg.role === "assistant" && <Avatar role="assistant" />}
              <div className="message-col">
                <div className="bubble">
                  <p>{msg.content}</p>
                  {msg.articles && msg.articles.length > 0 && (
                    <div className="articles">
                      <span className="articles-label">Related articles</span>
                      <ul>
                        {msg.articles.map((a) => (
                          <li key={a.id}>{a.question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <span className="timestamp">{formatTime(msg.time)}</span>
              </div>
              {msg.role === "user" && <Avatar role="user" />}
            </div>
          ))}

          {loading && (
            <div className="message-row assistant">
              <Avatar role="assistant" />
              <div className="message-col">
                <div className="bubble typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}

          {error && <div className="error-banner">&#9888; {error}</div>}
          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 && (
          <div className="quick-questions">
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} onClick={() => sendMessage(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        <form className="input-bar" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            disabled={loading}
          />
          <button type="submit" className="send-btn" disabled={loading || !input.trim()} aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M2.5 10L17.5 3L12 17.5L9.5 11.5L2.5 10Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
              <path d="M9.5 11.5L17.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </form>
        <div className="widget-footer">Powered by Claude &middot; AI Help Desk</div>
      </div>
    </div>
  );
}
