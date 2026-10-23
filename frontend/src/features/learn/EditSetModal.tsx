import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import Modal from "../../components/Modal";
import SegmentedToggle from "../../components/SegmentedToggle";
import { api } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import { VISIBILITY_HINT, VISIBILITY_OPTIONS } from "./visibility";
import type { Course, FlashcardSet, FlashcardSetVisibility } from "../../types";

export default function EditSetModal({
  set,
  onClose,
  onDeleted,
}: {
  set: FlashcardSet;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [title, setTitle] = useState(set.title);
  const [description, setDescription] = useState(set.description ?? "");
  const [courseId, setCourseId] = useState<number | null>(set.courseId ?? null);
  const [visibility, setVisibility] = useState<FlashcardSetVisibility>(set.visibility);

  const courses = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const save = useMutation({
    mutationFn: async () => {
      let updated = await api.put<FlashcardSet>(`/flashcard-sets/${set.id}`, {
        title: title.trim(),
        description: description.trim() || null,
        courseId,
        cards: set.cards,
      });
      if (visibility !== set.visibility) {
        updated = await api.put<FlashcardSet>(`/flashcard-sets/${set.id}/visibility`, { visibility });
      }
      return updated;
    },
    onSuccess: (updated) => {
      qc.setQueryData(["flashcards", "sets", set.id], updated);
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      toast.success("Set updated");
      onClose();
    },
    onError: () => toast.error("Couldn't save that change"),
  });

  const remove = useMutation({
    mutationFn: () => api.del(`/flashcard-sets/${set.id}`),
    onSuccess: () => {
      toast.success("Set deleted");
      onClose();
      onDeleted?.();
      qc.invalidateQueries({ queryKey: ["flashcards"], predicate: (q) => q.queryKey[2] !== set.id });
    },
    onError: () => toast.error("Couldn't delete that set"),
  });

  async function handleDelete() {
    const n = set.cards.length;
    const ok = await confirm({
      title: `Delete ${set.title}?`,
      message: `This permanently removes the set and its ${n} ${n === 1 ? "card" : "cards"}.`,
      confirmLabel: "Delete set",
      danger: true,
    });
    if (ok) remove.mutate();
  }

  const changed =
    title.trim() !== set.title ||
    description.trim() !== (set.description ?? "") ||
    courseId !== (set.courseId ?? null) ||
    visibility !== set.visibility;
  const canSave = title.trim().length > 0 && changed && !save.isPending && !remove.isPending;

  return (
    <Modal
      onClose={onClose}
      title={
        <div>
          <h2 className="text-[15px] font-semibold text-fg">Edit set</h2>
          <p className="mt-1 text-[13px] text-fg-2">Change the details or who can see this set.</p>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button onClick={handleDelete} disabled={remove.isPending} className="btn btn-ghost text-red">
            <Trash2 size={13} />
            Delete set
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={() => save.mutate()} disabled={!canSave} className="btn btn-primary">
              Save
            </button>
          </div>
        </div>
      }
    >
      <div>
        <label className="field-label">Title</label>
        <input
          className="input"
          value={title}
          maxLength={255}
          required
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="field-label">Description</label>
        <textarea
          className="input"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="field-label">Course</label>
        <select
          className="input"
          value={courseId ?? ""}
          onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">No course</option>
          {courses.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code ? `${c.code} · ${c.name}` : c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label">Who can see it</label>
        <SegmentedToggle
          className="w-full"
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={setVisibility}
        />
        <p className="mt-2 text-[12px] text-fg-3">{VISIBILITY_HINT[visibility]}</p>
      </div>
    </Modal>
  );
}
