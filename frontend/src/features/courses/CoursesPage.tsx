import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Plus } from "lucide-react";
import { api } from "../../lib/api";
import BackButton from "../../components/BackButton";
import { SkeletonCards } from "../../components/Skeleton";
import { staggerDelay } from "../../lib/motion";
import { useRequireAuth } from "../../lib/auth";
import { toast } from "../../lib/toast";
import type { Course, CourseRequest, Semester } from "../../types";
import CourseCard from "./CourseCard";
import CourseForm from "./CourseForm";
import DuplicateCoursePrompt from "./DuplicateCoursePrompt";
import { findSimilarCourses } from "./similarCourses";
import NewCourseChooser from "./NewCourseChooser";
import Modal from "../../components/Modal";
import QueryError from "../../components/QueryError";

export default function CoursesPage() {
  const qc = useQueryClient();
  const requireAuth = useRequireAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"chooser" | "manual" | null>(null);
  const [semesterFilter, setSemesterFilter] = useState<number | null>(null);
  const [duplicate, setDuplicate] = useState<{ req: CourseRequest; existing: Course } | null>(null);

  const { data: semesters } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => api.get<Semester[]>("/semesters"),
  });

  const coursesUrl = semesterFilter != null ? `/courses?semesterId=${semesterFilter}` : "/courses";
  const { data: courses, isLoading, isError, refetch } = useQuery({
    queryKey: ["courses", semesterFilter],
    queryFn: () => api.get<Course[]>(coursesUrl),
  });

  const create = useMutation({
    mutationFn: (req: CourseRequest) => api.post<Course>("/courses", req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setMode(null);
    },
  });

  async function submitManual(req: CourseRequest) {
    const similar = await findSimilarCourses(req.name, req.code, req.semesterId);
    if (similar.length > 0) {
      setDuplicate({ req, existing: similar[0] });
      return;
    }
    await create.mutateAsync(req);
  }

  return (
    <div className="space-y-4">
      <div className="stagger-item flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/semesters" />
          <h1 className="text-xl font-semibold text-fg">Courses</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
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
          <button onClick={() => requireAuth(() => navigate("/courses/new/schedule"))} className="btn btn-ghost">
            <CalendarDays size={13} strokeWidth={2} />
            Upload schedule
          </button>
          <button onClick={() => requireAuth(() => setMode("chooser"))} className="btn btn-primary">
            <Plus size={13} strokeWidth={2} />
            New course
          </button>
        </div>
      </div>

      {mode === "chooser" && (
        <NewCourseChooser
          onClose={() => setMode(null)}
          onManual={() => setMode("manual")}
          onAutomatic={() => navigate("/courses/new/auto")}
        />
      )}

      {mode === "manual" && (
        <Modal onClose={() => setMode(null)} title="New course" size="xl" variant="sheet" padded={false}>
          <div className="p-5 pt-0">
            <CourseForm
              bare
              submitLabel="Create course"
              onSubmit={submitManual}
              onCancel={() => setMode(null)}
              onImported={() => {
                qc.invalidateQueries({ queryKey: ["courses"] });
                qc.invalidateQueries({ queryKey: ["dashboard"] });
                setMode(null);
              }}
            />
          </div>
        </Modal>
      )}

      {duplicate && (
        <DuplicateCoursePrompt
          incoming={{ ...duplicate.req, meetingBlocks: duplicate.req.meetingBlocks ?? [] }}
          existing={duplicate.existing}
          busy={create.isPending}
          onClose={() => setDuplicate(null)}
          onAddAnyway={async () => {
            try {
              await create.mutateAsync(duplicate.req);
              setDuplicate(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed to save");
            }
          }}
          onUseExisting={() => navigate(`/courses/${duplicate.existing.id}`)}
        />
      )}

      {isLoading ? (
        <SkeletonCards count={4} className="stagger-item grid-cols-1 sm:grid-cols-2" style={staggerDelay(1)} />
      ) : isError && !courses ? (
        <QueryError onRetry={() => refetch()} />
      ) : courses && courses.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {courses.map((c, index) => (
            <li key={c.id} className="stagger-item" style={staggerDelay(index + 1, 45)}>
              <CourseCard
                course={c}
                to={`/courses/${c.id}`}
                semesterLabel={c.semesterId && semesters ? semesters.find((s) => s.id === c.semesterId)?.label : null}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm text-fg-3">
            {semesterFilter ? "No courses in this semester." : "No courses yet."}
          </p>
          <button onClick={() => requireAuth(() => setMode("chooser"))} className="btn btn-soft mt-3">
            <Plus size={13} />
            Add your first course
          </button>
        </div>
      )}
    </div>
  );
}
