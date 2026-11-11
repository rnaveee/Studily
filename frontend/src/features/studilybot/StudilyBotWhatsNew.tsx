import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Modal, { useModalClose } from "../../components/Modal";
import { useAuth } from "../../lib/auth";
import Mascot, { type MascotState } from "./Mascot";

const SEEN_KEY = "studily.whatsnew.studilybot";
const SUPERSEDED_KEYS = ["studily.whatsnew.feynman"];
const OPEN_EVENT = "studily:studilybot-whats-new";
const QUIET_PATHS = ["/onboarding", "/profile/setup", "/welcome", "/study/studilybot"];
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

export function openStudilyBotWhatsNew() {
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
    for (const key of SUPERSEDED_KEYS) localStorage.setItem(key, "1");
  } catch {
  }
}

export default function StudilyBotWhatsNew() {
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
    title: "Meet your study buddy",
    body: "StudilyBot lives in the Study tab now. It reads the files you add to a course and helps you study them, with citations back to your slides and pages. Give it a tap to say hi.",
    visual: <Mascot state="wave" size={92} shadow say="Hi! I'm StudilyBot. Let's study!" />,
  },
  {
    eyebrow: "Three modes",
    title: "Chat, Practice and Recall",
    body: "Chat answers questions from your course files. Practice writes word problems from your class material and checks your working. Recall has you explain a lecture back so you find your gaps before the exam.",
    visual: <ModesVisual />,
  },
  {
    eyebrow: "StudilyBot attire",
    title: "Dress it up with your coins",
    body: "Hoodies and pants for StudilyBot are in the shop. Your outfit shows everywhere StudilyBot does. The legendary Aurora Zip Hoodie only drops from Diamond chests.",
    visual: <OutfitsVisual />,
  },
];

function ModesVisual() {
  const modes: { label: string; state: MascotState; color: string }[] = [
    { label: "Chat", state: "explaining", color: "var(--accent)" },
    { label: "Practice", state: "thinking", color: "var(--orange-vivid)" },
    { label: "Recall", state: "confused", color: "var(--green)" },
  ];
  return (
    <div className="flex items-end gap-4">
      {modes.map((m) => (
        <div key={m.label} className="flex flex-col items-center gap-1">
          <Mascot state={m.state} size={62} shadow />
          <span className="text-[12px] font-semibold" style={{ color: m.color }}>
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function OutfitsVisual() {
  return (
    <div className="flex items-end gap-3">
      <Mascot size={64} outfit={{ top: "hoodie_varsity", bottom: "pants_jeans" }} shadow />
      <Mascot size={78} state="excited" outfit={{ top: "hoodie_aurora", bottom: "pants_joggers" }} shadow />
      <Mascot size={64} outfit={{ top: "hoodie_sunset", bottom: "shorts_cargo" }} shadow />
    </div>
  );
}

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

  function goTo(path: string) {
    navigate(path);
    close();
  }

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
              className="flex h-56 items-end justify-center overflow-hidden rounded-t-2xl px-6 pb-4 pt-8"
              style={{
                background:
                  "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%)",
              }}
            >
              {i === index && s.visual}
            </div>
            <div className="px-6 pt-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{s.eyebrow}</p>
              <h2 className="mt-1 text-lg font-semibold text-fg">{s.title}</h2>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-fg-2">{s.body}</p>
              {i === last && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    tabIndex={i === index ? 0 : -1}
                    onClick={() => goTo("/profile/badges?tab=shop&shop=studilybot")}
                    className="btn btn-soft"
                    style={{ minHeight: 40 }}
                  >
                    Visit the shop
                  </button>
                  <button
                    type="button"
                    tabIndex={i === index ? 0 : -1}
                    onClick={() => goTo("/study/studilybot")}
                    className="btn btn-primary"
                    style={{ minHeight: 40 }}
                  >
                    Meet StudilyBot
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
