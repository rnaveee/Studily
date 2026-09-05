import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, CalendarDays, FileText, MessagesSquare } from "lucide-react";
import { demoCourseGrades, demoCourses, demoFlashcardSets, demoItems, demoWeek } from "../../lib/demo";
import { hhmm } from "../../lib/format";
import { revealClass, useReveal } from "../../lib/useReveal";
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

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function useCountUp(target: number, active: boolean, duration = 900): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    if (reducedMotion()) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, active, duration]);

  return value;
}

export function Frame({
  label,
  meta,
  large = false,
  children,
}: {
  label?: string;
  meta?: string;
  large?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`frame frame-hover overflow-hidden ${large ? "frame-lg" : ""}`}>
      {label && (
        <div className="flex items-center gap-2 border-b border-line px-3.5 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" style={{ opacity: 0.55 }} />
          <span className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-fg-3">
            {label}
          </span>
          {meta && (
            <span className="ml-auto text-[10.5px] tabular-nums text-fg-3">{meta}</span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function MockWeekGrid({ large = false }: { large?: boolean }) {
  const days = demoWeek().days.filter((d) => WEEKDAYS.includes(d.dayOfWeek));
  const { ref, inView } = useReveal<HTMLDivElement>();

  return (
    <div ref={ref}>
      <Frame label="This week" meta="9a – 6p" large={large}>
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
                className="absolute right-1 select-none text-[9px] leading-none tabular-nums text-fg-3"
                style={{ top: (h * 60 - GRID_START) * PX_PER_MIN - 4 }}
              >
                {fmtHour(h)}
              </span>
            ))}
          </div>

          {days.map((day, dayIndex) => (
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
                    className={`absolute inset-x-0.5 overflow-hidden rounded px-1 pt-0.5 text-[9px] leading-tight text-white ${revealClass(inView)}`}
                    style={
                      {
                        backgroundColor: m.color ?? "var(--accent)",
                        top,
                        height,
                        "--reveal-delay": `${dayIndex * 70 + i * 40}ms`,
                      } as React.CSSProperties
                    }
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
    </div>
  );
}

export function MockToday() {
  const today = demoWeek().days.find((d) => d.meetings.length >= 2) ?? demoWeek().days[1];
  const { ref, inView } = useReveal<HTMLDivElement>();

  return (
    <div ref={ref}>
      <Frame label="Today">
        <div className="space-y-1.5 p-3">
          {today.meetings.map((m, i) => (
            <div
              key={i}
              className={revealClass(inView)}
              style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}
            >
              <div
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
            </div>
          ))}
          <p className="pt-1 text-[12px] tabular-nums text-accent">Next in 1h 20m</p>
        </div>
      </Frame>
    </div>
  );
}

export function MockDueList() {
  const now = Date.now();
  const { ref, inView } = useReveal<HTMLDivElement>();
  const due = demoItems()
    .filter((it) => new Date(it.dueAt).getTime() > now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 4);

  const dayLabel = (iso: string) => {
    const days = Math.max(0, Math.round((new Date(iso).getTime() - now) / 86_400_000));
    return days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  };

  return (
    <div ref={ref}>
      <Frame label="Due this week" meta={`${due.length} items`}>
        <ul className="divide-y divide-line">
          {due.map((it, i) => (
            <li
              key={it.id}
              className={`flex items-center gap-2.5 px-3 py-2.5 ${revealClass(inView)}`}
              style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}
            >
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
    </div>
  );
}

export function MockPush() {
  const course = demoCourses()[0];
  const start = hhmm(course.meetingBlocks[0].startTime).replace(/^0/, "");
  const { ref, inView } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`flex items-start gap-2.5 rounded-xl p-3 ${revealClass(inView, "scale")}`}
      style={
        {
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-md)",
          "--reveal-delay": "260ms",
        } as React.CSSProperties
      }
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
      <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-fg-3">now</span>
    </div>
  );
}

export function MockGradeCard() {
  const grade = demoCourseGrades().find((c) => c.courseId === 1)!;
  const pct = Math.round(grade.grade ?? 0);
  const remaining = grade.totalWeight - grade.gradedWeight;
  const earned = ((grade.grade ?? 0) / 100) * grade.gradedWeight;
  const needed = Math.ceil(((80 - earned) / remaining) * 100);

  const { ref, inView } = useReveal<HTMLDivElement>();
  const shown = useCountUp(pct, inView);

  return (
    <div ref={ref}>
      <Frame label={grade.code ?? undefined} meta={`${grade.gradedCount}/${grade.itemCount} scored`}>
        <div className="space-y-3 p-4">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold tabular-nums tracking-tight text-green">
              {Math.round(shown)}%
            </span>
            <span className="text-[12px] text-fg-3">
              {grade.gradedCount} of {grade.itemCount} scored
            </span>
          </div>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--surface-hi)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: inView ? `${grade.gradedWeight}%` : "0%",
                background: "var(--accent)",
                transition: reducedMotion()
                  ? "none"
                  : "width 1s cubic-bezier(0.22, 0.61, 0.36, 1) 120ms",
              }}
            />
          </div>
          <p className="text-[11px] tabular-nums text-fg-3">
            {grade.gradedWeight}% of the course graded
          </p>

          <p
            className={`rounded-lg px-3 py-2 text-[12px] text-fg-2 ${revealClass(inView)}`}
            style={
              {
                background: "color-mix(in srgb, var(--accent) 8%, transparent)",
                "--reveal-delay": "620ms",
              } as React.CSSProperties
            }
          >
            To finish at <span className="font-semibold text-fg">80%</span> you need{" "}
            <span className="font-mono font-semibold tabular-nums text-accent">{needed}%</span> on the
            remaining {remaining}%.
          </p>
        </div>
      </Frame>
    </div>
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
  const { ref, inView } = useReveal<HTMLDivElement>();
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) {
      setFlipped(true);
      return;
    }
    const t = setTimeout(() => setFlipped(true), 620);
    return () => clearTimeout(t);
  }, [inView]);

  return (
    <div ref={ref}>
      <Frame label={deck.title} meta="1 of 24">
        <div className="p-4">
          <div
            className="flex min-h-[104px] flex-col items-center justify-center rounded-xl px-4 py-6 text-center"
            style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
          >
            <p className="text-[12px] text-fg-3">{card.front}</p>
            <p
              className="mt-2 text-[14px] font-medium text-fg"
              style={{
                opacity: flipped ? 1 : 0,
                transform: flipped ? "none" : "translateY(4px)",
                transition: reducedMotion()
                  ? "none"
                  : "opacity 0.35s ease-out, transform 0.35s ease-out",
              }}
            >
              {card.back}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {GRADES.map((g, i) => (
              <div
                key={g.label}
                className={`rounded-lg py-1.5 text-center ${revealClass(inView)}`}
                style={
                  {
                    border: "1px solid var(--line)",
                    "--reveal-delay": `${820 + i * 55}ms`,
                  } as React.CSSProperties
                }
              >
                <div className="text-[11px] font-medium text-fg">{g.label}</div>
                <div className="font-mono text-[10px] tabular-nums text-fg-3">{g.interval}</div>
              </div>
            ))}
          </div>
        </div>
      </Frame>
    </div>
  );
}

const SPRAWL = [
  { icon: CalendarDays, label: "Calendar app", note: "class times" },
  { icon: FileText, label: "Notes doc", note: "assignments" },
  { icon: Bell, label: "Reminders", note: "deadlines" },
  { icon: MessagesSquare, label: "Group chat", note: "classmates" },
];

export function MockSprawl() {
  const { ref, inView } = useReveal<HTMLDivElement>();

  return (
    <div ref={ref} className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
      <div className="grid w-full max-w-[280px] grid-cols-2 gap-2">
        {SPRAWL.map(({ icon: Icon, label, note }, i) => (
          <div
            key={label}
            className={revealClass(inView)}
            style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
          >
            <div
              className="rounded-xl px-3 py-3 opacity-55"
              style={{ background: "var(--surface-hi)", border: "1px dashed var(--line)" }}
            >
              <Icon size={15} strokeWidth={1.8} className="text-fg-3" />
              <p className="mt-1.5 text-[11px] font-medium text-fg-2">{label}</p>
              <p className="text-[10px] text-fg-3">{note}</p>
            </div>
          </div>
        ))}
      </div>

      <div
        className={`shrink-0 ${revealClass(inView)}`}
        style={{ "--reveal-delay": "380ms" } as React.CSSProperties}
      >
        <ArrowRight size={20} className="rotate-90 text-fg-3 sm:rotate-0" />
      </div>

      <div
        className={`w-full max-w-[220px] rounded-xl px-4 py-5 text-center ${revealClass(inView, "scale")}`}
        style={
          {
            background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
            border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
            boxShadow: "var(--shadow-md)",
            "--reveal-delay": "480ms",
          } as React.CSSProperties
        }
      >
        <img src="/studily-3a.svg" alt="" className="mx-auto h-9 w-9" />
        <p className="mt-1.5 font-mono text-[15px] font-bold tracking-tight text-fg">Studily</p>
        <p className="mt-1 text-[11px] text-fg-2">All four, wired to the same courses.</p>
      </div>
    </div>
  );
}
