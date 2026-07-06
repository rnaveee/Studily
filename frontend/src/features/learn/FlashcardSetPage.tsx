import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Shuffle, X } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import type { Course, FlashcardSet, FlashcardSetRequest } from "../../types";

export default function FlashcardSetPage() {
  const { id } = useParams();
  const setId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [order, setOrder] = useState<number[]>([]);

  const set = useQuery({
    queryKey: ["flashcards", "sets", setId],
    queryFn: () => api.get<FlashcardSet>(`/flashcard-sets/${setId}`),
    enabled: Number.isFinite(setId),
    retry: false,
  });

  const courses = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  useEffect(() => {
    if (!set.data) return;
    setOrder(set.data.cards.map((_, i) => i));
    setIndex(0);
    setFlipped(false);
  }, [set.data?.id, set.data?.cards.length]);

  const update = useMutation({
    mutationFn: (req: FlashcardSetRequest) => api.put<FlashcardSet>(`/flashcard-sets/${setId}`, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flashcards"] }),
    onError: () => toast.error("Couldn't save that change"),
  });

  if (set.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-3">
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
        Loading…
      </div>
    );
  }

  if (!set.data) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-fg-3">This flashcard set doesn't exist.</p>
        <Link to="/learn/flashcards" className="btn btn-soft mt-3 inline-flex">
          Back to sets
        </Link>
      </div>
    );
  }

  const data = set.data;
  const course = courses.data?.find((c) => c.id === data.courseId);
  const color = course?.color ?? "var(--accent)";
  const count = data.cards.length;
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const cardIndex = order[safeIndex] ?? safeIndex;
  const card = data.cards[cardIndex];

  function go(delta: number) {
    if (count === 0) return;
    setIndex((safeIndex + delta + count) % count);
    setFlipped(false);
  }

  function shuffle() {
    if (count < 2) return;
    const shuffled = order.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrder(shuffled);
    setIndex(0);
    setFlipped(false);
    toast.success("Cards shuffled");
  }

  function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    update.mutate({
      title: data.title,
      description: data.description,
      courseId: data.courseId,
      cards: [...data.cards, { front: front.trim(), back: back.trim() }],
    });
    setFront("");
    setBack("");
  }

  function deleteCard(actualIndex: number) {
    update.mutate({
      title: data.title,
      description: data.description,
      courseId: data.courseId,
      cards: data.cards.filter((_, i) => i !== actualIndex),
    });
    setFlipped(false);
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/learn/flashcards")}
          className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
          aria-label="Back to sets"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-fg">{data.title}</h1>
          <p className="mt-1 text-[13px] text-fg-3">
            {count} {count === 1 ? "card" : "cards"}
            {data.description && ` · ${data.description}`}
          </p>
        </div>
        <button
          onClick={shuffle}
          disabled={count < 2}
          className="btn btn-ghost shrink-0"
          aria-label="Shuffle cards"
        >
          <Shuffle size={13} />
          Shuffle
        </button>
      </div>

      {card ? (
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
              <div className="text-lg text-fg">{flipped ? card.back : card.front}</div>
            </div>
          </button>
          <div className="flex items-center justify-between">
            <button onClick={() => go(-1)} className="btn btn-ghost" aria-label="Previous card">
              <ChevronLeft size={13} />
              Prev
            </button>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-fg-3 tabular-nums">
                {safeIndex + 1} / {count}
              </span>
              <button
                onClick={() => deleteCard(cardIndex)}
                className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
                aria-label="Delete card"
              >
                <X size={14} />
              </button>
            </div>
            <button onClick={() => go(1)} className="btn btn-ghost" aria-label="Next card">
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-10 text-center">
          <p className="text-sm text-fg-3">This set is empty. Add your first card below.</p>
        </div>
      )}

      <form onSubmit={addCard} className="card space-y-3 p-4">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-fg-3">Add a card</h2>
        <div>
          <label className="field-label">Front</label>
          <input
            className="input"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="Question or term"
          />
        </div>
        <div>
          <label className="field-label">Back</label>
          <input
            className="input"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder="Answer or definition"
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={!front.trim() || !back.trim()} className="btn btn-primary">
            <Plus size={13} />
            Add card
          </button>
        </div>
      </form>
    </div>
  );
}
