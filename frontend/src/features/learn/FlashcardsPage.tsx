import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Layers, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import type { Course, FlashcardSet } from "../../types";
import NewFlashcardSetModal from "./NewFlashcardSetModal";

export default function FlashcardsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const sets = useQuery({
    queryKey: ["flashcards", "sets"],
    queryFn: () => api.get<FlashcardSet[]>("/flashcard-sets"),
  });

  const courses = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/flashcard-sets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flashcards"] }),
  });

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/learn"
            className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
            aria-label="Back to Learn"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-fg">Flashcards</h1>
            <p className="mt-1 text-[13px] text-fg-3">Create sets and study them.</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">
          <Plus size={13} />
          Create
        </button>
      </div>

      {sets.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-fg-3">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
          Loading…
        </div>
      ) : sets.data && sets.data.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sets.data.map((s) => {
            const course = courses.data?.find((c) => c.id === s.courseId);
            const color = course?.color ?? "var(--accent)";
            return (
              <li
                key={s.id}
                className="card flex items-center justify-between gap-3 p-4 animate-fade"
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <Link
                  to={`/learn/flashcards/${s.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
                  >
                    <Layers size={16} style={{ color }} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-fg truncate">{s.title}</div>
                    {s.description && (
                      <div className="text-[12px] text-fg-3 truncate">{s.description}</div>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => remove.mutate(s.id)}
                  className="shrink-0 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
                  aria-label="Delete set"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card p-10 text-center">
          <Layers className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
          <p className="text-sm text-fg-3">You have no flashcards. Create one!</p>
        </div>
      )}

      {showCreate && <NewFlashcardSetModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
