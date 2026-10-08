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
