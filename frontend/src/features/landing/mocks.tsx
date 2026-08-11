import { ArrowRight, Bell, CalendarDays, FileText, MessagesSquare } from "lucide-react";
import { demoCourseGrades, demoCourses, demoFlashcardSets, demoItems, demoWeek } from "../../lib/demo";
import { hhmm } from "../../lib/format";
import { MEETING_KIND_LABEL, type DayOfWeek } from "../../types";

const GRID_START = 9 * 60;
const GRID_END = 18 * 60;
const PX_PER_MIN = 0.62;
const GRID_HEIGHT = (GRID_END - GRID_START) * PX_PER_MIN;
const HOURS = Array.from({ length: (GRID_END - GRID_START) / 60 + 1 }, (_, i) => GRID_START / 60 + i);
const WEEKDAYS: DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI"];

function toMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function fmtHour(h: number): string {
  if (h === 12) return "12p";
  return h > 12 ? `${h - 12}p` : `${h}a`;
}

export function Frame({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      {label && (
        <div className="border-b border-line px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-fg-3">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

export function MockWeekGrid() {
  const days = demoWeek().days.filter((d) => WEEKDAYS.includes(d.dayOfWeek));

  return (
    <Frame label="This week">
      <div className="grid pb-2.5" style={{ gridTemplateColumns: "1.9rem repeat(5, 1fr)" }}>
        <div className="border-b border-r border-line" />
        {days.map((day) => (
          <div
            key={day.date}
            className="border-b border-l border-line py-1.5 text-center text-[10px] font-semibold text-fg-2"
          >
            {day.dayOfWeek.charAt(0) + day.dayOfWeek.slice(1, 3).toLowerCase()}
          </div>
        ))}

        <div className="relative border-r border-line" style={{ height: GRID_HEIGHT }}>
          {HOURS.map((h) => (
            <span
              key={h}
              className="absolute right-1 select-none text-[9px] leading-none text-fg-3"
              style={{ top: (h * 60 - GRID_START) * PX_PER_MIN - 4 }}
            >
              {fmtHour(h)}
            </span>
          ))}
        </div>

        {days.map((day) => (
          <div key={day.date} className="relative border-l border-line" style={{ height: GRID_HEIGHT }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="pointer-events-none absolute inset-x-0 border-t border-line"
                style={{ top: (h * 60 - GRID_START) * PX_PER_MIN, opacity: 0.5 }}
              />
            ))}
            {day.meetings.map((m, i) => {
              const top = (Math.max(toMin(m.startTime), GRID_START) - GRID_START) * PX_PER_MIN;
              const height =
                (Math.min(toMin(m.endTime), GRID_END) - Math.max(toMin(m.startTime), GRID_START)) *
                PX_PER_MIN;
              if (height <= 0) return null;
              return (
                <div
                  key={i}
                  className="absolute inset-x-0.5 overflow-hidden rounded px-1 pt-0.5 text-[9px] leading-tight text-white"
                  style={{ backgroundColor: m.color ?? "var(--accent)", top, height }}
                >
                  <div className="truncate font-semibold">{m.code}</div>
                  {height > 34 && m.kind && (
                    <div className="truncate opacity-90">{MEETING_KIND_LABEL[m.kind]}</div>
                  )}
                  {height > 52 && <div className="truncate opacity-80">{m.location}</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function MockToday() {
  const today = demoWeek().days.find((d) => d.meetings.length >= 2) ?? demoWeek().days[1];

  return (
    <Frame label="Today">
      <div className="space-y-1.5 p-3">
        {today.meetings.map((m, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-[11px] text-white"
            style={{ backgroundColor: m.color ?? "var(--accent)", opacity: i === 0 ? 0.45 : 1 }}
          >
            <span className="font-semibold">{m.code}</span>
            {m.kind && <span className="opacity-90">{MEETING_KIND_LABEL[m.kind]}</span>}
            <span className="truncate opacity-80">{m.location}</span>
            <span className="ml-auto shrink-0 tabular-nums opacity-90">
              {hhmm(m.startTime)}–{hhmm(m.endTime)}
            </span>
          </div>
        ))}
        <p className="pt-1 text-[12px] text-accent">Next in 1h 20m</p>
      </div>
    </Frame>
  );
}

export function MockDueList() {
  const now = Date.now();
  const due = demoItems()
    .filter((it) => new Date(it.dueAt).getTime() > now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 4);

  const dayLabel = (iso: string) => {
    const days = Math.max(0, Math.round((new Date(iso).getTime() - now) / 86_400_000));
    return days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  };

  return (
    <Frame label="Due this week">
      <ul className="divide-y divide-line">
        {due.map((it) => (
          <li key={it.id} className="flex items-center gap-2.5 px-3 py-2.5">
            <span
              className="h-8 w-[3px] shrink-0 rounded-full"
              style={{ background: it.type === "EXAM" ? "var(--red)" : "var(--green)" }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-fg">{it.title}</p>
              <p className="truncate text-[11px] text-fg-3">
                {it.courseName}
                {it.weight != null && ` · worth ${it.weight}%`}
              </p>
            </div>
            <span
              className={`badge shrink-0 ${it.type === "EXAM" ? "badge-accent" : "badge-muted"}`}
            >
              {dayLabel(it.dueAt)}
            </span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

export function MockPush() {
  const course = demoCourses()[0];
  const start = hhmm(course.meetingBlocks[0].startTime).replace(/^0/, "");

  return (
    <div
      className="flex items-start gap-2.5 rounded-xl p-3"
      style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
    >
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
      >
        <Bell size={14} strokeWidth={1.8} className="text-accent" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-fg">Class in 1 hour</p>
        <p className="text-[12px] text-fg-2">
          {course.name} starts at {start} AM
        </p>
      </div>
    </div>
  );
}

export function MockGradeCard() {
  const grade = demoCourseGrades().find((c) => c.courseId === 1)!;
  const pct = Math.round(grade.grade ?? 0);
  const remaining = grade.totalWeight - grade.gradedWeight;
  const earned = ((grade.grade ?? 0) / 100) * grade.gradedWeight;
  const needed = Math.ceil(((80 - earned) / remaining) * 100);

  return (
    <Frame label={grade.code ?? undefined}>
      <div className="space-y-3 p-4">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold tabular-nums text-green">{pct}%</span>
          <span className="text-[12px] text-fg-3">
            {grade.gradedCount} of {grade.itemCount} scored
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-hi)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${grade.gradedWeight}%`, background: "var(--accent)" }}
          />
        </div>
        <p className="text-[11px] text-fg-3">{grade.gradedWeight}% of the course graded</p>

        <p
          className="rounded-lg px-3 py-2 text-[12px] text-fg-2"
          style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
        >
          To finish at <span className="font-semibold text-fg">80%</span> you need{" "}
          <span className="font-mono font-semibold text-accent">{needed}%</span> on the remaining{" "}
          {remaining}%.
        </p>
      </div>
    </Frame>
  );
}

const GRADES = [
  { label: "Again", interval: "now" },
  { label: "Hard", interval: "6d" },
  { label: "Good", interval: "3mo" },
  { label: "Easy", interval: "1.2y" },
];

export function MockFlashcard() {
  const deck = demoFlashcardSets()[0];
  const card = deck.cards[0];

  return (
    <Frame label={deck.title}>
      <div className="p-4">
        <div
          className="rounded-xl px-4 py-6 text-center"
          style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
        >
          <p className="text-[12px] text-fg-3">{card.front}</p>
          <p className="mt-2 text-[14px] font-medium text-fg">{card.back}</p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {GRADES.map((g) => (
            <div
              key={g.label}
              className="rounded-lg py-1.5 text-center"
              style={{ border: "1px solid var(--line)" }}
            >
              <div className="text-[11px] font-medium text-fg">{g.label}</div>
              <div className="font-mono text-[10px] text-fg-3">{g.interval}</div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

const SPRAWL = [
  { icon: CalendarDays, label: "Calendar app", note: "class times" },
  { icon: FileText, label: "Notes doc", note: "assignments" },
  { icon: Bell, label: "Reminders", note: "deadlines" },
  { icon: MessagesSquare, label: "Group chat", note: "classmates" },
];

export function MockSprawl() {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
      <div className="grid w-full max-w-[280px] grid-cols-2 gap-2">
        {SPRAWL.map(({ icon: Icon, label, note }) => (
          <div
            key={label}
            className="rounded-xl px-3 py-3 opacity-55"
            style={{ background: "var(--surface-hi)", border: "1px dashed var(--line)" }}
          >
            <Icon size={15} strokeWidth={1.8} className="text-fg-3" />
            <p className="mt-1.5 text-[11px] font-medium text-fg-2">{label}</p>
            <p className="text-[10px] text-fg-3">{note}</p>
          </div>
        ))}
      </div>

      <ArrowRight size={20} className="shrink-0 rotate-90 text-fg-3 sm:rotate-0" />

      <div
        className="w-full max-w-[220px] rounded-xl px-4 py-5 text-center"
        style={{
          background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
          border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
        }}
      >
        <img src="/studily-3a.svg" alt="" className="mx-auto h-9 w-9" />
        <p className="mt-1.5 font-mono text-[15px] font-bold tracking-tight text-fg">Studily</p>
        <p className="mt-1 text-[11px] text-fg-2">All four, wired to the same courses.</p>
      </div>
    </div>
  );
}
