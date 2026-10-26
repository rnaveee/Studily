import { effectiveWeights, parseScoreInput } from "../../lib/grades";
import type { AcademicItem, AcademicItemRequest, Course, GradeCategory } from "../../types";
import type { CalcState, FinalExam, Item, OtherItem, Section } from "./gradeCalc";

export type LinkRef =
  | { kind: "item"; id: number }
  | { kind: "other"; id: number }
  | { kind: "final" };

export interface CalcLink {
  ref: LinkRef;
  item: AcademicItem;
}

export interface LoadedCourse {
  course: Course;
  links: CalcLink[];
}

export interface BuiltFromCourse {
  state: CalcState;
  links: CalcLink[];
}

function plain(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function markOf(item: AcademicItem): string {
  if (item.score == null || item.maxScore == null) return "";
  return `${plain(item.score)}/${plain(item.maxScore)}`;
}

function nameOf(item: AcademicItem): string {
  return item.title.slice(0, 80);
}

export function findFinalExam(items: AcademicItem[]): AcademicItem | null {
  const exams = items
    .filter((item) => item.type === "EXAM" && /final/i.test(item.title))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return exams.length > 0 ? exams[exams.length - 1] : null;
}

export function buildFromCourse(
  course: Course,
  items: AcademicItem[],
  categories: GradeCategory[],
  nextId: () => number,
): BuiltFromCourse {
  const effective = effectiveWeights(items, categories);
  const finalItem = findFinalExam(items);
  const byDue = [...items].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const links: CalcLink[] = [];

  const sections: Section[] = [];
  const weighted = [...categories]
    .filter((c) => c.weight != null)
    .sort((a, b) => a.position - b.position);
  for (const category of weighted) {
    const members = byDue.filter((i) => i.gradeCategoryId === category.id && i !== finalItem);
    if (members.length === 0 && finalItem?.gradeCategoryId === category.id) continue;
    const sectionItems: Item[] = members.map((i) => {
      const id = nextId();
      links.push({ ref: { kind: "item", id }, item: i });
      return { id, name: nameOf(i), mark: markOf(i) };
    });
    const finalShare =
      finalItem?.gradeCategoryId === category.id ? (effective.get(finalItem.id) ?? 0) : 0;
    sections.push({
      id: nextId(),
      name: category.name.slice(0, 80),
      weight: plain(Math.max(0, (category.weight ?? 0) - finalShare)),
      items: sectionItems,
    });
  }

  const weightedIds = new Set(weighted.map((c) => c.id));
  const other: OtherItem[] = byDue
    .filter((i) => i !== finalItem && !(i.gradeCategoryId != null && weightedIds.has(i.gradeCategoryId)))
    .map((i) => {
      const id = nextId();
      links.push({ ref: { kind: "other", id }, item: i });
      const weight = effective.get(i.id);
      return { id, name: nameOf(i), weight: weight != null ? plain(weight) : "", mark: markOf(i) };
    });

  let final: FinalExam | null = null;
  if (finalItem) {
    links.push({ ref: { kind: "final" }, item: finalItem });
    const weight = effective.get(finalItem.id);
    final = { weight: weight != null ? plain(weight) : "", mark: markOf(finalItem) };
  }

  return {
    state: {
      sections,
      other,
      final,
      target: course.targetGrade != null ? plain(course.targetGrade) : "",
    },
    links,
  };
}

function markFor(state: CalcState, ref: LinkRef): string | null {
  if (ref.kind === "final") return state.final ? state.final.mark : null;
  if (ref.kind === "other") return state.other.find((o) => o.id === ref.id)?.mark ?? null;
  for (const section of state.sections) {
    const found = section.items.find((i) => i.id === ref.id);
    if (found) return found.mark;
  }
  return null;
}

export interface MarkChange {
  link: CalcLink;
  request: AcademicItemRequest;
}

export interface PendingChanges {
  changes: MarkChange[];
  invalid: number;
}

export function pendingChanges(state: CalcState, links: CalcLink[]): PendingChanges {
  const changes: MarkChange[] = [];
  let invalid = 0;
  for (const link of links) {
    const raw = markFor(state, link.ref);
    if (raw == null) continue;

    let score: number | null = null;
    let maxScore: number | null = null;
    if (raw.trim()) {
      const parsed = parseScoreInput(raw);
      if (!parsed) {
        invalid++;
        continue;
      }
      score = parsed.score;
      maxScore = parsed.maxScore;
    }

    const item = link.item;
    if ((item.score ?? null) === score && (item.maxScore ?? null) === maxScore) continue;

    changes.push({
      link,
      request: {
        type: item.type,
        title: item.title,
        dueAt: item.dueAt,
        location: item.location,
        weight: item.weight,
        score,
        maxScore,
        status: score != null && item.status !== "DONE" ? "DONE" : item.status,
        gradeCategoryId: item.gradeCategoryId ?? null,
      },
    });
  }
  return { changes, invalid };
}

export function unsavedRowCount(state: CalcState, links: CalcLink[]): number {
  const linkedItems = new Set(links.filter((l) => l.ref.kind === "item").map((l) => (l.ref as { id: number }).id));
  const linkedOther = new Set(links.filter((l) => l.ref.kind === "other").map((l) => (l.ref as { id: number }).id));
  let count = 0;
  for (const section of state.sections) {
    for (const item of section.items) if (!linkedItems.has(item.id)) count++;
  }
  for (const item of state.other) if (!linkedOther.has(item.id)) count++;
  if (state.final && !links.some((l) => l.ref.kind === "final")) count++;
  return count;
}

export function targetFromState(state: CalcState): number | null | "invalid" {
  const text = state.target.trim().replace(/%$/, "").trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 150) return "invalid";
  return n;
}
