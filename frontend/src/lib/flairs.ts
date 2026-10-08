import type { FlairDto, FlairRarity, FlairRef } from "../types";

export interface FlairLayer {
  background: string;
  spin?: number;
  twinkle?: number;
  opacity?: number;
  blur?: number;
  detail?: boolean;
}

export interface FlairGlow {
  color: string;
  blur: number;
  spread?: number;
}

export interface FlairRing {
  layers: FlairLayer[];
  glow?: FlairGlow[];
  glowAnim?: "pulse" | "flicker";
  glowSeconds?: number;
}

export const FLAIR_STATIC_MAX = 32;

export function ringWidth(size: number): number {
  return Math.max(2, Math.round(size * 0.08));
}

export function ringGap(size: number): number {
  const w = ringWidth(size);
  return w >= 5 ? Math.max(1, Math.round(w * 0.22)) : 0;
}

const v = (name: string) => `var(--flair-${name})`;
const mix = (name: string, pct: number) => `color-mix(in srgb, var(--flair-${name}) ${pct}%, transparent)`;

const SHINE = `linear-gradient(140deg, ${v("shine")} 0%, transparent 34%, transparent 66%, ${v("shade")} 100%)`;

function innerEdge(color: string, from = 84, peak = 89, to = 96): string {
  return `radial-gradient(closest-side, transparent ${from}%, ${color} ${peak}%, transparent ${to}%)`;
}

function stars(points: [number, number, number][]): string {
  return points
    .map(([deg, r, s]) => {
      const rad = (deg * Math.PI) / 180;
      const x = (50 + r * Math.cos(rad)).toFixed(2);
      const y = (50 + r * Math.sin(rad)).toFixed(2);
      return `radial-gradient(circle at ${x}% ${y}%, ${v("star")} 0, ${v("star")} ${s}px, transparent ${s + 0.9}px)`;
    })
    .join(", ");
}

const FIRE_TONGUES = (hot: number, every: number) =>
  `repeating-conic-gradient(${mix("fire-hot", hot)} 0deg, ${mix("fire-4", hot - 10)} 3deg, transparent 9deg, transparent ${every}deg)`;

export const FLAIR_RINGS: Record<string, FlairRing> = {
  ring_mint: {
    layers: [
      {
        background: `conic-gradient(from 210deg, ${v("mint-3")}, ${v("mint-1")} 24%, ${v("mint-2")} 50%, ${v("mint-1")} 76%, ${v("mint-3")})`,
      },
      { background: SHINE, opacity: 0.85 },
    ],
  },
  ring_ocean: {
    layers: [
      {
        background: `conic-gradient(from 150deg, ${v("ocean-1")}, ${v("ocean-2")} 28%, ${v("ocean-3")} 50%, ${v("ocean-2")} 72%, ${v("ocean-1")})`,
      },
      { background: SHINE, opacity: 0.75 },
    ],
  },
  ring_sunset: {
    layers: [
      {
        background: `conic-gradient(from 200deg, ${v("sunset-3")}, ${v("sunset-1")} 28%, ${v("sunset-2")} 50%, ${v("sunset-1")} 72%, ${v("sunset-3")})`,
      },
      { background: SHINE, opacity: 0.7 },
    ],
  },
  ring_gold: {
    layers: [
      {
        background: `conic-gradient(from 20deg, ${v("gold-3")}, ${v("gold-1")} 9%, ${v("gold-2")} 20%, ${v("gold-4")} 34%, ${v("gold-2")} 48%, ${v("gold-1")} 58%, ${v("gold-2")} 70%, ${v("gold-4")} 85%, ${v("gold-3")})`,
      },
      { background: SHINE },
    ],
  },
  ring_neon: {
    layers: [
      {
        background: `conic-gradient(${v("neon-1")}, ${v("neon-2")} 25%, ${v("neon-1")} 50%, ${v("neon-2")} 75%, ${v("neon-1")})`,
        spin: 9,
      },
      {
        background: `conic-gradient(transparent 0deg 290deg, ${mix("star", 90)} 345deg, transparent 360deg)`,
        spin: 2.8,
      },
      { background: innerEdge(mix("star", 70), 87, 93, 99) },
    ],
    glow: [
      { color: mix("neon-1", 70), blur: 0.16 },
      { color: mix("neon-2", 40), blur: 0.32 },
    ],
    glowAnim: "pulse",
    glowSeconds: 2.2,
  },
  ring_aurora: {
    layers: [
      {
        background: `conic-gradient(${v("aurora-1")}, ${v("aurora-2")} 22%, ${v("aurora-3")} 48%, ${v("aurora-4")} 68%, ${v("aurora-1")})`,
        spin: 16,
      },
      {
        background: `conic-gradient(from 90deg, transparent, ${mix("aurora-1", 90)} 18%, transparent 36%, ${mix("aurora-3", 85)} 58%, transparent 76%, ${mix("aurora-2", 90)} 88%, transparent)`,
        spin: -10,
        blur: 1,
      },
    ],
    glow: [
      { color: mix("aurora-1", 45), blur: 0.18 },
      { color: mix("aurora-3", 30), blur: 0.32 },
    ],
    glowAnim: "pulse",
    glowSeconds: 3.6,
  },
  ring_prism: {
    layers: [
      {
        background: `conic-gradient(${v("prism-1")}, ${v("prism-2")} 16%, ${v("prism-3")} 33%, ${v("prism-4")} 50%, ${v("prism-5")} 66%, ${v("prism-6")} 83%, ${v("prism-1")})`,
        spin: 12,
      },
      {
        background: `conic-gradient(transparent 0deg 18deg, ${v("shine")} 30deg, transparent 42deg 198deg, ${v("shine")} 210deg, transparent 222deg)`,
        spin: -5,
      },
    ],
    glow: [
      { color: mix("prism-5", 45), blur: 0.16 },
      { color: mix("prism-1", 32), blur: 0.3 },
    ],
    glowAnim: "pulse",
    glowSeconds: 3,
  },
  ring_galaxy: {
    layers: [
      {
        background: `conic-gradient(from 30deg, ${v("galaxy-1")}, ${v("galaxy-2")} 18%, ${v("galaxy-3")} 31%, ${v("galaxy-1")} 47%, ${v("galaxy-4")} 63%, ${v("galaxy-2")} 80%, ${v("galaxy-1")})`,
        spin: 28,
      },
      {
        background: `conic-gradient(from 200deg, transparent, ${mix("galaxy-3", 65)} 14%, transparent 30%, transparent 58%, ${mix("galaxy-4", 60)} 74%, transparent 90%)`,
        spin: -18,
        blur: 1,
      },
      {
        background: stars([
          [8, 46, 0.7],
          [61, 45, 0.5],
          [104, 47, 0.8],
          [152, 46, 0.5],
          [199, 45, 0.7],
          [243, 47, 0.5],
          [291, 46, 0.8],
          [334, 45, 0.5],
        ]),
        spin: 44,
        detail: true,
      },
      {
        background: stars([
          [32, 46, 0.9],
          [128, 45, 0.6],
          [221, 46, 0.9],
          [312, 47, 0.6],
        ]),
        twinkle: 2.6,
        detail: true,
      },
    ],
    glow: [
      { color: mix("galaxy-2", 65), blur: 0.18, spread: 0.015 },
      { color: mix("galaxy-3", 35), blur: 0.36 },
    ],
    glowAnim: "pulse",
    glowSeconds: 4,
  },
  ring_ember: {
    layers: [
      {
        background: `conic-gradient(from 180deg, ${v("fire-1")}, ${v("fire-2")} 22%, ${v("fire-3")} 42%, ${v("fire-4")} 50%, ${v("fire-3")} 58%, ${v("fire-2")} 78%, ${v("fire-1")})`,
      },
      { background: innerEdge(mix("fire-4", 55)) },
    ],
  },
  ring_blaze: {
    layers: [
      {
        background: `repeating-conic-gradient(${v("fire-2")} 0deg, ${v("fire-3")} 40deg, ${v("fire-4")} 70deg, ${v("fire-3")} 100deg, ${v("fire-2")} 140deg, ${v("fire-2")} 180deg)`,
        spin: 6,
      },
      { background: FIRE_TONGUES(75, 36), spin: -4, blur: 1, opacity: 0.6, detail: true },
      { background: innerEdge(mix("fire-4", 70)) },
    ],
    glow: [{ color: mix("fire-3", 70), blur: 0.17 }],
    glowAnim: "pulse",
    glowSeconds: 1.8,
  },
  ring_inferno: {
    layers: [
      {
        background: `repeating-conic-gradient(${v("fire-1")} 0deg, ${v("fire-2")} 10deg, ${v("fire-3")} 22deg, ${v("fire-4")} 32deg, ${v("fire-hot")} 38deg, ${v("fire-4")} 44deg, ${v("fire-3")} 56deg, ${v("fire-2")} 80deg, ${v("fire-1")} 120deg)`,
        spin: 3.4,
      },
      { background: FIRE_TONGUES(90, 24), spin: -2.3, blur: 1, opacity: 0.75, detail: true },
      { background: innerEdge(mix("fire-hot", 92), 83, 88, 95) },
    ],
    glow: [
      { color: mix("fire-3", 80), blur: 0.18, spread: 0.02 },
      { color: mix("fire-2", 50), blur: 0.38 },
    ],
    glowAnim: "flicker",
    glowSeconds: 1.3,
  },
};

export function flairRing(code: string | null | undefined): FlairRing | null {
  if (!code) return null;
  return FLAIR_RINGS[code] ?? null;
}

export function glowShadow(glow: FlairGlow[], size: number): string {
  return glow
    .map((g) => {
      const blur = Math.max(2, Math.round(size * g.blur));
      const spread = Math.round(size * (g.spread ?? 0));
      return `0 0 ${blur}px ${spread}px ${g.color}`;
    })
    .join(", ");
}

export function flairRef(flair: Pick<FlairDto, "code" | "imageUrl">): FlairRef {
  return { code: flair.code, imageUrl: flair.imageUrl };
}

export const RARITY_LABEL: Record<FlairRarity, string> = {
  COMMON: "Common",
  RARE: "Rare",
  EPIC: "Epic",
  LEGENDARY: "Legendary",
};

export const RARITY_COLOR: Record<FlairRarity, string> = {
  COMMON: "var(--fg-3)",
  RARE: "var(--blue-vivid)",
  EPIC: "var(--accent)",
  LEGENDARY: "var(--yellow)",
};

export function unlockHint(flair: FlairDto): string {
  if (flair.unlock === "SHOP") return flair.priceCoins != null ? `${flair.priceCoins.toLocaleString()} coins in the Shop` : "In the Shop";
  if (flair.unlock === "CHEST") return "Found in chests";
  return flair.streakDays != null ? `Reach a ${flair.streakDays}-day streak` : "Keep a study streak going";
}
