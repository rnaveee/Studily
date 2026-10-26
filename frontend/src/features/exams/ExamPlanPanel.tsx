import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, ListChecks, Play, X } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { useAuth } from "../../lib/auth";
import { openStartSession } from "../learn/sessions/StartSessionHost";
import { dayCountLabel } from "./examFormat";
import type { ExamPlan, FlashcardSet, Todo } from "../../types";

function dayLabel(date: string, today: boolean): string {
  if (today) return "Today";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function ExamPlanPanel({ examId }: { examId: number }) {
  const qc = useQueryClient();
  const { guest } = useAuth();

  const planQ = useQuery({
    queryKey: ["exams", examId, "plan"],
    queryFn: () => api.get<ExamPlan>(`/exams/${examId}/plan`),
  });
  const setsQ = useQuery({
    queryKey: ["flashcards", "sets"],
    queryFn: () => api.get<FlashcardSet[]>("/flashcard-sets"),
    enabled: !guest,
  });
  const todosQ = useQuery({
    queryKey: ["todos"],
    queryFn: () => api.get<Todo[]>("/todos"),
    enabled: !guest,
  });

  function refresh(plan: ExamPlan) {
    qc.setQueryData(["exams", examId, "plan"], plan);
    qc.invalidateQueries({ queryKey: ["exams", "upcoming"] });
  }

  const link = useMutation({
    mutationFn: (body: { flashcardSetId?: number; todoId?: number }) =>
      api.post<ExamPlan>(`/exams/${examId}/links`, body),
    onSuccess: refresh,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add that"),
  });
  const unlink = useMutation({
    mutationFn: (linkId: number) => api.del<ExamPlan>(`/exams/${examId}/links/${linkId}`),
    onSuccess: refresh,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't remove that"),
  });

  const plan = planQ.data;

  const availableSets = useMemo(() => {
    const used = new Set((plan?.sets ?? []).map((s) => s.setId));
    return (setsQ.data ?? []).filter((s) => !used.has(s.id));
  }, [plan, setsQ.data]);
  const availableTodos = useMemo(() => {
    const used = new Set((plan?.todos ?? []).map((t) => t.todoId));
    return (todosQ.data ?? []).filter((t) => !t.completed && !used.has(t.id));
  }, [plan, todosQ.data]);

  if (planQ.isLoading) return <p className="text-[12.5px] text-fg-3">Loading plan…</p>;
  if (!plan) return <p className="text-[12.5px] text-red">Couldn't load the study plan.</p>;

  const today = plan.days[0];
  const hasWork = plan.sets.length > 0 || plan.todos.some((t) => !t.completed);

  function startSession() {
    if (!plan) return;
    const tasks: string[] = [];
    const exam = `${plan.courseName} ${plan.title}`;
    if (plan.todayCards > 0) {
      tasks.push(`Review ${plan.todayCards} card${plan.todayCards === 1 ? "" : "s"}: ${exam}`);
    }
    for (const t of today?.todos ?? []) tasks.push(t.title);
    if (tasks.length === 0) tasks.push(`Study for ${exam}`);
    openStartSession({ tasks });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="text-[13px] text-fg-2">
          <strong className="text-fg">{dayCountLabel(plan.daysLeft)}</strong> until {plan.title}
        </div>
        {plan.sets.length > 0 && (
          <div className="text-[12px] text-fg-3">{plural(plan.remainingCards, "card")} left to review</div>
        )}
      </div>

      <div className="space-y-2">
        {plan.sets.map((s) => (
          <div key={s.linkId} className="flex items-center gap-2 text-[13px]">
            <Brain size={14} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate text-fg">{s.title}</span>
            <span className="shrink-0 text-[12px] tabular-nums text-fg-3">
              {s.remainingCards}/{s.totalCards} to review
            </span>
            <button
              type="button"
              onClick={() => unlink.mutate(s.linkId)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-3 hover:bg-surface-hi hover:text-fg"
              aria-label={`Remove ${s.title}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {plan.todos.map((t) => (
          <div key={t.linkId} className="flex items-center gap-2 text-[13px]">
            <ListChecks size={14} className="shrink-0 text-accent" />
            <span className={`min-w-0 flex-1 truncate ${t.completed ? "text-fg-3 line-through" : "text-fg"}`}>
              {t.title}
            </span>
            <button
              type="button"
              onClick={() => unlink.mutate(t.linkId)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-3 hover:bg-surface-hi hover:text-fg"
              aria-label={`Remove ${t.title}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {!hasWork && plan.todos.length === 0 && (
          <p className="text-[12.5px] text-fg-3">
            Add flashcard sets and tasks and Studily will spread them over the days before the exam.
          </p>
        )}
      </div>

      {!guest && (
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="input"
            value=""
            disabled={link.isPending || availableSets.length === 0}
            onChange={(e) => e.target.value && link.mutate({ flashcardSetId: Number(e.target.value) })}
            aria-label="Add a flashcard set"
          >
            <option value="">{availableSets.length === 0 ? "No more flashcard sets" : "Add a flashcard set…"}</option>
            {availableSets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <select
            className="input"
            value=""
            disabled={link.isPending || availableTodos.length === 0}
            onChange={(e) => e.target.value && link.mutate({ todoId: Number(e.target.value) })}
            aria-label="Add a task"
          >
            <option value="">{availableTodos.length === 0 ? "No open tasks" : "Add a task…"}</option>
            {availableTodos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {plan.days.length > 0 && hasWork && (
        <ul className="space-y-1">
          {plan.days.map((d) => (
            <li
              key={d.date}
              className="flex flex-wrap items-baseline gap-x-3 rounded-lg px-2.5 py-1.5 text-[12.5px]"
              style={
                d.today
                  ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)" }
                  : undefined
              }
            >
              <span className={`w-24 shrink-0 font-medium ${d.today ? "text-accent" : "text-fg-2"}`}>
                {dayLabel(d.date, d.today)}
              </span>
              <span className="tabular-nums text-fg-2">{d.cards > 0 ? plural(d.cards, "card") : "No cards"}</span>
              {d.todos.length > 0 && (
                <span className="min-w-0 truncate text-fg-3">{d.todos.map((t) => t.title).join(", ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!guest && (
        <button type="button" onClick={startSession} className="btn btn-primary" style={{ minHeight: 40 }}>
          <Play size={14} fill="currentColor" strokeWidth={0} />
          Start session
        </button>
      )}
    </div>
  );
}
