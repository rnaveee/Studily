import { useSyncExternalStore } from "react";

const KEY = "studily.welcome.tour";
const FINISH_KEY = "studily.welcome.finish";
const listeners = new Set<() => void>();

function read(): number | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

let step: number | null = read();

function set(next: number | null) {
  step = next;
  try {
    if (next === null) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, String(next));
  } catch {
  }
  listeners.forEach((l) => l());
}

export const welcomeTour = {
  start: () => set(0),
  complete: () => {
    try {
      sessionStorage.setItem(FINISH_KEY, "1");
    } catch {
    }
    set(null);
  },
  finishPending: () => {
    try {
      return sessionStorage.getItem(FINISH_KEY) === "1";
    } catch {
      return false;
    }
  },
  clearFinish: () => {
    try {
      sessionStorage.removeItem(FINISH_KEY);
    } catch {
    }
  },
  go: (n: number) => set(Math.max(0, n)),
  end: () => set(null),
  current: () => step,
  active: () => step !== null,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export function useWelcomeTourStep(): number | null {
  return useSyncExternalStore(welcomeTour.subscribe, welcomeTour.current, () => null);
}
