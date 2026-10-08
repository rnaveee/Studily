import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { CopyPlus, Lock, Users } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { rememberNext } from "../../lib/next";
import { toast } from "../../lib/toast";
import Avatar from "../../components/Avatar";
import BackButton from "../../components/BackButton";
import { SkeletonList } from "../../components/Skeleton";
import FlashcardViewer from "./FlashcardViewer";
import LearnMode from "./LearnMode";
import MemoryGame from "./MemoryGame";
import SpeedMatch from "./SpeedMatch";
import SetModePicker, { useStudyMode } from "./SetModePicker";
import type { FlashcardSet, SharedFlashcardSet } from "../../types";

const COLOR = "var(--accent)";

export default function SharedSetPage() {
  const { id } = useParams();
  const setId = Number(id);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useStudyMode();

  const set = useQuery({
    queryKey: ["flashcards", "shared", setId],
    queryFn: () => api.get<SharedFlashcardSet>(`/public/flashcard-sets/${setId}`),
    enabled: Number.isFinite(setId),
    retry: false,
  });

  const copy = useMutation({
    mutationFn: () => api.post<FlashcardSet>(`/flashcard-sets/${setId}/copy`),
    onSuccess: (created) => {
      toast.success("Saved to your sets");
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      navigate(`/learn/flashcards/${created.id}`);
    },
    onError: () => toast.error("Couldn't save a copy"),
  });

  function goToAuth(path: "/signup" | "/login") {
    rememberNext(`/sets/${setId}`);
    navigate(path);
  }

  function saveCopy() {
    if (user) copy.mutate();
    else goToAuth("/signup");
  }

  if (set.isLoading) return <SkeletonList rows={5} />;

  if (!set.data) {
    return (
      <div className="card p-10 text-center">
        <Lock className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
        <p className="text-sm text-fg-3">This set is private, shared only with friends, or no longer exists.</p>
        {!user && !loading && (
          <p className="mt-1 text-[12px] text-fg-3">If a friend sent it to you, log in to see it.</p>
        )}
        <div className="mt-3 flex justify-center gap-2">
          {!user && !loading && (
            <button onClick={() => goToAuth("/login")} className="btn btn-primary">
              Log in
            </button>
          )}
          <Link to={user ? "/learn/flashcards" : "/"} className="btn btn-soft inline-flex">
            {user ? "Back to your sets" : "Go to Studily"}
          </Link>
        </div>
      </div>
    );
  }

  const data = set.data;
  if (data.viewerIsOwner) return <Navigate to={`/learn/flashcards/${data.id}`} replace />;

  const viewerKey = user ? String(user.id) : "guest";
  const ownerName = data.owner.name || data.owner.username;

  return (
    <div className="space-y-6 stagger-children">
      <div className="flex items-start gap-3">
        <BackButton fallback={user ? "/learn/flashcards" : "/"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="badge badge-accent inline-flex items-center gap-1">
              <Users size={11} />
              Shared set
            </span>
            {data.visibility === "FRIENDS" && <span className="badge badge-muted">Friends only</span>}
          </div>
          <h1 className="mt-1.5 text-xl font-semibold text-fg">{data.title}</h1>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-fg-3">
            <Avatar
              name={data.owner.name}
              username={data.owner.username}
              avatarUrl={data.owner.avatarUrl}
              size={18}
            />
            <span className="truncate">
              by{" "}
              {user ? (
                <Link to={`/users/${data.owner.id}`} className="font-medium text-fg-2 hover:text-fg">
                  {ownerName}
                </Link>
              ) : (
                <span className="font-medium text-fg-2">{ownerName}</span>
              )}{" "}
              (@{data.owner.username})
            </span>
          </div>
          <p className="mt-1 text-[13px] text-fg-3">
            {data.cardCount} {data.cardCount === 1 ? "card" : "cards"}
            {data.description && ` · ${data.description}`}
          </p>
        </div>
        {!loading && (
          <button onClick={saveCopy} disabled={copy.isPending} className="btn btn-primary shrink-0">
            <CopyPlus size={13} />
            Save a copy
          </button>
        )}
      </div>

      {!loading && !user && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-fg">Make this set your own</p>
            <p className="mt-0.5 text-[12px] text-fg-3">
              Sign up free to save a copy, edit it, and track your progress with spaced repetition.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => goToAuth("/login")} className="btn btn-ghost">
              Log in
            </button>
            <button onClick={() => goToAuth("/signup")} className="btn btn-primary">
              Sign up free
            </button>
          </div>
        </div>
      )}

      <SetModePicker mode={mode} onChange={setMode} color={COLOR} studyLocked />

      {mode === "flashcards" && <FlashcardViewer cards={data.cards} color={COLOR} />}

      {mode === "study" && (
        <div className="card p-10 text-center">
          <Lock className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
          <p className="text-sm font-medium text-fg">Save a copy to track your progress</p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] text-fg-3">
            Study brings each card back right before you'd forget it, based on how well you know it.
            That needs your own copy of the set. Learn, Memory and Match work right here.
          </p>
          {!loading && (
            <button onClick={saveCopy} disabled={copy.isPending} className="btn btn-primary mt-4 inline-flex">
              <CopyPlus size={13} />
              {user ? "Save a copy" : "Sign up to save a copy"}
            </button>
          )}
        </div>
      )}

      {mode === "learn" && (
        <LearnMode
          key={data.id}
          setId={data.id}
          cards={data.cards}
          color={COLOR}
          viewerKey={viewerKey}
          onSwitchMode={setMode}
        />
      )}

      {mode === "memory" && (
        <MemoryGame key={data.id} setId={data.id} cards={data.cards} color={COLOR} onDone={() => setMode("flashcards")} />
      )}

      {mode === "match" && (
        <SpeedMatch
          key={data.id}
          setId={data.id}
          cards={data.cards}
          color={COLOR}
          viewerKey={viewerKey}
          onDone={() => setMode("flashcards")}
        />
      )}
    </div>
  );
}
