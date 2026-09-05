import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../lib/api";
import BackButton from "../../components/BackButton";
import { useRequireAuth } from "../../lib/auth";
import { formatDateTime } from "../../lib/format";
import { type AcademicItem, type CalendarEvent } from "../../types";
import DayModal from "./DayModal";
import IcsPanel from "./IcsPanel";
import CalendarEntryModal from "./CalendarEntryModal";
import { dayKey, eventEntry, itemEntry, tintBackground, type Entry } from "./entries";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_BLOCKS_PER_DAY = 3;

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
        (a, b) => new Date(a.when).getTime() - new Date(b.when).getTime(),
      ),
    [items, events],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const en of entries) {
      const key = dayKey(en.when);
      map.set(key, [...(map.get(key) ?? []), en]);
    }
    return map;
  }, [entries]);

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

  const selectedDayEntries = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-5">
      <div className="stagger-item flex items-center gap-3">
        <BackButton />
        <h1 className="flex-1 text-xl font-semibold text-fg">{label}</h1>
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="btn btn-ghost p-1.5"
          aria-label="Previous month"
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
          aria-label="Next month"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <IcsPanel />

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
            const dayEntries = day ? (byDay.get(toDayStr(day)) ?? []) : [];
            return (
              <div
                key={i}
                onClick={() => day && requireAuth(() => setSelectedDay(toDayStr(day)))}
                className={[
                  "min-h-[6.5rem] border-b border-r border-line p-1 transition-colors",
                  day
                    ? "cursor-pointer hover:bg-surface-hi"
                    : "pointer-events-none bg-surface-hi/40",
                ].join(" ")}
              >
                {day && (
                  <>
                    <div
                      className={[
                        "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                        isToday ? "bg-accent text-accent-fg" : "text-fg-2",
                      ].join(" ")}
                    >
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayEntries.slice(0, MAX_BLOCKS_PER_DAY).map((en) => (
                        <div
                          key={en.key}
                          className="flex items-center gap-1 overflow-hidden rounded-[4px] py-[3px] pr-1"
                          style={{ background: tintBackground(en.tint) }}
                          title={en.subtitle ? `${en.title} · ${en.subtitle}` : en.title}
                        >
                          <span
                            className="h-3.5 w-[3px] shrink-0 rounded-full"
                            style={{ background: en.accent }}
                          />
                          <span className="truncate text-[10px] font-medium leading-tight text-fg">
                            {en.title}
                          </span>
                        </div>
                      ))}
                      {dayEntries.length > MAX_BLOCKS_PER_DAY && (
                        <div className="pl-0.5 text-[10px] text-fg-3">
                          +{dayEntries.length - MAX_BLOCKS_PER_DAY} more
                        </div>
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
                    style={{ backgroundColor: en.accent }}
                  >
                    {en.badge}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium leading-snug text-fg">
                      {en.title}
                    </span>
                    {(en.subtitle ?? en.place) && (
                      <span className="mt-0.5 block truncate text-[12px] text-fg-3">
                        {en.subtitle ?? en.place}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 whitespace-nowrap pt-0.5 text-[12px] tabular-nums text-fg-3">
                    {formatDateTime(en.when)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedDay && (
        <DayModal
          date={selectedDay}
          entries={selectedDayEntries}
          onSelectEntry={setSelectedEntry}
          onClose={() => setSelectedDay(null)}
        />
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
