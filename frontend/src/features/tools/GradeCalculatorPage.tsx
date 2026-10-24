import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RotateCcw, Trash2, UserPlus } from "lucide-react";
import BackButton from "../../components/BackButton";
import { useHydrated } from "../../components/ClientOnly";
import { useAuth } from "../../lib/auth";
import {
  formatPercent,
  gradeColor,
  itemPercent,
  neededOnRemaining,
  parseScoreInput,
  remainingWeight,
  type GradeProjection,
} from "../../lib/grades";

interface Row {
  id: number;
  name: string;
  weight: string;
  mark: string;
}

interface Saved {
  rows: Row[];
  target: string;
}

const STORAGE_KEY = "studily.gradeCalc";

const EXAMPLE_ROWS: Row[] = [
  { id: 1, name: "Assignments", weight: "20", mark: "85" },
  { id: 2, name: "Quizzes", weight: "10", mark: "9/10" },
  { id: 3, name: "Midterm", weight: "25", mark: "72" },
  { id: 4, name: "Final exam", weight: "45", mark: "" },
];

const EXAMPLE_TARGET = "80";

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.rows) || typeof data.target !== "string") return null;
    const rows: Row[] = [];
    for (const r of data.rows.slice(0, 50)) {
      if (
        !r ||
        typeof r.id !== "number" ||
        typeof r.name !== "string" ||
        typeof r.weight !== "string" ||
        typeof r.mark !== "string"
      ) {
        return null;
      }
      rows.push({
        id: r.id,
        name: r.name.slice(0, 80),
        weight: r.weight.slice(0, 12),
        mark: r.mark.slice(0, 20),
      });
    }
    if (rows.length === 0) return null;
    return { rows, target: data.target.slice(0, 12) };
  } catch {
    return null;
  }
}

function toNumber(raw: string): number | null {
  const text = raw.trim().replace(/%$/, "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function summarize(rows: Row[]): GradeProjection {
  let weightedSum = 0;
  let gradedWeight = 0;
  let totalWeight = 0;
  let points = 0;
  let maxPoints = 0;

  for (const row of rows) {
    const weight = Math.max(0, toNumber(row.weight) ?? 0);
    totalWeight += weight;
    const parsed = parseScoreInput(row.mark);
    if (parsed == null) continue;
    const percent = itemPercent(parsed);
    if (percent == null) continue;
    points += parsed.score;
    maxPoints += parsed.maxScore;
    if (weight > 0) {
      weightedSum += percent * weight;
      gradedWeight += weight;
    }
  }

  const percent =
    gradedWeight > 0 ? weightedSum / gradedWeight : maxPoints > 0 ? (points / maxPoints) * 100 : null;
  return { percent, gradedWeight, totalWeight };
}

function plain(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export default function GradeCalculatorPage() {
  const { user } = useAuth();
  const hydrated = useHydrated();
  const [rows, setRows] = useState<Row[]>(EXAMPLE_ROWS);
  const [target, setTarget] = useState(EXAMPLE_TARGET);
  const [loaded, setLoaded] = useState(false);
  const nextId = useRef(100);

  useEffect(() => {
    const saved = readSaved();
    if (saved) {
      setRows(saved.rows);
      setTarget(saved.target);
      nextId.current = Math.max(100, ...saved.rows.map((r) => r.id + 1));
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, target }));
    } catch {
      return;
    }
  }, [rows, target, loaded]);

  const summary = useMemo(() => summarize(rows), [rows]);

  const update = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) => [...prev, { id: nextId.current++, name: "", weight: "", mark: "" }]);

  const removeRow = (id: number) => setRows((prev) => prev.filter((r) => r.id !== id));

  const resetExample = () => {
    setRows(EXAMPLE_ROWS);
    setTarget(EXAMPLE_TARGET);
  };

  const clearAll = () => {
    setRows([{ id: nextId.current++, name: "", weight: "", mark: "" }]);
    setTarget(EXAMPLE_TARGET);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 stagger-children">
      <div className="flex items-center gap-3">
        <BackButton fallback={user ? "/learn" : "/"} />
        <div>
          <h1 className="text-xl font-semibold text-fg">Grade Calculator</h1>
          <p className="mt-1 text-[13px] text-fg-3">
            Work out your weighted grade and what you need on your final.
          </p>
        </div>
      </div>

      <section className="card p-4 sm:p-6" aria-label="Your grades">
        <div className="hidden grid-cols-[minmax(0,1fr)_84px_104px_32px] gap-2 px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-fg-3 sm:grid">
          <span>Item</span>
          <span>Weight %</span>
          <span>Mark</span>
          <span />
        </div>
        <ul className="space-y-3 sm:space-y-2">
          {rows.map((row, i) => (
            <li
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_84px_104px_32px]"
            >
              <div className="col-span-3 sm:col-span-1">
                <label className="mb-1 block text-[11px] text-fg-3 sm:sr-only" htmlFor={`gc-name-${row.id}`}>
                  Item name
                </label>
                <input
                  id={`gc-name-${row.id}`}
                  className="input"
                  type="text"
                  value={row.name}
                  placeholder={`Item ${i + 1}`}
                  maxLength={80}
                  onChange={(e) => update(row.id, { name: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-fg-3 sm:sr-only" htmlFor={`gc-weight-${row.id}`}>
                  Weight %
                </label>
                <input
                  id={`gc-weight-${row.id}`}
                  className="input tabular-nums"
                  type="text"
                  inputMode="decimal"
                  value={row.weight}
                  placeholder="20"
                  onChange={(e) => update(row.id, { weight: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-fg-3 sm:sr-only" htmlFor={`gc-mark-${row.id}`}>
                  Mark (blank if not graded)
                </label>
                <input
                  id={`gc-mark-${row.id}`}
                  className="input tabular-nums"
                  type="text"
                  value={row.mark}
                  placeholder="18/20"
                  onChange={(e) => update(row.id, { mark: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label={`Remove ${row.name.trim() || `item ${i + 1}`}`}
                className="flex h-[34px] w-8 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 px-1 text-[12px] text-fg-3">
          Enter a mark as 85, 85% or 18/20. Leave it blank for anything not graded yet.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={addRow}>
            <Plus size={14} />
            Add row
          </button>
          <button type="button" className="btn btn-ghost" onClick={resetExample}>
            <RotateCcw size={13} />
            Reset to example
          </button>
          <button type="button" className="btn btn-ghost" onClick={clearAll}>
            Clear
          </button>
        </div>
      </section>

      <Results summary={summary} target={target} onTarget={setTarget} />

      {hydrated && !user && (
        <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-relaxed text-fg-2">
            Studily does this automatically for every course. Add your assignments once and your
            grade, and what you need on the rest, stay up to date.
          </p>
          <Link to="/signup" className="btn btn-primary shrink-0 self-start sm:self-auto">
            <UserPlus size={14} />
            Create a free account
          </Link>
        </section>
      )}

      <section className="card p-6">
        <h2 className="mb-3 text-[15px] font-semibold text-fg">How weighted grades work</h2>
        <div className="space-y-3 text-[13px] leading-relaxed text-fg-2">
          <p>
            Most courses do not count every mark equally. Each part of the course, such as
            assignments, quizzes, a midterm and a final exam, is worth a percentage of your final
            grade. That percentage is its weight, and the weights normally add up to 100.
          </p>
          <p>
            To get a weighted grade, turn each mark into a percentage, multiply it by its weight,
            add those results together, and divide by the total weight you have been graded on. In
            words: grade = sum of (mark % x weight) / sum of weights.
          </p>
          <p>
            For example, an 80% on assignments worth 40% and a 70% on a midterm worth 60% gives
            (80 x 40 + 70 x 60) / 100 = 74%. A mark given as 18/20 is 90%, and a 9/10 quiz is
            also 90%, so you can enter marks however your instructor reports them.
          </p>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-3 text-[15px] font-semibold text-fg">What do I need on my final?</h2>
        <div className="space-y-3 text-[13px] leading-relaxed text-fg-2">
          <p>
            Start with what is already counted. Your graded work has earned a certain number of
            points toward the final grade: each mark times its weight. The ungraded work, such as
            the final exam, makes up the remaining weight, which is 100 minus the weight already
            graded.
          </p>
          <p>
            The mark you need on the remaining work is (target - points earned) / remaining weight
            x 100. If you have earned 44 points and want 80% overall, with a final worth 45%, you
            need (80 - 44) / 45 x 100 = 80%.
          </p>
          <p>
            If the answer is above 100%, the target cannot be reached with the work that is left,
            and if it is zero or below, your target is already secured. Treat the result as a
            guide: check your syllabus for rounding, dropped marks or bonus work that can change
            the numbers.
          </p>
        </div>
      </section>
    </div>
  );
}

function Results({
  summary,
  target,
  onTarget,
}: {
  summary: GradeProjection;
  target: string;
  onTarget: (v: string) => void;
}) {
  const targetValue = toNumber(target);
  const remaining = remainingWeight(summary);
  const hasGrade = summary.percent != null;
  const done = hasGrade && summary.gradedWeight > 0 && remaining <= 0.01;
  const needed = targetValue != null ? neededOnRemaining(summary, targetValue) : null;
  const total = summary.totalWeight;
  const weightWarning =
    total > 100.01
      ? `Your weights add up to ${plain(total)}%, which is more than 100%. Double-check them against your syllabus.`
      : total > 0 && total < 99.99
        ? `Your weights add up to ${plain(total)}%, which is less than 100%. The rest is counted as ungraded.`
        : null;

  let message: string;
  let tone = "text-fg-2";
  if (!hasGrade) {
    message = "Nothing is graded yet. Enter a mark and its weight to see your grade.";
  } else if (done) {
    message = "Everything is graded, so this is your final grade.";
  } else if (targetValue == null || targetValue < 0) {
    message = "Enter a target grade to see what you need on the rest.";
  } else if (needed == null) {
    message = "Add a weight to your graded items to see what you need on the rest.";
  } else if (needed <= 0) {
    message = `You have already locked in ${formatPercent(targetValue, 1)}. Even a 0% on the remaining ${plain(remaining)}% keeps you there.`;
    tone = "text-green";
  } else if (needed > 100) {
    message = `Not reachable even with 100%. Finishing with ${formatPercent(targetValue, 1)} would need ${formatPercent(needed, 1)} on the remaining ${plain(remaining)}%.`;
    tone = "text-red";
  } else {
    message = `You need ${formatPercent(needed, 1)} on the remaining ${plain(remaining)}% to finish with ${formatPercent(targetValue, 1)}.`;
  }

  return (
    <section className="card p-5 sm:p-6" aria-label="Results">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[12px] text-fg-3">{done ? "Final grade" : "Current grade"}</div>
          <div
            className="text-4xl font-semibold tabular-nums"
            style={{ color: hasGrade ? gradeColor(summary.percent!) : "var(--fg-3)" }}
          >
            {hasGrade ? formatPercent(summary.percent!, 1) : "--"}
          </div>
          <div className="mt-1 text-[12px] text-fg-3">
            {plain(summary.gradedWeight)}% of your grade is in
          </div>
        </div>
        <div className="w-32">
          <label className="mb-1 block text-[12px] text-fg-3" htmlFor="gc-target">
            Target grade %
          </label>
          <input
            id="gc-target"
            className="input tabular-nums"
            type="text"
            inputMode="decimal"
            value={target}
            placeholder="80"
            onChange={(e) => onTarget(e.target.value)}
          />
        </div>
      </div>

      <div aria-live="polite" className="mt-4 space-y-2 border-t border-line pt-4">
        <p className={`text-[14px] font-medium leading-snug ${tone}`}>{message}</p>
        {weightWarning && <p className="text-[12px] text-orange">{weightWarning}</p>}
      </div>
    </section>
  );
}
