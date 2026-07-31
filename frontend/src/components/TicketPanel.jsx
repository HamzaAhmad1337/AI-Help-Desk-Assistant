import { useEffect, useState } from "react";
import { IconClose } from "./Icons.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TicketPanel({ open, onClose }) {
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState(false);

  // Refetch each time the panel opens, so a ticket just raised in chat shows up.
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setError(false);

    fetch(`${API_BASE}/api/tickets`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setTickets)
      .catch((err) => {
        if (err.name !== "AbortError") setError(true);
      });

    return () => controller.abort();
  }, [open]);

  if (!open) return null;

  return (
    <div className="ticket-panel">
      <div className="ticket-panel-head">
        <h3>Your tickets</h3>
        <button onClick={onClose} aria-label="Close tickets">
          <IconClose />
        </button>
      </div>

      <div className="ticket-panel-body">
        {error && <p className="ticket-empty">Couldn&rsquo;t load tickets.</p>}

        {!error && tickets === null && <p className="ticket-empty">Loading…</p>}

        {!error && tickets?.length === 0 && (
          <p className="ticket-empty">
            No tickets yet. If Nova can&rsquo;t solve something in chat, it&rsquo;ll open
            one for you.
          </p>
        )}

        {tickets?.map((ticket) => (
          <article className="ticket-row" key={ticket.reference}>
            <div className="ticket-row-top">
              <span className="ticket-row-ref">{ticket.reference}</span>
              <span className={`ticket-priority priority-${ticket.priority}`}>
                {ticket.priority}
              </span>
            </div>
            <div className="ticket-row-subject">{ticket.subject}</div>
            <div className="ticket-row-meta">
              <span className={`ticket-status status-${ticket.status}`}>
                {ticket.status.replace("_", " ")}
              </span>
              <span>{formatDate(ticket.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
