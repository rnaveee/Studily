import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  X,
  BookOpen,
  CalendarDays,
  CalendarClock,
  CalendarCheck,
  Brain,
  User,
  ArrowRight,
  Pencil,
  Percent,
} from "lucide-react";
import { api } from "../../lib/api";
import { useAuth, useRequireAuth } from "../../lib/auth";
import { dueUrgency, formatDateTime, hhmm } from "../../lib/format";
import { itemColor } from "../../lib/itemType";
import { staggerDelay } from "../../lib/motion";
import {
  DAYS,
  MEETING_KIND_LABEL,
  type AcademicItem,
  type AcademicItemRequest,
  type Course,
  type Semester,
  type OnboardingStatus,
  type Todo,
  type WeekView,
} from "../../types";
import ItemForm from "../../components/ItemForm";
import ItemModal from "../courses/ItemModal";
import WeekGrid, { toMin } from "../../components/WeekGrid";
import { SkeletonBlock } from "../../components/Skeleton";
import TodoQuickView from "../todos/TodoQuickView";
import { priorityLabel, priorityTone } from "../todos/priority";
import DashboardStreak from "./DashboardStreak";
import GradesCard from "./GradesCard";
import ExamsCard, { useUpcomingExams } from "../exams/ExamsCard";
import { quoteOfTheDay } from "./quotes";
import QueryError from "../../components/QueryError";
import { readableOn } from "../../lib/courseColors";



function SetupNudge() {
  const { user, guest } = useAuth();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("studily.setupNudge") === "off",
  );

  const statusQ = useQuery({
    queryKey: ["onboarding"],
    queryFn: () => api.get<OnboardingStatus>("/me/onboarding"),
    enabled: !!user && !guest,
  });

  const status = statusQ.data;
  if (!status || status.complete || dismissed) return null;

  function dismiss() {
    localStorage.setItem("studily.setupNudge", "off");
    setDismissed(true);
  }

  return (
    <div className="card flex items-center gap-3 p-3 animate-in">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-fg">Finish setting up</span>
          <span className="text-[11px] text-fg-3">
            {status.completed} of {status.total}
          </span>
        </div>
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-full"
          style={{ background: "var(--surface-hi)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(status.completed / status.total) * 100}%`,
              background: "var(--accent)",
            }}
          />
        </div>
      </div>
      <Link to="/onboarding" className="btn btn-soft shrink-0">
        Continue
        <ArrowRight size={13} strokeWidth={2} />
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded p-1 text-fg-3 transition-colors hover:text-fg"
      >
        <X size={13} />
      </button>
    </div>
  );
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
    <div className="mx-auto mt-3 max-w-xs">
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

interface DueEntry {
  key: string;
  dueAt: string;
  item?: AcademicItem;
  todo?: Todo;
}

const EXPLORE = [
  { to: "/courses", icon: BookOpen, title: "Courses", color: "var(--green)", description: "Set your courses for this semester." },
  { to: "/learn", icon: Brain, title: "Study", color: "var(--accent)", description: "Improve your learning in your classes." },
  { to: "/grade-calculator", icon: Percent, title: "Grade calculator", color: "var(--blue-vivid)", description: "See what you need on your final." },
  { to: "/profile", icon: User, title: "Profile", color: "var(--orange-vivid)", description: "Set your profile to connect with others." },
];

function badgeStyle(color: string): React.CSSProperties {
  return {
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    color,
  };
}

export default function DashboardPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const firstName = user?.name?.split(" ")[0] ?? user?.username ?? "";
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<AcademicItem | null>(null);

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
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", "week", semesterId],
    queryFn: () => api.get<WeekView>(`/dashboard/week${params}`),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const hasExams = (useUpcomingExams(semesterId).data?.length ?? 0) > 0;

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

  const dueThisWeek = useMemo<DueEntry[]>(() => {
    if (!data) return [];
    const entries: DueEntry[] = [
      ...data.dueThisWeek.map((item) => ({ key: `item-${item.id}`, dueAt: item.dueAt, item })),
      ...data.todosDueThisWeek.map((todo) => ({ key: `todo-${todo.id}`, dueAt: todo.dueAt!, todo })),
    ];
    return entries.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }, [data]);

  const quote = quoteOfTheDay();

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayData = data?.days.find((d) => d.date === todayStr);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const nextMeeting = todayData?.meetings
    .filter((m) => toMin(m.startTime) > nowMin)
    .sort((a, b) => toMin(a.startTime) - toMin(b.startTime))[0];
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-4">
      {quote && (
        <p className="stagger-item text-[13px] italic font-semibold text-fg-2">
          "{quote.quote}" <span className="not-italic">· {quote.author}</span>
        </p>
      )}

      <div className="stagger-item flex flex-col-reverse items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6" style={staggerDelay(1)}>
        <div className="min-w-0">
          <h1 className="display text-3xl font-bold text-fg">{firstName ? `${greeting()}, ${firstName}` : greeting()}</h1>
          <p className="mt-1 text-sm text-fg-3">Here's your weekly schedule</p>
        </div>
        <DashboardStreak />
        {((semesters && semesters.length > 0) || data?.semester) && (
          <div className="order-first flex flex-wrap items-center gap-2 sm:order-none sm:ml-auto">
            {semesters && semesters.length > 0 && (
              <select
                className="input"
                style={{ width: "auto" }}
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
          </div>
        )}
      </div>

      <SetupNudge />

      {isLoading && (
        <div className="stagger-item flex flex-col gap-4 md:flex-row" style={staggerDelay(2)}>
          <SkeletonBlock height={180} className="md:w-56 md:shrink-0" />
          <SkeletonBlock height={320} className="min-w-0 flex-1" />
        </div>
      )}
      {error && !data && <QueryError onRetry={() => refetch()} message="Couldn't load your week. Check your connection and try again." />}

      {data && (
        <div className="dash-grid stagger-item" style={staggerDelay(2)}>
          <div className="card p-4 md:[grid-area:today]">
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
                        className="press flex items-start gap-2 rounded-lg px-3 py-2 text-[13px] font-medium hover:opacity-80"
                        style={{
                          backgroundColor: m.color ?? "var(--accent)",
                          color: readableOn(m.color),
                          opacity: done ? 0.45 : 1,
                        }}
                      >
                        <span className="min-w-0 flex-1 leading-snug">
                          {m.code || m.courseName}
                          {m.kind && (
                            <span className="text-[11px] font-normal opacity-80">
                              {" · "}
                              {MEETING_KIND_LABEL[m.kind]}
                            </span>
                          )}
                          {m.location && (
                            <span className="block break-words text-[11px] font-normal opacity-80">
                              {m.location}
                            </span>
                          )}
                        </span>
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

          <div className="min-w-0 space-y-2 md:[grid-area:week]">
            <p className="text-[12px] font-medium uppercase tracking-wider text-fg-3">
              This week · {fmtWeekRange(data.weekStart, data.weekEnd)}
            </p>

            <div className="card overflow-x-auto">
              {addingDay && (
                <div className="border-b border-line px-4 py-3 animate-slide">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-fg">
                      Add item · {addingDay}
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
                      No courses yet.{" "}
                      <Link to="/courses" className="text-accent hover:text-accent-2 transition-colors">
                        Add one first
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

              <WeekGrid
                days={data.days.map((day, idx) => ({
                  key: day.date,
                  label: DAYS[idx],
                  sublabel: day.date.slice(5),
                  meetings: day.meetings,
                }))}
                meetingHref={(m) => `/courses/${m.courseId}`}
                onDayClick={(key) =>
                  requireAuth(() => setAddingDay((d) => (d === key ? null : key)))
                }
                activeDayKey={addingDay}
                footer={
                  data.days.some((d) => d.items.length > 0) ? (
                    <div
                      className="grid border-t border-line"
                      style={{ gridTemplateColumns: `2.5rem repeat(${data.days.length}, 1fr)` }}
                    >
                      <div className="border-r border-line px-1 py-1 text-[8px] font-semibold uppercase tracking-widest text-fg-3">
                        due
                      </div>
                      {data.days.map((day) => (
                        <div
                          key={`items-${day.date}`}
                          className="min-h-5 space-y-0.5 border-l border-line px-0.5 py-0.5"
                        >
                          {day.items.map((it) => (
                            <Link
                              key={it.id}
                              to={`/courses/${it.courseId}`}
                              className="block truncate rounded-sm border-l-2 px-1 py-0.5 text-[9px] leading-tight transition-opacity hover:opacity-75"
                              style={{
                                borderColor: itemColor(it),
                                background: `color-mix(in srgb, ${itemColor(it)} 10%, transparent)`,
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
                  ) : null
                }
              />
            </div>
          </div>

          <div className="relative min-w-0 md:[grid-area:due]">
            <div className="@container card flex flex-col 2xl:absolute 2xl:inset-0">
              <div className="flex items-center gap-3 p-4">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
                >
                  <CalendarClock size={16} className="text-accent" />
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-fg">Due this week</div>
                  <div className="text-[12px] text-fg-3">
                    {dueThisWeek.length === 0
                      ? "Nothing due. Enjoy it."
                      : `${dueThisWeek.length} ${dueThisWeek.length === 1 ? "item" : "items"}`}
                  </div>
                </div>
              </div>
              {dueThisWeek.length === 0 ? (
                <div className="hidden flex-1 flex-col items-center justify-center border-t border-line px-4 py-6 text-center lg:flex">
                  <CalendarCheck className="mb-2 text-fg-3" size={24} strokeWidth={1.5} />
                  <p className="text-[13px] text-fg-3">You're all caught up this week.</p>
                </div>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto border-t border-line">
                  {dueThisWeek.map((entry) =>
                    entry.todo ? (
                      <li
                        key={entry.key}
                        className="flex flex-col gap-0.5 px-4 py-2.5 text-[13px] @md:flex-row @md:items-center @md:gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Link to="/todos" className="font-medium text-fg hover:text-accent transition-colors">
                              {entry.todo.title}
                            </Link>
                            <span className="badge badge-muted">To-do</span>
                            {entry.todo.categoryName && (
                              <span className="badge" style={badgeStyle(entry.todo.categoryColor ?? "var(--accent)")}>
                                {entry.todo.categoryName}
                              </span>
                            )}
                            <span className="badge" style={badgeStyle(priorityTone(entry.todo.priority))}>
                              {priorityLabel(entry.todo.priority)}
                            </span>
                          </div>
                        </div>
                        <span
                          className="shrink-0 whitespace-nowrap text-[12px] tabular-nums @md:text-[13px]"
                          style={{ color: dueUrgency(entry.dueAt)?.color ?? "var(--fg-3)" }}
                        >
                          {formatDateTime(entry.dueAt)}
                        </span>
                      </li>
                    ) : (
                      <li key={entry.key} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                        <div className="min-w-0 flex-1 @md:flex @md:items-center @md:gap-3">
                          <div className="min-w-0 truncate @md:flex-1">
                            <Link to={`/courses/${entry.item!.courseId}`} className="font-medium text-fg hover:text-accent transition-colors">
                              {entry.item!.title}
                            </Link>
                            <span className="ml-2 text-fg-3">· {entry.item!.courseName}</span>
                          </div>
                          <div className="mt-0.5 whitespace-nowrap text-[12px] text-fg-3 tabular-nums @md:mt-0 @md:shrink-0 @md:text-[13px]">
                            {formatDateTime(entry.dueAt)}
                          </div>
                        </div>
                        <button
                          onClick={() => setEditingItem(entry.item!)}
                          className="shrink-0 rounded p-1 text-fg-3 transition-colors hover:text-fg"
                          aria-label="Edit item"
                        >
                          <Pencil size={12} />
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
          </div>

          <ExamsCard
            semesterId={semesterId}
            className={`md:[grid-area:exams] ${hasExams ? "" : "hidden lg:block"}`}
          />

          <TodoQuickView className="md:[grid-area:todo]" />

          <Link
            to="/calendar"
            className="card block p-4 transition-colors hover:bg-surface-hi md:p-3.5 md:[grid-area:cal]"
          >
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
            <MiniMonth marked={new Set(dueThisWeek.map((e) => e.dueAt.slice(0, 10)))} />
          </Link>

          <div className="flex min-w-0 flex-col gap-3 md:[grid-area:side]">
            <GradesCard />
            <div className="flex flex-1 flex-col gap-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-fg-3">Explore</h2>
              <div className="grid grid-cols-2 gap-3">
                {EXPLORE.map(({ to, icon: Icon, title, color, description }) => (
                  <Link
                    key={to}
                    to={to}
                    className="group/tile card relative flex aspect-square flex-col items-center justify-center gap-2 p-3 text-center transition-[transform,box-shadow,border-color] duration-200 ease-out hover:z-10 hover:scale-[1.06] hover:shadow-[var(--shadow-md)] focus-visible:z-10 focus-visible:scale-[1.06] motion-reduce:transition-none motion-reduce:hover:scale-100"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 ease-out group-hover/tile:scale-110 group-hover/tile:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover/tile:transform-none lg:h-10 lg:w-10 xl:h-12 xl:w-12"
                      style={{
                        background: `color-mix(in srgb, ${color} 16%, transparent)`,
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 26%, transparent)`,
                        color,
                      }}
                    >
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium leading-snug text-fg">{title}</div>
                      <div className="hidden text-[11.5px] leading-snug text-fg-3 sm:block lg:hidden xl:block">{description}</div>
                    </div>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-200 group-hover/tile:opacity-100"
                      style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)` }}
                    />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <ItemModal
          item={editingItem}
          courses={courseList}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
