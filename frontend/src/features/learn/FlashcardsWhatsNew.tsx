import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Brain, ChevronLeft, ChevronRight, GraduationCap, LayoutGrid, Share2, Users, X, Zap } from "lucide-react";
import Modal, { useModalClose } from "../../components/Modal";
import { useAuth } from "../../lib/auth";

const SEEN_KEY = "studily.whatsnew.flashcards";
const OPEN_EVENT = "studily:flashcards-whats-new";
const QUIET_PATHS = ["/onboarding", "/profile/setup"];
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

export function openFlashcardsWhatsNew() {
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

export default function FlashcardsWhatsNew() {
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
    eyebrow: "Study",
    title: "Grading that explains itself",
    body: "Again, Hard, Good and Easy now each say what they mean and when you'll see that card next, so rating a card takes no guesswork.",
    visual: <StudyVisual />,
  },
  {
    eyebrow: "Learn",
    title: "Questions that get harder as you go",
    body: "Start with multiple choice and true or false. Once a card feels familiar, you type the answer from memory. Learn checks in after every round and remembers where you left off.",
    visual: <LearnVisual />,
  },
  {
    eyebrow: "Memory & Match",
    title: "Two new games",
    body: "In Memory, flip cards two at a time to pair each term with its definition. In Match, every card is face up and you race the clock, with a second added for each wrong pair.",
    visual: <GamesVisual />,
  },
  {
    eyebrow: "Sharing",
    title: "Study with your classmates",
    body: "Make a set public or share it with just your friends, then send the link. They can study it right away or save their own copy to edit.",
    visual: <ShareVisual />,
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
        className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
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
                <button
                  type="button"
                  tabIndex={i === index ? 0 : -1}
                  onClick={() => {
                    navigate("/learn/flashcards");
                    close();
                  }}
                  className="btn btn-primary mt-4 inline-flex"
                >
                  Open flashcards
                </button>
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
          className="rounded-full p-2 text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.eyebrow}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to ${s.eyebrow}`}
              aria-current={i === index}
              className="h-2 rounded-full transition-all duration-200"
              style={{
                width: i === index ? 20 : 8,
                background: i === index ? "var(--accent)" : "color-mix(in srgb, var(--fg-3) 40%, transparent)",
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === last}
          aria-label="Next"
          className="rounded-full p-2 text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function MiniCard({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-lg border border-line ${className}`}
      style={{ background: "var(--surface)", boxShadow: "var(--card-shadow)", ...style }}
    >
      {children}
    </div>
  );
}

function StudyVisual() {
  const grades = [
    { label: "Again", explain: "Didn't know it", color: "var(--red)" },
    { label: "Hard", explain: "Got it, barely", color: "#c78a2d" },
    { label: "Good", explain: "After a moment", color: "var(--accent)" },
    { label: "Easy", explain: "Knew it instantly", color: "var(--green)" },
  ];
  return (
    <div className="w-full max-w-[300px]">
      <div className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-fg-3">
        <GraduationCap size={13} />
        How well did you know it?
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {grades.map((g) => (
          <MiniCard key={g.label} className="px-2 py-1.5 text-center">
            <div className="text-[12px] font-semibold" style={{ color: g.color }}>
              {g.label}
            </div>
            <div className="text-[10px] text-fg-3">{g.explain}</div>
          </MiniCard>
        ))}
      </div>
    </div>
  );
}

function LearnVisual() {
  const options = ["Makes energy (ATP)", "Stores DNA", "Builds proteins", "Breaks down waste"];
  return (
    <MiniCard className="w-full max-w-[300px] p-3">
      <div className="mb-2 flex h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-hi)" }}>
        <div style={{ width: "35%", background: "var(--green)" }} />
        <div style={{ width: "25%", background: "#c78a2d" }} />
      </div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-3">
        <Brain size={11} />
        Pick the matching answer
      </div>
      <div className="mt-1 text-[13px] font-medium text-fg">Mitochondria</div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {options.map((o, i) => (
          <div
            key={o}
            className="truncate rounded-md border px-1.5 py-1 text-[10px] text-fg-2"
            style={
              i === 0
                ? {
                    borderColor: "var(--green)",
                    background: "color-mix(in srgb, var(--green) 12%, transparent)",
                    color: "var(--fg)",
                  }
                : { borderColor: "var(--line)" }
            }
          >
            {o}
          </div>
        ))}
      </div>
    </MiniCard>
  );
}

function GamesVisual() {
  return (
    <div className="flex w-full max-w-[320px] items-stretch justify-center gap-3">
      <div className="flex-1">
        <div className="mb-1.5 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-fg-3">
          <LayoutGrid size={11} />
          Memory
        </div>
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex h-10 items-center justify-center rounded-md border text-[8px] leading-tight"
              style={
                i === 1 || i === 3
                  ? {
                      borderColor: "var(--green)",
                      background: "color-mix(in srgb, var(--green) 12%, var(--surface))",
                      color: "var(--fg)",
                    }
                  : {
                      borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
                      background: "color-mix(in srgb, var(--accent) 16%, var(--surface))",
                    }
              }
            >
              {i === 1 ? "Nucleus" : i === 3 ? "Stores DNA" : <img src="/studily-3a.svg" alt="" className="h-4 w-4" />}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="mb-1.5 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-fg-3">
          <Zap size={11} />
          Match · 12.4s
        </div>
        <div className="grid grid-cols-3 gap-1">
          {["Ribosome", "Builds proteins", "Osmosis", "Lysosome", "Water moves", "Breaks waste"].map((t, i) => (
            <div
              key={t}
              className="flex h-10 items-center justify-center rounded-md border px-0.5 text-center text-[8px] leading-tight text-fg-2"
              style={
                i === 0 || i === 1
                  ? {
                      borderColor: "var(--accent)",
                      background: "color-mix(in srgb, var(--accent) 12%, var(--surface))",
                      color: "var(--fg)",
                    }
                  : { borderColor: "var(--line)", background: "var(--surface)" }
              }
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShareVisual() {
  return (
    <MiniCard className="w-full max-w-[290px] p-3">
      <div className="flex items-center gap-1.5">
        <span className="badge badge-accent inline-flex items-center gap-1">
          <Users size={10} />
          Shared set
        </span>
        <span className="ml-auto text-fg-3">
          <Share2 size={13} />
        </span>
      </div>
      <div className="mt-1.5 text-[13px] font-semibold text-fg">BIOL 101 · The Cell</div>
      <div className="text-[11px] text-fg-3">by you · 24 cards</div>
      <div
        className="mt-2.5 grid grid-cols-3 rounded-md p-0.5 text-center text-[10px] font-medium"
        style={{ background: "var(--surface-hi)" }}
      >
        <span className="py-1 text-fg-3">Private</span>
        <span className="py-1 text-fg-3">Friends</span>
        <span className="rounded py-1 text-accent" style={{ background: "var(--surface)", boxShadow: "var(--btn-shadow)" }}>
          Public
        </span>
      </div>
    </MiniCard>
  );
}
