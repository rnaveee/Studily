import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Trophy, Zap } from "lucide-react";
import { buildTiles, playableCards, ROUND_SIZE, tileTextClass } from "./gameRound";
import type { GameCard, Tile } from "./gameRound";
import { shuffled } from "./shuffle";
import { readJson, writeJson } from "./studyStorage";
import RunSummary from "./RunSummary";
import { cardIdOf, useFlashcardRun } from "./useFlashcardRun";
import type { StudyCard } from "../../types";

interface Props {
  setId: number;
  cards: StudyCard[];
  color: string;
  viewerKey: string;
  onDone?: () => void;
}

function deal(playable: GameCard[]): Tile[] {
  return buildTiles(shuffled(playable).slice(0, ROUND_SIZE));
}

function seconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

export default function SpeedMatch({ setId, cards, color, viewerKey, onDone }: Props) {
  const playable = useMemo(() => playableCards(cards), [cards]);
  const bestKey = `studily.match.best.${viewerKey}.${setId}`;
  const [tiles, setTiles] = useState<Tile[]>(() => deal(playable));
  const [selected, setSelected] = useState<string | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [penalty, setPenalty] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [best, setBest] = useState<number | null>(() => readJson<number>(bestKey));
  const [newBest, setNewBest] = useState(false);
  const wrongTimer = useRef<number | undefined>(undefined);
  const run = useFlashcardRun(setId, "MATCH", cards);

  useEffect(() => () => window.clearTimeout(wrongTimer.current), []);

  useEffect(() => {
    if (!startedAt || finishedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [startedAt, finishedAt]);

  function reset() {
    window.clearTimeout(wrongTimer.current);
    setTiles(deal(playable));
    setSelected(null);
    setGone([]);
    setWrong([]);
    setPenalty(0);
    setStartedAt(null);
    setFinishedAt(null);
    setNewBest(false);
    run.reset();
  }

  function start() {
    const at = Date.now();
    setStartedAt(at);
    setNow(at);
    run.start();
  }

  function finish(start: number) {
    const end = Date.now();
    setFinishedAt(end);
    const total = end - start + penalty;
    if (best == null || total < best) {
      setBest(total);
      setNewBest(true);
      writeJson(bestKey, total);
    }
    if (run.isActive()) {
      void run.complete(
        [...new Set(tiles.map((t) => t.pair))].flatMap((pair) => {
          const cardId = cardIdOf(pair);
          return cardId == null ? [] : [{ cardId, correct: true }];
        }),
      );
    }
  }

  function tap(tile: Tile) {
    if (!startedAt || finishedAt || gone.includes(tile.pair)) return;
    if (!selected) {
      setSelected(tile.id);
      return;
    }
    if (selected === tile.id) {
      setSelected(null);
      return;
    }
    const first = tiles.find((t) => t.id === selected);
    if (!first || first.side === tile.side) {
      setSelected(tile.id);
      return;
    }
    setSelected(null);
    if (first.pair === tile.pair) {
      const nextGone = [...gone, tile.pair];
      setGone(nextGone);
      if (nextGone.length === tiles.length / 2) finish(startedAt);
      return;
    }
    setPenalty((p) => p + 1000);
    setWrong([first.id, tile.id]);
    window.clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(() => setWrong([]), 450);
  }

  if (playable.length < 2) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-fg-3">Add at least 2 cards with different fronts and backs to play Match.</p>
      </div>
    );
  }

  const elapsed = startedAt ? (finishedAt ?? now) - startedAt + penalty : 0;

  if (finishedAt && (run.status === "completing" || run.status === "done")) {
    return (
      <RunSummary
        mode="MATCH"
        result={run.result}
        pending={run.status === "completing"}
        headline={`${seconds(elapsed)}s`}
        color={color}
        stats={[
          { label: "Pairs", value: String(tiles.length / 2) },
          { label: "Penalty", value: `+${penalty / 1000}s` },
          { label: "Best", value: best != null ? `${seconds(best)}s` : "—" },
        ]}
        onAgain={reset}
        againLabel="Play again"
        onDone={onDone}
      >
        {newBest && (
          <p className="mt-2">
            <span className="badge badge-green">New best!</span>
          </p>
        )}
      </RunSummary>
    );
  }

  if (finishedAt) {
    return (
      <div className="card p-10 text-center animate-in">
        <Trophy className="mx-auto mb-2" size={28} strokeWidth={1.5} style={{ color }} />
        <p className="text-3xl font-semibold text-fg tabular-nums">{seconds(elapsed)}s</p>
        {penalty > 0 && (
          <p className="mt-1 text-[12px] text-fg-3">
            Includes +{penalty / 1000}s for wrong pairs
          </p>
        )}
        <p className="mt-2 text-[13px] text-fg-2">
          {newBest ? (
            <span className="badge badge-green">New best!</span>
          ) : (
            best != null && <>Your best: {seconds(best)}s</>
          )}
        </p>
        <button onClick={reset} className="btn btn-primary mt-4 inline-flex">
          Play again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in">
      <div className="flex items-center justify-between text-[12px] text-fg-3 tabular-nums">
        <span>
          <span className="text-[15px] font-semibold text-fg">{seconds(elapsed)}s</span>
          {best != null && <span className="ml-2">Best {seconds(best)}s</span>}
        </span>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-surface-hi hover:text-fg"
        >
          <RotateCcw size={11} />
          New round
        </button>
      </div>
      <p className="text-[12px] text-fg-3">
        {startedAt
          ? "Tap a term, then its definition. Wrong pairs add a second."
          : "Match every term with its definition as fast as you can. The clock starts when you press Start."}
      </p>
      <div className="relative">
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          aria-hidden={!startedAt}
          style={
            startedAt
              ? undefined
              : { filter: "blur(7px)", pointerEvents: "none", userSelect: "none" }
          }
        >
          {tiles.map((t) => {
            const isGone = gone.includes(t.pair);
            const isSelected = selected === t.id;
            const isWrong = wrong.includes(t.id);
            const tone = isWrong ? "var(--red)" : isSelected ? color : null;
            return (
              <button
                key={t.id}
                onClick={() => tap(t)}
                disabled={isGone}
                aria-pressed={isSelected}
                className={`card press flex min-h-20 flex-col p-2.5 text-left transition-colors hover:bg-surface-hi ${
                  isGone ? "match-gone" : ""
                } ${isWrong ? "calc-shake" : ""}`}
                style={
                  tone
                    ? { borderColor: tone, background: `color-mix(in srgb, ${tone} 12%, var(--surface))` }
                    : undefined
                }
              >
                <span className="text-[9px] font-semibold uppercase tracking-wider text-fg-3">
                  {t.side === "term" ? "Term" : "Definition"}
                </span>
                <span className={`mt-1 leading-snug text-fg whitespace-pre-wrap break-words ${tileTextClass(t.text)}`}>
                  {t.text}
                </span>
              </button>
            );
          })}
        </div>
        {!startedAt && (
          <div className="absolute inset-0 flex items-start justify-center pt-12">
            <button onClick={start} className="btn btn-primary btn-lg">
              <Zap size={15} />
              Start match
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
