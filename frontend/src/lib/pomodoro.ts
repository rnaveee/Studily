import { useSyncExternalStore } from "react";
import { api, getToken } from "./api";
import { toast } from "./toast";
import { isRingtoneId, playRingtone, unlockAudio, type RingtoneId } from "./ringtones";

export type PomodoroPhase = "study" | "break";

export interface PomodoroState {
  phase: PomodoroPhase;
  running: boolean;
  remainingMs: number;
  studyMin: number;
  breakMin: number;
  ringtone: RingtoneId;
  volume: number;
  completedToday: number;
}

const STUDY_KEY = "studily.pomodoro.study";
const BREAK_KEY = "studily.pomodoro.break";
const STATE_KEY = "studily.pomodoro.state";
const RINGTONE_KEY = "studily.pomodoro.ringtone";
const VOLUME_KEY = "studily.pomodoro.volume";
const SESSIONS_KEY = "studily.pomodoro.sessions";

function clampMin(n: number): number {
  return Math.min(180, Math.max(1, Math.round(n) || 1));
}

function loadMin(key: string, fallback: number): number {
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) && n >= 1 && n <= 180 ? n : fallback;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}

function loadRingtone(): RingtoneId {
  const v = read(RINGTONE_KEY);
  return isRingtoneId(v) ? v : "bells";
}

function loadVolume(): number {
  const raw = read(VOLUME_KEY);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.7;
}

function today(): string {
  return new Date().toDateString();
}

function loadSessions(): number {
  try {
    const saved = JSON.parse(read(SESSIONS_KEY) ?? "null") as { date?: string; count?: number } | null;
    return saved && saved.date === today() && typeof saved.count === "number" ? saved.count : 0;
  } catch {
    return 0;
  }
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
    ringtone: loadRingtone(),
    volume: loadVolume(),
    completedToday: loadSessions(),
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
      ? "Study time is over. Take a break!"
      : "Break time is over. Back to studying!";
  toast.info(message);
  playRingtone(state.ringtone, state.volume);
  if (finished === "study") {
    const count = loadSessions() + 1;
    write(SESSIONS_KEY, JSON.stringify({ date: today(), count }));
    emit({ completedToday: count });
  }
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
    unlockAudio();
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
    write(STUDY_KEY, String(next));
    const fresh = !state.running && state.phase === "study" && state.remainingMs === durationMs("study");
    emit({ studyMin: next, ...(fresh ? { remainingMs: next * 60_000 } : {}) });
    saveState();
  },
  setBreakMin(min: number) {
    const next = clampMin(min);
    write(BREAK_KEY, String(next));
    const fresh = !state.running && state.phase === "break" && state.remainingMs === durationMs("break");
    emit({ breakMin: next, ...(fresh ? { remainingMs: next * 60_000 } : {}) });
    saveState();
  },
  setDurations(studyMin: number, breakMin: number) {
    if (state.running) return;
    const study = clampMin(studyMin);
    const rest = clampMin(breakMin);
    write(STUDY_KEY, String(study));
    write(BREAK_KEY, String(rest));
    const fresh = state.remainingMs === durationMs(state.phase);
    emit({ studyMin: study, breakMin: rest });
    if (fresh) emit({ remainingMs: durationMs(state.phase) });
    saveState();
  },
  setRingtone(id: RingtoneId) {
    write(RINGTONE_KEY, id);
    emit({ ringtone: id });
  },
  setVolume(volume: number) {
    const next = Math.min(1, Math.max(0, volume));
    write(VOLUME_KEY, String(next));
    emit({ volume: next });
  },
  refreshDay() {
    const count = loadSessions();
    if (count !== state.completedToday) emit({ completedToday: count });
  },
};

if (state.running) {
  timer = setInterval(tick, 250);
  syncSchedule();
  document.addEventListener("pointerdown", unlockAudio, { once: true });
} else if (getToken()) {
  api.del("/pomodoro/schedule").catch(() => {});
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function phaseDurationMs(s: PomodoroState): number {
  return (s.phase === "study" ? s.studyMin : s.breakMin) * 60_000;
}

export function pomodoroColor(phase: PomodoroPhase): string {
  return phase === "study" ? "var(--orange)" : "var(--green)";
}

export function usePomodoro(): PomodoroState {
  return useSyncExternalStore(pomodoro.subscribe, pomodoro.getState);
}
