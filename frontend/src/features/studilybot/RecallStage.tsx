import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTyped } from "../../lib/motion";
import { parseReport, type FeynmanMessage, type FeynmanReport, type FeynmanSlide } from "../feynman/feynmanApi";
import { SlideFigure } from "./CitationChip";
import { Dots, Markdownish } from "./ChatThread";
import Mascot, { type MascotState } from "./Mascot";
import ReportCard from "./ReportCard";

const REPORT_LINE = "That's everything! Here's how you did. Your report is below.";

export interface RecallLine {
  text: string;
  slide: FeynmanSlide | null;
}

export interface RecallQueue {
  lines: RecallLine[];
  step: number;
  atEnd: boolean;
  next: () => void;
  report: FeynmanReport | null;
  lastStudent: string | null;
}

export function useRecallQueue(messages: FeynmanMessage[]): RecallQueue {
  const { lines, ids, report, lastStudent } = useMemo(() => {
    let i = messages.length - 1;
    const turn: FeynmanMessage[] = [];
    while (i >= 0 && messages[i].role === "BOT") {
      turn.unshift(messages[i]);
      i -= 1;
    }
    const student = i >= 0 ? messages[i].body : null;
    if (turn.length === 0) {
      const lastBot = [...messages].reverse().find((m) => m.role === "BOT" && m.kind === "CHAT");
      if (lastBot) turn.push(lastBot);
    }
    const reportMessage = turn.find((m) => m.kind === "REPORT");
    const chat = turn
      .filter((m) => m.kind === "CHAT")
      .map((m) => ({ text: m.body, slide: m.slide ?? null }));
    return {
      lines: reportMessage ? [...chat, { text: REPORT_LINE, slide: null }] : chat,
      ids: turn.map((m) => m.id).join(","),
      report: reportMessage ? parseReport(reportMessage.body) : null,
      lastStudent: student,
    };
  }, [messages]);
  const last = Math.max(0, lines.length - 1);
  const [position, setPosition] = useState(() => ({ ids, step: report ? last : 0 }));
  const step = position.ids === ids ? position.step : 0;
  return {
    lines,
    step,
    atEnd: step >= last,
    next: () => setPosition({ ids, step: Math.min(step + 1, last) }),
    report,
    lastStudent,
  };
}

export default function RecallStage({
  queue,
  busy,
  busyLabel,
  pending,
  reaction,
}: {
  queue: RecallQueue;
  busy: boolean;
  busyLabel: string;
  pending: string | null;
  reaction: MascotState | null;
}) {
  const current = queue.lines[queue.step];
  const line = current?.text ?? "";
  const slide = current?.slide ?? null;
  const typed = useTyped(busy ? "" : line, 18);
  const finished = queue.report !== null && queue.atEnd;
  const mood: MascotState = busy
    ? "thinking"
    : !typed.done
      ? "explaining"
      : (reaction ?? (finished ? "excited" : "idle"));
  const you = pending ?? queue.lastStudent;
  const canNext = !busy && queue.step < queue.lines.length - 1;

  function advance() {
    if (!typed.done) typed.skip();
    else if (canNext) queue.next();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain px-4 py-6 md:py-10">
      <div className={`my-auto flex w-full flex-col items-center gap-4 ${slide ? "max-w-3xl" : "max-w-xl"}`}>
        <p className="sr-only" aria-live="polite">
          {busy ? busyLabel : line}
        </p>
        {(busy || line) && (
          <div
            data-tail="down-center"
            aria-hidden="true"
            onClick={advance}
            className={`tour-bubble w-full max-w-xl rounded-3xl px-5 py-4 text-[15px] leading-relaxed text-fg ${
              !busy && (canNext || !typed.done) ? "cursor-pointer" : ""
            }`}
          >
            {busy ? (
              <span className="flex items-center gap-3 py-1 text-[13px] text-fg-3">
                <Dots />
                {busyLabel}…
              </span>
            ) : (
              <div className="min-h-[1.6em]">
                <Markdownish text={typed.shown} />
              </div>
            )}
            {!busy && queue.lines.length > 1 && (
              <div className="mt-3 flex items-center gap-3">
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  {queue.lines.map((_, i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: i <= queue.step ? "var(--accent)" : "var(--line)" }}
                    />
                  ))}
                </span>
              </div>
            )}
          </div>
        )}
        <div className="flex w-full flex-col items-center gap-4 md:flex-row md:items-end md:justify-center md:gap-8">
          {slide && (
            <SlideFigure
              key={`${slide.fileId}-${slide.page}`}
              source={{ fileId: slide.fileId, fileName: slide.fileName, page: slide.page, previewable: true }}
              className="w-full max-w-xs md:order-last md:w-80 md:max-w-none"
            />
          )}
          <span aria-hidden="true" className="md:hidden">
            <Mascot state={mood} size={slide ? 112 : 140} shadow />
          </span>
          <span aria-hidden="true" className="hidden md:inline">
            <Mascot state={mood} size={slide ? 168 : 200} shadow />
          </span>
        </div>
        {canNext && (
          <button type="button" onClick={() => (typed.done ? queue.next() : typed.skip())} className="btn btn-soft">
            {typed.done ? "Next" : "Skip"}
            <ChevronRight size={14} />
          </button>
        )}
        {you && (
          <p className="line-clamp-2 max-w-md text-center text-[12.5px] leading-relaxed text-fg-3">
            <span className="font-medium text-fg-2">You:</span> {you}
          </p>
        )}
      </div>
      {finished && queue.report && (
        <div className="mt-8 w-full max-w-2xl">
          <ReportCard report={queue.report} />
        </div>
      )}
    </div>
  );
}
