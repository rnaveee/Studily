import type { GpaScaleName } from "../types";

interface Band {
  min: number;
  letter: string;
  points: number;
}

export const GPA_SCALES: GpaScaleName[] = ["FOUR_POINT", "FOUR_THREE_THREE", "NINE_POINT", "UBC_PERCENT"];

export const GPA_SCALE_LABELS: Record<GpaScaleName, string> = {
  FOUR_POINT: "4.0 scale",
  FOUR_THREE_THREE: "4.33 scale (SFU)",
  NINE_POINT: "9-point scale (UVic)",
  UBC_PERCENT: "Percentage average (UBC)",
};

const BANDS: Record<GpaScaleName, Band[]> = {
  FOUR_POINT: [
    { min: 90, letter: "A+", points: 4.0 }, { min: 85, letter: "A", points: 4.0 },
    { min: 80, letter: "A-", points: 3.7 }, { min: 77, letter: "B+", points: 3.3 },
    { min: 73, letter: "B", points: 3.0 }, { min: 70, letter: "B-", points: 2.7 },
    { min: 67, letter: "C+", points: 2.3 }, { min: 63, letter: "C", points: 2.0 },
    { min: 60, letter: "C-", points: 1.7 }, { min: 50, letter: "D", points: 1.0 },
    { min: 0, letter: "F", points: 0 },
  ],
  FOUR_THREE_THREE: [
    { min: 95, letter: "A+", points: 4.33 }, { min: 90, letter: "A", points: 4.0 },
    { min: 85, letter: "A-", points: 3.67 }, { min: 80, letter: "B+", points: 3.33 },
    { min: 75, letter: "B", points: 3.0 }, { min: 70, letter: "B-", points: 2.67 },
    { min: 65, letter: "C+", points: 2.33 }, { min: 60, letter: "C", points: 2.0 },
    { min: 55, letter: "C-", points: 1.67 }, { min: 50, letter: "D", points: 1.0 },
    { min: 0, letter: "F", points: 0 },
  ],
  NINE_POINT: [
    { min: 90, letter: "A+", points: 9 }, { min: 85, letter: "A", points: 8 },
    { min: 80, letter: "A-", points: 7 }, { min: 77, letter: "B+", points: 6 },
    { min: 73, letter: "B", points: 5 }, { min: 70, letter: "B-", points: 4 },
    { min: 65, letter: "C+", points: 3 }, { min: 60, letter: "C", points: 2 },
    { min: 50, letter: "D", points: 1 }, { min: 35, letter: "E", points: 0 },
    { min: 0, letter: "F", points: 0 },
  ],
  UBC_PERCENT: [
    { min: 90, letter: "A+", points: 0 }, { min: 85, letter: "A", points: 0 },
    { min: 80, letter: "A-", points: 0 }, { min: 76, letter: "B+", points: 0 },
    { min: 72, letter: "B", points: 0 }, { min: 68, letter: "B-", points: 0 },
    { min: 64, letter: "C+", points: 0 }, { min: 60, letter: "C", points: 0 },
    { min: 55, letter: "C-", points: 0 }, { min: 50, letter: "D", points: 0 },
    { min: 0, letter: "F", points: 0 },
  ],
};

function bandFor(scale: GpaScaleName, percent: number): Band {
  const rounded = Math.round(percent);
  return BANDS[scale].find((b) => rounded >= b.min) ?? BANDS[scale][BANDS[scale].length - 1];
}

export function letterFor(scale: GpaScaleName, percent: number): string {
  return bandFor(scale, percent).letter;
}

export function pointsFor(scale: GpaScaleName, percent: number): number {
  if (scale === "UBC_PERCENT") return Math.max(0, Math.min(100, percent));
  return bandFor(scale, percent).points;
}

export function gpaFrom(
  scale: GpaScaleName,
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
