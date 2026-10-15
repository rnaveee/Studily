import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Modal, { useModalClose } from "../../components/Modal";
import CardFace from "./CardFace";
import { SideField, cardIsComplete } from "./CardEditor";
import type { Flashcard } from "../../types";

function plural(n: number, word: string) {
  return `${n} ${n === 1 ? word : `${word}s`}`;
}

function sideIsEmpty(text: string, image?: string | null) {
  return !text.trim() && !image;
}

export default function MissingImagesModal({
  cards,
  onClose,
}: {
  cards: Flashcard[];
  onClose: (updated: Flashcard[] | null) => void;
}) {
  const [rows] = useState(() => cards.flatMap((card, i) => (cardIsComplete(card) ? [] : [i])));
  const [working, setWorking] = useState(cards);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const latest = useRef(working);
  latest.current = working;

  const uploading = Object.values(busy).some(Boolean);
  const filled = rows.filter((i) => cardIsComplete(working[i])).length;

  function patch(index: number, change: Partial<Flashcard>) {
    setWorking((all) => all.map((card, i) => (i === index ? { ...card, ...change } : card)));
  }

  function finish() {
    const current = latest.current;
    const done = rows.filter((i) => cardIsComplete(current[i]));
    if (done.length === 0) {
      onClose(null);
      return;
    }
    onClose(
      cards.map((card, i) =>
        done.includes(i) ? { ...current[i], front: current[i].front.trim(), back: current[i].back.trim() } : card,
      ),
    );
  }

  return (
    <Modal
      onClose={finish}
      size="lg"
      variant="sheet"
      title={
        <div>
          <h2 className="text-[15px] font-semibold text-fg">Add the missing images</h2>
          <p className="mt-1 text-[13px] text-fg-2">
            Quizlet doesn't export images, so {plural(rows.length, "card")} came across with an empty side. Copy each
            image from Quizlet and paste it here, or pick it from your files. You can type the answer instead.
          </p>
        </div>
      }
    >
      <ol className="space-y-2">
        {rows.map((i) => {
          const original = cards[i];
          const card = working[i];
          const emptyFront = sideIsEmpty(original.front, original.frontImage);
          const done = cardIsComplete(card);
          return (
            <li key={i} className="flex gap-2.5 rounded-lg p-3" style={{ background: "var(--surface-hi)" }}>
              <span className="w-6 shrink-0 pt-px text-right text-[11px] tabular-nums text-fg-3">{i + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <div className="field-label">{emptyFront ? "Back" : "Front"}</div>
                  <CardFace
                    text={emptyFront ? original.back : original.front}
                    image={emptyFront ? original.backImage : original.frontImage}
                    imageClassName="max-h-24"
                    textClassName="text-[14px] text-fg"
                  />
                </div>
                <SideField
                  label={emptyFront ? "Front" : "Back"}
                  placeholder={emptyFront ? "Question or term" : "Answer or definition"}
                  text={emptyFront ? card.front : card.back}
                  image={(emptyFront ? card.frontImage : card.backImage) ?? null}
                  uploading={!!busy[i]}
                  onText={(text) => patch(i, emptyFront ? { front: text } : { back: text })}
                  onImage={(key) => patch(i, emptyFront ? { frontImage: key } : { backImage: key })}
                  onBusy={(value) => setBusy((b) => ({ ...b, [i]: value }))}
                />
              </div>
              {done && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green" aria-label="Ready" />}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-fg-3 tabular-nums">
          {filled} of {rows.length} done
        </span>
        <DoneButton filled={filled} uploading={uploading} />
      </div>
    </Modal>
  );
}

function DoneButton({ filled, uploading }: { filled: number; uploading: boolean }) {
  const close = useModalClose();
  return (
    <button onClick={close} disabled={uploading} className="btn btn-primary">
      {uploading ? "Uploading…" : filled > 0 ? `Save ${plural(filled, "card")}` : "Close"}
    </button>
  );
}
