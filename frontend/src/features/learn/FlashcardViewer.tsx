import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, PartyPopper, Pencil, RotateCcw, Shuffle, Target, Undo2, X } from "lucide-react";
import Toggle from "../../components/Toggle";
import { toast } from "../../lib/toast";
import { shuffled } from "./shuffle";
import CardFace from "./CardFace";
import { cardKey } from "./learnEngine";
import { readJson, removeKey, writeJson } from "./studyStorage";
import {
  TRACK_PREF_KEY,
  focusWrong,
  freshTrack,
  markCard,
  reconcileTrack,
  trackCounts,
  trackStorageKey,
  undoMark,
  type TrackState,
} from "./flipTrack";
import type { StudyCard } from "../../types";
import { scopeKey, type StudyScope } from "./studyScope";

interface Props {
  cards: StudyCard[];
  color: string;
  scope: StudyScope;
  viewerKey: string;
  onDelete?: (index: number) => void;
  onEdit?: (index: number) => void;
}

const iconButton =
  "rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-40";

export default function FlashcardViewer({ cards, color, scope, viewerKey, onDelete, onEdit }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [tracking, setTracking] = useState(() => readJson<boolean>(TRACK_PREF_KEY) !== false);

  const keys = useMemo(() => cards.map((c, i) => cardKey(c, i)), [cards]);
  const keySig = keys.join(",");
  const indexByKey = useMemo(() => new Map(keys.map((k, i) => [k, i])), [keys]);
  const storageKey = trackStorageKey(viewerKey, scopeKey(scope));
  const [track, setTrack] = useState<TrackState>(() => reconcileTrack(readJson<TrackState>(storageKey), keys));

  useEffect(() => {
    setOrder(cards.map((_, i) => i));
    setIndex(0);
    setFlipped(false);
  }, [cards.length]);

  useEffect(() => {
    setTrack((t) => reconcileTrack(t, keys));
  }, [keySig]);

  useEffect(() => {
    writeJson(storageKey, track);
  }, [storageKey, track]);

  const count = cards.length;
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const canShuffle = tracking ? track.deck.length - track.pos >= 2 : count >= 2;

  function setTrackingPref(next: boolean) {
    setTracking(next);
    setFlipped(false);
    writeJson(TRACK_PREF_KEY, next);
  }

  function go(delta: number) {
    if (count === 0) return;
    setIndex((safeIndex + delta + count) % count);
    setFlipped(false);
  }

  function shuffle() {
    if (!canShuffle) return;
    if (tracking) {
      setTrack({ ...track, deck: [...track.deck.slice(0, track.pos), ...shuffled(track.deck.slice(track.pos))] });
    } else {
      setOrder(shuffled(order));
      setIndex(0);
    }
    setFlipped(false);
    toast.success("Cards shuffled");
  }

  function mark(known: boolean) {
    setTrack((t) => markCard(t, known));
    setFlipped(false);
  }

  function undo() {
    setTrack((t) => undoMark(t));
    setFlipped(false);
  }

  function restart() {
    removeKey(storageKey);
    setTrack(freshTrack(keys));
    setFlipped(false);
  }

  function focus() {
    setTrack((t) => focusWrong(t));
    setFlipped(false);
  }

  const trackKey = track.deck[track.pos];
  const cardIndex = tracking
    ? trackKey != null
      ? (indexByKey.get(trackKey) ?? -1)
      : -1
    : (order[safeIndex] ?? safeIndex);
  const card = cardIndex >= 0 ? cards[cardIndex] : undefined;
  const { right, wrong } = trackCounts(track);
  const roundDone = tracking && count > 0 && track.pos >= track.deck.length;

  if (count === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-fg-3">
          {onDelete ? "This set is empty. Add your first card below." : "This set has no cards yet."}
        </p>
      </div>
    );
  }

  const trackToggle = (
    <label className="flex shrink-0 items-center gap-2 pl-1 text-[12px] font-medium text-fg-2">
      Track progress
      <Toggle checked={tracking} onChange={setTrackingPref} />
    </label>
  );

  if (roundDone) {
    const allKnown = wrong === 0;
    const knownOverall = count - wrong;
    return (
      <div className="space-y-3" data-tour="flashcard-viewer">
        <div className="flex justify-end">{trackToggle}</div>
        <div className="card p-6 text-center animate-in sm:p-8">
          {allKnown ? (
            <PartyPopper className="mx-auto mb-2" size={28} strokeWidth={1.5} style={{ color }} />
          ) : (
            <Target className="mx-auto mb-2" size={28} strokeWidth={1.5} style={{ color }} />
          )}
          <p className="text-[17px] font-semibold text-fg">
            {allKnown ? `You know all ${count} ${count === 1 ? "card" : "cards"}!` : "Nice work! Keep going."}
          </p>
          <p className="mt-1 text-[12px] text-fg-3">
            {allKnown
              ? track.round > 1
                ? `It took ${track.round} rounds. Restart to go through the whole set again.`
                : "You got every card right the first time."
              : `You know ${knownOverall} of ${count}. Focus on the ones you missed until you get them all.`}
          </p>
          <div className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-2">
            <div className="rounded-lg px-2 py-2.5" style={{ background: "color-mix(in srgb, var(--green) 12%, transparent)" }}>
              <div className="text-[20px] font-semibold tabular-nums" style={{ color: "var(--green)" }}>
                {right}
              </div>
              <div className="text-[11px] text-fg-2">Know</div>
            </div>
            <div className="rounded-lg px-2 py-2.5" style={{ background: "color-mix(in srgb, var(--red) 10%, transparent)" }}>
              <div className="text-[20px] font-semibold tabular-nums" style={{ color: "var(--red)" }}>
                {wrong}
              </div>
              <div className="text-[11px] text-fg-2">Still learning</div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {!allKnown && (
              <button onClick={focus} className="btn btn-primary min-h-[40px]">
                <Target size={13} />
                Focus on {wrong} wrong {wrong === 1 ? "card" : "cards"}
              </button>
            )}
            <button onClick={restart} className={`btn min-h-[40px] ${allKnown ? "btn-primary" : "btn-ghost"}`}>
              <RotateCcw size={13} />
              Restart flashcards
            </button>
          </div>
          <button onClick={undo} className="mt-3 inline-flex items-center gap-1 text-[12px] text-fg-3 hover:text-fg">
            <Undo2 size={12} />
            Back to the last card
          </button>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const sideText = flipped ? card.back : card.front;
  const image = flipped ? card.backImage : card.frontImage;
  const tools = (
    <>
      <button onClick={shuffle} disabled={!canShuffle} className={iconButton} aria-label="Shuffle cards" title="Shuffle">
        <Shuffle size={14} />
      </button>
      {onEdit && (
        <button onClick={() => onEdit(cardIndex)} className={iconButton} aria-label="Edit card" title="Edit card">
          <Pencil size={14} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={() => onDelete(cardIndex)}
          className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
          aria-label="Delete card"
          title="Delete card"
        >
          <X size={14} />
        </button>
      )}
      {trackToggle}
    </>
  );

  return (
    <div className="space-y-3" data-tour="flashcard-viewer">
      <button
        onClick={() => setFlipped((f) => !f)}
        className="card flex min-h-48 w-full items-center justify-center p-8 text-center transition-colors hover:bg-surface-hi"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-3">
            {flipped ? "Back" : "Front"} · tap to flip
          </div>
          {sideText.trim() || image ? (
            <CardFace text={sideText} image={image} zoomable />
          ) : (
            <p className="text-sm text-fg-3">This side needs an image. Tap the pencil below to add it.</p>
          )}
        </div>
      </button>
      {tracking && (
        <div className="flex items-center gap-3">
          <div
            className="flex h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: "var(--surface-hi)" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={track.deck.length}
            aria-valuenow={track.pos}
          >
            <div className="transition-all duration-300" style={{ width: `${(right / track.deck.length) * 100}%`, background: "var(--green)" }} />
            <div className="transition-all duration-300" style={{ width: `${(wrong / track.deck.length) * 100}%`, background: "var(--red)" }} />
          </div>
          {track.round > 1 && (
            <span className="shrink-0 text-[12px] text-fg-3">
              Round {track.round} · {track.deck.length} to review
            </span>
          )}
        </div>
      )}
      {tracking ? (
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => mark(false)}
            className="btn min-h-[44px] gap-1.5 px-4"
            style={{ color: "var(--red)", background: "color-mix(in srgb, var(--red) 10%, transparent)" }}
            aria-label="I got it wrong"
            title="Still learning"
          >
            <X size={18} strokeWidth={2.5} />
            <span className="tabular-nums">{wrong}</span>
          </button>
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-1">
            <span className="px-1 text-[12px] text-fg-3 tabular-nums">
              {track.pos + 1} / {track.deck.length}
            </span>
            <button onClick={undo} disabled={track.pos === 0} className={iconButton} aria-label="Undo" title="Undo">
              <Undo2 size={14} />
            </button>
            {tools}
          </div>
          <button
            onClick={() => mark(true)}
            className="btn min-h-[44px] gap-1.5 px-4"
            style={{ color: "var(--green)", background: "color-mix(in srgb, var(--green) 12%, transparent)" }}
            aria-label="I got it right"
            title="Know"
          >
            <span className="tabular-nums">{right}</span>
            <Check size={18} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <button onClick={() => go(-1)} className="btn btn-ghost" aria-label="Previous card">
            <ChevronLeft size={13} />
            Prev
          </button>
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
            <span className="text-[12px] text-fg-3 tabular-nums">
              {safeIndex + 1} / {count}
            </span>
            {tools}
          </div>
          <button onClick={() => go(1)} className="btn btn-ghost" aria-label="Next card">
            Next
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
