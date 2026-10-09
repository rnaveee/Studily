import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BellRing, Check, ChevronLeft, ChevronRight, Coins, Flame, Gift, Layers, ListChecks, Timer, Users, X } from "lucide-react";
import Modal, { useModalClose } from "../../components/Modal";
import Avatar from "../../components/Avatar";
import { useAuth } from "../../lib/auth";

const SEEN_KEY = "studily.whatsnew.progress.v2";
const SUPERSEDED_KEYS = ["studily.whatsnew.flashcards", "studily.whatsnew.progress"];
const OPEN_EVENT = "studily:progress-whats-new";
const QUIET_PATHS = ["/onboarding", "/profile/setup"];
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;
const BADGE_ART = "https://badges.studily.ca/badges/v4";

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
    eyebrow: "Study sessions",
    title: "Study with a plan, earn as you go",
    body: "Start a session at the top of the Study page. Pick Pomodoro (25-minute blocks with 5-minute breaks) or a timer from 30 minutes to 3 hours, and list what you want to get done. When a block ends, check in within 5 minutes to bank its XP, and we'll notify you when it's time. Miss a check-in and that block earns nothing and the session pauses, but you can resume within 30 minutes.",
    visual: <CheckinVisual />,
  },
  {
    eyebrow: "Streaks",
    title: "Keep the flame lit",
    body: "Study at least 15 minutes in a day to light that day up on your week. Every day of streak adds 10% to your session XP, up to ×1.5 at six days. Every 7 days of streak drops a chest, and long streaks unlock fire rings for your profile picture: Ember at 7 days, Blaze at 30 and Inferno at 100.",
    visual: <StreakVisual />,
  },
  {
    eyebrow: "XP, levels & coins",
    title: "Everything you do adds up",
    body: "Earn XP for each study block you check in, for finishing a session, for ticking off your checklist, for flashcard runs and for new friends. XP fills your level bar, and each level takes a little more than the last. After 4 hours of studying in a day, study XP slows down so it stays fair. Coins are Studily's currency: you get them from levelling up and from chests.",
    visual: <XpVisual />,
  },
  {
    eyebrow: "Levelling up",
    title: "Every level pays out",
    body: "Each new level gives you coins, and higher levels give more. Every fifth level also drops a chest, and milestone levels (1, 5, 10, 20, 30, 50, 75 and 100) earn a level badge. Open chests from your profile card for coins, sometimes bonus XP, and once in a while a rare badge or flair.",
    visual: <LevelUpVisual />,
  },
  {
    eyebrow: "Badges & flairs",
    title: "Show it off on your profile",
    body: "Badges come in seven tiers, from wood to rainbow obsidian, and the rarer the badge, the brighter it glows. Earn them from levels, streaks, hours studied, flashcard runs, friends and how long you've been here, then put your favourite three on your profile's podium. Flairs are rings around your profile picture that everyone sees in chats, friend lists and profiles. Wear one at a time.",
    visual: <BadgesFlairsVisual />,
  },
  {
    eyebrow: "The shop",
    title: "Spend your coins",
    body: "Find the shop under Profile › Badges › Shop. Buy flair rings from 250 to 1,500 coins and cosmetic badges from 300 to 1,200. The rarest flairs can't be bought: they only come from chests.",
    visual: <ShopVisual />,
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
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    tabIndex={i === index ? 0 : -1}
                    onClick={() => {
                      navigate("/learn");
                      close();
                    }}
                    className="btn btn-primary"
                    style={{ minHeight: 40 }}
                  >
                    Start a study session
                  </button>
                  <button
                    type="button"
                    tabIndex={i === index ? 0 : -1}
                    onClick={() => {
                      navigate("/profile/badges?tab=shop");
                      close();
                    }}
                    className="btn btn-ghost"
                    style={{ minHeight: 40 }}
                  >
                    Open the shop
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

function MiniCard({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`rounded-lg border border-line ${className}`}
      style={{ background: "var(--surface)", boxShadow: "var(--card-shadow)", ...style }}
    >
      {children}
    </div>
  );
}

function Art({ code, size, alt }: { code: string; size: number; alt: string }) {
  return <img src={`${BADGE_ART}/${code}.webp`} alt={alt} width={size} height={size} className="shrink-0" />;
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

function StreakVisual() {
  const { user } = useAuth();
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
    <div className="flex w-full max-w-[320px] items-center gap-3">
      <MiniCard className="flex-1 p-3">
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
                className="h-4 w-4 rounded-full"
                style={{
                  background: d.lit ? "var(--orange-vivid)" : "var(--surface-hi)",
                  boxShadow: d.today ? "0 0 0 2px var(--surface), 0 0 0 3.5px var(--accent)" : undefined,
                }}
              />
              <span className="text-[9px] text-fg-3">{d.label}</span>
            </div>
          ))}
        </div>
      </MiniCard>
      <div className="flex flex-col items-center gap-1">
        <Avatar
          name={user?.name ?? "You"}
          username={user?.username}
          avatarUrl={user?.avatarUrl}
          size={64}
          flair={{ code: "ring_blaze", imageUrl: null }}
        />
        <span className="text-[10px] font-semibold text-fg-2">Blaze</span>
      </div>
    </div>
  );
}

function XpVisual() {
  const sources = [
    { icon: <Timer size={11} />, label: "Study block", value: "+60 XP" },
    { icon: <ListChecks size={11} />, label: "Checklist task", value: "+5 XP" },
    { icon: <Layers size={11} />, label: "Flashcard run", value: "+40 XP" },
    { icon: <Users size={11} />, label: "New friend", value: "+50 XP" },
  ];
  return (
    <MiniCard className="w-full max-w-[290px] p-3">
      <div className="flex items-center gap-2">
        <span className="badge badge-accent font-semibold">Lv 7</span>
        <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums text-fg-2">
          <Coins size={11} style={{ color: "var(--yellow)" }} />
          640
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-fg-3">524 / 800 XP</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-hi)" }}>
        <div className="h-full rounded-full" style={{ width: "65%", background: "var(--accent)" }} />
      </div>
      <div className="mt-2.5 space-y-1">
        {sources.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px] text-fg-2">
            <span className="text-fg-3">{s.icon}</span>
            {s.label}
            <span className="ml-auto font-semibold tabular-nums" style={{ color: "var(--green)" }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </MiniCard>
  );
}

function LevelUpVisual() {
  return (
    <div className="flex w-full max-w-[310px] items-stretch gap-3">
      <MiniCard className="flex flex-1 flex-col items-center justify-center p-2.5 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-3">Level up!</span>
        <span className="mt-0.5 text-[26px] font-bold leading-none text-accent">10</span>
        <span className="mt-1.5 flex items-center gap-1 text-[12px] font-semibold text-fg">
          <Coins size={12} style={{ color: "var(--yellow)" }} />
          +70
        </span>
      </MiniCard>
      <MiniCard className="flex flex-1 flex-col items-center justify-center p-2.5 text-center">
        <span
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ background: "color-mix(in srgb, var(--yellow) 18%, transparent)", color: "var(--yellow)" }}
        >
          <Gift size={20} />
        </span>
        <span className="mt-1.5 text-[11px] font-semibold text-fg">Chest</span>
        <span className="text-[10px] text-fg-3">every 5th level</span>
      </MiniCard>
      <MiniCard className="flex flex-1 flex-col items-center justify-center p-2 text-center">
        <Art code="level_10" size={64} alt="Level 10 badge" />
        <span className="mt-0.5 text-[10px] text-fg-3">New badge</span>
      </MiniCard>
    </div>
  );
}

function BadgesFlairsVisual() {
  const { user } = useAuth();
  return (
    <div className="flex w-full max-w-[330px] items-end justify-center gap-4">
      <div className="flex items-end">
        <Art code="streak_7" size={60} alt="7-day streak badge" />
        <Art code="og" size={78} alt="OG badge" />
        <Art code="friends_20" size={60} alt="Popular badge" />
      </div>
      <div className="flex flex-col items-center gap-1 pb-1">
        <Avatar
          name={user?.name ?? "You"}
          username={user?.username}
          avatarUrl={user?.avatarUrl}
          size={72}
          flair={{ code: "ring_aurora", imageUrl: null }}
        />
        <span className="text-[10px] font-semibold text-fg-2">Aurora flair</span>
      </div>
    </div>
  );
}

function ShopVisual() {
  const { user } = useAuth();
  const flairs = [
    { code: "ring_mint", name: "Mint", price: 250 },
    { code: "ring_gold", name: "Gold", price: 750 },
    { code: "ring_aurora", name: "Aurora", price: 1500 },
  ];
  return (
    <MiniCard className="w-full max-w-[300px] p-3">
      <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-fg-3">
        Shop
        <span className="ml-auto flex items-center gap-0.5 normal-case tracking-normal text-fg-2">
          <Coins size={11} style={{ color: "var(--yellow)" }} />
          1,640
        </span>
      </div>
      <div className="space-y-1.5">
        {flairs.map((f) => (
          <div key={f.code} className="flex items-center gap-2 text-[11px] text-fg-2">
            <Avatar
              name={user?.name ?? "You"}
              username={user?.username}
              avatarUrl={user?.avatarUrl}
              size={24}
              flair={{ code: f.code, imageUrl: null }}
              still
            />
            {f.name} flair
            <span className="ml-auto flex items-center gap-0.5 tabular-nums text-fg-3">
              <Coins size={9} />
              {f.price}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-[11px] text-fg-2">
          <Art code="cosmetic_crown" size={24} alt="Crown badge" />
          Crown badge
          <span className="ml-auto flex items-center gap-0.5 tabular-nums text-fg-3">
            <Coins size={9} />
            1200
          </span>
        </div>
      </div>
    </MiniCard>
  );
}
