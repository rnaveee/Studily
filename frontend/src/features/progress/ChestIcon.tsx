import { Gift, PackageOpen } from "lucide-react";
import { CHEST_TIER_COLOR, CHEST_TIER_LABEL } from "./badges";
import type { ChestTier } from "../../types";

export default function ChestIcon({
  tier,
  size = 112,
  opened = false,
  className = "",
}: {
  tier: ChestTier;
  size?: number;
  opened?: boolean;
  className?: string;
}) {
  const color = CHEST_TIER_COLOR[tier];
  const Icon = opened ? PackageOpen : Gift;
  return (
    <span
      role="img"
      aria-label={CHEST_TIER_LABEL[tier]}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        background: `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${color} ${opened ? 34 : 26}%, var(--surface)) 0%, var(--surface) 78%)`,
        boxShadow: `inset 0 0 0 ${Math.max(1.5, size * 0.018)}px color-mix(in srgb, ${color} 70%, transparent), 0 ${size * 0.1}px ${size * 0.28}px -${size * 0.09}px color-mix(in srgb, ${color} 60%, transparent)`,
      }}
    >
      <Icon size={size * 0.46} strokeWidth={1.5} style={{ color }} />
    </span>
  );
}
