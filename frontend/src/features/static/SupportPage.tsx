import { useState } from "react";
import { Check, Send } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { toast } from "../../lib/toast";
import { Page, Section } from "./shell";

const CATEGORIES = [
  { value: "BUG", label: "Bug" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "OTHER", label: "Other" },
] as const;

const SUPPORT_EMAIL = "ryannave97@gmail.com";

export default function SupportPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>("BUG");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post<void>("/support", {
        category,
        message,
        email: user ? undefined : email.trim() || undefined,
      });
      setSent(true);
      setMessage("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send your report — try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Support"
      intro="Found a bug or have an idea? Studily is in beta — reports like yours directly shape what gets fixed and built."
    >
      <Section title="Send a report">
        {sent ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-[14px] font-medium text-fg">
              <Check size={15} className="text-accent" />
              Sent — thanks for the report!
            </p>
            <button onClick={() => setSent(false)} className="btn btn-ghost">
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="support-category">Type</label>
              <select
                id="support-category"
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {!user && (
              <div>
                <label className="field-label" htmlFor="support-email">
                  Your email <span className="font-normal text-fg-3">(optional, so I can reply)</span>
                </label>
                <input
                  id="support-email"
                  className="input"
                  type="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="field-label" htmlFor="support-message">Message</label>
              <textarea
                id="support-message"
                className="input min-h-[140px]"
                placeholder="What happened? For bugs, include what you were doing and what you expected instead."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={5000}
                required
              />
            </div>

            <div className="space-y-2">
              <button type="submit" disabled={busy} className="btn btn-primary">
                <Send size={13} />
                {busy ? "Sending…" : "Submit"}
              </button>
              <p className="text-[12px] text-fg-3">
                Or email me directly:{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-accent transition-colors hover:text-accent-2"
                >
                  {SUPPORT_EMAIL}
                </a>
                , or message me on Instagram:{" "}
                <a
                  href="https://www.instagram.com/rnave9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent transition-colors hover:text-accent-2"
                >
                  @rnave9
                </a>
              </p>
            </div>
          </form>
        )}
      </Section>
    </Page>
  );
}
