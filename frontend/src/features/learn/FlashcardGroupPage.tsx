import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Folder, Info } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import BackButton from "../../components/BackButton";
import { SkeletonList } from "../../components/Skeleton";
import StudySession from "./StudySession";
import FlashcardViewer from "./FlashcardViewer";
import LearnMode from "./LearnMode";
import MemoryGame from "./MemoryGame";
import SpeedMatch from "./SpeedMatch";
import SetModePicker, { useStudyMode } from "./SetModePicker";
import { cardIsComplete } from "./CardEditor";
import { isDue } from "./sm2";
import type { StudyScope } from "./studyScope";
import type { Course, StudyGroup } from "../../types";

export default function FlashcardGroupPage({ kind }: { kind: "folder" | "course" }) {
  const { id } = useParams();
  const groupId = Number(id);
  const { user } = useAuth();
  const [mode, setMode] = useStudyMode();

  const group = useQuery({
    queryKey: ["flashcards", "study", kind, groupId],
    queryFn: () => api.get<StudyGroup>(`/flashcard-study?${kind}Id=${groupId}`),
    enabled: Number.isFinite(groupId),
    retry: false,
  });

  const courses = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
    enabled: kind === "course",
  });

  const cards = useMemo(() => (group.data?.cards ?? []).filter(cardIsComplete), [group.data]);
  const dueCount = useMemo(() => cards.filter((c) => isDue(c)).length, [cards]);

  if (group.isLoading) return <SkeletonList rows={5} />;

  if (!group.data) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-fg-3">
          This {kind === "folder" ? "folder" : "course"} doesn't exist.
        </p>
        <Link to="/learn/flashcards" className="btn btn-soft mt-3 inline-flex">
          Back to sets
        </Link>
      </div>
    );
  }

  const data = group.data;
  const scope: StudyScope = { kind, id: data.id };
  const course = kind === "course" ? courses.data?.find((c) => c.id === data.id) : undefined;
  const color = course?.color ?? "var(--accent)";
  const viewerKey = user ? String(user.id) : "guest";
  const count = cards.length;

  return (
    <div className="space-y-6 stagger-children">
      <div className="flex items-center gap-3">
        <BackButton fallback="/learn/flashcards" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 break-words text-xl font-semibold text-fg">
            <Folder size={18} className="shrink-0" style={{ color }} />
            <span className="min-w-0 truncate">{data.title}</span>
          </h1>
          <p className="mt-1 text-[13px] text-fg-3">
            Studying all {data.setCount} {data.setCount === 1 ? "set" : "sets"} together · {count}{" "}
            {count === 1 ? "card" : "cards"}
          </p>
        </div>
      </div>

      {data.truncated && (
        <div className="card flex items-start gap-3 p-4">
          <Info size={16} className="mt-0.5 shrink-0 text-fg-3" />
          <p className="text-[13px] text-fg-2">
            This group has more than {count} cards, so only the first {count} are included here.
          </p>
        </div>
      )}

      <SetModePicker mode={mode} onChange={setMode} color={color} dueCount={dueCount} />

      {count === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-fg-3">There are no cards to study here yet.</p>
          <Link to="/learn/flashcards" className="btn btn-soft mt-3 inline-flex">
            Back to sets
          </Link>
        </div>
      ) : (
        <>
          {mode === "flashcards" && (
            <FlashcardViewer key={`${kind}-${data.id}`} cards={cards} color={color} scope={scope} viewerKey={viewerKey} />
          )}

          {mode === "study" && (
            <StudySession scope={scope} cards={cards} color={color} onExit={() => setMode("flashcards")} />
          )}

          {mode === "learn" && (
            <LearnMode
              key={`${kind}-${data.id}`}
              scope={scope}
              cards={cards}
              color={color}
              viewerKey={viewerKey}
              onSwitchMode={setMode}
            />
          )}

          {mode === "memory" && (
            <MemoryGame
              key={`${kind}-${data.id}`}
              scope={scope}
              cards={cards}
              color={color}
              onDone={() => setMode("flashcards")}
            />
          )}

          {mode === "match" && (
            <SpeedMatch
              key={`${kind}-${data.id}`}
              scope={scope}
              cards={cards}
              color={color}
              viewerKey={viewerKey}
              onDone={() => setMode("flashcards")}
            />
          )}
        </>
      )}
    </div>
  );
}
