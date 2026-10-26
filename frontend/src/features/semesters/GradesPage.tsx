import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Calculator } from "lucide-react";
import BackButton from "../../components/BackButton";
import GpaScalePicker from "../../components/GpaScalePicker";
import { GradingFields, NeededGradeText } from "../../components/NeededGrade";
import { SkeletonList } from "../../components/Skeleton";
import { api } from "../../lib/api";
import { formatGpa, formatPoints } from "../../lib/gpa";
import { courseGrade, formatPercent, gradeColor, runningGrades } from "../../lib/grades";
import { staggerDelay } from "../../lib/motion";
import type {
  AcademicItem,
  Course,
  CourseGrade,
  GpaScaleName,
  GradeCategory,
  Semester,
  SemesterStats,
} from "../../types";

export default function GradesPage() {
  const [picked, setPicked] = useState<number | null>(null);

  const semestersQ = useQuery({
    queryKey: ["semesters"],
    queryFn: () => api.get<Semester[]>("/semesters"),
  });
  const currentQ = useQuery({
    queryKey: ["semesters", "current"],
    queryFn: () => api.get<Semester | null>("/semesters/current"),
  });
  const coursesQ = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
  });
  const statsQ = useQuery({
    queryKey: ["semesters", "stats"],
    queryFn: () => api.get<SemesterStats[]>("/semesters/stats"),
  });

  const semesters = semestersQ.data ?? [];
  const semesterId =
    picked ?? currentQ.data?.id ?? semesters[0]?.id ?? null;
  const stats = statsQ.data?.find((s) => s.semesterId === semesterId);
  const scale: GpaScaleName = stats?.gpaScale ?? statsQ.data?.[0]?.gpaScale ?? "FOUR_POINT";
  const courses = (coursesQ.data ?? []).filter((c) => c.semesterId === semesterId);
  const loading = semestersQ.isLoading || coursesQ.isLoading || statsQ.isLoading;

  return (
    <div className="space-y-4">
      <div className="stagger-item flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallback="/semesters" />
          <h1 className="text-xl font-semibold text-fg">Grades</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {semesters.length > 0 && (
            <select
              className="input w-auto"
              aria-label="Semester"
              value={semesterId ?? ""}
              onChange={(e) => setPicked(Number(e.target.value))}
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
          <GpaScalePicker />
        </div>
      </div>

      <div className="stagger-item grid grid-cols-2 gap-3" style={staggerDelay(1)}>
        <GpaTile label="Term GPA" value={formatGpa(stats?.termGpa, scale)} />
        <GpaTile label="Cumulative GPA" value={formatGpa(stats?.cumulativeGpa, scale)} />
      </div>
      {stats?.creditsMissing && (
        <p className="text-[12px] text-fg-3">
          Add credits for an accurate GPA. Courses without credits count as 1.
        </p>
      )}

      {loading ? (
        <SkeletonList rows={3} />
      ) : courses.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-fg-3">
            No courses in this semester yet.{" "}
            <Link to="/courses" className="text-accent hover:text-accent-2 transition-colors">
              Add one
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {courses.map((course, i) => (
            <CourseGradeCard
              key={course.id}
              course={course}
              grade={stats?.courses.find((g) => g.courseId === course.id)}
              scale={scale}
              index={i}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function GpaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">{label}</div>
      <div className="mt-1 font-mono text-[28px] font-bold leading-none tabular-nums text-fg">{value}</div>
    </div>
  );
}

function CourseGradeCard({
  course,
  grade,
  scale,
  index,
}: {
  course: Course;
  grade?: CourseGrade;
  scale: GpaScaleName;
  index: number;
}) {
  const itemsQ = useQuery({
    queryKey: ["course", course.id, "items"],
    queryFn: () => api.get<AcademicItem[]>(`/courses/${course.id}/items`),
  });
  const weightsQ = useQuery({
    queryKey: ["course", course.id, "weights"],
    queryFn: () => api.get<GradeCategory[]>(`/courses/${course.id}/weights`),
  });

  const items = itemsQ.data;
  const categories = weightsQ.data;
  const summary = useMemo(
    () => (items && categories ? courseGrade(items, categories) : null),
    [items, categories],
  );
  const series = useMemo(
    () => (items && categories ? runningGrades(items, categories) : []),
    [items, categories],
  );

  const percent = grade?.grade ?? null;

  return (
    <li className="stagger-item card p-4" style={staggerDelay(index + 2, 45)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: course.color ?? "var(--accent)" }}
            />
            <Link
              to={`/courses/${course.id}`}
              className="min-w-0 truncate text-[14px] font-medium text-fg hover:text-accent transition-colors"
            >
              {course.name}
            </Link>
            {course.code && <span className="shrink-0 text-[11px] text-fg-3">{course.code}</span>}
          </div>

          {percent == null ? (
            <p className="mt-2 text-[12px] text-fg-3">No scores yet.</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className="font-mono text-[26px] font-bold leading-none tabular-nums"
                style={{ color: gradeColor(percent) }}
              >
                {formatPercent(percent, 1)}
              </span>
              <span className="text-[14px] font-semibold text-fg">{grade?.letter}</span>
              <span className="text-[12px] text-fg-3">
                {formatPoints(grade?.points, scale)}
                {scale === "UBC_PERCENT" ? "" : " pts"}
                {course.credits != null ? ` · ${course.credits} cr` : ""}
              </span>
            </div>
          )}
        </div>
        <Sparkline values={series} />
      </div>

      <div className="mt-3 space-y-1.5 border-t border-line pt-3">
        <GradingFields course={course} />
        {summary && summary.gradedWeight > 0 && course.targetGrade != null && (
          <p className="text-[12px] text-fg-2">
            <NeededGradeText summary={summary} target={course.targetGrade} />
          </p>
        )}
        {course.credits == null && (
          <p className="text-[11px] text-fg-3">Add credits for an accurate GPA.</p>
        )}
        <Link
          to={`/grade-calculator?course=${course.id}`}
          className="inline-flex items-center gap-1 text-[12px] text-accent hover:text-accent-2 transition-colors"
        >
          <Calculator size={12} />
          Open in the grade calculator
        </Link>
      </div>
    </li>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const width = 96;
  const height = 36;
  const pad = 3;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, 5);
  const mid = (hi + lo) / 2;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height / 2 - ((v - mid) / span) * (height - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      role="img"
      aria-label={`Grade trend: ${formatPercent(values[0], 0)} to ${formatPercent(last, 0)}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={gradeColor(last)}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(values.length - 1)} cy={y(last)} r={2.5} fill={gradeColor(last)} />
    </svg>
  );
}
