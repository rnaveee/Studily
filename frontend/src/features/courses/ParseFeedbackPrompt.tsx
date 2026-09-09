import { useState } from "react";
import { CircleCheck, CirclePlus, CircleX } from "lucide-react";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";
import type { ParseRating } from "../../types";

interface Props {
  parseId: number;
  onDone: () => void;
}

const CHOICES: { rating: ParseRating; label: string; hint: string; icon: typeof CircleCheck }[] = [
  {
    rating: "ACCURATE",
    label: "It got everything right",
    hint: "You saved it as it came, or near enough",
    icon: CircleCheck,
  },
  {
    rating: "MINOR_FIXES",
    label: "Close, I fixed a few things",
    hint: "The bones were right but some details were off",
    icon: CirclePlus,
  },
  {
    rating: "INACCURATE",
    label: "It got it wrong",
    hint: "Enough was wrong that typing it out would have been faster",
    icon: CircleX,
  },
];

export default function ParseFeedbackPrompt({ parseId, onDone }: Props) {
  const [sending, setSending] = useState(false);

  function rate(rating: ParseRating) {
    if (sending) return;
    setSending(true);
    api.post<void>("/courses/parse/feedback", { parseId, rating }).catch(() => {});
    onDone();
  }

  return (
    <Modal onClose={onDone} title="How did the reader do?" size="md">
      <p className="text-[12px] text-fg-2">
        Your course is saved. Telling us how close it was is what we use to work out whether this is
        worth keeping, and it is the number other students see before they try it.
      </p>
      <div className="mt-3 space-y-2">
        {CHOICES.map(({ rating, label, hint, icon: Icon }) => (
          <button
            key={rating}
            type="button"
            onClick={() => rate(rating)}
            disabled={sending}
            className="card card-lift flex w-full items-start gap-2.5 p-3 text-left"
          >
            <Icon size={16} className="mt-0.5 shrink-0 text-fg-3" />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-fg">{label}</span>
              <span className="mt-0.5 block text-[11px] text-fg-3">{hint}</span>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onDone}
        className="btn btn-ghost mt-3 w-full text-xs"
      >
        Skip
      </button>
    </Modal>
  );
}
