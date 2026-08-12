import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Plus, Users2, X } from "lucide-react";
import {
  DAYS,
  MEETING_KINDS,
  MEETING_KIND_LABEL,
  MEETING_KIND_PLURAL,
  type Course,
  type CourseMatch,
  type CourseRequest,
  type DayOfWeek,
  type MeetingBlock,
  type MeetingKind,
  type Semester,
} from "../../types";
import { formatDateTime, hhmm } from "../../lib/format";
import { addMinutes, toMinutes } from "../../lib/time";
import { api } from "../../lib/api";
import TimeSelect from "../../components/TimeSelect";

interface Props {
  initial?: CourseRequest;
  submitLabel: string;
  onSubmit: (req: CourseRequest) => Promise<unknown>;
  onCancel?: () => void;
  onImported?: (course: Course) => void;
}

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#7968dc", "#0ea5e9"];

function tokenSet(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

function diceSimilarity(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared++;
  });
  return (2 * shared) / (ta.size + tb.size);
}

function blockOverlap(a: MeetingBlock[], b: MeetingBlock[]): number {
  const total = (list: MeetingBlock[]) =>
    list.reduce((sum, x) => sum + (toMinutes(x.endTime) - toMinutes(x.startTime)), 0);
  let overlap = 0;
  for (const x of a) {
    for (const y of b) {
      if (x.dayOfWeek !== y.dayOfWeek) continue;
      overlap += Math.max(
        0,
        Math.min(toMinutes(x.endTime), toMinutes(y.endTime)) -
          Math.max(toMinutes(x.startTime), toMinutes(y.startTime)),
      );
    }
  }
  const denom = Math.max(total(a), total(b));
  return denom > 0 ? Math.min(1, overlap / denom) : 0;
}

function matchSimilarity(
  form: { name: string; professor: string; blocks: MeetingBlock[] },
  m: CourseMatch,
): number | null {
  const parts: number[] = [];
  if (form.name.trim()) parts.push(diceSimilarity(form.name, m.name));
  if (form.professor.trim() && m.professor) parts.push(diceSimilarity(form.professor, m.professor));
  if (form.blocks.length > 0 && m.meetingBlocks.length > 0) {
    parts.push(blockOverlap(form.blocks, m.meetingBlocks));
  }
  if (parts.length === 0) return null;
  return parts.reduce((sum, p) => sum + p, 0) / parts.length;
}

interface TimeRow {
  id: string;
  kind: MeetingKind;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
}

const DAY_LABEL: Record<DayOfWeek, string> = {
  SUN: "Su",
  MON: "M",
  TUE: "Tu",
  WED: "W",
  THU: "Th",
  FRI: "F",
  SAT: "Sa",
};

const DEFAULT_START = "09:00";
const DEFAULT_DURATION = 50;

let rowSeq = 0;
function nextRowId(): string {
  rowSeq += 1;
  return `row-${rowSeq}`;
}

function collapseBlocks(blocks: MeetingBlock[]): TimeRow[] {
  const byKey = new Map<string, TimeRow>();
  for (const b of blocks) {
    const kind = b.kind ?? "LECTURE";
    const start = hhmm(b.startTime);
    const end = hhmm(b.endTime);
    const key = `${kind}|${start}|${end}`;
    const row = byKey.get(key);
    if (row) {
      if (!row.days.includes(b.dayOfWeek)) row.days.push(b.dayOfWeek);
    } else {
      byKey.set(key, { id: nextRowId(), kind, days: [b.dayOfWeek], startTime: start, endTime: end });
    }
  }
  for (const row of byKey.values()) {
    row.days.sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
  }
  return [...byKey.values()];
}

function expandRows(rows: TimeRow[], locations: Record<MeetingKind, string>): MeetingBlock[] {
  const out: MeetingBlock[] = [];
  for (const row of rows) {
    for (const day of row.days) {
      out.push({
        dayOfWeek: day,
        kind: row.kind,
        startTime: row.startTime,
        endTime: row.endTime,
        location: locations[row.kind].trim() || undefined,
      });
    }
  }
  return out;
}

function initialLocations(initial?: CourseRequest): Record<MeetingKind, string> {
  const out = {} as Record<MeetingKind, string>;
  for (const kind of MEETING_KINDS) {
    const block = (initial?.meetingBlocks ?? []).find(
      (b) => (b.kind ?? "LECTURE") === kind && (b.location ?? "").trim(),
    );
    out[kind] = block?.location?.trim() || initial?.location?.trim() || "";
  }
  return out;
}

export default function CourseForm({ initial, submitLabel, onSubmit, onCancel, onImported }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [semesterId, setSemesterId] = useState<number | null>(initial?.semesterId ?? null);
  const [code, setCode] = useState(initial?.code ?? "");
  const [professor, setProfessor] = useState(initial?.professor ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [rows, setRows] = useState<TimeRow[]>(() => collapseBlocks(initial?.meetingBlocks ?? []));
  const [locations, setLocations] = useState<Record<MeetingKind, string>>(() => initialLocations(initial));
  const lastTimes = useRef<{ startTime: string; endTime: string }>({
    startTime: DEFAULT_START,
    endTime: addMinutes(DEFAULT_START, DEFAULT_DURATION),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: semesters } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => api.get<Semester[]>("/semesters"),
  });

  const [debouncedCode, setDebouncedCode] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCode(code.trim()), 400);
    return () => clearTimeout(t);
  }, [code]);

  const matches = useQuery({
    queryKey: ["course-matches", debouncedCode],
    queryFn: () => api.get<CourseMatch[]>(`/courses/matches?code=${encodeURIComponent(debouncedCode)}`),
    enabled: !initial && debouncedCode.length >= 3,
  });

  const importCourse = useMutation({
    mutationFn: (sourceCourseId: number) =>
      api.post<Course>("/courses/import", {
        sourceCourseId,
        code: debouncedCode,
        semesterId: semesterId ?? null,
      }),
    onSuccess: (course) => onImported?.(course),
  });

  const matchList = !initial && debouncedCode.length >= 3 ? (matches.data ?? []) : [];

  const blocks = useMemo(() => expandRows(rows, locations), [rows, locations]);

  function addRow(kind: MeetingKind) {
    setRows((r) => {
      const sameKind = r.filter((row) => row.kind === kind);
      const source = sameKind.length > 0 ? sameKind[sameKind.length - 1] : lastTimes.current;
      return [
        ...r,
        { id: nextRowId(), kind, days: [], startTime: source.startTime, endTime: source.endTime },
      ];
    });
  }

  function patchRow(id: string, patch: Partial<TimeRow>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  function toggleDay(row: TimeRow, day: DayOfWeek) {
    const days = row.days.includes(day)
      ? row.days.filter((d) => d !== day)
      : [...row.days, day].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
    patchRow(row.id, { days });
  }

  function setStart(row: TimeRow, startTime: string) {
    const duration = Math.max(5, toMinutes(row.endTime) - toMinutes(row.startTime));
    const endTime = addMinutes(startTime, duration);
    lastTimes.current = { startTime, endTime };
    patchRow(row.id, { startTime, endTime });
  }

  function setEnd(row: TimeRow, endTime: string) {
    lastTimes.current = { startTime: row.startTime, endTime };
    patchRow(row.id, { endTime });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (rows.some((r) => r.days.length === 0)) {
      setError("Pick at least one day for every time.");
      return;
    }
    if (rows.some((r) => toMinutes(r.endTime) <= toMinutes(r.startTime))) {
      setError("Each time must end after it starts.");
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        semesterId: semesterId ?? null,
        code: code.trim() || undefined,
        professor: professor.trim() || undefined,
        color,
        meetingBlocks: expandRows(rows, locations),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-4 animate-slide">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label">Course name</label>
          <input
            className="input"
            placeholder="e.g. Calculus I"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="field-label">Semester</label>
          <select
            className="input"
            value={semesterId ?? ""}
            onChange={(e) => setSemesterId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">No semester</option>
            {(semesters ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Course code</label>
          <input
            className="input"
            placeholder="e.g. MATH 101"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Professor</label>
          <input
            className="input"
            placeholder="e.g. Dr. Smith"
            value={professor}
            onChange={(e) => setProfessor(e.target.value)}
          />
        </div>
      </div>

      {matchList.length > 0 && (
        <div className="space-y-2.5 rounded-lg border border-line p-3" style={{ background: "var(--surface-hi)" }}>
          <div>
            <p className="text-[13px] font-semibold text-fg">
              {matchList.length} matching course{matchList.length > 1 ? "s" : ""} at your school
            </p>
            <p className="mt-0.5 text-[11px] text-fg-3">
              Import one to copy its class times and deadlines. You can edit everything afterwards.
            </p>
          </div>
          {matchList
            .map((m) => ({ m, score: matchSimilarity({ name, professor, blocks }, m) }))
            .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.m.userCount - a.m.userCount)
            .map(({ m, score }) => (
              <div key={m.id} className="card space-y-1.5 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="min-w-0 truncate text-[13px] font-semibold text-fg">{m.name}</span>
                  {m.code && (
                    <span className="rounded bg-surface-hi px-1.5 py-0.5 text-[10px] font-mono text-fg-3">
                      {m.code}
                    </span>
                  )}
                  <span className="badge badge-muted flex items-center gap-1 text-[10px]">
                    <Users2 size={10} />
                    {m.userCount} classmate{m.userCount > 1 ? "s" : ""}
                  </span>
                  {score != null && (
                    <span className="badge badge-accent text-[10px]">{Math.round(score * 100)}% similar</span>
                  )}
                  <button
                    type="button"
                    onClick={() => importCourse.mutate(m.id)}
                    disabled={importCourse.isPending}
                    className="btn btn-soft ml-auto text-xs"
                  >
                    <Download size={12} />
                    Import
                  </button>
                </div>
                {(m.professor || m.school) && (
                  <p className="text-[12px] text-fg-2">
                    {[m.professor, m.school].filter(Boolean).join(" · ")}
                  </p>
                )}
                {m.meetingBlocks.length > 0 && (
                  <p className="text-[11px] text-fg-3">
                    {m.meetingBlocks
                      .map(
                        (b) =>
                          `${b.dayOfWeek} ${hhmm(b.startTime)}–${hhmm(b.endTime)}` +
                          (b.location ? ` ${b.location}` : ""),
                      )
                      .join("  ·  ")}
                  </p>
                )}
                {m.items.length > 0 && (
                  <ul className="space-y-0.5 border-t border-line pt-1.5">
                    {m.items.slice(0, 5).map((it, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-[11px] text-fg-2">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: it.type === "EXAM" ? "var(--red)" : "var(--green)" }}
                        />
                        <span className="min-w-0 truncate">{it.title}</span>
                        <span className="ml-auto shrink-0 whitespace-nowrap text-fg-3">
                          {formatDateTime(it.dueAt)}
                        </span>
                      </li>
                    ))}
                    {m.items.length > 5 && (
                      <li className="text-[11px] text-fg-3">+{m.items.length - 5} more</li>
                    )}
                  </ul>
                )}
              </div>
            ))}
        </div>
      )}

      <div>
        <label className="field-label mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={[
                "h-6 w-6 rounded-full transition-transform",
                color === c ? "ring-2 ring-offset-2 ring-fg scale-110" : "hover:scale-110",
              ].join(" ")}
              style={{ backgroundColor: c }}
              aria-label={`color ${c}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {MEETING_KINDS.map((kind) => {
          const kindRows = rows.filter((r) => r.kind === kind);
          return (
            <div key={kind}>
              <div className="mb-2 flex items-center justify-between">
                <label className="field-label mb-0">{MEETING_KIND_LABEL[kind]} times</label>
                <button type="button" onClick={() => addRow(kind)} className="btn btn-soft text-xs">
                  <Plus size={12} />
                  Add time
                </button>
              </div>
              {kindRows.length === 0 ? (
                <p className="text-[12px] text-fg-3">No {MEETING_KIND_PLURAL[kind].toLowerCase()}.</p>
              ) : (
                <div className="space-y-2">
                  <input
                    className="input"
                    placeholder={`${MEETING_KIND_LABEL[kind]} location (e.g. Hall 210)`}
                    value={locations[kind]}
                    onChange={(e) => setLocations((l) => ({ ...l, [kind]: e.target.value }))}
                  />
                  {kindRows.map((row) => (
                    <div
                      key={row.id}
                      className="space-y-2 rounded-lg p-2.5"
                      style={{ background: "var(--surface-hi)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          {DAYS.map((d) => {
                            const on = row.days.includes(d);
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => toggleDay(row, d)}
                                aria-pressed={on}
                                className="h-7 min-w-[28px] rounded-md px-1.5 text-[12px] font-medium transition-colors"
                                style={{
                                  background: on ? "var(--accent)" : "var(--surface)",
                                  color: on ? "var(--accent-fg)" : "var(--fg-3)",
                                  border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`,
                                }}
                              >
                                {DAY_LABEL[d]}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          aria-label="Remove this time"
                          className="shrink-0 rounded p-1 text-fg-3 transition-colors hover:text-red"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <TimeSelect
                          value={row.startTime}
                          onChange={(v) => setStart(row, v)}
                          label="Start time"
                          className="flex-1"
                        />
                        <span className="text-fg-3">–</span>
                        <TimeSelect
                          value={row.endTime}
                          onChange={(v) => setEnd(row, v)}
                          label="End time"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red animate-fade">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
