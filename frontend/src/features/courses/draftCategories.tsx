import { api } from "../../lib/api";
import { COURSE_COLORS } from "../../lib/courseColors";
import { trimPercent } from "./weights";
import type { DraftCategory, DraftItem, GradeCategory } from "../../types";

export interface CategoryRow {
  name: string;
  kind: DraftCategory["kind"];
  weight: number;
  color: string;
  include: boolean;
  duplicate: boolean;
  itemCount: number;
}

export function key(name: string): string {
  return name.trim().toLowerCase();
}

export function toCategoryRows(
  categories: DraftCategory[],
  items: DraftItem[],
  existing: GradeCategory[] = [],
): CategoryRow[] {
  const taken = new Set(existing.map((c) => key(c.name)));
  return categories.map((category, index) => {
    const duplicate = taken.has(key(category.name));
    return {
      name: category.name,
      kind: category.kind,
      weight: category.weight,
      color: COURSE_COLORS[index % COURSE_COLORS.length],
      include: !duplicate,
      duplicate,
      itemCount: items.filter((i) => i.category != null && key(i.category) === key(category.name))
        .length,
    };
  });
}

export function chosen(rows: CategoryRow[]): CategoryRow[] {
  return rows.filter((r) => r.include);
}

export async function postCategories(
  courseId: number,
  rows: CategoryRow[],
  existing: GradeCategory[] = [],
): Promise<Map<string, number>> {
  const byName = new Map<string, number>(existing.map((c) => [key(c.name), c.id]));

  for (const [index, row] of rows.entries()) {
    if (byName.has(key(row.name))) continue;
    try {
      const saved = await api.post<GradeCategory>(`/courses/${courseId}/weights`, {
        name: row.name,
        weight: row.weight,
        position: index,
      });
      byName.set(key(saved.name), saved.id);
    } catch {
      // A weight that will not save should not stop the items from being added.
    }
  }
  return byName;
}

interface Props {
  rows: CategoryRow[];
  onPatch: (name: string, next: Partial<CategoryRow>) => void;
}

export default function DraftCategoryRows({ rows, onPatch }: Props) {
  if (rows.length === 0) return null;

  const total = chosen(rows).reduce((sum, r) => sum + r.weight, 0);
  const balanced = Math.abs(total - 100) <= 0.1;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="field-label mb-0">Weights</label>
        <span className={`badge text-[10px] ${balanced ? "badge-green" : "badge-yellow"}`}>
          Total {trimPercent(total)}%
        </span>
      </div>

      <div className="space-y-1.5">
        {rows.map((row) => (
          <label
            key={row.name}
            className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-fg-2"
            style={{ background: "var(--surface-hi)", opacity: row.include ? 1 : 0.55 }}
          >
            <input
              type="checkbox"
              checked={row.include}
              onChange={(e) => onPatch(row.name, { include: e.target.checked })}
              className="h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: row.color }}
            />
            <span className="min-w-0 flex-1 truncate text-fg">{row.name}</span>

            {row.duplicate && (
              <span className="badge badge-muted shrink-0 text-[10px]">Already added</span>
            )}

            <span className="shrink-0 font-mono tabular-nums">{trimPercent(row.weight)}%</span>

            <span className="basis-full pl-6 text-[11px] text-fg-3 sm:basis-auto">
              {row.itemCount === 0
                ? "no items"
                : `${row.itemCount} item${row.itemCount > 1 ? "s" : ""}`}
              {row.kind === "EXAM" && " · exam"}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
