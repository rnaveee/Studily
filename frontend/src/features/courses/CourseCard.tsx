import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { courseLocations, hhmm } from "../../lib/format";
import type { Course } from "../../types";

export type CardCourse = Pick<Course, "name" | "code" | "professor" | "location" | "color" | "meetingBlocks">;

export default function CourseCard({
  course,
  semesterLabel,
  to,
  className = "",
  children,
}: {
  course: CardCourse;
  semesterLabel?: string | null;
  to?: string;
  className?: string;
  children?: ReactNode;
}) {
  const locations = courseLocations(course.meetingBlocks, course.location);
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: course.color ?? "var(--accent)" }}
        />
        <span className="min-w-0 flex-1 truncate font-semibold text-fg">{course.name}</span>
        {course.code && (
          <span className="shrink-0 ml-auto rounded bg-surface-hi px-1.5 py-0.5 text-[11px] font-mono text-fg-3">
            {course.code}
          </span>
        )}
      </div>
      {(course.professor || locations.length > 0) && (
        <p className="mt-1.5 text-[13px] text-fg-2">
          {[course.professor, ...locations].filter(Boolean).join(" · ")}
        </p>
      )}
      {course.meetingBlocks.length > 0 && (
        <p className="mt-1 text-[12px] text-fg-3">
          {course.meetingBlocks
            .map((b) => `${b.dayOfWeek} ${hhmm(b.startTime)}–${hhmm(b.endTime)}`)
            .join("  ·  ")}
        </p>
      )}
      {semesterLabel && (
        <div className="mt-2">
          <span className="badge badge-soft text-[11px]">{semesterLabel}</span>
        </div>
      )}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`card card-lift block p-4 ${className}`}>
        {content}
      </Link>
    );
  }
  return <div className={`card p-4 ${className}`}>{content}</div>;
}
