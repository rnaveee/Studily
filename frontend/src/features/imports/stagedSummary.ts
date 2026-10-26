import type { FeedProvider, StagedItem } from "../../types";

export type StagedClass = "assignment" | "lab" | "quiz" | "exam" | "event";

const LAB = /\blabs?\b/i;
const QUIZ = /\bquiz(zes)?\b/i;

export function providerLabel(provider: FeedProvider | string | null | undefined): string {
  if (provider === "D2L") return "Brightspace";
  if (provider === "MOODLE") return "Moodle";
  return "Canvas";
}

export function classify(item: StagedItem): StagedClass {
  if (item.kind === "EVENT") return "event";
  if (item.type === "EXAM") return QUIZ.test(item.title) ? "quiz" : "exam";
  return LAB.test(item.title) ? "lab" : "assignment";
}

export const CLASS_LABEL: Record<StagedClass, string> = {
  assignment: "Assignment",
  lab: "Lab",
  quiz: "Quiz",
  exam: "Exam",
  event: "Event",
};

const ORDER: StagedClass[] = ["assignment", "lab", "quiz", "exam", "event"];

const PLURAL: Record<StagedClass, string> = {
  assignment: "assignments",
  lab: "labs",
  quiz: "quizzes",
  exam: "exams",
  event: "events",
};

const SINGULAR: Record<StagedClass, string> = {
  assignment: "assignment",
  lab: "lab",
  quiz: "quiz",
  exam: "exam",
  event: "event",
};

export function summarize(items: StagedItem[]): string {
  const counts = new Map<StagedClass, number>();
  for (const item of items) {
    const kind = classify(item);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const parts = ORDER.filter((k) => counts.has(k)).map((k) => {
    const n = counts.get(k)!;
    return `${n} ${n === 1 ? SINGULAR[k] : PLURAL[k]}`;
  });
  return parts.length > 0 ? parts.join(" · ") : "Nothing due yet";
}

export function byDueDate(items: StagedItem[]): StagedItem[] {
  return [...items].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}
