import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PartyPopper } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { intervalLabel, isDue, nextIntervalDays } from "./sm2";
import RunSummary from "./RunSummary";
import { useFlashcardRun } from "./useFlashcardRun";
import type { Flashcard, ReviewGrade } from "../../types";

const GRADES: { grade: ReviewGrade; label: string; explain: string; color: string }[] = [
  { grade: "AGAIN", label: "Again", explain: "Didn't know it",               color: "var(--red)" },
  { grade: "HARD",  label: "Hard",  explain: "Got it, but it was a struggle", color: "#c78a2d" },
  { grade: "GOOD",  label: "Good",  explain: "Got it after a moment",         color: "var(--accent)" },
  { grade: "EASY",  label: "Easy",  explain: "Knew it instantly",             color: "var(--green)" },
];

interface Props {
  setId: number;
  cards: Flashcard[];
  color: string;
  onExit: () => void;
}

export default function StudySession({ setId, cards, color, onExit }: Props) {
  const qc = useQueryClient();
  const [queue, setQueue] = useState<Flashcard[]>(() =>
    cards
      .filter((c) => c.id != null && isDue(c))
      .sort((a, b) => new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime()),
  );
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [grading, setGrading] = useState(false);
  const run = useFlashcardRun(setId, "REVIEW", cards);
  const graded = useRef(new Map<number, boolean>());
  const started = useRef(false);

  const card = queue[0];

  useEffect(() => {
    if (started.current || !run.eligible || queue.length === 0) return;
    started.current = true;
    run.start();
  }, [run.eligible]);

  useEffect(() => {
    if (card || !run.isActive()) return;
    void run.complete([...graded.current].map(([cardId, correct]) => ({ cardId, correct })));
  }, [card]);

  function done() {
    qc.invalidateQueries({ queryKey: ["flashcards"] });
    onExit();
  }

  async function grade(g: ReviewGrade) {
    if (!card || grading) return;
    setGrading(true);
    try {
      const updated = await api.post<Flashcard>(
        `/flashcard-sets/${setId}/cards/${card.id}/review`,
        { grade: g },
      );
      if (card.id != null) {
        const id = card.id;
        graded.current.set(id, g !== "AGAIN" && graded.current.get(id) !== false);
      }
      setQueue((q) => (g === "AGAIN" ? [...q.slice(1), updated] : q.slice(1)));
      setReviewed((n) => n + 1);
      setFlipped(false);
    } catch {
      toast.error("Couldn't save that review");
    } finally {
      setGrading(false);
    }
  }

  if (!card && (run.status === "completing" || run.status === "done")) {
    return (
      <RunSummary
        mode="REVIEW"
        result={run.result}
        pending={run.status === "completing"}
        headline="All caught up!"
        color={color}
        onDone={done}
        doneLabel="Back to set"
      >
        <p className="mt-1 text-[12px] text-fg-3">
          You reviewed {reviewed} {reviewed === 1 ? "card" : "cards"}. Come back when more are due.
        </p>
      </RunSummary>
    );
  }

  if (!card) {
    return (
      <div className="card p-10 text-center animate-in">
        <PartyPopper className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
        <p className="text-sm font-medium text-fg">All caught up!</p>
        <p className="mt-1 text-[12px] text-fg-3">
          {reviewed > 0
            ? `You reviewed ${reviewed} ${reviewed === 1 ? "card" : "cards"}. Come back when more are due.`
            : "No cards are due right now. Come back later."}
        </p>
        <button onClick={done} className="btn btn-soft mt-4 inline-flex">
          Back to set
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-fg-3 tabular-nums">
          {queue.length} {queue.length === 1 ? "card" : "cards"} left
        </span>
        <button onClick={done} className="btn btn-ghost">
          End session
        </button>
      </div>

      <p className="text-[12px] text-fg-3">
        After you flip a card, pick how well you knew it. Cards you miss come back
        soon, and ones you know come back later.
      </p>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="card flex min-h-48 w-full items-center justify-center p-8 text-center transition-colors hover:bg-surface-hi"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-3">
            {flipped ? "Back" : "Front · tap to reveal"}
          </div>
          <div className="text-lg text-fg">{flipped ? card.back : card.front}</div>
        </div>
      </button>

      {flipped ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map(({ grade: g, label, explain, color: c }) => (
            <button
              key={g}
              onClick={() => grade(g)}
              disabled={grading}
              className="card press flex flex-col items-center gap-0.5 px-2 py-2.5 text-center transition-all hover:bg-surface-hi disabled:opacity-50"
              style={{ boxShadow: "var(--btn-shadow)" }}
            >
              <span className="text-[13px] font-semibold" style={{ color: c }}>
                {label}
              </span>
              <span className="text-[11px] leading-snug text-fg-3">{explain}</span>
              <span className="text-[10px] text-fg-3 opacity-80">
                {intervalLabel(nextIntervalDays(card, g))}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center text-[12px] text-fg-3">
          Think of the answer, then tap the card.
        </p>
      )}
    </div>
  );
}
