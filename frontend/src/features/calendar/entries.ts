import type { AcademicItem, CalendarEvent } from "../../types";

export interface Entry {
  key: string;
  title: string;
  accent: string;
  tint: string;
  badge: string;
  when: string;
  subtitle?: string | null;
  place?: string | null;
  item?: AcademicItem;
  event?: CalendarEvent;
}

export function itemEntry(it: AcademicItem): Entry {
  const accent = it.type === "EXAM" ? "var(--red)" : "var(--green)";
  return {
    key: `item-${it.id}`,
    title: it.title,
    accent,
    tint: it.courseColor || accent,
    badge: it.type === "EXAM" ? "Exam" : "Assignment",
    when: it.dueAt,
    subtitle: it.courseName,
    place: it.location,
    item: it,
  };
}

export function eventEntry(ev: CalendarEvent): Entry {
  const color = ev.categoryColor || "var(--accent)";
  return {
    key: `event-${ev.id}`,
    title: ev.title,
    accent: color,
    tint: color,
    badge: ev.categoryName || "Event",
    when: ev.startAt,
    subtitle: ev.categoryName,
    place: ev.place,
    event: ev,
  };
}

export function tintBackground(tint: string): string {
  return `color-mix(in srgb, ${tint} 20%, var(--surface))`;
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
