import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, ChevronLeft, ChevronRight, FileText, Presentation, X } from "lucide-react";
import Modal, { useModalClose } from "../../components/Modal";
import { useAuth } from "../../lib/auth";

const SEEN_KEY = "studily.whatsnew.feynman";
const OPEN_EVENT = "studily:feynman-whats-new";
const QUIET_PATHS = ["/onboarding", "/profile/setup", "/welcome"];
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

export function openFeynmanWhatsNew() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
  }
}

export default function FeynmanWhatsNew() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  useEffect(() => {
    if (!user || open || hasSeen()) return;
    if (Date.now() - new Date(user.createdAt).getTime() < NEW_ACCOUNT_MS) {
      markSeen();
      return;
    }
    if (QUIET_PATHS.some((p) => pathname.startsWith(p))) return;
    setOpen(true);
  }, [user, pathname]);

  if (!open) return null;

  return (
    <Modal
      onClose={() => {
        markSeen();
        setOpen(false);
      }}
      size="md"
      padded={false}
      showClose={false}
    >
      <Slides />
    </Modal>
  );
}

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  visual: ReactNode;
}

const SLIDES: Slide[] = [
  {
    eyebrow: "New: StudilyBot",
    title: "Learn it by teaching it",
    body: "StudilyBot is a study partner that plays the student while you play the teacher. Explaining an idea in your own words is one of the fastest ways to find out what you really understand. It's called the Feynman technique.",
    visual: <ChatVisual />,
  },
  {
    eyebrow: "How it works",
    title: "Upload a lecture, then teach it back",
    body: "Pick up to 3 files from one lecture, from your course files or uploaded fresh. StudilyBot picks out the key ideas and asks you to explain them one at a time. When you miss something, it asks a follow-up. Say \"I don't know\" and it explains it simply, then moves on.",
    visual: <UploadVisual />,
  },
  {
    eyebrow: "Your report",
    title: "See exactly where your gaps are",
    body: "When you're done, you get a score for each idea, what you explained well, and the gaps to review before your exam, with the right answer from your own material.",
    visual: <ReportVisual />,
  },
];

function Slides() {
  const close = useModalClose();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const last = SLIDES.length - 1;

  function go(next: number) {
    setIndex(Math.max(0, Math.min(last, next)));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);

  return (
    <div
      className="relative"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute right-1.5 top-1.5 z-10 grid h-10 w-10 place-items-center rounded-lg text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
      >
        <X size={16} />
      </button>

      <div className="grid">
        {SLIDES.map((s, i) => (
          <div
            key={s.eyebrow}
            aria-hidden={i !== index}
            className={i === index ? "animate-fade" : "invisible"}
            style={{ gridArea: "1 / 1" }}
          >
            <div
              className="flex h-52 items-center justify-center overflow-hidden rounded-t-2xl px-6 pb-3 pt-10"
              style={{
                background:
                  "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%)",
              }}
            >
              {s.visual}
            </div>
            <div className="px-6 pt-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{s.eyebrow}</p>
              <h2 className="mt-1 text-lg font-semibold text-fg">{s.title}</h2>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-fg-2">{s.body}</p>
              {i === last && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    tabIndex={i === index ? 0 : -1}
                    onClick={() => {
                      navigate("/study/studilybot/recall");
                      close();
                    }}
                    className="btn btn-primary"
                    style={{ minHeight: 40 }}
                  >
                    Try StudilyBot
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 pb-4 pt-3">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center">
          {SLIDES.map((s, i) => (
            <button
              key={s.eyebrow}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to ${s.eyebrow}`}
              aria-current={i === index}
              className="grid h-10 w-10 place-items-center"
            >
              <span
                className="h-2 rounded-full transition-all duration-200"
                style={{
                  width: i === index ? 20 : 8,
                  background: i === index ? "var(--accent)" : "color-mix(in srgb, var(--fg-3) 40%, transparent)",
                }}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === last}
          aria-label="Next"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function MiniCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-line ${className}`}
      style={{ background: "var(--surface)", boxShadow: "var(--card-shadow)" }}
    >
      {children}
    </div>
  );
}

function Bubble({ bot, children }: { bot?: boolean; children: ReactNode }) {
  return (
    <div className={`flex items-end gap-1.5 ${bot ? "" : "justify-end"}`}>
      {bot && (
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          <Bot size={11} />
        </span>
      )}
      <span
        className="max-w-[78%] rounded-2xl px-2.5 py-1.5 text-left text-[11px] leading-snug"
        style={
          bot
            ? { background: "var(--surface-hi)", color: "var(--fg)" }
            : { background: "var(--accent)", color: "var(--accent-fg)" }
        }
      >
        {children}
      </span>
    </div>
  );
}

function ChatVisual() {
  return (
    <MiniCard className="flex w-full max-w-[290px] flex-col gap-1.5 p-3">
      <Bubble bot>How would you explain Newton's first law to me?</Bubble>
      <Bubble>Things keep doing what they're doing unless a force acts on them.</Bubble>
      <Bubble bot>Nice! So why does a rolling ball stop?</Bubble>
    </MiniCard>
  );
}

function UploadVisual() {
  const files = [
    { icon: <Presentation size={12} />, name: "Lecture 6 - Forces.pptx" },
    { icon: <FileText size={12} />, name: "Chapter 4 notes.pdf" },
  ];
  return (
    <MiniCard className="w-full max-w-[290px] p-3">
      {files.map((f) => (
        <div key={f.name} className="flex items-center gap-2 py-1 text-[11px] text-fg-2">
          <span style={{ color: "var(--accent)" }}>{f.icon}</span>
          {f.name}
        </div>
      ))}
      <div className="mt-2 border-t border-line pt-2 text-[10px] text-fg-3">6 ideas to teach back</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {["Inertia", "Net force", "F = ma", "Friction"].map((c) => (
          <span key={c} className="badge badge-accent">
            {c}
          </span>
        ))}
      </div>
    </MiniCard>
  );
}

function ReportVisual() {
  const concepts = [
    { name: "Inertia", score: 92 },
    { name: "Net force", score: 74 },
    { name: "Friction", score: 38 },
  ];
  return (
    <MiniCard className="w-full max-w-[290px] p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-semibold text-fg">Your understanding</span>
        <span className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
          68%
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {concepts.map((c) => (
          <div key={c.name}>
            <div className="flex justify-between text-[10px] text-fg-2">
              <span>{c.name}</span>
              <span className="tabular-nums">{c.score}%</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-hi)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${c.score}%`,
                  background: c.score >= 70 ? "var(--green)" : "var(--orange-vivid)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </MiniCard>
  );
}
