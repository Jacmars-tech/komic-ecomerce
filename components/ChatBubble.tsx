"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, X, Send, Bot, Minimize2, Maximize2 } from "lucide-react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

import { db } from "@/lib/firebase";

type ChatMessage = {
  id: string;
  text: string;
  senderRole: "user" | "admin" | "vendor";
  createdAt?: unknown;
};

export function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoadingThread(true);
    setError(null);

    const bootstrap = async () => {
      const response = await fetch("/api/chat/thread");
      const payload = await response.json().catch(() => ({}));

      if (cancelled) return;

      if (response.status === 401) {
        setRequiresLogin(true);
        setThreadId(null);
        setLoadingThread(false);
        return;
      }

      if (!response.ok) {
        setError(payload.error || "Unable to initialize chat.");
        setThreadId(null);
        setLoadingThread(false);
        return;
      }

      setRequiresLogin(false);
      setThreadId(payload.thread?.threadId || null);
      setLoadingThread(false);
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !threadId) return;

    const q = query(collection(db, "chatThreads", threadId, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot: any) => {
        const next = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...(doc.data() as Omit<ChatMessage, "id">)
        }));
        setMessages(next);
      },
      () => {
        setError("Real-time updates are currently unavailable.");
      }
    );

    return () => unsubscribe();
  }, [isOpen, threadId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isMinimized]);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!threadId || !message.trim() || sending) return;

    try {
      setSending(true);
      setError(null);

      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          text: message.trim()
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Unable to send your message.");
        setSending(false);
        return;
      }

      setMessage("");
      setSending(false);
    } catch {
      setError("Unable to send your message.");
      setSending(false);
    }
  };

  return (
    <div className="chat-container" style={{ position: "fixed", bottom: "2rem", right: "2rem", zIndex: 1000 }}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="btn btn-primary animate-fade-in"
          style={{ width: "64px", height: "64px", borderRadius: "50%", padding: 0 }}
          aria-label="Open support chat"
        >
          <MessageCircle size={28} />
        </button>
      ) : (
        <div
          className={`card glass animate-fade-in ${isMinimized ? "minimized" : ""}`}
          style={{
            width: "380px",
            maxWidth: "calc(100vw - 2rem)",
            height: isMinimized ? "64px" : "520px",
            display: "flex",
            flexDirection: "column",
            padding: 0,
            overflow: "hidden",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-xl)"
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ padding: "1rem", background: "var(--primary)", color: "white" }}
          >
            <div className="flex items-center gap-2">
              <div style={{ width: "10px", height: "10px", background: "var(--success)", borderRadius: "50%" }} />
              <span style={{ fontWeight: 600 }}>Live Support</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized((prev) => !prev)}
                style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}
                aria-label={isMinimized ? "Expand chat" : "Minimize chat"}
              >
                {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {!isMinimized ? (
            <>
              <div
                ref={scrollRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  background: "var(--bg-subtle)"
                }}
              >
                {loadingThread ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "2rem" }}>
                    <p>Connecting to support...</p>
                  </div>
                ) : requiresLogin ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "2rem" }}>
                    <Bot size={40} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                    <p>Please log in to start support chat.</p>
                    <Link href="/login" className="btn btn-primary mt-4">
                      Login
                    </Link>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "2rem" }}>
                    <Bot size={40} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                    <p>Hello. Tell us how we can help you.</p>
                  </div>
                ) : null}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.senderRole === "user" ? "flex-end" : "flex-start",
                      maxWidth: "80%",
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius)",
                      background: msg.senderRole === "user" ? "var(--accent)" : "var(--surface)",
                      color: msg.senderRole === "user" ? "white" : "var(--text)",
                      boxShadow: "var(--shadow-sm)",
                      fontSize: "0.9rem"
                    }}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleSend}
                style={{ padding: "1rem", background: "var(--surface)", borderTop: "1px solid var(--border)" }}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Type a message..."
                    disabled={requiresLogin || !threadId || sending}
                    style={{
                      flex: 1,
                      padding: "0.6rem 1rem",
                      borderRadius: "var(--radius-full)",
                      border: "1px solid var(--border)",
                      outline: "none",
                      fontSize: "0.9rem"
                    }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={requiresLogin || !threadId || sending}
                    style={{ padding: "0.6rem", borderRadius: "50%" }}
                    aria-label="Send message"
                  >
                    <Send size={18} />
                  </button>
                </div>
                {error ? <p style={{ color: "var(--error)", marginTop: "0.5rem", fontSize: "0.8rem" }}>{error}</p> : null}
              </form>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
