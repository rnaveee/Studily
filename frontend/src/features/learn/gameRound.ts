import type { StudyCard } from "../../types";
import { shuffled } from "./shuffle";

export const ROUND_SIZE = 6;

export interface GameCard {
  key: string;
  front: string;
  back: string;
}

export interface Tile {
  id: string;
  pair: string;
  side: "term" | "definition";
  text: string;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function playableCards(cards: StudyCard[]): GameCard[] {
  const fronts = new Set<string>();
  const backs = new Set<string>();
  const out: GameCard[] = [];
  cards.forEach((c, i) => {
    const f = norm(c.front);
    const b = norm(c.back);
    if (!f || !b || fronts.has(f) || backs.has(b)) return;
    fronts.add(f);
    backs.add(b);
    out.push({ key: c.id != null ? String(c.id) : `i${i}`, front: c.front, back: c.back });
  });
  return out;
}

export function buildTiles(cards: GameCard[]): Tile[] {
  return shuffled(
    cards.flatMap((c) => [
      { id: `${c.key}:t`, pair: c.key, side: "term" as const, text: c.front },
      { id: `${c.key}:d`, pair: c.key, side: "definition" as const, text: c.back },
    ]),
  );
}

export function splitBoards(deck: GameCard[]): GameCard[][] {
  if (deck.length === 0) return [];
  const count = Math.ceil(deck.length / ROUND_SIZE);
  const boards: GameCard[][] = [];
  let start = 0;
  for (let i = 0; i < count; i++) {
    const size = Math.floor(deck.length / count) + (i < deck.length % count ? 1 : 0);
    boards.push(deck.slice(start, start + size));
    start += size;
  }
  return boards;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
