import { Link } from "react-router-dom";
import { ChevronRight, Coins, Gift, Trophy } from "lucide-react";
import { Skeleton } from "../../components/Skeleton";
import { offerChests } from "../../lib/progressDelta";
import BadgeTile from "./BadgeTile";
import LevelPill from "./LevelPill";
import StreakFlame from "./StreakFlame";
import XpBar from "./XpBar";
import { useChests, useMyProgress, useUserProgress } from "./useProgress";
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
  own?: { coins: number; unopenedChests: number };
}

export function MyProgressCard() {
  const progress = useMyProgress();
  const hasChests = (progress.data?.unopenedChests ?? 0) > 0;
  const chests = useChests(hasChests);

  if (progress.isLoading) return <ProgressCardSkeleton />;
  if (!progress.data) {
    if (!progress.isError) return null;
    return (
      <div className="card flex items-center justify-between gap-3 px-5 py-4">
        <p className="text-[13px] text-fg-3">Couldn't load your progress.</p>
        <button onClick={() => progress.refetch()} className="btn btn-ghost min-h-[40px]">
          Retry
        </button>
      </div>
    );
  }

  const p = progress.data;
  return (
    <ProgressCardView
      level={p.level}
      xp={p.xp}
      xpIntoLevel={p.xpIntoLevel}
      xpForNext={p.xpForNext}
      streak={p.streak.current}
      featured={p.featuredBadges}
      badgeCount={p.badgeCount}
      badgeTotal={p.badgeTotal}
      badgesHref="/profile/badges"
      own={{ coins: p.coins, unopenedChests: p.unopenedChests }}
      onOpenChests={chests.data && chests.data.length > 0 ? () => offerChests(chests.data!) : undefined}
    />
  );
}

export function UserProgressCard({ userId }: { userId: number }) {
  const progress = useUserProgress(userId);

  if (progress.isLoading) return <ProgressCardSkeleton />;
  if (!progress.data) return null;

  const p = progress.data;
  return (
    <ProgressCardView
      level={p.level}
      xp={p.xp}
      xpIntoLevel={p.xpIntoLevel}
      xpForNext={p.xpForNext}
      streak={p.streakCurrent}
      featured={p.featuredBadges}
      badgeCount={p.badgeCount}
      badgeTotal={p.badgeTotal}
      badgesHref={`/users/${userId}/badges`}
    />
  );
}

function ProgressCardView({
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
  onOpenChests,
}: ViewProps & { onOpenChests?: () => void }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
          <Trophy size={14} className="text-fg-3" />
          Progress
        </h3>
        {streak > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full py-0.5 pl-1 pr-2.5 text-[12px] font-semibold tabular-nums"
            style={{
              background: "color-mix(in srgb, var(--orange-vivid) 12%, transparent)",
              color: "var(--orange)",
            }}
            title={`${streak}-day study streak`}
          >
            <StreakFlame lit size={22} />
            {streak} day{streak === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="px-5 pb-4 pt-3">
        <XpBar
          xpIntoLevel={xpIntoLevel}
          xpForNext={xpForNext}
          leading={
            <span className="inline-flex items-center gap-2">
              <LevelPill level={level} />
              <span className="tabular-nums">{xp.toLocaleString()} XP total</span>
            </span>
          }
        />

        {featured.length > 0 ? (
          <div className="mt-4 flex flex-wrap justify-center gap-1 sm:justify-start">
            {featured.slice(0, 3).map((b) => (
              <BadgeTile key={b.code} badge={b} variant="compact" />
            ))}
          </div>
        ) : own ? (
          <Link
            to={badgesHref}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[12.5px] text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
            style={{ border: "1px dashed var(--line)" }}
          >
            Pick up to 3 badges to show off here
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
        <Link
          to={badgesHref}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-accent transition-colors hover:bg-surface-hi"
        >
          All badges ({badgeCount}/{badgeTotal})
          <ChevronRight size={14} />
        </Link>
        {own && (
          <div className="ml-auto flex items-center gap-1.5">
            <span
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold tabular-nums"
              style={{ background: "color-mix(in srgb, var(--amber-vivid) 14%, transparent)", color: "var(--yellow)" }}
              title="Coins"
            >
              <Coins size={13} />
              {own.coins.toLocaleString()}
            </span>
            {own.unopenedChests > 0 && (
              <button
                onClick={onOpenChests}
                disabled={!onOpenChests}
                className="btn btn-soft min-h-[40px]"
                aria-label={`Open ${own.unopenedChests} chest${own.unopenedChests === 1 ? "" : "s"}`}
              >
                <Gift size={14} />
                {own.unopenedChests === 1 ? "Open chest" : `${own.unopenedChests} chests`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressCardSkeleton() {
  return (
    <div className="card space-y-4 px-5 py-4" aria-hidden="true">
      <Skeleton width={84} height={13} />
      <div className="space-y-2">
        <Skeleton width="100%" height={8} className="rounded-full" />
        <div className="flex justify-between">
          <Skeleton width={110} height={10} />
          <Skeleton width={80} height={10} />
        </div>
      </div>
      <div className="flex gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={44} height={44} className="rounded-full" />
        ))}
      </div>
    </div>
  );
}
