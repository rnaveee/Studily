import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Shuffle, X } from "lucide-react";
import { toast } from "../../lib/toast";
import { shuffled } from "./shuffle";
import type { StudyCard } from "../../types";

interface Props {
  cards: StudyCard[];
  color: string;
  onDelete?: (index: number) => void;
}

export default function FlashcardViewer({ cards, color, onDelete }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));

  useEffect(() => {
    setOrder(cards.map((_, i) => i));
    setIndex(0);
    setFlipped(false);
  }, [cards.length]);

  const count = cards.length;
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const cardIndex = order[safeIndex] ?? safeIndex;
  const card = cards[cardIndex];

  function go(delta: number) {
    if (count === 0) return;
    setIndex((safeIndex + delta + count) % count);
    setFlipped(false);
  }

  function shuffle() {
    if (count < 2) return;
    setOrder(shuffled(order));
    setIndex(0);
    setFlipped(false);
    toast.success("Cards shuffled");
  }

  if (!card) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-fg-3">
          {onDelete ? "This set is empty. Add your first card below." : "This set has no cards yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setFlipped((f) => !f)}
        className="card flex min-h-48 w-full items-center justify-center p-8 text-center transition-colors hover:bg-surface-hi"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-3">
            {flipped ? "Back" : "Front"} · tap to flip
          </div>
          <div className="text-lg text-fg whitespace-pre-wrap break-words">{flipped ? card.back : card.front}</div>
        </div>
      </button>
      <div className="flex items-center justify-between">
        <button onClick={() => go(-1)} className="btn btn-ghost" aria-label="Previous card">
          <ChevronLeft size={13} />
          Prev
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-fg-3 tabular-nums">
            {safeIndex + 1} / {count}
          </span>
          <button
            onClick={shuffle}
            disabled={count < 2}
            className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-40"
            aria-label="Shuffle cards"
          >
            <Shuffle size={14} />
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(cardIndex)}
              className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
              aria-label="Delete card"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={() => go(1)} className="btn btn-ghost" aria-label="Next card">
          Next
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
