import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import type { Course, FlashcardSet, FlashcardSetRequest, Semester } from "../../types";

export default function NewFlashcardSetModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState<number | "">("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const currentSemester = useQuery({
    queryKey: ["semesters", "current"],
    queryFn: () => api.get<Semester | null>("/semesters/current"),
  });

  const semesterId = currentSemester.data?.id;

  const courses = useQuery({
    queryKey: ["courses", semesterId ?? null],
    queryFn: () => api.get<Course[]>(`/courses?semesterId=${semesterId}`),
    enabled: !!semesterId,
  });

  const create = useMutation({
    mutationFn: (req: FlashcardSetRequest) => api.post<FlashcardSet>("/flashcard-sets", req),
    onSuccess: (set) => {
      toast.success("Flashcard set created");
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      onClose();
      navigate(`/learn/flashcards/${set.id}`);
    },
    onError: () => toast.error("Couldn't create the set"),
  });

  const canCreate = title.trim().length > 0 && !create.isPending;

  function handleCreate() {
    if (!canCreate) return;
    create.mutate({
      title: title.trim(),
      description: description.trim() || null,
      courseId: courseId === "" ? null : courseId,
      cards: [],
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="card flex w-full max-w-sm flex-col gap-4 p-5 shadow-xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">New flashcard set</h2>
            <p className="mt-1 text-[13px] text-fg-2">Give it a title and, optionally, a course.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div>
          <label className="field-label">Title</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bio 101 midterm"
            autoFocus
          />
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this set for?"
            rows={2}
          />
        </div>

        <div>
          <label className="field-label">Course</label>
          {courses.data && courses.data.length > 0 ? (
            <select
              className="input"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">No course</option>
              {courses.data.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <p className="text-[12px] text-fg-3">
              {currentSemester.data
                ? "No courses in your current semester yet."
                : "No current semester set up yet."}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!canCreate} className="btn btn-primary">
            Create
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
