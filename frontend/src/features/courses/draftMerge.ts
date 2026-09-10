import type { AcademicItem, Course, DraftItem, MeetingBlock } from "../../types";

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function sameDay(a: string, b: string): boolean {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isDuplicateItem(draft: DraftItem, existing: AcademicItem[]): boolean {
  const title = normalizeTitle(draft.title);
  return existing.some((item) => {
    if (normalizeTitle(item.title) !== title) return false;
    return draft.dueAt == null || sameDay(draft.dueAt, item.dueAt);
  });
}

export function blockKey(block: MeetingBlock): string {
  return [
    block.dayOfWeek,
    block.kind ?? "LECTURE",
    block.startTime.slice(0, 5),
    block.endTime.slice(0, 5),
  ].join("|");
}

export function newBlocks(draft: MeetingBlock[], course: Course): MeetingBlock[] {
  const seen = new Set(course.meetingBlocks.map(blockKey));
  const out: MeetingBlock[] = [];
  for (const block of draft) {
    const key = blockKey(block);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(block);
  }
  return out;
}

export type DetailField = "name" | "code" | "professor" | "location";

export interface DetailChange {
  field: DetailField;
  label: string;
  current: string;
  proposed: string;
}

const DETAIL_LABELS: Record<DetailField, string> = {
  name: "Name",
  code: "Code",
  professor: "Professor",
  location: "Room",
};

export function detailChanges(
  draft: Partial<Record<DetailField, string | null>>,
  course: Course,
): DetailChange[] {
  const fields: DetailField[] = ["name", "code", "professor", "location"];
  const out: DetailChange[] = [];
  for (const field of fields) {
    const proposed = (draft[field] ?? "").trim();
    const current = (course[field] ?? "").trim();
    if (!proposed || proposed === current) continue;
    out.push({ field, label: DETAIL_LABELS[field], current, proposed });
  }
  return out;
}
