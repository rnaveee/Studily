import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, Coins, Lock, Pin } from "lucide-react";
import BadgeArt from "./BadgeArt";
import { CATEGORY_COLOR, CATEGORY_LABEL, formatAcquired, howToEarn } from "./badges";
import type { BadgeDto } from "../../types";

const POPOVER_W = 264;
const GUTTER = 16;

function canHover(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches === true;
}

export default function BadgeTile({
  badge,
  variant = "tile",
  picking = false,
  slot = null,
  onPick,
}: {
  badge: BadgeDto;
  variant?: "tile" | "compact";
  picking?: boolean;
  slot?: number | null;
  onPick?: (badge: BadgeDto) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = !picking && (pinned || hovered);
  const locked = !badge.owned;
  const pickDisabled = picking && locked;

  useEffect(() => {
    if (picking) {
      setPinned(false);
      setHovered(false);
    }
  }, [picking]);

  function handleClick() {
    if (picking) {
      if (!locked) onPick?.(badge);
      return;
    }
    setPinned((p) => !p);
  }

  const label = `${badge.title}${locked ? ", locked" : ""}${slot ? `, featured slot ${slot}` : ""}`;

  if (variant === "compact") {
    return (
      <>
        <button
          ref={ref}
          type="button"
          onClick={handleClick}
          onMouseEnter={() => canHover() && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onBlur={() => setPinned(false)}
          aria-label={label}
          aria-expanded={open}
          className="press flex w-[88px] min-h-[40px] flex-col items-center gap-1.5 rounded-xl px-1 py-1.5 text-center transition-colors hover:bg-surface-hi"
        >
          <BadgeArt badge={badge} size={72} />
          <span className="line-clamp-2 text-[11px] font-medium leading-tight text-fg-2">{badge.title}</span>
        </button>
        {open && <BadgePopover anchor={ref} badge={badge} onClose={() => { setPinned(false); setHovered(false); }} />}
      </>
    );
  }

  const featured = !picking && badge.featuredSlot != null;

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        onMouseEnter={() => canHover() && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onBlur={() => setPinned(false)}
        disabled={pickDisabled}
        aria-label={label}
        aria-expanded={picking ? undefined : open}
        aria-pressed={picking ? slot != null : undefined}
        className={`card ${pickDisabled ? "" : "card-lift"} relative flex h-full min-h-[148px] flex-col items-center gap-2 px-2.5 pb-3 pt-4 text-center disabled:cursor-not-allowed`}
        style={{
          ...(badge.owned
            ? {
                borderColor: "color-mix(in srgb, var(--accent) 22%, var(--line))",
                backgroundColor: "color-mix(in srgb, var(--accent) 4%, var(--surface))",
              }
            : {}),
          ...(slot != null
            ? {
                borderColor: "var(--accent)",
                boxShadow: "0 0 0 1px var(--accent), var(--card-shadow)",
              }
            : {}),
          ...(pickDisabled ? { opacity: 0.45 } : {}),
        }}
      >
        {featured && (
          <span
            className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}
            title="Featured on your profile"
          >
            <Pin size={11} />
          </span>
        )}
        {picking && !locked && (
          <span
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold tabular-nums"
            style={
              slot != null
                ? { background: "var(--accent)", color: "var(--accent-fg)" }
                : { border: "1.5px solid var(--line)", background: "var(--surface)" }
            }
          >
            {slot ?? ""}
          </span>
        )}
        <BadgeArt badge={badge} size={96} />
        <span className="flex min-w-0 flex-col items-center gap-0.5">
          <span className={`line-clamp-2 text-[12.5px] font-semibold leading-snug ${locked ? "text-fg-2" : "text-fg"}`}>
            {badge.title}
          </span>
          <span className="line-clamp-2 text-[11px] leading-snug text-fg-3">{badge.description}</span>
        </span>
      </button>
      {open && <BadgePopover anchor={ref} badge={badge} onClose={() => { setPinned(false); setHovered(false); }} />}
    </>
  );
}

function BadgePopover({
  anchor,
  badge,
  onClose,
}: {
  anchor: RefObject<HTMLButtonElement | null>;
  badge: BadgeDto;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const close = () => closeRef.current();
    function place() {
      const a = anchor.current;
      const el = ref.current;
      if (!a || !el) return;
      const rect = a.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(POPOVER_W, vw - GUTTER * 2);
      const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, GUTTER), vw - GUTTER - width);
      const height = el.offsetHeight;
      const below = rect.bottom + 8;
      const top = below + height <= vh - GUTTER || rect.top - 8 - height < GUTTER ? below : rect.top - 8 - height;
      setPos({ left, top, width });
    }
    place();
    const scroller = anchor.current?.closest("main");
    window.addEventListener("resize", place);
    scroller?.addEventListener("scroll", close, { passive: true });
    return () => {
      window.removeEventListener("resize", place);
      scroller?.removeEventListener("scroll", close);
    };
  }, [anchor]);

  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (anchor.current?.contains(e.target as Node)) return;
      closeRef.current();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
    }
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchor]);

  const acquired = formatAcquired(badge.acquiredAt);
  const color = CATEGORY_COLOR[badge.category];

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="glass pointer-events-none fixed z-[95] p-3.5 text-left animate-fade"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? 0,
        width: pos?.width ?? POPOVER_W,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <div className="flex items-center gap-3">
        <BadgeArt badge={badge} size={56} showLock={false} />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
            {CATEGORY_LABEL[badge.category]}
          </div>
          <div className="text-[14px] font-semibold leading-tight text-fg">{badge.title}</div>
        </div>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-fg-2">{badge.description}</p>
      {badge.owned ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "var(--green)" }}>
          <Check size={13} />
          {acquired ? `Unlocked ${acquired}` : "Unlocked"}
        </p>
      ) : (
        <div className="mt-2.5 rounded-lg px-2.5 py-2 text-[12px] leading-snug text-fg-2" style={{ background: "var(--surface-hi)" }}>
          <div className="mb-0.5 flex items-center gap-1.5 font-semibold text-fg">
            {badge.category === "COSMETIC" ? <Coins size={12} style={{ color: "var(--amber-vivid)" }} /> : <Lock size={12} />}
            {badge.category === "COSMETIC" && badge.priceCoins != null ? `${badge.priceCoins} coins` : "How to earn it"}
          </div>
          {howToEarn(badge)}
        </div>
      )}
    </div>,
    document.body,
  );
}
