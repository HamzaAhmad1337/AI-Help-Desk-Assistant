import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

const LABELS = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
};

export default function ServiceStatus() {
  const [services, setServices] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE}/api/status`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setServices(data))
      .catch(() => {
        // Backend unreachable - the strip stays hidden rather than putting an
        // error banner on what is otherwise a marketing page.
      });

    return () => controller.abort();
  }, []);

  if (!services) return null;

  const entries = Object.entries(services);
  const impaired = entries.filter(([, s]) => s.status !== "operational");
  const allClear = impaired.length === 0;

  return (
    <section className="status-strip" aria-label="Service status">
      <div className="status-summary">
        <span
          className={`status-dot ${allClear ? "ok" : "warn"}`}
          aria-hidden="true"
        />
        {allClear
          ? "All systems operational"
          : `${impaired.length} service${impaired.length > 1 ? "s" : ""} impaired`}
      </div>

      <ul className="status-list">
        {entries.map(([key, service]) => (
          <li key={key} className={`status-item status-${service.status}`}>
            <span className={`status-dot ${service.status === "operational" ? "ok" : "warn"}`} aria-hidden="true" />
            <span className="status-name">{service.name}</span>
            <span className="status-state">{LABELS[service.status] ?? service.status}</span>
            {service.status !== "operational" && service.note && (
              <span className="status-note">{service.note}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
