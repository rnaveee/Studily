import { createElement } from "react";
import FlairSvg from "../../components/FlairSvg";
import StudilyBot from "../../components/StudilyBot";
import { BOT_STARTER } from "../../lib/botArt";
import { buildFlairArt, flairArtKind, type FlairArtKind } from "../../lib/flairArt";
import { FLAIR_RINGS, ringWidth, type FlairRing } from "../../lib/flairs";
import type { BotOutfitRef, FlairRef } from "../../types";

const W = 1080;
const H = 1920;
const ACCENT = "#7c83f3";
const ACCENT_DEEP = "#4f46e5";
const INK = "#ffffff";
const MUTED = "#dcd8ff";
const CARD_INK = "#1e1b4b";

const SANS = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif';
const MONO = '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace';

export interface StoryProfile {
  name: string;
  username: string;
  avatarUrl?: string | null;
  flair?: FlairRef | null;
  botOutfit?: BotOutfitRef | null;
}

type Visual = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, outfit: BotOutfitRef) => Promise<void>;

const FEATURES: { title: string; line: string; visual: Visual }[] = [
  { title: "Scheduling", line: "Classes, deadlines and exams in one plan", visual: (ctx, x, y, w, h) => drawSchedule(ctx, x, y, w, h) },
  { title: "Flashcards", line: "Turn your notes into study sets", visual: (ctx, x, y, w, h) => drawFlashcards(ctx, x, y, w, h) },
  { title: "StudilyBot", line: "An AI tutor for your own courses", visual: (ctx, x, y, w, h, outfit) => drawBot(ctx, x, y, w, h, outfit) },
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

async function mascotImage(outfit: BotOutfitRef, width: number): Promise<HTMLImageElement | null> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(
    createElement(StudilyBot, { pose: "wave", top: outfit.top, bottom: outfit.bottom, size: width }),
  )
    .replace(/ class="[^"]*"/g, "")
    .replace(/ style="[^"]*"/g, "");
  return svgImage(markup);
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

function wrapLines(ctx: CanvasRenderingContext2D, text: string, max: number, limit: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= max || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= limit) return lines;
  const kept = lines.slice(0, limit);
  kept[limit - 1] = fitText(ctx, `${kept[limit - 1]} ${lines.slice(limit).join(" ")}`, max);
  return kept;
}

const SCHEDULE_DAYS = ["M", "T", "W", "T", "F"];
const SCHEDULE_BLOCKS: [number, number, number, string, string][] = [
  [0, 0, 1.4, "#6366f1", "MATH"],
  [0, 2.4, 1.3, "#f59e0b", "ENGL"],
  [1, 0.8, 1.6, "#10b981", "BIOL"],
  [2, 0, 1.4, "#6366f1", "MATH"],
  [2, 2.2, 1.5, "#ec4899", "CPSC"],
  [3, 0.8, 1.6, "#10b981", "BIOL"],
  [3, 2.6, 1.2, "#0ea5e9", "Exam"],
  [4, 0, 1.4, "#6366f1", "MATH"],
  [4, 1.9, 1.5, "#f59e0b", "ENGL"],
];

async function drawSchedule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.shadowColor = "rgba(20,10,80,0.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  const pad = 14;
  const head = 30;
  const colW = (w - pad * 2) / SCHEDULE_DAYS.length;
  const bodyTop = y + pad + head;
  const rowH = (h - pad * 2 - head) / 4;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 18px ${SANS}`;
  ctx.fillStyle = "#6b7280";
  SCHEDULE_DAYS.forEach((day, i) => ctx.fillText(day, x + pad + colW * i + colW / 2, y + pad + head / 2 - 2));
  ctx.strokeStyle = "#eef0f6";
  ctx.lineWidth = 2;
  for (let r = 0; r <= 4; r++) {
    ctx.beginPath();
    ctx.moveTo(x + pad, bodyTop + rowH * r);
    ctx.lineTo(x + w - pad, bodyTop + rowH * r);
    ctx.stroke();
  }
  ctx.font = `800 15px ${SANS}`;
  for (const [day, start, length, color, label] of SCHEDULE_BLOCKS) {
    const bx = x + pad + colW * day + 3;
    const by = bodyTop + rowH * start + 2;
    const bw = colW - 6;
    const bh = rowH * length - 4;
    roundRect(ctx, bx, by, bw, bh, 8);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, bx + bw / 2, by + Math.min(bh / 2, 18));
  }
}

async function drawFlashcards(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cw = w - 50;
  const ch = h - 30;
  const cx = x + 20;
  const cy = y + 18;
  for (const [dx, dy, angle, alpha] of [
    [26, -10, 0.06, 0.45],
    [14, -4, 0.03, 0.7],
  ] as const) {
    ctx.save();
    ctx.translate(cx + cw / 2 + dx, cy + ch / 2 + dy);
    ctx.rotate(angle);
    roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 20);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(cx + cw / 2, cy + ch / 2);
  ctx.rotate(-0.03);
  ctx.shadowColor = "rgba(20,10,80,0.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 20);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ACCENT_DEEP;
  ctx.font = `700 17px ${SANS}`;
  ctx.fillText("CALCULUS I · 24 CARDS", -cw / 2 + 22, -ch / 2 + 34);
  ctx.fillStyle = CARD_INK;
  ctx.font = `700 26px ${SANS}`;
  wrapLines(ctx, "What is the derivative of sin x?", cw - 44, 2).forEach((line, i) =>
    ctx.fillText(line, -cw / 2 + 22, -ch / 2 + 74 + i * 32),
  );
  ctx.fillStyle = "#9ca3af";
  ctx.font = `600 15px ${SANS}`;
  ctx.fillText("Tap to flip", -cw / 2 + 22, ch / 2 - 18);
  ctx.restore();
}

async function drawBot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  outfit: BotOutfitRef,
) {
  const width = 170;
  const img = await mascotImage(outfit, width);
  const height = img ? (width * img.naturalHeight) / img.naturalWidth : 0;
  const botX = x + w - width - 6;
  const botY = y + h - height + 6;

  const bubbleW = w - width - 6;
  const bubbleH = 92;
  const bubbleX = x;
  const bubbleY = y + 10;
  ctx.save();
  ctx.shadowColor = "rgba(20,10,80,0.3)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 22);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bubbleX + bubbleW - 6, bubbleY + bubbleH - 34);
  ctx.lineTo(bubbleX + bubbleW + 18, bubbleY + bubbleH - 18);
  ctx.lineTo(bubbleX + bubbleW - 10, bubbleY + bubbleH - 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = CARD_INK;
  ctx.font = `700 20px ${SANS}`;
  wrapLines(ctx, "Ask me anything about your notes!", bubbleW - 32, 2).forEach((line, i) =>
    ctx.fillText(line, bubbleX + 16, bubbleY + 38 + i * 26),
  );

  if (img) {
    ctx.save();
    ctx.shadowColor = "rgba(20,10,80,0.35)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.drawImage(img, botX, botY, width, height);
    ctx.restore();
  }
}

async function drawFeature(
  ctx: CanvasRenderingContext2D,
  feature: (typeof FEATURES)[number],
  x: number,
  y: number,
  w: number,
  h: number,
  outfit: BotOutfitRef,
) {
  roundRect(ctx, x, y, w, h, 40);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.24)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const visualW = 400;
  const tx = x + 44;
  const maxText = w - visualW - 44 - 40;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = `800 50px ${SANS}`;
  ctx.font = `500 30px ${SANS}`;
  const lines = wrapLines(ctx, feature.line, maxText, 2);
  const block = 56 + lines.length * 38;
  const top = y + (h - block) / 2 + 44;
  ctx.font = `800 50px ${SANS}`;
  ctx.fillText(feature.title, tx, top);
  ctx.fillStyle = MUTED;
  ctx.font = `500 30px ${SANS}`;
  lines.forEach((line, i) => ctx.fillText(line, tx, top + 52 + i * 38));

  await feature.visual(ctx, x + w - visualW - 24, y + 20, visualW, h - 40, outfit);
}

export async function renderStoryCard(profile: StoryProfile | null = null): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  if (document.fonts?.ready) await document.fonts.ready;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#6a5cf0");
  bg.addColorStop(0.5, "#5548c8");
  bg.addColorStop(1, "#3a2e9e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  for (const [x, y, r, a] of [
    [W * 0.1, 220, 560, 0.18],
    [W * 0.95, 900, 600, 0.14],
    [W * 0.25, 1750, 640, 0.12],
  ] as const) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, `rgba(255,255,255,${a})`);
    glow.addColorStop(1, "rgba(255,255,255,0)");
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
  const gap = 28;
  const rowX = (W - (markSize + gap + wordWidth)) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(20,10,80,0.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, rowX, 300, markSize, markSize, 38);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
  if (mark) ctx.drawImage(mark, rowX + 18, 318, markSize - 36, markSize - 36);
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.fillText("Studily", rowX + markSize + gap, 420);

  const cardW = W - 160;
  const cardH = 228;
  const spacing = 28;
  const listHeight = FEATURES.length * cardH + (FEATURES.length - 1) * spacing;
  let listTop = Math.round((470 + 1790) / 2 - listHeight / 2);
  if (profile) {
    const size = 300;
    const cy = 520 + size / 2;
    await drawAvatar(ctx, profile, W / 2, cy, size);
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = `700 64px ${SANS}`;
    ctx.fillText(fitText(ctx, profile.name || profile.username, W - 160), W / 2, cy + size / 2 + 90);
    ctx.fillStyle = MUTED;
    ctx.font = `500 40px ${SANS}`;
    ctx.fillText(fitText(ctx, `@${profile.username}`, W - 160), W / 2, cy + size / 2 + 145);
    listTop = cy + size / 2 + 200;
  }

  const outfit = profile?.botOutfit ?? BOT_STARTER;
  for (let i = 0; i < FEATURES.length; i++) {
    await drawFeature(ctx, FEATURES[i], 80, listTop + i * (cardH + spacing), cardW, cardH, outfit);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = `700 52px ${MONO}`;
  ctx.fillText("studily.ca", W / 2, H - 70);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Couldn't build the image"));
    }, "image/png");
  });
}
