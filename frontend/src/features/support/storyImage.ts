import { loadMark } from "../../lib/scheduleImage";

const W = 1080;
const H = 1920;

const OUTER =
  "M50 94 C40 86 4 64 4 34 C4 17 17 5 32 5 C40 5 46 9 50 16 C54 9 60 5 68 5 C83 5 96 17 96 34 C96 64 60 86 50 94 Z";
const MID =
  "M50 86 C41 79 12 60 12 36 C12 23 22 13 33 13 C41 13 46 18 50 25 C54 18 59 13 67 13 C78 13 88 23 88 36 C88 60 59 79 50 86 Z";
const CORE =
  "M50 67 C44 63 29 53 29 41 C29 35 34 30 39 30 C44 30 48 33 50 38 C52 33 56 30 61 30 C66 30 71 35 71 41 C71 53 56 63 50 67 Z";
const SHINE = "M17 44 C14 32 19 21 29 17 C24 24 21 33 22 45 Z";

const SANS = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif';
const MONO = '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace';

function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const scale = size / 100;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(scale, scale);

  ctx.shadowColor = "rgba(47, 215, 124, 0.75)";
  ctx.shadowBlur = size * 0.22;
  ctx.fillStyle = "#0d6b3c";
  ctx.fill(new Path2D(OUTER));
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#1fae5c";
  ctx.fill(new Path2D(MID));
  ctx.fillStyle = "#45dc8a";
  ctx.fill(new Path2D(CORE));
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#ffffff";
  ctx.fill(new Path2D(SHINE));
  ctx.restore();
}

export async function renderStoryCard(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1230");
  bg.addColorStop(0.55, "#0a1a2e");
  bg.addColorStop(1, "#06141a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const halo = ctx.createRadialGradient(W / 2, 760, 40, W / 2, 760, 620);
  halo.addColorStop(0, "rgba(47, 215, 124, 0.32)");
  halo.addColorStop(1, "rgba(47, 215, 124, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  drawHeart(ctx, W / 2, 760, 560);

  const mark = await loadMark();
  if (mark) ctx.drawImage(mark, W / 2 - 60, 1180, 120, 120);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e4e4f0";
  ctx.font = `700 76px ${SANS}`;
  ctx.fillText("I study with Studily", W / 2, 1440);

  ctx.fillStyle = "#45dc8a";
  ctx.font = `700 52px ${MONO}`;
  ctx.fillText("studily.ca", W / 2, 1530);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Couldn't build the image"));
    }, "image/png");
  });
}
