import { useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "../../components/Skeleton";
import StreakFlame from "../progress/StreakFlame";
import { useProgressEnabled, useStreakWeek } from "../progress/useProgress";
import praise from "./streakPraise.json";
import type { StreakWeekDto } from "../../types";

const PRAISE_STYLE: React.CSSProperties = {
  color: "var(--orange)",
  textShadow: "0 0 10px color-mix(in srgb, var(--orange-vivid) 55%, transparent)",
};

function streakNote(data: StreakWeekDto, doneToday: boolean, cheer: string) {
  if (doneToday) return { text: cheer, className: "font-semibold", style: PRAISE_STYLE };
  const started = data.minutesToday > 0;
  if (data.current > 0) {
    return started
      ? { text: "Study longer to keep the streak alive!", className: "font-medium text-yellow" }
      : { text: "Keep the streak alive!", className: "font-medium text-accent" };
  }
  return started
    ? { text: "Keep studying for the streak!", className: "font-medium text-yellow" }
    : { text: "Start a study session for a streak!", className: "font-medium text-accent" };
}

export default function DashboardStreak() {
  const enabled = useProgressEnabled();
  const streak = useStreakWeek();
  const [cheer] = useState(() => praise[Math.floor(Math.random() * praise.length)]);

  if (!enabled) return null;
  if (streak.isLoading) {
    return (
      <div className="flex items-center gap-2.5" aria-hidden="true">
        <Skeleton width={40} height={40} className="rounded-full" />
        <div className="space-y-1.5">
          <Skeleton width={96} height={14} />
          <Skeleton width={170} height={10} />
        </div>
      </div>
    );
  }
  if (!streak.data) return null;

  return <StreakSummary data={streak.data} cheer={cheer} />;
}

function StreakSummary({ data, cheer }: { data: StreakWeekDto; cheer: string }) {
  const doneToday = data.week.some((d) => d.isToday && d.qualified);
  const note = streakNote(data, doneToday, cheer);

  return (
    <Link
      to="/learn"
      className="press -mx-2 flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-hi"
    >
      <StreakFlame streak={data.current} size={40} />
      <div className="min-w-0">
        <p className={`text-[15px] font-bold leading-tight tabular-nums ${data.current > 0 ? "text-fg" : "text-fg-2"}`}>
          {data.current}-day streak
        </p>
        <p className={`mt-0.5 text-[12.5px] leading-snug ${note.className}`} style={note.style}>
          {note.text}
        </p>
      </div>
    </Link>
  );
}
