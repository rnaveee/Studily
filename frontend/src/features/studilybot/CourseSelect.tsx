import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { api } from "../../lib/api";
import type { Course } from "../../types";

export default function CourseSelect({
  value,
  onChange,
  allowNone = true,
  noneLabel = "No course",
  label = "Course",
  disabled = false,
  hideLabel = false,
}: {
  value: number | null;
  onChange: (courseId: number | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  label?: string;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  const id = useId();
  const courses = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
  });
  const list = courses.data ?? [];

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "field-label"}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className="input"
          value={value == null ? "" : String(value)}
          disabled={disabled || courses.isLoading}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          style={{ paddingRight: 32 }}
        >
          {courses.isLoading && <option value="">Loading courses…</option>}
          {!courses.isLoading && allowNone && <option value="">{noneLabel}</option>}
          {!courses.isLoading && !allowNone && value == null && (
            <option value="" disabled>
              Choose a course
            </option>
          )}
          {list.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code ? `${course.code} · ${course.name}` : course.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-3"
        />
      </div>
      {!courses.isLoading && list.length === 0 && (
        <p className="mt-1.5 text-[11px] text-fg-3">Add a course on the Courses page to ground answers in its files.</p>
      )}
    </div>
  );
}
