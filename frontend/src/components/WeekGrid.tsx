import { Link } from "react-router-dom";
import { hhmm } from "../lib/format";
import { DAYS, MEETING_KIND_LABEL } from "../types";
import type { Course, DayOfWeek, ScheduledMeeting } from "../types";

export const GRID_START = 8 * 60;
export const GRID_END = 21 * 60;
export const PX_PER_MIN = 0.7;
export const GRID_HEIGHT = (GRID_END - GRID_START) * PX_PER_MIN;
export const HOURS = Array.from(
  { length: (GRID_END - GRID_START) / 60 + 1 },
  (_, i) => GRID_START / 60 + i,
);

const WEEKDAY_ORDER: DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI"];
const WEEKEND_ORDER: DayOfWeek[] = ["SAT", "SUN"];

const DAY_LABELS: Record<DayOfWeek, string> = {
  SUN: "Sun",
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
};

export function toMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fmtHour(h: number): string {
  if (h === 12) return "12p";
  return h > 12 ? `${h - 12}p` : `${h}a`;
}

export interface WeekGridDay {
  key: string;
  label: string;
  sublabel?: string;
  meetings: ScheduledMeeting[];
}

export function coursesToDays(courses: Course[]): WeekGridDay[] {
  const meetingsFor = (day: DayOfWeek): ScheduledMeeting[] =>
    courses
      .flatMap((course) =>
        (course.meetingBlocks ?? [])
          .filter((b) => b.dayOfWeek === day)
          .map((block) => ({
            courseId: course.id,
            courseName: course.name,
            code: course.code,
            professor: course.professor,
            location: block.location || course.location,
            color: course.color,
            kind: block.kind,
            dayOfWeek: day,
            startTime: block.startTime,
            endTime: block.endTime,
          })),
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const days = WEEKDAY_ORDER.map((day) => ({ day, meetings: meetingsFor(day) }));
  for (const day of WEEKEND_ORDER) {
    const meetings = meetingsFor(day);
    if (meetings.length > 0) days.push({ day, meetings });
  }
  days.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

  return days.map(({ day, meetings }) => ({
    key: day,
    label: DAY_LABELS[day],
    meetings,
  }));
}

interface WeekGridProps {
  days: WeekGridDay[];
  meetingHref?: (m: ScheduledMeeting) => string | null;
  onDayClick?: (key: string) => void;
  activeDayKey?: string | null;
  footer?: React.ReactNode;
  minWidth?: number;
}

export default function WeekGrid({
  days,
  meetingHref,
  onDayClick,
  activeDayKey,
  footer,
  minWidth = 580,
}: WeekGridProps) {
  const columns = `2.5rem repeat(${days.length}, 1fr)`;

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: columns, minWidth }}>
        <div className="border-b border-r border-line" />
        {days.map((day) => {
          const content = (
            <>
              {day.label}
              {day.sublabel && (
                <>
                  <br />
                  <span className="font-normal text-fg-3">{day.sublabel}</span>
                </>
              )}
            </>
          );
          if (!onDayClick) {
            return (
              <div
                key={day.key}
                className="border-b border-l border-line py-2 text-center text-[11px] font-semibold text-fg-2"
              >
                {content}
              </div>
            );
          }
          const active = activeDayKey === day.key;
          return (
            <button
              key={day.key}
              onClick={() => onDayClick(day.key)}
              className={[
                "border-b border-l border-line py-2 text-center text-[11px] font-semibold transition-colors",
                active ? "text-accent" : "text-fg-2 hover:bg-surface-hi hover:text-fg",
              ].join(" ")}
              style={
                active
                  ? { background: "color-mix(in srgb, var(--accent) 8%, transparent)" }
                  : {}
              }
              title="Click to add an item on this day"
            >
              {content}
            </button>
          );
        })}

        <div className="relative border-r border-line" style={{ height: GRID_HEIGHT }}>
          {HOURS.map((h) => (
            <span
              key={h}
              className="absolute right-1 select-none text-[9px] leading-none text-fg-3"
              style={{ top: (h * 60 - GRID_START) * PX_PER_MIN - 5 }}
            >
              {fmtHour(h)}
            </span>
          ))}
        </div>

        {days.map((day) => (
          <div
            key={`body-${day.key}`}
            className="relative border-l border-line"
            style={{ height: GRID_HEIGHT }}
          >
            {HOURS.map((h) => (
              <div
                key={h}
                className="pointer-events-none absolute inset-x-0 border-t border-line"
                style={{ top: (h * 60 - GRID_START) * PX_PER_MIN, opacity: 0.5 }}
              />
            ))}

            {day.meetings.map((m, i) => {
              const clampedStart = Math.max(toMin(m.startTime), GRID_START);
              const clampedEnd = Math.min(toMin(m.endTime), GRID_END);
              const top = (clampedStart - GRID_START) * PX_PER_MIN;
              const height = (clampedEnd - clampedStart) * PX_PER_MIN;
              if (height <= 0) return null;

              const title = `${m.code ? `${m.code} · ` : ""}${m.courseName}${
                m.kind ? ` · ${MEETING_KIND_LABEL[m.kind]}` : ""
              }${m.professor ? ` · ${m.professor}` : ""}${
                m.location ? ` · ${m.location}` : ""
              } ${hhmm(m.startTime)}–${hhmm(m.endTime)}`;

              const body = (
                <>
                  <div className="truncate font-semibold leading-tight">
                    {m.code || m.courseName}
                  </div>
                  {m.kind && (
                    <div className="truncate leading-tight opacity-90">
                      {MEETING_KIND_LABEL[m.kind]}
                    </div>
                  )}
                  {height > 40 && (
                    <div className="leading-tight opacity-75">{hhmm(m.startTime)}</div>
                  )}
                  {m.location && height > 54 && (
                    <div className="leading-tight opacity-75 break-words">{m.location}</div>
                  )}
                </>
              );

              const style = {
                backgroundColor: m.color ?? "var(--accent)",
                top,
                height,
                paddingTop: 2,
              };
              const href = meetingHref?.(m) ?? null;

              return href ? (
                <Link
                  key={`m-${i}`}
                  to={href}
                  className="absolute inset-x-0.5 overflow-hidden rounded px-1 text-[10px] text-white transition-opacity hover:opacity-80"
                  style={style}
                  title={title}
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={`m-${i}`}
                  className="absolute inset-x-0.5 overflow-hidden rounded px-1 text-[10px] text-white"
                  style={style}
                  title={title}
                >
                  {body}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {footer}
    </>
  );
}
