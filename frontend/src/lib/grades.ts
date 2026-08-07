import type { AcademicItem } from "../types";

export interface Scored {
  score?: number | null;
  maxScore?: number | null;
  weight?: number | null;
}

export interface CourseGradeSummary {
  percent: number | null;
  gradedWeight: number;
  totalWeight: number;
  gradedCount: number;
  itemCount: number;
}

export function itemPercent(item: Scored): number | null {
  if (item.score == null || item.maxScore == null || item.maxScore <= 0) return null;
  return (item.score / item.maxScore) * 100;
}

export function courseGrade(items: AcademicItem[]): CourseGradeSummary {
  let weightedSum = 0;
  let gradedWeight = 0;
  let totalWeight = 0;
  let points = 0;
  let maxPoints = 0;
  let gradedCount = 0;

  for (const item of items) {
    const weight = item.weight ?? 0;
    totalWeight += weight;

    const percent = itemPercent(item);
    if (percent == null) continue;

    gradedCount++;
    points += item.score!;
    maxPoints += item.maxScore!;
    if (weight > 0) {
      weightedSum += percent * weight;
      gradedWeight += weight;
    }
  }

  const percent =
    gradedWeight > 0
      ? weightedSum / gradedWeight
      : maxPoints > 0
        ? (points / maxPoints) * 100
        : null;

  return { percent, gradedWeight, totalWeight, gradedCount, itemCount: items.length };
}

export function parseScoreInput(raw: string): { score: number; maxScore: number } | null {
  const text = raw.trim().replace(/%$/, "").trim();
  if (!text) return null;

  const slash = text.split("/");
  if (slash.length === 2) {
    const score = Number(slash[0].trim());
    const maxScore = Number(slash[1].trim());
    if (!Number.isFinite(score) || !Number.isFinite(maxScore)) return null;
    if (score < 0 || maxScore <= 0) return null;
    return { score, maxScore };
  }

  const score = Number(text);
  if (!Number.isFinite(score) || score < 0) return null;
  return { score, maxScore: 100 };
}

export function formatScore(item: Scored): string {
  if (item.score == null) return "";
  return item.maxScore === 100 ? `${trim(item.score)}%` : `${trim(item.score)}/${trim(item.maxScore!)}`;
}

export function formatPercent(percent: number, decimals = 1): string {
  return `${trim(Number(percent.toFixed(decimals)))}%`;
}

export function gradeColor(percent: number): string {
  if (percent >= 80) return "var(--green)";
  if (percent >= 65) return "var(--accent)";
  if (percent >= 50) return "var(--orange)";
  return "var(--red)";
}

export interface GradeProjection {
  percent: number | null;
  gradedWeight: number;
  totalWeight: number;
}

export function remainingWeight(summary: GradeProjection): number {
  return Math.max(0, Math.max(100, summary.totalWeight) - summary.gradedWeight);
}

export function neededOnRemaining(summary: GradeProjection, target: number): number | null {
  const remaining = remainingWeight(summary);
  if (remaining <= 0.01 || summary.percent == null || summary.gradedWeight <= 0) return null;
  const earned = (summary.percent / 100) * summary.gradedWeight;
  return ((target - earned) / remaining) * 100;
}

function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}
