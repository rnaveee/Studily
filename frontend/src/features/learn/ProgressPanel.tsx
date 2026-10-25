import { Link } from "react-router-dom";
import { ChevronRight, Coins, ShoppingBag } from "lucide-react";
import { Skeleton } from "../../components/Skeleton";
import { offerChests } from "../../lib/progressDelta";
import ChestIcon from "../progress/ChestIcon";
import XpBar from "../progress/XpBar";
import { useChests, useMyProgress, useProgressEnabled } from "../progress/useProgress";

const tile = "flex min-h-[64px] min-w-0 items-center gap-2.5 rounded-xl px-3 py-3 text-left";

export default function ProgressPanel() {
  const enabled = useProgressEnabled();
  const progress = useMyProgress();
  const unopened = progress.data?.unopenedChests ?? 0;
  const chests = useChests(unopened > 0);

  if (!enabled) return null;
  if (!progress.data) {
    if (!progress.isLoading) return null;
    return (
      <section className="card card-raised @container p-4 sm:p-5 xl:col-span-full" aria-hidden="true">
        <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @4xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] @4xl:gap-4">
          <Skeleton height={64} className="col-span-2 rounded-xl @lg:col-span-3 @4xl:col-span-1" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={64} className={`rounded-xl ${i === 2 ? "col-span-2 @lg:col-span-1" : ""}`} />
          ))}
        </div>
      </section>
    );
  }

  const p = progress.data;
  const toNext = Math.max(0, p.xpForNext - p.xpIntoLevel);
  const firstChest = chests.data?.find((c) => !c.openedAt);
  const canOpen = unopened > 0 && !!chests.data;

  return (
    <section
      className="card card-raised @container p-4 sm:p-5 xl:col-span-full xl:p-4"
      aria-label="Your progress"
    >
      <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @4xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] @4xl:gap-4">
        <div className="col-span-2 flex min-w-0 items-center gap-4 @lg:col-span-3 @4xl:col-span-1 @4xl:pr-2">
          <div
            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl leading-none"
            style={{
              background: "color-mix(in srgb, var(--accent) 13%, transparent)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent)",
              color: "var(--accent)",
            }}
            aria-label={`Level ${p.level}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Lv</span>
            <span className="mt-0.5 text-[20px] font-bold tabular-nums">{p.level}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-semibold text-fg">Level {p.level}</span>
              <span className="truncate text-[12px] tabular-nums text-fg-3">
                {toNext.toLocaleString()} XP to level {p.level + 1}
              </span>
            </div>
            <XpBar
              xpIntoLevel={p.xpIntoLevel}
              xpForNext={p.xpForNext}
              height={10}
              leading={<span className="tabular-nums">{p.xp.toLocaleString()} XP total</span>}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => chests.data && offerChests(chests.data)}
          disabled={!canOpen}
          className={`${tile} transition-colors enabled:hover:bg-surface`}
          style={{
            background: unopened > 0 ? "color-mix(in srgb, var(--accent) 9%, var(--surface-hi))" : "var(--surface-hi)",
          }}
        >
          <ChestIcon
            tier={firstChest?.tier ?? "WOOD"}
            size={40}
            animate={unopened > 0}
            className={`shrink-0 ${unopened > 0 ? "" : "opacity-50 grayscale"}`}
          />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold tabular-nums text-fg">
              {unopened > 0 ? `${unopened} ${unopened === 1 ? "chest" : "chests"}` : "No chests"}
            </span>
            <span className="block truncate text-[11.5px] text-fg-3">
              {unopened > 0 ? "Tap to open" : "Keep studying"}
            </span>
          </span>
        </button>

        <div className={tile} style={{ background: "var(--surface-hi)" }}>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--amber-vivid) 15%, transparent)", color: "var(--yellow)" }}
          >
            <Coins size={20} strokeWidth={2.2} />
          </span>
          <span className="min-w-0">
            <span className="block text-[18px] font-bold leading-tight tabular-nums text-fg">
              {p.coins.toLocaleString()}
            </span>
            <span className="block text-[11.5px] text-fg-3">{p.coins === 1 ? "Coin" : "Coins"}</span>
          </span>
        </div>

        <Link
          to="/profile/badges?tab=shop"
          className={`${tile} col-span-2 transition-colors hover:bg-surface @lg:col-span-1`}
          style={{ background: "var(--surface-hi)" }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--red-vivid) 12%, transparent)", color: "var(--red-vivid)" }}
          >
            <ShoppingBag size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-fg">Shop</span>
            <span className="block truncate text-[11.5px] text-fg-3">Spend your coins</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-fg-3" />
        </Link>
      </div>
    </section>
  );
}
