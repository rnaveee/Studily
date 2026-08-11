import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { summarize } from "../../lib/recurrence";
import { DAYS, type DayOfWeek, type Recurrence, type RecurrenceFreq, type Semester } from "../../types";

type Preset = "NONE" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM";
type EndMode = "SEMESTER" | "DATE" | "COUNT";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "NONE", label: "Does not repeat" },
  { value: "DAILY", label: "Every day" },
  { value: "WEEKLY", label: "Every week" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "MONTHLY", label: "Every month" },
  { value: "CUSTOM", label: "Custom…" },
];

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function baseOf(preset: Preset): { freq: RecurrenceFreq; interval: number } | null {
  switch (preset) {
    case "DAILY": return { freq: "DAILY", interval: 1 };
    case "WEEKLY": return { freq: "WEEKLY", interval: 1 };
    case "BIWEEKLY": return { freq: "WEEKLY", interval: 2 };
    case "MONTHLY": return { freq: "MONTHLY", interval: 1 };
    default: return null;
  }
}

export default function RepeatPicker({
  startLocal,
  weight,
  onChange,
}: {
  startLocal: string;
  weight?: string;
  onChange: (rule: Recurrence | null) => void;
}) {
  const [preset, setPreset] = useState<Preset>("NONE");
  const [freq, setRecurrenceFreq] = useState<RecurrenceFreq>("WEEKLY");
  const [interval, setInterval] = useState(1);
  const [byDay, setByDay] = useState<DayOfWeek[]>([]);
  const [endMode, setEndMode] = useState<EndMode>("SEMESTER");
  const [endDate, setEndDate] = useState("");
  const [count, setCount] = useState(12);

  const { data: semester } = useQuery({
    queryKey: ["semester-current"],
    queryFn: () => api.get<Semester | null>("/semesters/current"),
  });

  const semesterEnd = semester?.endDate ?? null;
  const effectiveEnd = endMode === "SEMESTER" ? semesterEnd : endMode === "DATE" ? endDate : null;

  useEffect(() => {
    if (semester !== undefined && !semesterEnd && endMode === "SEMESTER") {
      setEndMode("COUNT");
    }
  }, [semester, semesterEnd, endMode]);

  const active = preset !== "NONE";
  const chosen = preset === "CUSTOM" ? { freq, interval } : baseOf(preset);

  const rule: Recurrence | null =
    !active || !chosen
      ? null
      : {
          freq: chosen.freq,
          interval: chosen.interval,
          byDay: chosen.freq === "WEEKLY" && byDay.length > 0 ? byDay : undefined,
          until: effectiveEnd ? `${effectiveEnd}T23:59:59` : undefined,
          count: endMode === "COUNT" ? count : undefined,
        };

  const serialized = JSON.stringify(rule);
  useEffect(() => {
    onChange(rule ? (JSON.parse(serialized) as Recurrence) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  const summary = startLocal ? summarize(startLocal, rule) : null;
  const occurrences = summary?.match(/^(\d+) occurrence/);
  const weightNum = Number(weight);
  const showWeight =
    occurrences && weight && Number.isFinite(weightNum) && weightNum > 0;

  function toggleDay(day: DayOfWeek) {
    setByDay((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="field-label">Repeats</label>
        <select
          className="input"
          value={preset}
          onChange={(e) => {
            const next = e.target.value as Preset;
            setPreset(next);
            const base = baseOf(next);
            if (base) {
              setRecurrenceFreq(base.freq);
              setInterval(base.interval);
            }
          }}
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {preset === "CUSTOM" && (
        <div className="space-y-2 animate-slide">
          <div className="flex items-end gap-2">
            <div className="w-20">
              <label className="field-label">Every</label>
              <input
                className="input"
                type="number"
                min={1}
                max={52}
                value={interval}
                onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="flex-1">
              <select
                className="input"
                value={freq}
                onChange={(e) => setRecurrenceFreq(e.target.value as RecurrenceFreq)}
              >
                <option value="DAILY">days</option>
                <option value="WEEKLY">weeks</option>
                <option value="MONTHLY">months</option>
              </select>
            </div>
          </div>

          {freq === "WEEKLY" && (
            <div>
              <label className="field-label">On</label>
              <div className="flex gap-1">
                {DAYS.map((day, i) => {
                  const on = byDay.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      aria-pressed={on}
                      className="h-8 w-8 rounded-lg text-[12px] font-medium transition-colors"
                      style={
                        on
                          ? { background: "var(--accent)", color: "var(--accent-fg)" }
                          : { background: "var(--surface-hi)", color: "var(--fg-2)" }
                      }
                    >
                      {DAY_INITIALS[i]}
                    </button>
                  );
                })}
              </div>
              {byDay.length === 0 && (
                <p className="mt-1 text-[11px] text-fg-3">
                  Defaults to the weekday of the date above.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {active && (
        <div className="space-y-1.5 animate-slide">
          <label className="field-label">Ends</label>
          <div className="space-y-1.5 text-[13px] text-fg-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={endMode === "SEMESTER"}
                onChange={() => setEndMode("SEMESTER")}
                disabled={!semesterEnd}
              />
              <span className={semesterEnd ? undefined : "text-fg-3"}>
                {semesterEnd
                  ? `End of semester (${new Date(`${semesterEnd}T12:00:00`).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" },
                    )})`
                  : "End of semester (no current semester)"}
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={endMode === "DATE"} onChange={() => setEndMode("DATE")} />
              <span>On</span>
              <input
                className="input !w-auto !py-1"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setEndMode("DATE");
                }}
              />
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={endMode === "COUNT"} onChange={() => setEndMode("COUNT")} />
              <span>After</span>
              <input
                className="input !w-16 !py-1"
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => {
                  setCount(Math.max(1, Number(e.target.value) || 1));
                  setEndMode("COUNT");
                }}
              />
              <span>times</span>
            </label>
          </div>

          {summary && (
            <p
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-fg-2"
              style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
            >
              {summary}
              {showWeight && (
                <>
                  {" · "}
                  each worth {weightNum}% ({Math.round(weightNum * Number(occurrences[1]) * 10) / 10}% total)
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
