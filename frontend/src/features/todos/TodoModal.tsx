import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import DateTimeSelect from "../../components/DateTimeSelect";
import SegmentedToggle from "../../components/SegmentedToggle";
import { api } from "../../lib/api";
import { toLocalInput } from "../../lib/format";
import { toast } from "../../lib/toast";
import type { Todo, TodoChecklistItem, TodoPriority, TodoRequest } from "../../types";
import TodoCategorySelect from "./TodoCategorySelect";
import { PRIORITIES } from "./priority";

export default function TodoModal({ todo, onClose }: { todo?: Todo; onClose: () => void }) {
  const [title, setTitle] = useState(todo?.title ?? "");
  const [notes, setNotes] = useState(todo?.notes ?? "");
  const [priority, setPriority] = useState<TodoPriority>(todo?.priority ?? "MEDIUM");
  const [categoryId, setCategoryId] = useState<number | null>(todo?.categoryId ?? null);
  const [dueLocal, setDueLocal] = useState(() => (todo?.dueAt ? toLocalInput(todo.dueAt) : ""));
  const [checklist, setChecklist] = useState<TodoChecklistItem[]>(() => todo?.checklist ?? []);
  const qc = useQueryClient();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = useMutation({
    mutationFn: (req: TodoRequest) =>
      todo ? api.put<Todo>(`/todos/${todo.id}`, req) : api.post<Todo>("/todos", req),
    onSuccess: () => {
      toast.success(todo ? "Task updated" : "Task created");
      qc.invalidateQueries({ queryKey: ["todos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });

  const canSave = title.trim().length > 0 && !save.isPending;

  function handleSave() {
    if (!canSave) return;
    save.mutate({
      title: title.trim(),
      notes: notes.trim() || null,
      priority,
      dueAt: dueLocal ? new Date(dueLocal).toISOString() : null,
      categoryId,
      checklist: checklist
        .filter((c) => c.text.trim().length > 0)
        .map((c) => ({ id: c.id ?? null, text: c.text.trim(), done: c.done })),
    });
  }

  function updateItem(index: number, patch: Partial<TodoChecklistItem>) {
    setChecklist((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="card flex max-h-[85vh] w-full max-w-sm flex-col gap-4 overflow-y-auto p-5 shadow-xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-[15px] font-semibold text-fg">{todo ? "Edit task" : "New task"}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div>
          <label className="field-label">Task</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Calc homework"
            maxLength={255}
            autoFocus
          />
        </div>

        <TodoCategorySelect value={categoryId} onChange={setCategoryId} />

        <div>
          <div className="flex items-baseline justify-between">
            <label className="field-label">Due date</label>
            {dueLocal && (
              <button
                type="button"
                onClick={() => setDueLocal("")}
                className="text-[11px] text-fg-3 transition-colors hover:text-fg"
              >
                Clear
              </button>
            )}
          </div>
          <DateTimeSelect value={dueLocal} onChange={setDueLocal} />
        </div>

        <div>
          <label className="field-label">Priority</label>
          <SegmentedToggle options={PRIORITIES} value={priority} onChange={setPriority} />
        </div>

        <div>
          <label className="field-label">Notes</label>
          <textarea
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering about this task"
            rows={3}
            maxLength={5000}
          />
        </div>

        <div>
          <label className="field-label">Checklist</label>
          <div className="flex flex-col gap-1.5">
            {checklist.map((item, i) => (
              <div key={item.id ?? `new-${i}`} className="flex items-center gap-1.5">
                <input
                  className="input min-w-0 flex-1"
                  value={item.text}
                  onChange={(e) => updateItem(i, { text: e.target.value })}
                  placeholder={`Step ${i + 1}`}
                  maxLength={255}
                />
                <button
                  type="button"
                  onClick={() => setChecklist((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove step ${i + 1}`}
                  className="shrink-0 rounded p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            {checklist.length >= 100 ? (
              <p className="text-[12px] text-fg-3">That's the most steps one task can hold.</p>
            ) : (
              <button
                type="button"
                onClick={() => setChecklist((prev) => [...prev, { id: null, text: "", done: false }])}
                className="flex items-center gap-1.5 self-start rounded-md px-1 py-1 text-[13px] font-medium text-accent transition-colors hover:bg-surface-hi"
              >
                <Plus size={13} strokeWidth={2.5} />
                Add checklist item
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!canSave} className="btn btn-primary">
            {save.isPending ? "Saving…" : todo ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
