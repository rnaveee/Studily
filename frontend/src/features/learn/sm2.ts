import type { Flashcard, ReviewGrade } from "../../types";

const QUALITY: Record<ReviewGrade, number> = { AGAIN: 0, HARD: 3, GOOD: 4, EASY: 5 };

export function isDue(card: Flashcard, now = Date.now()): boolean {
  return !card.dueAt || new Date(card.dueAt).getTime() <= now;
}

export function nextIntervalDays(card: Flashcard, grade: ReviewGrade): number {
  if (grade === "AGAIN") return 0;
  const reps = (card.repetitions ?? 0) + 1;
  if (reps === 1) return 1;
  if (reps === 2) return 6;
  const q = QUALITY[grade];
  const ef = Math.max(1.3, (card.easeFactor ?? 2.5) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return Math.round((card.intervalDays ?? 0) * ef);
}

export function intervalLabel(days: number): string {
  if (days <= 0) return "again now";
  if (days === 1) return "tomorrow";
  if (days < 30) return `in ${days} days`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? "in 1 month" : `in ${months} months`;
  }
  return `in ${(days / 365).toFixed(1)} years`;
}
