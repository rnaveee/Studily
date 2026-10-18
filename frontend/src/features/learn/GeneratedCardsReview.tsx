import { useState, type ReactNode } from "react";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import { SideField, cardIsComplete } from "./CardEditor";
import type { Flashcard, GeneratedDeck } from "../../types";

interface Row {
  id: number;
  include: boolean;
  front: string;
  back: string;
  frontImage: string | null;
  backImage: string | null;
  source: string | null;
  duplicate: boolean;
}

function toRows(deck: GeneratedDeck): Row[] {
  return deck.cards.map((card, i) => ({
    id: i,
    include: !card.duplicate,
    front: card.front,
    back: card.back,
    frontImage: card.frontImage,
    backImage: card.backImage,
    source: [card.sourceLabel, card.sourceFile].filter(Boolean).join(" · ") || null,
    duplicate: card.duplicate,
  }));
}

export function chosenCount(rows: { include: boolean }[]): number {
  return rows.filter((r) => r.include).length;
}

export default function GeneratedCardsReview({
  deck,
  room,
  header,
  saving,
  confirmLabel,
  onConfirm,
  onBack,
  onChange,
}: {
  deck: GeneratedDeck;
  room: number;
  header?: ReactNode;
  saving: boolean;
  confirmLabel: (count: number) => string;
  onConfirm: (cards: Flashcard[]) => void;
  onBack: () => void;
  onChange?: (selected: number) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(deck));
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  function update(next: Row[]) {
    setRows(next);
    onChange?.(chosenCount(next));
  }

  function patch(id: number, change: Partial<Row>) {
    update(rows.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }

  const chosen = rows.filter((r) => r.include && cardIsComplete(r));
  const adding = chosen.slice(0, Math.max(0, room));
  const uploading = Object.values(busy).some(Boolean);
  const allOn = rows.length > 0 && rows.every((r) => r.include);

  function confirm() {
    onConfirm(
      adding.map((r) => ({
        front: r.front.trim(),
        back: r.back.trim(),
        frontImage: r.frontImage,
        backImage: r.backImage,
      })),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div
        className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[12px] leading-snug text-fg-2"
        style={{ background: "color-mix(in srgb, var(--accent) 9%, transparent)" }}
      >
        <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
        <span>
          <span className="font-semibold text-fg">Check these before you save.</span> AI can make mistakes, so
          compare each card with your notes. Untick or fix anything that's wrong.
        </span>
      </div>

      {deck.warnings.length > 0 && (
        <ul className="space-y-1">
          {deck.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-[12px] text-fg-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-yellow" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-fg-3 tabular-nums">
          {chosen.length} of {rows.length} selected
        </span>
        <button
          type="button"
          onClick={() => update(rows.map((r) => ({ ...r, include: !allOn })))}
          className="text-[12px] font-medium text-accent hover:underline"
        >
          {allOn ? "Select none" : "Select all"}
        </button>
      </div>

      <ol className="space-y-2.5">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="rounded-lg p-3 transition-opacity"
            style={{ background: "var(--surface-hi)", opacity: row.include ? 1 : 0.55 }}
          >
            <div className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={row.include}
                onChange={(e) => patch(row.id, { include: e.target.checked })}
                className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                aria-label={`Include card ${index + 1}`}
              />
              <span className="text-[12px] font-semibold text-fg-3 tabular-nums">{index + 1}</span>
              {row.source && <span className="badge badge-muted truncate">{row.source}</span>}
              {row.duplicate && <span className="badge badge-muted shrink-0">Already in set</span>}
              <button
                type="button"
                onClick={() => update(rows.filter((r) => r.id !== row.id))}
                className="ml-auto shrink-0 rounded p-1 text-fg-3 transition-colors hover:text-red"
                aria-label={`Remove card ${index + 1}`}
              >
                <X size={13} />
              </button>
            </div>
            <div className="space-y-2">
              <SideField
                label="Front"
                placeholder="Question or term"
                text={row.front}
                image={row.frontImage}
                uploading={!!busy[row.id * 2]}
                onText={(front) => patch(row.id, { front })}
                onImage={(frontImage) => patch(row.id, { frontImage })}
                onBusy={(b) => setBusy((m) => ({ ...m, [row.id * 2]: b }))}
              />
              <SideField
                label="Back"
                placeholder="Answer or definition"
                text={row.back}
                image={row.backImage}
                uploading={!!busy[row.id * 2 + 1]}
                onText={(back) => patch(row.id, { back })}
                onImage={(backImage) => patch(row.id, { backImage })}
                onBusy={(b) => setBusy((m) => ({ ...m, [row.id * 2 + 1]: b }))}
              />
            </div>
          </li>
        ))}
      </ol>

      {chosen.length > room && (
        <p className="text-[12px] text-fg-2">
          {room <= 0
            ? "This set is full at 500 cards. Make a new set for these instead."
            : `Sets hold up to 500 cards, so only the first ${room} ticked cards will be added.`}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onBack} className="btn btn-ghost" disabled={saving}>
          Discard
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={adding.length === 0 || saving || uploading}
          className="btn btn-primary"
        >
          {saving ? "Saving…" : uploading ? "Uploading…" : confirmLabel(adding.length)}
        </button>
      </div>
    </div>
  );
}
