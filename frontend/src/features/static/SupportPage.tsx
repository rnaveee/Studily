import { useState } from "react";
import { Send } from "lucide-react";
import { Page, Section } from "./shell";

const CATEGORIES = [
  { value: "bug", label: "Bug" },
  { value: "feedback", label: "Feedback" },
  { value: "other", label: "Other" },
] as const;

const SUPPORT_EMAIL = "ryannave97@gmail.com";

export default function SupportPage() {
  const [category, setCategory] = useState<string>("bug");
  const [message, setMessage] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const label = CATEGORIES.find((c) => c.value === category)?.label ?? "Other";
    const subject = encodeURIComponent(`[Studily ${label}]`);
    const body = encodeURIComponent(message);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <Page
      title="Support"
      intro="Found a bug or have an idea? Studily is in beta — reports like yours directly shape what gets fixed and built."
    >
      <Section title="Send a report">
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

          <div>
            <label className="field-label" htmlFor="support-message">Message</label>
            <textarea
              id="support-message"
              className="input min-h-[140px]"
              placeholder="What happened? For bugs, include what you were doing and what you expected instead."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <button type="submit" className="btn btn-primary">
              <Send size={13} />
              Submit
            </button>
            <p className="text-[12px] text-fg-3">
              This opens your email app with the message pre-filled — just hit send.
            </p>
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
      </Section>
    </Page>
  );
}
