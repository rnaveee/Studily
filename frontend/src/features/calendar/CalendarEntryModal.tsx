import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Pencil, Repeat, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime, toLocalInput } from "../../lib/format";
import { useConfirm } from "../../lib/confirm";
import { describeRule } from "../../lib/recurrence";
import type {
  AcademicItem,
  AcademicItemRequest,
  CalendarEvent,
  CalendarEventRequest,
  ItemType,
  SeriesScope,
} from "../../types";
import CategorySelect from "../../components/CategorySelect";
import DateTimeSelect from "../../components/DateTimeSelect";
import Modal from "../../components/Modal";

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
  const [categoryId, setCategoryId] = useState<number | null>(event?.categoryId ?? null);
  const [scope, setScope] = useState<SeriesScope>("OCCURRENCE");
  const [error, setError] = useState<string | null>(null);

  const seriesId = item?.seriesId ?? event?.seriesId ?? null;
  const seriesLabel = describeRule(item?.recurrenceRule ?? event?.recurrenceRule);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["calendar-events"] });
    qc.invalidateQueries({ queryKey: ["semesters"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const saveItem = useMutation({
    mutationFn: (req: AcademicItemRequest) =>
      api.put<AcademicItem>(`/items/${item!.id}?scope=${scope}`, req),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  const saveEvent = useMutation({
    mutationFn: (req: CalendarEventRequest) =>
      api.put<CalendarEvent>(`/calendar/events/${event!.id}?scope=${scope}`, req),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  const deleteEvent = useMutation({
    mutationFn: () => api.del(`/calendar/events/${event!.id}?scope=${scope}`),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  const deleteItem = useMutation({
    mutationFn: () => api.del(`/items/${item!.id}?scope=${scope}`),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  const busy = saveItem.isPending || saveEvent.isPending
    || deleteEvent.isPending || deleteItem.isPending;
  const color = event
    ? (event.categoryColor ?? "var(--accent)")
    : item?.type === "EXAM"
      ? "var(--red)"
      : "var(--green)";
  const badge = event
    ? (event.categoryName ?? "Event")
    : item?.type === "EXAM"
      ? "Exam"
      : "Assignment";

  async function handleDelete() {
    const name = event?.title ?? item!.title;
    const all = seriesId != null && scope === "SERIES";
    const ok = await confirm({
      title: all ? "Delete every occurrence?" : `Delete ${event ? "event" : "item"}?`,
      message: all
        ? `Every occurrence of "${name}" will be removed.`
        : `"${name}" will be removed from your calendar.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    if (event) deleteEvent.mutate();
    else deleteItem.mutate();
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
        categoryId,
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
      score: item!.score,
      maxScore: item!.maxScore,
      status: item!.status,
    });
  }

  return (
    <Modal
      onClose={onClose}
      title={
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
          style={{ backgroundColor: color }}
        >
          {badge}
        </span>
      }
    >

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
              {event?.categoryName && (
                <div className="flex justify-between gap-3">
                  <span className="text-fg-3">Category</span>
                  <span className="flex items-center gap-1.5 truncate font-medium text-fg">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: event.categoryColor ?? "var(--accent)" }}
                    />
                    {event.categoryName}
                  </span>
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

            {seriesId && <ScopeChoice label={seriesLabel} scope={scope} onChange={setScope} />}

            {error && <p className="text-xs text-red animate-fade">{error}</p>}

            <div className="flex items-center justify-end gap-2">
              {(event || item) && (
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
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <label className="field-label">Type</label>
                  <select className="input" value={kind} onChange={(e) => setKind(e.target.value as ItemType)}>
                    <option value="ASSIGNMENT">Assignment</option>
                    <option value="EXAM">Exam</option>
                  </select>
                </div>
                <div className="w-[5.5rem] shrink-0">
                  <label className="field-label">Weight %</label>
                  <input
                    className="input !px-2"
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    min={0}
                    max={100}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="field-label">{event ? "Event title" : "Title"}</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            {event && (
              <>
                <div>
                  <label className="field-label">Place</label>
                  <input
                    className="input"
                    placeholder="e.g. Library room 204"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                  />
                </div>
                <CategorySelect value={categoryId} onChange={setCategoryId} />
              </>
            )}

            <div>
              <label className="field-label">{event ? "Date & time" : "Due date & time"}</label>
              <DateTimeSelect value={when} onChange={setWhen} required />
            </div>

            {seriesId && <ScopeChoice label={seriesLabel} scope={scope} onChange={setScope} />}

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
    </Modal>
  );
}

function ScopeChoice({
  label,
  scope,
  onChange,
}: {
  label: string | null;
  scope: SeriesScope;
  onChange: (scope: SeriesScope) => void;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-accent">
        <Repeat size={12} strokeWidth={2} />
        {label ?? "Part of a repeating series"}
      </div>
      <div className="mt-2 flex flex-col gap-1 text-[13px] text-fg-2">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={scope === "OCCURRENCE"}
            onChange={() => onChange("OCCURRENCE")}
          />
          This occurrence only
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={scope === "SERIES"}
            onChange={() => onChange("SERIES")}
          />
          All occurrences
        </label>
      </div>
    </div>
  );
}
