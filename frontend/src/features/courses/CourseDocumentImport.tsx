import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";
import Modal from "../../components/Modal";
import ParseDropzone from "./ParseDropzone";
import ParseFeedbackPrompt from "./ParseFeedbackPrompt";
import DraftItemRows, { postRows, saveable, toRows, type ReviewRow } from "./draftItems";
import {
  detailChanges,
  isDuplicateItem,
  newBlocks,
  type DetailChange,
  type DetailField,
} from "./draftMerge";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { toast } from "../../lib/toast";
import { hhmm } from "../../lib/format";
import {
  MEETING_KIND_LABEL,
  type AcademicItem,
  type Course,
  type CourseDraft,
  type CourseRequest,
  type MeetingBlock,
} from "../../types";

interface Props {
  course: Course;
  items: AcademicItem[];
  onChange: () => void;
}

export default function CourseDocumentImport({ course, items, onChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [ratingId, setRatingId] = useState<number | null>(null);

  const { data: availability } = useQuery({
    queryKey: ["course-parse-enabled"],
    queryFn: () => api.get<{ enabled: boolean }>("/courses/parse/enabled"),
    staleTime: 5 * 60_000,
  });

  const parse = useMutation({
    mutationFn: () => {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      if (course.semesterId != null) form.append("semesterId", String(course.semesterId));
      form.append("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      return api.post<CourseDraft>("/courses/parse", form);
    },
    onSuccess: setDraft,
  });

  if (!(availability?.enabled ?? false)) {
    return null;
  }

  const verified = user?.emailVerified ?? false;

  function done(parseId: number | null | undefined) {
    setDraft(null);
    setFiles([]);
    onChange();
    if (parseId != null) setRatingId(parseId);
  }

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-[15px] font-semibold text-fg">Add from a document</h2>
        <span className="badge badge-accent text-[10px]">Beta</span>
      </div>
      <p className="mb-3 text-[12px] text-fg-2">
        Got a lab schedule or an updated syllabus? Upload it and we add what is new to this course.
        You check everything before it saves.
      </p>

      {!verified ? (
        <p className="text-[12px] text-fg-3">Verify your email to unlock this.</p>
      ) : (
        <>
          <ParseDropzone files={files} onChange={setFiles} onError={setError} compact />

          {error && <p className="mt-3 text-xs text-red animate-fade">{error}</p>}
          {parse.isError && (
            <p className="mt-3 text-xs text-red animate-fade">
              {parse.error instanceof Error ? parse.error.message : "Could not read that."}
            </p>
          )}

          <button
            type="button"
            onClick={() => parse.mutate()}
            disabled={files.length === 0 || parse.isPending}
            className="btn btn-primary mt-3"
          >
            <Sparkles size={13} />
            {parse.isPending ? "Reading your document…" : "Read this document"}
          </button>
        </>
      )}

      {draft && (
        <MergeReview
          draft={draft}
          course={course}
          items={items}
          onClose={() => setDraft(null)}
          onSaved={() => done(draft.parseId)}
        />
      )}

      {ratingId != null && (
        <ParseFeedbackPrompt
          parseId={ratingId}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["course-parse-accuracy"] });
            setRatingId(null);
          }}
        />
      )}
    </section>
  );
}

interface MergeProps {
  draft: CourseDraft;
  course: Course;
  items: AcademicItem[];
  onClose: () => void;
  onSaved: () => void;
}

function MergeReview({ draft, course, items, onClose, onSaved }: MergeProps) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ReviewRow[]>(() =>
    toRows(draft.items, (item) => isDuplicateItem(item, items)),
  );
  const [blocks] = useState<MeetingBlock[]>(() => newBlocks(draft.meetingBlocks, course));
  const [changes] = useState<DetailChange[]>(() => detailChanges(draft, course));
  const [blocksOn, setBlocksOn] = useState<boolean[]>(() => blocks.map(() => true));
  const [detailsOn, setDetailsOn] = useState<DetailField[]>([]);

  const chosenItems = saveable(rows);
  const chosenBlocks = blocks.filter((_, i) => blocksOn[i]);

  const save = useMutation({
    mutationFn: async () => {
      if (chosenBlocks.length > 0 || detailsOn.length > 0) {
        const overrides = Object.fromEntries(
          changes.filter((c) => detailsOn.includes(c.field)).map((c) => [c.field, c.proposed]),
        ) as Partial<CourseRequest>;
        const req: CourseRequest = {
          name: course.name,
          semesterId: course.semesterId,
          code: course.code,
          professor: course.professor,
          location: course.location,
          color: course.color,
          meetingBlocks: [...course.meetingBlocks, ...chosenBlocks],
          ...overrides,
        };
        await api.put<Course>(`/courses/${course.id}`, req);
      }
      return postRows(course.id, chosenItems);
    },
    onSuccess: ({ saved, failed }) => {
      qc.invalidateQueries({ queryKey: ["course", course.id] });
      if (failed > 0) {
        toast.error(
          `Added ${saved} of ${saved + failed} items. Add the rest from this page by hand.`,
        );
      } else {
        toast.success(`Added ${summary(saved, chosenBlocks.length, detailsOn.length)}`);
      }
      onSaved();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not save those changes."),
  });

  const nothingToDo =
    chosenItems.length === 0 && chosenBlocks.length === 0 && detailsOn.length === 0;

  return (
    <Modal onClose={onClose} title="What we found" size="xl" variant="sheet">
      <div
        className="flex items-start gap-2.5 rounded-lg border border-line p-3"
        style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
      >
        <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="text-[13px] font-semibold text-fg">Check this before you save</p>
          <p className="mt-0.5 text-[12px] text-fg-2">
            Anything already on {course.name} is unticked. Nothing changes until you press the
            button.
          </p>
        </div>
      </div>

      {draft.warnings.length > 0 && (
        <ul
          className="space-y-1.5 rounded-lg border border-line p-3"
          style={{ background: "var(--surface-hi)" }}
        >
          {draft.warnings.map((warning, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-fg-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-yellow" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="field-label mb-0">Assignments and exams</label>
          <span className="text-[11px] text-fg-3">
            {chosenItems.length} of {rows.length} selected
          </span>
        </div>
        <DraftItemRows
          rows={rows}
          onPatch={(id, next) =>
            setRows((list) => list.map((row) => (row.id === id ? { ...row, ...next } : row)))
          }
          onRemove={(id) => setRows((list) => list.filter((row) => row.id !== id))}
          emptyText="Nothing new to add from this document."
        />
      </div>

      {blocks.length > 0 && (
        <div>
          <label className="field-label">New class times</label>
          <div className="space-y-1.5">
            {blocks.map((block, i) => (
              <label
                key={i}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-fg-2"
                style={{ background: "var(--surface-hi)" }}
              >
                <input
                  type="checkbox"
                  checked={blocksOn[i]}
                  onChange={(e) =>
                    setBlocksOn((list) => list.map((on, j) => (j === i ? e.target.checked : on)))
                  }
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span>
                  {MEETING_KIND_LABEL[block.kind ?? "LECTURE"]} · {block.dayOfWeek}{" "}
                  {hhmm(block.startTime)}–{hhmm(block.endTime)}
                  {block.location ? ` · ${block.location}` : ""}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {changes.length > 0 && (
        <div>
          <label className="field-label">Course details</label>
          <div className="space-y-1.5">
            {changes.map((change) => (
              <label
                key={change.field}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-fg-2"
                style={{ background: "var(--surface-hi)" }}
              >
                <input
                  type="checkbox"
                  checked={detailsOn.includes(change.field)}
                  onChange={(e) =>
                    setDetailsOn((list) =>
                      e.target.checked
                        ? [...list, change.field]
                        : list.filter((f) => f !== change.field),
                    )
                  }
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span>
                  {change.label}: {change.current || "empty"}{" "}
                  <span className="text-fg-3">→</span>{" "}
                  <span className="text-fg">{change.proposed}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={nothingToDo || save.isPending}
          className="btn btn-primary"
        >
          {save.isPending
            ? "Saving…"
            : nothingToDo
              ? "Nothing selected"
              : `Add ${summary(chosenItems.length, chosenBlocks.length, detailsOn.length)}`}
        </button>
        <button type="button" onClick={onClose} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </Modal>
  );
}

function summary(items: number, blocks: number, details: number): string {
  const parts: string[] = [];
  if (items > 0) parts.push(`${items} item${items > 1 ? "s" : ""}`);
  if (blocks > 0) parts.push(`${blocks} class time${blocks > 1 ? "s" : ""}`);
  if (details > 0) parts.push(`${details} detail${details > 1 ? "s" : ""}`);
  if (parts.length === 0) return "nothing";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
