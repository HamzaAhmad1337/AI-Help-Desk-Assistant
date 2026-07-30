import { useEffect, useRef, useState } from "react";
import Message from "./components/Message.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { useChat } from "./lib/useChat.js";
import { IconClose, IconSend, IconRefresh } from "./components/Icons.jsx";

const QUICK_QUESTIONS = [
  "Reset my password",
  "VPN won't connect",
  "Printer not working",
  "Set up MFA",
];

export default function ChatWidget({ open, onClose }) {
  const { messages, loading, toolStatus, error, send, retry, reset } = useChat();
  const [input, setInput] = useState("");

  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const endRef = useRef(null);
  const pinnedToBottom = useRef(true);

  // Only autoscroll when the user is already at the bottom, so scrolling back
  // to read an earlier answer isn't yanked away by incoming tokens.
  useEffect(() => {
    if (pinnedToBottom.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading, toolStatus]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  useEffect(() => {
    if (open) {
      pinnedToBottom.current = true;
      const timer = setTimeout(() => inputRef.current?.focus(), 260);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Escape closes the widget; Tab cycles within it while it's open.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll(
        'button:not([disabled]), input, a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const last = messages[messages.length - 1];
  const settledReply =
    last?.role === "assistant" && !last.streaming && !loading && !toolStatus
      ? last.content
      : "";

  function handleSubmit(event) {
    event.preventDefault();
    pinnedToBottom.current = true;
    send(input);
    setInput("");
  }

  function askQuick(question) {
    pinnedToBottom.current = true;
    send(question);
  }

  return (
    <section
      ref={panelRef}
      className={`widget ${open ? "widget-open" : "widget-closed"}`}
      role="dialog"
      aria-modal="false"
      aria-label="Nova help desk chat"
      aria-hidden={!open}
      {...(open ? {} : { inert: "" })}
    >
      <header className="widget-header">
        <div className="widget-header-info">
          <span className="widget-status-dot" aria-hidden="true" />
          <div>
            <h2>Nova &middot; Help Desk</h2>
            <p>Usually replies instantly</p>
          </div>
        </div>
        <div className="widget-header-actions">
          <button onClick={reset} aria-label="Start a new conversation" title="New conversation">
            <IconRefresh />
          </button>
          <button onClick={onClose} aria-label="Close chat" title="Close">
            <IconClose />
          </button>
        </div>
      </header>

      <div className="widget-body">
        <div className="messages" ref={scrollRef} onScroll={handleScroll}>
          {/*
            Announces completed assistant replies. This must wait for the
            stream to finish: announcing while `streaming` is true would make a
            screen reader re-read the whole growing message on every token.
          */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {settledReply}
          </div>

          {messages.map((message, index) => (
            <ErrorBoundary key={message.id}>
              <Message
                message={message}
                // The user turn this reply answers, sent along with any rating
                // so low-rated answers can be traced back to what was asked.
                question={
                  message.role === "assistant" ? messages[index - 1]?.content : undefined
                }
              />
            </ErrorBoundary>
          ))}

          {toolStatus && (
            <div className="tool-status" role="status">
              <span className="tool-spinner" aria-hidden="true" />
              {toolStatus}…
            </div>
          )}

          {loading && !toolStatus && (
            <div className="message-row assistant">
              <div className="avatar" aria-hidden="true" />
              <div className="bubble typing" role="status" aria-label="Nova is typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={retry}>Retry</button>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {messages.length <= 1 && !loading && (
          <div className="quick-questions">
            {QUICK_QUESTIONS.map((question) => (
              <button key={question} onClick={() => askQuick(question)}>
                {question}
              </button>
            ))}
          </div>
        )}

        <form className="input-bar" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="nova-input">
            Describe your IT issue
          </label>
          <input
            id="nova-input"
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type your question…"
            autoComplete="off"
            maxLength={4000}
            disabled={loading}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <IconSend />
          </button>
        </form>

        <p className="widget-footer">Nova can make mistakes — verify anything critical.</p>
      </div>
    </section>
  );
}
