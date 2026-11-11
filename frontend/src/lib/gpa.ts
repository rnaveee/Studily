import type { GpaScaleName, GradeBand, PresetScaleName } from "../types";

export const GPA_SCALES: PresetScaleName[] = ["FOUR_POINT", "FOUR_THREE_THREE", "NINE_POINT", "UBC_PERCENT"];

export const GPA_SCALE_LABELS: Record<GpaScaleName, string> = {
  FOUR_POINT: "4.0 scale",
  FOUR_THREE_THREE: "4.33 scale",
  NINE_POINT: "9-point scale",
  UBC_PERCENT: "Percentage average",
  CUSTOM: "Custom scale",
};

export const PRESET_BANDS: Record<PresetScaleName, GradeBand[]> = {
  FOUR_POINT: [
    { minPercent: 90, letter: "A+", points: 4.0 }, { minPercent: 85, letter: "A", points: 4.0 },
    { minPercent: 80, letter: "A-", points: 3.7 }, { minPercent: 77, letter: "B+", points: 3.3 },
    { minPercent: 73, letter: "B", points: 3.0 }, { minPercent: 70, letter: "B-", points: 2.7 },
    { minPercent: 67, letter: "C+", points: 2.3 }, { minPercent: 63, letter: "C", points: 2.0 },
    { minPercent: 60, letter: "C-", points: 1.7 }, { minPercent: 50, letter: "D", points: 1.0 },
    { minPercent: 0, letter: "F", points: 0 },
  ],
  FOUR_THREE_THREE: [
    { minPercent: 95, letter: "A+", points: 4.33 }, { minPercent: 90, letter: "A", points: 4.0 },
    { minPercent: 85, letter: "A-", points: 3.67 }, { minPercent: 80, letter: "B+", points: 3.33 },
    { minPercent: 75, letter: "B", points: 3.0 }, { minPercent: 70, letter: "B-", points: 2.67 },
    { minPercent: 65, letter: "C+", points: 2.33 }, { minPercent: 60, letter: "C", points: 2.0 },
    { minPercent: 55, letter: "C-", points: 1.67 }, { minPercent: 50, letter: "D", points: 1.0 },
    { minPercent: 0, letter: "F", points: 0 },
  ],
  NINE_POINT: [
    { minPercent: 90, letter: "A+", points: 9 }, { minPercent: 85, letter: "A", points: 8 },
    { minPercent: 80, letter: "A-", points: 7 }, { minPercent: 77, letter: "B+", points: 6 },
    { minPercent: 73, letter: "B", points: 5 }, { minPercent: 70, letter: "B-", points: 4 },
    { minPercent: 65, letter: "C+", points: 3 }, { minPercent: 60, letter: "C", points: 2 },
    { minPercent: 50, letter: "D", points: 1 }, { minPercent: 35, letter: "E", points: 0 },
    { minPercent: 0, letter: "F", points: 0 },
  ],
  UBC_PERCENT: [
    { minPercent: 90, letter: "A+", points: 0 }, { minPercent: 85, letter: "A", points: 0 },
    { minPercent: 80, letter: "A-", points: 0 }, { minPercent: 76, letter: "B+", points: 0 },
    { minPercent: 72, letter: "B", points: 0 }, { minPercent: 68, letter: "B-", points: 0 },
    { minPercent: 64, letter: "C+", points: 0 }, { minPercent: 60, letter: "C", points: 0 },
    { minPercent: 55, letter: "C-", points: 0 }, { minPercent: 50, letter: "D", points: 0 },
    { minPercent: 0, letter: "F", points: 0 },
  ],
};

function bandFor(scale: PresetScaleName, percent: number): GradeBand {
  const rounded = Math.round(percent);
  const bands = PRESET_BANDS[scale];
  return bands.find((b) => rounded >= b.minPercent) ?? bands[bands.length - 1];
}

export function letterFor(scale: PresetScaleName, percent: number): string {
  return bandFor(scale, percent).letter;
}

export function pointsFor(scale: PresetScaleName, percent: number): number {
  if (scale === "UBC_PERCENT") return Math.max(0, Math.min(100, percent));
  return bandFor(scale, percent).points;
}

export function gpaFrom(
  scale: PresetScaleName,
  entries: { percent: number; credits?: number | null }[],
): number | null {
  let weighted = 0;
  let total = 0;
  for (const e of entries) {
    const weight = e.credits ?? 1;
    weighted += pointsFor(scale, e.percent) * weight;
    total += weight;
  }
  return total > 0 ? weighted / total : null;
}

export function formatGpa(value: number | null | undefined, scale: GpaScaleName): string {
  if (value == null) return "—";
  return scale === "UBC_PERCENT" ? `${value.toFixed(1)}%` : value.toFixed(2);
}

export function formatPoints(value: number | null | undefined, scale: GpaScaleName): string {
  if (value == null) return "—";
  if (scale === "UBC_PERCENT") return `${value.toFixed(1)}%`;
  return scale === "NINE_POINT" ? String(value) : value.toFixed(2);
}

export interface BandIssue {
  row: number | null;
  field: "letter" | "minPercent" | "points" | null;
  message: string;
}

function validMin(b: GradeBand): boolean {
  return Number.isInteger(b.minPercent) && b.minPercent >= 0 && b.minPercent <= 100;
}

export function validateBands(bands: GradeBand[]): BandIssue[] {
  const issues: BandIssue[] = [];
  if (bands.length < 2) issues.push({ row: null, field: null, message: "Add at least 2 rows" });
  if (bands.length > 20) issues.push({ row: null, field: null, message: "Use at most 20 rows" });

  const mins = new Map<number, number>();
  const letters = new Map<string, number>();
  bands.forEach((b, i) => {
    if (!validMin(b)) {
      issues.push({ row: i, field: "minPercent", message: "Percent must be a whole number from 0 to 100" });
    } else if (mins.has(b.minPercent)) {
      issues.push({ row: i, field: "minPercent", message: `Two rows start at ${b.minPercent}%` });
    } else {
      mins.set(b.minPercent, i);
    }

    const letter = (b.letter ?? "").trim();
    if (letter.length < 1 || letter.length > 4) {
      issues.push({ row: i, field: "letter", message: "Letter must be 1 to 4 characters" });
    } else if (letters.has(letter)) {
      issues.push({ row: i, field: "letter", message: `Two rows use the letter ${letter}` });
    } else {
      letters.set(letter, i);
    }

    if (typeof b.points !== "number" || !Number.isFinite(b.points) || b.points < 0 || b.points > 20) {
      issues.push({ row: i, field: "points", message: "Points must be between 0 and 20" });
    }
  });

  if (bands.length > 0 && !bands.some((b) => b.minPercent === 0)) {
    issues.push({ row: null, field: null, message: "Add a row that starts at 0%" });
  }

  const sorted = bands
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => validMin(b) && typeof b.points === "number" && Number.isFinite(b.points))
    .sort((x, y) => y.b.minPercent - x.b.minPercent);
  for (let k = 1; k < sorted.length; k++) {
    const prev = sorted[k - 1];
    const cur = sorted[k];
    if (prev.b.minPercent !== cur.b.minPercent && cur.b.points > prev.b.points) {
      issues.push({ row: cur.i, field: "points", message: "Points can't go up as the percent goes down" });
    }
  }
  return issues;
}

export function rangesFor(bands: GradeBand[]): string[] {
  const counts = new Map<number, number>();
  for (const b of bands) if (validMin(b)) counts.set(b.minPercent, (counts.get(b.minPercent) ?? 0) + 1);
  const usable = [...counts.entries()].filter(([, n]) => n === 1).map(([m]) => m).sort((a, b) => b - a);
  return bands.map((b) => {
    if (!validMin(b) || counts.get(b.minPercent) !== 1) return "—";
    const idx = usable.indexOf(b.minPercent);
    if (idx === 0) return `${b.minPercent}%+`;
    const top = usable[idx - 1] - 1;
    return top === b.minPercent ? `${b.minPercent}%` : `${b.minPercent}–${top}%`;
  });
}

export function gradeFor(bands: GradeBand[], percent: number): GradeBand | null {
  const rounded = Math.round(percent);
  const sorted = bands.filter(validMin).sort((a, b) => b.minPercent - a.minPercent);
  return sorted.find((b) => rounded >= b.minPercent) ?? null;
}

export function normalizeBands(bands: GradeBand[]): GradeBand[] {
  return bands
    .map((b) => ({
      minPercent: b.minPercent,
      letter: b.letter.trim(),
      points: Math.round(b.points * 100) / 100,
    }))
    .sort((a, b) => b.minPercent - a.minPercent);
}
