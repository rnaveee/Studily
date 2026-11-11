import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BotBackdrop from "./BotBackdrop";
import Mascot from "./Mascot";
import { BOT_LINES, nextInteraction, nextLine, type Interaction } from "./interactions";

const HOLD_MS = 1900;
const LINE_MS = 7000;

function useFigureSize(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const byHeight = (height - 8) / 1.3;
      const next = Math.round(Math.max(56, Math.min(140, byHeight, width * 0.6)));
      setSize((prev) => (prev === next ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

export default function StudilyBotTile({ className = "" }: { className?: string }) {
  const [line, setLine] = useState(BOT_LINES[0]);
  const [action, setAction] = useState<Interaction | null>(null);
  const holdRef = useRef<number | undefined>(undefined);
  const { ref, size } = useFigureSize(112);

  useEffect(() => {
    if (action) return;
    const t = window.setInterval(() => setLine((prev) => nextLine(prev)), LINE_MS);
    return () => window.clearInterval(t);
  }, [action]);

  useEffect(() => () => window.clearTimeout(holdRef.current), []);

  const interact = () => {
    const next = nextInteraction(action?.id ?? null);
    setAction(next);
    window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => setAction(null), HOLD_MS);
  };

  return (
    <section
      aria-label="StudilyBot"
      className={`card relative isolate flex min-h-[18rem] flex-col items-center gap-1.5 overflow-hidden p-3 xl:min-h-0 ${className}`}
    >
      <BotBackdrop variant="tile" />
      <Link
        to="/study/studilybot"
        aria-label="Open StudilyBot"
        className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
      />
      <span aria-live="polite" className="mascot-bubble pointer-events-none relative z-[1] max-w-full text-center text-xs" key={action?.id ?? line}>
        {action?.line ?? line}
      </span>
      <div ref={ref} className="pointer-events-none relative z-[1] flex min-h-0 w-full flex-1 items-end justify-center">
        <Mascot state={action?.state ?? "idle"} size={size} shadow label="StudilyBot" />
      </div>
      <button
        type="button"
        onClick={interact}
        className="btn btn-primary relative z-[2] text-xs"
      >
        Interact
      </button>
    </section>
  );
}
