import { Link } from "react-router-dom";
import { ChevronRight, Gift } from "lucide-react";
import { Skeleton } from "../../components/Skeleton";
import { offerChests } from "../../lib/progressDelta";
import BadgeTile from "./BadgeTile";
import LevelPill from "./LevelPill";
import StreakFlame from "./StreakFlame";
import XpBar from "./XpBar";
import { useChests, useMyProgress, useProgressEnabled, useUserProgress } from "./useProgress";
import type { BadgeDto } from "../../types";

interface ViewProps {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
  streak: number;
  featured: BadgeDto[];
  badgeCount: number;
  badgeTotal: number;
  badgesHref: string;
  own: boolean;
  unopenedChests?: number;
  onOpenChests?: () => void;
}

export function MyProfileProgress() {
  const enabled = useProgressEnabled();
  const progress = useMyProgress();
  const hasChests = (progress.data?.unopenedChests ?? 0) > 0;
  const chests = useChests(hasChests);

  if (!enabled) return null;
  if (progress.isLoading) return <ProgressSkeleton />;
  if (!progress.data) {
    if (!progress.isError) return null;
    return (
      <Section>
        <div className="flex items-center justify-center gap-3">
          <p className="text-[13px] text-fg-3">Couldn't load your progress.</p>
          <button onClick={() => progress.refetch()} className="btn btn-ghost min-h-[40px]">
            Retry
          </button>
        </div>
      </Section>
    );
  }

  const p = progress.data;
  return (
    <ProgressView
      level={p.level}
      xp={p.xp}
      xpIntoLevel={p.xpIntoLevel}
      xpForNext={p.xpForNext}
      streak={p.streak.current}
      featured={p.featuredBadges}
      badgeCount={p.badgeCount}
      badgeTotal={p.badgeTotal}
      badgesHref="/profile/badges"
      own
      unopenedChests={p.unopenedChests}
      onOpenChests={chests.data && chests.data.length > 0 ? () => offerChests(chests.data!) : undefined}
    />
  );
}

export function UserProfileProgress({ userId }: { userId: number }) {
  const enabled = useProgressEnabled();
  const progress = useUserProgress(userId);

  if (!enabled) return null;
  if (progress.isLoading) return <ProgressSkeleton />;
  if (!progress.data) return null;

  const p = progress.data;
  return (
    <ProgressView
      level={p.level}
      xp={p.xp}
      xpIntoLevel={p.xpIntoLevel}
      xpForNext={p.xpForNext}
      streak={p.streakCurrent}
      featured={p.featuredBadges}
      badgeCount={p.badgeCount}
      badgeTotal={p.badgeTotal}
      badgesHref={`/users/${userId}/badges`}
      own={false}
    />
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 border-t border-line pt-5 text-left">{children}</div>;
}

function ProgressView({
  level,
  xp,
  xpIntoLevel,
  xpForNext,
  streak,
  featured,
  badgeCount,
  badgeTotal,
  badgesHref,
  own,
  unopenedChests = 0,
  onOpenChests,
}: ViewProps) {
  return (
    <Section>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <LevelPill level={level} size="lg" />
        {streak > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full py-0.5 pl-1 pr-2.5 text-[12.5px] font-semibold tabular-nums"
            style={{
              background: "color-mix(in srgb, var(--orange-vivid) 12%, transparent)",
              color: "var(--orange)",
            }}
            title={`${streak}-day study streak`}
          >
            <StreakFlame lit size={24} />
            {streak}-day streak
          </span>
        )}
      </div>

      <div className="mt-3">
        <XpBar
          xpIntoLevel={xpIntoLevel}
          xpForNext={xpForNext}
          leading={<span className="tabular-nums">{xp.toLocaleString()} XP total</span>}
        />
      </div>

      {featured.length > 0 ? (
        <div className="mt-4 flex flex-wrap justify-center gap-1">
          {featured.slice(0, 3).map((b) => (
            <BadgeTile key={b.code} badge={b} variant="compact" />
          ))}
        </div>
      ) : own ? (
        <Link
          to={badgesHref}
          className="mt-4 flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2.5 text-center text-[12.5px] text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
          style={{ border: "1px dashed var(--line)" }}
        >
          Pick up to 3 badges to show off here
        </Link>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Link
          to={badgesHref}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-accent transition-colors hover:bg-surface-hi"
        >
          All badges ({badgeCount}/{badgeTotal})
          <ChevronRight size={14} />
        </Link>
        {own && (
          <Link
            to="/profile/badges?tab=flairs"
            className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-accent transition-colors hover:bg-surface-hi"
          >
            Change flair
            <ChevronRight size={14} />
          </Link>
        )}
        {own && unopenedChests > 0 && (
          <button
            onClick={onOpenChests}
            disabled={!onOpenChests}
            className="btn btn-soft min-h-[40px]"
            aria-label={`Open ${unopenedChests} chest${unopenedChests === 1 ? "" : "s"}`}
          >
            <Gift size={14} />
            {unopenedChests === 1 ? "Open chest" : `Open ${unopenedChests} chests`}
          </button>
        )}
      </div>
    </Section>
  );
}

function ProgressSkeleton() {
  return (
    <Section>
      <div className="space-y-3" aria-hidden="true">
        <div className="flex justify-center">
          <Skeleton width={64} height={24} className="rounded-full" />
        </div>
        <Skeleton width="100%" height={8} className="rounded-full" />
        <div className="flex justify-between">
          <Skeleton width={90} height={10} />
          <Skeleton width={80} height={10} />
        </div>
        <div className="flex justify-center gap-4 pt-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={44} height={44} className="rounded-full" />
          ))}
        </div>
      </div>
    </Section>
  );
}
