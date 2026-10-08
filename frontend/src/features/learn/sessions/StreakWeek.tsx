import { Check, Zap } from "lucide-react";
import { Skeleton } from "../../../components/Skeleton";
import StreakFlame from "../../progress/StreakFlame";
import { formatMultiplier } from "./sessionFormat";
import type { StreakWeekDto } from "../../../types";

const QUALIFY_MINUTES = 15;

export default function StreakWeek({ data }: { data: StreakWeekDto }) {
  const lit = data.current > 0;
  const boosted = data.multiplier > 1;
  const todayDone = data.week.some((d) => d.isToday && d.qualified);
  const todayLeft = Math.max(0, QUALIFY_MINUTES - data.minutesToday);

  return (
    <div className="rounded-xl border border-line p-3.5" style={{ background: "var(--surface)" }}>
      <div className="flex items-center gap-3">
        <StreakFlame lit={lit} size={46} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[24px] font-bold leading-none tabular-nums text-fg">{data.current}</span>
            <span className="text-[13px] font-medium text-fg-2">day streak</span>
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-fg-3">
            {todayDone
              ? "Today counts"
              : lit
                ? `${todayLeft} more min today keeps it going`
                : `Study ${todayLeft} min today to start one`}
            {data.best > 0 && ` · Best ${data.best}`}
          </p>
        </div>
        <span
          className={`badge shrink-0 tabular-nums ${boosted ? "" : "badge-muted"}`}
          style={
            boosted
              ? {
                  background: "color-mix(in srgb, var(--orange-vivid) 14%, transparent)",
                  color: "var(--orange)",
                  fontSize: 12,
                  padding: "3px 9px",
                }
              : { fontSize: 12, padding: "3px 9px" }
          }
          title={`New sessions earn ${formatMultiplier(data.multiplier)} XP`}
        >
          <Zap size={11} />
          {formatMultiplier(data.multiplier)}
        </span>
      </div>

      <div className="mt-3.5 flex justify-between gap-1" role="list" aria-label="This week">
        {data.week.map((d) => {
          const future = d.date > data.today;
          const progress = d.isToday && !d.qualified ? Math.min(1, data.minutesToday / QUALIFY_MINUTES) : 0;
          return (
            <div key={d.date} role="listitem" className="flex w-9 flex-col items-center gap-1.5">
              <span
                aria-label={`${d.label}: ${d.qualified ? "studied" : future ? "upcoming" : "no study"}`}
                className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full"
                style={
                  d.qualified
                    ? {
                        background: "linear-gradient(160deg, var(--amber-vivid), var(--orange-vivid))",
                        color: "var(--accent-fg)",
                        boxShadow: "0 3px 10px -3px color-mix(in srgb, var(--orange-vivid) 70%, transparent)",
                      }
                    : future
                      ? { border: "1.5px dashed var(--line)" }
                      : progress > 0
                        ? {
                            background: `conic-gradient(var(--orange-vivid) ${progress * 360}deg, var(--surface-hi) 0deg)`,
                          }
                        : { background: "var(--surface-hi)", boxShadow: "var(--control-inset)" }
                }
              >
                {progress > 0 && (
                  <span className="absolute inset-[4px] rounded-full" style={{ background: "var(--surface)" }} />
                )}
                {d.qualified && <Check size={15} strokeWidth={3} />}
                {d.isToday && (
                  <span
                    aria-hidden
                    className="absolute -inset-[4px] rounded-full"
                    style={{ border: "2px solid var(--accent)" }}
                  />
                )}
              </span>
              <span
                className={`text-[10.5px] ${d.isToday ? "font-bold text-accent" : "font-medium text-fg-3"}`}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StreakWeekSkeleton() {
  return (
    <div className="rounded-xl border border-line p-3.5" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton width={46} height={46} className="rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton width={110} height={16} />
          <Skeleton width="70%" height={10} />
        </div>
      </div>
      <div className="mt-3.5 flex justify-between">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} width={34} height={34} className="rounded-full" />
        ))}
      </div>
    </div>
  );
}
