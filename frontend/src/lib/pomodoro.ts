import { useSyncExternalStore } from "react";
import { api, getToken } from "./api";
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
const STATE_KEY = "studily.pomodoro.state";

function clampMin(n: number): number {
  return Math.min(180, Math.max(1, Math.round(n) || 1));
}

function loadMin(key: string, fallback: number): number {
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) && n >= 1 && n <= 180 ? n : fallback;
}

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let endsAt = 0;

function initialState(): PomodoroState {
  const studyMin = loadMin(STUDY_KEY, 25);
  const breakMin = loadMin(BREAK_KEY, 5);
  const idle: PomodoroState = {
    phase: "study",
    running: false,
    remainingMs: studyMin * 60_000,
    studyMin,
    breakMin,
  };
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return idle;
    const saved = JSON.parse(raw) as { phase?: string; running?: boolean; endsAt?: number; remainingMs?: number };
    let phase: PomodoroPhase = saved.phase === "break" ? "break" : "study";
    if (saved.running && typeof saved.endsAt === "number") {
      const now = Date.now();
      let end = saved.endsAt;
      while (end <= now) {
        phase = phase === "study" ? "break" : "study";
        end += (phase === "study" ? studyMin : breakMin) * 60_000;
      }
      endsAt = end;
      return { ...idle, phase, running: true, remainingMs: end - now };
    }
    if (typeof saved.remainingMs === "number" && saved.remainingMs > 0) {
      return { ...idle, phase, remainingMs: saved.remainingMs };
    }
  } catch {
  }
  return idle;
}

let state: PomodoroState = initialState();

function emit(next: Partial<PomodoroState>) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

function saveState() {
  try {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        phase: state.phase,
        running: state.running,
        endsAt: state.running ? endsAt : null,
        remainingMs: state.running ? null : state.remainingMs,
      }),
    );
  } catch {
  }
}

function durationMs(phase: PomodoroPhase): number {
  return (phase === "study" ? state.studyMin : state.breakMin) * 60_000;
}

function stopTicking() {
  if (timer) clearInterval(timer);
  timer = null;
}

function syncSchedule() {
  if (!getToken()) return;
  if (state.running) {
    api
      .post("/pomodoro/schedule", {
        phase: state.phase === "study" ? "STUDY" : "BREAK",
        endsAtEpochMs: endsAt,
        studyMin: state.studyMin,
        breakMin: state.breakMin,
      })
      .catch(() => {});
  } else {
    api.del("/pomodoro/schedule").catch(() => {});
  }
}

function notifyPhaseEnd(finished: PomodoroPhase) {
  const message =
    finished === "study"
      ? "Study time is over — take a break!"
      : "Break time is over — back to studying!";
  toast.info(message);
  try {
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification("Pomodoro Timer", { body: message, icon: "/studily-3a.svg" });
    }
  } catch {
  }
}

function tick() {
  const now = Date.now();
  let left = endsAt - now;
  if (left > 0) {
    emit({ remainingMs: left });
    return;
  }
  const live = left > -5_000;
  let phase = state.phase;
  if (live) notifyPhaseEnd(phase);
  while (left <= 0) {
    phase = phase === "study" ? "break" : "study";
    endsAt += (phase === "study" ? state.studyMin : state.breakMin) * 60_000;
    left = endsAt - now;
  }
  emit({ phase, remainingMs: left });
  saveState();
  syncSchedule();
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
    saveState();
    syncSchedule();
  },
  pause() {
    if (!state.running) return;
    stopTicking();
    emit({ running: false, remainingMs: Math.max(0, endsAt - Date.now()) });
    saveState();
    syncSchedule();
  },
  reset() {
    stopTicking();
    emit({ phase: "study", running: false, remainingMs: state.studyMin * 60_000 });
    saveState();
    syncSchedule();
  },
  skip() {
    const phase: PomodoroPhase = state.phase === "study" ? "break" : "study";
    const ms = durationMs(phase);
    if (state.running) endsAt = Date.now() + ms;
    emit({ phase, remainingMs: ms });
    saveState();
    if (state.running) syncSchedule();
  },
  setStudyMin(min: number) {
    const next = clampMin(min);
    localStorage.setItem(STUDY_KEY, String(next));
    const fresh = !state.running && state.phase === "study" && state.remainingMs === durationMs("study");
    emit({ studyMin: next, ...(fresh ? { remainingMs: next * 60_000 } : {}) });
    saveState();
  },
  setBreakMin(min: number) {
    const next = clampMin(min);
    localStorage.setItem(BREAK_KEY, String(next));
    const fresh = !state.running && state.phase === "break" && state.remainingMs === durationMs("break");
    emit({ breakMin: next, ...(fresh ? { remainingMs: next * 60_000 } : {}) });
    saveState();
  },
};

if (state.running) {
  timer = setInterval(tick, 250);
  syncSchedule();
} else if (getToken()) {
  api.del("/pomodoro/schedule").catch(() => {});
}

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
