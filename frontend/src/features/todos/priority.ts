import type { CSSProperties } from "react";
import type { TodoPriority } from "../../types";
import type { UrgencyLevel } from "../../lib/format";

export const PRIORITIES: { value: TodoPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const TONES: Record<TodoPriority, string> = {
  HIGH: "var(--red-vivid)",
  MEDIUM: "var(--orange-vivid)",
  LOW: "var(--fg-3)",
};

export function priorityTone(priority: TodoPriority): string {
  return TONES[priority];
}

export function priorityLabel(priority: TodoPriority): string {
  return PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
}

export function pillStyle(color: string): CSSProperties {
  return {
    background: `color-mix(in srgb, ${color} 18%, transparent)`,
    color,
  };
}

const URGENCY: Record<UrgencyLevel, { pill: CSSProperties; stripe: string; wash?: string }> = {
  overdue: {
    pill: { background: "var(--red-vivid)", color: "#fff", fontWeight: 600 },
    stripe: "var(--red-vivid)",
    wash: "color-mix(in srgb, var(--red-vivid) 7%, transparent)",
  },
  today: {
    pill: { background: "var(--orange-vivid)", color: "#fff", fontWeight: 600 },
    stripe: "var(--orange-vivid)",
    wash: "color-mix(in srgb, var(--orange-vivid) 6%, transparent)",
  },
  soon: {
    pill: {
      background: "color-mix(in srgb, var(--amber-vivid) 24%, transparent)",
      color: "color-mix(in srgb, var(--amber-vivid) 62%, var(--fg))",
      fontWeight: 600,
    },
    stripe: "var(--amber-vivid)",
  },
  week: {
    pill: {
      background: "color-mix(in srgb, var(--blue-vivid) 16%, transparent)",
      color: "var(--blue-vivid)",
    },
    stripe: "var(--blue-vivid)",
  },
};

export function urgencyStyle(level: UrgencyLevel) {
  return URGENCY[level];
}
