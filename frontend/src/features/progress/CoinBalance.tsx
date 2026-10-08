import { Link } from "react-router-dom";
import { Coins } from "lucide-react";
import { useMyProgress, useProgressEnabled } from "./useProgress";

const CHIP_MIN_W = 64;

export default function CoinBalance() {
  const enabled = useProgressEnabled();
  const progress = useMyProgress();
  if (!enabled) return null;

  if (!progress.data) {
    if (!progress.isLoading) return null;
    return (
      <span className="inline-flex h-10 shrink-0 items-center" aria-hidden="true">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
          style={{ minWidth: CHIP_MIN_W, background: "var(--surface-hi)", color: "var(--fg-3)" }}
        >
          <Coins size={13} strokeWidth={2.2} />
          <span className="h-[10px] w-7 rounded-full" style={{ background: "var(--line)" }} />
        </span>
      </span>
    );
  }

  const coins = progress.data.coins;

  return (
    <Link
      to="/profile/badges?tab=shop"
      className="inline-flex h-10 shrink-0 items-center rounded-full"
      aria-label={`${coins} coins, open the badge shop`}
      title="Coins · open the badge shop"
    >
      <span
        className="inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold tabular-nums transition-colors"
        style={{
          minWidth: CHIP_MIN_W,
          background: "color-mix(in srgb, var(--amber-vivid) 15%, transparent)",
          color: "var(--yellow)",
        }}
      >
        <Coins size={13} strokeWidth={2.2} />
        {coins.toLocaleString()}
      </span>
    </Link>
  );
}
