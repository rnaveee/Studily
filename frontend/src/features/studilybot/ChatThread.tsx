import { Fragment, useLayoutEffect, useRef, type ReactNode } from "react";
import type { Citation } from "./api";
import CitationChip from "./CitationChip";
import Mascot, { type MascotState } from "./Mascot";

export interface ThreadItem {
  id: number | string;
  mine: boolean;
  body: string;
  citations?: Citation[];
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      current = null;
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const content = (bullet ?? numbered)![1];
      if (current && current.kind === kind) {
        current.items.push(content);
      } else {
        current = { kind, items: [content] };
        blocks.push(current);
      }
      continue;
    }
    if (current && current.kind === "p") {
      current.lines.push(line);
    } else {
      current = { kind: "p", lines: [line] };
      blocks.push(current);
    }
  }
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-fg">{part.slice(2, -2)}</strong>;
    }
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded px-1 py-px font-mono text-[12.5px]" style={{ background: "var(--surface-hi)" }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Markdownish({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-2.5 break-words">
      {blocks.map((block, i) => {
        if (block.kind === "p") {
          return (
            <p key={i}>
              {block.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {renderInline(line)}
                </Fragment>
              ))}
            </p>
          );
        }
        const List = block.kind === "ul" ? "ul" : "ol";
        return (
          <List
            key={i}
            className={`space-y-1 pl-5 ${block.kind === "ul" ? "list-disc" : "list-decimal"} marker:text-fg-3`}
          >
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

function TypingRow({ label }: { label: string }) {
  return (
    <div className="chat-in flex items-end gap-2.5">
      <Avatar />
      <div
        className="flex items-center gap-1.5 rounded-2xl rounded-bl-md px-4 py-3"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}
        role="status"
        aria-label={label}
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 rounded-full bg-fg-3 animate-bounce motion-reduce:animate-none"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
      style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
    >
      <Mascot crop="head" size={24} still />
    </span>
  );
}

function DefaultBubble({ item }: { item: ThreadItem }) {
  if (item.mine) {
    return (
      <div className="chat-in flex justify-end">
        <div
          className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] leading-relaxed md:max-w-[70%]"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {item.body}
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
}: {
  items: T[];
  renderItem?: (item: T) => ReactNode | undefined;
  typing?: boolean;
  typingLabel?: string;
  empty?: ReactNode;
  mascot?: MascotState;
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
      <div className="hidden w-28 shrink-0 flex-col items-center justify-end pb-4 pl-3 md:flex" aria-hidden="true">
        <Mascot state={mascot} size={84} shadow />
      </div>
      {thread}
    </div>
  );
}
