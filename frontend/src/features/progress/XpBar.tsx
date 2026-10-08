import type { ReactNode } from "react";

export default function XpBar({
  xpIntoLevel,
  xpForNext,
  height = 8,
  leading,
  showLabel = true,
}: {
  xpIntoLevel: number;
  xpForNext: number;
  height?: number;
  leading?: ReactNode;
  showLabel?: boolean;
}) {
  const fill = xpForNext > 0 ? Math.min(1, Math.max(0, xpIntoLevel / xpForNext)) : 0;

  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-label="XP toward the next level"
        aria-valuemin={0}
        aria-valuemax={xpForNext}
        aria-valuenow={xpIntoLevel}
        className="relative w-full overflow-hidden rounded-full"
        style={{ height, background: "var(--surface-hi)", boxShadow: "var(--control-inset)" }}
      >
        <div
          className="xp-fill xp-grow h-full rounded-full"
          style={{
            width: `${fill * 100}%`,
            minWidth: fill > 0 ? height : 0,
            background: "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent-2) 70%, var(--accent)))",
            boxShadow: "0 0 8px color-mix(in srgb, var(--accent) 40%, transparent)",
          }}
        />
      </div>
      {showLabel && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-fg-3">
          <span className="min-w-0 truncate">{leading}</span>
          <span className="shrink-0 tabular-nums">
            <span className="font-semibold text-fg-2">{xpIntoLevel}</span> / {xpForNext} XP
          </span>
        </div>
      )}
    </div>
  );
}
