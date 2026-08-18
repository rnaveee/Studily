import type { MeetingBlock } from "../types";

export function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function courseLocations(blocks: MeetingBlock[], fallback?: string | null): string[] {
  const seen = new Set<string>();
  for (const b of blocks) {
    const loc = (b.location ?? "").trim();
    if (loc) seen.add(loc);
  }
  if (seen.size === 0 && fallback?.trim()) seen.add(fallback.trim());
  return [...seen];
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatMonth(dateStr: string): string {
  return MONTHS[Number(dateStr.split("-")[1]) - 1] ?? "";
}

export function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins % 60}m`;
  return `in ${mins}m`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dueUrgency(iso: string | null | undefined): { label: string; color: string } | null {
  if (!iso) return null;

  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "Overdue", color: "var(--red)" };

  const hours = Math.floor(ms / 3600000);
  if (hours < 24) {
    return { label: hours < 1 ? "Due within the hour" : plural(hours, "hour"), color: "var(--red)" };
  }

  const days = Math.floor(hours / 24);
  if (days <= 2) return { label: plural(days, "day"), color: "var(--orange)" };
  if (days <= 3) return { label: plural(days, "day"), color: "var(--yellow)" };
  return null;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} left`;
}
