import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import { formatMonthDay } from "../../lib/format";
import type { Semester, SemesterRequest, SemesterTerm } from "../../types";

const TERMS: SemesterTerm[] = ["FALL", "SPRING", "SUMMER", "WINTER"];
const TERM_LABELS: Record<SemesterTerm, string> = {
  FALL: "Fall",
  SPRING: "Spring",
  SUMMER: "Summer",
  WINTER: "Winter",
};

export default function SemestersPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);

  const { data: semesters, isLoading } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => api.get<Semester[]>("/semesters"),
  });

  const create = useMutation({
    mutationFn: (req: SemesterRequest) => api.post<Semester>("/semesters", req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["semesters"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setShowForm(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del<void>(`/semesters/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["semesters"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Semester deleted");
    },
  });

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">Semesters</h1>
        <button onClick={() => setShowForm((s) => !s)} className="btn btn-primary">
          <Plus size={13} strokeWidth={2} />
          {showForm ? "Cancel" : "New semester"}
        </button>
      </div>

      {showForm && (
        <SemesterForm
          onSubmit={(req) => create.mutateAsync(req)}
          onCancel={() => setShowForm(false)}
          error={create.error instanceof Error ? create.error.message : null}
        />
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-fg-3">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
          Loading…
        </div>
      ) : semesters && semesters.length > 0 ? (
        <ul className="card divide-y divide-line">
          {semesters.map((s) => (
            <SemesterRow
              key={s.id}
              semester={s}
              onDelete={async () => {
                const ok = await confirm({
                  title: `Delete ${s.label}?`,
                  message: "Courses in this semester will become unassigned.",
                  confirmLabel: "Delete",
                  danger: true,
                });
                if (ok) remove.mutate(s.id);
              }}
            />
          ))}
        </ul>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm text-fg-3">
            No semesters yet. Create one to organize your courses by term.
          </p>
          <button onClick={() => setShowForm(true)} className="btn btn-soft mt-3">
            <Plus size={13} />
            Add semester
          </button>
        </div>
      )}
    </div>
  );
}

function SemesterRow({ semester, onDelete }: { semester: Semester; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: (req: SemesterRequest) => api.put<Semester>(`/semesters/${semester.id}`, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["semesters"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(false);
    },
  });

  if (editing) {
    return (
      <li className="p-4">
        <SemesterForm
          initial={semester}
          onSubmit={(req) => update.mutateAsync(req)}
          onCancel={() => setEditing(false)}
          error={update.error instanceof Error ? update.error.message : null}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div>
        <span className="font-medium text-fg">{semester.label}</span>
        <span className="ml-3 text-[13px] text-fg-3">
          {formatMonthDay(semester.startDate)} – {formatMonthDay(semester.endDate)}
        </span>
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => setEditing(true)} className="btn btn-ghost">
          <Edit2 size={13} />
          Edit
        </button>
        <button onClick={onDelete} className="btn btn-danger">
          <Trash2 size={13} />
          Delete
        </button>
      </div>
    </li>
  );
}

function SemesterForm({
  initial,
  onSubmit,
  onCancel,
  error,
}: {
  initial?: Semester;
  onSubmit: (req: SemesterRequest) => Promise<unknown>;
  onCancel: () => void;
  error: string | null;
}) {
  const currentYear = new Date().getFullYear();
  const [term, setTerm] = useState<SemesterTerm>(initial?.term ?? "FALL");
  const [year, setYear] = useState(initial?.year?.toString() ?? String(currentYear));
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ term, year: Number(year), startDate: startDate || null, endDate: endDate || null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label">Term</label>
          <select className="input w-auto" value={term} onChange={(e) => setTerm(e.target.value as SemesterTerm)}>
            {TERMS.map((t) => (
              <option key={t} value={t}>{TERM_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Year</label>
          <input
            className="input w-24"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min={2000}
            max={2100}
            required
          />
        </div>
        <div>
          <label className="field-label">
            Start date <span className="normal-case font-normal text-fg-3">(optional)</span>
          </label>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="field-label">
            End date <span className="normal-case font-normal text-fg-3">(optional)</span>
          </label>
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <p className="text-[12px] text-fg-3">Leave dates blank to use defaults (e.g. Fall = Sep 1 – Dec 31).</p>
      {error && <p className="text-xs text-red animate-fade">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : initial ? "Save changes" : "Create semester"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
