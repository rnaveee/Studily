import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LineChart } from "lucide-react";
import { api } from "../../lib/api";
import { formatGpa } from "../../lib/gpa";
import { formatPercent, gradeColor } from "../../lib/grades";
import type { Semester, SemesterStats } from "../../types";

export default function GradesCard({ className = "" }: { className?: string }) {
  const statsQ = useQuery({
    queryKey: ["semesters", "stats"],
    queryFn: () => api.get<SemesterStats[]>("/semesters/stats"),
  });
  const currentQ = useQuery({
    queryKey: ["semesters", "current"],
    queryFn: () => api.get<Semester | null>("/semesters/current"),
  });

  const stats = statsQ.data?.find((s) => s.semesterId === currentQ.data?.id) ?? statsQ.data?.[0];

  return (
    <Link to="/grades" className={`card flex items-center gap-3 p-4 transition-colors hover:bg-surface-hi ${className}`}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
      >
        <LineChart size={16} className="text-accent" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-fg">Grades</div>
        <div className="text-[12px] text-fg-3">
          {stats?.termGpa != null
            ? `Term GPA ${formatGpa(stats.termGpa, stats.gpaScale)}`
            : "Track your grades and GPA."}
        </div>
      </div>
      {stats?.average != null && (
        <span
          className="shrink-0 font-mono text-[15px] font-semibold tabular-nums"
          style={{ color: gradeColor(stats.average) }}
        >
          {formatPercent(stats.average, 1)}
        </span>
      )}
    </Link>
  );
}
