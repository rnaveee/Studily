import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Play } from "lucide-react";
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
    <section
      className="card card-raised px-4 pb-5 pt-6 sm:px-7 sm:pb-7 sm:pt-8"
      aria-labelledby="study-sessions-title"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 30%, var(--line))",
        backgroundImage:
          "radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, var(--accent) 11%, transparent) 0%, transparent 70%), var(--card-grad)",
      }}
    >
      <div className="text-center">
        <h1 id="study-sessions-title" className="display text-[26px] font-bold text-fg sm:text-[30px]">
          Study sessions
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-snug text-fg-2">
          Focus in blocks, check in to earn XP, and keep your streak alive.
        </p>
      </div>
      <div className="mt-6">{enabled ? <PanelBody /> : <GuestPrompt />}</div>
    </section>
  );
}

function GuestPrompt() {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl px-4 py-5 text-center sm:flex-row sm:text-left"
      style={{ background: "var(--surface-hi)" }}
    >
      <StreakFlame streak={0} size={44} />
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
        <div className="flex justify-center">
          <Skeleton height={52} className="w-full rounded-xl sm:max-w-sm" />
        </div>
      ) : active.data ? (
        <ActiveSessionCard session={active.data} receivedAt={active.dataUpdatedAt} />
      ) : (
        <div className="flex justify-center">
          <button
            onClick={() => {
              unlockAudio();
              setStarting(true);
            }}
            className="btn btn-primary btn-lg w-full sm:max-w-sm"
            style={{ minHeight: 52, fontSize: 15 }}
          >
            <Play size={16} fill="currentColor" strokeWidth={0} />
            Start study session
          </button>
        </div>
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
