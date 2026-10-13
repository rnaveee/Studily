export type TermSep = "tab" | "comma";
export type RowSep = "newline" | "semicolon";
export type QuizletFormat = { term: TermSep; row: RowSep };
export type ImportedCard = { front: string; back: string };
export type ParseResult = { cards: ImportedCard[]; skipped: number };

export const MAX_CARDS_PER_SET = 500;
export const MAX_SIDE_LENGTH = 10000;

type Pair = [string, string];

const TIGHT_COMMA = /,(?!\s)/;
const TIGHT_SEMICOLONS = /;(?!\s)/g;

function normalize(raw: string) {
  return raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

export function detectFormat(raw: string): QuizletFormat {
  const text = normalize(raw);
  const term: TermSep = text.includes("\t") ? "tab" : "comma";
  const lines = text.split("\n").filter((l) => l.trim()).length;
  const tightSemicolons = countMatches(text, TIGHT_SEMICOLONS);
  const tabs = countMatches(text, /\t/g);
  const semicolon =
    lines > 0 && (text.endsWith(";") || tightSemicolons >= lines || (term === "tab" && tabs > lines));
  return { term, row: semicolon ? "semicolon" : "newline" };
}

function cutTab(row: string): Pair | null {
  const i = row.indexOf("\t");
  return i < 0 ? null : [row.slice(0, i), row.slice(i + 1)];
}

function commaCutter(rows: string[]) {
  const strict = rows.some((r) => TIGHT_COMMA.test(r));
  return (row: string): Pair | null => {
    const i = strict ? row.search(TIGHT_COMMA) : row.indexOf(",");
    return i < 0 ? null : [row.slice(0, i), row.slice(i + 1)];
  };
}

function joinRows(rows: string[], cut: (row: string) => Pair | null, glue: string) {
  const pairs: Pair[] = [];
  for (const row of rows) {
    const pair = cut(row);
    if (pair) pairs.push(pair);
    else if (pairs.length > 0) pairs[pairs.length - 1][1] += glue + row;
    else pairs.push([row, ""]);
  }
  return pairs;
}

function splitTabSemicolon(text: string) {
  const parts = text.split("\t");
  if (parts.length < 2) return [[text, ""] as Pair];
  const pairs: Pair[] = [];
  let front = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (i === parts.length - 1) {
      pairs.push([front, part.replace(/;$/, "")]);
      break;
    }
    const cut = part.lastIndexOf(";");
    if (cut < 0) {
      pairs.push([front, part]);
      front = "";
      continue;
    }
    pairs.push([front, part.slice(0, cut)]);
    front = part.slice(cut + 1);
  }
  return pairs;
}

export function parseQuizlet(raw: string, format: QuizletFormat): ParseResult {
  const text = normalize(raw);
  if (!text) return { cards: [], skipped: 0 };

  let pairs: Pair[];
  if (format.term === "tab" && format.row === "semicolon") {
    pairs = splitTabSemicolon(text);
  } else {
    const newline = format.row === "newline";
    const rows = (newline ? text.split("\n") : text.split(TIGHT_SEMICOLONS)).filter((r) => r.trim());
    const cut = format.term === "tab" ? cutTab : commaCutter(rows);
    pairs = joinRows(rows, cut, newline ? "\n" : ";");
  }

  const cards: ImportedCard[] = [];
  let skipped = 0;
  for (const [rawFront, rawBack] of pairs) {
    const front = rawFront.trim();
    const back = rawBack.trim();
    if (!front || !back || front.length > MAX_SIDE_LENGTH || back.length > MAX_SIDE_LENGTH) skipped++;
    else cards.push({ front, back });
  }
  return { cards, skipped };
}

export function splitIntoSets<T>(cards: T[]): T[][] {
  const parts = Math.max(1, Math.ceil(cards.length / MAX_CARDS_PER_SET));
  const size = Math.ceil(cards.length / parts);
  return Array.from({ length: parts }, (_, i) => cards.slice(i * size, (i + 1) * size));
}
