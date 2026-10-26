import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";
import type { Course, Semester } from "../../types";
import CourseCard, { type CardCourse } from "./CourseCard";

export function useSemesterLabels() {
  const { data } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => api.get<Semester[]>("/semesters"),
  });
  return (id: number | null | undefined) =>
    id == null ? null : (data?.find((s) => s.id === id)?.label ?? null);
}

export function CourseCompare({
  incoming,
  incomingLabel,
  incomingFooter,
  existing,
  existingLabel = "Already in Studily",
}: {
  incoming: CardCourse & { semesterId?: number | null };
  incomingLabel: string;
  incomingFooter?: ReactNode;
  existing: Course;
  existingLabel?: string;
}) {
  const semesterLabel = useSemesterLabels();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="min-w-0">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">{incomingLabel}</p>
        <CourseCard course={incoming} semesterLabel={semesterLabel(incoming.semesterId)} />
        {incomingFooter}
      </div>
      <div className="min-w-0">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">{existingLabel}</p>
        <CourseCard course={existing} semesterLabel={semesterLabel(existing.semesterId)} />
      </div>
    </div>
  );
}

export default function DuplicateCoursePrompt({
  incoming,
  existing,
  busy = false,
  onAddAnyway,
  onUseExisting,
  onClose,
}: {
  incoming: CardCourse & { semesterId?: number | null };
  existing: Course;
  busy?: boolean;
  onAddAnyway: () => void;
  onUseExisting: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title="You may already have this course"
      size="xl"
      variant="sheet"
      footer={
        <>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onAddAnyway}>
            Add anyway
          </button>
          <button type="button" className="btn btn-checkin" disabled={busy} onClick={onUseExisting}>
            Use existing
          </button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-fg-2">
        A course in your account looks like the one you are adding. Use the existing course to avoid
        a duplicate, or add it anyway if it is a different course.
      </p>
      <CourseCompare incoming={incoming} incomingLabel="You are adding" existing={existing} />
    </Modal>
  );
}
