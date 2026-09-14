import { X } from "lucide-react";
import DateTimeSelect from "../../components/DateTimeSelect";
import { api } from "../../lib/api";
import { key, type CategoryRow } from "./draftCategories";
import type { AcademicItem, DraftItem, ItemType } from "../../types";

export interface ReviewRow {
  id: string;
  include: boolean;
  type: ItemType;
  title: string;
  dueLocal: string;
  weight: string;
  sourceCategory: string | null;
  category: string | null;
  categoryColor?: string | null;
  duplicate: boolean;
}

export function toRows(
  items: DraftItem[],
  isDuplicate?: (item: DraftItem) => boolean,
): ReviewRow[] {
  return items.map((item, index) => {
    const duplicate = isDuplicate?.(item) ?? false;
    return {
      id: `draft-${index}`,
      include: !duplicate && item.dueAt != null,
      type: item.type,
      title: item.title,
      dueLocal: item.dueAt ?? "",
      weight: item.weight == null ? "" : String(item.weight),
      sourceCategory: item.category ?? null,
      category: null,
      categoryColor: null,
      duplicate,
    };
  });
}

export function saveable(rows: ReviewRow[]): ReviewRow[] {
  return rows.filter((r) => r.include && r.title.trim() && r.dueLocal);
}

export function withCategories(rows: ReviewRow[], categories: CategoryRow[]): ReviewRow[] {
  const on = new Map(categories.filter((c) => c.include).map((c) => [key(c.name), c]));
  return rows.map((row) => {
    const match = row.sourceCategory == null ? undefined : on.get(key(row.sourceCategory));
    return match
      ? { ...row, category: match.name, categoryColor: match.color, type: match.kind }
      : { ...row, category: null, categoryColor: null };
  });
}

export async function postRows(
  courseId: number,
  rows: ReviewRow[],
  categoryIds: Map<string, number> = new Map(),
) {
  const results = await Promise.allSettled(
    rows.map((row) => {
      const categoryId = row.category == null ? undefined : categoryIds.get(key(row.category));
      return api.post<AcademicItem>(`/courses/${courseId}/items`, {
        type: row.type,
        title: row.title.trim(),
        dueAt: new Date(row.dueLocal).toISOString(),
        weight: categoryId != null || !row.weight.trim() ? undefined : Number(row.weight),
        gradeCategoryId: categoryId ?? null,
      });
    }),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  return { saved: rows.length - failed, failed };
}

interface Props {
  rows: ReviewRow[];
  onPatch: (id: string, next: Partial<ReviewRow>) => void;
  onRemove: (id: string) => void;
  emptyText: string;
}

export default function DraftItemRows({ rows, onPatch, onRemove, emptyText }: Props) {
  if (rows.length === 0) {
    return <p className="text-[12px] text-fg-3">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.id}
          className="space-y-2 rounded-lg p-2.5"
          style={{ background: "var(--surface-hi)", opacity: row.include ? 1 : 0.55 }}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={row.include && !!row.dueLocal}
              disabled={!row.dueLocal}
              onChange={(e) => onPatch(row.id, { include: e.target.checked })}
              aria-label={`Include ${row.title}`}
              className="h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <input
              className="input min-w-0 flex-1"
              value={row.title}
              onChange={(e) => onPatch(row.id, { title: e.target.value })}
              placeholder="Title"
            />
            {row.duplicate && (
              <span className="badge badge-muted shrink-0 text-[10px]">Already added</span>
            )}
            <button
              type="button"
              onClick={() => onRemove(row.id)}
              aria-label={`Remove ${row.title}`}
              className="shrink-0 rounded p-1 text-fg-3 transition-colors hover:text-red"
            >
              <X size={13} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {row.category ? (
              <span className="flex min-w-0 shrink-0 items-center gap-1.5 text-[12px] text-fg-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: row.categoryColor ?? "var(--accent)" }}
                />
                <span className="truncate">{row.category}</span>
              </span>
            ) : (
              <select
                className="input w-auto"
                value={row.type}
                onChange={(e) => onPatch(row.id, { type: e.target.value as ItemType })}
              >
                <option value="ASSIGNMENT">Assignment</option>
                <option value="EXAM">Exam</option>
              </select>
            )}
            <DateTimeSelect
              value={row.dueLocal}
              onChange={(v) => onPatch(row.id, { dueLocal: v, include: v ? true : row.include })}
              className="min-w-[210px] flex-1"
            />
            {!row.category && (
              <div className="flex items-center gap-1">
                <input
                  className="input w-[72px]"
                  inputMode="decimal"
                  value={row.weight}
                  onChange={(e) => onPatch(row.id, { weight: e.target.value })}
                  placeholder="—"
                  aria-label={`Weight for ${row.title}`}
                />
                <span className="text-[12px] text-fg-3">%</span>
              </div>
            )}
          </div>
          {!row.dueLocal && (
            <p className="text-[11px] text-yellow">
              The outline gave no date for this one. Set a due date to save it.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
