import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Mascot from "./Mascot";

const EPS = 0.0005;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export default function RunAround({ from, size, onDone }: { from: DOMRect; size: number; onDone: () => void }) {
  const moveRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const move = moveRef.current;
    const face = faceRef.current;
    if (!move || !face) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const x0 = from.left;
    const y0 = from.top;
    const offRight = W + 24;
    const offLeft = -from.width - 24;
    const low = clamp(H * 0.72 - from.height / 2, 8, Math.max(8, H - from.height - 8));

    const d1 = offRight - x0;
    const d2 = offRight - offLeft;
    const d3 = offRight - x0;
    const total = d1 + d2 + d3;
    const speed = Math.max(0.45, W / 1300);
    const duration = clamp(total / speed, 3200, 5600);
    const a = d1 / total;
    const b = (d1 + d2) / total;

    const at = (x: number, y: number, offset: number, opacity = 1): Keyframe => ({
      transform: `translate(${x}px, ${y}px)`,
      opacity,
      offset,
    });

    const run = move.animate(
      [
        at(x0, y0, 0),
        at(offRight, y0, a),
        at(offRight, y0, a + EPS, 0),
        at(offLeft, low, a + 2 * EPS, 0),
        at(offLeft, low, a + 3 * EPS),
        at(offRight, low, b),
        at(offRight, low, b + EPS, 0),
        at(offRight, y0, b + 2 * EPS, 0),
        at(offRight, y0, b + 3 * EPS),
        at(x0, y0, 1),
      ],
      { duration, easing: "linear", fill: "forwards" },
    );
    const turn = face.animate(
      [
        { transform: "scaleX(1)", offset: 0, easing: "step-end" },
        { transform: "scaleX(-1)", offset: b + 2 * EPS, easing: "step-end" },
        { transform: "scaleX(-1)", offset: 1 },
      ],
      { duration, fill: "forwards" },
    );

    let live = true;
    run.finished.then(() => live && onDone()).catch(() => {});
    return () => {
      live = false;
      run.cancel();
      turn.cancel();
    };
  }, [from, onDone]);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      <div
        ref={moveRef}
        className="absolute left-0 top-0 will-change-transform"
        style={{ transform: `translate(${from.left}px, ${from.top}px)` }}
      >
        <div ref={faceRef}>
          <Mascot state="run" size={size} shadow />
        </div>
      </div>
    </div>,
    document.body,
  );
}
