import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import { formatDateTime } from "../../lib/format";
import { type AcademicItem, type CalendarEvent } from "../../types";
import AddCalendarItemModal from "./AddCalendarItemModal";
import CalendarEntryModal from "./CalendarEntryModal";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Entry {
  key: string;
  title: string;
  color: string;
  badge: string;
  when: string;
  courseName?: string;
  place?: string | null;
  item?: AcademicItem;
  event?: CalendarEvent;
}

function itemEntry(it: AcademicItem): Entry {
  return {
    key: `item-${it.id}`,
    title: it.title,
    color: it.type === "EXAM" ? "var(--red)" : "var(--green)",
    badge: it.type === "EXAM" ? "Exam" : "Assign",
    when: it.dueAt,
    courseName: it.courseName,
    item: it,
  };
}

function eventEntry(ev: CalendarEvent): Entry {
  return {
    key: `event-${ev.id}`,
    title: ev.title,
    color: "var(--accent)",
    badge: "Event",
    when: ev.startAt,
    place: ev.place,
    event: ev,
  };
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const requireAuth = useRequireAuth();

  const today = new Date();

  const { from, to } = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [month]);

  const range = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const { data: items } = useQuery({
    queryKey: ["calendar", from, to],
    queryFn: () => api.get<AcademicItem[]>(`/calendar?${range}`),
  });

  const { data: events } = useQuery({
    queryKey: ["calendar-events", from, to],
    queryFn: () => api.get<CalendarEvent[]>(`/calendar/events?${range}`),
  });

  const entries = useMemo(
    () =>
      [...(items ?? []).map(itemEntry), ...(events ?? []).map(eventEntry)].sort(
        (a, b) => new Date(a.when).getTime() - new Date(b.when).getTime()
      ),
    [items, events]
  );

  const byDay = useMemo(() => {
    const map = new Map<number, Entry[]>();
    for (const en of entries) {
      const d = new Date(en.when);
      if (d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()) {
        const day = d.getDate();
        map.set(day, [...(map.get(day) ?? []), en]);
      }
    }
    return map;
  }, [entries, month]);

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
            const dayEntries = day ? (byDay.get(day) ?? []) : [];
            return (
              <div
                key={i}
                onClick={() => day && requireAuth(() => setSelectedDay(toDayStr(day)))}
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
                      {dayEntries.slice(0, 3).map((en) => (
                        <div
                          key={en.key}
                          className="truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight text-white"
                          style={{ backgroundColor: en.color }}
                          title={en.courseName ? `${en.title} · ${en.courseName}` : en.title}
                        >
                          {en.title}
                        </div>
                      ))}
                      {dayEntries.length > 3 && (
                        <div className="text-[9px] text-fg-3 pl-0.5">+{dayEntries.length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {entries.length > 0 && (
        <div>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
            {label}
          </h2>
          <ul className="card divide-y divide-line">
            {entries.map((en) => (
              <li key={en.key}>
                <button
                  onClick={() => setSelectedEntry(en)}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-hi"
                >
                  <span
                    className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                    style={{ backgroundColor: en.color }}
                  >
                    {en.badge}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium leading-snug text-fg">
                      {en.title}
                    </span>
                    {(en.courseName ?? en.place) && (
                      <span className="mt-0.5 block truncate text-[12px] text-fg-3">
                        {en.courseName ?? en.place}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 whitespace-nowrap pt-0.5 text-[12px] text-fg-3 tabular-nums">
                    {formatDateTime(en.when)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedDay && (
        <AddCalendarItemModal date={selectedDay} onClose={() => setSelectedDay(null)} />
      )}

      {selectedEntry && (
        <CalendarEntryModal
          item={selectedEntry.item}
          event={selectedEntry.event}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
