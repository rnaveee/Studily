import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { Globe, Plus, Share2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useAuth, useRequireAuth } from "../../lib/auth";
import BackButton from "../../components/BackButton";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import StudySession from "./StudySession";
import FlashcardViewer from "./FlashcardViewer";
import LearnMode from "./LearnMode";
import MemoryGame from "./MemoryGame";
import SpeedMatch from "./SpeedMatch";
import ShareSetModal from "./ShareSetModal";
import SetModePicker, { useStudyMode } from "./SetModePicker";
import type { Course, FlashcardSet, FlashcardSetRequest } from "../../types";
import { SkeletonList } from "../../components/Skeleton";

export default function FlashcardSetPage() {
  const { id } = useParams();
  const setId = Number(id);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const [mode, setMode] = useStudyMode();

  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [sharing, setSharing] = useState(false);

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

  const update = useMutation({
    mutationFn: (req: FlashcardSetRequest) => api.put<FlashcardSet>(`/flashcard-sets/${setId}`, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flashcards"] }),
    onError: () => toast.error("Couldn't save that change"),
  });

  if (set.isLoading) {
    return (
      <SkeletonList rows={5} />
    );
  }

  if (!set.data) {
    if (user && set.error instanceof ApiError && set.error.status === 404) {
      return <Navigate to={`/sets/${setId}`} replace />;
    }
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
  const viewerKey = user ? String(user.id) : "guest";

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

  async function deleteCard(actualIndex: number) {
    const ok = await confirm({
      title: "Delete this card?",
      message: data.cards[actualIndex]?.front,
      confirmLabel: "Delete card",
      danger: true,
    });
    if (!ok) return;
    update.mutate({
      title: data.title,
      description: data.description,
      courseId: data.courseId,
      cards: data.cards.filter((_, i) => i !== actualIndex),
    });
  }

  return (
    <div className="space-y-6 stagger-children">
      <div className="flex items-center gap-3">
        <BackButton fallback="/learn/flashcards" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-fg">{data.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-fg-3">
            <span>
              {count} {count === 1 ? "card" : "cards"}
              {data.description && ` · ${data.description}`}
            </span>
            {data.visibility === "PUBLIC" && (
              <span className="inline-flex items-center gap-1">
                · <Globe size={11} /> Public
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => requireAuth(() => setSharing(true))}
          className="btn btn-ghost shrink-0"
        >
          <Share2 size={13} />
          Share
        </button>
      </div>

      <SetModePicker mode={mode} onChange={setMode} color={color} dueCount={data.dueCount} />

      {mode === "flashcards" && (
        <>
          <FlashcardViewer cards={data.cards} color={color} onDelete={deleteCard} />
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
        </>
      )}

      {mode === "study" &&
        (count === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm text-fg-3">Add some cards first, then come back to study them.</p>
          </div>
        ) : (
          <StudySession
            setId={data.id}
            cards={data.cards}
            color={color}
            onExit={() => setMode("flashcards")}
          />
        ))}

      {mode === "learn" && (
        <LearnMode
          key={data.id}
          setId={data.id}
          cards={data.cards}
          color={color}
          viewerKey={viewerKey}
          onSwitchMode={setMode}
        />
      )}

      {mode === "memory" && <MemoryGame key={data.id} cards={data.cards} color={color} />}

      {mode === "match" && (
        <SpeedMatch key={data.id} setId={data.id} cards={data.cards} color={color} viewerKey={viewerKey} />
      )}

      {sharing && <ShareSetModal set={data} onClose={() => setSharing(false)} />}
    </div>
  );
}
