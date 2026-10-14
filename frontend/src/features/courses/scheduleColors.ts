import { COURSE_COLORS } from "../../lib/courseColors";

function hue(hex: string): number | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(clean.slice(i, i + 2), 16) / 255);
  if ([r, g, b].some(Number.isNaN)) return null;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.04) return null;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function distance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

export function assignCourseColors(reported: (string | null | undefined)[], taken: string[] = []): string[] {
  const used = new Set(taken.map((c) => c.toLowerCase()));
  return reported.map((color) => {
    const free = COURSE_COLORS.filter((c) => !used.has(c));
    const pool = free.length > 0 ? free : COURSE_COLORS;
    const target = color ? hue(color) : null;
    let pick = pool[0];
    if (target !== null) {
      let best = Infinity;
      for (const candidate of pool) {
        const h = hue(candidate);
        if (h === null) continue;
        const d = distance(h, target);
        if (d < best) {
          best = d;
          pick = candidate;
        }
      }
    }
    used.add(pick);
    return pick;
  });
}
