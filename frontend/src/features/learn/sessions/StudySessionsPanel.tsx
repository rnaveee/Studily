import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Play, Target } from "lucide-react";
import { Skeleton } from "../../../components/Skeleton";
import { unlockAudio } from "../../../lib/ringtones";
import StreakFlame from "../../progress/StreakFlame";
import { useActiveSession, useProgressEnabled, useSessionHistory, useStreakWeek } from "../../progress/useProgress";
import ActiveSessionCard from "./ActiveSessionCard";
import SessionHistoryList from "./SessionHistoryList";
import StartSessionModal from "./StartSessionModal";
import StreakWeek, { StreakWeekSkeleton } from "./StreakWeek";

export default function StudySessionsPanel() {
  const enabled = useProgressEnabled();

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="study-sessions-title">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <Target size={16} className="text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="study-sessions-title" className="text-[15px] font-semibold text-fg">
            Study sessions
          </h2>
          <p className="text-[12px] text-fg-3">Focus in blocks, check in to earn XP, and keep your streak alive.</p>
        </div>
      </div>
      <div className="mt-4">{enabled ? <PanelBody /> : <GuestPrompt />}</div>
    </section>
  );
}

function GuestPrompt() {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl px-4 py-5 text-center sm:flex-row sm:text-left"
      style={{ background: "var(--surface-hi)" }}
    >
      <StreakFlame lit={false} size={40} />
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-fg-2">
        Sign in to track study sessions, build a daily streak, and earn XP and badges.
      </p>
      <Link to="/login" className="btn btn-primary min-h-[40px] shrink-0">
        Sign in
      </Link>
    </div>
  );
}

function PanelBody() {
  const active = useActiveSession();
  const streak = useStreakWeek();
  const history = useSessionHistory();
  const [starting, setStarting] = useState(false);

  const recent = (history.data?.pages[0]?.items ?? []).filter(
    (s) => s.status !== "ACTIVE" && s.status !== "PAUSED",
  ).slice(0, 3);

  return (
    <div className="space-y-4">
      {active.isLoading ? (
        <Skeleton height={48} className="rounded-xl" />
      ) : active.data ? (
        <ActiveSessionCard session={active.data} receivedAt={active.dataUpdatedAt} />
      ) : (
        <button
          onClick={() => {
            unlockAudio();
            setStarting(true);
          }}
          className="btn btn-primary btn-lg w-full"
          style={{ minHeight: 48 }}
        >
          <Play size={15} fill="currentColor" strokeWidth={0} />
          Start study session
        </button>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {streak.isLoading ? (
          <StreakWeekSkeleton />
        ) : streak.data ? (
          <StreakWeek data={streak.data} />
        ) : (
          <div className="rounded-xl border border-line p-4 text-[12.5px] text-fg-3">Couldn't load your streak.</div>
        )}

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-fg">Recent sessions</h3>
            <Link
              to="/learn/sessions"
              className="-mr-1.5 inline-flex min-h-[40px] items-center gap-0.5 rounded-lg px-1.5 text-[12.5px] font-medium text-accent transition-colors hover:bg-surface-hi"
            >
              See all
              <ChevronRight size={14} />
            </Link>
          </div>
          {history.isLoading ? (
            <div className="space-y-3 py-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton width={36} height={36} className="shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton width="60%" height={11} />
                    <Skeleton width="40%" height={9} />
                  </div>
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="rounded-xl px-3 py-4 text-center text-[12.5px] text-fg-3" style={{ border: "1px dashed var(--line)" }}>
              {history.isError ? "Couldn't load your sessions." : "No sessions yet. Your first one starts your streak."}
            </p>
          ) : (
            <SessionHistoryList items={recent} />
          )}
        </div>
      </div>

      {starting && <StartSessionModal onClose={() => setStarting(false)} />}
    </div>
  );
}
