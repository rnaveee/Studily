import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ClipboardPaste } from "lucide-react";
import Modal from "../../components/Modal";
import SegmentedToggle from "../../components/SegmentedToggle";
import { VISIBILITY_HINT, VISIBILITY_OPTIONS } from "./visibility";
import { cardIsComplete } from "./CardEditor";
import QuizletPastePanel from "./QuizletPastePanel";
import { MAX_CARDS_PER_SET, splitIntoSets, type ParseResult } from "./quizletImport";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import type { Course, FlashcardSet, FlashcardSetRequest, FlashcardSetVisibility, Semester } from "../../types";

const NO_CARDS: ParseResult = { cards: [], skipped: 0 };
const MAX_TITLE_LENGTH = 255;

export default function NewFlashcardSetModal({
  onClose,
  importing: startImporting = false,
}: {
  onClose: () => void;
  importing?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [importing, setImporting] = useState(startImporting);
  const [parsed, setParsed] = useState<ParseResult>(NO_CARDS);
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [visibility, setVisibility] = useState<FlashcardSetVisibility>("PRIVATE");
  const navigate = useNavigate();
  const qc = useQueryClient();

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
    mutationFn: async (req: FlashcardSetRequest) => {
      const parts = splitIntoSets(req.cards);
      if (parts.length === 1) {
        return { created: [await api.post<FlashcardSet>("/flashcard-sets", req)], total: 1 };
      }
      const created: FlashcardSet[] = [];
      for (const [i, part] of parts.entries()) {
        const suffix = ` (${i + 1} of ${parts.length})`;
        try {
          created.push(
            await api.post<FlashcardSet>("/flashcard-sets", {
              ...req,
              title: req.title.slice(0, MAX_TITLE_LENGTH - suffix.length).trimEnd() + suffix,
              cards: part,
            }),
          );
        } catch (e) {
          if (created.length === 0) throw e;
          break;
        }
      }
      return { created, total: parts.length };
    },
    onSuccess: ({ created, total }) => {
      if (created.length < total) {
        toast.error(`Created ${created.length} of ${total} sets. Couldn't create the rest.`);
      } else {
        toast.success(total > 1 ? `Created ${total} sets` : "Flashcard set created");
      }
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      onClose();
      navigate(`/learn/flashcards/${created[0].id}`, {
        state: { addImages: !created[0].cards.every(cardIsComplete) },
      });
    },
    onError: () => toast.error("Couldn't create the set"),
  });

  const cards = importing ? parsed.cards : [];
  const setCount = Math.max(1, Math.ceil(cards.length / MAX_CARDS_PER_SET));
  const canCreate =
    title.trim().length > 0 && !create.isPending && (!importing || cards.length > 0);

  function handleCreate() {
    if (!canCreate) return;
    create.mutate({
      title: title.trim(),
      description: description.trim() || null,
      courseId: courseId === "" ? null : courseId,
      cards,
      visibility,
    });
  }

  const createLabel =
    setCount > 1
      ? `Create ${setCount} sets`
      : cards.length > 0
        ? `Create with ${cards.length} ${cards.length === 1 ? "card" : "cards"}`
        : "Create";

  return (
    <Modal
      onClose={onClose}
      size={importing ? "lg" : "sm"}
      title={
        <div>
          <h2 className="text-[15px] font-semibold text-fg">
            {importing ? "Import from Quizlet" : "New flashcard set"}
          </h2>
          <p className="mt-1 text-[13px] text-fg-2">
            {importing
              ? "Paste your Quizlet export and give the new set a title."
              : "Give it a title and, optionally, a course."}
          </p>
        </div>
      }
    >

        <div>
          <label className="field-label">Title</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bio 101 midterm"
            maxLength={MAX_TITLE_LENGTH}
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

        <div>
          <label className="field-label">Who can see it</label>
          <SegmentedToggle
            className="w-full"
            options={VISIBILITY_OPTIONS}
            value={visibility}
            onChange={setVisibility}
          />
          <p className="mt-2 text-[12px] text-fg-3">
            {visibility === "PRIVATE" ? "Only you can see it. You can share it later." : VISIBILITY_HINT[visibility]}
          </p>
        </div>

        {importing ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="field-label" style={{ marginBottom: 0 }}>
                Cards
              </span>
              <button
                type="button"
                onClick={() => setImporting(false)}
                className="text-[12px] text-fg-3 transition-colors hover:text-fg"
              >
                Start empty instead
              </button>
            </div>
            <QuizletPastePanel
              onParsed={setParsed}
              notices={
                setCount > 1
                  ? [
                      `Studily sets hold up to ${MAX_CARDS_PER_SET} cards, so this makes ${setCount} sets, numbered (1 of ${setCount}), (2 of ${setCount}) and so on.`,
                    ]
                  : []
              }
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="flex items-center gap-1.5 self-start text-[13px] font-medium text-accent hover:underline"
          >
            <ClipboardPaste size={13} />
            Import cards from Quizlet
          </button>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!canCreate} className="btn btn-primary">
            {createLabel}
          </button>
        </div>
    </Modal>
  );
}
