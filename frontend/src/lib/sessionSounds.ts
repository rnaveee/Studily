import { useSyncExternalStore } from "react";
import { isRingtoneId, type RingtoneId } from "./ringtones";

export type SessionSoundKind = "focusEnd" | "breakEnd";

export interface SessionSoundsState {
  focusEnd: RingtoneId;
  breakEnd: RingtoneId;
  volume: number;
}

const FOCUS_END_KEY = "studily.session.sound.focusEnd";
const BREAK_END_KEY = "studily.session.sound.breakEnd";
const VOLUME_KEY = "studily.session.sound.volume";
const LEGACY_RINGTONE_KEY = "studily.pomodoro.ringtone";
const LEGACY_VOLUME_KEY = "studily.pomodoro.volume";

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

function loadRingtone(key: string, fallback: RingtoneId): RingtoneId {
  const v = read(key);
  return isRingtoneId(v) ? v : fallback;
}

function loadVolume(): number {
  for (const key of [VOLUME_KEY, LEGACY_VOLUME_KEY]) {
    const raw = read(key);
    const n = raw === null ? NaN : Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  }
  return 0.7;
}

let state: SessionSoundsState = {
  focusEnd: loadRingtone(FOCUS_END_KEY, loadRingtone(LEGACY_RINGTONE_KEY, "bells")),
  breakEnd: loadRingtone(BREAK_END_KEY, "rise"),
  volume: loadVolume(),
};

const listeners = new Set<() => void>();

function emit(next: Partial<SessionSoundsState>) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

export const sessionSounds = {
  getState: () => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setSound(kind: SessionSoundKind, id: RingtoneId) {
    write(kind === "focusEnd" ? FOCUS_END_KEY : BREAK_END_KEY, id);
    emit({ [kind]: id });
  },
  setVolume(volume: number) {
    const next = Math.min(1, Math.max(0, volume));
    write(VOLUME_KEY, String(next));
    emit({ volume: next });
  },
};

export function useSessionSounds(): SessionSoundsState {
  return useSyncExternalStore(sessionSounds.subscribe, sessionSounds.getState);
}
