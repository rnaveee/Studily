import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BookOpen, Edit2, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import { MONTHS, formatMonth } from "../../lib/format";
import type { Course, Semester, SemesterRequest, SemesterTerm } from "../../types";

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
  const requireAuth = useRequireAuth();
  const [showForm, setShowForm] = useState(false);

  const { data: semesters, isLoading } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => api.get<Semester[]>("/semesters"),
  });

  const { data: courses } = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
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
        <button onClick={() => requireAuth(() => setShowForm((s) => !s))} className="btn btn-primary">
          <Plus size={13} strokeWidth={2} />
          {showForm ? "Cancel" : "New semester"}
        </button>
      </div>

      <Link to="/courses" className="card flex items-center gap-3 p-4 transition-colors hover:bg-surface-hi">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
          <BookOpen size={16} className="text-accent" />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-fg">Courses</div>
          <div className="text-[12px] text-fg-3">Set your courses for your semesters.</div>
        </div>
      </Link>

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
              courses={(courses ?? []).filter((c) => c.semesterId === s.id)}
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
          <button onClick={() => requireAuth(() => setShowForm(true))} className="btn btn-soft mt-3">
            <Plus size={13} />
            Add semester
          </button>
        </div>
      )}
    </div>
  );
}

function SemesterRow({
  semester,
  courses,
  onDelete,
}: {
  semester: Semester;
  courses: Course[];
  onDelete: () => void;
}) {
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
    <li className="px-4 py-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-fg">{semester.label}</div>
          <div className="text-[13px] text-fg-3">
            {formatMonth(semester.startDate)} – {formatMonth(semester.endDate)}
          </div>
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
      </div>
      {courses.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {courses.map((c) => (
            <Link
              key={c.id}
              to={`/courses/${c.id}`}
              className="flex w-full items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg sm:w-auto"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: c.color ?? "var(--accent)" }}
              />
              <span className="truncate">{c.name}</span>
              {c.code && (
                <span className="ml-auto shrink-0 pl-2 text-[11px] font-normal text-fg-3 sm:ml-0.5 sm:pl-0">
                  {c.code}
                </span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-2.5 text-[12px] text-fg-3">
          No courses in this semester yet —{" "}
          <Link to="/courses" className="text-accent hover:text-accent-2 transition-colors">
            add one
          </Link>.
        </p>
      )}
    </li>
  );
}

function monthOf(dateStr?: string): string {
  return dateStr ? String(Number(dateStr.split("-")[1])) : "";
}

function firstOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function lastOfMonth(year: number, month: number): string {
  const day = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${day}`;
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
  const [startMonth, setStartMonth] = useState(monthOf(initial?.startDate));
  const [endMonth, setEndMonth] = useState(monthOf(initial?.endDate));
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const y = Number(year);
      const endYear = startMonth && endMonth && Number(endMonth) < Number(startMonth) ? y + 1 : y;
      await onSubmit({
        term,
        year: y,
        startDate: startMonth ? firstOfMonth(y, Number(startMonth)) : null,
        endDate: endMonth ? lastOfMonth(endYear, Number(endMonth)) : null,
      });
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
            Start month <span className="normal-case font-normal text-fg-3">(optional)</span>
          </label>
          <select className="input w-auto" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}>
            <option value="">Default</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">
            End month <span className="normal-case font-normal text-fg-3">(optional)</span>
          </label>
          <select className="input w-auto" value={endMonth} onChange={(e) => setEndMonth(e.target.value)}>
            <option value="">Default</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[12px] text-fg-3">Leave months on Default to use the term's usual range (e.g. Fall = September – December).</p>
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
