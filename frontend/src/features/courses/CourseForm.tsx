import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Plus, Users2, X } from "lucide-react";
import {
  DAYS,
  type Course,
  type CourseMatch,
  type CourseRequest,
  type DayOfWeek,
  type MeetingBlock,
  type Semester,
} from "../../types";
import { formatDateTime, hhmm } from "../../lib/format";
import { api } from "../../lib/api";

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

function toMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function blockOverlap(a: MeetingBlock[], b: MeetingBlock[]): number {
  const total = (list: MeetingBlock[]) =>
    list.reduce((sum, x) => sum + (toMin(x.endTime) - toMin(x.startTime)), 0);
  let overlap = 0;
  for (const x of a) {
    for (const y of b) {
      if (x.dayOfWeek !== y.dayOfWeek) continue;
      overlap += Math.max(
        0,
        Math.min(toMin(x.endTime), toMin(y.endTime)) - Math.max(toMin(x.startTime), toMin(y.startTime)),
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

export default function CourseForm({ initial, submitLabel, onSubmit, onCancel, onImported }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [semesterId, setSemesterId] = useState<number | null>(initial?.semesterId ?? null);
  const [code, setCode] = useState(initial?.code ?? "");
  const [professor, setProfessor] = useState(initial?.professor ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [blocks, setBlocks] = useState<MeetingBlock[]>(initial?.meetingBlocks ?? []);
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
      api.post<Course>("/courses/import", { sourceCourseId, semesterId: semesterId ?? null }),
    onSuccess: (course) => onImported?.(course),
  });

  const matchList = !initial && debouncedCode.length >= 3 ? (matches.data ?? []) : [];

  function addBlock() {
    setBlocks((b) => [...b, { dayOfWeek: "MON", startTime: "09:00", endTime: "09:50" }]);
  }
  function updateBlock(i: number, patch: Partial<MeetingBlock>) {
    setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, ...patch } : blk)));
  }
  function removeBlock(i: number) {
    setBlocks((b) => b.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        semesterId: semesterId ?? null,
        code: code.trim() || undefined,
        professor: professor.trim() || undefined,
        color,
        meetingBlocks: blocks.map((b) => ({
          dayOfWeek: b.dayOfWeek,
          startTime: hhmm(b.startTime),
          endTime: hhmm(b.endTime),
        })),
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
            placeholder="e.g. Algorithms"
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
            placeholder="e.g. CMPT 225"
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
              Import one to copy its class times and deadlines — you can edit everything afterwards.
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
                {(m.professor ?? m.school) && (
                  <p className="text-[12px] text-fg-2">
                    {[m.professor, m.school].filter(Boolean).join(" · ")}
                  </p>
                )}
                {m.meetingBlocks.length > 0 && (
                  <p className="text-[11px] text-fg-3">
                    {m.meetingBlocks
                      .map((b) => `${b.dayOfWeek} ${hhmm(b.startTime)}–${hhmm(b.endTime)}`)
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

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="field-label mb-0">Class times</label>
          <button type="button" onClick={addBlock} className="btn btn-soft text-xs">
            <Plus size={12} />
            Add time
          </button>
        </div>
        {blocks.length === 0 && (
          <p className="text-[12px] text-fg-3">No meeting times yet.</p>
        )}
        <div className="space-y-2">
          {blocks.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                className="input w-28"
                value={b.dayOfWeek}
                onChange={(e) => updateBlock(i, { dayOfWeek: e.target.value as DayOfWeek })}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <input
                type="time"
                className="input w-28"
                value={hhmm(b.startTime)}
                onChange={(e) => updateBlock(i, { startTime: e.target.value })}
              />
              <span className="text-fg-3">–</span>
              <input
                type="time"
                className="input w-28"
                value={hhmm(b.endTime)}
                onChange={(e) => updateBlock(i, { endTime: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeBlock(i)}
                className="rounded p-1 text-fg-3 transition-colors hover:text-red"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
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
