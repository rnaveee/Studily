import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import BackButton from "../../components/BackButton";
import { Spinner } from "../../components/Skeleton";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { applyDelta } from "../../lib/progressDelta";
import { isStandalone } from "../../lib/pwa";
import { toast } from "../../lib/toast";
import type {
  ProgressDelta,
  SurveyAnswerValue,
  SurveyDto,
  SurveyQuestion,
} from "../../types";

type Answers = Record<string, SurveyAnswerValue>;

const TEXT_LIMIT = 1000;
const SCALE_ENDS: Record<string, [string, string]> = {
  ease: ["Very hard", "Very easy"],
  recommend: ["Not at all likely", "Extremely likely"],
};
const STEP_TITLES = ["About you", "Features", "Problems", "What's next", "Overall"];

function draftKey(key: string) {
  return `studily.survey.draft.${key}`;
}

function loadDraft(key: string): { answers: Answers; step: number } {
  try {
    const raw = localStorage.getItem(draftKey(key));
    if (!raw) return { answers: {}, step: 1 };
    const parsed = JSON.parse(raw);
    return {
      answers: parsed && typeof parsed.answers === "object" && parsed.answers ? parsed.answers : {},
      step: Number.isInteger(parsed?.step) ? parsed.step : 1,
    };
  } catch {
    return { answers: {}, step: 1 };
  }
}

function saveDraft(key: string, answers: Answers, step: number) {
  try {
    localStorage.setItem(draftKey(key), JSON.stringify({ answers, step }));
  } catch {
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(draftKey(key));
  } catch {
  }
}

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function visibleIds(questions: SurveyQuestion[], answers: Answers): Set<string> {
  const visible = new Set<string>();
  for (const q of questions) {
    if (!q.showIf) {
      visible.add(q.id);
      continue;
    }
    if (!visible.has(q.showIf.question)) continue;
    const source = answers[q.showIf.question];
    if (typeof source === "string") {
      if (q.showIf.values.includes(source)) visible.add(q.id);
    } else if (source && !Array.isArray(source) && typeof source === "object") {
      if (Object.values(source).some((v) => q.showIf!.values.includes(v))) visible.add(q.id);
    }
  }
  return visible;
}

function optionsOf(q: SurveyQuestion, questions: SurveyQuestion[], answers: Answers) {
  if (q.optionsFrom) {
    const source = questions.find((s) => s.id === q.optionsFrom);
    const matrix = answers[q.optionsFrom];
    if (!source?.rows || !matrix || typeof matrix !== "object" || Array.isArray(matrix)) return [];
    const allowed = q.showIf?.values ?? [];
    return source.rows
      .filter((r) => allowed.includes((matrix as Record<string, string>)[r.id]))
      .map((r) => ({ value: r.id, label: r.label }));
  }
  return (q.options ?? []).map((o) => ({ value: o, label: o }));
}

function answered(q: SurveyQuestion, value: SurveyAnswerValue | undefined): boolean {
  if (value === undefined) return false;
  switch (q.type) {
    case "MULTI":
      return Array.isArray(value) && value.length > 0;
    case "MATRIX":
      return (
        typeof value === "object" &&
        !Array.isArray(value) &&
        (q.rows ?? []).every((r) => !!(value as Record<string, string>)[r.id])
      );
    case "SCALE":
      return typeof value === "number";
    case "TEXT":
      return true;
    default:
      return typeof value === "string" && value.length > 0;
  }
}

function cleanAnswers(questions: SurveyQuestion[], answers: Answers): Answers {
  const visible = visibleIds(questions, answers);
  const out: Answers = {};
  for (const q of questions) {
    if (!visible.has(q.id)) continue;
    const value = answers[q.id];
    if (q.type === "TEXT") {
      if (typeof value === "string" && value.trim()) out[q.id] = value.trim();
      continue;
    }
    if (value === undefined) continue;
    if (q.type === "SINGLE" && q.optionsFrom) {
      if (!optionsOf(q, questions, answers).some((o) => o.value === value)) continue;
    }
    out[q.id] = value;
  }
  return out;
}

export default function SurveyPage() {
  const { guest } = useAuth();
  const qc = useQueryClient();
  const surveyQ = useQuery({
    queryKey: ["survey"],
    queryFn: () => api.get<SurveyDto>("/survey"),
    enabled: !guest,
  });
  const [done, setDone] = useState(false);

  if (guest) {
    return (
      <Shell>
        <Notice title="Sign in to give feedback" body="Create an account to take the survey and earn a reward." />
      </Shell>
    );
  }
  if (surveyQ.isLoading) {
    return (
      <Shell>
        <div className="py-10 text-center">
          <Spinner size={16} label="Loading…" />
        </div>
      </Shell>
    );
  }
  const survey = surveyQ.data;
  if (!survey) {
    return (
      <Shell>
        <Notice title="Couldn't load the survey" body="Try again in a moment." />
      </Shell>
    );
  }
  if (done) {
    return (
      <Shell>
        <Notice
          title="Thank you!"
          body="Your answers help decide what Studily builds next. Your reward is in your chests."
          done
        />
      </Shell>
    );
  }
  if (survey.completed) {
    return (
      <Shell>
        <Notice title="You already answered" body="Thanks for helping shape Studily." done />
      </Shell>
    );
  }
  if (!survey.open) {
    return (
      <Shell>
        <Notice title="This survey is closed" body="Thanks for stopping by. Watch for the next one." />
      </Shell>
    );
  }
  if (!survey.eligible) {
    return (
      <Shell>
        <Notice
          title="Not available yet"
          body="The survey opens once your email is verified and your account is a few days old."
        />
      </Shell>
    );
  }
  return (
    <Shell>
      <Form
        survey={survey}
        onDone={(delta) => {
          applyDelta(delta, qc, { announceBadges: true });
          qc.invalidateQueries({ queryKey: ["survey"] });
          setDone(true);
        }}
        onConflict={() => qc.invalidateQueries({ queryKey: ["survey"] })}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in mx-auto w-full max-w-2xl">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-semibold text-fg">Help shape Studily</h1>
      </div>
      {children}
    </div>
  );
}

function Notice({ title, body, done }: { title: string; body: string; done?: boolean }) {
  return (
    <div className="card mt-4 p-6 text-center">
      {done && (
        <div
          className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--green) 16%, transparent)", color: "var(--green)" }}
        >
          <Check size={20} />
        </div>
      )}
      <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-fg-2">{body}</p>
      <Link to="/dashboard" className="btn btn-ghost mt-4 inline-flex">
        Back to dashboard
      </Link>
    </div>
  );
}

function Form({
  survey,
  onDone,
  onConflict,
}: {
  survey: SurveyDto;
  onDone: (delta: ProgressDelta) => void;
  onConflict: () => void;
}) {
  const { key, definition } = survey;
  const questions = definition.questions;
  const initial = useMemo(() => loadDraft(key), [key]);
  const [answers, setAnswers] = useState<Answers>(initial.answers);
  const [step, setStep] = useState(Math.min(Math.max(initial.step, 1), definition.steps));
  const [attempted, setAttempted] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveDraft(key, answers, step);
  }, [key, answers, step]);

  const visible = useMemo(() => visibleIds(questions, answers), [questions, answers]);
  const stepQuestions = questions.filter((q) => q.step === step && visible.has(q.id));
  const missing = stepQuestions.filter((q) => q.required && !answered(q, answers[q.id]));

  const submit = useMutation({
    mutationFn: () =>
      api.post<ProgressDelta>("/survey", {
        key,
        platform: detectPlatform(),
        standalone: isStandalone(),
        answers: cleanAnswers(questions, answers),
      }),
    onSuccess: (delta) => {
      clearDraft(key);
      onDone(delta);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        clearDraft(key);
        onConflict();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : "Couldn't send your answers");
    },
  });

  function setAnswer(id: string, value: SurveyAnswerValue | undefined) {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
  }

  function jump(next: number) {
    setAttempted(false);
    setStep(next);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function next() {
    if (missing.length > 0) {
      setAttempted(true);
      return;
    }
    if (step >= definition.steps) submit.mutate();
    else jump(step + 1);
  }

  const last = step >= definition.steps;

  return (
    <div ref={topRef} className="mt-4 scroll-mt-4">
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="font-semibold text-fg">
          Step {step} of {definition.steps}
        </span>
        <span className="text-fg-3">{STEP_TITLES[step - 1]}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full"
        style={{ background: "var(--surface-hi)" }}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={definition.steps}
        aria-valuenow={step}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(step / definition.steps) * 100}%`, background: "var(--accent)" }}
        />
      </div>

      <div className="mt-4 space-y-4">
        {stepQuestions.map((q) => (
          <QuestionBlock
            key={q.id}
            question={q}
            questions={questions}
            answers={answers}
            value={answers[q.id]}
            onChange={(v) => setAnswer(q.id, v)}
            invalid={attempted && missing.some((m) => m.id === q.id)}
          />
        ))}
      </div>

      {attempted && missing.length > 0 && (
        <p className="mt-3 text-[12px]" style={{ color: "var(--red)" }}>
          Please answer the highlighted {missing.length === 1 ? "question" : "questions"} to continue.
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => jump(step - 1)}
          disabled={step === 1 || submit.isPending}
        >
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onMouseDown={(e) => e.preventDefault()}
          onClick={next}
          disabled={submit.isPending}
        >
          {last ? (submit.isPending ? "Sending…" : "Send answers") : "Next"}
        </button>
      </div>
    </div>
  );
}

function QuestionBlock({
  question,
  questions,
  answers,
  value,
  onChange,
  invalid,
}: {
  question: SurveyQuestion;
  questions: SurveyQuestion[];
  answers: Answers;
  value: SurveyAnswerValue | undefined;
  onChange: (value: SurveyAnswerValue | undefined) => void;
  invalid: boolean;
}) {
  const prompt = question.prompt.includes("{names}")
    ? question.prompt.replace("{names}", stoppedNames(question, questions, answers))
    : question.prompt;

  return (
    <fieldset
      className="card p-4"
      style={invalid ? { borderColor: "var(--red)" } : undefined}
      aria-invalid={invalid}
    >
      <legend className="sr-only">{prompt}</legend>
      <h2 className="text-[14px] font-semibold text-fg">
        {prompt}
        {question.type === "MULTI" && question.maxPicks && (
          <span className="ml-1.5 text-[11px] font-normal text-fg-3">(up to {question.maxPicks})</span>
        )}
        {question.type === "MULTI" && !question.maxPicks && (
          <span className="ml-1.5 text-[11px] font-normal text-fg-3">(pick any)</span>
        )}
        {!question.required && <span className="ml-1.5 text-[11px] font-normal text-fg-3">Optional</span>}
      </h2>
      <div className="mt-3">
        {question.type === "SINGLE" && (
          <Choices
            options={optionsOf(question, questions, answers)}
            selected={typeof value === "string" ? [value] : []}
            onPick={(v) => onChange(v)}
          />
        )}
        {question.type === "MULTI" && (
          <Choices
            multi
            options={optionsOf(question, questions, answers)}
            selected={Array.isArray(value) ? value : []}
            onPick={(v) => {
              const current = Array.isArray(value) ? value : [];
              if (current.includes(v)) {
                const rest = current.filter((c) => c !== v);
                onChange(rest.length ? rest : undefined);
              } else if (!question.maxPicks || current.length < question.maxPicks) {
                onChange([...current, v]);
              }
            }}
            full={!!question.maxPicks && Array.isArray(value) && value.length >= question.maxPicks}
          />
        )}
        {question.type === "SCALE" && (
          <Scale
            question={question}
            value={typeof value === "number" ? value : null}
            onPick={(v) => onChange(v)}
          />
        )}
        {question.type === "TEXT" && (
          <div>
            <textarea
              className="input"
              rows={3}
              maxLength={TEXT_LIMIT}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value || undefined)}
              aria-label={prompt}
            />
            <p className="mt-1 text-right text-[11px] text-fg-3 tabular-nums">
              {(typeof value === "string" ? value : "").length} / {TEXT_LIMIT}
            </p>
          </div>
        )}
        {question.type === "MATRIX" && (
          <Matrix
            question={question}
            value={value && typeof value === "object" && !Array.isArray(value) ? value : {}}
            onChange={(v) => onChange(Object.keys(v).length ? v : undefined)}
          />
        )}
      </div>
    </fieldset>
  );
}

function stoppedNames(question: SurveyQuestion, questions: SurveyQuestion[], answers: Answers): string {
  const sourceId = question.showIf?.question;
  const source = questions.find((q) => q.id === sourceId);
  const matrix = sourceId ? answers[sourceId] : undefined;
  if (!source?.rows || !matrix || typeof matrix !== "object" || Array.isArray(matrix)) return "these";
  const names = source.rows
    .filter((r) => question.showIf!.values.includes((matrix as Record<string, string>)[r.id]))
    .map((r) => r.label);
  if (names.length === 0) return "these";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const SELECTED_STYLE = {
  borderColor: "var(--accent)",
  background: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
};

function Choices({
  options,
  selected,
  onPick,
  multi,
  full,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onPick: (value: string) => void;
  multi?: boolean;
  full?: boolean;
}) {
  return (
    <div className="space-y-2" role={multi ? "group" : "radiogroup"}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        const blocked = !!multi && !!full && !on;
        return (
          <button
            key={o.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            disabled={blocked}
            onClick={() => onPick(o.value)}
            className="card card-lift flex w-full items-center gap-2.5 p-3 text-left disabled:opacity-50"
            style={on ? SELECTED_STYLE : undefined}
          >
            <span
              className={`grid h-4 w-4 shrink-0 place-items-center border ${multi ? "rounded" : "rounded-full"}`}
              style={{
                borderColor: on ? "var(--accent)" : "var(--line)",
                background: on ? "var(--accent)" : "transparent",
                color: "var(--accent-fg)",
              }}
            >
              {on && <Check size={11} strokeWidth={3} />}
            </span>
            <span className="min-w-0 text-[13px] text-fg">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Scale({
  question,
  value,
  onPick,
}: {
  question: SurveyQuestion;
  value: number | null;
  onPick: (value: number) => void;
}) {
  const min = question.min ?? 0;
  const max = question.max ?? 10;
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const ends = SCALE_ENDS[question.id];
  return (
    <div>
      <div
        className={`grid gap-1.5 ${values.length > 6 ? "grid-cols-6 sm:grid-cols-11" : "grid-cols-5"}`}
        role="radiogroup"
      >
        {values.map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(n)}
              className="card card-lift py-2.5 text-[13px] font-semibold tabular-nums text-fg"
              style={on ? { ...SELECTED_STYLE, color: "var(--accent)" } : undefined}
            >
              {n}
            </button>
          );
        })}
      </div>
      {ends && (
        <div className="mt-1.5 flex justify-between text-[11px] text-fg-3">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
    </div>
  );
}

function Matrix({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}) {
  const rows = question.rows ?? [];
  const columns = question.columns ?? [];
  const set = (id: string, column: string) => onChange({ ...value, [id]: column });

  return (
    <div>
      <div className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl p-3" style={{ background: "var(--surface-hi)" }}>
            <div className="text-[13px] font-medium text-fg">{r.label}</div>
            <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={r.label}>
              {columns.map((c) => {
                const on = value[r.id] === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set(r.id, c)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                    style={{
                      border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`,
                      background: on ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "var(--surface)",
                      color: on ? "var(--accent)" : "var(--fg-2)",
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="py-2 pr-3 text-left font-medium text-fg-3" />
              {columns.map((c) => (
                <th key={c} className="px-1 py-2 text-center text-[11px] font-medium leading-tight text-fg-3">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                <th scope="row" className="py-2 pr-3 text-left font-medium text-fg">
                  {r.label}
                </th>
                {columns.map((c) => {
                  const on = value[r.id] === c;
                  return (
                    <td key={c} className="px-1 py-2 text-center">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={`${r.label}: ${c}`}
                        onClick={() => set(r.id, c)}
                        className="mx-auto grid h-5 w-5 place-items-center rounded-full transition-colors"
                        style={{
                          border: `1.5px solid ${on ? "var(--accent)" : "var(--line)"}`,
                          background: on ? "var(--accent)" : "transparent",
                          color: "var(--accent-fg)",
                        }}
                      >
                        {on && <Check size={11} strokeWidth={3} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
