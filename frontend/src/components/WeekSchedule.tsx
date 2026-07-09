import { hhmm } from "../lib/format";
import { DAYS } from "../types";
import type { Course, DayOfWeek } from "../types";

const DAY_LABELS: Record<DayOfWeek, string> = {
  SUN: "Sun",
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
};

export default function WeekSchedule({ courses }: { courses: Course[] }) {
  const days = DAYS.map((day) => ({
    day,
    blocks: courses
      .flatMap((course) =>
        course.meetingBlocks
          .filter((b) => b.dayOfWeek === day)
          .map((block) => ({ course, block })),
      )
      .sort((a, b) => a.block.startTime.localeCompare(b.block.startTime)),
  })).filter((d) => d.blocks.length > 0);

  if (days.length === 0) {
    return <p className="px-5 py-4 text-[13px] text-fg-3">No scheduled class times.</p>;
  }

  return (
    <div className="divide-y divide-line">
      {days.map(({ day, blocks }) => (
        <div key={day} className="flex gap-3 px-5 py-2.5">
          <div className="w-9 shrink-0 pt-0.5 text-[11px] font-semibold uppercase text-fg-3">
            {DAY_LABELS[day]}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {blocks.map(({ course, block }) => (
              <div
                key={`${course.id}-${block.dayOfWeek}-${block.startTime}`}
                className="flex items-center gap-2 text-[13px]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: course.color ?? "var(--accent)" }}
                />
                <span className="truncate font-medium text-fg">{course.code || course.name}</span>
                <span className="ml-auto shrink-0 text-[12px] text-fg-3">
                  {hhmm(block.startTime)}–{hhmm(block.endTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
