import type { StudySessionMode, StudySessionStatus } from "../../../types";

export const QUALIFY_MINUTES = 15;

export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

export const MODE_LABEL: Record<StudySessionMode, string> = {
  POMODORO: "Pomodoro",
  TIMER: "Timer",
};

export const STATUS_META: Record<StudySessionStatus, { label: string; className: string }> = {
  ACTIVE: { label: "In progress", className: "badge-accent" },
  PAUSED: { label: "Paused", className: "badge-orange" },
  COMPLETED: { label: "Completed", className: "badge-green" },
  ENDED: { label: "Ended early", className: "badge-muted" },
  EXPIRED: { label: "Expired", className: "badge-red" },
};

export function formatMultiplier(multiplier: number): string {
  return `×${multiplier.toFixed(1)}`;
}

export function sessionDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}
