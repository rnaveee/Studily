import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { api } from "../../lib/api";
import { describeExamNeeded, formatPercent, gradeColor } from "../../lib/grades";
import { dayCountLabel } from "./examFormat";
import type { UpcomingExam } from "../../types";

function plainNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function ExamNeededText({ exam }: { exam: UpcomingExam }) {
  const result = describeExamNeeded(exam.neededPercent, exam.targetGrade);
  if (result.kind === "unknown" || exam.targetGrade == null) return null;
  const target = plainNumber(exam.targetGrade);
  if (result.kind === "impossible") {
    return (
      <span>
        <strong className="text-red">{formatPercent(result.needed!, 0)}</strong> needed, out of reach for your{" "}
        {target}% target
      </span>
    );
  }
  if (result.kind === "safe") {
    return (
      <span>
        <strong className="text-green">{target}% target is safe</strong> whatever you score
      </span>
    );
  }
  return (
    <span>
      Need <strong style={{ color: gradeColor(result.needed!) }}>{formatPercent(result.needed!, 0)}</strong> to hit
      your {target}% target
    </span>
  );
}

function urgencyColor(daysLeft: number): string {
  if (daysLeft <= 1) return "var(--red)";
  if (daysLeft <= 3) return "var(--orange)";
  return "var(--fg-2)";
}

export default function ExamsCard({ semesterId }: { semesterId?: number | null }) {
  const examsQ = useQuery({
    queryKey: ["exams", "upcoming", semesterId ?? null],
    queryFn: () =>
      api.get<UpcomingExam[]>(semesterId != null ? `/exams/upcoming?semesterId=${semesterId}` : "/exams/upcoming"),
  });

  const exams = examsQ.data ?? [];
  if (exams.length === 0) return null;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <GraduationCap size={16} className="text-accent" />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-fg">Upcoming exams</div>
          <div className="text-[12px] text-fg-3">Tap one to build a study plan.</div>
        </div>
      </div>
      <ul className="space-y-1.5">
        {exams.map((exam) => (
          <li key={exam.id}>
            <Link
              to={`/courses/${exam.courseId}`}
              className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-hi"
            >
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: exam.courseColor ?? "var(--accent)" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[13px] font-medium text-fg">{exam.title}</span>
                  <span
                    className="shrink-0 text-[12.5px] font-semibold tabular-nums"
                    style={{ color: urgencyColor(exam.daysLeft) }}
                  >
                    {dayCountLabel(exam.daysLeft)}
                  </span>
                </div>
                <div className="truncate text-[11.5px] text-fg-3">
                  {exam.courseCode ?? exam.courseName}
                  {exam.weight != null && <> · {plainNumber(exam.weight)}% of grade</>}
                  {exam.linkedSets + exam.linkedTodos > 0 && (
                    <> · plan: {exam.linkedSets} {exam.linkedSets === 1 ? "set" : "sets"}, {exam.linkedTodos}{" "}
                    {exam.linkedTodos === 1 ? "task" : "tasks"}</>
                  )}
                </div>
                <div className="text-[11.5px] text-fg-2">
                  <ExamNeededText exam={exam} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
