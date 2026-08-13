import { useState } from "react";
import TimeSelect, { DAY_PRESETS } from "./TimeSelect";

const DEFAULT_TIME = "23:59";

function split(value: string): { date: string; time: string } {
  const at = value.indexOf("T");
  if (at < 0) return { date: value, time: "" };
  return { date: value.slice(0, at), time: value.slice(at + 1, at + 6) };
}

export default function DateTimeSelect({
  value,
  onChange,
  required,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const parts = split(value);
  const [time, setTime] = useState(parts.time || DEFAULT_TIME);
  const currentTime = parts.time || time;

  function setDate(date: string) {
    onChange(date ? `${date}T${currentTime}` : "");
  }

  function pickTime(next: string) {
    setTime(next);
    if (parts.date) onChange(`${parts.date}T${next}`);
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        className="input min-w-0 flex-[3]"
        type="date"
        value={parts.date}
        onChange={(e) => setDate(e.target.value)}
        required={required}
      />
      <TimeSelect
        value={currentTime}
        onChange={pickTime}
        label="Time"
        presets={DAY_PRESETS}
        className="min-w-0 flex-[2]"
      />
    </div>
  );
}
