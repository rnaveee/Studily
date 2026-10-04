import { useEffect, useMemo, useRef, useState } from "react";
import { PartyPopper, RotateCcw } from "lucide-react";
import { buildTiles, formatClock, playableCards, splitBoards, tileTextClass } from "./gameRound";
import type { GameCard, Tile } from "./gameRound";
import { shuffled } from "./shuffle";
import type { StudyCard } from "../../types";

interface Props {
  cards: StudyCard[];
  color: string;
}

export default function MemoryGame({ cards, color }: Props) {
  const playable = useMemo(() => playableCards(cards), [cards]);
  const [deck, setDeck] = useState<GameCard[]>(() => shuffled(playable));
  const boards = useMemo(() => splitBoards(deck), [deck]);
  const [boardIndex, setBoardIndex] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>(() => buildTiles(splitBoards(deck)[0] ?? []));
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!startedAt || finishedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [startedAt, finishedAt]);

  function deal(nextDeck: GameCard[], index: number) {
    window.clearTimeout(timer.current);
    setTiles(buildTiles(splitBoards(nextDeck)[index] ?? []));
    setOpen([]);
    setMatched([]);
    setMoves(0);
    setBusy(false);
    setStartedAt(null);
    setFinishedAt(null);
  }

  function nextBoard() {
    const nextIndex = boardIndex + 1;
    if (nextIndex >= boards.length) {
      const fresh = shuffled(playable);
      setDeck(fresh);
      setBoardIndex(0);
      deal(fresh, 0);
    } else {
      setBoardIndex(nextIndex);
      deal(deck, nextIndex);
    }
  }

  function flip(tile: Tile) {
    if (busy || finishedAt || matched.includes(tile.pair) || open.includes(tile.id)) return;
    if (!startedAt) {
      setStartedAt(Date.now());
      setNow(Date.now());
    }
    const nextOpen = [...open, tile.id];
    if (nextOpen.length < 2) {
      setOpen(nextOpen);
      return;
    }
    setMoves((m) => m + 1);
    const [a, b] = nextOpen.map((id) => tiles.find((t) => t.id === id)!);
    if (a.pair === b.pair) {
      const nextMatched = [...matched, a.pair];
      setMatched(nextMatched);
      setOpen([]);
      if (nextMatched.length === tiles.length / 2) setFinishedAt(Date.now());
      return;
    }
    setOpen(nextOpen);
    setBusy(true);
    timer.current = window.setTimeout(() => {
      setOpen([]);
      setBusy(false);
    }, 900);
  }

  if (playable.length < 2) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-fg-3">Add at least 2 cards with different fronts and backs to play Memory.</p>
      </div>
    );
  }

  const elapsed = startedAt ? (finishedAt ?? now) - startedAt : 0;

  return (
    <div className="space-y-3 animate-in">
      <div className="flex items-center justify-between text-[12px] text-fg-3 tabular-nums">
        <span>
          {boards.length > 1 && `Board ${boardIndex + 1} of ${boards.length} · `}
          {formatClock(elapsed)} · {moves} {moves === 1 ? "move" : "moves"}
        </span>
        <button
          onClick={() => deal(deck, boardIndex)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-surface-hi hover:text-fg"
        >
          <RotateCcw size={11} />
          Restart
        </button>
      </div>

      {finishedAt ? (
        <div className="card p-10 text-center animate-in">
          <PartyPopper className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
          <p className="text-sm font-medium text-fg">
            Cleared in {formatClock(elapsed)} · {moves} moves
          </p>
          <p className="mt-1 text-[12px] text-fg-3">
            {moves === tiles.length / 2 ? "A perfect board!" : "Fewer moves means a sharper memory."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {boards.length > 1 && (
              <button onClick={nextBoard} className="btn btn-primary">
                Next board
              </button>
            )}
            <button onClick={() => deal(deck, boardIndex)} className="btn btn-soft">
              Play again
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[12px] text-fg-3">Flip two cards at a time and match each term with its definition.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" style={{ gridAutoRows: "1fr" }}>
            {tiles.map((t) => {
              const isMatched = matched.includes(t.pair);
              const faceUp = isMatched || open.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => flip(t)}
                  className="flip-tile min-h-24 text-left"
                  aria-label={faceUp ? t.text : "Hidden card"}
                >
                  <div className={`flip-inner ${faceUp ? "is-flipped" : ""}`}>
                    <div
                      className="flip-face card flex items-center justify-center"
                      style={{
                        background: `color-mix(in srgb, ${color} 16%, var(--surface))`,
                        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
                      }}
                    >
                      <img src="/studily-3a.svg" alt="" className="h-9 w-9" draggable={false} />
                    </div>
                    <div
                      className="flip-face flip-face-back card flex flex-col p-2.5"
                      style={
                        isMatched
                          ? {
                              borderColor: "var(--green)",
                              background: "color-mix(in srgb, var(--green) 10%, var(--surface))",
                            }
                          : undefined
                      }
                    >
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-fg-3">
                        {t.side === "term" ? "Term" : "Definition"}
                      </span>
                      <span className={`mt-1 leading-snug text-fg whitespace-pre-wrap break-words ${tileTextClass(t.text)}`}>
                        {t.text}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
