import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { X, BookOpen, CalendarDays, Brain, User } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth, useRequireAuth } from "../../lib/auth";
import { countdown, formatDateTime, hhmm } from "../../lib/format";
import {
  DAYS,
  type AcademicItem,
  type AcademicItemRequest,
  type Course,
  type Semester,
  type WeekView,
} from "../../types";
import ItemForm from "../../components/ItemForm";
import { quoteOfTheDay } from "./quotes";

const GRID_START = 8 * 60;
const GRID_END   = 21 * 60;
const PX_PER_MIN = 0.7;
const GRID_HEIGHT = (GRID_END - GRID_START) * PX_PER_MIN;
const HOURS = Array.from(
  { length: (GRID_END - GRID_START) / 60 + 1 },
  (_, i) => GRID_START / 60 + i
);

function toMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function fmtHour(h: number): string {
  if (h === 12) return "12p";
  return h > 12 ? `${h - 12}p` : `${h}a`;
}

function fmtCountdown(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtWeekRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(s + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function MiniMonth({ marked }: { marked: Set<string> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lead = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const iso = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div className="mx-auto mt-4 max-w-xs">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-fg-3">
        {monthLabel}
      </p>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px]">
        {WEEKDAY_LETTERS.map((d, i) => (
          <span key={`h-${i}`} className="font-medium text-fg-3">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const isToday = day === now.getDate();
          return (
            <span key={day} className="relative mx-auto flex h-6 w-6 items-center justify-center">
              <span
                className={[
                  "flex h-5.5 w-5.5 items-center justify-center rounded-full tabular-nums",
                  isToday ? "bg-accent font-semibold text-white" : "text-fg-2",
                ].join(" ")}
              >
                {day}
              </span>
              {marked.has(iso(day)) && !isToday && (
                <span className="absolute bottom-0 h-1 w-1 rounded-full bg-accent" />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const firstName = user?.name?.split(" ")[0] ?? user?.username ?? "";
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [addingDay, setAddingDay] = useState<string | null>(null);

  const { data: semesters } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => api.get<Semester[]>("/semesters"),
  });

  const { data: courses } = useQuery({
    queryKey: ["courses", semesterId],
    queryFn: () =>
      api.get<Course[]>(semesterId != null ? `/courses?semesterId=${semesterId}` : "/courses"),
  });

  const params = semesterId != null ? `?semesterId=${semesterId}` : "";
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "week", semesterId],
    queryFn: () => api.get<WeekView>(`/dashboard/week${params}`),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const createItem = useMutation({
    mutationFn: ({ courseId, req }: { courseId: number; req: AcademicItemRequest }) =>
      api.post<AcademicItem>(`/courses/${courseId}/items`, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setAddingDay(null);
    },
  });

  const courseList = useMemo(
    () => (courses ?? []).map((c) => ({ id: c.id, name: c.name })),
    [courses]
  );

  const quote = quoteOfTheDay();

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayData = data?.days.find((d) => d.date === todayStr);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const nextMeeting = todayData?.meetings
    .filter((m) => toMin(m.startTime) > nowMin)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime))[0];
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-4 animate-in">
      {quote && (
        <p className="text-[13px] italic font-semibold text-fg-2">
          "{quote.quote}" <span className="not-italic">— {quote.author}</span>
        </p>
      )}

      <div>
        <h1 className="text-3xl font-bold text-fg">{firstName ? `${greeting()}, ${firstName}` : greeting()}</h1>
        <p className="mt-1 text-sm text-fg-3">Here's your weekly schedule</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {semesters && semesters.length > 0 && (
          <select
            className="input w-auto"
            value={semesterId ?? ""}
            onChange={(e) => setSemesterId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Auto (current semester)</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        )}
        {data?.semester && (
          <span className="badge badge-accent">{data.semester.label}</span>
        )}
        {data?.nextExam && (
          <span className="badge badge-soft">
            Next exam: {data.nextExam.title} · {countdown(data.nextExam.dueAt)}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-fg-3">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
          Loading…
        </div>
      )}
      {error && <p className="text-sm text-red">Failed to load dashboard.</p>}

      {data && (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
            <div className="card p-4 md:w-56 md:shrink-0">
              <p className="mb-3 text-[15px] font-semibold text-fg md:text-[11px] md:uppercase md:tracking-wider md:text-fg-3">
                Today, {todayLabel}
              </p>

              {todayData && todayData.meetings.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 md:flex-col">
                    {todayData.meetings.map((m, i) => {
                      const done = toMin(m.endTime) < nowMin;
                      return (
                        <Link
                          key={i}
                          to={`/courses/${m.courseId}`}
                          className="flex items-start gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-80"
                          style={{
                            backgroundColor: m.color ?? "var(--accent)",
                            opacity: done ? 0.45 : 1,
                          }}
                        >
                          <span className="flex-1 leading-snug">{m.courseName}</span>
                          <span className="shrink-0 whitespace-nowrap text-[11px] opacity-80 mt-0.5">{hhmm(m.startTime)}–{hhmm(m.endTime)}</span>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    {nextMeeting ? (
                      <span className="text-[12px] text-accent">
                        Next in {fmtCountdown(toMin(nextMeeting.startTime) - nowMin)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-fg-3">No more classes today</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-fg-3">No classes today.</p>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[12px] font-medium uppercase tracking-wider text-fg-3">
                This week · {fmtWeekRange(data.weekStart, data.weekEnd)}
              </p>

          <div className="card overflow-x-auto">
            {addingDay && (
              <div className="border-b border-line px-4 py-3 animate-slide">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-fg">
                    Add item — {addingDay}
                  </span>
                  <button
                    onClick={() => setAddingDay(null)}
                    className="rounded p-0.5 text-fg-3 transition-colors hover:text-fg"
                  >
                    <X size={13} />
                  </button>
                </div>
                {courseList.length === 0 ? (
                  <p className="text-[13px] text-fg-3">
                    No courses yet —{" "}
                    <Link to="/courses" className="text-accent hover:text-accent-2 transition-colors">
                      add one first
                    </Link>.
                  </p>
                ) : (
                  <ItemForm
                    courses={courseList}
                    initialDate={addingDay}
                    onSubmit={(courseId, req) => createItem.mutateAsync({ courseId, req })}
                    onCancel={() => setAddingDay(null)}
                  />
                )}
              </div>
            )}

            <div className="grid min-w-[580px]" style={{ gridTemplateColumns: "2.5rem repeat(7, 1fr)" }}>
              <div className="border-b border-r border-line" />
              {data.days.map((day, idx) => (
                <button
                  key={day.date}
                  onClick={() => requireAuth(() => setAddingDay((d) => d === day.date ? null : day.date))}
                  className={[
                    "border-b border-l border-line py-2 text-center text-[11px] font-semibold transition-colors",
                    addingDay === day.date
                      ? "text-accent"
                      : "text-fg-2 hover:bg-surface-hi hover:text-fg",
                  ].join(" ")}
                  style={addingDay === day.date
                    ? { background: "color-mix(in srgb, var(--accent) 8%, transparent)" }
                    : {}}
                  title="Click to add an item on this day"
                >
                  {DAYS[idx]}
                  <br />
                  <span className="font-normal text-fg-3">{day.date.slice(5)}</span>
                </button>
              ))}

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

              {data.days.map((day) => (
                <div
                  key={`body-${day.date}`}
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
                    const startMin = toMin(m.startTime);
                    const endMin = toMin(m.endTime);
                    const clampedStart = Math.max(startMin, GRID_START);
                    const clampedEnd = Math.min(endMin, GRID_END);
                    const top = (clampedStart - GRID_START) * PX_PER_MIN;
                    const height = (clampedEnd - clampedStart) * PX_PER_MIN;
                    if (height <= 0) return null;
                    return (
                      <Link
                        key={`m-${i}`}
                        to={`/courses/${m.courseId}`}
                        className="absolute inset-x-0.5 overflow-hidden rounded px-1 text-[10px] text-white transition-opacity hover:opacity-80"
                        style={{ backgroundColor: m.color ?? "var(--accent)", top, height, paddingTop: 2 }}
                        title={`${m.code ? `${m.code} · ` : ""}${m.courseName}${m.professor ? ` · ${m.professor}` : ""} ${hhmm(m.startTime)}–${hhmm(m.endTime)}`}
                      >
                        <div className="truncate font-semibold leading-tight">{m.code || m.courseName}</div>
                        {m.code && height > 38 && (
                          <div className="truncate leading-tight opacity-90">{m.courseName}</div>
                        )}
                        {height > 26 && (
                          <div className="truncate leading-tight opacity-75">{hhmm(m.startTime)}</div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            {data.days.some((d) => d.items.length > 0) && (
              <div className="grid border-t border-line" style={{ gridTemplateColumns: "2.5rem repeat(7, 1fr)" }}>
                <div className="border-r border-line px-1 py-1 text-[8px] font-semibold uppercase tracking-widest text-fg-3">
                  due
                </div>
                {data.days.map((day) => (
                  <div key={`items-${day.date}`} className="min-h-5 space-y-0.5 border-l border-line px-0.5 py-0.5">
                    {day.items.map((it) => (
                      <Link
                        key={it.id}
                        to={`/courses/${it.courseId}`}
                        className="block truncate rounded-sm border-l-2 px-1 py-0.5 text-[9px] leading-tight transition-opacity hover:opacity-75"
                        style={{
                          borderColor: it.type === "EXAM" ? "var(--red)" : "var(--green)",
                          background: it.type === "EXAM"
                            ? "color-mix(in srgb, var(--red) 10%, transparent)"
                            : "color-mix(in srgb, var(--green) 10%, transparent)",
                          color: "var(--fg-2)",
                        }}
                        title={`${it.title} · ${it.courseName} · due ${formatDateTime(it.dueAt)}`}
                      >
                        {it.title}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
              Due this week
            </h2>
            {data.dueThisWeek.length === 0 ? (
              <p className="text-sm text-fg-3">Nothing due. Enjoy it.</p>
            ) : (
              <ul className="card divide-y divide-line">
                {data.dueThisWeek.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <div className="min-w-0 flex-1 truncate">
                      <Link to={`/courses/${it.courseId}`} className="font-medium text-fg hover:text-accent transition-colors">
                        {it.title}
                      </Link>
                      <span className="ml-2 text-fg-3">· {it.courseName}</span>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-fg-3 tabular-nums">{formatDateTime(it.dueAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link to="/calendar" className="card block p-4 transition-colors hover:bg-surface-hi">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
                <CalendarDays size={16} className="text-accent" />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-fg">Calendar</div>
                <div className="text-[12px] text-fg-3">See and plan your full calendar.</div>
              </div>
            </div>
            <MiniMonth marked={new Set(data.dueThisWeek.map((it) => it.dueAt.slice(0, 10)))} />
          </Link>

          <div>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
              Explore
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link to="/courses" className="card flex items-center gap-3 p-4 transition-colors hover:bg-surface-hi">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
                  <BookOpen size={16} className="text-accent" />
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-fg">Courses</div>
                  <div className="text-[12px] text-fg-3">Set your courses for this semester.</div>
                </div>
              </Link>
              <Link to="/learn" className="card flex items-center gap-3 p-4 transition-colors hover:bg-surface-hi">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
                  <Brain size={16} className="text-accent" />
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-fg">Learn</div>
                  <div className="text-[12px] text-fg-3">Improve your learning in your classes.</div>
                </div>
              </Link>
              <Link to="/profile" className="card flex items-center gap-3 p-4 transition-colors hover:bg-surface-hi">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
                  <User size={16} className="text-accent" />
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-fg">Profile</div>
                  <div className="text-[12px] text-fg-3">Set your profile to connect with others.</div>
                </div>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
