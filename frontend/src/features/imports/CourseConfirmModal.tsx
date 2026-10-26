import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import Modal from "../../components/Modal";
import CourseCard from "../courses/CourseCard";
import CourseForm from "../courses/CourseForm";
import { CourseCompare, useSemesterLabels } from "../courses/DuplicateCoursePrompt";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import type {
  Course,
  CourseDecision,
  CourseRequest,
  FeedImportView,
  StagedCourseView,
} from "../../types";
import { byDueDate, CLASS_LABEL, classify, providerLabel, summarize, type StagedClass } from "./stagedSummary";

const CLASS_BADGE: Record<StagedClass, string> = {
  assignment: "badge-accent",
  lab: "badge-green",
  quiz: "badge-orange",
  exam: "badge-red",
  event: "badge-muted",
};

interface Choice {
  decision: "ADD" | "MERGE" | "SKIP";
  targetCourseId?: number;
}

export default function CourseConfirmModal({
  view,
  busy,
  onDone,
  onClose,
}: {
  view: FeedImportView;
  busy: boolean;
  onDone: (decisions: CourseDecision[]) => void;
  onClose: () => void;
}) {
  const slides = useMemo(() => view.courses.filter((c) => c.linkedCourseId == null), [view]);
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [overrides, setOverrides] = useState<Record<string, CourseRequest>>({});
  const [targets, setTargets] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(slides.map((c) => [c.key, c.matchCourseId])),
  );
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: allCourses } = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const last = slides.length - 1;
  const firstOpen = slides.findIndex((c) => !choices[c.key]);
  const reach = firstOpen === -1 ? last : firstOpen;

  function go(next: number) {
    setIndex(Math.max(0, Math.min(reach, next)));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "ArrowRight") go(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, reach, editing]);

  function decide(course: StagedCourseView, choice: Choice) {
    const next = { ...choices, [course.key]: choice };
    setChoices(next);
    if (slides.every((c) => next[c.key])) {
      onDone(
        slides.map((c) => {
          const picked = next[c.key];
          return {
            key: c.key,
            decision: picked.decision,
            overrides: picked.decision === "ADD" ? (overrides[c.key] ?? null) : null,
            targetCourseId: picked.decision === "MERGE" ? (picked.targetCourseId ?? null) : null,
          };
        }),
      );
      return;
    }
    setIndex(Math.min(last, index + 1));
  }

  const course = slides[index];
  if (!course) return null;

  return (
    <Modal onClose={onClose} size="xl" variant="sheet" padded={false}>
      <div className="flex flex-col">
        <div className="px-5 pb-1 pt-5 pr-12">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
            New from {providerLabel(view.provider)}
          </p>
          <h2 className="mt-0.5 text-[16px] font-semibold text-fg">
            {slides.length === 1 ? "Add this course?" : `Course ${index + 1} of ${slides.length}`}
          </h2>
        </div>

        <div key={course.key} className="animate-fade space-y-3 px-5 py-3">
          <Slide
            view={view}
            course={course}
            override={overrides[course.key]}
            target={targets[course.key] ?? null}
            allCourses={allCourses ?? []}
            expanded={!!expanded[course.key]}
            busy={busy}
            onToggle={() => setExpanded((e) => ({ ...e, [course.key]: !e[course.key] }))}
            onEdit={() => setEditing(true)}
            onTarget={(id) => setTargets((t) => ({ ...t, [course.key]: id }))}
            onDecide={(choice) => decide(course, choice)}
          />
        </div>

        {slides.length > 1 && (
          <div className="flex items-center justify-between border-t border-line px-3 py-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label="Previous course"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex flex-col items-center">
              <div className="flex items-center">
                {slides.map((c, i) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => go(i)}
                    disabled={i > reach}
                    aria-label={`Go to ${c.name}`}
                    aria-current={i === index}
                    className="grid h-8 w-8 place-items-center disabled:cursor-default"
                  >
                    <span
                      className="h-2 rounded-full transition-all duration-200"
                      style={{
                        width: i === index ? 20 : 8,
                        background:
                          i === index
                            ? "var(--accent)"
                            : choices[c.key]
                              ? "color-mix(in srgb, var(--accent) 45%, transparent)"
                              : "color-mix(in srgb, var(--fg-3) 40%, transparent)",
                      }}
                    />
                  </button>
                ))}
              </div>
              <span className="text-[11px] tabular-nums text-fg-3">
                {index + 1} of {slides.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index >= reach}
              aria-label="Next course"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(false)} title="Edit course" size="xl" variant="sheet" padded={false}>
          <div className="p-5 pt-0">
            <CourseForm
              bare
              initial={effective(course, overrides[course.key])}
              submitLabel="Save changes"
              onSubmit={async (req) => {
                setOverrides((o) => ({ ...o, [course.key]: req }));
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        </Modal>
      )}
    </Modal>
  );
}

function effective(course: StagedCourseView, override?: CourseRequest): CourseRequest {
  return (
    override ?? {
      name: course.name,
      semesterId: course.semesterId,
      code: course.code ?? "",
      color: course.color,
      meetingBlocks: [],
    }
  );
}

function Slide({
  view,
  course,
  override,
  target,
  allCourses,
  expanded,
  busy,
  onToggle,
  onEdit,
  onTarget,
  onDecide,
}: {
  view: FeedImportView;
  course: StagedCourseView;
  override?: CourseRequest;
  target: number | null;
  allCourses: Course[];
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onTarget: (id: number | null) => void;
  onDecide: (choice: Choice) => void;
}) {
  const semesterLabel = useSemesterLabels();
  const request = effective(course, override);
  const incoming: Course = {
    id: 0,
    name: request.name,
    code: request.code || null,
    professor: request.professor ?? null,
    location: request.location ?? null,
    color: request.color ?? course.color,
    semesterId: request.semesterId ?? null,
    meetingBlocks: request.meetingBlocks ?? [],
  };
  const matched = target == null ? null : (course.match?.id === target ? course.match : allCourses.find((c) => c.id === target) ?? null);
  const summary = (
    <SummaryToggle course={course} expanded={expanded} onToggle={onToggle} />
  );
  const picker = (
    <label className="block">
      <span className="sr-only">Merge into an existing course</span>
      <select
        className="input w-full text-[13px]"
        value={target ?? ""}
        onChange={(e) => onTarget(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">{matched ? "Add as a new course instead" : "Merge into an existing course…"}</option>
        {allCourses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code ? `${c.code} · ${c.name}` : c.name}
          </option>
        ))}
      </select>
    </label>
  );

  if (matched) {
    return (
      <>
        <p className="text-[13px] leading-relaxed text-fg-2">
          This looks like a course you already have. Merging keeps your details and adds the new
          deadlines to it.
        </p>
        <CourseCompare
          incoming={incoming}
          incomingLabel={`From ${providerLabel(view.provider)}`}
          incomingFooter={summary}
          existing={matched}
        />
        {picker}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onDecide({ decision: "ADD" })}>
            No, add this course
          </button>
          <button
            type="button"
            className="btn btn-checkin"
            disabled={busy}
            onClick={() => onDecide({ decision: "MERGE", targetCourseId: matched.id })}
          >
            Yes, merge
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <CourseCard course={incoming} semesterLabel={semesterLabel(incoming.semesterId)}>
        <div className="mt-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">{summary}</div>
          <button type="button" className="btn btn-ghost shrink-0" onClick={onEdit}>
            <Pencil size={13} />
            Edit
          </button>
        </div>
      </CourseCard>
      {picker}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onDecide({ decision: "SKIP" })}>
          Skip
        </button>
        <button type="button" className="btn btn-checkin" disabled={busy} onClick={() => onDecide({ decision: "ADD" })}>
          Add course
        </button>
      </div>
    </>
  );
}

function SummaryToggle({
  course,
  expanded,
  onToggle,
}: {
  course: StagedCourseView;
  expanded: boolean;
  onToggle: () => void;
}) {
  const items = byDueDate(course.items);
  return (
    <div className="mt-2 min-w-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="inline-flex max-w-full items-center gap-1 text-left text-[12.5px] font-medium text-accent hover:underline"
      >
        <span className="min-w-0">{summarize(course.items)}</span>
        <ChevronDown
          size={13}
          className="shrink-0 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
        />
      </button>
      {expanded && (
        <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
          {items.map((item) => {
            const kind = classify(item);
            return (
              <li key={item.key} className="flex items-center gap-2 text-[12.5px]">
                <span className={`badge ${CLASS_BADGE[kind]} shrink-0 text-[10px]`}>{CLASS_LABEL[kind]}</span>
                <span className="min-w-0 flex-1 truncate text-fg">{item.title}</span>
                <span className="shrink-0 tabular-nums text-fg-3">{formatDateTime(item.dueAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
