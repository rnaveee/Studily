import { useState } from "react";
import { Lock } from "lucide-react";
import { CATEGORY_COLOR } from "./badges";
import type { BadgeDto } from "../../types";

export default function BadgeArt({
  badge,
  size,
  locked,
  showLock = true,
}: {
  badge: BadgeDto;
  size: number;
  locked?: boolean;
  showLock?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const isLocked = locked ?? !badge.owned;
  const color = CATEGORY_COLOR[badge.category];
  const lockSize = Math.max(16, Math.round(size * 0.34));
  const filter = isLocked
    ? "grayscale(1) brightness(0.25)"
    : `drop-shadow(0 0 ${Math.max(4, Math.round(size / 7))}px color-mix(in srgb, var(--accent) 42%, transparent))`;

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {isLocked && (
        <span
          aria-hidden
          className="absolute inset-[-6%] rounded-full"
          style={{ background: "color-mix(in srgb, var(--fg-3) 14%, transparent)" }}
        />
      )}
      {failed ? (
        <span
          aria-hidden
          className="relative flex h-full w-full select-none items-center justify-center font-bold"
          style={{
            borderRadius: Math.round(size * 0.28),
            background: `linear-gradient(150deg, color-mix(in srgb, ${color} 72%, #ffffff), ${color})`,
            color: "#ffffff",
            fontSize: Math.round(size * 0.42),
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.35)",
            filter,
          }}
        >
          {badge.title.trim().charAt(0).toUpperCase() || "?"}
        </span>
      ) : (
        <img
          src={badge.imageUrl}
          alt=""
          draggable={false}
          loading="lazy"
          onError={() => setFailed(true)}
          className="relative h-full w-full select-none object-contain"
          style={{ filter }}
        />
      )}
      {isLocked && showLock && (
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full"
          style={{
            width: lockSize,
            height: lockSize,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            color: "var(--fg-2)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Lock size={Math.round(lockSize * 0.55)} strokeWidth={2.4} />
        </span>
      )}
    </span>
  );
}
