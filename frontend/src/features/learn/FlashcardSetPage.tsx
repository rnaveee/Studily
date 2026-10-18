import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { ClipboardPaste, FileText, ImageOff, Plus, Share2 } from "lucide-react";
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
import ImportCardsModal from "./ImportCardsModal";
import GenerateCardsModal from "./GenerateCardsModal";
import MissingImagesModal from "./MissingImagesModal";
import CardEditor, { cardIsComplete, EMPTY_CARD, type CardDraft } from "./CardEditor";
import Modal, { useModalClose } from "../../components/Modal";
import SetModePicker, { useStudyMode } from "./SetModePicker";
import { VisibilityBadge } from "./visibility";
import type { Course, Flashcard, FlashcardSet, FlashcardSetRequest } from "../../types";
import { SkeletonList } from "../../components/Skeleton";

export default function FlashcardSetPage() {
  const { id } = useParams();
  const setId = Number(id);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const [mode, setMode] = useStudyMode();

  const [draft, setDraft] = useState<CardDraft>(EMPTY_CARD);
  const [draftUploading, setDraftUploading] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const addImagesOnOpen = !!(location.state as { addImages?: boolean } | null)?.addImages;
  const [filling, setFilling] = useState(addImagesOnOpen);

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

  useEffect(() => {
    if (addImagesOnOpen) navigate(location.pathname + location.search, { replace: true, state: null });
  }, [addImagesOnOpen, location.pathname, location.search, navigate]);

  const studyable = useMemo(() => {
    const cards = set.data?.cards ?? [];
    return cards.every(cardIsComplete) ? cards : cards.filter(cardIsComplete);
  }, [set.data]);

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
  const missing = count - studyable.length;
  const viewerKey = user ? String(user.id) : "guest";

  function addCard() {
    if (!cardIsComplete(draft)) return;
    update.mutate({
      title: data.title,
      description: data.description,
      courseId: data.courseId,
      cards: [...data.cards, { ...draft, front: draft.front.trim(), back: draft.back.trim() }],
    });
    setDraft(EMPTY_CARD);
  }

  function saveCard(index: number, card: CardDraft, onDone: () => void) {
    update.mutate(
      {
        title: data.title,
        description: data.description,
        courseId: data.courseId,
        cards: data.cards.map((c, i) =>
          i === index ? { ...c, ...card, front: card.front.trim(), back: card.back.trim() } : c,
        ),
      },
      { onSuccess: onDone },
    );
  }

  function saveFilled(cards: Flashcard[] | null) {
    setFilling(false);
    if (!cards) return;
    const updated = cards.filter(cardIsComplete).length - studyable.length;
    update.mutate(
      { title: data.title, description: data.description, courseId: data.courseId, cards },
      { onSuccess: () => toast.success(`Updated ${updated} ${updated === 1 ? "card" : "cards"}`) },
    );
  }

  async function deleteCard(actualIndex: number) {
    const ok = await confirm({
      title: "Delete this card?",
      message: data.cards[actualIndex]?.front.trim() || "Image card",
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
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-3">
            <span>
              {count} {count === 1 ? "card" : "cards"}
              {data.description && ` · ${data.description}`}
            </span>
            <VisibilityBadge visibility={data.visibility} />
          </p>
          {data.copiedFrom && (
            <p className="mt-0.5 text-[12px] text-fg-3">
              Copied from{" "}
              {data.copiedFrom.setId ? (
                <Link to={`/sets/${data.copiedFrom.setId}`} className="font-medium text-fg-2 hover:text-fg">
                  {data.copiedFrom.title}
                </Link>
              ) : (
                "a set"
              )}{" "}
              by{" "}
              <Link to={`/users/${data.copiedFrom.owner.id}`} className="font-medium text-fg-2 hover:text-fg">
                {data.copiedFrom.owner.name || data.copiedFrom.owner.username}
              </Link>{" "}
              (@{data.copiedFrom.owner.username})
            </p>
          )}
        </div>
        <button
          onClick={() => requireAuth(() => setSharing(true))}
          className="btn btn-ghost shrink-0"
        >
          <Share2 size={13} />
          Share
        </button>
      </div>

      {missing > 0 && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <ImageOff size={18} className="shrink-0 text-yellow" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-fg">
              {missing} {missing === 1 ? "card needs" : "cards need"} an image
            </p>
            <p className="mt-0.5 text-[12px] text-fg-3">
              {missing === 1 ? "It's" : "They're"} left out of studying until you add {missing === 1 ? "it" : "them"}.
            </p>
          </div>
          <button onClick={() => requireAuth(() => setFilling(true))} className="btn btn-primary shrink-0">
            Add images
          </button>
        </div>
      )}

      <SetModePicker mode={mode} onChange={setMode} color={color} dueCount={data.dueCount} />

      {mode === "flashcards" && (
        <>
          <FlashcardViewer
            key={data.id}
            cards={data.cards}
            color={color}
            setId={data.id}
            viewerKey={viewerKey}
            onDelete={deleteCard}
            onEdit={(i) => requireAuth(() => setEditing(i))}
          />
          <div className="card space-y-3 p-4">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-fg-3">Add a card</h2>
            <p className="text-[12px] text-fg-3">Paste or drop an image into either side, or tap the picture button.</p>
            <CardEditor
              value={draft}
              onChange={setDraft}
              onUploadingChange={setDraftUploading}
              onSubmit={addCard}
              footer={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => requireAuth(() => setGenerating(true))}
                      className="btn btn-ghost"
                    >
                      <FileText size={13} />
                      From a document
                    </button>
                    <button
                      type="button"
                      data-tour="quizlet-import"
                      onClick={() => requireAuth(() => setImporting(true))}
                      className="btn btn-ghost"
                    >
                      <ClipboardPaste size={13} />
                      Import from Quizlet
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={!cardIsComplete(draft) || draftUploading}
                    className="btn btn-primary"
                  >
                    <Plus size={13} />
                    Add card
                  </button>
                </div>
              }
            />
          </div>
        </>
      )}

      {mode === "study" &&
        (studyable.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm text-fg-3">
              {count === 0
                ? "Add some cards first, then come back to study them."
                : "Add the missing images first, then come back to study these cards."}
            </p>
          </div>
        ) : (
          <StudySession
            setId={data.id}
            cards={studyable}
            color={color}
            onExit={() => setMode("flashcards")}
          />
        ))}

      {mode === "learn" && (
        <LearnMode
          key={data.id}
          setId={data.id}
          cards={studyable}
          color={color}
          viewerKey={viewerKey}
          onSwitchMode={setMode}
        />
      )}

      {mode === "memory" && (
        <MemoryGame key={data.id} setId={data.id} cards={studyable} color={color} onDone={() => setMode("flashcards")} />
      )}

      {mode === "match" && (
        <SpeedMatch
          key={data.id}
          setId={data.id}
          cards={studyable}
          color={color}
          viewerKey={viewerKey}
          onDone={() => setMode("flashcards")}
        />
      )}

      {sharing && <ShareSetModal set={data} onClose={() => setSharing(false)} />}
      {importing && (
        <ImportCardsModal
          set={data}
          onClose={() => setImporting(false)}
          onAdded={(needImages) => needImages > 0 && setFilling(true)}
        />
      )}
      {generating && <GenerateCardsModal set={data} onClose={() => setGenerating(false)} />}
      {filling && missing > 0 && <MissingImagesModal cards={data.cards} onClose={saveFilled} />}
      {editing !== null && data.cards[editing] && (
        <Modal onClose={() => setEditing(null)} title="Edit card" size="md">
          <EditCardForm
            card={{
              front: data.cards[editing].front,
              back: data.cards[editing].back,
              frontImage: data.cards[editing].frontImage ?? null,
              backImage: data.cards[editing].backImage ?? null,
            }}
            saving={update.isPending}
            onSave={(card, done) => saveCard(editing, card, done)}
          />
        </Modal>
      )}
    </div>
  );
}

function EditCardForm({
  card,
  saving,
  onSave,
}: {
  card: CardDraft;
  saving: boolean;
  onSave: (card: CardDraft, done: () => void) => void;
}) {
  const close = useModalClose();
  const [value, setValue] = useState(card);
  const [uploading, setUploading] = useState(false);

  return (
    <CardEditor
      value={value}
      onChange={setValue}
      onUploadingChange={setUploading}
      autoFocus
      onSubmit={() => onSave(value, close)}
      footer={
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={close} className="btn btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={!cardIsComplete(value) || uploading || saving} className="btn btn-primary">
            {saving ? "Saving…" : "Save card"}
          </button>
        </div>
      }
    />
  );
}
