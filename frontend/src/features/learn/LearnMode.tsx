import { useEffect, useMemo, useRef, useState } from "react";
import { Check, LayoutGrid, PartyPopper, RotateCcw, X, Zap } from "lucide-react";
import {
  buildQuestion,
  gradeWritten,
  learnCards,
  levelCounts,
  nextLevel,
  pickRound,
  restoreProgress,
  storageKey,
} from "./learnEngine";
import type { LearnProgress, Question, Verdict } from "./learnEngine";
import { readJson, removeKey, writeJson } from "./studyStorage";
import type { StudyMode } from "./SetModePicker";
import RunSummary from "./RunSummary";
import { cardIdOf, useFlashcardRun } from "./useFlashcardRun";
import type { StudyCard } from "../../types";

interface Props {
  setId: number;
  cards: StudyCard[];
  color: string;
  viewerKey: string;
  onSwitchMode: (mode: StudyMode) => void;
}

interface Feedback {
  correct: boolean;
  verdict?: Verdict;
  picked?: string | boolean;
  typed?: string;
  auto: boolean;
}

type Phase = "asking" | "checkpoint" | "done";

const AMBER = "#c78a2d";

export default function LearnMode({ setId, cards, color, viewerKey, onSwitchMode }: Props) {
  const deck = useMemo(() => learnCards(cards), [cards]);
  const key = storageKey(viewerKey, setId);
  const [progress, setProgress] = useState<LearnProgress>(() =>
    restoreProgress(readJson<LearnProgress>(key), deck),
  );
  const [queue, setQueue] = useState<string[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [phase, setPhase] = useState<Phase>("asking");
  const [finishedRound, setFinishedRound] = useState(0);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const lastAsked = useRef<Record<string, number>>({});
  const askCounter = useRef(0);
  const run = useFlashcardRun(setId, "LEARN", cards);
  const answers = useRef(new Map<string, boolean>());
  const runStarted = useRef(false);

  const byKey = useMemo(() => new Map(deck.map((c) => [c.key, c])), [deck]);
  const counts = levelCounts(deck, progress.levels);

  function ask(nextKey: string, levels: LearnProgress["levels"]) {
    const card = byKey.get(nextKey);
    if (!card) return;
    setQuestion(buildQuestion(card, levels[nextKey] ?? 0, deck));
    setFeedback(null);
    setTyped("");
    setRevealed(false);
  }

  function startRound(p: LearnProgress) {
    if (deck.every((c) => p.levels[c.key] === 2)) {
      setPhase("done");
      setQuestion(null);
      return;
    }
    const keys = pickRound(deck, p.levels, lastAsked.current);
    setQueue(keys);
    setPhase("asking");
    ask(keys[0], p.levels);
  }

  useEffect(() => {
    if (deck.length >= 2) startRound(progress);
  }, []);

  useEffect(() => {
    if (runStarted.current || !run.eligible || deck.length < 2) return;
    if (deck.every((c) => progress.levels[c.key] === 2)) return;
    runStarted.current = true;
    answers.current.clear();
    run.start();
  }, [run.eligible]);

  useEffect(() => {
    if (phase !== "done" || !run.isActive()) return;
    const results = [...answers.current].flatMap(([key, correct]) => {
      const cardId = cardIdOf(key);
      return cardId == null ? [] : [{ cardId, correct }];
    });
    void run.complete(results);
  }, [phase]);

  function save(p: LearnProgress) {
    setProgress(p);
    writeJson(key, p);
  }

  function advance(correct: boolean) {
    if (!question) return;
    const cardKey = question.card.key;
    const level = progress.levels[cardKey] ?? 0;
    const levels = { ...progress.levels, [cardKey]: nextLevel(level, correct) };
    answers.current.set(cardKey, correct && answers.current.get(cardKey) !== false);
    lastAsked.current[cardKey] = askCounter.current++;
    let rest = queue.slice(1);
    if (!correct) rest = [...rest, cardKey];

    if (rest.length > 0) {
      save({ levels, round: progress.round });
      setQueue(rest);
      ask(rest[0], levels);
      return;
    }

    const next = { levels, round: progress.round + 1 };
    save(next);
    setQueue([]);
    setQuestion(null);
    setFeedback(null);
    setFinishedRound(progress.round);
    setPhase(deck.every((c) => levels[c.key] === 2) ? "done" : "checkpoint");
  }

  function restart() {
    removeKey(key);
    lastAsked.current = {};
    answers.current.clear();
    run.reset();
    runStarted.current = true;
    run.start();
    const fresh = restoreProgress(null, deck);
    setProgress(fresh);
    startRound(fresh);
  }

  function pickChoice(option: string) {
    if (!question || question.kind !== "choice" || feedback) return;
    const correct = option === question.answer;
    setFeedback({ correct, picked: option, auto: correct });
  }

  function pickTrueFalse(value: boolean) {
    if (!question || question.kind !== "truefalse" || feedback) return;
    const correct = value === question.isTrue;
    setFeedback({ correct, picked: value, auto: correct });
  }

  function submitWritten(e?: React.FormEvent) {
    e?.preventDefault();
    if (!question || question.kind !== "written" || feedback) return;
    const verdict = gradeWritten(typed, question.answer);
    setFeedback({ correct: verdict !== "wrong", verdict, typed, auto: verdict === "correct" });
  }

  function dontKnow() {
    if (!question || feedback) return;
    setFeedback({ correct: false, verdict: "wrong", typed: "", auto: false });
  }

  useEffect(() => {
    if (!feedback?.auto) return;
    const t = setTimeout(() => advance(feedback.correct), 900);
    return () => clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Enter" && (tag === "BUTTON" || tag === "A")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase === "checkpoint" && e.key === "Enter") {
        e.preventDefault();
        startRound(progress);
        return;
      }
      if (!question) return;
      if (feedback) {
        if (e.key === "Enter") {
          e.preventDefault();
          advance(feedback.correct);
        }
        return;
      }
      if (question.kind === "choice") {
        const n = Number(e.key);
        if (n >= 1 && n <= question.options.length) pickChoice(question.options[n - 1]);
      } else if (question.kind === "truefalse") {
        const k = e.key.toLowerCase();
        if (k === "t" || k === "1") pickTrueFalse(true);
        if (k === "f" || k === "2") pickTrueFalse(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (deck.length < 2) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-fg-3">Add at least 2 cards to use Learn.</p>
      </div>
    );
  }

  const total = deck.length;
  const bar = (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-hi)" }}>
        <div style={{ width: `${(counts.mastered / total) * 100}%`, background: "var(--green)" }} />
        <div style={{ width: `${(counts.familiar / total) * 100}%`, background: AMBER }} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-fg-3 tabular-nums">
        <span>
          {counts.learning} learning · {counts.familiar} familiar · {counts.mastered} mastered
        </span>
        <button onClick={restart} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-surface-hi hover:text-fg">
          <RotateCcw size={11} />
          Restart
        </button>
      </div>
    </div>
  );

  if (phase === "done" && (run.status === "completing" || run.status === "done")) {
    return (
      <div className="space-y-3 animate-in">
        {bar}
        <RunSummary
          mode="LEARN"
          result={run.result}
          pending={run.status === "completing"}
          headline={`You've mastered all ${total} cards!`}
          color={color}
          onAgain={restart}
          onDone={() => onSwitchMode("flashcards")}
        />
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-3 animate-in">
        {bar}
        <div className="card p-10 text-center">
          <PartyPopper className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
          <p className="text-sm font-medium text-fg">You've mastered all {total} cards!</p>
          <p className="mt-1 text-[12px] text-fg-3">Keep it fresh with a game, or run Learn again from the start.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button onClick={restart} className="btn btn-soft">
              <RotateCcw size={13} />
              Study again
            </button>
            <button onClick={() => onSwitchMode("memory")} className="btn btn-ghost">
              <LayoutGrid size={13} />
              Memory
            </button>
            <button onClick={() => onSwitchMode("match")} className="btn btn-ghost">
              <Zap size={13} />
              Match
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "checkpoint") {
    return (
      <div className="space-y-3 animate-in">
        {bar}
        <div className="card p-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">Round {finishedRound} done</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Learning" value={counts.learning} color="var(--fg-3)" />
            <Stat label="Familiar" value={counts.familiar} color={AMBER} />
            <Stat label="Mastered" value={counts.mastered} color="var(--green)" />
          </div>
          <p className="mt-4 text-[12px] text-fg-3">
            {counts.familiar > 0
              ? "Next round asks you to recall the familiar cards from memory."
              : "Keep going. The questions get harder as you learn each card."}
          </p>
          <button onClick={() => startRound(progress)} className="btn btn-primary mt-4 inline-flex">
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="space-y-3 animate-in">
      {bar}
      <div className="card space-y-4 p-5" style={{ borderLeft: `4px solid ${color}` }}>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">
          {question.kind === "choice" && "Pick the matching answer"}
          {question.kind === "truefalse" && "True or false?"}
          {question.kind === "written" && "Type the answer"}
          {question.kind === "recall" && "Say the answer, then check"}
        </div>
        <div className="text-lg text-fg whitespace-pre-wrap break-words">{question.prompt}</div>

        {question.kind === "choice" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {question.options.map((option, i) => {
              const isAnswer = option === question.answer;
              const isPicked = feedback?.picked === option;
              const tone = feedback ? (isAnswer ? "var(--green)" : isPicked ? "var(--red)" : null) : null;
              return (
                <button
                  key={option}
                  onClick={() => pickChoice(option)}
                  disabled={!!feedback}
                  className="card press flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-hi"
                  style={
                    tone
                      ? { borderColor: tone, background: `color-mix(in srgb, ${tone} 10%, var(--surface))` }
                      : undefined
                  }
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface-hi text-[11px] font-semibold text-fg-3">
                    {i + 1}
                  </span>
                  <span className="text-[14px] text-fg whitespace-pre-wrap break-words">{option}</span>
                </button>
              );
            })}
          </div>
        )}

        {question.kind === "truefalse" && (
          <>
            <div className="rounded-lg bg-surface-hi px-3 py-2.5 text-[14px] text-fg whitespace-pre-wrap break-words">
              {question.statement}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map((value) => {
                const isAnswer = value === question.isTrue;
                const isPicked = feedback?.picked === value;
                const tone = feedback ? (isAnswer ? "var(--green)" : isPicked ? "var(--red)" : null) : null;
                return (
                  <button
                    key={String(value)}
                    onClick={() => pickTrueFalse(value)}
                    disabled={!!feedback}
                    className="card press px-3 py-2.5 text-[14px] font-medium text-fg transition-colors hover:bg-surface-hi"
                    style={
                      tone
                        ? { borderColor: tone, background: `color-mix(in srgb, ${tone} 10%, var(--surface))` }
                        : undefined
                    }
                  >
                    {value ? "True" : "False"}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {question.kind === "written" && (
          <form onSubmit={submitWritten} className="space-y-2">
            <input
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Your answer"
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={!!feedback}
            />
            {!feedback && (
              <div className="flex justify-end gap-2">
                <button type="button" onClick={dontKnow} className="btn btn-ghost">
                  Don't know
                </button>
                <button type="submit" disabled={!typed.trim()} className="btn btn-primary">
                  Check
                </button>
              </div>
            )}
          </form>
        )}

        {question.kind === "recall" && (
          revealed ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-surface-hi px-3 py-2.5 text-[14px] text-fg whitespace-pre-wrap break-words">
                {question.answer}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => advance(false)} className="btn btn-ghost justify-center">
                  <X size={13} />
                  I didn't
                </button>
                <button onClick={() => advance(true)} className="btn btn-primary justify-center">
                  <Check size={13} />
                  I got it
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button onClick={() => setRevealed(true)} className="btn btn-primary">
                Show answer
              </button>
            </div>
          )
        )}

        {feedback && <FeedbackPanel question={question} feedback={feedback} onContinue={advance} onOverride={() => advance(true)} />}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-surface-hi px-2 py-3">
      <div className="text-xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-fg-3">{label}</div>
    </div>
  );
}

function FeedbackPanel({
  question,
  feedback,
  onContinue,
  onOverride,
}: {
  question: Question;
  feedback: Feedback;
  onContinue: (correct: boolean) => void;
  onOverride: () => void;
}) {
  const tone = feedback.correct ? "var(--green)" : "var(--red)";
  const heading = feedback.correct
    ? feedback.verdict === "close"
      ? "Close enough"
      : "Correct!"
    : "Not quite";

  return (
    <div
      className="space-y-2 rounded-lg px-3 py-2.5 animate-fade"
      style={{ background: `color-mix(in srgb, ${tone} 10%, transparent)` }}
    >
      <div className="text-[13px] font-semibold" style={{ color: tone }}>
        {heading}
      </div>
      {feedback.verdict === "close" && (
        <p className="text-[13px] text-fg-2">
          Watch the spelling: <span className="font-medium text-fg">{question.answer}</span>
        </p>
      )}
      {!feedback.correct && question.kind !== "choice" && (
        <p className="text-[13px] text-fg-2">
          Correct answer: <span className="font-medium text-fg whitespace-pre-wrap break-words">{question.answer}</span>
        </p>
      )}
      {!feedback.correct && feedback.typed && (
        <p className="text-[12px] text-fg-3">You wrote: {feedback.typed}</p>
      )}
      {!feedback.auto && (
        <div className="flex justify-end gap-2 pt-1">
          {!feedback.correct && question.kind === "written" && feedback.typed && (
            <button onClick={onOverride} className="btn btn-ghost">
              I was right
            </button>
          )}
          <button onClick={() => onContinue(feedback.correct)} className="btn btn-primary" autoFocus>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
