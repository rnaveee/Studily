import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, Trash2, X } from "lucide-react";
import Modal from "./Modal";
import { api } from "../lib/api";
import { useConfirm } from "../lib/confirm";
import { toast } from "../lib/toast";
import {
  GPA_SCALE_LABELS,
  PRESET_BANDS,
  formatPoints,
  gradeFor,
  normalizeBands,
  rangesFor,
  validateBands,
  type BandIssue,
} from "../lib/gpa";
import type { GpaScalePrefs, GradeBand, PresetScaleName } from "../types";

const STARTERS: PresetScaleName[] = ["FOUR_POINT", "FOUR_THREE_THREE", "NINE_POINT"];
const MIN_ROWS = 2;
const MAX_ROWS = 20;
const MAX_NAME = 40;
const SHOW_ISSUES_AFTER_MS = 600;
const COLUMNS =
  "grid grid-cols-[3.5rem_4rem_minmax(0,1fr)_4rem_2.5rem] items-center gap-1.5 sm:grid-cols-[4.5rem_5rem_minmax(0,1fr)_5rem_2.5rem] sm:gap-2";
const HEAD = "text-[11px] font-medium uppercase tracking-[0.06em] text-fg-3";
const INVALID: CSSProperties = { borderColor: "var(--red)" };
const PICKED: CSSProperties = {
  borderColor: "var(--accent)",
  color: "var(--accent)",
  background: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
};
const MATCHED: CSSProperties = { background: "color-mix(in srgb, var(--accent) 9%, transparent)" };

type Field = "letter" | "min" | "points" | "remove";

interface Row {
  id: number;
  letter: string;
  min: string;
  points: string;
}

interface Issue {
  rowId: number | null;
  field: BandIssue["field"];
  message: string;
}

let rowSeq = 0;

function parseNumber(text: string): number {
  const t = text.trim().replace(",", ".");
  return t === "" ? Number.NaN : Number(t);
}

function toBand(row: Row): GradeBand {
  return { letter: row.letter, minPercent: parseNumber(row.min), points: parseNumber(row.points) };
}

function rowsFrom(bands: GradeBand[]): Row[] {
  const whole = bands.every((b) => Number.isInteger(b.points));
  return bands.map((b) => ({
    id: ++rowSeq,
    letter: b.letter,
    min: String(b.minPercent),
    points: whole ? String(b.points) : b.points.toFixed(2),
  }));
}

function sortRows(rows: Row[]): Row[] {
  const mins = rows.map((r) => parseNumber(r.min));
  if (mins.some((m) => !Number.isFinite(m))) return rows;
  const sorted = rows
    .map((row, i) => ({ row, min: mins[i], i }))
    .sort((a, b) => b.min - a.min || a.i - b.i)
    .map((x) => x.row);
  return sorted.every((r, i) => r === rows[i]) ? rows : sorted;
}

function matches(rows: Row[], bands: GradeBand[]): boolean {
  return (
    rows.length === bands.length &&
    rows.every((r, i) => {
      const b = toBand(r);
      return b.letter.trim() === bands[i].letter && b.minPercent === bands[i].minPercent && b.points === bands[i].points;
    })
  );
}

function rowsSignature(rows: Row[]): string {
  return JSON.stringify(rows.map((r) => [r.letter.trim(), r.min.trim(), parseNumber(r.points)]));
}

function starterFor(prefs: GpaScalePrefs): PresetScaleName {
  const pick = [prefs.scale, prefs.defaultScale].find((s): s is PresetScaleName =>
    STARTERS.includes(s as PresetScaleName),
  );
  return pick ?? "FOUR_POINT";
}

export default function GradingScaleEditor({ prefs, onClose }: { prefs: GpaScalePrefs; onClose: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const uid = useId();
  const closeRef = useRef<(() => void) | null>(null);
  const [start] = useState(() => {
    const rows = rowsFrom(prefs.custom?.bands ?? PRESET_BANDS[starterFor(prefs)]);
    return { custom: prefs.custom, rows, signature: rowsSignature(rows) };
  });
  const custom = start.custom;
  const [name, setName] = useState(custom?.name ?? "");
  const [rows, setRows] = useState<Row[]>(start.rows);
  const [fresh, setFresh] = useState<ReadonlySet<number>>(() => new Set());
  const [tryText, setTryText] = useState("70");
  const pressing = useRef(false);
  const settleOnRelease = useRef(false);
  const focusNext = useRef<string | null>(null);

  const bands = rows.map(toBand);
  const issues: Issue[] = validateBands(bands).map((i) => ({
    rowId: i.row == null ? null : rows[i.row].id,
    field: i.field,
    message: i.message,
  }));
  const issueKey = JSON.stringify(issues);
  const [settledKey, setSettledKey] = useState(issueKey);
  useEffect(() => {
    const t = window.setTimeout(() => setSettledKey(issueKey), SHOW_ISSUES_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [issueKey]);
  const settled: Issue[] = JSON.parse(settledKey);
  const shown = issues.filter(
    (i) =>
      (i.rowId == null || !fresh.has(i.rowId)) &&
      settled.some((s) => s.rowId === i.rowId && s.field === i.field && s.message === i.message),
  );
  const scaleIssues = shown.filter((i) => i.rowId == null);
  const ranges = rangesFor(bands);

  const tryValue = parseNumber(tryText);
  const match = Number.isFinite(tryValue) ? gradeFor(bands, tryValue) : null;
  const matchIndex = match ? bands.indexOf(match) : -1;
  const matchLetter = match?.letter.trim() ?? "";

  const dirty = name.trim() !== (custom?.name ?? "") || rowsSignature(rows) !== start.signature;

  useEffect(() => {
    const down = () => {
      pressing.current = true;
    };
    const up = () => {
      pressing.current = false;
      if (!settleOnRelease.current) return;
      settleOnRelease.current = false;
      window.setTimeout(() => setRows(sortRows), 0);
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, []);

  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  function applyPrefs(next: GpaScalePrefs) {
    qc.setQueryData(["settings", "gpa-scale"], next);
    qc.invalidateQueries({ queryKey: ["semesters", "stats"] });
  }

  function finish() {
    (closeRef.current ?? onClose)();
  }

  const save = useMutation({
    mutationFn: (req: { name: string | null; bands: GradeBand[] }) =>
      api.put<GpaScalePrefs>("/settings/gpa-scale/custom", req),
    onSuccess: (next) => {
      applyPrefs(next);
      toast.success("Custom scale saved");
      finish();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save your scale"),
  });

  const remove = useMutation({
    mutationFn: () => api.del<GpaScalePrefs>("/settings/gpa-scale/custom"),
    onSuccess: (next) => {
      applyPrefs(next);
      toast.success("Custom scale deleted");
      finish();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete your scale"),
  });

  const busy = save.isPending || remove.isPending;

  function fieldId(rowId: number, field: Field) {
    return `${uid}-${rowId}-${field}`;
  }

  function update(rowId: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function leaveRow(rowId: number) {
    setFresh((f) => {
      if (!f.has(rowId)) return f;
      const next = new Set(f);
      next.delete(rowId);
      return next;
    });
    if (pressing.current) settleOnRelease.current = true;
    else setRows(sortRows);
  }

  function addRow() {
    if (rows.length >= MAX_ROWS) return;
    const id = ++rowSeq;
    setRows((rs) => [...rs, { id, letter: "", min: "", points: "" }]);
    setFresh((f) => new Set(f).add(id));
    focusNext.current = fieldId(id, "letter");
  }

  function removeRow(rowId: number) {
    if (rows.length <= MIN_ROWS) return;
    const at = rows.findIndex((r) => r.id === rowId);
    const neighbour = rows[at + 1] ?? rows[at - 1];
    setRows((rs) => rs.filter((r) => r.id !== rowId));
    if (neighbour) focusNext.current = fieldId(neighbour.id, rows.length - 1 > MIN_ROWS ? "remove" : "letter");
  }

  async function pickStarter(scale: PresetScaleName) {
    const preset = PRESET_BANDS[scale];
    if (matches(rows, preset)) return;
    const edited =
      rowsSignature(rows) !== start.signature && !STARTERS.some((s) => matches(rows, PRESET_BANDS[s]));
    if (
      edited &&
      !(await confirm({
        title: `Start over from the ${GPA_SCALE_LABELS[scale]}?`,
        message: "This replaces the rows you've changed.",
        confirmLabel: "Replace rows",
      }))
    ) {
      return;
    }
    setRows(rowsFrom(preset));
    setFresh(new Set());
  }

  async function confirmDiscard(): Promise<boolean> {
    if (!dirty || busy || save.isSuccess || remove.isSuccess) return true;
    return confirm({
      title: "Discard your changes?",
      message: "Your scale won't be saved.",
      confirmLabel: "Discard",
      danger: true,
    });
  }

  async function cancel() {
    if (await confirmDiscard()) finish();
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete your custom scale?",
      message:
        prefs.scale === "CUSTOM"
          ? `Your GPA will go back to matching your school (${GPA_SCALE_LABELS[prefs.defaultScale]}).`
          : "You can make a new one any time.",
      confirmLabel: "Delete scale",
      danger: true,
    });
    if (ok) remove.mutate();
  }

  const pointsShown = match && Number.isFinite(match.points) ? formatPoints(match.points, "CUSTOM") : "—";

  return (
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      beforeClose={confirmDiscard}
      variant="sheet"
      size="md"
      title={custom ? "Edit custom scale" : "Create a custom scale"}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {custom ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="btn btn-ghost min-h-10 text-red md:min-h-0"
            >
              <Trash2 size={13} />
              Delete scale
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={cancel} className="btn btn-ghost min-h-10 md:min-h-0">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save.mutate({ name: name.trim() || null, bands: normalizeBands(bands) })}
              disabled={issues.length > 0 || busy}
              className="btn btn-primary min-h-10 md:min-h-0"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      }
    >
      <p className="-mt-1 text-[13px] text-fg-2">
        Set the lowest % for each letter and what it's worth. Saving switches your GPA to this scale.
      </p>

      <div>
        <label htmlFor={`${uid}-name`} className="field-label">
          Name (optional)
        </label>
        <input
          id={`${uid}-name`}
          className="input"
          value={name}
          maxLength={MAX_NAME}
          placeholder="e.g. NDU Lebanon"
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div role="group" aria-labelledby={`${uid}-start`}>
        <div id={`${uid}-start`} className="field-label">
          Start from
        </div>
        <div className="grid grid-cols-3 gap-2">
          {STARTERS.map((s) => {
            const picked = matches(rows, PRESET_BANDS[s]);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={picked}
                onClick={() => pickStarter(s)}
                className="btn btn-ghost min-h-10 md:min-h-0"
                style={{ paddingLeft: 6, paddingRight: 6, ...(picked ? PICKED : undefined) }}
              >
                {GPA_SCALE_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="-mx-2">
          <div aria-hidden className={`${COLUMNS} px-2 pb-1`}>
            <span className={HEAD}>Letter</span>
            <span className={HEAD}>Min %</span>
            <span className={HEAD}>Range</span>
            <span className={HEAD}>Points</span>
            <span />
          </div>
          <ul>
            {rows.map((row, i) => {
              const rowIssues = shown.filter((s) => s.rowId === row.id);
              const bad = (field: BandIssue["field"]) => rowIssues.some((s) => s.field === field);
              const describe = (field: BandIssue["field"]) =>
                rowIssues
                  .map((s, n) => (s.field === field ? `${uid}-${row.id}-msg${n}` : null))
                  .filter(Boolean)
                  .join(" ") || undefined;
              const label = `Row ${i + 1}`;
              return (
                <li
                  key={row.id}
                  className="rounded-lg px-2 py-1 transition-colors md:py-0.5"
                  style={i === matchIndex ? MATCHED : undefined}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leaveRow(row.id);
                  }}
                >
                  <div className={COLUMNS}>
                    <input
                      id={fieldId(row.id, "letter")}
                      className="input"
                      value={row.letter}
                      maxLength={4}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-label={`${label} letter`}
                      aria-invalid={bad("letter") || undefined}
                      aria-describedby={describe("letter")}
                      style={bad("letter") ? INVALID : undefined}
                      onChange={(e) => update(row.id, { letter: e.target.value })}
                    />
                    <input
                      id={fieldId(row.id, "min")}
                      className="input tabular-nums"
                      value={row.min}
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label={`${label} minimum percent`}
                      aria-invalid={bad("minPercent") || undefined}
                      aria-describedby={describe("minPercent")}
                      style={bad("minPercent") ? INVALID : undefined}
                      onChange={(e) => update(row.id, { min: e.target.value })}
                    />
                    <span className="truncate text-[12.5px] tabular-nums text-fg-3">{ranges[i]}</span>
                    <input
                      id={fieldId(row.id, "points")}
                      className="input tabular-nums"
                      value={row.points}
                      inputMode="decimal"
                      maxLength={6}
                      autoComplete="off"
                      aria-label={`${label} points`}
                      aria-invalid={bad("points") || undefined}
                      aria-describedby={describe("points")}
                      style={bad("points") ? INVALID : undefined}
                      onChange={(e) => update(row.id, { points: e.target.value })}
                    />
                    <button
                      id={fieldId(row.id, "remove")}
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length <= MIN_ROWS || busy}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-3 md:h-8 md:w-8 transition-colors hover:bg-surface-hi hover:text-red disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-3"
                      aria-label={`Remove ${label.toLowerCase()}`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  {rowIssues.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {rowIssues.map((s, n) => (
                        <p
                          key={n}
                          id={`${uid}-${row.id}-msg${n}`}
                          className="flex items-start gap-1 text-[12px] leading-snug text-red"
                        >
                          <AlertCircle size={12} className="mt-[2px] shrink-0" />
                          {s.message}
                        </p>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= MAX_ROWS || busy}
            className="btn btn-soft min-h-10 md:min-h-0"
          >
            <Plus size={14} />
            Add row
          </button>
          {rows.length >= MAX_ROWS && (
            <span className="text-[12px] text-fg-3">That's the max of {MAX_ROWS} rows.</span>
          )}
        </div>

        <div aria-live="polite">
          {scaleIssues.map((s) => (
            <p key={s.message} className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-snug text-red">
              <AlertCircle size={13} className="mt-[2px] shrink-0" />
              {s.message}
            </p>
          ))}
        </div>
      </div>

      <section className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-4">
        <label htmlFor={`${uid}-try`} className="text-[13px] font-semibold text-fg">
          Try a grade
        </label>
        <div className="relative w-24">
          <input
            id={`${uid}-try`}
            className="input tabular-nums"
            value={tryText}
            inputMode="decimal"
            maxLength={6}
            autoComplete="off"
            aria-describedby={`${uid}-result`}
            style={{ paddingRight: 28 }}
            onChange={(e) => setTryText(e.target.value)}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-fg-3"
          >
            %
          </span>
        </div>
        <output
          id={`${uid}-result`}
          htmlFor={`${uid}-try`}
          aria-live="polite"
          className="ml-auto flex items-baseline gap-2 tabular-nums"
        >
          {matchLetter ? (
            <>
              <span className="text-[20px] font-bold leading-none text-fg">{matchLetter}</span>
              <span className="text-[15px] text-fg-3" aria-hidden>
                ·
              </span>
              <span className="text-[17px] font-semibold leading-none text-fg-2">{pointsShown}</span>
            </>
          ) : (
            <span className="text-[13px] text-fg-3">
              {Number.isFinite(tryValue) ? "No grade for that %" : "Type a %"}
            </span>
          )}
        </output>
        {Number.isFinite(tryValue) && !Number.isInteger(tryValue) && (
          <p className="w-full text-[12px] text-fg-3">Counts as {Math.round(tryValue)}%</p>
        )}
      </section>
    </Modal>
  );
}
