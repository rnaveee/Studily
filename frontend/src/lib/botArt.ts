import type { FlairRarity } from "../types";

export type BotPose =
  | "idle"
  | "wave"
  | "think"
  | "cheer"
  | "dab"
  | "discoUp"
  | "discoDown"
  | "robotUp"
  | "robotDown"
  | "run"
  | "twist";
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
  dab: {
    left: { s: SHOULDER_L, c: [-20, 70], e: [100, 110] },
    right: { s: SHOULDER_R, c: [180, 160], e: [214, 134] },
  },
  discoUp: {
    left: { s: SHOULDER_L, c: [64, 196], e: [90, 214] },
    right: { s: SHOULDER_R, c: [172, 152], e: [200, 102] },
  },
  discoDown: {
    left: { s: SHOULDER_L, c: [64, 196], e: [90, 214] },
    right: { s: SHOULDER_R, c: [172, 212], e: [200, 246] },
  },
  robotUp: {
    left: { s: SHOULDER_L, c: [56, 190], e: [62, 150] },
    right: { s: SHOULDER_R, c: [184, 190], e: [178, 150] },
  },
  robotDown: {
    left: { s: SHOULDER_L, c: [56, 178], e: [60, 218] },
    right: { s: SHOULDER_R, c: [184, 190], e: [178, 150] },
  },
  run: {
    left: { s: SHOULDER_L, c: [72, 206], e: [66, 182] },
    right: { s: SHOULDER_R, c: [168, 206], e: [174, 182] },
  },
  twist: {
    left: { s: SHOULDER_L, c: [70, 208], e: [56, 192] },
    right: { s: SHOULDER_R, c: [170, 208], e: [184, 192] },
  },
};

export const BOT_POSE_EXPRESSION: Record<BotPose, BotExpression> = {
  idle: "happy",
  wave: "happy",
  think: "curious",
  cheer: "proud",
  dab: "proud",
  discoUp: "proud",
  discoDown: "proud",
  robotUp: "happy",
  robotDown: "happy",
  run: "proud",
  twist: "happy",
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

export function limbSub(l: BotLimb, t: number): string {
  const c: Pt = [l.s[0] + (l.c[0] - l.s[0]) * t, l.s[1] + (l.c[1] - l.s[1]) * t];
  const e = limbAt(l, t);
  return `M${l.s[0]} ${l.s[1]} Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${e[0].toFixed(1)} ${e[1].toFixed(1)}`;
}

export const BOT_LOGO_MARK = {
  board: "M100 83.2 L164 120 L100 156.8 L36 120 Z",
  shade: "M100 83.2 L164 120 L100 156.8 Z",
  center: [100, 93.5] as Pt,
  width: 128,
};

const GLYPHS: Record<string, string> = {
  A: "M{0} 195 L{5.5} 179 L{11} 195 M{2.2} 189 L{8.8} 189",
  B: "M{0} 179 L{0} 195 L{6.5} 195 Q{11} 195 {11} 191 Q{11} 187 {6} 187 L{0} 187 M{6} 187 Q{10} 187 {10} 183 Q{10} 179 {6} 179 L{0} 179",
  C: "M{11} 181.5 Q{9} 179 {6} 179 Q{0} 179 {0} 187 Q{0} 195 {6} 195 Q{9} 195 {11} 192.5",
  F: "M{11} 179 L{0} 179 L{0} 195 M{0} 187 L{8.5} 187",
  H: "M{0} 179 L{0} 195 M{11} 179 L{11} 195 M{0} 187 L{11} 187",
  I: "M{5.5} 179 L{5.5} 195 M{2} 179 L{9} 179 M{2} 195 L{9} 195",
  K: "M{0} 179 L{0} 195 M{11} 179 L{0} 188.5 M{3.5} 185.5 L{11} 195",
  O: "M{5.5} 179 Q{0} 179 {0} 187 Q{0} 195 {5.5} 195 Q{11} 195 {11} 187 Q{11} 179 {5.5} 179 Z",
  R: "M{0} 195 L{0} 179 L{6} 179 Q{11} 179 {11} 183 Q{11} 187 {6} 187 L{0} 187 M{5.5} 187 L{11} 195",
  S: "M{10.5} 181.5 Q{9} 179 {5.5} 179 Q{0.5} 179 {0.5} 183 Q{0.5} 186.5 {5.5} 187 Q{10.5} 187.5 {10.5} 191 Q{10.5} 195 {5.5} 195 Q{1.5} 195 {0} 192.5",
  T: "M{0} 179 L{11} 179 M{5.5} 179 L{5.5} 195",
  U: "M{0} 179 L{0} 189 Q{0} 195 {5.5} 195 Q{11} 195 {11} 189 L{11} 179",
  V: "M{0} 179 L{5.5} 195 L{11} 179",
};

const LETTER_FIT: [number, number, number][] = [
  [1, 4.5, 3.4],
  [1, 4.5, 3.4],
  [1, 4.5, 3.4],
  [0.9, 3.6, 3.2],
  [0.8, 3, 2.9],
];

export function botLettering(text: string): { d: string; width: number } {
  const [k, gap, width] = LETTER_FIT[Math.min(text.length, LETTER_FIT.length) - 1];
  const w = 11 * k;
  const x0 = 120 - (text.length * w + (text.length - 1) * gap) / 2;
  const d = [...text]
    .map((ch, i) => {
      const x = x0 + i * (w + gap);
      return (GLYPHS[ch] ?? "").replace(/\{([\d.]+)\}/g, (_, n: string) => (x + Number(n) * k).toFixed(1));
    })
    .join(" ");
  return { d, width };
}

export type BotPaint =
  | { kind: "solid"; color: string }
  | { kind: "linear"; stops: string[]; diagonal?: boolean; shimmer?: boolean }
  | { kind: "plaid"; base: string; band: string; line: string };

export type BotEmblem =
  | { kind: "letters"; text: string; ink: string }
  | { kind: "circuit" | "brain" | "code" | "math"; ink: string }
  | { kind: "dna"; ink: string; accent: string }
  | { kind: "studily"; x: number; y: number; size: number; mono?: string; shade?: string };

export interface BotTopStyle {
  cut: "hoodie" | "zip" | "tee";
  body: BotPaint;
  sleeve: BotPaint;
  hood?: string;
  pocket?: string;
  band: string;
  bandStripe?: string;
  strings?: string;
  collar?: string;
  patch?: { fill: string; ink: string };
  emblem?: BotEmblem;
}

export interface BotBottomStyle {
  cut: "pants" | "shorts";
  body: BotPaint;
  cuff: string;
  seam?: string;
  flap?: string;
  highlight?: string;
  stripe?: string;
}

export type BotGroup = "hoodie" | "school" | "shirt" | "bottom";

interface BotOutfitBase {
  code: string;
  name: string;
  rarity: FlairRarity;
  blurb: string;
  group: BotGroup;
}

export type BotOutfit =
  | (BotOutfitBase & { slot: "top"; style: BotTopStyle })
  | (BotOutfitBase & { slot: "bottom"; style: BotBottomStyle });

export const BOT_OUTFITS: BotOutfit[] = [
  {
    code: "hoodie_classic",
    name: "Classic Indigo Hoodie",
    slot: "top",
    group: "hoodie",
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
    group: "hoodie",
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
    group: "hoodie",
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
    group: "hoodie",
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
    group: "bottom",
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
    group: "bottom",
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
    group: "bottom",
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
    group: "bottom",
    rarity: "RARE",
    blurb: "Pockets for every highlighter.",
    style: {
      cut: "shorts",
      body: { kind: "solid", color: "#c8a86b" },
      cuff: "#a8884c",
      flap: "#b3935a",
    },
  },
  hoodie("hoodie_charcoal", "Charcoal Hoodie", "COMMON", "Goes with everything, deadlines included.", "hoodie", {
    body: "#374151", hood: "#2b323d", pocket: "#323a47", band: "#2b323d", strings: "#e5e7eb",
  }),
  hoodie("hoodie_forest", "Forest Green Hoodie", "COMMON", "Campus-trail green.", "hoodie", {
    body: "#2f6b4f", hood: "#24553f", pocket: "#2a6047", band: "#24553f", strings: "#f3ead6",
  }),
  hoodie("hoodie_maroon", "Maroon Hoodie", "COMMON", "Deep red for deep focus.", "hoodie", {
    body: "#7a2335", hood: "#601b2a", pocket: "#6d1f30", band: "#601b2a", strings: "#f6e7d8",
  }),
  hoodie("hoodie_lilac", "Lilac Hoodie", "COMMON", "Soft colour, hard problem sets.", "hoodie", {
    body: "#b9a7e8", hood: "#a08bd9", pocket: "#ad9ae0", band: "#a08bd9", strings: "#ffffff",
  }),
  hoodie("hoodie_engineering", "Engineering Hoodie", "EPIC", "Green circuit traces on graphite.", "hoodie", {
    body: "#2d3340", hood: "#232833", pocket: "#282e3a", band: "#232833", bandStripe: "#3ee08f",
    emblem: { kind: "circuit", ink: "#3ee08f" },
  }),
  hoodie("hoodie_psychology", "Psychology Hoodie", "EPIC", "Thinks about thinking.", "hoodie", {
    body: "#6b3a7d", hood: "#552c64", pocket: "#603471", band: "#552c64", strings: "#f6d6ea",
    emblem: { kind: "brain", ink: "#ffc4e1" },
  }),
  hoodie("hoodie_biology", "Biology Hoodie", "EPIC", "A double helix on teal.", "hoodie", {
    body: "#1f7a72", hood: "#18625b", pocket: "#1b6e66", band: "#18625b", strings: "#e8fff9",
    emblem: { kind: "dna", ink: "#b8f5d0", accent: "#ffd166" },
  }),
  hoodie("hoodie_compsci", "Computer Science Hoodie", "EPIC", "Compiles on the first try.", "hoodie", {
    body: "#17171c", hood: "#0e0e12", pocket: "#121216", band: "#0e0e12", strings: "#7cf3a5",
    emblem: { kind: "code", ink: "#7cf3a5" },
  }),
  hoodie("hoodie_math", "Math Hoodie", "EPIC", "Irrational, never unreasonable.", "hoodie", {
    body: "#23305e", hood: "#1a244a", pocket: "#1f2a54", band: "#1a244a", strings: "#ffd166",
    emblem: { kind: "math", ink: "#ffd166" },
  }),
  hoodie("hoodie_studily", "Studily Logo Hoodie", "EPIC", "White, with the plume mark on the chest.", "hoodie", {
    body: "#f7f7fb", hood: "#e3e4f0", pocket: "#ecedf6", band: "#4f46e5", strings: "#4f46e5",
    emblem: { kind: "studily", x: 120, y: 183, size: 28 },
  }),
  hoodie("hoodie_studily_night", "Studily Midnight Hoodie", "LEGENDARY", "Midnight indigo with the full-colour mark.", "hoodie", {
    body: { kind: "linear", stops: ["#2a2366", "#111116"] },
    hood: "#0b0b10", pocket: "#1c1a33", band: "#4f46e5", bandStripe: "#a5b4fc", strings: "#a5b4fc",
    emblem: { kind: "studily", x: 120, y: 183, size: 28 },
  }),
  school("hoodie_ubc", "UBC Hoodie", "Navy with gold UBC letters.", "UBC", "#002145", "#00152e", "#001a39", "#f2a900", "#f2a900"),
  school("hoodie_sfu", "SFU Hoodie", "Red with white SFU letters.", "SFU", "#a6192e", "#861425", "#961729", "#ffffff", "#ffffff"),
  school("hoodie_uvic", "UVic Hoodie", "Blue with gold UVIC letters.", "UVIC", "#005493", "#00406f", "#004a83", "#f5aa1c", "#f5aa1c"),
  school("hoodie_bcit", "BCIT Hoodie", "Blue with white BCIT letters and a yellow stripe.", "BCIT", "#003c71", "#002d55", "#003563", "#ffffff", "#ffc72c"),
  school("hoodie_brock", "Brock Hoodie", "Red with white BROCK letters.", "BROCK", "#cc0000", "#a30000", "#b80000", "#ffffff", "#ffffff"),
  school("hoodie_batstateu", "BatStateU Hoodie", "Maroon with gold BSU letters.", "BSU", "#7b1113", "#5f0d0f", "#6e0f11", "#ffd23f", "#ffd23f"),
  school("hoodie_bchs", "Bethlehem Catholic Hoodie", "Green with gold BCHS letters.", "BCHS", "#1b5e3b", "#144a2e", "#175435", "#f2c94c", "#f2c94c"),
  school("hoodie_caucasus", "Caucasus University Hoodie", "Navy with white CU letters and a red stripe.", "CU", "#1d2b5c", "#152046", "#192652", "#ffffff", "#e03a3e"),
  school("hoodie_uontario", "University of Ontario Hoodie", "Blue with orange UO letters.", "UO", "#0b3d91", "#082e6e", "#0a3681", "#f58025", "#f58025"),
  tee("tee_white", "White Tee", "COMMON", "Crisp white crew neck.", { body: "#f8f8fb", band: "#e6e7ef", collar: "#d6d8e4" }),
  tee("tee_black", "Black Tee", "COMMON", "The all-nighter uniform.", { body: "#1c1c22", band: "#2a2a33", collar: "#3a3a46" }),
  tee("tee_heather", "Heather Grey Tee", "COMMON", "Heather grey, zero effort.", { body: "#b8bcc6", band: "#a6abb6", collar: "#8f95a2" }),
  tee("tee_studily", "Studily Logo Tee", "RARE", "White tee with a big plume mark.", {
    body: "#f8f8fb", band: "#e6e7ef", collar: "#4f46e5",
    emblem: { kind: "studily", x: 120, y: 186, size: 40 },
  }),
  tee("tee_gradient", "Studily Gradient Tee", "EPIC", "Indigo to magenta with a white mark.", {
    body: { kind: "linear", stops: ["#4f46e5", "#7c3aed", "#c026d3"], diagonal: true },
    band: "#3b2fb8", collar: "#ede9fe",
    emblem: { kind: "studily", x: 120, y: 186, size: 40, mono: "#ffffff", shade: "#ddd6fe" },
  }),
  bottom("pants_black_joggers", "Black Joggers", "COMMON", "The Grey Joggers, but moodier.", { cut: "pants", body: "#2a2a32", cuff: "#17171c", highlight: "#44444f" }),
  bottom("pants_sweats_cream", "Cream Sweatpants", "COMMON", "Cozy. Probably not lab-safe.", { cut: "pants", body: "#e8e1d1", cuff: "#cfc4ad", highlight: "#f5f1e8" }),
  bottom("pants_navy_chinos", "Navy Chinos", "COMMON", "Presentation-day pants.", { cut: "pants", body: "#2c3a5e", cuff: "#22304f", seam: "#4a5b88" }),
  bottom("pants_khaki_chinos", "Khaki Chinos", "COMMON", "Office-hours energy.", { cut: "pants", body: "#c9b38a", cuff: "#b39d74", seam: "#a2895c" }),
  bottom("pants_black_jeans", "Black Jeans", "COMMON", "Grey stitching, goes with every hoodie.", { cut: "pants", body: "#2b2e36", cuff: "#4a4f5c", seam: "#9aa0ad" }),
  bottom("pants_lightwash", "Light-Wash Jeans", "COMMON", "Faded blue with gold stitching.", { cut: "pants", body: "#8fb3e6", cuff: "#b8d0f2", seam: "#f2c46d" }),
  bottom("pants_olive_cargo", "Olive Cargo Pants", "RARE", "Room for every pen you will lose.", { cut: "pants", body: "#5f6b3c", cuff: "#4c5730", flap: "#56613a" }),
  bottom("pants_track", "Track Pants", "RARE", "Navy with a white side stripe.", { cut: "pants", body: "#1f2a5c", cuff: "#172049", stripe: "#ffffff" }),
  bottom("shorts_athletic", "Athletic Shorts", "COMMON", "Gym, then library.", { cut: "shorts", body: "#d9475f", cuff: "#b8384e", stripe: "#ffffff" }),
  bottom("shorts_denim", "Denim Shorts", "COMMON", "Cut-offs for September heat.", { cut: "shorts", body: "#5b85d6", cuff: "#9bb8ea", seam: "#f2c46d" }),
];

type Colour = string | BotPaint;

function paint(c: Colour): BotPaint {
  return typeof c === "string" ? { kind: "solid", color: c } : c;
}

function hoodie(
  code: string,
  name: string,
  rarity: FlairRarity,
  blurb: string,
  group: BotGroup,
  s: Omit<BotTopStyle, "cut" | "body" | "sleeve"> & { body: Colour },
): BotOutfit {
  return { code, name, rarity, blurb, group, slot: "top", style: { ...s, cut: "hoodie", body: paint(s.body), sleeve: paint(s.body) } };
}

function school(
  code: string,
  name: string,
  blurb: string,
  text: string,
  body: string,
  hood: string,
  pocket: string,
  ink: string,
  stripe: string,
): BotOutfit {
  return hoodie(code, name, "RARE", blurb, "school", {
    body, hood, pocket, band: hood, bandStripe: stripe, emblem: { kind: "letters", text, ink },
  });
}

function tee(
  code: string,
  name: string,
  rarity: FlairRarity,
  blurb: string,
  s: Omit<BotTopStyle, "cut" | "body" | "sleeve"> & { body: Colour },
): BotOutfit {
  return { code, name, rarity, blurb, group: "shirt", slot: "top", style: { ...s, cut: "tee", body: paint(s.body), sleeve: paint(s.body) } };
}

function bottom(code: string, name: string, rarity: FlairRarity, blurb: string, s: Omit<BotBottomStyle, "body"> & { body: string }): BotOutfit {
  return { code, name, rarity, blurb, group: "bottom", slot: "bottom", style: { ...s, body: paint(s.body) } };
}

export function botOutfit(code: string | null | undefined, slot: BotSlot): BotOutfit | null {
  if (!code) return null;
  return BOT_OUTFITS.find((o) => o.code === code && o.slot === slot) ?? null;
}
