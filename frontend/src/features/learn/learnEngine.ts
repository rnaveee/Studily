import type { StudyCard } from "../../types";
import { shuffled } from "./shuffle";

export const LEARN_ROUND_SIZE = 7;
const LONG_ANSWER = 80;

export type Level = 0 | 1 | 2;

export interface LearnCard {
  key: string;
  front: string;
  back: string;
}

export type Question =
  | { kind: "choice"; card: LearnCard; prompt: string; options: string[]; answer: string }
  | { kind: "truefalse"; card: LearnCard; prompt: string; statement: string; isTrue: boolean; answer: string }
  | { kind: "written"; card: LearnCard; prompt: string; answer: string }
  | { kind: "recall"; card: LearnCard; prompt: string; answer: string };

export interface LearnProgress {
  levels: Record<string, Level>;
  round: number;
}

export type Verdict = "correct" | "close" | "wrong";

export function learnCards(cards: StudyCard[]): LearnCard[] {
  return cards
    .map((c, i) => ({ key: c.id != null ? String(c.id) : `i${i}`, front: c.front, back: c.back }))
    .filter((c) => c.front.trim() && c.back.trim());
}

export function storageKey(viewerKey: string, setId: number): string {
  return `studily.learn.${viewerKey}.${setId}`;
}

export function restoreProgress(saved: LearnProgress | null, cards: LearnCard[]): LearnProgress {
  const levels: Record<string, Level> = {};
  for (const c of cards) {
    const level = saved?.levels?.[c.key];
    levels[c.key] = level === 1 || level === 2 ? level : 0;
  }
  const round = saved && Number.isInteger(saved.round) && saved.round > 0 ? saved.round : 1;
  return { levels, round };
}

export function levelCounts(cards: LearnCard[], levels: Record<string, Level>) {
  const counts = { learning: 0, familiar: 0, mastered: 0 };
  for (const c of cards) {
    const l = levels[c.key] ?? 0;
    if (l === 2) counts.mastered++;
    else if (l === 1) counts.familiar++;
    else counts.learning++;
  }
  return counts;
}

export function pickRound(
  cards: LearnCard[],
  levels: Record<string, Level>,
  lastAsked: Record<string, number>,
): string[] {
  const pool = cards
    .map((c, i) => ({ key: c.key, level: levels[c.key] ?? 0, seen: lastAsked[c.key] ?? -1, i }))
    .sort((a, b) => a.seen - b.seen || a.i - b.i);
  const familiar = pool.filter((c) => c.level === 1);
  const fresh = pool.filter((c) => c.level === 0);
  const recallSlots = Math.min(familiar.length, Math.ceil(LEARN_ROUND_SIZE / 2));
  let picked = [...familiar.slice(0, recallSlots), ...fresh.slice(0, LEARN_ROUND_SIZE - recallSlots)];
  if (picked.length < LEARN_ROUND_SIZE) {
    picked = [...picked, ...familiar.slice(recallSlots, recallSlots + LEARN_ROUND_SIZE - picked.length)];
  }
  return shuffled(picked.map((c) => c.key));
}

function normText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function otherBacks(card: LearnCard, cards: LearnCard[]): string[] {
  const own = normText(card.back);
  const seen = new Set<string>([own]);
  const out: string[] = [];
  for (const c of cards) {
    const n = normText(c.back);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(c.back);
  }
  return out;
}

export function buildQuestion(card: LearnCard, level: Level, cards: LearnCard[]): Question {
  if (level >= 1) {
    const frontLonger = card.front.trim().length > card.back.trim().length;
    const prompt = frontLonger ? card.front : card.back;
    const answer = frontLonger ? card.back : card.front;
    if (normalizeAnswer(answer).length > LONG_ANSWER) {
      return { kind: "recall", card, prompt, answer };
    }
    return { kind: "written", card, prompt, answer };
  }

  const others = otherBacks(card, cards);
  if (others.length >= 3 && Math.random() >= 1 / 3) {
    const options = shuffled([card.back, ...shuffled(others).slice(0, 3)]);
    return { kind: "choice", card, prompt: card.front, options, answer: card.back };
  }

  const isTrue = others.length === 0 || Math.random() < 0.5;
  const statement = isTrue ? card.back : shuffled(others)[0];
  return { kind: "truefalse", card, prompt: card.front, statement, isTrue, answer: card.back };
}

export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(a|an|the) /, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function gradeWritten(input: string, answer: string): Verdict {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(answer);
  if (!b) return input.trim().toLowerCase() === answer.trim().toLowerCase() ? "correct" : "wrong";
  if (!a) return "wrong";
  if (a === b) return "correct";
  const tolerance = b.length <= 3 ? 0 : b.length <= 6 ? 1 : 2;
  return levenshtein(a, b) <= tolerance ? "close" : "wrong";
}

export function nextLevel(level: Level, correct: boolean): Level {
  if (correct) return (level >= 1 ? 2 : 1) as Level;
  return (level === 2 ? 1 : 0) as Level;
}
