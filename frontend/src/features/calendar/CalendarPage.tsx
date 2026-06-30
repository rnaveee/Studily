import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { type AcademicItem, type AcademicItemRequest, type Course } from "../../types";
import ItemForm from "../../components/ItemForm";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayColor(it: AcademicItem): string {
  if (it.courseColor) return it.courseColor;
  return it.type === "EXAM" ? "var(--red)" : "var(--green)";
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const today = new Date();

  const { from, to } = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [month]);

  const { data: items } = useQuery({
    queryKey: ["calendar", from, to],
    queryFn: () =>
      api.get<AcademicItem[]>(`/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  });

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const createItem = useMutation({
    mutationFn: ({ courseId, req }: { courseId: number; req: AcademicItemRequest }) =>
      api.post<AcademicItem>(`/courses/${courseId}/items`, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedDay(null);
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<number, AcademicItem[]>();
    for (const it of items ?? []) {
      const d = new Date(it.dueAt);
      if (d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()) {
        const day = d.getDate();
        map.set(day, [...(map.get(day) ?? []), it]);
      }
    }
    return map;
  }, [items, month]);

  const sortedItems = useMemo(
    () => [...(items ?? [])].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
    [items]
  );

  const courseList = useMemo(
    () => (courses ?? []).map((c) => ({ id: c.id, name: c.name })),
    [courses]
  );

  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const label = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const isCurrentMonth =
    today.getMonth() === month.getMonth() && today.getFullYear() === month.getFullYear();

  function toDayStr(day: number): string {
    const y = month.getFullYear();
    const m = String(month.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-xl font-semibold text-fg">{label}</h1>
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="btn btn-ghost p-1.5"
        >
          <ChevronLeft size={15} />
        </button>
        {!isCurrentMonth && (
          <button
            onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="btn btn-soft text-xs"
          >
            Today
          </button>
        )}
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="btn btn-ghost p-1.5"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-fg-3"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isToday = isCurrentMonth && day === today.getDate();
            const dayItems = day ? (byDay.get(day) ?? []) : [];
            return (
              <div
                key={i}
                onClick={() => day && setSelectedDay(toDayStr(day))}
                className={[
                  "min-h-[4.5rem] border-b border-r border-line p-1 transition-colors",
                  day
                    ? "cursor-pointer hover:bg-surface-hi"
                    : "bg-surface-hi/40 pointer-events-none",
                ].join(" ")}
              >
                {day && (
                  <>
                    <div
                      className={[
                        "mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                        isToday ? "bg-accent text-accent-fg" : "text-fg-2",
                      ].join(" ")}
                    >
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayItems.slice(0, 3).map((it) => (
                        <div
                          key={it.id}
                          className="truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight text-white"
                          style={{ backgroundColor: dayColor(it) }}
                          title={`${it.title} · ${it.courseName}`}
                        >
                          {it.title}
                        </div>
                      ))}
                      {dayItems.length > 3 && (
                        <div className="text-[9px] text-fg-3 pl-0.5">+{dayItems.length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {sortedItems.length > 0 && (
        <div>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
            {label}
          </h2>
          <ul className="card divide-y divide-line">
            {sortedItems.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                  style={{ backgroundColor: it.type === "EXAM" ? "var(--red)" : "var(--green)" }}
                >
                  {it.type === "EXAM" ? "Exam" : "Assign"}
                </span>
                <Link
                  to={`/courses/${it.courseId}`}
                  className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg transition-colors hover:text-accent"
                >
                  {it.title}
                </Link>
                <span className="shrink-0 text-[12px] text-fg-3">{it.courseName}</span>
                <span className="shrink-0 text-[12px] text-fg-3 tabular-nums">
                  {formatDateTime(it.dueAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSelectedDay(null)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-white drop-shadow">
                Add item — {selectedDay}
              </span>
              <button
                onClick={() => setSelectedDay(null)}
                className="rounded p-0.5 text-white/70 transition-colors hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            {courseList.length === 0 ? (
              <div className="card p-4 text-[13px] text-fg-3">
                No courses yet —{" "}
                <Link to="/courses" className="text-accent hover:text-accent-2 transition-colors">
                  add one first
                </Link>.
              </div>
            ) : (
              <ItemForm
                courses={courseList}
                initialDate={selectedDay}
                onSubmit={(courseId, req) => createItem.mutateAsync({ courseId, req })}
                onCancel={() => setSelectedDay(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
