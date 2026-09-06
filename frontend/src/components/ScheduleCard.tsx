import { useState } from "react";
import { CalendarDays } from "lucide-react";
import ScheduleList from "./ScheduleList";
import SegmentedToggle from "./SegmentedToggle";
import WeekGrid, { coursesToDays } from "./WeekGrid";
import type { Course } from "../types";

type ScheduleView = "list" | "week";

const VIEW_KEY = "studily:scheduleView";

const VIEW_OPTIONS: { value: ScheduleView; label: string }[] = [
  { value: "list", label: "List" },
  { value: "week", label: "Week" },
];

function readView(): ScheduleView {
  try {
    return localStorage.getItem(VIEW_KEY) === "week" ? "week" : "list";
  } catch {
    return "list";
  }
}

function writeView(view: ScheduleView) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* private windows and blocked site data */
  }
}

export default function ScheduleCard({
  courses,
  semesterLabel,
  actions,
}: {
  courses: Course[];
  semesterLabel?: string | null;
  actions?: React.ReactNode;
}) {
  const [view, setView] = useState<ScheduleView>(readView);
  const days = coursesToDays(courses);

  function change(next: ScheduleView) {
    setView(next);
    writeView(next);
  }

  return (
    <div className="card min-w-0">
      <div className="px-5 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
            <CalendarDays size={14} className="text-fg-3" />
            Current semester
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            {semesterLabel && <span className="badge badge-muted">{semesterLabel}</span>}
            {actions}
          </div>
        </div>
        <SegmentedToggle
          className="mt-3 w-full"
          options={VIEW_OPTIONS}
          value={view}
          onChange={change}
        />
      </div>
      {view === "list" ? (
        <ScheduleList courses={courses} />
      ) : (
        <div className="overflow-x-auto px-5 pb-4">
          <WeekGrid days={days} minWidth={days.length * 78 + 46} />
        </div>
      )}
    </div>
  );
}
