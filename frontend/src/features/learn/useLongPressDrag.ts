import { useCallback, useEffect, useRef, useState } from "react";

const HOLD_MS = 380;
const MOVE_TOLERANCE = 10;
const EDGE = 90;
const SCROLL_STEP = 14;

export interface DragGhost {
  x: number;
  y: number;
  width: number;
  title: string;
}

interface Options {
  enabled: boolean;
  onStart: (id: number) => void;
  onHover: (target: string | null) => void;
  onDrop: (id: number, target: string | null) => void;
  onCancel: () => void;
}

function targetAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  const zone = el?.closest<HTMLElement>("[data-drop-target]");
  return zone ? zone.dataset.dropTarget ?? null : null;
}

export function useLongPressDrag({ enabled, onStart, onHover, onDrop, onCancel }: Options) {
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const phase = useRef<"idle" | "pending" | "active">("idle");
  const timer = useRef<number | null>(null);
  const scrollTimer = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const point = useRef({ x: 0, y: 0 });
  const dragged = useRef<{ id: number; title: string; width: number } | null>(null);
  const lastTouch = useRef(false);
  const swallowClick = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);
  const handlers = useRef({ onStart, onHover, onDrop, onCancel });
  handlers.current = { onStart, onHover, onDrop, onCancel };

  const finish = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    if (scrollTimer.current != null) window.clearInterval(scrollTimer.current);
    timer.current = null;
    scrollTimer.current = null;
    cleanup.current?.();
    cleanup.current = null;
    phase.current = "idle";
    dragged.current = null;
    setGhost(null);
  }, []);

  useEffect(() => finish, [finish]);

  useEffect(() => {
    if (!enabled) finish();
  }, [enabled, finish]);

  const begin = useCallback(
    (e: React.PointerEvent, id: number, title: string) => {
      if (!enabled || e.pointerType !== "touch") {
        lastTouch.current = false;
        return;
      }
      lastTouch.current = true;
      finish();
      const card = e.currentTarget as HTMLElement;
      start.current = { x: e.clientX, y: e.clientY };
      point.current = { x: e.clientX, y: e.clientY };
      dragged.current = { id, title, width: card.getBoundingClientRect().width };
      phase.current = "pending";

      const blockScroll = (ev: TouchEvent) => {
        if (phase.current === "active" && ev.cancelable) ev.preventDefault();
      };
      const move = (ev: PointerEvent) => {
        point.current = { x: ev.clientX, y: ev.clientY };
        if (phase.current === "pending") {
          const dx = ev.clientX - start.current.x;
          const dy = ev.clientY - start.current.y;
          if (Math.hypot(dx, dy) > MOVE_TOLERANCE) finish();
          return;
        }
        if (phase.current === "active" && dragged.current) {
          setGhost({ x: ev.clientX, y: ev.clientY, width: dragged.current.width, title: dragged.current.title });
          handlers.current.onHover(targetAt(ev.clientX, ev.clientY));
        }
      };
      const up = (ev: PointerEvent) => {
        const current = dragged.current;
        const wasActive = phase.current === "active";
        finish();
        if (wasActive && current) {
          swallowClick.current = true;
          window.setTimeout(() => {
            swallowClick.current = false;
          }, 350);
          handlers.current.onHover(null);
          handlers.current.onDrop(current.id, targetAt(ev.clientX, ev.clientY));
        }
      };
      const cancel = () => {
        const wasActive = phase.current === "active";
        finish();
        if (wasActive) {
          handlers.current.onHover(null);
          handlers.current.onCancel();
        }
      };

      document.addEventListener("touchmove", blockScroll, { passive: false });
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      cleanup.current = () => {
        document.removeEventListener("touchmove", blockScroll);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
      };

      timer.current = window.setTimeout(() => {
        if (phase.current !== "pending" || !dragged.current) return;
        phase.current = "active";
        navigator.vibrate?.(15);
        handlers.current.onStart(dragged.current.id);
        setGhost({
          x: point.current.x,
          y: point.current.y,
          width: dragged.current.width,
          title: dragged.current.title,
        });
        handlers.current.onHover(targetAt(point.current.x, point.current.y));
        scrollTimer.current = window.setInterval(() => {
          const y = point.current.y;
          if (y < EDGE) window.scrollBy(0, -SCROLL_STEP);
          else if (y > window.innerHeight - EDGE) window.scrollBy(0, SCROLL_STEP);
          else return;
          handlers.current.onHover(targetAt(point.current.x, point.current.y));
        }, 16);
      }, HOLD_MS);
    },
    [enabled, finish],
  );

  const blocksContextMenu = useCallback(() => lastTouch.current, []);
  const blocksClick = useCallback(() => swallowClick.current, []);

  return { ghost, begin, blocksContextMenu, blocksClick };
}
