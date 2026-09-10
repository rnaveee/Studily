import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";
import CourseForm from "./CourseForm";
import DraftItemRows, { postRows, saveable, toRows, type ReviewRow } from "./draftItems";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import type { Course, CourseDraft, CourseRequest } from "../../types";

interface Props {
  draft: CourseDraft;
  semesterId: number | null;
  onSaved: (course: Course) => void;
  onCancel: () => void;
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
      const { failed } = await postRows(course.id, saveable(rows));
      return { course, failed };
    },
    onSuccess: ({ course, failed }) => {
      if (failed > 0) {
        toast.error(
          `The course was created, but ${failed} item${failed > 1 ? "s" : ""} could not be saved. Add them from the course page.`,
        );
      }
      onSaved(course);
    },
  });

  function patch(id: string, next: Partial<ReviewRow>) {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  function remove(id: string) {
    setRows((list) => list.filter((row) => row.id !== id));
  }

  const included = saveable(rows).length;

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

            <DraftItemRows
              rows={rows}
              onPatch={patch}
              onRemove={remove}
              emptyText="None found. You can add them from the course page afterwards."
            />
          </div>
        }
      />
    </div>
  );
}
