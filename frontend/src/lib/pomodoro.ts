import { useSyncExternalStore } from "react";
import { toast } from "./toast";

export type PomodoroPhase = "study" | "break";

export interface PomodoroState {
  phase: PomodoroPhase;
  running: boolean;
  remainingMs: number;
  studyMin: number;
  breakMin: number;
}

const STUDY_KEY = "studily.pomodoro.study";
const BREAK_KEY = "studily.pomodoro.break";

function clampMin(n: number): number {
  return Math.min(180, Math.max(1, Math.round(n) || 1));
}

function loadMin(key: string, fallback: number): number {
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) && n >= 1 && n <= 180 ? n : fallback;
}

const studyMin = loadMin(STUDY_KEY, 25);

let state: PomodoroState = {
  phase: "study",
  running: false,
  remainingMs: studyMin * 60_000,
  studyMin,
  breakMin: loadMin(BREAK_KEY, 5),
};

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let endsAt = 0;

function emit(next: Partial<PomodoroState>) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

function durationMs(phase: PomodoroPhase): number {
  return (phase === "study" ? state.studyMin : state.breakMin) * 60_000;
}

function stopTicking() {
  if (timer) clearInterval(timer);
  timer = null;
}

function notifyPhaseEnd(finished: PomodoroPhase) {
  const message =
    finished === "study"
      ? "Study time is over — take a break!"
      : "Break time is over — back to studying!";
  toast.info(message);
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Pomodoro Timer", { body: message, icon: "/studily-3a.svg" });
    }
  } catch {
  }
}

function tick() {
  const left = endsAt - Date.now();
  if (left <= 0) {
    const phase: PomodoroPhase = state.phase === "study" ? "break" : "study";
    notifyPhaseEnd(state.phase);
    endsAt = Date.now() + durationMs(phase);
    emit({ phase, remainingMs: durationMs(phase) });
  } else {
    emit({ remainingMs: left });
  }
}

export const pomodoro = {
  getState: () => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  start() {
    if (state.running) return;
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
    }
    endsAt = Date.now() + (state.remainingMs > 0 ? state.remainingMs : durationMs(state.phase));
    emit({ running: true });
    timer = setInterval(tick, 250);
  },
  pause() {
    if (!state.running) return;
    stopTicking();
    emit({ running: false, remainingMs: Math.max(0, endsAt - Date.now()) });
  },
  reset() {
    stopTicking();
    emit({ phase: "study", running: false, remainingMs: state.studyMin * 60_000 });
  },
  skip() {
    const phase: PomodoroPhase = state.phase === "study" ? "break" : "study";
    const ms = durationMs(phase);
    if (state.running) endsAt = Date.now() + ms;
    emit({ phase, remainingMs: ms });
  },
  setStudyMin(min: number) {
    const next = clampMin(min);
    localStorage.setItem(STUDY_KEY, String(next));
    const fresh = !state.running && state.phase === "study" && state.remainingMs === durationMs("study");
    emit({ studyMin: next, ...(fresh ? { remainingMs: next * 60_000 } : {}) });
  },
  setBreakMin(min: number) {
    const next = clampMin(min);
    localStorage.setItem(BREAK_KEY, String(next));
    const fresh = !state.running && state.phase === "break" && state.remainingMs === durationMs("break");
    emit({ breakMin: next, ...(fresh ? { remainingMs: next * 60_000 } : {}) });
  },
};

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function pomodoroColor(phase: PomodoroPhase): string {
  return phase === "study" ? "var(--orange)" : "var(--green)";
}

export function usePomodoro(): PomodoroState {
  return useSyncExternalStore(pomodoro.subscribe, pomodoro.getState);
}
