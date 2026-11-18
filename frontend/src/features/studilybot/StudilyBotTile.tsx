import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { prefersReducedMotion } from "../../lib/motion";
import BotBackdrop from "./BotBackdrop";
import HighFiveHand from "./HighFiveHand";
import Mascot from "./Mascot";
import RunAround from "./RunAround";
import { BOT_LINES, RUN_LANDING, nextInteraction, nextLine, type Interaction } from "./interactions";

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
  const [runFrom, setRunFrom] = useState<DOMRect | null>(null);
  const holdRef = useRef<number | undefined>(undefined);
  const botRef = useRef<HTMLSpanElement>(null);
  const { ref, size } = useFigureSize(112);
  const running = runFrom !== null;

  useEffect(() => {
    if (action) return;
    const t = window.setInterval(() => setLine((prev) => nextLine(prev)), LINE_MS);
    return () => window.clearInterval(t);
  }, [action]);

  useEffect(() => () => window.clearTimeout(holdRef.current), []);

  const play = useCallback((next: Interaction) => {
    window.clearTimeout(holdRef.current);
    setAction(next);
    holdRef.current = window.setTimeout(() => setAction(null), next.ms);
  }, []);

  const finishRun = useCallback(() => {
    setRunFrom(null);
    play(RUN_LANDING);
  }, [play]);

  const interact = () => {
    if (running) return;
    const next = nextInteraction(action?.id ?? null, Math.random, { reducedMotion: prefersReducedMotion() });
    const rect = next.state === "run" ? botRef.current?.getBoundingClientRect() : undefined;
    if (rect) {
      window.clearTimeout(holdRef.current);
      setAction(next);
      setRunFrom(rect);
      holdRef.current = window.setTimeout(finishRun, next.ms + 1000);
      return;
    }
    play(next.state === "run" ? RUN_LANDING : next);
  };

  return (
    <section
      aria-label="StudilyBot"
      data-tour="studilybot"
      className={`card relative isolate flex min-h-[18rem] flex-col items-center gap-1.5 overflow-hidden p-3 xl:min-h-0 ${className}`}
    >
      <BotBackdrop variant="tile" />
      <Link
        to="/study/studilybot"
        aria-label="Open StudilyBot"
        className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
      />
      <span
        aria-live="polite"
        className={`mascot-bubble pointer-events-none relative z-[1] max-w-full text-center ${(action?.line ?? line).length > 60 ? "!px-2.5 !py-1.5 text-[11px] !leading-snug" : "text-xs"}`}
        key={action?.id ?? line}
      >
        {action?.line ?? line}
        {action?.author && <span className="mt-0.5 block text-[11px] font-medium text-fg-3">— {action.author}</span>}
      </span>
      <div ref={ref} className="pointer-events-none relative z-[1] flex min-h-0 w-full flex-1 items-end justify-center">
        <span ref={botRef} className={`inline-flex ${running ? "invisible" : ""}`}>
          <Mascot
            state={action?.state ?? "idle"}
            size={size}
            shadow
            label="StudilyBot"
            overlay={action?.id === "highfive" ? <HighFiveHand /> : undefined}
          />
        </span>
      </div>
      <button
        type="button"
        onClick={interact}
        aria-disabled={running}
        className="btn btn-primary relative z-[2] text-xs"
      >
        Interact
      </button>
      {runFrom && <RunAround from={runFrom} size={size} onDone={finishRun} />}
    </section>
  );
}
