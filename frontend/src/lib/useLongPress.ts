import { useCallback, useEffect, useRef } from "react";

const HOLD_MS = 450;
const MOVE_TOLERANCE = 10;
const SUPPRESS_MS = 400;

let suppressUntil = 0;

export function longPressJustFired() {
  return Date.now() < suppressUntil;
}

export function useLongPress(onLongPress: (() => void) | null) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  if (!onLongPress) {
    return {} as {
      onPointerDown?: (e: React.PointerEvent) => void;
      onPointerMove?: (e: React.PointerEvent) => void;
      onPointerUp?: () => void;
      onPointerCancel?: () => void;
      onPointerLeave?: () => void;
      onContextMenu?: (e: React.SyntheticEvent) => void;
      onClickCapture?: (e: React.MouseEvent) => void;
      style?: React.CSSProperties;
    };
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      clear();
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        suppressUntil = Date.now() + SUPPRESS_MS;
        onLongPress();
      }, HOLD_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const start = origin.current;
      if (!start) return;
      if (
        Math.abs(e.clientX - start.x) > MOVE_TOLERANCE ||
        Math.abs(e.clientY - start.y) > MOVE_TOLERANCE
      ) {
        clear();
      }
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
    onClickCapture: (e: React.MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    style: {
      touchAction: "manipulation" as const,
      WebkitTouchCallout: "none" as const,
    },
  };
}
