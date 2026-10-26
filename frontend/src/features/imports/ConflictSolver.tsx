import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import type { AcademicItem, CalendarEvent, ImportConflict, ItemChoice, ItemDecision } from "../../types";
import { dayKey, eventEntry, itemEntry } from "../calendar/entries";
import MonthGrid, { groupByDay } from "../calendar/MonthGrid";

const PAD = 3;
const MARGIN = 16;

function kindLabel(kind: "ITEM" | "EVENT", type: string | null): string {
  if (kind === "EVENT") return "Event";
  return type === "EXAM" ? "Exam" : "Assignment";
}

function toDecisions(conflicts: ImportConflict[], choices: ItemChoice[]): ItemDecision[] {
  return conflicts.map((c, i) => {
    const choice = choices[i] ?? "ADD";
    return {
      key: c.itemKey,
      decision: choice,
      existingId: choice === "REPLACE" ? c.existing.id : null,
      existingKind: choice === "REPLACE" ? c.existing.kind : null,
    };
  });
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function ConflictSolver({
  conflicts,
  providerName,
  busy,
  onDone,
  onCancel,
}: {
  conflicts: ImportConflict[];
  providerName: string;
  busy: boolean;
  onDone: (decisions: ItemDecision[]) => void;
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<ItemChoice[]>([]);
  const [cell, setCell] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [animate, setAnimate] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const conflict = conflicts[index];
  const due = new Date(conflict.existing.dueAt);
  const monthKey = `${due.getFullYear()}-${due.getMonth()}`;
  const month = useMemo(() => new Date(due.getFullYear(), due.getMonth(), 1), [monthKey]);
  const highlightDay = dayKey(conflict.existing.dueAt);
  const compact = viewport.w < 640;

  const { from, to } = useMemo(
    () => ({
      from: new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
      to: new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(),
    }),
    [month],
  );
  const range = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const { data: items } = useQuery({
    queryKey: ["calendar", from, to],
    queryFn: () => api.get<AcademicItem[]>(`/calendar?${range}`),
  });
  const { data: events } = useQuery({
    queryKey: ["calendar-events", from, to],
    queryFn: () => api.get<CalendarEvent[]>(`/calendar/events?${range}`),
  });

  const byDay = useMemo(
    () =>
      groupByDay(
        [...(items ?? []).map(itemEntry), ...(events ?? []).map(eventEntry)].sort(
          (a, b) => new Date(a.when).getTime() - new Date(b.when).getTime(),
        ),
      ),
    [items, events],
  );

  const label = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  useLayoutEffect(() => {
    setAnimate(true);
    const t = window.setTimeout(() => setAnimate(false), 500);
    return () => window.clearTimeout(t);
  }, [index]);

  useLayoutEffect(() => {
    if (cell) cell.scrollIntoView({ block: "center", behavior: "auto" });
  }, [cell, index]);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      if (cell) {
        const r = cell.getBoundingClientRect();
        const next = {
          x: Math.max(2, r.left - PAD),
          y: r.top - PAD,
          w: Math.min(window.innerWidth - 4, r.width + PAD * 2),
          h: r.height + PAD * 2,
        };
        setBox((prev) =>
          prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next,
        );
      }
      const ch = cardRef.current?.offsetHeight ?? 0;
      setCardHeight((prev) => (prev === ch ? prev : ch));
      setViewport((prev) =>
        prev.w === window.innerWidth && prev.h === window.innerHeight
          ? prev
          : { w: window.innerWidth, h: window.innerHeight },
      );
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    return () => window.cancelAnimationFrame(frame);
  }, [cell]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  function decide(choice: ItemChoice) {
    if (busy) return;
    const next = [...choices.slice(0, index), choice];
    setChoices(next);
    if (index === conflicts.length - 1) {
      onDone(toDecisions(conflicts, next));
      return;
    }
    setIndex(index + 1);
  }

  function back() {
    if (busy || index === 0) return;
    setChoices(choices.slice(0, index - 1));
    setIndex(index - 1);
  }

  const overlapsTop =
    box != null && box.y < MARGIN + cardHeight + 12 && box.y + box.h > MARGIN - 12;
  const cardTop = overlapsTop ? Math.max(MARGIN, viewport.h - cardHeight - MARGIN) : MARGIN;
  const code = conflict.existing.courseCode || conflict.existing.courseName;
  const transition = animate ? "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)" : "none";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-fg">{label}</h1>
      <MonthGrid
        month={month}
        byDay={byDay}
        highlightDay={highlightDay}
        highlightRef={setCell}
        compact={compact}
      />
      {createPortal(
        <div
          className="fixed inset-0 z-[110]"
          role="dialog"
          aria-modal="true"
          aria-label="Deadline already exists"
        >
          {box ? (
            <>
              <span
                aria-hidden
                className="pointer-events-none absolute rounded-lg"
                style={{
                  left: box.x,
                  top: box.y,
                  width: box.w,
                  height: box.h,
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
                  transition,
                }}
              />
              <span
                aria-hidden
                className="tour-ring pointer-events-none absolute rounded-lg"
                style={{ left: box.x, top: box.y, width: box.w, height: box.h, transition }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-black/55" />
          )}
          <div
            ref={cardRef}
            className="glass fixed inset-x-4 mx-auto max-w-xl rounded-2xl p-4 shadow-xl"
            style={{ top: cardTop, transition: animate ? "top 0.4s ease" : "none" }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                Conflict {index + 1} of {conflicts.length}
              </p>
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="text-[12px] font-medium text-fg-3 hover:text-fg disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
            <h2 className="mt-1 text-[15px] font-semibold leading-snug text-fg">
              &ldquo;{conflict.existing.title}&rdquo; for {code} already exists.
            </h2>
            <dl className="mt-2.5 space-y-1.5 text-[12px] text-fg-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <dt className="w-24 shrink-0 font-medium text-fg-3">Yours</dt>
                <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="badge badge-muted">
                    {kindLabel(conflict.existing.kind, conflict.existing.type)}
                  </span>
                  <span className="tabular-nums">{formatDateTime(conflict.existing.dueAt)}</span>
                </dd>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <dt className="w-24 shrink-0 font-medium text-fg-3">From {providerName}</dt>
                <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="badge badge-accent">
                    {kindLabel(conflict.incoming.kind, conflict.incoming.type)}
                  </span>
                  <span className="tabular-nums">{formatDateTime(conflict.incoming.dueAt)}</span>
                  {conflict.incoming.title !== conflict.existing.title && (
                    <span className="truncate text-fg-3">&ldquo;{conflict.incoming.title}&rdquo;</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={back}
                disabled={busy || index === 0}
                aria-label="Undo previous choice"
                className="btn btn-ghost px-2.5"
              >
                <ArrowLeft size={14} />
              </button>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => decide("ADD")}>
                  Add anyways
                </button>
                <button
                  type="button"
                  className="btn btn-checkin"
                  disabled={busy}
                  onClick={() => decide("REPLACE")}
                  autoFocus
                >
                  {busy ? "Adding…" : "Replace"}
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => decide("SKIP")}>
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
