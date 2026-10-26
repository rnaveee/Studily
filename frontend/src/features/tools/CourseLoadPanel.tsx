import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Download, Save, X } from "lucide-react";
import { api } from "../../lib/api";
import { invalidateItemQueries } from "../../lib/invalidateItems";
import { toast } from "../../lib/toast";
import type { AcademicItem, Course, GradeCategory } from "../../types";
import type { CalcState } from "./gradeCalc";
import {
  buildFromCourse,
  pendingChanges,
  targetFromState,
  unsavedRowCount,
  type BuiltFromCourse,
  type LoadedCourse,
} from "./courseCalc";

export default function CourseLoadPanel({
  state,
  loaded,
  ready,
  nextId,
  onLoad,
  onUnload,
  onSaved,
}: {
  state: CalcState;
  loaded: LoadedCourse | null;
  ready: boolean;
  nextId: () => number;
  onLoad: (course: Course, built: BuiltFromCourse) => void;
  onUnload: () => void;
  onSaved: (loaded: LoadedCourse) => void;
}) {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const autoLoaded = useRef(false);

  const coursesQ = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
  });
  const courses = coursesQ.data ?? [];

  async function load(course: Course) {
    setBusy(true);
    try {
      const [items, categories] = await Promise.all([
        qc.fetchQuery({
          queryKey: ["course", course.id, "items"],
          queryFn: () => api.get<AcademicItem[]>(`/courses/${course.id}/items`),
          staleTime: 0,
        }),
        qc.fetchQuery({
          queryKey: ["course", course.id, "weights"],
          queryFn: () => api.get<GradeCategory[]>(`/courses/${course.id}/weights`),
          staleTime: 0,
        }),
      ]);
      onLoad(course, buildFromCourse(course, items, categories, nextId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load that course");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoLoaded.current || !ready || coursesQ.data == null) return;
    const wanted = Number(params.get("course"));
    if (!Number.isFinite(wanted) || wanted <= 0) return;
    autoLoaded.current = true;
    const course = coursesQ.data.find((c) => c.id === wanted);
    if (course) {
      setPick(String(course.id));
      load(course);
    }
  }, [ready, coursesQ.data]);

  async function save() {
    if (!loaded) return;
    const target = targetFromState(state);
    if (target === "invalid") {
      toast.error("Target must be between 0 and 150");
      return;
    }
    const { changes, invalid } = pendingChanges(state, loaded.links);
    setBusy(true);
    try {
      const updated = new Map<number, AcademicItem>();
      for (const change of changes) {
        const saved = await api.put<AcademicItem>(`/items/${change.link.item.id}`, change.request);
        updated.set(change.link.item.id, saved);
      }

      let course = loaded.course;
      if (target !== (course.targetGrade ?? null)) {
        course = await api.put<Course>(`/courses/${course.id}/grading`, {
          credits: course.credits ?? null,
          targetGrade: target,
        });
      }

      invalidateItemQueries(qc, course.id);
      onSaved({
        course,
        links: loaded.links.map((l) => ({ ...l, item: updated.get(l.item.id) ?? l.item })),
      });

      const unsaved = unsavedRowCount(state, loaded.links);
      const parts = [
        changes.length > 0 ? `Saved ${changes.length} mark${changes.length === 1 ? "" : "s"}` : "Marks were already up to date",
      ];
      if (invalid > 0) parts.push(`${invalid} mark${invalid === 1 ? "" : "s"} couldn't be read`);
      if (unsaved > 0) {
        parts.push(`${unsaved} new row${unsaved === 1 ? "" : "s"} weren't saved. Add them on the course page.`);
      }
      toast.success(parts.join(". "));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save to the course");
    } finally {
      setBusy(false);
    }
  }

  if (coursesQ.isLoading) return null;

  if (loaded) {
    const unsaved = unsavedRowCount(state, loaded.links);
    return (
      <section className="card flex flex-wrap items-center gap-3 p-4" aria-label="Course link">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-fg">Using {loaded.course.name}</div>
          <p className="mt-0.5 text-[12px] text-fg-3">
            Marks and your target save back to the course. Changes to types and weights stay here.
            {unsaved > 0 &&
              ` ${unsaved} new row${unsaved === 1 ? "" : "s"} won't be saved. Add them on the course page.`}
          </p>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          <Save size={14} />
          {busy ? "Saving…" : "Save to course"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onUnload}>
          <X size={14} />
          Back to my own numbers
        </button>
      </section>
    );
  }

  if (courses.length === 0) return null;

  return (
    <section className="card flex flex-wrap items-center gap-3 p-4" aria-label="Load a course">
      <div className="min-w-0 flex-1 text-[13px] text-fg-2">Load one of your courses to start from its real marks.</div>
      <select
        className="input w-auto"
        aria-label="Course"
        value={pick}
        onChange={(e) => setPick(e.target.value)}
      >
        <option value="">Choose a course</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code ? `${c.code} · ${c.name}` : c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-soft"
        disabled={!pick || busy}
        onClick={() => {
          const course = courses.find((c) => c.id === Number(pick));
          if (course) load(course);
        }}
      >
        <Download size={14} />
        Load
      </button>
    </section>
  );
}
