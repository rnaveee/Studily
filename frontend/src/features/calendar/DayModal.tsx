import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight, Plus, X } from "lucide-react";
import { api } from "../../lib/api";
import { formatTime } from "../../lib/format";
import DateTimeSelect from "../../components/DateTimeSelect";
import Modal from "../../components/Modal";
import type {
  AcademicItem,
  AcademicItemRequest,
  CalendarEvent,
  CalendarEventRequest,
  Course,
  ItemType,
  Recurrence,
} from "../../types";
import CategorySelect from "../../components/CategorySelect";
import RepeatPicker from "./RepeatPicker";
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
  const [repeat, setRepeat] = useState<Recurrence | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const dates = repeat ? whens.slice(0, 1) : whens;
      createEvent.mutate(
        dates.map((w) => ({
          title: title.trim(),
          place: place.trim() || null,
          categoryId,
          startAt: new Date(w).toISOString(),
          recurrence: repeat,
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
      reqs: (repeat ? whens.slice(0, 1) : whens).map((w) => ({
        type: kind,
        title: title.trim(),
        dueAt: new Date(w).toISOString(),
        weight: weight ? Number(weight) : undefined,
        status: "TODO",
        recurrence: repeat,
      })),
    });
  }

  const dateLabel = new Date(`${date}T12:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Modal
      onClose={onClose}
      padded={false}
      title={
        <div>
          <h2 className="text-[15px] font-semibold text-fg">{dateLabel}</h2>
          <p className="mt-0.5 text-[13px] text-fg-2">
            {entries.length === 0
              ? "Nothing due"
              : `${entries.length} due ${entries.length === 1 ? "date" : "dates"}`}
          </p>
        </div>
      }
    >

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

          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <label className="field-label">Type</label>
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option value="ASSIGNMENT">Assignment</option>
                <option value="EXAM">Exam</option>
                <option value="EVENT">Event</option>
              </select>
            </div>
            {!isEvent && (
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
            )}
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

              <div>
                <label className="field-label">{isEvent ? "Date & time" : "Due date & time"}</label>
                <div className="space-y-2">
                  {(repeat ? whens.slice(0, 1) : whens).map((w, i) => (
                    <div key={i}>
                      {i > 0 && (
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-fg-3">Date {i + 1}</span>
                          <button
                            type="button"
                            onClick={() => setWhens(whens.filter((_, j) => j !== i))}
                            className="-mr-1 rounded-lg p-1 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
                            aria-label={`Remove date ${i + 1}`}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )}
                      <DateTimeSelect
                        value={w}
                        onChange={(v) => setWhens(whens.map((prev, j) => (j === i ? v : prev)))}
                        required
                      />
                    </div>
                  ))}
                </div>
                {!repeat && (
                  <button
                    type="button"
                    onClick={() => setWhens([...whens, `${date}T23:59`])}
                    className="mt-2 flex items-center gap-1 text-[12px] font-medium text-accent transition-colors hover:text-accent-2"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                    Add another date
                  </button>
                )}
              </div>

              <RepeatPicker
                startLocal={whens[0]}
                weight={isEvent ? undefined : weight}
                onChange={setRepeat}
              />

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
    </Modal>
  );
}
