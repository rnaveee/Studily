import type { Citation } from "./api";

export const MAX_INLINE_SLIDES = 4;

export type SlideCitation = Citation & { page: number };

export type AnswerPart = { kind: "text"; text: string } | { kind: "slides"; slides: SlideCitation[] };

export function paragraphBreaks(text: string): number[] {
  const breaks: number[] = [];
  let inFence = false;
  let inMath = false;
  let position = 0;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) inFence = !inFence;
    else if (!inFence && (trimmed.match(/\$\$/g)?.length ?? 0) % 2 === 1) inMath = !inMath;
    const end = position + line.length;
    if (!inFence && !inMath && trimmed === "" && i > 0 && lines[i - 1].trim() !== "") breaks.push(position);
    position = end + 1;
  }
  return breaks;
}

const isSlide = (citation: Citation): citation is SlideCitation => citation.previewable && citation.page != null;

export function placeSlides(text: string, citations: Citation[]): { parts: AnswerPart[]; chips: Citation[] } {
  const seen = new Set<string>();
  const slides: SlideCitation[] = [];
  const chips: Citation[] = [];
  const ordered = [...citations].sort((a, b) => (a.offset ?? text.length) - (b.offset ?? text.length));
  for (const citation of ordered) {
    if (!isSlide(citation)) {
      chips.push(citation);
      continue;
    }
    const key = `${citation.fileId}:${citation.page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (slides.length < MAX_INLINE_SLIDES) slides.push(citation);
    else chips.push(citation);
  }

  const breaks = paragraphBreaks(text);
  const groups = new Map<number, SlideCitation[]>();
  for (const slide of slides) {
    const offset = Math.min(Math.max(slide.offset ?? text.length, 0), text.length);
    const at = breaks.find((b) => b >= offset) ?? text.length;
    groups.set(at, [...(groups.get(at) ?? []), slide]);
  }

  const parts: AnswerPart[] = [];
  let from = 0;
  for (const at of [...groups.keys()].sort((a, b) => a - b)) {
    const chunk = text.slice(from, at);
    if (chunk.trim()) parts.push({ kind: "text", text: chunk });
    parts.push({ kind: "slides", slides: groups.get(at)! });
    from = at;
  }
  const rest = text.slice(from);
  if (rest.trim() || parts.length === 0) parts.push({ kind: "text", text: rest });
  return { parts, chips };
}
