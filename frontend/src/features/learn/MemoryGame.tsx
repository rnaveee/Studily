import { useEffect, useMemo, useRef, useState } from "react";
import { PartyPopper, RotateCcw } from "lucide-react";
import { buildTiles, formatClock, playableCards, splitBoards, tileTextClass } from "./gameRound";
import type { GameCard, Tile } from "./gameRound";
import { shuffled } from "./shuffle";
import RunSummary from "./RunSummary";
import { cardIdOf, useFlashcardRun } from "./useFlashcardRun";
import type { StudyCard } from "../../types";

interface Props {
  setId: number;
  cards: StudyCard[];
  color: string;
  onDone?: () => void;
}

export default function MemoryGame({ setId, cards, color, onDone }: Props) {
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
  const run = useFlashcardRun(setId, "MEMORY", cards);
  const [pass, setPass] = useState({ moves: 0, ms: 0 });
  const replayArmed = useRef(false);
  const runScope = useRef<"deck" | "board">("deck");

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

  function replay() {
    if (boardIndex === boards.length - 1 && !run.isActive()) {
      run.reset();
      setPass({ moves: 0, ms: 0 });
      replayArmed.current = true;
    }
    deal(deck, boardIndex);
  }

  function nextBoard() {
    const nextIndex = boardIndex + 1;
    if (nextIndex >= boards.length) {
      replayArmed.current = false;
      run.reset();
      setPass({ moves: 0, ms: 0 });
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
      const freshPass = boardIndex === 0 && pass.moves === 0;
      if ((freshPass || replayArmed.current) && !run.isActive() && run.status === "idle") {
        runScope.current = freshPass ? "deck" : "board";
        replayArmed.current = false;
        run.start();
      }
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
      if (nextMatched.length === tiles.length / 2) {
        const end = Date.now();
        setFinishedAt(end);
        setPass((p) => ({ moves: p.moves + moves + 1, ms: p.ms + (end - (startedAt ?? end)) }));
        if (boardIndex === boards.length - 1 && run.isActive()) {
          const covered = runScope.current === "deck" ? deck : (boards[boardIndex] ?? []);
          void run.complete(
            covered.flatMap((c) => {
              const cardId = cardIdOf(c.key);
              return cardId == null ? [] : [{ cardId, correct: true }];
            }),
          );
        }
      }
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

  if (finishedAt && boardIndex === boards.length - 1 && (run.status === "completing" || run.status === "done")) {
    return (
      <RunSummary
        mode="MEMORY"
        result={run.result}
        pending={run.status === "completing"}
        headline={boards.length > 1 ? "Every board cleared!" : "Board cleared!"}
        color={color}
        stats={[
          { label: "Time", value: formatClock(pass.ms) },
          { label: "Moves", value: String(pass.moves) },
          ...(boards.length > 1 ? [{ label: "Boards", value: String(boards.length) }] : []),
        ]}
        onAgain={nextBoard}
        againLabel="Play again"
        onDone={onDone}
      />
    );
  }

  return (
    <div className="space-y-3 animate-in">
      <div className="flex items-center justify-between text-[12px] text-fg-3 tabular-nums">
        <span>
          {boards.length > 1 && `Board ${boardIndex + 1} of ${boards.length} · `}
          {formatClock(elapsed)} · {moves} {moves === 1 ? "move" : "moves"}
        </span>
        <button
          onClick={replay}
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
            <button onClick={replay} className="btn btn-soft">
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
