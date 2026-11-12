import { Fragment, Suspense, lazy, useLayoutEffect, useRef, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { usePresence } from "../../lib/motion";
import type { Citation } from "./api";
import CitationChip from "./CitationChip";
import Mascot, { type MascotState } from "./Mascot";

export interface ThreadItem {
  id: number | string;
  mine: boolean;
  body: string;
  citations?: Citation[];
  attachments?: ThreadAttachment[];
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

export interface MascotSpeech {
  text: string;
  open: boolean;
}

function MascotBubble({ text, open, onHold }: MascotSpeech & { onHold?: (held: boolean) => void }) {
  const { mounted, state } = usePresence(open, 140);
  if (!mounted) return null;
  return (
    <div
      className={`pointer-events-auto absolute bottom-full left-0 z-10 mb-3 w-max max-w-[min(22rem,calc(100vw-14rem))] origin-bottom-left ${state === "in" ? "panel-in" : "overlay-out"}`}
      aria-hidden="true"
      onMouseEnter={() => onHold?.(true)}
      onMouseLeave={() => onHold?.(false)}
    >
      <div data-tail="down" className="tour-bubble rounded-2xl text-[13px] leading-snug text-fg">
        <div className="max-h-[50vh] overflow-y-auto overscroll-contain px-3.5 py-2.5">
          {text.trim() ? <Markdownish text={text} /> : <span className="block py-1"><Dots /></span>}
        </div>
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

function DefaultBubble({ item }: { item: ThreadItem }) {
  if (item.mine) {
    return (
      <div className="chat-in flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1.5 md:max-w-[70%]">
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
          className="rounded-2xl rounded-bl-md px-4 py-3 text-[14px] leading-relaxed text-fg"
          style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}
        >
          <Markdownish text={item.body} />
        </div>
        {item.citations && item.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.citations.map((citation) => (
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
  speech = null,
  onHoldSpeech,
}: {
  items: T[];
  renderItem?: (item: T) => ReactNode | undefined;
  typing?: boolean;
  typingLabel?: string;
  empty?: ReactNode;
  mascot?: MascotState;
  speech?: MascotSpeech | null;
  onHoldSpeech?: (held: boolean) => void;
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
    <div className="flex min-h-0 flex-1">
      <div className="pointer-events-none hidden w-36 shrink-0 flex-col items-center justify-end pb-4 pl-3 md:flex lg:w-44">
        <div className="relative">
          {speech && <MascotBubble text={speech.text} open={speech.open} onHold={onHoldSpeech} />}
          <span aria-hidden="true" className="lg:hidden">
            <Mascot state={mascot} size={104} shadow />
          </span>
          <span aria-hidden="true" className="hidden lg:inline">
            <Mascot state={mascot} size={136} shadow />
          </span>
        </div>
      </div>
      {thread}
    </div>
  );
}
