import { useState, type ReactNode } from "react";
import { Check, Info, RotateCcw, Sparkles, Trophy, X } from "lucide-react";
import { Skeleton } from "../../components/Skeleton";
import type { FlashcardRunMode, FlashcardRunResult, XpReason } from "../../types";

const LIST_PREVIEW = 8;

function reasonText(result: FlashcardRunResult): string | null {
  const reason: XpReason = result.xpReason;
  switch (reason) {
    case "REDUCED":
      return "You've already had one run of this set earn XP today, so this one earned half XP.";
    case "REPEAT":
      return "Two runs of this set have already earned XP today. Try another set, or come back tomorrow for full XP.";
    case "DAILY_CAP":
      return result.xpAwarded > 0
        ? "You reached today's 300 XP limit for flashcards, so this run earned part of its XP."
        : "You've hit today's 300 XP limit for flashcards. It resets tomorrow.";
    case "TOO_FAST":
      return `That was too quick to count for XP. Runs need at least ${
        result.mode === "MATCH" ? "1 second" : "2 seconds"
      } per card.`;
    case "TOO_FEW":
      return "Runs need at least 5 cards to earn XP.";
    default:
      return null;
  }
}

export default function RunSummary({
  mode,
  result,
  pending,
  headline,
  children,
  stats,
  onAgain,
  againLabel = "Study again",
  onDone,
  doneLabel = "Done",
  color,
}: {
  mode: FlashcardRunMode;
  result: FlashcardRunResult | null;
  pending: boolean;
  headline: string;
  children?: ReactNode;
  stats?: { label: string; value: string }[];
  onAgain?: () => void;
  againLabel?: string;
  onDone?: () => void;
  doneLabel?: string;
  color: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const graded = mode === "REVIEW" || mode === "LEARN";
  const reason = result ? reasonText(result) : null;
  const bonus =
    result &&
    graded &&
    result.xpReason === "FULL" &&
    result.cardCount > 0 &&
    result.correctCount / result.cardCount >= 0.8;
  const cards = result ? [...result.cards].sort((a, b) => Number(a.correct) - Number(b.correct)) : [];
  const shown = showAll ? cards : cards.slice(0, LIST_PREVIEW);
  const pct = result && result.cardCount > 0 ? result.correctCount / result.cardCount : 0;

  return (
    <div className="space-y-3 animate-in">
      <div className="card p-6 text-center sm:p-8">
        <Trophy className="mx-auto mb-2" size={28} strokeWidth={1.5} style={{ color }} />
        <p className="text-[17px] font-semibold text-fg">{headline}</p>
        {children}

        <div
          className="mx-auto mt-5 max-w-sm rounded-xl px-4 py-3.5"
          style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
        >
          {pending || !result ? (
            <div className="flex flex-col items-center gap-2" aria-label="Tallying your XP">
              <Skeleton width={110} height={26} />
              <Skeleton width={150} height={10} />
            </div>
          ) : (
            <>
              <div
                className={`flex items-center justify-center gap-2 text-[26px] font-bold leading-none tabular-nums ${
                  result.xpAwarded > 0 ? "text-accent" : "text-fg-3"
                }`}
              >
                <Sparkles size={20} />
                {result.xpAwarded > 0 ? `+${result.xpAwarded} XP` : "No XP this time"}
              </div>
              {bonus && (
                <p className="mt-1.5 text-[12px] text-fg-2">Includes +20 for getting 80% or more right.</p>
              )}
              {reason && (
                <p className="mt-2 flex items-start justify-center gap-1.5 text-left text-[12px] leading-snug text-fg-2">
                  <Info size={13} className="mt-px shrink-0 text-fg-3" />
                  <span>{reason}</span>
                </p>
              )}
            </>
          )}
        </div>

        {graded && result && result.cardCount > 0 && (
          <div className="mx-auto mt-4 max-w-sm">
            <div className="flex items-baseline justify-between text-[12px] text-fg-3 tabular-nums">
              <span>
                <span className="text-[15px] font-semibold text-fg">{result.correctCount}</span> / {result.cardCount} right
              </span>
              <span>{Math.round(pct * 100)}%</span>
            </div>
            <div className="mt-1.5 flex h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--red) 22%, var(--surface-hi))" }}>
              <div className="xp-fill rounded-full" style={{ width: `${pct * 100}%`, background: "var(--green)" }} />
            </div>
          </div>
        )}

        {stats && stats.length > 0 && (
          <div
            className="mx-auto mt-4 grid max-w-sm gap-2"
            style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
          >
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg bg-surface-hi px-2 py-2.5">
                <div className="text-[17px] font-semibold tabular-nums text-fg">{s.value}</div>
                <div className="text-[11px] text-fg-3">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {onAgain && (
            <button onClick={onAgain} className="btn btn-primary min-h-[40px]">
              <RotateCcw size={13} />
              {againLabel}
            </button>
          )}
          {onDone && (
            <button onClick={onDone} className={`btn min-h-[40px] ${onAgain ? "btn-ghost" : "btn-primary"}`}>
              {doneLabel}
            </button>
          )}
        </div>
      </div>

      {graded && cards.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
            <h3 className="text-[13px] font-semibold text-fg">This run</h3>
            <span className="text-[11.5px] text-fg-3">Misses first</span>
          </div>
          <ul className="divide-y divide-line px-4">
            {shown.map((c) => (
              <li key={c.cardId} className="flex items-start gap-3 py-2.5">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `color-mix(in srgb, ${c.correct ? "var(--green)" : "var(--red)"} 14%, transparent)`,
                    color: c.correct ? "var(--green)" : "var(--red)",
                  }}
                  aria-label={c.correct ? "Right" : "Wrong"}
                >
                  {c.correct ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="whitespace-pre-wrap break-words text-[13px] font-medium text-fg">{c.front}</div>
                  <div className="mt-0.5 whitespace-pre-wrap break-words text-[12px] text-fg-3">{c.back}</div>
                </div>
              </li>
            ))}
          </ul>
          {cards.length > LIST_PREVIEW && (
            <div className="border-t border-line px-2 py-1">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="min-h-[40px] w-full rounded-lg text-[12.5px] font-medium text-accent transition-colors hover:bg-surface-hi"
              >
                {showAll ? "Show less" : `Show all ${cards.length}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
