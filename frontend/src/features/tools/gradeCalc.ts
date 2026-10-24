import { itemPercent, parseScoreInput, type GradeProjection } from "../../lib/grades";

export interface Item {
  id: number;
  name: string;
  mark: string;
}

export interface Section {
  id: number;
  name: string;
  weight: string;
  items: Item[];
}

export interface OtherItem {
  id: number;
  name: string;
  weight: string;
  mark: string;
}

export interface FinalExam {
  weight: string;
  mark: string;
}

export interface CalcState {
  sections: Section[];
  other: OtherItem[];
  final: FinalExam | null;
  target: string;
}

export interface SectionResult {
  id: number;
  name: string;
  weight: number;
  average: number | null;
  earned: number;
  gradedWeight: number;
  marked: number;
  count: number;
}

export interface Unmarked {
  name: string;
  weight: number;
}

export interface Summary extends GradeProjection {
  earned: number;
  markCount: number;
  sections: SectionResult[];
  other: { weight: number; average: number | null; marked: number; count: number };
  finalWeight: number | null;
  finalPercent: number | null;
  unmarked: Unmarked[];
}

export const STORAGE_KEY = "studily.gradeCalc";

export const EXAMPLE: CalcState = {
  sections: [
    {
      id: 1,
      name: "Assignments",
      weight: "10",
      items: [
        { id: 11, name: "Assignment 1", mark: "18/20" },
        { id: 12, name: "Assignment 2", mark: "15/20" },
        { id: 13, name: "Assignment 3", mark: "12/20" },
      ],
    },
    {
      id: 2,
      name: "Midterms",
      weight: "30",
      items: [
        { id: 21, name: "Midterm 1", mark: "20/30" },
        { id: 22, name: "Midterm 2", mark: "19/30" },
      ],
    },
    {
      id: 3,
      name: "Tutorials",
      weight: "10",
      items: [
        { id: 31, name: "Tutorial 1", mark: "9/10" },
        { id: 32, name: "Tutorial 2", mark: "10/10" },
      ],
    },
  ],
  other: [],
  final: { weight: "50", mark: "" },
  target: "80",
};

export function blankState(nextId: () => number, target = EXAMPLE.target): CalcState {
  return {
    sections: [
      { id: nextId(), name: "Assignments", weight: "", items: [{ id: nextId(), name: "Assignment 1", mark: "" }] },
    ],
    other: [],
    final: { weight: "", mark: "" },
    target,
  };
}

export function toNumber(raw: string): number | null {
  const text = raw.trim().replace(/%$/, "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function markPercent(mark: string): number | null {
  const parsed = parseScoreInput(mark);
  return parsed == null ? null : itemPercent(parsed);
}

function weightOf(raw: string): number {
  return Math.max(0, toNumber(raw) ?? 0);
}

export function singular(name: string): string {
  const n = name.trim();
  if (!n) return "Item";
  if (/zzes$/i.test(n)) return n.slice(0, -3);
  if (/[^aeiou]ies$/i.test(n)) return `${n.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes)$/i.test(n)) return n.slice(0, -2);
  if (/s$/i.test(n) && !/ss$/i.test(n)) return n.slice(0, -1);
  return n;
}

export function nextItemName(section: Section): string {
  return `${singular(section.name)} ${section.items.length + 1}`;
}

export function summarize(state: CalcState): Summary {
  let earned = 0;
  let gradedWeight = 0;
  let totalWeight = 0;
  let markCount = 0;
  const unmarked: Unmarked[] = [];

  const sections = state.sections.map((section): SectionResult => {
    const weight = weightOf(section.weight);
    totalWeight += weight;
    const count = section.items.length;
    const share = count > 0 ? weight / count : 0;
    let sectionEarned = 0;
    let sectionGraded = 0;
    let sum = 0;
    let marked = 0;
    for (const item of section.items) {
      const percent = markPercent(item.mark);
      if (percent == null) continue;
      marked++;
      sum += percent;
      sectionEarned += (percent * share) / 100;
      sectionGraded += share;
    }
    markCount += marked;
    earned += sectionEarned;
    gradedWeight += sectionGraded;
    const open = count === 0 ? weight : share * (count - marked);
    if (open > 0.0001) unmarked.push({ name: section.name.trim() || "Untitled section", weight: open });
    return {
      id: section.id,
      name: section.name,
      weight,
      average: marked > 0 ? sum / marked : null,
      earned: sectionEarned,
      gradedWeight: sectionGraded,
      marked,
      count,
    };
  });

  let otherWeight = 0;
  let otherEarned = 0;
  let otherGraded = 0;
  let otherMarked = 0;
  for (const item of state.other) {
    const weight = weightOf(item.weight);
    otherWeight += weight;
    const percent = markPercent(item.mark);
    if (percent == null) {
      if (weight > 0) unmarked.push({ name: item.name.trim() || "Other item", weight });
      continue;
    }
    markCount++;
    otherMarked++;
    otherEarned += (percent * weight) / 100;
    otherGraded += weight;
  }
  totalWeight += otherWeight;
  earned += otherEarned;
  gradedWeight += otherGraded;

  let finalWeight: number | null = null;
  let finalPercent: number | null = null;
  if (state.final) {
    finalWeight = weightOf(state.final.weight);
    totalWeight += finalWeight;
    finalPercent = markPercent(state.final.mark);
    if (finalPercent != null) {
      markCount++;
      earned += (finalPercent * finalWeight) / 100;
      gradedWeight += finalWeight;
    }
  }

  return {
    percent: gradedWeight > 0 ? (earned / gradedWeight) * 100 : null,
    gradedWeight,
    totalWeight,
    earned,
    markCount,
    sections,
    other: {
      weight: otherWeight,
      average: otherGraded > 0 ? (otherEarned / otherGraded) * 100 : null,
      marked: otherMarked,
      count: state.other.length,
    },
    finalWeight,
    finalPercent,
    unmarked,
  };
}

export function neededOnFinal(summary: Summary, target: number): number | null {
  const final = summary.finalWeight;
  if (final == null || final <= 0 || summary.finalPercent != null || summary.percent == null) return null;
  const base = Math.max(100, summary.totalWeight);
  return (((target * base) / 100 - (summary.percent * (base - final)) / 100) / final) * 100;
}

function str(value: unknown, max: number): string | null {
  return typeof value === "string" ? value.slice(0, max) : null;
}

function readItem(value: unknown): Item | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v.id !== "number") return null;
  const name = str(v.name, 80);
  const mark = str(v.mark, 20);
  return name == null || mark == null ? null : { id: v.id, name, mark };
}

function readOther(value: unknown): OtherItem | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v.id !== "number") return null;
  const name = str(v.name, 80);
  const weight = str(v.weight, 12);
  const mark = str(v.mark, 20);
  return name == null || weight == null || mark == null ? null : { id: v.id, name, weight, mark };
}

function readSection(value: unknown): Section | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v.id !== "number" || !Array.isArray(v.items)) return null;
  const name = str(v.name, 80);
  const weight = str(v.weight, 12);
  if (name == null || weight == null) return null;
  const items: Item[] = [];
  for (const raw of v.items.slice(0, 50)) {
    const item = readItem(raw);
    if (!item) return null;
    items.push(item);
  }
  return { id: v.id, name, weight, items };
}

export function parseSaved(raw: string | null): CalcState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    if (!data) return null;
    const target = str(data.target, 12) ?? EXAMPLE.target;
    if (data.v === 2) {
      if (!Array.isArray(data.sections) || !Array.isArray(data.other)) return null;
      const sections: Section[] = [];
      for (const s of data.sections.slice(0, 20)) {
        const section = readSection(s);
        if (!section) return null;
        sections.push(section);
      }
      const other: OtherItem[] = [];
      for (const o of data.other.slice(0, 50)) {
        const item = readOther(o);
        if (!item) return null;
        other.push(item);
      }
      let final: FinalExam | null = null;
      if (data.final != null) {
        const f = data.final as Record<string, unknown>;
        const weight = str(f.weight, 12);
        const mark = str(f.mark, 20);
        if (weight == null || mark == null) return null;
        final = { weight, mark };
      }
      return { sections, other, final, target };
    }
    if (Array.isArray(data.rows)) {
      const other: OtherItem[] = [];
      for (const r of data.rows.slice(0, 50)) {
        const item = readOther(r);
        if (!item) return null;
        other.push(item);
      }
      return { sections: [], other, final: null, target };
    }
    return null;
  } catch {
    return null;
  }
}

export function serialize(state: CalcState): string {
  return JSON.stringify({ v: 2, ...state });
}

export function maxId(state: CalcState): number {
  let max = 0;
  for (const s of state.sections) {
    max = Math.max(max, s.id);
    for (const i of s.items) max = Math.max(max, i.id);
  }
  for (const o of state.other) max = Math.max(max, o.id);
  return max;
}
