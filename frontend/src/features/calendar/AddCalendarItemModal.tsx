import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { api } from "../../lib/api";
import type {
  AcademicItem,
  AcademicItemRequest,
  CalendarEvent,
  CalendarEventRequest,
  Course,
  ItemType,
} from "../../types";

type Kind = ItemType | "EVENT";

export default function AddCalendarItemModal({ date, onClose }: { date: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("ASSIGNMENT");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(`${date}T23:59`);
  const [weight, setWeight] = useState("");
  const [place, setPlace] = useState("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  useEffect(() => {
    if (courseId === "" && courses && courses.length > 0) setCourseId(courses[0].id);
  }, [courses, courseId]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["calendar-events"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const createItem = useMutation({
    mutationFn: ({ cid, req }: { cid: number; req: AcademicItemRequest }) =>
      api.post<AcademicItem>(`/courses/${cid}/items`, req),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  const createEvent = useMutation({
    mutationFn: (req: CalendarEventRequest) => api.post<CalendarEvent>("/calendar/events", req),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  const isEvent = kind === "EVENT";
  const busy = createItem.isPending || createEvent.isPending;
  const needsCourse = !isEvent && (courses ?? []).length === 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!when) {
      setError("Pick a date and time");
      return;
    }
    if (isEvent) {
      createEvent.mutate({
        title: title.trim(),
        place: place.trim() || null,
        startAt: new Date(when).toISOString(),
      });
      return;
    }
    if (!courseId) {
      setError("Select a course");
      return;
    }
    createItem.mutate({
      cid: courseId,
      req: {
        type: kind,
        title: title.trim(),
        dueAt: new Date(when).toISOString(),
        weight: weight ? Number(weight) : undefined,
        status: "TODO",
      },
    });
  }

  const dateLabel = new Date(`${date}T12:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="card flex w-full max-w-sm flex-col gap-4 p-5 shadow-xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Add to calendar</h2>
            <p className="mt-1 text-[13px] text-fg-2">{dateLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div>
          <label className="field-label">Type</label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="ASSIGNMENT">Assignment</option>
            <option value="EXAM">Exam</option>
            <option value="EVENT">Event</option>
          </select>
        </div>

        {needsCourse ? (
          <p className="text-[13px] text-fg-3">
            No courses yet —{" "}
            <Link to="/courses" className="text-accent hover:text-accent-2 transition-colors">
              add one first
            </Link>
            .
          </p>
        ) : (
          <>
            {!isEvent && (
              <div>
                <label className="field-label">Course</label>
                <select
                  className="input"
                  value={courseId}
                  onChange={(e) => setCourseId(Number(e.target.value))}
                  required
                >
                  <option value="">Select course…</option>
                  {(courses ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="field-label">{isEvent ? "Event title" : "Title"}</label>
              <input
                className="input"
                placeholder={isEvent ? "e.g. Study group" : "e.g. Midterm 1"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            {isEvent && (
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
                <label className="field-label">{isEvent ? "Date & time" : "Due date & time"}</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  required
                />
              </div>
              {!isEvent && (
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
              <button type="button" onClick={onClose} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn btn-primary">
                <Plus size={13} strokeWidth={2} />
                {busy ? "Adding…" : "Add"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>,
    document.body,
  );
}
