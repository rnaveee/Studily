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
import { eventEntry, itemEntry, type Entry } from "./entries";
import MonthGrid, { groupByDay } from "./MonthGrid";
import QueryError from "../../components/QueryError";
import { readableOn } from "../../lib/courseColors";

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

  const { data: items, isError: itemsError, refetch: refetchItems } = useQuery({
    queryKey: ["calendar", from, to],
    queryFn: () => api.get<AcademicItem[]>(`/calendar?${range}`),
  });

  const { data: events, isError: eventsError, refetch: refetchEvents } = useQuery({
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

  const byDay = useMemo(() => groupByDay(entries), [entries]);

  const label = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const isCurrentMonth =
    today.getMonth() === month.getMonth() && today.getFullYear() === month.getFullYear();

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

      {(itemsError || eventsError) && (
        <QueryError
          onRetry={() => {
            refetchItems();
            refetchEvents();
          }}
          message="Couldn't load your calendar. Check your connection and try again."
        />
      )}

      <div className="flex flex-col gap-5">
        <div
          className={`flex flex-col gap-5 xl:grid ${
            entries.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_24rem]" : ""
          }`}
        >
          <MonthGrid
            month={month}
            byDay={byDay}
            onSelectDay={(day) => requireAuth(() => setSelectedDay(day))}
          />

          {entries.length > 0 && (
            <div className="relative">
              <div className="flex flex-col xl:absolute xl:inset-0">
                <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
                  {label}
                </h2>
                <ul className="card min-h-0 flex-1 divide-y divide-line overflow-y-auto">
                  {entries.map((en) => (
                    <li key={en.key}>
                      <button
                        onClick={() => setSelectedEntry(en)}
                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-hi"
                      >
                        <span
                          className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ backgroundColor: en.accent, color: readableOn(en.accent) }}
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
            </div>
          )}
        </div>

        <div className="order-first xl:order-none">
          <IcsPanel />
        </div>
      </div>

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
