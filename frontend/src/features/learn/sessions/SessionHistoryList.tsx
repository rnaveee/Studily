import { Hourglass, ListChecks, Timer } from "lucide-react";
import { formatMinutes, MODE_LABEL, sessionDate, STATUS_META } from "./sessionFormat";
import type { StudySessionSummaryDto } from "../../../types";

export default function SessionHistoryList({ items }: { items: StudySessionSummaryDto[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((s) => {
        const status = STATUS_META[s.status];
        const Icon = s.mode === "POMODORO" ? Timer : Hourglass;
        return (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--accent) 11%, transparent)" }}
            >
              <Icon size={15} className="text-accent" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-fg">{sessionDate(s.startedAt)}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-fg-3 tabular-nums">
                <span>
                  {MODE_LABEL[s.mode]} · {formatMinutes(s.creditedMinutes)} of {formatMinutes(s.plannedMinutes)}
                </span>
                {s.tasksTotal > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <ListChecks size={11} />
                    {s.tasksDone}/{s.tasksTotal}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`text-[13px] font-semibold tabular-nums ${s.xpAwarded > 0 ? "text-accent" : "text-fg-3"}`}
              >
                +{s.xpAwarded} XP
              </span>
              <span className={`badge ${status.className}`}>{status.label}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
