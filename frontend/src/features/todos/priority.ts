import type { TodoPriority } from "../../types";

export const PRIORITIES: { value: TodoPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const TONES: Record<TodoPriority, string> = {
  HIGH: "var(--red)",
  MEDIUM: "var(--orange)",
  LOW: "var(--fg-3)",
};

export function priorityTone(priority: TodoPriority): string {
  return TONES[priority];
}

export function priorityLabel(priority: TodoPriority): string {
  return PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
}
