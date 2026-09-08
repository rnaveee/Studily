import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import CourseForm from "./CourseForm";
import DateTimeSelect from "../../components/DateTimeSelect";
import { toLocalInput } from "../../lib/format";
import { api } from "../../lib/api";
import type {
  AcademicItem,
  Course,
  CourseDraft,
  CourseRequest,
  DraftItem,
  ItemType,
} from "../../types";

interface Props {
  draft: CourseDraft;
  semesterId: number | null;
  onSaved: (course: Course) => void;
  onCancel: () => void;
}

interface ReviewRow {
  id: string;
  include: boolean;
  type: ItemType;
  title: string;
  dueLocal: string;
  weight: string;
}

function toRows(items: DraftItem[]): ReviewRow[] {
  return items.map((item, index) => ({
    id: `draft-${index}`,
    include: true,
    type: item.type,
    title: item.title,
    dueLocal: toLocalInput(item.dueAt),
    weight: item.weight == null ? "" : String(item.weight),
  }));
}

export default function CourseDraftReview({ draft, semesterId, onSaved, onCancel }: Props) {
  const [rows, setRows] = useState<ReviewRow[]>(() => toRows(draft.items));

  const initial: CourseRequest = {
    name: draft.name ?? "",
    semesterId,
    code: draft.code ?? "",
    professor: draft.professor ?? "",
    location: draft.location ?? "",
    meetingBlocks: draft.meetingBlocks,
  };

  const save = useMutation({
    mutationFn: async (req: CourseRequest) => {
      const course = await api.post<Course>("/courses", req);
      const chosen = rows.filter((r) => r.include && r.title.trim() && r.dueLocal);
      await Promise.allSettled(
        chosen.map((row) =>
          api.post<AcademicItem>(`/courses/${course.id}/items`, {
            type: row.type,
            title: row.title.trim(),
            dueAt: new Date(row.dueLocal).toISOString(),
            weight: row.weight.trim() ? Number(row.weight) : undefined,
          }),
        ),
      );
      return course;
    },
    onSuccess: onSaved,
  });

  function patch(id: string, next: Partial<ReviewRow>) {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  function remove(id: string) {
    setRows((list) => list.filter((row) => row.id !== id));
  }

  const included = rows.filter((r) => r.include).length;

  return (
    <div className="space-y-4">
      <div
        className="flex items-start gap-2.5 rounded-lg border border-line p-3"
        style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
      >
        <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="text-[13px] font-semibold text-fg">Check this before you save</p>
          <p className="mt-0.5 text-[12px] text-fg-2">
            Automatic reading is in beta and gets things wrong. Everything below is editable, and
            nothing is saved until you press the button.
          </p>
        </div>
      </div>

      {draft.warnings.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border border-line p-3" style={{ background: "var(--surface-hi)" }}>
          {draft.warnings.map((warning, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-fg-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-yellow" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}

      <CourseForm
        initial={initial}
        prefill
        submitLabel={included > 0 ? `Save course and ${included} item${included > 1 ? "s" : ""}` : "Save course"}
        onSubmit={(req) => save.mutateAsync(req)}
        onCancel={onCancel}
        onImported={onSaved}
        extra={
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="field-label mb-0">Assignments and exams</label>
              <span className="text-[11px] text-fg-3">
                {included} of {rows.length} selected
              </span>
            </div>

            {rows.length === 0 ? (
              <p className="text-[12px] text-fg-3">
                None found. You can add them from the course page afterwards.
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="space-y-2 rounded-lg p-2.5"
                    style={{ background: "var(--surface-hi)", opacity: row.include ? 1 : 0.55 }}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(e) => patch(row.id, { include: e.target.checked })}
                        aria-label={`Include ${row.title}`}
                        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                      />
                      <input
                        className="input min-w-0 flex-1"
                        value={row.title}
                        onChange={(e) => patch(row.id, { title: e.target.value })}
                        placeholder="Title"
                      />
                      <button
                        type="button"
                        onClick={() => remove(row.id)}
                        aria-label={`Remove ${row.title}`}
                        className="shrink-0 rounded p-1 text-fg-3 transition-colors hover:text-red"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="input w-auto"
                        value={row.type}
                        onChange={(e) => patch(row.id, { type: e.target.value as ItemType })}
                      >
                        <option value="ASSIGNMENT">Assignment</option>
                        <option value="EXAM">Exam</option>
                      </select>
                      <DateTimeSelect
                        value={row.dueLocal}
                        onChange={(v) => patch(row.id, { dueLocal: v })}
                        className="min-w-[210px] flex-1"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          className="input w-[72px]"
                          inputMode="decimal"
                          value={row.weight}
                          onChange={(e) => patch(row.id, { weight: e.target.value })}
                          placeholder="—"
                          aria-label={`Weight for ${row.title}`}
                        />
                        <span className="text-[12px] text-fg-3">%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
