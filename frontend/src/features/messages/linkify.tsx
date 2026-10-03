import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import { api } from "../../lib/api";
import type { SharedFlashcardSet } from "../../types";

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

function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

export function inAppPath(href: string): string | null {
  try {
    const url = new URL(href);
    if (bareHost(url.host) !== bareHost(window.location.host)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function sharedSetId(path: string | null): number | null {
  const match = path?.match(/^\/sets\/(\d+)\/?(?:[?#]|$)/);
  return match ? Number(match[1]) : null;
}

export function firstLink(body: string): string | null {
  for (const part of splitLinks(body)) {
    if (typeof part !== "string") return part.href;
  }
  return null;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function LinkTo({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const path = inAppPath(href);
  const handlers = { onClick: stop, onDoubleClick: stop, onPointerDown: stop };
  if (path) {
    return (
      <Link to={path} className={className} {...handlers}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={className} {...handlers}>
      {children}
    </a>
  );
}

export function Linkified({ body, mine }: { body: string; mine: boolean }) {
  return (
    <>
      {splitLinks(body).map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <LinkTo
            key={i}
            href={part.href}
            className={`select-text underline decoration-1 underline-offset-2 transition-opacity hover:opacity-80 ${
              mine ? "" : "text-accent"
            }`}
          >
            {part.text}
          </LinkTo>
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

function previewClass(mine: boolean): string {
  return `mt-1 block w-[min(300px,72vw)] overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:bg-surface-hi animate-fade ${
    mine ? "ml-auto" : ""
  }`;
}

export function LinkPreview({ url, mine }: { url: string; mine: boolean }) {
  const setId = sharedSetId(inAppPath(url));
  if (setId != null) return <SharedSetPreview url={url} setId={setId} mine={mine} />;
  return <PagePreview url={url} mine={mine} />;
}

function SharedSetPreview({ url, setId, mine }: { url: string; setId: number; mine: boolean }) {
  const set = useQuery({
    queryKey: ["flashcards", "shared", setId],
    queryFn: () => api.get<SharedFlashcardSet>(`/public/flashcard-sets/${setId}`),
    staleTime: 60_000,
    retry: false,
  });

  const data = set.data;
  if (!data) return null;
  const owner = data.owner.name || data.owner.username;

  return (
    <LinkTo href={url} className={previewClass(mine)}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <Layers size={18} style={{ color: "var(--accent)" }} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-medium uppercase tracking-wide text-fg-3">
            Studily · Flashcard set
          </span>
          <span className="line-clamp-2 block text-[13px] font-semibold text-fg">{data.title}</span>
          <span className="block truncate text-[12px] text-fg-2">
            by {owner} · {data.cardCount} {data.cardCount === 1 ? "card" : "cards"}
          </span>
        </span>
      </div>
    </LinkTo>
  );
}

function PagePreview({ url, mine }: { url: string; mine: boolean }) {
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
    <LinkTo href={url} className={previewClass(mine)}>
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
    </LinkTo>
  );
}
