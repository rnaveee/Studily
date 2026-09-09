export const COURSE_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#7968dc",
  "#0ea5e9",
];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function readableOn(color: string | null | undefined): string {
  if (!color) return "#ffffff";
  const hex = color.trim().replace("#", "");
  if (hex.length !== 3 && hex.length !== 6) return "#ffffff";
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#ffffff";
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.42 ? "#101425" : "#ffffff";
}
