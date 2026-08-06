import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight, Plus, X } from "lucide-react";
import { api } from "../../lib/api";
import { formatTime } from "../../lib/format";
import type {
  AcademicItem,
  AcademicItemRequest,
  CalendarEvent,
  CalendarEventRequest,
  Course,
  ItemType,
} from "../../types";
import CategorySelect from "./CategorySelect";
import type { Entry } from "./entries";

type Kind = ItemType | "EVENT";

export default function DayModal({
  date,
  entries,
  onSelectEntry,
  onClose,
}: {
  date: string;
  entries: Entry[];
  onSelectEntry: (entry: Entry) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("ASSIGNMENT");
  const [title, setTitle] = useState("");
  const [whens, setWhens] = useState<string[]>([`${date}T23:59`]);
  const [weight, setWeight] = useState("");
  const [place, setPlace] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
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
    mutationFn: ({ cid, reqs }: { cid: number; reqs: AcademicItemRequest[] }) =>
      Promise.all(reqs.map((req) => api.post<AcademicItem>(`/courses/${cid}/items`, req))),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  const createEvent = useMutation({
    mutationFn: (reqs: CalendarEventRequest[]) =>
      Promise.all(reqs.map((req) => api.post<CalendarEvent>("/calendar/events", req))),
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
    if (whens.some((w) => !w)) {
      setError("Pick a date and time for every entry");
      return;
    }
    if (isEvent) {
      createEvent.mutate(
        whens.map((w) => ({
          title: title.trim(),
          place: place.trim() || null,
          categoryId,
          startAt: new Date(w).toISOString(),
        })),
      );
      return;
    }
    if (!courseId) {
      setError("Select a course");
      return;
    }
    createItem.mutate({
      cid: courseId,
      reqs: whens.map((w) => ({
        type: kind,
        title: title.trim(),
        dueAt: new Date(w).toISOString(),
        weight: weight ? Number(weight) : undefined,
        status: "TODO",
      })),
    });
  }

  const dateLabel = new Date(`${date}T12:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-[90] flex overflow-y-auto overscroll-contain p-4"
      style={{ background: "rgba(0,0,0,0.45)", height: "var(--app-height, 100%)" }}
      onClick={onClose}
    >
      <div
        className="card m-auto flex w-full max-w-sm flex-col shadow-xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">{dateLabel}</h2>
            <p className="mt-0.5 text-[13px] text-fg-2">
              {entries.length === 0
                ? "Nothing due"
                : `${entries.length} due ${entries.length === 1 ? "date" : "dates"}`}
            </p>
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

        {entries.length > 0 && (
          <ul className="border-y border-line">
            {entries.map((en) => (
              <li key={en.key}>
                <button
                  type="button"
                  onClick={() => onSelectEntry(en)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-hi"
                >
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ background: en.accent }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium leading-snug text-fg">
                      {en.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-fg-3">
                      {[formatTime(en.when), en.subtitle, en.place].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <ChevronRight size={14} className="shrink-0 text-fg-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4 p-5">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">
            Add to calendar
          </h3>

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
              No courses yet.{" "}
              <Link to="/courses" className="text-accent transition-colors hover:text-accent-2">
                Add one first
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
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
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
                />
              </div>

              {isEvent && (
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

              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <label className="field-label">{isEvent ? "Date & time" : "Due date & time"}</label>
                  <div className="space-y-2">
                    {whens.map((w, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          className="input"
                          type="datetime-local"
                          value={w}
                          onChange={(e) =>
                            setWhens(whens.map((prev, j) => (j === i ? e.target.value : prev)))
                          }
                          required
                        />
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => setWhens(whens.filter((_, j) => j !== i))}
                            className="shrink-0 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
                            aria-label="Remove date"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setWhens([...whens, `${date}T23:59`])}
                    className="mt-2 flex items-center gap-1 text-[12px] font-medium text-accent transition-colors hover:text-accent-2"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                    Add another date
                  </button>
                </div>
                {!isEvent && (
                  <div className="w-[4.5rem] shrink-0">
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
      </div>
    </div>,
    document.body,
  );
}
