import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BellRing,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Flame,
  Gift,
  Layers,
  Lock,
  Medal,
  Timer,
  Users,
  X,
} from "lucide-react";
import Modal, { useModalClose } from "../../components/Modal";
import { useAuth } from "../../lib/auth";

const SEEN_KEY = "studily.whatsnew.progress";
const SUPERSEDED_KEYS = ["studily.whatsnew.flashcards"];
const OPEN_EVENT = "studily:progress-whats-new";
const QUIET_PATHS = ["/onboarding", "/profile/setup"];
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

export function openProgressWhatsNew() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function supersede() {
  try {
    SUPERSEDED_KEYS.forEach((k) => localStorage.setItem(k, "1"));
  } catch {
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
  }
  supersede();
}

export default function ProgressWhatsNew() {
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
    supersede();
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
    eyebrow: "Levels & XP",
    title: "Your studying finally adds up",
    body: "Earn XP from study sessions, finished flashcard runs and new friends. Every level up pays out coins, and your level shows on your profile for your friends to see.",
    visual: <LevelVisual />,
  },
  {
    eyebrow: "Study sessions",
    title: "Plan a session, keep a streak",
    body: "Start a session from the Study page with 25-minute Pomodoro blocks or a straight timer, and list what you want to get done. Study 15 minutes a day to keep your streak going, and every streak day adds 10% to your session XP, up to ×1.5.",
    visual: <SessionVisual />,
  },
  {
    eyebrow: "Badges",
    title: "Collect badges, show off three",
    body: "Badges come from levels, friends, streaks, hours studied, flashcard runs and how long you've been here. Ones you haven't earned yet show as silhouettes that tell you how to get them. Pin your favourite three to your profile.",
    visual: <BadgesVisual />,
  },
  {
    eyebrow: "Chests & coins",
    title: "Surprise chests and a badge shop",
    body: "Chests drop every fifth level, every seven days of streak, and sometimes after a long session or a big flashcard run. Open one for coins, maybe some bonus XP, and once in a while a shop badge for free. Spend your coins in the shop on your profile.",
    visual: <ChestVisual />,
  },
  {
    eyebrow: "Check-ins",
    title: "Check in to bank your XP",
    body: "When a block ends, the Check in button lights up for 5 minutes, and we'll notify you if notifications are on. Tap it to bank that block's XP. Miss it and that block earns nothing and your session pauses, but you can resume within 30 minutes. End early after 10+ minutes and you still get XP for that time. It's how XP stays fair for everyone.",
    visual: <CheckinVisual />,
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
                <button
                  type="button"
                  tabIndex={i === index ? 0 : -1}
                  onClick={() => {
                    navigate("/learn");
                    close();
                  }}
                  className="btn btn-primary mt-4"
                  style={{ minHeight: 40 }}
                >
                  Start a study session
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

function LevelVisual() {
  const sources = [
    { icon: <Timer size={11} />, label: "Study block", xp: 60 },
    { icon: <Layers size={11} />, label: "Flashcard run", xp: 40 },
    { icon: <Users size={11} />, label: "New friend", xp: 50 },
  ];
  return (
    <MiniCard className="w-full max-w-[290px] p-3">
      <div className="flex items-center gap-2">
        <span className="badge badge-accent font-semibold">Lv 7</span>
        <span className="ml-auto text-[11px] tabular-nums text-fg-3">524 / 800 XP</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-hi)" }}>
        <div className="h-full rounded-full" style={{ width: "65%", background: "var(--accent)" }} />
      </div>
      <div className="mt-3 space-y-1">
        {sources.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px] text-fg-2">
            <span className="text-fg-3">{s.icon}</span>
            {s.label}
            <span className="ml-auto font-semibold tabular-nums" style={{ color: "var(--green)" }}>
              +{s.xp} XP
            </span>
          </div>
        ))}
      </div>
    </MiniCard>
  );
}

function SessionVisual() {
  const days = [
    { label: "Su", lit: false },
    { label: "M", lit: true },
    { label: "Tu", lit: true },
    { label: "W", lit: true },
    { label: "Th", lit: true, today: true },
    { label: "F", lit: false },
    { label: "Sa", lit: false },
  ];
  return (
    <MiniCard className="w-full max-w-[300px] p-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-[13px] font-semibold text-fg">
          <Flame size={14} style={{ color: "var(--orange-vivid)" }} />4
        </span>
        <span className="text-[11px] text-fg-3">day streak</span>
        <span className="badge badge-orange ml-auto font-semibold">×1.3</span>
      </div>
      <div className="mt-2.5 flex justify-between">
        {days.map((d) => (
          <div key={d.label} className="flex flex-col items-center gap-1">
            <span
              className="h-5 w-5 rounded-full"
              style={{
                background: d.lit ? "var(--orange-vivid)" : "var(--surface-hi)",
                boxShadow: d.today ? "0 0 0 2px var(--surface), 0 0 0 3.5px var(--accent)" : undefined,
              }}
            />
            <span className="text-[9px] text-fg-3">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2 text-[11px] text-fg-2">
        <Timer size={11} className="text-fg-3" />
        Block 3 of 5
        <span className="ml-auto font-semibold tabular-nums text-fg">12:41</span>
      </div>
    </MiniCard>
  );
}

function BadgesVisual() {
  const tiles = [
    { icon: <Medal size={18} />, color: "var(--accent)", owned: true, featured: true },
    { icon: <Flame size={18} />, color: "var(--orange-vivid)", owned: true, featured: true },
    { icon: <Users size={18} />, color: "var(--green)", owned: true, featured: true },
    { icon: <Clock size={18} />, color: "var(--yellow)", owned: true },
    { icon: <Layers size={18} />, color: "var(--accent)", owned: false },
    { icon: <Medal size={18} />, color: "var(--red)", owned: false },
  ];
  return (
    <div className="w-full max-w-[260px]">
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t, i) => (
          <MiniCard key={i} className="relative flex h-14 items-center justify-center">
            <span
              className="grid h-9 w-9 place-items-center rounded-full"
              style={
                t.owned
                  ? { background: `color-mix(in srgb, ${t.color} 18%, transparent)`, color: t.color }
                  : { background: "var(--surface-hi)", color: "var(--fg-3)", opacity: 0.6 }
              }
            >
              {t.icon}
            </span>
            {!t.owned && (
              <span className="absolute bottom-1 right-1 text-fg-3">
                <Lock size={10} />
              </span>
            )}
            {t.featured && (
              <span
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            )}
          </MiniCard>
        ))}
      </div>
      <div className="mt-2 text-center text-[11px] text-fg-3">All badges (4/24)</div>
    </div>
  );
}

function ChestVisual() {
  const shop = [
    { name: "Spark", price: 300 },
    { name: "Comet", price: 600 },
    { name: "Crown", price: 1200 },
  ];
  return (
    <div className="flex w-full max-w-[310px] items-stretch gap-3">
      <MiniCard className="flex flex-1 flex-col items-center justify-center p-2.5">
        <span
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ background: "color-mix(in srgb, var(--yellow) 18%, transparent)", color: "var(--yellow)" }}
        >
          <Gift size={20} />
        </span>
        <div className="mt-1.5 flex items-center gap-1 text-[12px] font-semibold text-fg">
          <Coins size={12} style={{ color: "var(--yellow)" }} />
          +85
        </div>
        <div className="text-[11px] font-semibold" style={{ color: "var(--green)" }}>
          +120 XP
        </div>
      </MiniCard>
      <MiniCard className="flex-1 p-2.5">
        <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-fg-3">
          Shop
          <span className="ml-auto flex items-center gap-0.5 normal-case tracking-normal text-fg-2">
            <Coins size={10} style={{ color: "var(--yellow)" }} />
            640
          </span>
        </div>
        <div className="space-y-1">
          {shop.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5 text-[11px] text-fg-2">
              <span className="h-3 w-3 rounded-full" style={{ background: "color-mix(in srgb, var(--accent) 30%, transparent)" }} />
              {s.name}
              <span className="ml-auto flex items-center gap-0.5 tabular-nums text-fg-3">
                <Coins size={9} />
                {s.price}
              </span>
            </div>
          ))}
        </div>
      </MiniCard>
    </div>
  );
}

function CheckinVisual() {
  const blocks = [
    { label: "Block 1", state: "done" as const },
    { label: "Block 2", state: "done" as const },
    { label: "Block 3", state: "now" as const },
    { label: "Block 4", state: "next" as const },
  ];
  return (
    <MiniCard className="w-full max-w-[290px] p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-fg-2">
        <BellRing size={12} style={{ color: "var(--accent)" }} />
        Block done! Check in to keep your XP.
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1">
        {blocks.map((b) => (
          <div
            key={b.label}
            className="flex h-7 items-center justify-center rounded-md border text-[9px] font-medium"
            style={
              b.state === "done"
                ? {
                    borderColor: "var(--green)",
                    background: "color-mix(in srgb, var(--green) 12%, var(--surface))",
                    color: "var(--green)",
                  }
                : b.state === "now"
                  ? {
                      borderColor: "var(--accent)",
                      background: "color-mix(in srgb, var(--accent) 14%, var(--surface))",
                      color: "var(--accent)",
                    }
                  : { borderColor: "var(--line)", color: "var(--fg-3)" }
            }
          >
            {b.state === "done" ? <Check size={11} /> : b.label}
          </div>
        ))}
      </div>
      <div
        className="mt-2.5 rounded-md py-1.5 text-center text-[12px] font-semibold"
        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
      >
        Check in
      </div>
      <div className="mt-1 text-center text-[10px] text-fg-3">Open for 4:32 more</div>
    </MiniCard>
  );
}
