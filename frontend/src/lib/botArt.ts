import type { FlairRarity } from "../types";

export type BotPose = "idle" | "wave" | "think" | "cheer";
export type BotExpression = "happy" | "curious" | "proud" | "sleepy" | "love";
export type BotSlot = "top" | "bottom";
export type Pt = [number, number];

export interface BotLimb {
  s: Pt;
  c: Pt;
  e: Pt;
}

export const BOT_VIEW = { x: 0, y: -16, w: 240, h: 312 };
export const BOT_HEAD_VIEW = { x: 30, y: 0, w: 180, h: 180 };
export const BOT_STARTER = { top: "hoodie_classic", bottom: "pants_joggers" } as const;

export const BOT_COLORS = {
  plumeDeep: "#4f46e5",
  plumeMid: "#7c83f3",
  plumeLight: "#a5b4fc",
  board: "#818cf8",
  boardShade: "#6f77f0",
  rim: "#a5b4fc",
  torso: "#6366f1",
  limb: "#4f46e5",
  ink: "#1d1a33",
  tongue: "#f0739a",
  heart: "#f0397a",
};

export const BOT_LOGO_TF = "translate(120 120) scale(1.25) translate(-100 -120)";

export const BOT_PLUMES = [
  { d: "M72 116 C46 100 36 64 38 30 C58 60 72 92 86 110 Z", fill: BOT_COLORS.plumeDeep },
  { d: "M80 118 C60 102 52 74 60 34 C72 64 82 92 94 112 Z", fill: BOT_COLORS.plumeMid },
  { d: "M88 120 C74 104 72 78 82 42 C88 70 96 94 102 114 Z", fill: BOT_COLORS.plumeLight },
];

export const BOT_HEAD = {
  board: "M120 74 L200 120 L120 166 L40 120 Z",
  shade: "M120 74 L200 120 L120 166 Z",
  rim: "M120 82 L186 120 L120 158 L54 120 Z",
  tilt: "rotate(-6 120 140)",
};

export const BOT_TORSO = { x: 88, y: 158, w: 64, h: 74, r: 24 };

export const BOT_LEGS: { left: [Pt, Pt]; right: [Pt, Pt] } = {
  left: [[106, 228], [104, 268]],
  right: [[134, 228], [136, 268]],
};

const SHOULDER_L: Pt = [94, 182];
const SHOULDER_R: Pt = [146, 182];

export const BOT_POSES: Record<BotPose, { left: BotLimb; right: BotLimb }> = {
  idle: {
    left: { s: SHOULDER_L, c: [81, 202], e: [84, 223] },
    right: { s: SHOULDER_R, c: [159, 202], e: [156, 223] },
  },
  wave: {
    left: { s: SHOULDER_L, c: [65, 204], e: [51, 169] },
    right: { s: SHOULDER_R, c: [181, 193], e: [192, 147] },
  },
  think: {
    left: { s: SHOULDER_L, c: [83, 203], e: [88, 223] },
    right: { s: SHOULDER_R, c: [182, 196], e: [158, 162] },
  },
  cheer: {
    left: { s: SHOULDER_L, c: [58, 189], e: [46, 143] },
    right: { s: SHOULDER_R, c: [182, 189], e: [194, 143] },
  },
};

export const BOT_POSE_EXPRESSION: Record<BotPose, BotExpression> = {
  idle: "happy",
  wave: "happy",
  think: "curious",
  cheer: "proud",
};

export function limbAt(l: BotLimb, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * l.s[0] + 2 * u * t * l.c[0] + t * t * l.e[0],
    u * u * l.s[1] + 2 * u * t * l.c[1] + t * t * l.e[1],
  ];
}

export function limbPath(l: BotLimb): string {
  return `M${l.s[0]} ${l.s[1]} Q${l.c[0]} ${l.c[1]} ${l.e[0]} ${l.e[1]}`;
}

export function limbSegment(l: BotLimb, t0: number, t1: number): string {
  const a = limbAt(l, t0);
  const b = limbAt(l, t1);
  return `M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
}

export type BotPaint =
  | { kind: "solid"; color: string }
  | { kind: "linear"; stops: string[]; diagonal?: boolean; shimmer?: boolean }
  | { kind: "plaid"; base: string; band: string; line: string };

export interface BotTopStyle {
  cut: "hoodie" | "zip";
  body: BotPaint;
  sleeve: BotPaint;
  hood: string;
  pocket: string;
  band: string;
  bandStripe?: string;
  strings?: string;
  patch?: { fill: string; ink: string };
}

export interface BotBottomStyle {
  cut: "pants" | "shorts";
  body: BotPaint;
  cuff: string;
  seam?: string;
  flap?: string;
  highlight?: string;
}

interface BotOutfitBase {
  code: string;
  name: string;
  rarity: FlairRarity;
  blurb: string;
}

export type BotOutfit =
  | (BotOutfitBase & { slot: "top"; style: BotTopStyle })
  | (BotOutfitBase & { slot: "bottom"; style: BotBottomStyle });

export const BOT_OUTFITS: BotOutfit[] = [
  {
    code: "hoodie_classic",
    name: "Classic Indigo Hoodie",
    slot: "top",
    rarity: "COMMON",
    blurb: "Kangaroo pocket, drawstrings, the works.",
    style: {
      cut: "hoodie",
      body: { kind: "solid", color: "#3730a3" },
      sleeve: { kind: "solid", color: "#3730a3" },
      hood: "#2b2580",
      pocket: "#2f2994",
      band: "#2b2580",
      strings: "#eef0f7",
    },
  },
  {
    code: "hoodie_varsity",
    name: "Varsity Hoodie",
    slot: "top",
    rarity: "RARE",
    blurb: "Cream body, indigo sleeves, big S energy.",
    style: {
      cut: "hoodie",
      body: { kind: "solid", color: "#f3ead6" },
      sleeve: { kind: "solid", color: "#4338ca" },
      hood: "#ddd0b2",
      pocket: "#e6dabd",
      band: "#4338ca",
      bandStripe: "#f3ead6",
      strings: "#4338ca",
      patch: { fill: "#4338ca", ink: "#f3ead6" },
    },
  },
  {
    code: "hoodie_sunset",
    name: "Sunset Hoodie",
    slot: "top",
    rarity: "EPIC",
    blurb: "Golden hour, all semester long.",
    style: {
      cut: "hoodie",
      body: { kind: "linear", stops: ["#ff5d6c", "#ff8a5a", "#ffb547"] },
      sleeve: { kind: "linear", stops: ["#ff5d6c", "#ff8a5a", "#ffb547"] },
      hood: "#c2378c",
      pocket: "#f2725f",
      band: "#c2378c",
      strings: "#fff4e6",
    },
  },
  {
    code: "hoodie_aurora",
    name: "Aurora Zip Hoodie",
    slot: "top",
    rarity: "LEGENDARY",
    blurb: "Shifting northern lights with a silver zip.",
    style: {
      cut: "zip",
      body: { kind: "linear", stops: ["#35f2a4", "#20c2e8", "#8c5cff"], diagonal: true, shimmer: true },
      sleeve: { kind: "linear", stops: ["#35f2a4", "#20c2e8", "#8c5cff"], diagonal: true, shimmer: true },
      hood: "#5b3fd6",
      pocket: "#3d2aa8",
      band: "#5b3fd6",
    },
  },
  {
    code: "pants_joggers",
    name: "Grey Joggers",
    slot: "bottom",
    rarity: "COMMON",
    blurb: "Library-approved comfort.",
    style: {
      cut: "pants",
      body: { kind: "solid", color: "#9ca3af" },
      cuff: "#6b7280",
      highlight: "#b9bfc8",
    },
  },
  {
    code: "pants_jeans",
    name: "Blue Jeans",
    slot: "bottom",
    rarity: "COMMON",
    blurb: "Classic denim with a rolled cuff.",
    style: {
      cut: "pants",
      body: { kind: "solid", color: "#3b6fd1" },
      cuff: "#79a0e6",
      seam: "#f2c46d",
    },
  },
  {
    code: "pants_pajama",
    name: "Plaid Pajama Pants",
    slot: "bottom",
    rarity: "RARE",
    blurb: "For the 2 a.m. cram session.",
    style: {
      cut: "pants",
      body: { kind: "plaid", base: "#2b3a67", band: "#d9475f", line: "#f3ead6" },
      cuff: "#d9475f",
    },
  },
  {
    code: "shorts_cargo",
    name: "Cargo Shorts",
    slot: "bottom",
    rarity: "RARE",
    blurb: "Pockets for every highlighter.",
    style: {
      cut: "shorts",
      body: { kind: "solid", color: "#c8a86b" },
      cuff: "#a8884c",
      flap: "#b3935a",
    },
  },
];

export function botOutfit(code: string | null | undefined, slot: BotSlot): BotOutfit | null {
  if (!code) return null;
  return BOT_OUTFITS.find((o) => o.code === code && o.slot === slot) ?? null;
}
