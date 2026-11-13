import { Fragment, Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import Lightbox from "../../components/Lightbox";
import { botApi } from "./api";
import { usePresence } from "../../lib/motion";
import type { Citation } from "./api";
import CitationChip, { SlideFigure } from "./CitationChip";
import { placeSlides } from "./slidePlacement";
import Mascot, { type MascotState } from "./Mascot";

export interface ThreadItem {
  id: number | string;
  mine: boolean;
  body: string;
  citations?: Citation[];
  attachments?: ThreadAttachment[];
  images?: ThreadImage[];
}

export interface ThreadImage {
  key: string;
  src?: string;
  chatId?: number;
}

export interface ThreadAttachment {
  key: string;
  name: string;
  note?: string | null;
}

const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));

export function Markdownish({ text, className }: { text: string; className?: string }) {
  return (
    <Suspense fallback={<p className={`whitespace-pre-wrap break-words ${className ?? ""}`}>{text}</p>}>
      <MarkdownRenderer text={text} className={className} />
    </Suspense>
  );
}

export function Dots() {
  return (
    <span className="flex items-center gap-1.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 rounded-full bg-fg-3 animate-bounce motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function TypingRow({ label }: { label: string }) {
  return (
    <div className="chat-in flex items-end gap-2.5">
      <Avatar />
      <div
        className="flex items-center rounded-2xl rounded-bl-md px-4 py-3"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}
        role="status"
        aria-label={label}
      >
        <Dots />
      </div>
    </div>
  );
}

function MascotBubble({ open }: { open: boolean }) {
  const { mounted, state } = usePresence(open, 140);
  if (!mounted) return null;
  return (
    <div
      aria-hidden="true"
      className={`absolute bottom-full left-0 z-30 mb-3 origin-bottom-left ${state === "in" ? "panel-in" : "overlay-out"}`}
    >
      <div data-tail="down" className="tour-bubble rounded-2xl px-4 py-3">
        <span className="block py-1">
          <Dots />
        </span>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
    >
      <Mascot crop="head" size={26} still />
    </span>
  );
}

function ThreadImageThumb({ image }: { image: ThreadImage }) {
  const [open, setOpen] = useState(false);
  const remote = useQuery({
    queryKey: ["bot", "image", image.chatId, image.key],
    queryFn: () => botApi.image(image.chatId!, image.key),
    enabled: !image.src && image.chatId != null,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 1,
  });
  const objectUrl = useMemo(() => (remote.data ? URL.createObjectURL(remote.data) : null), [remote.data]);
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);
  const url = image.src ?? objectUrl;
  return (
    <li
      className="overflow-hidden rounded-xl"
      style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
    >
      {url ? (
        <>
          <button type="button" onClick={() => setOpen(true)} className="block" aria-label="View image">
            <img src={url} alt="Attached image" className="block h-28 w-auto max-w-[220px] object-cover md:h-36" />
          </button>
          {open && <Lightbox url={url} alt="Attached image" onClose={() => setOpen(false)} />}
        </>
      ) : (
        <div className="flex h-28 w-28 items-center justify-center md:h-36 md:w-36">
          {remote.isError ? (
            <span className="px-2 text-center text-[11px] text-fg-3">Couldn't load image</span>
          ) : (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
          )}
        </div>
      )}
    </li>
  );
}

function DefaultBubble({ item }: { item: ThreadItem }) {
  const { parts, chips } = useMemo(
    () => (item.mine ? { parts: [], chips: [] } : placeSlides(item.body, item.citations ?? [])),
    [item.mine, item.body, item.citations],
  );
  if (item.mine) {
    return (
      <div className="chat-in flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1.5 md:max-w-[70%]">
          {item.images && item.images.length > 0 && (
            <ul className="flex flex-wrap justify-end gap-1.5">
              {item.images.map((image) => (
                <ThreadImageThumb key={image.key} image={image} />
              ))}
            </ul>
          )}
          {item.attachments && item.attachments.length > 0 && (
            <ul className="flex flex-wrap justify-end gap-1.5">
              {item.attachments.map((file) => (
                <li
                  key={file.key}
                  className="flex max-w-[240px] items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
                >
                  <FileText size={14} className="shrink-0 text-accent" />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium text-fg" title={file.name}>
                      {file.name}
                    </span>
                    {file.note && <span className="block truncate text-[11px] text-fg-3">{file.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {item.body && (
            <div
              className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] leading-relaxed"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              {item.body}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="chat-in flex items-start gap-2.5">
      <Avatar />
      <div className="min-w-0 max-w-[88%] space-y-2.5 md:max-w-[78%]">
        <div
          className="space-y-3 rounded-2xl rounded-bl-md px-4 py-3 text-[14px] leading-relaxed text-fg"
          style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}
        >
          {parts.map((part, i) =>
            part.kind === "text" ? (
              <Markdownish key={i} text={part.text} />
            ) : (
              <div key={i} className={`grid gap-3 ${part.slides.length > 1 ? "sm:grid-cols-2" : ""}`}>
                {part.slides.map((slide) => (
                  <SlideFigure key={`${slide.fileId}-${slide.page}`} source={slide} />
                ))}
              </div>
            ),
          )}
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((citation) => (
              <CitationChip key={`${citation.index}-${citation.fileId}-${citation.page ?? "x"}`} citation={citation} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatThread<T extends ThreadItem>({
  items,
  renderItem,
  typing = false,
  typingLabel = "StudilyBot is thinking",
  empty,
  mascot,
  thinking = false,
}: {
  items: T[];
  renderItem?: (item: T) => ReactNode | undefined;
  typing?: boolean;
  typingLabel?: string;
  empty?: ReactNode;
  mascot?: MascotState;
  thinking?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const last = items[items.length - 1];
  const lastKey = last ? `${last.id}:${last.body.length}:${last.mine}` : "none";

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (last?.mine) stick.current = true;
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [items.length, lastKey, typing]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  }

  const thread = (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-4 pb-4 md:px-8"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {items.length === 0 && !typing && empty}
        {items.map((item) => {
          const custom = renderItem?.(item);
          return <Fragment key={item.id}>{custom !== undefined ? custom : <DefaultBubble item={item} />}</Fragment>;
        })}
        {typing && <TypingRow label={typingLabel} />}
      </div>
    </div>
  );

  if (!mascot) return thread;
  return (
    <div className="@container relative flex min-h-0 flex-1">
      {thread}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden @5xl:block">
        <div className="relative">
          <MascotBubble open={thinking} />
          <span aria-hidden="true" className="@6xl:hidden">
            <Mascot state={mascot} size={112} shadow />
          </span>
          <span aria-hidden="true" className="hidden @6xl:inline">
            <Mascot state={mascot} size={136} shadow />
          </span>
        </div>
      </div>
    </div>
  );
}
