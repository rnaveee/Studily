import { useCallback, useEffect, useState } from "react";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export type PresenceState = "in" | "out";

export function usePresence(open: boolean, exitMs = 160) {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<PresenceState>(open ? "in" : "out");

  useEffect(() => {
    if (open) {
      setMounted(true);
      setState("in");
      return;
    }
    setState("out");
    const delay = prefersReducedMotion() ? 0 : exitMs;
    const t = window.setTimeout(() => setMounted(false), delay);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { mounted: mounted || open, state };
}

export function useDeferredClose(onClose: () => void, exitMs = 160) {
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => setClosing(true), []);

  useEffect(() => {
    if (!closing) return;
    const delay = prefersReducedMotion() ? 0 : exitMs;
    const t = window.setTimeout(onClose, delay);
    return () => window.clearTimeout(t);
  }, [closing, onClose, exitMs]);

  return { closing, close };
}

export function staggerDelay(index: number, step = 50, cap = 8): React.CSSProperties {
  return { "--reveal-delay": `${Math.min(index, cap) * step}ms` } as React.CSSProperties;
}
