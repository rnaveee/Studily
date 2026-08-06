import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import type { EventCategory, EventCategoryRequest } from "../../types";

export const CATEGORY_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#7968dc",
  "#0ea5e9",
];

export function useEventCategories() {
  return useQuery({
    queryKey: ["event-categories"],
    queryFn: () => api.get<EventCategory[]>("/calendar/categories"),
  });
}

export default function CategorySelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: categories } = useEventCategories();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
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

  const create = useMutation({
    mutationFn: (req: EventCategoryRequest) =>
      api.post<EventCategory>("/calendar/categories", req),
    onSuccess: (category) => {
      qc.invalidateQueries({ queryKey: ["event-categories"] });
      onChange(category.id);
      setCreating(false);
      setName("");
      setColor(CATEGORY_COLORS[0]);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Couldn't create category"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/calendar/categories/${id}`),
    onSuccess: (_result, id) => {
      qc.invalidateQueries({ queryKey: ["event-categories"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      if (value === id) onChange(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Couldn't delete category"),
  });

  function saveNew() {
    setError(null);
    if (!name.trim()) {
      setError("Give the category a name");
      return;
    }
    create.mutate({ name: name.trim(), color });
  }

  async function handleDelete(category: EventCategory) {
    setError(null);
    const ok = await confirm({
      title: `Are you sure you want to delete "${category.name}"?`,
      message: "Events in this category keep their date and details, but lose the category label.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) remove.mutate(category.id);
  }

  if (creating) {
    return (
      <div>
        <label className="field-label">New category</label>
        <div className="flex flex-col gap-2 rounded-lg border border-line p-2.5">
          <input
            className="input"
            placeholder="e.g. Social"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`color ${c}`}
                className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
                style={{ background: c }}
              >
                {color === c && <Check size={12} strokeWidth={3} color="#fff" />}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-red animate-fade">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              className="btn btn-ghost !py-1 text-[12px]"
            >
              <X size={12} />
              Cancel
            </button>
            <button
              type="button"
              onClick={saveNew}
              disabled={create.isPending}
              className="btn btn-primary !py-1 text-[12px]"
            >
              {create.isPending ? "Saving…" : "Save category"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selected = (categories ?? []).find((c) => c.id === value) ?? null;

  return (
    <div>
      <label className="field-label">Category</label>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="input flex items-center gap-2 text-left"
        >
          <span
            className="h-3 w-3 shrink-0 rounded-full border border-line"
            style={{ background: selected?.color ?? "var(--surface-hi)" }}
          />
          <span className={`flex-1 truncate ${selected ? "text-fg" : "text-fg-3"}`}>
            {selected?.name ?? "No category"}
          </span>
          <ChevronDown size={14} className="shrink-0 text-fg-3" />
        </button>

        {open && (
          <div
            role="listbox"
            className="card absolute left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto p-1 shadow-xl animate-in"
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
              <span className="h-3 w-3 shrink-0 rounded-full border border-line" />
              <span className="flex-1 truncate text-[13px] text-fg-3">No category</span>
              {value === null && <Check size={13} className="shrink-0 text-accent" />}
            </button>

            {(categories ?? []).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-1 rounded-md transition-colors hover:bg-surface-hi"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={value === c.id}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: c.color }}
                  />
                  <span className="flex-1 truncate text-[13px] text-fg">{c.name}</span>
                  {value === c.id && <Check size={13} className="shrink-0 text-accent" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c)}
                  disabled={remove.isPending}
                  aria-label={`Delete ${c.name}`}
                  className="mr-1 shrink-0 rounded p-1 text-fg-3 transition-colors hover:bg-surface hover:text-red"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {(categories ?? []).length === 0 && (
              <p className="px-2 py-1.5 text-[12px] text-fg-3">No categories yet</p>
            )}

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
                New category
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-red animate-fade">{error}</p>}
    </div>
  );
}
