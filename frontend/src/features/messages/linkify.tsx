import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING = /[.,!?;:'"*_~]+$/;

interface LinkPart {
  href: string;
  text: string;
}

function trimLink(raw: string): string {
  let text = raw.replace(TRAILING, "");
  while (text.endsWith(")") && (text.match(/\(/g)?.length ?? 0) < (text.match(/\)/g)?.length ?? 0)) {
    text = text.slice(0, -1).replace(TRAILING, "");
  }
  return text;
}

function toHref(text: string): string | null {
  const candidate = /^www\./i.test(text) ? `https://${text}` : text;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function splitLinks(body: string): (string | LinkPart)[] {
  const parts: (string | LinkPart)[] = [];
  let last = 0;
  for (const match of body.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const text = trimLink(match[0]);
    const href = text ? toHref(text) : null;
    if (!href) continue;
    if (start > last) parts.push(body.slice(last, start));
    parts.push({ href, text });
    last = start + text.length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

export function firstLink(body: string): string | null {
  for (const part of splitLinks(body)) {
    if (typeof part !== "string") return part.href;
  }
  return null;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function Linkified({ body, mine }: { body: string; mine: boolean }) {
  return (
    <>
      {splitLinks(body).map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={stop}
            onDoubleClick={stop}
            onPointerDown={stop}
            className={`select-text underline decoration-1 underline-offset-2 transition-opacity hover:opacity-80 ${
              mine ? "" : "text-accent"
            }`}
          >
            {part.text}
          </a>
        ),
      )}
    </>
  );
}

interface LinkPreviewData {
  url: string;
  siteName: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
}

export function LinkPreview({ url, mine }: { url: string; mine: boolean }) {
  const preview = useQuery({
    queryKey: ["link-preview", url],
    queryFn: () => api.get<LinkPreviewData | undefined>(`/link-preview?url=${encodeURIComponent(url)}`),
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    retry: false,
  });

  const data = preview.data;
  if (!data || (!data.title && !data.description)) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={stop}
      onDoubleClick={stop}
      onPointerDown={stop}
      className={`mt-1 block w-[min(300px,72vw)] overflow-hidden rounded-xl border border-line transition-colors hover:bg-surface-hi animate-fade ${
        mine ? "ml-auto" : ""
      }`}
      style={{ background: "var(--surface)" }}
    >
      {data.image && (
        <img
          src={data.image}
          alt=""
          className="block max-h-[170px] w-full object-cover"
          style={{ background: "var(--surface-hi)" }}
        />
      )}
      <div className="px-3 py-2">
        {data.siteName && (
          <div className="truncate text-[11px] font-medium uppercase tracking-wide text-fg-3">{data.siteName}</div>
        )}
        {data.title && <div className="line-clamp-2 text-[13px] font-semibold text-fg">{data.title}</div>}
        {data.description && (
          <div className="mt-0.5 line-clamp-2 text-[12px] text-fg-2">{data.description}</div>
        )}
      </div>
    </a>
  );
}
