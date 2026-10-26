import { useMemo } from "react";
import { dayKey, tintBackground, type Entry } from "./entries";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_BLOCKS_PER_DAY = 3;
const MAX_DOTS_PER_DAY = 4;

export function toDayStr(month: Date, day: number): string {
  const y = month.getFullYear();
  const m = String(month.getMonth() + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function groupByDay(entries: Entry[]): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>();
  for (const en of entries) {
    const key = dayKey(en.when);
    map.set(key, [...(map.get(key) ?? []), en]);
  }
  return map;
}

export default function MonthGrid({
  month,
  byDay,
  onSelectDay,
  highlightDay,
  highlightRef,
  compact = false,
}: {
  month: Date;
  byDay: Map<string, Entry[]>;
  onSelectDay?: (day: string) => void;
  highlightDay?: string;
  highlightRef?: (el: HTMLElement | null) => void;
  compact?: boolean;
}) {
  const today = new Date();
  const isCurrentMonth =
    today.getMonth() === month.getMonth() && today.getFullYear() === month.getFullYear();

  const cells = useMemo(() => {
    const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (number | null)[] = [
      ...Array(firstWeekday).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    return out;
  }, [month]);

  return (
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
          const dayStr = day ? toDayStr(month, day) : null;
          const dayEntries = dayStr ? (byDay.get(dayStr) ?? []) : [];
          const highlighted = dayStr != null && dayStr === highlightDay;
          return (
            <div
              key={i}
              ref={highlighted ? highlightRef : undefined}
              data-day={dayStr ?? undefined}
              onClick={() => dayStr && onSelectDay?.(dayStr)}
              className={[
                compact ? "min-h-[3.25rem]" : "min-h-[6.5rem]",
                "border-b border-r border-line p-1 transition-colors",
                dayStr
                  ? onSelectDay
                    ? "cursor-pointer hover:bg-surface-hi"
                    : ""
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
                  {compact ? (
                    <div className="flex flex-wrap gap-[3px] pl-0.5">
                      {dayEntries.slice(0, MAX_DOTS_PER_DAY).map((en) => (
                        <span
                          key={en.key}
                          className="h-[7px] w-[7px] rounded-full"
                          style={{ background: en.accent }}
                          title={en.subtitle ? `${en.title} · ${en.subtitle}` : en.title}
                        />
                      ))}
                    </div>
                  ) : (
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
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
