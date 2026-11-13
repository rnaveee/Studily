import { createElement, type ComponentType } from "react";
import { CalendarDays, Layers, Sparkles, type LucideProps } from "lucide-react";
import FlairSvg from "../../components/FlairSvg";
import { buildFlairArt, flairArtKind, type FlairArtKind } from "../../lib/flairArt";
import { FLAIR_RINGS, ringWidth, type FlairRing } from "../../lib/flairs";
import type { FlairRef } from "../../types";

const W = 1080;
const H = 1920;
const ACCENT = "#7c83f3";
const ACCENT_DEEP = "#4f46e5";
const INK = "#eef0ff";
const MUTED = "#a3a8d6";

const SANS = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif';
const MONO = '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace';

export interface StoryProfile {
  name: string;
  username: string;
  avatarUrl?: string | null;
  flair?: FlairRef | null;
}

const FEATURES: { icon: ComponentType<LucideProps>; title: string; line: string }[] = [
  { icon: CalendarDays, title: "Scheduling", line: "Classes, deadlines and exams in one plan" },
  { icon: Layers, title: "Flashcards", line: "Turn your notes into study sets" },
  { icon: Sparkles, title: "StudilyBot", line: "An AI tutor for your own courses" },
];

async function loadImage(src: string, cors = false): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

async function svgImage(markup: string): Promise<HTMLImageElement | null> {
  const svg = markup.includes('xmlns="http://www.w3.org/2000/svg"')
    ? markup
    : markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function canvasSafe(img: HTMLImageElement): boolean {
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    const ctx = probe.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 1, 1);
    ctx.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

function resolveVars(value: string): string {
  const style = getComputedStyle(document.documentElement);
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => style.getPropertyValue(name).trim() || "transparent");
}

function ringColors(ring: FlairRing): string[] {
  const source = ring.layers[0]?.background ?? "";
  const style = getComputedStyle(document.documentElement);
  const colors = [...source.matchAll(/var\((--[\w-]+)\)/g)]
    .map((m) => style.getPropertyValue(m[1]).trim())
    .filter(Boolean);
  return colors.length >= 2 ? colors : [ACCENT, ACCENT_DEEP];
}

function plainColor(value: string): string | null {
  const resolved = resolveVars(value);
  return /^(#|rgb|hsl)/.test(resolved) ? resolved : null;
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  profile: StoryProfile,
  face: HTMLImageElement | null,
  cx: number,
  cy: number,
  d: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.closePath();
  if (face) {
    ctx.clip();
    const scale = Math.max(d / face.naturalWidth, d / face.naturalHeight);
    const w = face.naturalWidth * scale;
    const h = face.naturalHeight * scale;
    ctx.drawImage(face, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = ACCENT_DEEP;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${Math.round(d * 0.45)}px ${SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((profile.name || profile.username || "?").charAt(0).toUpperCase(), cx, cy + d * 0.02);
  }
  ctx.restore();
}

function drawRing(ctx: CanvasRenderingContext2D, ring: FlairRing, cx: number, cy: number, size: number) {
  const band = ringWidth(size);
  const colors = ringColors(ring);
  const gradient = ctx.createConicGradient(-Math.PI / 2, cx, cy);
  colors.forEach((color, i) => gradient.addColorStop(i / colors.length, color));
  gradient.addColorStop(1, colors[0]);
  const glow = ring.glow?.[0] ? plainColor(ring.glow[0].color) : null;
  ctx.save();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = size * 0.12;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.arc(cx, cy, size / 2 - band, 0, Math.PI * 2, true);
  ctx.fillStyle = gradient;
  ctx.fill("evenodd");
  ctx.restore();
}

async function drawArtFlair(
  ctx: CanvasRenderingContext2D,
  kind: FlairArtKind,
  part: "back" | "front",
  cx: number,
  cy: number,
  size: number,
) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const unit = (size * 0.78) / 152;
  const span = 260 * unit;
  const art = buildFlairArt(kind, false, true);
  const markup = renderToStaticMarkup(createElement(FlairSvg, { art, kind, unit, animate: false, part }))
    .replace(/ class="[^"]*"/, "")
    .replace(/ style="[^"]*"/, "");
  const img = await svgImage(markup);
  if (img) ctx.drawImage(img, cx - span / 2, cy - span / 2, span, span);
}

async function drawAvatar(ctx: CanvasRenderingContext2D, profile: StoryProfile, cx: number, cy: number, size: number) {
  const face = profile.avatarUrl ? await loadImage(profile.avatarUrl) : null;
  const code = profile.flair?.code;
  const artKind = flairArtKind(code);
  const overlay = profile.flair?.imageUrl ? await loadImage(profile.flair.imageUrl, true) : null;
  const safeOverlay = overlay && canvasSafe(overlay) ? overlay : null;

  if (safeOverlay) {
    const inner = size - ringWidth(size) * 2;
    drawFace(ctx, profile, face, cx, cy, inner);
    ctx.drawImage(safeOverlay, cx - size / 2, cy - size / 2, size, size);
    return;
  }
  if (artKind) {
    const inner = Math.round(152 * ((size * 0.78) / 152));
    await drawArtFlair(ctx, artKind, "back", cx, cy, size);
    drawFace(ctx, profile, face, cx, cy, inner);
    await drawArtFlair(ctx, artKind, "front", cx, cy, size);
    return;
  }
  const ring = code ? FLAIR_RINGS[code] : undefined;
  if (ring) {
    drawRing(ctx, ring, cx, cy, size);
    drawFace(ctx, profile, face, cx, cy, size - ringWidth(size) * 2);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fill();
  ctx.restore();
  drawFace(ctx, profile, face, cx, cy, size - 20);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}

async function drawFeature(
  ctx: CanvasRenderingContext2D,
  feature: (typeof FEATURES)[number],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  roundRect(ctx, x, y, w, h, 44);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();
  ctx.strokeStyle = "rgba(165,180,252,0.22)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const badge = 112;
  const bx = x + 44;
  const by = y + (h - badge) / 2;
  roundRect(ctx, bx, by, badge, badge, 32);
  const fill = ctx.createLinearGradient(bx, by, bx + badge, by + badge);
  fill.addColorStop(0, ACCENT);
  fill.addColorStop(1, ACCENT_DEEP);
  ctx.fillStyle = fill;
  ctx.fill();

  const { renderToStaticMarkup } = await import("react-dom/server");
  const icon = await svgImage(
    renderToStaticMarkup(createElement(feature.icon, { size: 64, color: "#ffffff", strokeWidth: 2 })),
  );
  if (icon) ctx.drawImage(icon, bx + (badge - 64) / 2, by + (badge - 64) / 2, 64, 64);

  const tx = bx + badge + 40;
  const maxText = x + w - tx - 40;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = `700 54px ${SANS}`;
  ctx.fillText(feature.title, tx, y + h / 2 - 6);
  ctx.fillStyle = MUTED;
  ctx.font = `500 34px ${SANS}`;
  ctx.fillText(fitText(ctx, feature.line, maxText), tx, y + h / 2 + 44);
}

export async function renderStoryCard(profile: StoryProfile | null = null): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  if (document.fonts?.ready) await document.fonts.ready;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0d1033");
  bg.addColorStop(0.5, "#141a4a");
  bg.addColorStop(1, "#0a0d26");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  for (const [x, y, r, a] of [
    [W * 0.15, 260, 520, 0.35],
    [W * 0.9, 980, 560, 0.28],
    [W * 0.3, 1700, 600, 0.22],
  ] as const) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, `rgba(124,131,243,${a})`);
    glow.addColorStop(1, "rgba(124,131,243,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = MUTED;
  ctx.font = `600 64px ${SANS}`;
  ctx.fillText("Come join me on", W / 2, 250);

  const mark = await loadImage("/studily-3a.svg");
  ctx.font = `800 132px ${MONO}`;
  const wordWidth = ctx.measureText("Studily").width;
  const markSize = 150;
  const gap = 24;
  const rowX = (W - (markSize + gap + wordWidth)) / 2;
  if (mark) ctx.drawImage(mark, rowX, 300, markSize, markSize);
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.fillText("Studily", rowX + markSize + gap, 420);

  let listTop = 820;
  if (profile) {
    const size = 340;
    const cy = 530 + size / 2;
    await drawAvatar(ctx, profile, W / 2, cy, size);
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = `700 64px ${SANS}`;
    ctx.fillText(fitText(ctx, profile.name || profile.username, W - 160), W / 2, cy + size / 2 + 100);
    ctx.fillStyle = MUTED;
    ctx.font = `500 40px ${SANS}`;
    ctx.fillText(fitText(ctx, `@${profile.username}`, W - 160), W / 2, cy + size / 2 + 160);
    listTop = cy + size / 2 + 230;
  }

  const cardW = W - 160;
  const cardH = 190;
  const spacing = 32;
  for (let i = 0; i < FEATURES.length; i++) {
    await drawFeature(ctx, FEATURES[i], 80, listTop + i * (cardH + spacing), cardW, cardH);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = ACCENT;
  ctx.font = `700 52px ${MONO}`;
  ctx.fillText("studily.ca", W / 2, H - 90);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Couldn't build the image"));
    }, "image/png");
  });
}
