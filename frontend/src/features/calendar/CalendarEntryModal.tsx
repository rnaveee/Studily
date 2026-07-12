import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Pencil, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { useConfirm } from "../../lib/confirm";
import type {
  AcademicItem,
  AcademicItemRequest,
  CalendarEvent,
  CalendarEventRequest,
  ItemType,
} from "../../types";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CalendarEntryModal({
  item,
  event,
  onClose,
}: {
  item?: AcademicItem;
  event?: CalendarEvent;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item?.title ?? event?.title ?? "");
  const [kind, setKind] = useState<ItemType>(item?.type ?? "ASSIGNMENT");
  const [when, setWhen] = useState(() => toLocalInput(item?.dueAt ?? event?.startAt ?? new Date().toISOString()));
  const [weight, setWeight] = useState(item?.weight != null ? String(item.weight) : "");
  const [place, setPlace] = useState(event?.place ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["calendar-events"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const saveItem = useMutation({
    mutationFn: (req: AcademicItemRequest) => api.put<AcademicItem>(`/items/${item!.id}`, req),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  const saveEvent = useMutation({
    mutationFn: (req: CalendarEventRequest) => api.put<CalendarEvent>(`/calendar/events/${event!.id}`, req),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  const deleteEvent = useMutation({
    mutationFn: () => api.del(`/calendar/events/${event!.id}`),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  const busy = saveItem.isPending || saveEvent.isPending || deleteEvent.isPending;
  const color = event ? "var(--accent)" : item?.type === "EXAM" ? "var(--red)" : "var(--green)";
  const badge = event ? "Event" : item?.type === "EXAM" ? "Exam" : "Assignment";

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete event?",
      message: `"${event!.title}" will be removed from your calendar.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) deleteEvent.mutate();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!when) {
      setError("Pick a date and time");
      return;
    }
    if (event) {
      saveEvent.mutate({
        title: title.trim(),
        place: place.trim() || null,
        startAt: new Date(when).toISOString(),
      });
      return;
    }
    saveItem.mutate({
      type: kind,
      title: title.trim(),
      dueAt: new Date(when).toISOString(),
      location: item!.location ?? null,
      weight: weight ? Number(weight) : undefined,
      status: item!.status,
    });
  }

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-[90] flex overflow-y-auto overscroll-contain p-4"
      style={{ background: "rgba(0,0,0,0.45)", height: "var(--app-height, 100%)" }}
      onClick={onClose}
    >
      <div
        className="card m-auto flex w-full max-w-sm flex-col gap-4 p-5 shadow-xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
            style={{ backgroundColor: color }}
          >
            {badge}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {!editing ? (
          <>
            <div>
              <h2 className="text-[17px] font-semibold leading-snug text-fg">
                {item?.title ?? event?.title}
              </h2>
              <p className="mt-1 text-[13px] text-fg-2">
                {formatDateTime(item?.dueAt ?? event!.startAt)}
              </p>
            </div>

            <div className="space-y-2 text-[13px]">
              {item && (
                <div className="flex justify-between gap-3">
                  <span className="text-fg-3">Course</span>
                  <Link
                    to={`/courses/${item.courseId}`}
                    className="truncate font-medium text-accent transition-colors hover:text-accent-2"
                  >
                    {item.courseName}
                  </Link>
                </div>
              )}
              {event?.place && (
                <div className="flex justify-between gap-3">
                  <span className="text-fg-3">Place</span>
                  <span className="truncate font-medium text-fg">{event.place}</span>
                </div>
              )}
              {item?.location && (
                <div className="flex justify-between gap-3">
                  <span className="text-fg-3">Location</span>
                  <span className="truncate font-medium text-fg">{item.location}</span>
                </div>
              )}
              {item?.weight != null && (
                <div className="flex justify-between gap-3">
                  <span className="text-fg-3">Weight</span>
                  <span className="font-medium text-fg">{item.weight}%</span>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red animate-fade">{error}</p>}

            <div className="flex items-center justify-end gap-2">
              {event && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="btn btn-ghost mr-auto text-red"
                >
                  <Trash2 size={13} strokeWidth={2} />
                  Delete
                </button>
              )}
              <button type="button" onClick={onClose} className="btn btn-ghost">
                Close
              </button>
              <button type="button" onClick={() => setEditing(true)} className="btn btn-primary">
                <Pencil size={13} strokeWidth={2} />
                Edit
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={submit}
            className="flex flex-col gap-4"
            onFocus={(e) => {
              const el = e.target;
              window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 350);
            }}
          >
            {item && (
              <div>
                <label className="field-label">Type</label>
                <select className="input" value={kind} onChange={(e) => setKind(e.target.value as ItemType)}>
                  <option value="ASSIGNMENT">Assignment</option>
                  <option value="EXAM">Exam</option>
                </select>
              </div>
            )}

            <div>
              <label className="field-label">{event ? "Event title" : "Title"}</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            {event && (
              <div>
                <label className="field-label">Place</label>
                <input
                  className="input"
                  placeholder="e.g. Library room 204"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="field-label">{event ? "Date & time" : "Due date & time"}</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  required
                />
              </div>
              {item && (
                <div className="w-24">
                  <label className="field-label">Weight %</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="—"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    min={0}
                    max={100}
                  />
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red animate-fade">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn btn-primary">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
