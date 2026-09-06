import { hhmm } from "./format";
import { coursesToDays, toMin } from "../components/WeekGrid";
import { MEETING_KIND_LABEL } from "../types";
import type { Course } from "../types";

const DARK = {
  bg: "#0c0c10",
  surface: "#16161e",
  surfaceHi: "#202028",
  line: "#2a2a38",
  fg: "#e4e4f0",
  fg2: "#8484a0",
  fg3: "#50506a",
  accent: "#7968dc",
};

const SANS = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif';
const MONO = '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace';

const SCALE = 2;
const WIDTH = 940;
const PAD = 44;
const HEADER_H = 96;
const FOOTER_H = 74;
const RAIL_W = 46;
const DAY_HEAD_H = 34;
const HOUR_H = 54;
const FALLBACK_START = 8;
const FALLBACK_END = 17;

function hourBounds(mins: { start: number; end: number }[]) {
  if (mins.length === 0) return { startHour: FALLBACK_START, endHour: FALLBACK_END };
  const startHour = Math.floor(Math.min(...mins.map((m) => m.start)) / 60);
  const endHour = Math.ceil(Math.max(...mins.map((m) => m.end)) / 60);
  return { startHour, endHour: Math.max(endHour, startHour + 1) };
}

function fmtHour(h: number): string {
  const hour = h % 24;
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour > 12 ? `${hour - 12}p` : `${hour}a`;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

async function loadMark(): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.src = "/studily-3a-192.png";
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

export interface ScheduleCardOptions {
  name: string;
  school?: string | null;
  semesterLabel?: string | null;
  courses: Course[];
}

export function hasMeetings(courses: Course[]): boolean {
  return courses.some((c) => (c.meetingBlocks ?? []).length > 0);
}

export async function renderScheduleCard(opts: ScheduleCardOptions): Promise<Blob> {
  const days = coursesToDays(opts.courses);
  const all = days.flatMap((d) =>
    d.meetings.map((m) => ({ start: toMin(m.startTime), end: toMin(m.endTime) })),
  );
  const { startHour, endHour } = hourBounds(all);
  const gridMinutes = (endHour - startHour) * 60;
  const pxPerMin = HOUR_H / 60;
  const gridBodyH = gridMinutes * pxPerMin;
  const gridH = DAY_HEAD_H + gridBodyH;
  const height = PAD + HEADER_H + gridH + FOOTER_H + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.scale(SCALE, SCALE);

  await document.fonts.ready;

  ctx.fillStyle = DARK.bg;
  ctx.fillRect(0, 0, WIDTH, height);

  const panelX = PAD / 2;
  const panelY = PAD / 2;
  const panelW = WIDTH - PAD;
  const panelH = height - PAD;
  ctx.fillStyle = DARK.surface;
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 20);
  ctx.fill();
  ctx.strokeStyle = DARK.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  const left = PAD;
  const right = WIDTH - PAD;
  const innerW = right - left;

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = DARK.fg;
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText(truncate(ctx, opts.name, innerW), left, PAD + 34);

  const sub = [opts.school, opts.semesterLabel].filter(Boolean).join(" · ");
  if (sub) {
    ctx.fillStyle = DARK.fg2;
    ctx.font = `500 16px ${SANS}`;
    ctx.fillText(truncate(ctx, sub, innerW), left, PAD + 62);
  }

  const gridTop = PAD + HEADER_H;
  const colX = left + RAIL_W;
  const colW = days.length > 0 ? (innerW - RAIL_W) / days.length : innerW - RAIL_W;
  const bodyTop = gridTop + DAY_HEAD_H;

  ctx.font = `600 13px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillStyle = DARK.fg2;
  days.forEach((day, i) => {
    ctx.fillText(day.label.toUpperCase(), colX + colW * i + colW / 2, gridTop + 21);
  });

  ctx.textAlign = "right";
  ctx.font = `500 11px ${SANS}`;
  for (let h = startHour; h <= endHour; h++) {
    const y = bodyTop + (h - startHour) * HOUR_H;
    ctx.fillStyle = DARK.fg3;
    ctx.fillText(fmtHour(h), colX - 10, y + 4);
    ctx.strokeStyle = DARK.line;
    ctx.beginPath();
    ctx.moveTo(colX, y + 0.5);
    ctx.lineTo(right, y + 0.5);
    ctx.stroke();
  }

  ctx.strokeStyle = DARK.line;
  for (let i = 0; i <= days.length; i++) {
    const x = Math.round(colX + colW * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, bodyTop);
    ctx.lineTo(x, bodyTop + gridBodyH);
    ctx.stroke();
  }

  ctx.textAlign = "left";
  days.forEach((day, i) => {
    day.meetings.forEach((m) => {
      const start = Math.max(toMin(m.startTime), startHour * 60);
      const end = Math.min(toMin(m.endTime), endHour * 60);
      const blockH = (end - start) * pxPerMin;
      if (blockH <= 0) return;
      const x = colX + colW * i + 3;
      const y = bodyTop + (start - startHour * 60) * pxPerMin;
      const w = colW - 6;

      ctx.fillStyle = m.color ?? DARK.accent;
      ctx.beginPath();
      ctx.roundRect(x, y, w, blockH, 6);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, blockH);
      ctx.clip();

      const padX = x + 7;
      const textW = w - 14;
      let ty = y + 16;
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 13px ${SANS}`;
      ctx.fillText(truncate(ctx, m.code || m.courseName, textW), padX, ty);

      if (blockH > 34) {
        ty += 15;
        ctx.globalAlpha = 0.85;
        ctx.font = `500 11px ${SANS}`;
        const line = m.kind
          ? MEETING_KIND_LABEL[m.kind]
          : `${hhmm(m.startTime)}–${hhmm(m.endTime)}`;
        ctx.fillText(truncate(ctx, line, textW), padX, ty);
      }
      if (blockH > 52) {
        ty += 14;
        ctx.globalAlpha = 0.75;
        ctx.font = `500 11px ${SANS}`;
        ctx.fillText(truncate(ctx, `${hhmm(m.startTime)}–${hhmm(m.endTime)}`, textW), padX, ty);
      }
      if (m.location && blockH > 70) {
        ty += 14;
        ctx.globalAlpha = 0.7;
        ctx.fillText(truncate(ctx, m.location, textW), padX, ty);
      }
      ctx.restore();
    });
  });

  const footTop = gridTop + gridH + 26;
  const mark = await loadMark();
  let x = left;
  if (mark) {
    ctx.drawImage(mark, x, footTop, 26, 26);
    x += 34;
  }
  ctx.fillStyle = DARK.fg;
  ctx.font = `700 19px ${MONO}`;
  ctx.fillText("Studily", x, footTop + 20);
  x += ctx.measureText("Studily").width + 12;
  ctx.fillStyle = DARK.fg3;
  ctx.font = `500 14px ${SANS}`;
  ctx.fillText("your student planner", x, footTop + 20);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not render the image"));
    }, "image/png");
  });
}
