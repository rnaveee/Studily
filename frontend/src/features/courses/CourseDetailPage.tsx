import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import {
  type AcademicItem,
  type AcademicItemRequest,
  type Course,
  type CourseRequest,
  type ItemStatus,
  type Note,
  type PublicUser,
} from "../../types";
import { formatDate, formatDateTime, hhmm } from "../../lib/format";
import {
  courseGrade,
  formatPercent,
  formatScore,
  gradeColor,
  itemPercent,
  neededOnRemaining,
  parseScoreInput,
} from "../../lib/grades";
import Avatar from "../../components/Avatar";
import CourseForm from "./CourseForm";
import ItemForm from "../../components/ItemForm";

const STATUSES: ItemStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const STATUS_LABEL: Record<ItemStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export default function CourseDetailPage() {
  const { id } = useParams();
  const courseId = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);

  const courseQ = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.get<Course>(`/courses/${courseId}`),
  });
  const itemsQ = useQuery({
    queryKey: ["course", courseId, "items"],
    queryFn: () => api.get<AcademicItem[]>(`/courses/${courseId}/items`),
  });
  const notesQ = useQuery({
    queryKey: ["course", courseId, "notes"],
    queryFn: () => api.get<Note[]>(`/courses/${courseId}/notes`),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["course", courseId] });
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["semesters"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const updateCourse = useMutation({
    mutationFn: (req: CourseRequest) => api.put<Course>(`/courses/${courseId}`, req),
    onSuccess: () => { invalidateAll(); setEditing(false); },
  });
  const deleteCourse = useMutation({
    mutationFn: () => api.del<void>(`/courses/${courseId}`),
    onSuccess: () => { invalidateAll(); navigate("/courses"); toast.success("Course deleted"); },
  });

  if (courseQ.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-3">
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
        Loading…
      </div>
    );
  }
  if (courseQ.error || !courseQ.data) {
    return <p className="text-sm text-red">Course not found.</p>;
  }
  const course = courseQ.data;

  return (
    <div className="space-y-6 animate-in">
      {editing ? (
        <CourseForm
          submitLabel="Save changes"
          initial={{
            name: course.name,
            semesterId: course.semesterId ?? null,
            code: course.code ?? undefined,
            professor: course.professor ?? undefined,
            location: course.location ?? undefined,
            color: course.color ?? undefined,
            meetingBlocks: course.meetingBlocks,
          }}
          onSubmit={(req) => updateCourse.mutateAsync(req)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="card p-5">
          <div className="flex items-start gap-2.5">
            <span
              className="mt-2 h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: course.color ?? "var(--accent)" }}
            />
            <h1 className="min-w-0 break-words text-xl font-semibold text-fg">{course.name}</h1>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {course.code && (
              <span className="rounded bg-surface-hi px-1.5 py-0.5 text-[11px] font-mono text-fg-3">
                {course.code}
              </span>
            )}
            <div className="ml-auto flex shrink-0 gap-1.5">
              <button onClick={() => setEditing(true)} className="btn btn-ghost">
                <Edit2 size={13} />
                Edit
              </button>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: `Delete ${course.name}?`,
                    message: "This permanently removes all its items and notes.",
                    confirmLabel: "Delete course",
                    danger: true,
                  });
                  if (ok) deleteCourse.mutate();
                }}
                className="btn btn-danger"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>

          {(course.professor || course.location) && (
            <p className="mt-2 text-[13px] text-fg-2">
              {[course.professor, course.location].filter(Boolean).join(" · ")}
            </p>
          )}
          {course.meetingBlocks.length > 0 && (
            <p className="mt-1.5 text-[12px] text-fg-3">
              {course.meetingBlocks
                .map((b) => `${b.dayOfWeek} ${hhmm(b.startTime)}–${hhmm(b.endTime)}`)
                .join("  ·  ")}
            </p>
          )}
        </div>
      )}

      <GradeCard items={itemsQ.data ?? []} />
      <ItemsSection courseId={courseId} items={itemsQ.data ?? []} onChange={invalidateAll} />
      <ClassmatesSection courseId={courseId} />
      <NotesSection courseId={courseId} notes={notesQ.data ?? []} />
    </div>
  );
}

function GradeCard({ items }: { items: AcademicItem[] }) {
  const [target, setTarget] = useState("80");
  const summary = courseGrade(items);

  if (items.length === 0) return null;

  if (summary.percent == null) {
    return (
      <div className="card p-4">
        <div className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Grade</div>
        <p className="mt-1.5 text-[13px] text-fg-2">
          Tap the score chip on any item below to enter what you got. Your grade updates as you go.
        </p>
      </div>
    );
  }

  const scale = Math.max(100, summary.totalWeight);
  const remaining = Math.max(0, scale - summary.gradedWeight);
  const targetValue = Number(target);
  const needed =
    summary.gradedWeight > 0 && remaining > 0.01 && Number.isFinite(targetValue)
      ? neededOnRemaining(summary, targetValue)
      : null;

  return (
    <div className="card p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Grade</div>
          <div
            className="mt-0.5 font-mono text-[30px] font-bold leading-none tabular-nums"
            style={{ color: gradeColor(summary.percent) }}
          >
            {formatPercent(summary.percent)}
          </div>
        </div>
        <div className="text-right text-[11px] text-fg-3">
          {summary.gradedCount} of {summary.itemCount} scored
          {summary.gradedWeight > 0 && (
            <div>{Math.round(summary.gradedWeight)}% of the course graded</div>
          )}
        </div>
      </div>

      {summary.gradedWeight > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-hi)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (summary.gradedWeight / scale) * 100)}%`,
              background: gradeColor(summary.percent),
            }}
          />
        </div>
      )}

      {needed != null && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-2">
          <span>To finish at</span>
          <input
            className="input py-0.5 text-center"
            style={{ width: "4.5rem", paddingLeft: 6, paddingRight: 6 }}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Target grade"
          />
          <span>
            you need{" "}
            {needed > 100 ? (
              <strong className="text-red">more than 100%</strong>
            ) : needed <= 0 ? (
              <strong className="text-green">nothing</strong>
            ) : (
              <strong style={{ color: gradeColor(needed) }}>{formatPercent(needed, 0)}</strong>
            )}{" "}
            on the remaining {Math.round(remaining)}%.
          </span>
        </div>
      )}

      {summary.gradedWeight === 0 && (
        <p className="mt-2 text-[12px] text-fg-3">
          Add a weight to each item for a weighted grade and projections.
        </p>
      )}
    </div>
  );
}

function ClassmatesSection({ courseId }: { courseId: number }) {
  const { user } = useAuth();

  const classmates = useQuery({
    queryKey: ["course", courseId, "classmates"],
    queryFn: () => api.get<PublicUser[]>(`/courses/${courseId}/classmates`),
    enabled: !!user?.emailVerified && Number.isFinite(courseId),
  });

  if (!classmates.data || classmates.data.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">
        Classmates in this course · {classmates.data.length}
      </h2>
      <ul className="card divide-y divide-line">
        {classmates.data.map((u) => (
          <li key={u.id}>
            <Link
              to={`/users/${u.id}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hi"
            >
              <Avatar name={u.name} username={u.username} avatarUrl={u.avatarUrl} size={30} className="text-[12px]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate text-[13px] font-medium text-fg">{u.name}</span>
                  <span className="truncate text-[12px] text-fg-3">@{u.username}</span>
                </div>
                {(u.major || u.year) && (
                  <div className="text-[11px] text-fg-3">
                    {[u.major, u.year ? `Year ${u.year}` : null].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ItemsSection({
  courseId,
  items,
  onChange,
}: {
  courseId: number;
  items: AcademicItem[];
  onChange: () => void;
}) {
  const qc = useQueryClient();
  const [show, setShow] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["course", courseId, "items"] });
    onChange();
  };

  const create = useMutation({
    mutationFn: (req: AcademicItemRequest) =>
      api.post<AcademicItem>(`/courses/${courseId}/items`, req),
    onSuccess: () => { refresh(); setShow(false); },
  });
  const update = useMutation({
    mutationFn: ({ itemId, req }: { itemId: number; req: AcademicItemRequest }) =>
      api.put<AcademicItem>(`/items/${itemId}`, req),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (itemId: number) => api.del<void>(`/items/${itemId}`),
    onSuccess: refresh,
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">
          Exams & assignments
        </h2>
        <button onClick={() => setShow((s) => !s)} className="btn btn-soft text-xs">
          <Plus size={12} />
          {show ? "Cancel" : "Add"}
        </button>
      </div>

      {show && (
        <ItemForm
          courseId={courseId}
          onSubmit={(_cid, req) => create.mutateAsync(req)}
          onCancel={() => setShow(false)}
        />
      )}

      {items.length === 0 ? (
        <p className="text-sm text-fg-3">No items yet.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              onUpdate={(req) => update.mutateAsync({ itemId: it.id, req })}
              onDelete={() => remove.mutate(it.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: AcademicItem;
  onUpdate: (req: AcademicItemRequest) => Promise<unknown>;
  onDelete: () => void;
}) {
  const [scoring, setScoring] = useState(false);
  const percent = itemPercent(item);

  const request = (changes: Partial<AcademicItemRequest>): AcademicItemRequest => ({
    type: item.type,
    title: item.title,
    dueAt: item.dueAt,
    location: item.location,
    weight: item.weight,
    score: item.score,
    maxScore: item.maxScore,
    status: item.status,
    ...changes,
  });

  return (
    <li className="px-4 py-2.5 text-[13px]">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: item.type === "EXAM" ? "var(--red)" : "var(--green)" }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-fg">{item.title}</div>
          <div className="truncate text-[11px] text-fg-3">
            {item.weight != null && `worth ${item.weight}% · `}
            {formatDateTime(item.dueAt)}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => setScoring((s) => !s)}
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold tabular-nums transition-colors"
          style={
            percent != null
              ? {
                  color: gradeColor(percent),
                  background: `color-mix(in srgb, ${gradeColor(percent)} 12%, transparent)`,
                }
              : { color: "var(--fg-3)", border: "1px dashed var(--line)" }
          }
          aria-label={percent != null ? "Edit score" : "Add score"}
        >
          {percent != null ? formatScore(item) : "Score"}
        </button>

        <select
          className="input shrink-0 py-0.5 text-xs"
          style={{ width: "auto", paddingLeft: 6, paddingRight: 6 }}
          value={item.status}
          onChange={(e) => onUpdate(request({ status: e.target.value as ItemStatus }))}
          aria-label="Status"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>

        <button
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-fg-3 transition-colors hover:text-red"
          aria-label="Delete item"
        >
          <X size={12} />
        </button>
        </div>
      </div>

      {scoring && (
        <ScoreEditor
          item={item}
          onCancel={() => setScoring(false)}
          onSave={async (score, maxScore) => {
            await onUpdate(
              request({
                score,
                maxScore,
                status: score != null && item.status !== "DONE" ? "DONE" : item.status,
              }),
            );
            setScoring(false);
          }}
        />
      )}
    </li>
  );
}

function ScoreEditor({
  item,
  onSave,
  onCancel,
}: {
  item: AcademicItem;
  onSave: (score: number | null, maxScore: number | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() =>
    item.score == null ? "" : item.maxScore === 100 ? String(item.score) : `${item.score}/${item.maxScore}`,
  );
  const [busy, setBusy] = useState(false);

  const empty = draft.trim() === "";
  const parsed = empty ? null : parseScoreInput(draft);
  const preview = parsed ? (parsed.score / parsed.maxScore) * 100 : null;

  async function save() {
    if (!empty && !parsed) return;
    setBusy(true);
    try {
      await onSave(parsed ? parsed.score : null, parsed ? parsed.maxScore : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 pl-4 animate-slide">
      <input
        className="input py-1"
        style={{ width: "5.5rem", paddingLeft: 8, paddingRight: 8 }}
        inputMode="decimal"
        autoFocus
        placeholder="17/20 or 85"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape") onCancel();
        }}
        aria-label={`Score for ${item.title}`}
      />

      <span className="min-w-[3.5rem] font-mono text-[12px] tabular-nums" style={{ color: preview != null ? gradeColor(preview) : "var(--fg-3)" }}>
        {preview != null ? formatPercent(preview) : empty ? "clears score" : "17/20 or 85"}
      </span>

      <button onClick={save} disabled={busy || (!empty && !parsed)} className="btn btn-primary py-1 text-xs">
        {busy ? "Saving…" : "Save"}
      </button>
      <button onClick={onCancel} className="btn btn-ghost py-1 text-xs">
        Cancel
      </button>
    </div>
  );
}

function NotesSection({ courseId, notes }: { courseId: number; notes: Note[] }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["course", courseId, "notes"] });

  const add = useMutation({
    mutationFn: () => api.post<Note>(`/courses/${courseId}/notes`, { body: body.trim() }),
    onSuccess: () => { setBody(""); refresh(); },
  });
  const remove = useMutation({
    mutationFn: (noteId: number) => api.del<void>(`/notes/${noteId}`),
    onSuccess: refresh,
  });

  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Notes</h2>

      <form
        onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(); }}
        className="flex gap-2"
      >
        <textarea
          className="input flex-1 resize-none"
          rows={2}
          placeholder="Add a note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="submit"
          disabled={add.isPending || !body.trim()}
          className="btn btn-primary self-end"
        >
          <Plus size={13} />
          Add
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-fg-3">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="card p-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="flex-1 whitespace-pre-wrap text-[13px] text-fg">{n.body}</p>
                <button
                  onClick={() => remove.mutate(n.id)}
                  className="shrink-0 rounded p-0.5 text-fg-3 transition-colors hover:text-red"
                >
                  <X size={13} />
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-fg-3">{formatDate(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
