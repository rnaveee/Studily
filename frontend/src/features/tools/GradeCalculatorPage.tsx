import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RotateCcw, Trash2, UserPlus } from "lucide-react";
import BackButton from "../../components/BackButton";
import { useHydrated } from "../../components/ClientOnly";
import { useAuth } from "../../lib/auth";
import { formatPercent, gradeColor, neededOnRemaining, remainingWeight } from "../../lib/grades";
import {
  EXAMPLE,
  STORAGE_KEY,
  blankState,
  maxId,
  nextItemName,
  neededOnFinal,
  parseSaved,
  serialize,
  singular,
  summarize,
  toNumber,
  type CalcState,
  type FinalExam,
  type Item,
  type OtherItem,
  type Section,
  type SectionResult,
  type Summary,
  type Unmarked,
} from "./gradeCalc";

const iconButton =
  "flex h-[34px] w-8 shrink-0 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg";
const fieldLabel = "mb-1 block text-[11px] text-fg-3";

function plain(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function pct(n: number): string {
  return formatPercent(n, 1);
}

function addLabel(name: string): string {
  const s = singular(name);
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function listUnmarked(items: Unmarked[]): string {
  const shown = items.slice(0, 3).map((u) => `${u.name} ${plain(u.weight)}%`);
  const more = items.length - shown.length;
  return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ");
}

export default function GradeCalculatorPage() {
  const { user } = useAuth();
  const hydrated = useHydrated();
  const [state, setState] = useState<CalcState>(EXAMPLE);
  const [loaded, setLoaded] = useState(false);
  const [focusId, setFocusId] = useState<number | null>(null);
  const idRef = useRef(100);
  const nextId = () => idRef.current++;

  useEffect(() => {
    let saved: CalcState | null = null;
    try {
      saved = parseSaved(localStorage.getItem(STORAGE_KEY));
    } catch {
      saved = null;
    }
    if (saved) {
      setState(saved);
      idRef.current = Math.max(100, maxId(saved) + 1);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, serialize(state));
    } catch {
      return;
    }
  }, [state, loaded]);

  const summary = useMemo(() => summarize(state), [state]);

  const updateSections = (fn: (sections: Section[]) => Section[]) =>
    setState((s) => ({ ...s, sections: fn(s.sections) }));

  const setSection = (id: number, patch: Partial<Section>) =>
    updateSections((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const setItem = (sectionId: number, itemId: number, patch: Partial<Item>) =>
    updateSections((list) =>
      list.map((x) =>
        x.id === sectionId
          ? { ...x, items: x.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : x,
      ),
    );

  const addItem = (sectionId: number) => {
    const id = nextId();
    updateSections((list) =>
      list.map((x) =>
        x.id === sectionId ? { ...x, items: [...x.items, { id, name: nextItemName(x), mark: "" }] } : x,
      ),
    );
    setFocusId(id);
  };

  const removeItem = (sectionId: number, itemId: number) =>
    updateSections((list) =>
      list.map((x) => (x.id === sectionId ? { ...x, items: x.items.filter((i) => i.id !== itemId) } : x)),
    );

  const addSection = () => {
    const id = nextId();
    updateSections((list) => [...list, { id, name: "", weight: "", items: [] }]);
    setFocusId(id);
  };

  const removeSection = (id: number) => updateSections((list) => list.filter((x) => x.id !== id));

  const setOther = (id: number, patch: Partial<OtherItem>) =>
    setState((s) => ({ ...s, other: s.other.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

  const addOther = () => {
    const id = nextId();
    setState((s) => ({ ...s, other: [...s.other, { id, name: "", weight: "", mark: "" }] }));
    setFocusId(id);
  };

  const removeOther = (id: number) => setState((s) => ({ ...s, other: s.other.filter((o) => o.id !== id) }));

  const setFinal = (patch: Partial<FinalExam>) =>
    setState((s) => (s.final ? { ...s, final: { ...s.final, ...patch } } : s));

  const reset = () => setState(EXAMPLE);

  const clear = () => setState(blankState(nextId, state.target));

  const total = summary.totalWeight;
  const weightsOk = Math.abs(total - 100) < 0.01;

  return (
    <div className="space-y-5 stagger-children">
      <div className="flex items-center gap-3">
        <BackButton fallback={user ? "/learn" : "/"} />
        <div>
          <h1 className="text-xl font-semibold text-fg">Grade Calculator</h1>
          <p className="mt-1 text-[13px] text-fg-3">
            Add your course's sections and marks to see your grade and what you need on the final.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {state.sections.map((section, i) => (
            <SectionCard
              key={section.id}
              section={section}
              result={summary.sections[i]}
              focusId={focusId}
              onChange={(patch) => setSection(section.id, patch)}
              onItemChange={(itemId, patch) => setItem(section.id, itemId, patch)}
              onAddItem={() => addItem(section.id)}
              onRemoveItem={(itemId) => removeItem(section.id, itemId)}
              onRemove={() => removeSection(section.id)}
            />
          ))}

          {state.final && (
            <FinalCard
              final={state.final}
              onChange={setFinal}
              onRemove={() => setState((s) => ({ ...s, final: null }))}
            />
          )}

          <OtherCard
            items={state.other}
            focusId={focusId}
            onChange={setOther}
            onAdd={addOther}
            onRemove={removeOther}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={addSection}>
              <Plus size={14} />
              Add section
            </button>
            {!state.final && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setState((s) => ({ ...s, final: { weight: "", mark: "" } }))}
              >
                <Plus size={14} />
                Add final exam
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={reset}>
              <RotateCcw size={13} />
              Reset to example
            </button>
            <button type="button" className="btn btn-ghost" onClick={clear}>
              Clear
            </button>
            <span
              className="ml-auto text-[12px] font-medium tabular-nums"
              style={{ color: weightsOk ? "var(--green)" : "var(--orange)" }}
            >
              Total weight {plain(total)}%
            </span>
          </div>
          <p className="px-1 text-[12px] text-fg-3">
            Enter marks as 18/20, 85% or 85. Leave a mark blank for anything not marked yet.
          </p>
        </div>

        <div className="min-w-0 lg:sticky lg:top-4">
          <Results summary={summary} target={state.target} onTarget={(target) => setState((s) => ({ ...s, target }))} />
        </div>
      </div>

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

      <Guide title="How do I calculate my grade with weighted sections?">
        <p>
          Most syllabi split your grade into sections, each worth a percentage: for example
          assignments 10%, midterms 30%, tutorials 10% and a final exam 50%. Those percentages are
          the weights, and they normally add up to 100.
        </p>
        <p>
          Inside a section, each item usually counts equally, so the section's mark is the average
          of its items. Assignments marked 18/20, 15/20 and 12/20 are 90%, 75% and 60%, which
          average to 75%.
        </p>
        <p>
          Your current grade is the weighted average of everything marked so far. With assignments
          at 75%, midterms at 65% and tutorials at 95%, that is (75 x 10 + 65 x 30 + 95 x 10) / 50 =
          73%.
        </p>
      </Guide>

      <Guide title="What do I need on my final exam?">
        <p>
          Treat your current grade as what you keep on everything except the final. With 73% so far
          and a final worth 50%, the other half of the course earns 73 x 0.5 = 36.5 points.
        </p>
        <p>
          To finish with 80%, the final has to make up the rest: (80 - 36.5) / 50 x 100 = 87%. In
          words: (target - current grade x share of the course that isn't the final) / weight of the
          final.
        </p>
        <p>
          If other work besides the final isn't marked yet, the calculator assumes it ends up at
          your current average and says so. An answer above 100% means the target can't be reached,
          and zero or below means it is already locked in.
        </p>
      </Guide>

      <Guide title="What if my marks are out of 20, or my weights don't add up to 100%?">
        <p>
          Enter marks the way you get them back: 18/20, 9/10, 94/120, 85% or just 85. Each one is
          turned into a percentage first, so a section can mix formats.
        </p>
        <p>
          If your weights add up to less than 100%, the missing part is treated as work that isn't
          marked yet. If they add up to more, check your syllabus for bonus marks. Use Other for
          one-off items with their own weight, like a project or participation.
        </p>
        <p>
          Treat the result as a guide: dropped lowest marks, rounding and bonus work can all change
          the final numbers.
        </p>
      </Guide>
    </div>
  );
}

function Guide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="mb-3 text-[15px] font-semibold text-fg">{title}</h2>
      <div className="space-y-3 text-[13px] leading-relaxed text-fg-2">{children}</div>
    </section>
  );
}

function SectionCard({
  section,
  result,
  focusId,
  onChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onRemove,
}: {
  section: Section;
  result: SectionResult;
  focusId: number | null;
  onChange: (patch: Partial<Section>) => void;
  onItemChange: (itemId: number, patch: Partial<Item>) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: number) => void;
  onRemove: () => void;
}) {
  const title = section.name.trim() || "Untitled section";
  const itemWord = singular(section.name);

  return (
    <section className="card p-4 sm:p-5" aria-label={`${title} section`}>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className={fieldLabel} htmlFor={`gc-s-${section.id}`}>
            Section
          </label>
          <input
            id={`gc-s-${section.id}`}
            className="input font-semibold"
            type="text"
            value={section.name}
            placeholder="e.g. Assignments"
            maxLength={80}
            autoFocus={focusId === section.id}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="w-20 shrink-0">
          <label className={fieldLabel} htmlFor={`gc-sw-${section.id}`}>
            Weight %
          </label>
          <input
            id={`gc-sw-${section.id}`}
            className="input tabular-nums"
            type="text"
            inputMode="decimal"
            value={section.weight}
            placeholder="10"
            onChange={(e) => onChange({ weight: e.target.value })}
          />
        </div>
        <button type="button" className={iconButton} onClick={onRemove} aria-label={`Remove ${title} section`}>
          <Trash2 size={15} />
        </button>
      </div>

      {section.items.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-line pt-3">
          {section.items.map((item, i) => {
            const label = item.name.trim() || `${itemWord} ${i + 1}`;
            return (
              <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_104px_32px] items-center gap-2">
                <input
                  className="input"
                  type="text"
                  aria-label={`${title}: item ${i + 1} name`}
                  value={item.name}
                  placeholder={`${itemWord} ${i + 1}`}
                  maxLength={80}
                  onChange={(e) => onItemChange(item.id, { name: e.target.value })}
                />
                <input
                  className="input tabular-nums"
                  type="text"
                  aria-label={`Mark for ${label}`}
                  value={item.mark}
                  placeholder="16/20"
                  maxLength={20}
                  autoFocus={focusId === item.id}
                  onChange={(e) => onItemChange(item.id, { mark: e.target.value })}
                />
                <button
                  type="button"
                  className={iconButton}
                  onClick={() => onRemoveItem(item.id)}
                  aria-label={`Remove ${label}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn btn-ghost" onClick={onAddItem}>
          <Plus size={14} />
          Add {addLabel(section.name)}
        </button>
        <span className="text-[12px] tabular-nums text-fg-3">
          {result.average != null ? (
            <>
              Average{" "}
              <span className="font-semibold" style={{ color: gradeColor(result.average) }}>
                {pct(result.average)}
              </span>{" "}
              · {result.marked} of {result.count} marked
            </>
          ) : result.count > 0 ? (
            "No marks yet"
          ) : (
            "No items yet"
          )}
        </span>
      </div>
    </section>
  );
}

function FinalCard({
  final,
  onChange,
  onRemove,
}: {
  final: FinalExam;
  onChange: (patch: Partial<FinalExam>) => void;
  onRemove: () => void;
}) {
  return (
    <section className="card p-4 sm:p-5" aria-label="Final exam">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 basis-full pb-1 sm:flex-1 sm:basis-auto">
          <h2 className="text-[14px] font-semibold text-fg">Final exam</h2>
          <p className="mt-0.5 text-[12px] text-fg-3">Leave the mark blank until you've written it.</p>
        </div>
        <div className="w-20 shrink-0">
          <label className={fieldLabel} htmlFor="gc-final-weight">
            Weight %
          </label>
          <input
            id="gc-final-weight"
            className="input tabular-nums"
            type="text"
            inputMode="decimal"
            value={final.weight}
            placeholder="50"
            onChange={(e) => onChange({ weight: e.target.value })}
          />
        </div>
        <div className="w-[104px] shrink-0">
          <label className={fieldLabel} htmlFor="gc-final-mark">
            Mark
          </label>
          <input
            id="gc-final-mark"
            className="input tabular-nums"
            type="text"
            value={final.mark}
            placeholder="94/120"
            maxLength={20}
            onChange={(e) => onChange({ mark: e.target.value })}
          />
        </div>
        <button type="button" className={iconButton} onClick={onRemove} aria-label="Remove final exam">
          <Trash2 size={15} />
        </button>
      </div>
    </section>
  );
}

function OtherCard({
  items,
  focusId,
  onChange,
  onAdd,
  onRemove,
}: {
  items: OtherItem[];
  focusId: number | null;
  onChange: (id: number, patch: Partial<OtherItem>) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
}) {
  return (
    <section className="card p-4 sm:p-5" aria-label="Other">
      <h2 className="text-[14px] font-semibold text-fg">Other</h2>
      <p className="mt-0.5 text-[12px] text-fg-3">
        One-off items with their own weight, like a project or participation.
      </p>

      {items.length > 0 && (
        <ul className="mt-3 space-y-3 border-t border-line pt-3 sm:space-y-2">
          {items.map((item, i) => {
            const label = item.name.trim() || `other item ${i + 1}`;
            return (
              <li
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_80px_104px_32px]"
              >
                <input
                  className="input col-span-3 sm:col-span-1"
                  type="text"
                  aria-label={`Other item ${i + 1} name`}
                  value={item.name}
                  placeholder="e.g. Project"
                  maxLength={80}
                  autoFocus={focusId === item.id}
                  onChange={(e) => onChange(item.id, { name: e.target.value })}
                />
                <input
                  className="input tabular-nums"
                  type="text"
                  inputMode="decimal"
                  aria-label={`Weight % for ${label}`}
                  value={item.weight}
                  placeholder="Weight %"
                  onChange={(e) => onChange(item.id, { weight: e.target.value })}
                />
                <input
                  className="input tabular-nums"
                  type="text"
                  aria-label={`Mark for ${label}`}
                  value={item.mark}
                  placeholder="Mark"
                  maxLength={20}
                  onChange={(e) => onChange(item.id, { mark: e.target.value })}
                />
                <button type="button" className={iconButton} onClick={() => onRemove(item.id)} aria-label={`Remove ${label}`}>
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3">
        <button type="button" className="btn btn-ghost" onClick={onAdd}>
          <Plus size={14} />
          Add item
        </button>
      </div>
    </section>
  );
}

function Results({
  summary,
  target,
  onTarget,
}: {
  summary: Summary;
  target: string;
  onTarget: (value: string) => void;
}) {
  const targetValue = toNumber(target);
  const validTarget = targetValue != null && targetValue >= 0;
  const remaining = remainingWeight(summary);
  const current = summary.percent;
  const done = current != null && remaining <= 0.01;
  const total = summary.totalWeight;
  const finalNeeded = validTarget ? neededOnFinal(summary, targetValue) : null;
  const restNeeded = validTarget ? neededOnRemaining(summary, targetValue) : null;
  const finalOpen = summary.finalWeight != null && summary.finalPercent == null;

  let message: string;
  let tone = "text-fg";
  let note: string | null = null;

  if (current == null) {
    message =
      summary.markCount > 0
        ? "Give your sections a weight to see your grade."
        : "Nothing is marked yet. Enter a mark to see your grade.";
    tone = "text-fg-2";
  } else if (done) {
    message = "Everything is marked, so this is your final grade.";
  } else if (!validTarget) {
    message = "Enter a target grade to see what you need.";
    tone = "text-fg-2";
  } else if (finalNeeded != null) {
    if (finalNeeded <= 0) {
      message = `You've already locked in ${pct(targetValue)}. Even 0% on your final exam keeps you there.`;
      tone = "text-green";
    } else if (finalNeeded > 100) {
      message = `Not reachable even with 100% on your final exam. Finishing with ${pct(targetValue)} would need ${pct(finalNeeded)} on it.`;
      tone = "text-red";
    } else {
      message = `You need ${pct(finalNeeded)} on your final exam (worth ${plain(summary.finalWeight!)}%) to finish with ${pct(targetValue)}.`;
    }
    const assumed: Unmarked[] = [...summary.unmarked];
    if (total < 99.99) assumed.push({ name: "weight not in any section", weight: 100 - total });
    if (assumed.length > 0) {
      note = `This assumes your other unmarked work (${listUnmarked(assumed)}) ends up at your current average of ${pct(current)}.`;
    }
  } else if (finalOpen && (summary.finalWeight ?? 0) <= 0) {
    message = "Give your final exam a weight to see what you need on it.";
    tone = "text-fg-2";
  } else if (restNeeded == null) {
    message = "Give your marked work a weight to see what you need on the rest.";
    tone = "text-fg-2";
  } else if (restNeeded <= 0) {
    message = `You've already locked in ${pct(targetValue)}. Even 0% on the remaining ${plain(remaining)}% keeps you there.`;
    tone = "text-green";
  } else if (restNeeded > 100) {
    message = `Not reachable even with 100%. Finishing with ${pct(targetValue)} would need ${pct(restNeeded)} on the remaining ${plain(remaining)}%.`;
    tone = "text-red";
  } else {
    message = `You need ${pct(restNeeded)} on the remaining ${plain(remaining)}% to finish with ${pct(targetValue)}.`;
  }

  const weightWarning =
    total > 100.01
      ? `Your weights add up to ${plain(total)}%, more than 100%. Double-check them against your syllabus.`
      : total > 0 && total < 99.99
        ? `Your weights add up to ${plain(total)}%. The missing ${plain(100 - total)}% is treated as work that isn't marked yet.`
        : null;

  return (
    <section className="card p-5" aria-label="Results">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[12px] text-fg-3">{done ? "Final grade" : "Current grade"}</div>
          <div
            className="text-4xl font-semibold tabular-nums"
            style={{ color: current != null ? gradeColor(current) : "var(--fg-3)" }}
          >
            {current != null ? pct(current) : "--"}
          </div>
          <div className="mt-1 text-[12px] text-fg-3">{plain(summary.gradedWeight)}% of your grade is in</div>
        </div>
        <div className="w-28">
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
        {note && <p className="text-[12px] leading-relaxed text-fg-3">{note}</p>}
        {weightWarning && <p className="text-[12px] text-orange">{weightWarning}</p>}
      </div>

      <Breakdown summary={summary} />
    </section>
  );
}

function Breakdown({ summary }: { summary: Summary }) {
  const rows: { key: string; name: string; weight: number; value: number | null; detail: string }[] =
    summary.sections.map((s) => ({
      key: `s${s.id}`,
      name: s.name.trim() || "Untitled section",
      weight: s.weight,
      value: s.average,
      detail:
        s.count === 0
          ? "No items yet"
          : s.marked === s.count
            ? `${plain(s.earned)} of ${plain(s.weight)} points`
            : `${s.marked} of ${s.count} marked`,
    }));
  if (summary.other.count > 0) {
    rows.push({
      key: "other",
      name: "Other",
      weight: summary.other.weight,
      value: summary.other.average,
      detail: `${summary.other.marked} of ${summary.other.count} marked`,
    });
  }
  if (summary.finalWeight != null) {
    rows.push({
      key: "final",
      name: "Final exam",
      weight: summary.finalWeight,
      value: summary.finalPercent,
      detail:
        summary.finalPercent == null
          ? "Not written yet"
          : `${plain((summary.finalPercent * summary.finalWeight) / 100)} of ${plain(summary.finalWeight)} points`,
    });
  }
  if (rows.length === 0) return null;

  return (
    <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
      {rows.map((row) => (
        <li key={row.key} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] text-fg">
              {row.name} <span className="text-fg-3">· {plain(row.weight)}%</span>
            </div>
            <div className="text-[11px] text-fg-3">{row.detail}</div>
          </div>
          <div
            className="shrink-0 text-[13px] font-semibold tabular-nums"
            style={{ color: row.value != null ? gradeColor(row.value) : "var(--fg-3)" }}
          >
            {row.value != null ? pct(row.value) : "--"}
          </div>
        </li>
      ))}
    </ul>
  );
}
