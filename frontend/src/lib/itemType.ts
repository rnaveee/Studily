import type { ItemType } from "../types";

const EXAM_TITLE = /\b(exam|midterm|final|test)\b/i;

export function inferItemType(name: string | null | undefined): ItemType {
  return name && EXAM_TITLE.test(name) ? "EXAM" : "ASSIGNMENT";
}
