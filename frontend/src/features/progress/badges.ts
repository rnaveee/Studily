import type { BadgeCategory, BadgeDto, ChestSource } from "../../types";

export const CATEGORY_ORDER: BadgeCategory[] = ["LEVEL", "STUDY", "FLASHCARDS", "SOCIAL", "TENURE", "COSMETIC"];

export const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  LEVEL: "Levels",
  STUDY: "Study sessions",
  FLASHCARDS: "Flashcards",
  SOCIAL: "Friends",
  TENURE: "Membership",
  COSMETIC: "Cosmetics",
};

export const CATEGORY_COLOR: Record<BadgeCategory, string> = {
  LEVEL: "var(--accent)",
  STUDY: "var(--orange-vivid)",
  FLASHCARDS: "var(--green)",
  SOCIAL: "var(--blue-vivid)",
  TENURE: "var(--amber-vivid)",
  COSMETIC: "var(--red-vivid)",
};

const EARN_HINT: Record<BadgeCategory, string> = {
  LEVEL: "Earn XP from study sessions, flashcard runs and new friends to level up.",
  STUDY: "Start a study session on Study and check in after each block.",
  FLASHCARDS: "Finish flashcard runs of 5 or more cards.",
  SOCIAL: "Add friends on Studily.",
  TENURE: "Unlocks with time as a Studily member.",
  COSMETIC: "",
};

const BADGE_TIER: Record<string, number> = {
  level_1: 0, level_5: 1, level_10: 2, level_20: 3, level_30: 4, level_50: 5, level_75: 5, level_100: 6,
  first_session: 0, hours_10: 2, streak_7: 3, hours_100: 4, streak_30: 5,
  runs_10: 1, runs_100: 3,
  friends_5: 1, friends_10: 2, friends_20: 3, friends_50: 4, schoolmates_10: 2,
  member_1m: 1, member_6m: 3, member_1y: 4, og: 6,
  cosmetic_spark: 2, cosmetic_comet: 3, cosmetic_crown: 5,
};

const TIER_GLOW = ["wood", "bronze", "silver", "gold", "diamond", "ruby"];

export function badgeGlow(code: string, size: number): string {
  const rank = BADGE_TIER[code] ?? 2;
  const alpha = 26 + 10 * rank;
  if (rank >= 6) {
    const b = Math.max(2, Math.round(size * 0.05));
    return ["red", "blue", "violet"]
      .map((c) => `drop-shadow(0 0 ${b}px color-mix(in srgb, var(--badge-glow-obsidian-${c}) 45%, transparent))`)
      .join(" ");
  }
  const blur = Math.max(2, Math.round(size * (0.02 + 0.024 * rank)));
  return `drop-shadow(0 0 ${blur}px color-mix(in srgb, var(--badge-glow-${TIER_GLOW[rank]}) ${alpha}%, transparent))`;
}

export function howToEarn(badge: BadgeDto): string {
  if (badge.category === "COSMETIC") {
    return badge.priceCoins != null
      ? `Buy it in the Shop for ${badge.priceCoins} coins, or find it in a chest.`
      : "Find it in a chest.";
  }
  return EARN_HINT[badge.category];
}

export function groupBadges(badges: BadgeDto[]): { category: BadgeCategory; badges: BadgeDto[] }[] {
  return CATEGORY_ORDER.map((category) => {
    const inCategory = badges.filter((b) => b.category === category);
    const owned = inCategory.filter((b) => b.owned);
    const locked = inCategory.filter((b) => !b.owned);
    return { category, badges: [...owned, ...locked] };
  }).filter((g) => g.badges.length > 0);
}

export function formatAcquired(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export const CHEST_SOURCE_LABEL: Record<ChestSource, string> = {
  LEVEL: "Level-up reward",
  STREAK: "Streak reward",
  SESSION: "Study session bonus",
  FLASHCARD: "Flashcard bonus",
};
