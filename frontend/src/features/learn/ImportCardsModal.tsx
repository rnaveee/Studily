import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import QuizletPastePanel from "./QuizletPastePanel";
import { MAX_CARDS_PER_SET, type ParseResult } from "./quizletImport";
import type { FlashcardSet, FlashcardSetRequest } from "../../types";

const NO_CARDS: ParseResult = { cards: [], skipped: 0 };

function cardKey(card: { front: string; back: string }) {
  return `${card.front.trim()}\u0000${card.back.trim()}`;
}

function plural(n: number, word: string) {
  return `${n} ${n === 1 ? word : `${word}s`}`;
}

export default function ImportCardsModal({ set, onClose }: { set: FlashcardSet; onClose: () => void }) {
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<ParseResult>(NO_CARDS);

  const existing = useMemo(() => new Set(set.cards.map(cardKey)), [set.cards]);
  const fresh = parsed.cards.filter((card) => !existing.has(cardKey(card)));
  const duplicates = parsed.cards.length - fresh.length;
  const room = Math.max(0, MAX_CARDS_PER_SET - set.cards.length);
  const adding = fresh.slice(0, room);

  const save = useMutation({
    mutationFn: (req: FlashcardSetRequest) => api.put<FlashcardSet>(`/flashcard-sets/${set.id}`, req),
    onSuccess: (updated, req) => {
      qc.setQueryData(["flashcards", "sets", set.id], updated);
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      toast.success(`Added ${plural(req.cards.length - set.cards.length, "card")}`);
      onClose();
    },
    onError: () => toast.error("Couldn't add those cards"),
  });

  const notices: string[] = [];
  if (duplicates > 0) {
    notices.push(
      `${plural(duplicates, "card")} ${duplicates === 1 ? "is" : "are"} already in this set and won't be added again.`,
    );
  }
  if (fresh.length > room) {
    notices.push(
      room === 0
        ? `This set is full at ${MAX_CARDS_PER_SET} cards. Import into a new set instead.`
        : `Sets hold up to ${MAX_CARDS_PER_SET} cards, so only the first ${plural(room, "card")} will be added.`,
    );
  }

  function handleAdd() {
    if (adding.length === 0 || save.isPending) return;
    save.mutate({
      title: set.title,
      description: set.description,
      courseId: set.courseId,
      cards: [...set.cards, ...adding],
    });
  }

  return (
    <Modal
      onClose={onClose}
      size="lg"
      variant="sheet"
      title={
        <div>
          <h2 className="text-[15px] font-semibold text-fg">Import from Quizlet</h2>
          <p className="mt-1 text-[13px] text-fg-2">Add cards to {set.title}.</p>
        </div>
      }
    >
      <QuizletPastePanel onParsed={setParsed} notices={notices} autoFocus />

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn btn-ghost">
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={adding.length === 0 || save.isPending}
          className="btn btn-primary"
        >
          {adding.length > 0 ? `Add ${plural(adding.length, "card")}` : "Add cards"}
        </button>
      </div>
    </Modal>
  );
}
