import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Sparkles } from "lucide-react";
import SegmentedToggle from "../../components/SegmentedToggle";
import { useRequireAuth } from "../../lib/auth";
import { useWelcomeTourStep } from "../../lib/welcomeTour";
import { TOUR_STEPS } from "../welcome/WelcomeTour";
import CardEditor, { cardIsComplete, EMPTY_CARD, type CardDraft } from "./CardEditor";
import DocumentGenerator from "./DocumentGenerator";
import GenerateCardsModal from "./GenerateCardsModal";
import ImportCardsPanel from "./ImportCardsPanel";
import { MAX_CARDS_PER_SET } from "./quizletImport";
import type { FlashcardSet, GeneratedDeck } from "../../types";

type Tab = "card" | "import" | "documents";

const RADIUS = 12;
const DURATION = 520;
const FADE = 180;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function frames(W: number, H: number, bw: number, bh: number, reverse = false) {
  const steps = [
    `inset(0px ${W - bw}px ${H - bh}px 0px round ${RADIUS}px)`,
    `inset(0px ${W - bw}px 0px 0px round ${RADIUS}px)`,
    `inset(0px 0px 0px 0px round ${RADIUS}px)`,
  ];
  if (reverse) steps.reverse();
  return steps.map((clipPath, i) => ({ clipPath, offset: i / 2, easing: EASING }));
}

export default function AddCardsPanel({
  set,
  onAddCard,
  onNeedImages,
}: {
  set: FlashcardSet;
  onAddCard: (card: CardDraft) => void;
  onNeedImages: () => void;
}) {
  const requireAuth = useRequireAuth();
  const [open, setOpen] = useState(set.cards.length === 0);
  const [tab, setTab] = useState<Tab>("card");
  const [draft, setDraft] = useState<CardDraft>(EMPTY_CARD);
  const [draftUploading, setDraftUploading] = useState(false);
  const [reviewDeck, setReviewDeck] = useState<GeneratedDeck | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const animating = useRef(false);
  const justOpened = useRef(false);

  const tourStep = useWelcomeTourStep();
  const tourWantsImport =
    tourStep !== null && TOUR_STEPS[Math.min(tourStep, TOUR_STEPS.length - 1)]?.target === "quizlet-import";

  useEffect(() => {
    if (!tourWantsImport) return;
    setOpen(true);
    setTab("import");
  }, [tourWantsImport]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    const content = contentRef.current;
    if (!open || !el || !content || !justOpened.current) return;
    justOpened.current = false;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const { w: bw, h: bh } = size.current;
    if (reducedMotion() || !bw || !bh || typeof el.animate !== "function") return;
    animating.current = true;
    el.animate(frames(el.offsetWidth, el.offsetHeight, bw, bh), { duration: DURATION });
    const fade = content.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: FADE,
      delay: DURATION,
      easing: "ease-out",
      fill: "backwards",
    });
    const done = () => {
      animating.current = false;
    };
    fade.finished.then(done, done);
  }, [open]);

  function expand() {
    if (animating.current) return;
    const btn = buttonRef.current;
    if (btn) size.current = { w: btn.offsetWidth, h: btn.offsetHeight };
    justOpened.current = true;
    setOpen(true);
  }

  function collapse() {
    if (animating.current) return;
    const el = cardRef.current;
    const content = contentRef.current;
    if (!el || !content || reducedMotion() || typeof el.animate !== "function") {
      setOpen(false);
      return;
    }
    const bw = size.current.w || 110;
    const bh = size.current.h || 36;
    animating.current = true;
    content.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: "ease-in", fill: "forwards" });
    const anim = el.animate(frames(el.offsetWidth, el.offsetHeight, bw, bh, true), {
      duration: DURATION,
      delay: FADE,
      fill: "forwards",
    });
    const done = () => {
      animating.current = false;
      setOpen(false);
    };
    anim.finished.then(done, done);
  }

  function submit() {
    if (!cardIsComplete(draft)) return;
    onAddCard(draft);
    setDraft(EMPTY_CARD);
  }

  if (!open) {
    return (
      <div>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={false}
          onClick={() => requireAuth(expand)}
          className="btn btn-ghost"
        >
          Add cards
          <ChevronDown size={13} />
        </button>
      </div>
    );
  }

  const full = set.cards.length >= MAX_CARDS_PER_SET;

  return (
    <div>
      <div ref={cardRef} className="card p-4">
        <div ref={contentRef} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-fg-3">Add cards</h2>
            <button
              type="button"
              aria-label="Hide add cards"
              aria-expanded
              onClick={collapse}
              className="rounded-lg p-1.5 text-fg-3 hover:bg-surface-hi hover:text-fg"
            >
              <ChevronUp size={13} />
            </button>
          </div>

          <SegmentedToggle<Tab>
            className="w-full"
            value={tab}
            onChange={setTab}
            options={[
              { value: "card", label: "Card" },
              { value: "import", label: "Import" },
              {
                value: "documents",
                label: (
                  <span className="inline-flex items-center gap-1">
                    Documents <Sparkles size={12} />
                  </span>
                ),
              },
            ]}
          />

          {tab === "card" && (
            <>
              <p className="text-[12px] text-fg-3">Paste or drop an image into either side, or tap the picture button.</p>
              <CardEditor
                value={draft}
                onChange={setDraft}
                onUploadingChange={setDraftUploading}
                onSubmit={submit}
                footer={
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!cardIsComplete(draft) || draftUploading}
                      className="btn btn-primary"
                    >
                      <Plus size={13} />
                      Add card
                    </button>
                  </div>
                }
              />
            </>
          )}

          {tab === "import" && (
            <div data-tour="quizlet-import">
              <ImportCardsPanel set={set} onAdded={(n) => n > 0 && onNeedImages()} />
            </div>
          )}

          {tab === "documents" &&
            (full ? (
              <p className="text-[13px] text-fg-2">This set is full at 500 cards. Make a new set for more cards.</p>
            ) : (
              <DocumentGenerator setId={set.id} allowText onGenerated={setReviewDeck} />
            ))}

          {reviewDeck && <GenerateCardsModal set={set} initialDeck={reviewDeck} onClose={() => setReviewDeck(null)} />}
        </div>
      </div>
    </div>
  );
}
