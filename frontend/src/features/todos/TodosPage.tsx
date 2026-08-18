import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import BackButton from "../../components/BackButton";
import { api } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { dueUrgency, formatDateTime } from "../../lib/format";
import type { Todo } from "../../types";
import TodoModal from "./TodoModal";
import { priorityLabel, priorityTone } from "./priority";

export default function TodosPage() {
  const qc = useQueryClient();
  const requireAuth = useRequireAuth();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Todo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const todos = useQuery({
    queryKey: ["todos"],
    queryFn: () => api.get<Todo[]>("/todos"),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["todos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const complete = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      api.post<Todo>(`/todos/${id}/complete`, { completed }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/todos/${id}`),
    onSuccess: invalidate,
  });

  const toggleChecklistItem = useMutation({
    mutationFn: ({ todo, index }: { todo: Todo; index: number }) =>
      api.put<Todo>(`/todos/${todo.id}`, {
        title: todo.title,
        notes: todo.notes ?? null,
        priority: todo.priority,
        dueAt: todo.dueAt ?? null,
        categoryId: todo.categoryId ?? null,
        checklist: todo.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c)),
      }),
    onSuccess: invalidate,
  });

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(todo: Todo) {
    const ok = await confirm({
      title: `Are you sure you want to delete "${todo.title}"?`,
      message: "The task, its notes, and its checklist are removed for good.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) remove.mutate(todo.id);
  }

  function openNew() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(todo: Todo) {
    setEditing(todo);
    setShowModal(true);
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/learn" />
          <div>
            <h1 className="text-xl font-semibold text-fg">To-Do List</h1>
            <p className="mt-1 text-[13px] text-fg-3">
              Everything on your plate, sorted by priority and due date.
            </p>
          </div>
        </div>
        <button onClick={() => requireAuth(openNew)} className="btn btn-primary">
          <Plus size={13} />
          New task
        </button>
      </div>

      {todos.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-fg-3">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
          Loading…
        </div>
      ) : todos.data && todos.data.length > 0 ? (
        <ul className="card divide-y divide-line">
          {todos.data.map((todo) => {
            const urgency = todo.completed ? null : dueUrgency(todo.dueAt);
            const isOpen = expanded.has(todo.id);
            const hasDetail = !!todo.notes || todo.checklist.length > 0;
            const doneCount = todo.checklist.filter((c) => c.done).length;

            return (
              <li key={todo.id} className={`px-4 py-3 ${todo.completed ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() =>
                      requireAuth(() => complete.mutate({ id: todo.id, completed: !todo.completed }))
                    }
                    aria-label={todo.completed ? `Mark ${todo.title} as not done` : `Mark ${todo.title} as done`}
                    aria-pressed={todo.completed}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors"
                    style={{
                      borderColor: todo.completed ? "var(--green)" : "var(--line)",
                      background: todo.completed ? "var(--green)" : "transparent",
                    }}
                  >
                    {todo.completed && <Check size={12} strokeWidth={3} color="#fff" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={`text-[14px] font-medium ${
                          todo.completed ? "text-fg-3 line-through" : "text-fg"
                        }`}
                      >
                        {todo.title}
                      </span>

                      {todo.categoryName && (
                        <span className="badge" style={pillStyle(todo.categoryColor ?? "var(--accent)")}>
                          {todo.categoryName}
                        </span>
                      )}

                      <span className="badge" style={pillStyle(priorityTone(todo.priority))}>
                        {priorityLabel(todo.priority)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-3">
                      {todo.dueAt ? (
                        urgency ? (
                          <span className="font-medium" style={{ color: urgency.color }}>
                            {urgency.label}
                          </span>
                        ) : (
                          <span className="tabular-nums">{formatDateTime(todo.dueAt)}</span>
                        )
                      ) : (
                        <span>No due date</span>
                      )}
                      {todo.dueAt && urgency && (
                        <span className="tabular-nums">· {formatDateTime(todo.dueAt)}</span>
                      )}
                      {todo.checklist.length > 0 && (
                        <span>
                          · {doneCount}/{todo.checklist.length} steps
                        </span>
                      )}
                    </div>

                    {hasDetail && (
                      <button
                        onClick={() => toggleExpanded(todo.id)}
                        aria-expanded={isOpen}
                        className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-accent transition-opacity hover:opacity-75"
                      >
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {isOpen ? "Hide details" : "Show details"}
                      </button>
                    )}

                    {hasDetail && isOpen && (
                      <div className="mt-2 space-y-2">
                        {todo.notes && (
                          <p className="whitespace-pre-wrap text-[13px] text-fg-2">{todo.notes}</p>
                        )}
                        {todo.checklist.length > 0 && (
                          <ul className="space-y-1">
                            {todo.checklist.map((c, i) => (
                              <li key={c.id ?? i} className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    requireAuth(() => toggleChecklistItem.mutate({ todo, index: i }))
                                  }
                                  aria-label={c.done ? `Uncheck ${c.text}` : `Check ${c.text}`}
                                  aria-pressed={c.done}
                                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
                                  style={{
                                    borderColor: c.done ? "var(--green)" : "var(--line)",
                                    background: c.done ? "var(--green)" : "transparent",
                                  }}
                                >
                                  {c.done && <Check size={10} strokeWidth={3} color="#fff" />}
                                </button>
                                <span
                                  className={`text-[13px] ${c.done ? "text-fg-3 line-through" : "text-fg-2"}`}
                                >
                                  {c.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => requireAuth(() => openEdit(todo))}
                      aria-label={`Edit ${todo.title}`}
                      className="rounded p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => requireAuth(() => handleDelete(todo))}
                      aria-label={`Delete ${todo.title}`}
                      className="rounded p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card p-10 text-center">
          <ListChecks className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
          <p className="text-sm text-fg-3">Nothing on your list yet. Add your first task!</p>
        </div>
      )}

      {showModal && (
        <TodoModal todo={editing ?? undefined} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

function pillStyle(color: string): React.CSSProperties {
  return {
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    color,
  };
}
