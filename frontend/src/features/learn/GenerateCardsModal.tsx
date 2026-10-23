import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Modal from "../../components/Modal";
import DocumentGenerator from "./DocumentGenerator";
import GeneratedCardsReview from "./GeneratedCardsReview";
import { MAX_CARDS_PER_SET } from "./quizletImport";
import { api } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import type { Flashcard, FlashcardSet, FlashcardSetRequest, GeneratedDeck } from "../../types";

export default function GenerateCardsModal({
  set,
  onClose,
  initialDeck = null,
}: {
  set: FlashcardSet;
  onClose: () => void;
  initialDeck?: GeneratedDeck | null;
}) {
  const [deck, setDeck] = useState<GeneratedDeck | null>(initialDeck);
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const closeRef = useRef<(() => void) | null>(null);
  const room = Math.max(0, MAX_CARDS_PER_SET - set.cards.length);

  const save = useMutation({
    mutationFn: (req: FlashcardSetRequest) => api.put<FlashcardSet>(`/flashcard-sets/${set.id}`, req),
    onSuccess: (updated, req) => {
      qc.setQueryData(["flashcards", "sets", set.id], updated);
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      const added = req.cards.length - set.cards.length;
      toast.success(`Added ${added} ${added === 1 ? "card" : "cards"}`);
      (closeRef.current ?? onClose)();
    },
    onError: () => toast.error("Couldn't add those cards"),
  });

  function add(cards: Flashcard[]) {
    if (save.isPending) return;
    save.mutate({
      title: set.title,
      description: set.description ?? null,
      courseId: set.courseId ?? null,
      cards: [...set.cards, ...cards],
    });
  }

  async function confirmDiscard(): Promise<boolean> {
    if (!deck || save.isPending || save.isSuccess) return true;
    return confirmDialog({
      title: `Discard ${deck.cards.length} generated ${deck.cards.length === 1 ? "card" : "cards"}?`,
      message: "They won't be added. Uploading the same file again later won't use another document.",
      confirmLabel: "Discard",
      danger: true,
    });
  }

  return (
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      size={deck ? "xl" : "lg"}
      variant="sheet"
      beforeClose={confirmDiscard}
      title={
        <div>
          <h2 className="text-[15px] font-semibold text-fg">{deck ? "Check your cards" : "Make cards from documents"}</h2>
          <p className="mt-1 text-[13px] text-fg-2">
            {deck
              ? `Edit or untick anything before it's added to ${set.title}.`
              : `Upload lecture slides or notes to add cards to ${set.title}.`}
          </p>
        </div>
      }
    >
      {deck ? (
        <GeneratedCardsReview
          deck={deck}
          room={room}
          saving={save.isPending}
          confirmLabel={(n) => `Add ${n} ${n === 1 ? "card" : "cards"}`}
          onConfirm={add}
          onBack={async () => {
            if (await confirmDiscard()) setDeck(null);
          }}
        />
      ) : room === 0 ? (
        <p className="text-[13px] text-fg-2">This set is full at 500 cards. Make a new set for more cards.</p>
      ) : (
        <DocumentGenerator setId={set.id} onGenerated={setDeck} onCancel={() => (closeRef.current ?? onClose)()} />
      )}
    </Modal>
  );
}
