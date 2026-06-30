import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../../lib/api";
import type { Course, CourseRequest, Semester } from "../../types";
import { hhmm } from "../../lib/format";
import CourseForm from "./CourseForm";

export default function CoursesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [semesterFilter, setSemesterFilter] = useState<number | null>(null);

  const { data: semesters } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => api.get<Semester[]>("/semesters"),
  });

  const coursesUrl = semesterFilter != null ? `/courses?semesterId=${semesterFilter}` : "/courses";
  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses", semesterFilter],
    queryFn: () => api.get<Course[]>(coursesUrl),
  });

  const create = useMutation({
    mutationFn: (req: CourseRequest) => api.post<Course>("/courses", req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setShowForm(false);
    },
  });

  return (
    <div className="space-y-4 animate-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-fg">Courses</h1>
        <div className="flex items-center gap-2">
          {semesters && semesters.length > 0 && (
            <select
              className="input w-auto"
              value={semesterFilter ?? ""}
              onChange={(e) => setSemesterFilter(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All semesters</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          )}
          <button onClick={() => setShowForm((s) => !s)} className="btn btn-primary">
            <Plus size={13} strokeWidth={2} />
            {showForm ? "Cancel" : "New course"}
          </button>
        </div>
      </div>

      {showForm && (
        <CourseForm
          submitLabel="Create course"
          onSubmit={(req) => create.mutateAsync(req)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-fg-3">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
          Loading…
        </div>
      ) : courses && courses.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                to={`/courses/${c.id}`}
                className="card block p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color ?? "var(--accent)" }}
                  />
                  <span className="font-semibold text-fg">{c.name}</span>
                  {c.code && (
                    <span className="ml-auto rounded bg-surface-hi px-1.5 py-0.5 text-[11px] font-mono text-fg-3">
                      {c.code}
                    </span>
                  )}
                </div>
                {c.professor && (
                  <p className="mt-1.5 text-[13px] text-fg-2">{c.professor}</p>
                )}
                {c.meetingBlocks.length > 0 && (
                  <p className="mt-1 text-[12px] text-fg-3">
                    {c.meetingBlocks
                      .map((b) => `${b.dayOfWeek} ${hhmm(b.startTime)}–${hhmm(b.endTime)}`)
                      .join("  ·  ")}
                  </p>
                )}
                {c.semesterId && semesters && (
                  <div className="mt-2">
                    <span className="badge badge-soft text-[11px]">
                      {semesters.find((s) => s.id === c.semesterId)?.label}
                    </span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm text-fg-3">
            {semesterFilter ? "No courses in this semester." : "No courses yet."}
          </p>
          <button onClick={() => setShowForm(true)} className="btn btn-soft mt-3">
            <Plus size={13} />
            Add your first course
          </button>
        </div>
      )}
    </div>
  );
}
