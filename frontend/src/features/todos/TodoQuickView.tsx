import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, ChevronRight, ListChecks } from "lucide-react";
import { api } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import { dueUrgency, formatDateTime } from "../../lib/format";
import type { Todo } from "../../types";
import { priorityLabel, priorityTone } from "./priority";
import { Spinner } from "../../components/Skeleton";

const LIMIT = 5;

function pillStyle(color: string): React.CSSProperties {
  return {
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    color,
  };
}

export default function TodoQuickView() {
  const qc = useQueryClient();
  const requireAuth = useRequireAuth();

  const todos = useQuery({
    queryKey: ["todos"],
    queryFn: () => api.get<Todo[]>("/todos"),
  });

  const complete = useMutation({
    mutationFn: ({ id, completed }: { id: number; completed: boolean }) =>
      api.post<Todo>(`/todos/${id}/complete`, { completed }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const all = todos.data ?? [];
  const open = all.filter((t) => !t.completed);
  const top = open.slice(0, LIMIT);
  const overflow = open.length - top.length;

  return (
    <div className="card">
      <div className="flex items-center gap-3 p-4">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <ListChecks size={16} className="text-accent" />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-fg">To-Do List</div>
          <div className="text-[12px] text-fg-3">
            {todos.isLoading
              ? "Loading…"
              : all.length === 0
                ? "Track tasks, checklists, and deadlines."
                : open.length === 0
                  ? `All ${all.length} tasks done. Nice.`
                  : `${open.length} of ${all.length} tasks left`}
          </div>
        </div>
      </div>

      {todos.isLoading ? (
        <div className="border-t border-line px-4 py-3"><Spinner label="Loading…" /></div>
      ) : top.length > 0 ? (
        <ul className="divide-y divide-line border-t border-line">
          {top.map((todo) => {
            const urgency = dueUrgency(todo.dueAt);
            return (
              <li key={todo.id} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                <button
                  onClick={() =>
                    requireAuth(() => complete.mutate({ id: todo.id, completed: true }))
                  }
                  aria-label={`Mark ${todo.title} as done`}
                  aria-pressed={false}
                  className="group mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line transition-colors hover:border-green hover:bg-green"
                >
                  <Check
                    size={12}
                    strokeWidth={3}
                    color="#fff"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link to="/todos" className="font-medium text-fg transition-colors hover:text-accent">
                      {todo.title}
                    </Link>
                    {todo.categoryName && (
                      <span className="badge" style={pillStyle(todo.categoryColor ?? "var(--accent)")}>
                        {todo.categoryName}
                      </span>
                    )}
                    <span className="badge" style={pillStyle(priorityTone(todo.priority))}>
                      {priorityLabel(todo.priority)}
                    </span>
                  </div>
                </div>

                <span
                  className="shrink-0 whitespace-nowrap text-[12px] tabular-nums"
                  style={{ color: urgency?.color ?? "var(--fg-3)" }}
                >
                  {urgency ? urgency.label : todo.dueAt ? formatDateTime(todo.dueAt) : "No due date"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="border-t border-line px-4 py-6 text-center">
          <ListChecks className="mx-auto mb-2 text-fg-3" size={24} strokeWidth={1.5} />
          <p className="text-[13px] text-fg-3">
            {all.length === 0 ? "Nothing on your list yet." : "Everything's checked off."}
          </p>
        </div>
      )}

      <div className="border-t border-line p-3">
        <Link to="/todos" className="btn btn-soft w-full">
          View your full to-do list
          {overflow > 0 && <span className="opacity-75">(+{overflow} more)</span>}
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}
