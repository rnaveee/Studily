import { useState } from "react";
import { ChevronDown } from "lucide-react";
import ExamPlanPanel from "./ExamPlanPanel";
import { dayCountLabel } from "./examFormat";
import type { AcademicItem } from "../../types";

function daysUntil(iso: string): number {
  const now = new Date();
  const due = new Date(iso);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

export default function ExamPlansSection({ items }: { items: AcademicItem[] }) {
  const now = Date.now();
  const exams = items
    .filter((it) => it.type === "EXAM" && it.status !== "DONE" && new Date(it.dueAt).getTime() > now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const [open, setOpen] = useState<number | null>(exams[0]?.id ?? null);

  if (exams.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Study plan</h2>
      <div className="space-y-2">
        {exams.map((exam) => {
          const expanded = open === exam.id;
          return (
            <div key={exam.id} className="card p-4">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : exam.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-fg">{exam.title}</span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-fg-3">
                  {dayCountLabel(daysUntil(exam.dueAt))}
                </span>
                <ChevronDown
                  size={15}
                  className="shrink-0 text-fg-3 transition-transform"
                  style={{ transform: expanded ? "rotate(180deg)" : undefined }}
                />
              </button>
              {expanded && (
                <div className="mt-3">
                  <ExamPlanPanel examId={exam.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
