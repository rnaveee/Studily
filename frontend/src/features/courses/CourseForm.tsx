import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { DAYS, type CourseRequest, type DayOfWeek, type MeetingBlock, type Semester } from "../../types";
import { hhmm } from "../../lib/format";
import { api } from "../../lib/api";

interface Props {
  initial?: CourseRequest;
  submitLabel: string;
  onSubmit: (req: CourseRequest) => Promise<unknown>;
  onCancel?: () => void;
}

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#7968dc", "#0ea5e9"];

export default function CourseForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
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
