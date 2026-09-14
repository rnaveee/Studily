import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, X } from "lucide-react";
import { api } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import type { AcademicItem, GradeCategory, GradeCategoryRequest } from "../../types";
import { WeightForm, totalWeight, trimPercent, weightsKey } from "./weights";

interface Props {
  courseId: number;
  categories: GradeCategory[];
  items: AcademicItem[];
  onChange: () => void;
}

export default function WeightsSection({ courseId, categories, items, onChange }: Props) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<GradeCategory | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: weightsKey(courseId) });
    onChange();
  };

  const create = useMutation({
    mutationFn: (req: GradeCategoryRequest) =>
      api.post<GradeCategory>(`/courses/${courseId}/weights`, req),
    onSuccess: () => {
      refresh();
      setAdding(false);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, req }: { id: number; req: GradeCategoryRequest }) =>
      api.put<GradeCategory>(`/weights/${id}`, req),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del<void>(`/weights/${id}`),
    onSuccess: refresh,
  });

  async function confirmDelete(category: GradeCategory) {
    const ok = await confirm({
      title: `Delete "${category.name}"?`,
      message:
        "Items in this weight keep their score and due date, but go back to carrying their own weight.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) remove.mutate(category.id);
  }

  const counts = new Map<number, number>();
  for (const item of items) {
    if (item.gradeCategoryId != null) {
      counts.set(item.gradeCategoryId, (counts.get(item.gradeCategoryId) ?? 0) + 1);
    }
  }

  const weightedIds = new Set(categories.filter((c) => c.weight != null).map((c) => c.id));
  const loose = items.filter(
    (i) => (i.gradeCategoryId == null || !weightedIds.has(i.gradeCategoryId)) && (i.weight ?? 0) > 0,
  );
  const looseWeight = loose.reduce((sum, i) => sum + (i.weight ?? 0), 0);

  const total = totalWeight(categories) + looseWeight;
  const balanced = Math.abs(total - 100) <= 0.1;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Weights</h2>
        {categories.some((c) => c.weight != null) && (
          <span className={`badge text-[10px] ${balanced ? "badge-green" : "badge-yellow"}`}>
            Total {trimPercent(total)}%
          </span>
        )}
        <button
          onClick={() => {
            setEditing(null);
            setAdding((a) => !a);
          }}
          className="btn btn-soft ml-auto text-xs"
        >
          <Plus size={12} />
          {adding ? "Cancel" : "Add"}
        </button>
      </div>

      {adding && (
        <WeightForm
          submitLabel="Add weight"
          busy={create.isPending}
          error={create.error instanceof Error ? create.error.message : null}
          onSubmit={(req) => create.mutate(req)}
          onCancel={() => setAdding(false)}
        />
      )}

      {categories.length === 0 ? (
        <p className="text-sm text-fg-3">
          Nothing here yet. Add one for each row of your grading scheme, or a plain label like "Lab
          Assignment" with no percentage — or paste your outline below and we'll fill them in.
        </p>
      ) : (
        <ul className="card divide-y divide-line">
          {categories.map((category) => {
            const count = counts.get(category.id) ?? 0;
            const each = category.weight != null && count > 0 ? category.weight / count : null;

            return (
              <li key={category.id} className="px-4 py-2.5 text-[13px]">
                {editing?.id === category.id ? (
                  <WeightForm
                    initial={category}
                    submitLabel="Save changes"
                    busy={update.isPending}
                    error={update.error instanceof Error ? update.error.message : null}
                    onSubmit={(req) => update.mutate({ id: category.id, req })}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-fg">
                      {category.name}
                    </span>

                    <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-fg-2">
                      {category.weight == null ? (
                        <span className="font-sans text-[11px] font-normal text-fg-3">Label</span>
                      ) : (
                        `${trimPercent(category.weight)}%`
                      )}
                    </span>

                    <div className="order-last basis-full pl-4 text-[11px] text-fg-3 sm:order-none sm:basis-auto sm:pl-0">
                      {count === 0 ? (
                        <span className="text-yellow">No items yet</span>
                      ) : (
                        <>
                          {count} item{count > 1 ? "s" : ""}
                          {each != null && ` · ${trimPercent(each)}% each`}
                          {category.kind === "EXAM" && " · exam"}
                        </>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => {
                          setAdding(false);
                          setEditing(category);
                        }}
                        className="rounded p-1 text-fg-3 transition-colors hover:text-fg"
                        aria-label={`Edit ${category.name}`}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => confirmDelete(category)}
                        className="rounded p-1 text-fg-3 transition-colors hover:text-red"
                        aria-label={`Delete ${category.name}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {loose.length > 0 && (
        <p className="text-[11px] text-fg-3">
          {loose.length} more item{loose.length > 1 ? "s" : ""} carry their own weight (
          {trimPercent(looseWeight)}%).
        </p>
      )}

      {remove.isError && (
        <p className="text-xs text-red animate-fade">
          {remove.error instanceof Error ? remove.error.message : "Could not delete that weight."}
        </p>
      )}
    </section>
  );
}
