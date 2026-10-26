import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { describeNeeded, formatPercent, gradeColor, type GradeProjection } from "../lib/grades";
import type { Course } from "../types";

function plainNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function NeededGradeText({
  summary,
  target,
  className,
}: {
  summary: GradeProjection;
  target: number | null | undefined;
  className?: string;
}) {
  const result = describeNeeded(summary, target);
  if (result.kind === "unknown" || target == null) return null;
  const remaining = Math.round(result.remaining);

  if (result.kind === "impossible") {
    return (
      <span className={className}>
        <strong className="text-red">A {plainNumber(target)}% is out of reach</strong>. It would take{" "}
        {formatPercent(result.needed!, 0)} on the remaining {remaining}%.
      </span>
    );
  }
  if (result.kind === "safe") {
    return (
      <span className={className}>
        <strong className="text-green">{plainNumber(target)}% is already locked in</strong>. You're safe
        even with 0% on the remaining {remaining}%.
      </span>
    );
  }
  return (
    <span className={className}>
      You need{" "}
      <strong style={{ color: gradeColor(result.needed!) }}>{formatPercent(result.needed!, 0)}</strong> on the
      rest ({remaining}% of the course) to hit your {plainNumber(target)}% target.
    </span>
  );
}

export function useSaveGrading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ course, credits, targetGrade }: {
      course: Pick<Course, "id" | "credits" | "targetGrade">;
      credits?: number | null;
      targetGrade?: number | null;
    }) =>
      api.put<Course>(`/courses/${course.id}/grading`, {
        credits: credits !== undefined ? credits : (course.credits ?? null),
        targetGrade: targetGrade !== undefined ? targetGrade : (course.targetGrade ?? null),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["course", vars.course.id] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["semesters"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save"),
  });
}

function parseField(raw: string, max: number): number | null | "invalid" {
  const text = raw.trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > max) return "invalid";
  return n;
}

export function GradingFields({
  course,
  showCredits = true,
}: {
  course: Pick<Course, "id" | "credits" | "targetGrade">;
  showCredits?: boolean;
}) {
  const save = useSaveGrading();
  const [target, setTarget] = useState(course.targetGrade != null ? String(course.targetGrade) : "");
  const [credits, setCredits] = useState(course.credits != null ? String(course.credits) : "");

  useEffect(() => {
    setTarget(course.targetGrade != null ? String(course.targetGrade) : "");
  }, [course.targetGrade]);
  useEffect(() => {
    setCredits(course.credits != null ? String(course.credits) : "");
  }, [course.credits]);

  function commit(field: "targetGrade" | "credits", raw: string) {
    const value = parseField(raw, field === "targetGrade" ? 150 : 30);
    const current = field === "targetGrade" ? course.targetGrade ?? null : course.credits ?? null;
    if (value === "invalid") {
      toast.error(field === "targetGrade" ? "Target must be between 0 and 150" : "Credits must be between 0 and 30");
      if (field === "targetGrade") setTarget(current != null ? String(current) : "");
      else setCredits(current != null ? String(current) : "");
      return;
    }
    if (value === current) return;
    save.mutate({ course, [field]: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-[12px] text-fg-3">
      <label className="flex items-center gap-1.5">
        Target %
        <input
          className="input py-0.5 text-center"
          style={{ width: "4.5rem", paddingLeft: 6, paddingRight: 6 }}
          type="number"
          inputMode="decimal"
          min={0}
          max={150}
          step="any"
          placeholder="e.g. 80"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onBlur={() => commit("targetGrade", target)}
          aria-label="Target grade"
        />
      </label>
      {showCredits && (
        <label className="flex items-center gap-1.5">
          Credits
          <input
            className="input py-0.5 text-center"
            style={{ width: "4rem", paddingLeft: 6, paddingRight: 6 }}
            type="number"
            inputMode="decimal"
            min={0}
            max={30}
            step="any"
            placeholder="1"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            onBlur={() => commit("credits", credits)}
            aria-label="Course credits"
          />
        </label>
      )}
    </div>
  );
}
