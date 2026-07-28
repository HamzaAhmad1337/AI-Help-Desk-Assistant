import { useState } from "react";
import "./App.css";
import ChatWidget from "./ChatWidget.jsx";

const FEATURES = [
  {
    icon: "🔐",
    title: "Account & Access",
    desc: "Password resets, MFA setup, and account lockouts — solved in seconds.",
  },
  {
    icon: "🌐",
    title: "Network & VPN",
    desc: "Get back online fast with guided WiFi and VPN troubleshooting.",
  },
  {
    icon: "🖨️",
    title: "Hardware & Software",
    desc: "Printers, slow machines, installs — step-by-step fixes on demand.",
  },
  {
    icon: "🎫",
    title: "Escalation Ready",
    desc: "Can't fix it in chat? You'll know exactly what to include in a ticket.",
  },
];

export default function App() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="page">
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />

      <nav className="nav">
        <div className="brand">
          <span className="brand-mark" />
          Nova Help Desk
        </div>
        <button className="nav-cta" onClick={() => setChatOpen(true)}>
          Chat with Nova
        </button>
      </nav>

      <header className="hero">
        <span className="eyebrow">AI-Powered IT Support</span>
        <h1>
          Get unstuck in <span className="gradient-text">seconds</span>, not tickets.
        </h1>
        <p className="hero-sub">
          Nova is your always-on help desk assistant — instant, friendly, and genuinely
          useful for the IT problems that slow your day down.
        </p>
        <button className="hero-cta" onClick={() => setChatOpen(true)}>
          <span className="pulse-dot" />
          Start a conversation
        </button>
      </header>

      <section className="features">
        {FEATURES.map((f) => (
          <div className="feature-card" key={f.title}>
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="footer">
        <p>Available 24/7 &middot; Powered by Claude</p>
      </footer>

      {!chatOpen && (
        <button className="launcher" onClick={() => setChatOpen(true)} aria-label="Open chat">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.1 0-2.15-.22-3.1-.63L4 20l1.06-4.32C4.4 14.63 4 13.36 4 12z"
              stroke="white"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <span className="launcher-badge" />
        </button>
      )}

      <ChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
