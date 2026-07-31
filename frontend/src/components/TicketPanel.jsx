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

/** Next statuses a user can move a ticket to from the panel. */
const NEXT_STATUS = {
  open: [["in_progress", "Start"], ["resolved", "Resolve"], ["closed", "Close"]],
  in_progress: [["resolved", "Resolve"], ["closed", "Close"]],
  resolved: [["closed", "Close"], ["open", "Reopen"]],
  closed: [],
};

export default function TicketPanel({ open, onClose }) {
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(null);

  async function move(reference, status) {
    setBusy(reference);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${reference}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTickets((prev) =>
        prev.map((t) => (t.reference === updated.reference ? updated : t))
      );
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

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

            {NEXT_STATUS[ticket.status]?.length > 0 && (
              <div className="ticket-actions">
                {NEXT_STATUS[ticket.status].map(([status, label]) => (
                  <button
                    key={status}
                    onClick={() => move(ticket.reference, status)}
                    disabled={busy === ticket.reference}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
