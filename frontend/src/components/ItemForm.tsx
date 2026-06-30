import { useState } from "react";
import { Plus } from "lucide-react";
import type { AcademicItemRequest, ItemType } from "../types";

interface Props {
  submitLabel?: string;
  initialDate?: string;
  courseId?: number;
  courses?: { id: number; name: string }[];
  onSubmit: (courseId: number, req: AcademicItemRequest) => Promise<unknown>;
  onCancel?: () => void;
}

export default function ItemForm({
  submitLabel = "Add",
  initialDate,
  courseId: lockedCourseId,
  courses = [],
  onSubmit,
  onCancel,
}: Props) {
  const [type, setType] = useState<ItemType>("ASSIGNMENT");
  const [title, setTitle] = useState("");
  const [dueLocal, setDueLocal] = useState(() => {
    if (!initialDate) return "";
    return initialDate.length === 10 ? `${initialDate}T23:59` : initialDate.slice(0, 16);
  });
  const [weight, setWeight] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | "">(
    lockedCourseId ?? (courses[0]?.id ?? "")
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cid = lockedCourseId ?? (selectedCourseId as number);
    if (!cid) { setError("Select a course"); return; }
    if (!dueLocal) { setError("Pick a due date"); return; }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(cid, {
        type,
        title: title.trim(),
        dueAt: new Date(dueLocal).toISOString(),
        weight: weight ? Number(weight) : undefined,
        status: "TODO",
      });
      setTitle("");
      setWeight("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-3 animate-slide">
      {!lockedCourseId && courses.length > 0 && (
        <div>
          <label className="field-label">Course</label>
          <select
            className="input"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(Number(e.target.value))}
            required
          >
            <option value="">Select course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <div className="w-36">
          <label className="field-label">Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as ItemType)}>
            <option value="ASSIGNMENT">Assignment</option>
            <option value="EXAM">Exam</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="field-label">Title</label>
          <input
            className="input"
            placeholder="e.g. Midterm 1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="field-label">Due date & time</label>
          <input
            className="input"
            type="datetime-local"
            value={dueLocal}
            onChange={(e) => setDueLocal(e.target.value)}
            required
          />
        </div>
        <div className="w-24">
          <label className="field-label">Weight %</label>
          <input
            className="input"
            type="number"
            placeholder="—"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            min={0}
            max={100}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red animate-fade">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={busy} className="btn btn-primary">
          <Plus size={13} strokeWidth={2} />
          {busy ? "Adding…" : submitLabel}
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
