import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { api } from "../lib/api";
import { WeightForm, trimPercent, useGradeCategories, weightsKey } from "../features/courses/weights";
import type { GradeCategory, GradeCategoryRequest } from "../types";

interface Props {
  courseId?: number | null;
  value: number | null;
  onChange: (category: GradeCategory | null) => void;
}

export default function GradeCategorySelect({ courseId, value, onChange }: Props) {
  const qc = useQueryClient();
  const { data: categories } = useGradeCategories(courseId);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const list = categories ?? [];

  const create = useMutation({
    mutationFn: (req: GradeCategoryRequest) =>
      api.post<GradeCategory>(`/courses/${courseId}/weights`, req),
    onSuccess: (category) => {
      qc.invalidateQueries({ queryKey: weightsKey(courseId!) });
      onChange(category);
      setCreating(false);
    },
  });

  if (creating) {
    return (
      <div>
        <label className="field-label">New weight</label>
        <WeightForm
          submitLabel="Add weight"
          busy={create.isPending}
          error={create.error instanceof Error ? create.error.message : null}
          onSubmit={(req) => create.mutate(req)}
          onCancel={() => setCreating(false)}
        />
      </div>
    );
  }

  const selected = list.find((c) => c.id === value) ?? null;
  const disabled = courseId == null;

  return (
    <div>
      <label className="field-label">Counts as</label>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="input text-left"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          {selected && (
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: selected.color }}
            />
          )}
          <span className={`min-w-0 flex-1 truncate ${selected ? "text-fg" : "text-fg-3"}`}>
            {disabled ? "Pick a course first" : (selected?.name ?? "Custom weight")}
          </span>
          {selected?.weight != null && (
            <span className="shrink-0 font-mono text-[12px] tabular-nums text-fg-3">
              {trimPercent(selected.weight)}%
            </span>
          )}
        </button>

        {open && (
          <div
            role="listbox"
            className="glass absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto p-1 animate-in"
          >
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hi"
            >
              <span className="h-3 w-3 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg">Custom weight</span>
              {value === null && <Check size={13} className="shrink-0 text-accent" />}
            </button>

            {list.length > 0 && <div className="my-1 border-t border-line" />}

            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={value === c.id}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hi"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: c.color }}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{c.name}</span>
                {c.kind === "EXAM" && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-fg-3">
                    exam
                  </span>
                )}
                {c.weight != null && (
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-fg-3">
                    {trimPercent(c.weight)}%
                  </span>
                )}
                {value === c.id && <Check size={13} className="shrink-0 text-accent" />}
              </button>
            ))}

            <div className="mt-1 border-t border-line pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCreating(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-accent transition-colors hover:bg-surface-hi"
              >
                <Plus size={13} strokeWidth={2.5} />
                New weight
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
