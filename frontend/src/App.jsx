import { useEffect, useState } from "react";
import "./App.css";
import ChatWidget from "./ChatWidget.jsx";
import {
  IconChat,
  IconSun,
  IconMoon,
  IconShield,
  IconGlobe,
  IconLaptop,
  IconLifebuoy,
} from "./components/Icons.jsx";

const FEATURES = [
  {
    Icon: IconShield,
    title: "Account & Access",
    desc: "Password resets, MFA enrolment, and account lockouts — handled in seconds.",
  },
  {
    Icon: IconGlobe,
    title: "Network & VPN",
    desc: "Guided WiFi and VPN troubleshooting, with live service status checks.",
  },
  {
    Icon: IconLaptop,
    title: "Hardware & Software",
    desc: "Printers, slow machines, installs — clear step-by-step fixes on demand.",
  },
  {
    Icon: IconLifebuoy,
    title: "Real Escalation",
    desc: "If chat can't fix it, Nova opens a real ticket with the full context attached.",
  },
];

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("nova-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("nova-theme", theme);
  }, [theme]);

  return [theme, setTheme];
}

export default function App() {
  const [chatOpen, setChatOpen] = useState(false);
  const [theme, setTheme] = useTheme();

  return (
    <div className="page">
      <div className="bg-glow bg-glow-1" aria-hidden="true" />
      <div className="bg-glow bg-glow-2" aria-hidden="true" />

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <nav className="nav">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Nova Help Desk
        </div>
        <div className="nav-actions">
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title="Toggle theme"
          >
            {theme === "dark" ? <IconMoon /> : <IconSun />}
          </button>
          <button className="nav-cta" onClick={() => setChatOpen(true)}>
            Chat with Nova
          </button>
        </div>
      </nav>

      <main id="main">
        <header className="hero">
          <span className="eyebrow">AI-Powered IT Support</span>
          <h1>
            Get unstuck in <span className="gradient-text">seconds</span>, not tickets.
          </h1>
          <p className="hero-sub">
            Nova troubleshoots your IT problems in chat, checks live service status before
            sending you down a rabbit hole, and opens a ticket only when it genuinely needs to.
          </p>
          <button className="hero-cta" onClick={() => setChatOpen(true)}>
            <span className="pulse-dot" aria-hidden="true" />
            Start a conversation
          </button>
        </header>

        <section className="features" aria-label="What Nova can help with">
          {FEATURES.map(({ Icon, title, desc }) => (
            <article className="feature-card" key={title}>
              <div className="feature-icon">
                <Icon />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="footer">
        <p>Available 24/7 &middot; Powered by Claude</p>
      </footer>

      <button
        className={`launcher ${chatOpen ? "launcher-hidden" : ""}`}
        onClick={() => setChatOpen(true)}
        aria-label="Open help desk chat"
        aria-expanded={chatOpen}
        tabIndex={chatOpen ? -1 : 0}
      >
        <IconChat />
        <span className="launcher-badge" aria-hidden="true" />
      </button>

      <ChatWidget open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
