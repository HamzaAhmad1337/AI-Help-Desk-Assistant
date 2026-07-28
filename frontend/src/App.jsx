import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

const QUICK_QUESTIONS = [
  "How do I reset my password?",
  "I can't connect to the VPN",
  "My printer isn't working",
  "How do I set up MFA?",
];

const WELCOME_MESSAGE = {
  role: "assistant",
  content:
    "Hi! I'm your AI Help Desk Assistant. Ask me about password resets, VPN, WiFi, " +
    "software installs, email, printers, or account issues, and I'll help you troubleshoot.",
};

export default function App() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: "user", content: trimmed };
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
          history: nextMessages.slice(-10),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, articles: data.articles },
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
    <div className="app">
      <header className="header">
        <div className="header-title">
          <span className="header-icon">🛟</span>
          <div>
            <h1>AI Help Desk Assistant</h1>
            <p>IT support, available 24/7</p>
          </div>
        </div>
      </header>

      <main className="chat-window">
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
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
            </div>
          ))}
          {loading && (
            <div className="message assistant">
              <div className="bubble typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          {error && <div className="error-banner">⚠ {error}</div>}
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
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your IT issue..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
