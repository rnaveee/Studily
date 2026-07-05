import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Send, Sparkles } from "lucide-react";

// UI shell only — no AI backend yet. A RAG pipeline over course documents
// will be wired in later; for now the assistant returns a placeholder.
interface ChatMessage {
  role: "user" | "assistant";
  body: string;
}

const PLACEHOLDER_REPLY =
  "I'm not hooked up to your course documents yet. Soon you'll be able to ask me anything about the materials posted in your classes.";

export default function AiChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", body },
      { role: "assistant", body: PLACEHOLDER_REPLY },
    ]);
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col animate-in">
      <div className="flex items-center gap-3 pb-4">
        <Link
          to="/learn"
          className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
          aria-label="Back to Learn"
        >
          <ArrowLeft size={16} />
        </Link>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <Sparkles size={16} className="text-accent" />
        </span>
        <div>
          <h1 className="text-[15px] font-semibold text-fg">AI</h1>
          <p className="text-[12px] text-fg-3">Ask about your course materials</p>
        </div>
      </div>

      <div className="card flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="py-10 text-center">
              <Sparkles className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
              <p className="text-sm text-fg-3">Ask a question about your courses.</p>
              <p className="mt-1 text-[12px] text-fg-3">
                Answers from your uploaded documents are coming soon.
              </p>
            </div>
          ) : (
            messages.map((m, i) => {
              const mine = m.role === "user";
              return (
                <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] ${
                      mine ? "text-accent-fg" : "text-fg"
                    }`}
                    style={{ background: mine ? "var(--accent)" : "var(--surface-hi)" }}
                  >
                    {m.body}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 p-3"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question…"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="btn btn-primary shrink-0"
            aria-label="Send"
          >
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  );
}
