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

          {course.professor && (
            <p className="mt-2 text-[13px] text-fg-2">{course.professor}</p>
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

      <ItemsSection courseId={courseId} items={itemsQ.data ?? []} onChange={invalidateAll} />
      <ClassmatesSection courseId={courseId} />
      <NotesSection courseId={courseId} notes={notesQ.data ?? []} />
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
            <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: it.type === "EXAM" ? "var(--red)" : "var(--green)" }}
                />
                <span className="min-w-0 truncate font-medium text-fg">{it.title}</span>
                <span className="shrink-0 whitespace-nowrap text-fg-3">{formatDateTime(it.dueAt)}</span>
                {it.weight != null && (
                  <span className="shrink-0 text-fg-3">{it.weight}%</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  className="input py-0.5 text-xs"
                  value={it.status}
                  onChange={(e) =>
                    update.mutate({
                      itemId: it.id,
                      req: {
                        type: it.type,
                        title: it.title,
                        dueAt: it.dueAt,
                        location: it.location,
                        weight: it.weight,
                        status: e.target.value as ItemStatus,
                      },
                    })
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <button
                  onClick={() => remove.mutate(it.id)}
                  className="rounded p-1 text-fg-3 transition-colors hover:text-red"
                >
                  <X size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
