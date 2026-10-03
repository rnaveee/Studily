import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Link2 } from "lucide-react";
import Modal from "../../components/Modal";
import SegmentedToggle from "../../components/SegmentedToggle";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { VISIBILITY_HINT, VISIBILITY_OPTIONS } from "./visibility";
import type { FlashcardSet, FlashcardSetVisibility } from "../../types";

export function shareUrl(setId: number): string {
  return `${window.location.origin}/sets/${setId}`;
}

export default function ShareSetModal({ set, onClose }: { set: FlashcardSet; onClose: () => void }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const url = shareUrl(set.id);

  const visibility = useMutation({
    mutationFn: (v: FlashcardSetVisibility) =>
      api.put<FlashcardSet>(`/flashcard-sets/${set.id}/visibility`, { visibility: v }),
    onSuccess: (updated) => {
      qc.setQueryData(["flashcards", "sets", set.id], updated);
      qc.invalidateQueries({ queryKey: ["flashcards"] });
    },
    onError: () => toast.error("Couldn't change who can see this set"),
  });

  const current = visibility.isPending && visibility.variables ? visibility.variables : set.visibility;
  const shared = current !== "PRIVATE";

  async function copyLink() {
    if (!shared) {
      try {
        await visibility.mutateAsync("PUBLIC");
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(url);
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={
        <div>
          <h2 className="text-[15px] font-semibold text-fg">Share {set.title}</h2>
          <p className="mt-1 text-[13px] text-fg-2">
            Classmates can study a shared set and save their own copy.
          </p>
        </div>
      }
    >
      <div>
        <label className="field-label">Who can see it</label>
        <SegmentedToggle
          className="w-full"
          options={VISIBILITY_OPTIONS}
          value={current}
          onChange={(v) => visibility.mutate(v)}
          disabled={visibility.isPending}
        />
        <p className="mt-2 text-[12px] text-fg-3">{VISIBILITY_HINT[current]}</p>
      </div>

      <div>
        <label className="field-label">Link</label>
        <div className="flex items-center gap-2">
          <input
            className="input min-w-0 flex-1"
            value={url}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            style={{ opacity: shared ? 1 : 0.6 }}
          />
          <button onClick={copyLink} disabled={visibility.isPending} className="btn btn-primary shrink-0">
            {copied ? <Check size={13} /> : <Link2 size={13} />}
            {copied ? "Copied" : shared ? "Copy link" : "Make public & copy"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
