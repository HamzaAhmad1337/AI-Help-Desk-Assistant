import { useState } from "react";
import { renderMarkdown } from "../lib/markdown.jsx";
import { IconCopy, IconCheck, IconThumbUp, IconThumbDown, IconTicket } from "./Icons.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function BotAvatar() {
  return (
    <div className="avatar avatar-bot" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="26" height="26">
        <defs>
          <linearGradient id="nova-avatar" x1="0" y1="0" x2="24" y2="24">
            <stop stopColor="var(--accent-1)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="12" fill="url(#nova-avatar)" />
        <circle cx="9.2" cy="10.4" r="1.35" fill="white" />
        <circle cx="14.8" cy="10.4" r="1.35" fill="white" />
        <path
          d="M8.6 14.6c1 .9 2.1 1.35 3.4 1.35s2.4-.45 3.4-1.35"
          stroke="white"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function TicketCard({ ticket }) {
  return (
    <div className="ticket-card">
      <div className="ticket-head">
        <IconTicket />
        <span>Ticket opened</span>
        <span className={`ticket-priority priority-${ticket.priority}`}>{ticket.priority}</span>
      </div>
      <div className="ticket-ref">{ticket.reference}</div>
      <div className="ticket-subject">{ticket.subject}</div>
    </div>
  );
}

export default function Message({ message, question }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const isAssistant = message.role === "assistant";
  const showActions = isAssistant && !message.streaming && message.content;

  function rate(rating) {
    const next = feedback === rating ? null : rating;
    setFeedback(next);
    if (!next) return;

    // Fire and forget: a failed rating must never interrupt the conversation.
    fetch(`${API_BASE}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: next, message: message.content, question }),
    }).catch(() => {});
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context) - leave the button unchanged.
    }
  }

  return (
    <div className={`message-row ${message.role}`}>
      {isAssistant && <BotAvatar />}

      <div className="message-col">
        <div className="bubble">
          <div className="markdown">
            {renderMarkdown(message.content)}
            {message.streaming && <span className="cursor" aria-hidden="true" />}
          </div>

          {message.ticket && <TicketCard ticket={message.ticket} />}

          {message.articles?.length > 0 && (
            <div className="articles">
              <span className="articles-label">Based on</span>
              <ul>
                {message.articles.map((article) => (
                  <li key={article.id}>{article.question}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="message-meta">
          <span className="timestamp">{formatTime(message.time)}</span>

          {showActions && (
            <div className="message-actions">
              <button
                onClick={copy}
                aria-label={copied ? "Copied" : "Copy message"}
                title={copied ? "Copied" : "Copy"}
              >
                {copied ? <IconCheck /> : <IconCopy />}
              </button>
              <button
                onClick={() => rate("up")}
                className={feedback === "up" ? "active" : ""}
                aria-label="Helpful"
                aria-pressed={feedback === "up"}
                title="Helpful"
              >
                <IconThumbUp />
              </button>
              <button
                onClick={() => rate("down")}
                className={feedback === "down" ? "active" : ""}
                aria-label="Not helpful"
                aria-pressed={feedback === "down"}
                title="Not helpful"
              >
                <IconThumbDown />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
