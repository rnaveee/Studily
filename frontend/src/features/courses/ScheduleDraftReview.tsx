import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { assignCourseColors } from "./scheduleColors";
import { findSimilarCourses } from "./similarCourses";
import { MEETING_KIND_LABEL, type Course, type CourseRequest, type ScheduleDraft } from "../../types";

interface Row {
  key: string;
  on: boolean;
  duplicate: Course | null;
  name: string;
  code: string;
  color: string;
  blocks: ScheduleDraft["courses"][number]["meetingBlocks"];
}

const DAY_LABEL: Record<string, string> = {
  SUN: "Sun",
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
};
const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function clock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function ScheduleDraftReview({
  draft,
  semesterId,
  onSaved,
  onCancel,
}: {
  draft: ScheduleDraft;
  semesterId: number | null;
  onSaved: (created: Course[]) => void;
  onCancel: () => void;
}) {
  const { data: existing } = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const inSemester = useMemo(
    () => (existing ?? []).filter((c) => semesterId == null || c.semesterId === semesterId),
    [existing, semesterId],
  );

  const { data: matches } = useQuery({
    queryKey: ["schedule-draft-matches", semesterId, draft.courses.map((c) => `${c.code}|${c.name}`)],
    queryFn: async () =>
      Promise.all(
        draft.courses.map(async (c) => {
          const found = await findSimilarCourses(c.name, c.code, semesterId);
          return found.find((m) => semesterId == null || m.semesterId === semesterId) ?? null;
        }),
      ),
    staleTime: Infinity,
  });

  const [rows, setRows] = useState<Row[] | null>(null);
  const ready = existing !== undefined && matches !== undefined;

  const current: Row[] =
    rows ??
    (ready
      ? (() => {
          const colors = assignCourseColors(
            draft.courses.map((c) => c.color),
            inSemester.map((c) => c.color).filter((c): c is string => !!c),
          );
          return draft.courses.map((c, i) => {
            const duplicate = matches?.[i] ?? null;
            return {
              key: `${i}`,
              on: !duplicate,
              duplicate,
              name: c.name ?? "",
              code: c.code ?? "",
              color: colors[i],
              blocks: [...c.meetingBlocks].sort(
                (a, b) =>
                  DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek) ||
                  a.startTime.localeCompare(b.startTime),
              ),
            };
          });
        })()
      : []);

  function patch(key: string, next: Partial<Row>) {
    setRows(current.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }

  const chosen = current.filter((r) => r.on && (r.name.trim() || r.code.trim()));

  const save = useMutation({
    mutationFn: async () => {
      const created: Course[] = [];
      let failed = 0;
      for (const row of chosen) {
        const req: CourseRequest = {
          name: row.name.trim() || row.code.trim(),
          code: row.code.trim() || null,
          semesterId,
          color: row.color,
          meetingBlocks: row.blocks,
        };
        try {
          created.push(await api.post<Course>("/courses", req));
        } catch {
          failed++;
        }
      }
      return { created, failed };
    },
    onSuccess: ({ created, failed }) => {
      if (failed > 0) {
        toast.error(`Created ${created.length} of ${created.length + failed} courses. Add the rest manually.`);
      } else {
        toast.success(created.length === 1 ? "Created 1 course" : `Created ${created.length} courses`);
      }
      onSaved(created);
    },
  });

  if (!ready) {
    return <div className="card p-5 text-[13px] text-fg-3">Checking your courses…</div>;
  }

  return (
    <div className="space-y-3">
      {draft.warnings.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl px-3.5 py-3 text-[12.5px] leading-snug text-fg-2"
          style={{ background: "color-mix(in srgb, var(--yellow) 12%, var(--surface))" }}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "var(--yellow)" }} />
          <ul className="space-y-1">
            {draft.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {current.length === 0 ? (
        <div className="card p-6 text-center text-[13px] text-fg-3">
          No courses were found. Try a clearer screenshot, or add your courses manually.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {current.map((row) => (
            <li
              key={row.key}
              className="card p-4 transition-opacity"
              style={{ borderLeft: `4px solid ${row.color}`, opacity: row.on ? 1 : 0.6 }}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={row.on}
                  aria-label={`Create ${row.code || row.name}`}
                  onClick={() => patch(row.key, { on: !row.on })}
                  className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors"
                  style={
                    row.on
                      ? { background: "var(--accent)", color: "var(--accent-fg)" }
                      : { border: "1.5px solid var(--fg-3)" }
                  }
                >
                  {row.on && <Check size={13} strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2">
                    <input
                      className="input"
                      value={row.code}
                      onChange={(e) => patch(row.key, { code: e.target.value })}
                      placeholder="Code"
                      aria-label="Course code"
                    />
                    <input
                      className="input"
                      value={row.name}
                      onChange={(e) => patch(row.key, { name: e.target.value })}
                      placeholder="Course name"
                      aria-label="Course name"
                    />
                  </div>
                  {row.duplicate && (
                    <span className="badge badge-muted">
                      Looks like {row.duplicate.code || row.duplicate.name} in your courses
                    </span>
                  )}
                  {row.blocks.length > 0 ? (
                    <ul className="space-y-0.5 text-[12.5px] text-fg-2">
                      {row.blocks.map((b, i) => (
                        <li key={i} className="tabular-nums">
                          {DAY_LABEL[b.dayOfWeek]} {clock(b.startTime)}–{clock(b.endTime)} ·{" "}
                          {MEETING_KIND_LABEL[b.kind ?? "LECTURE"]}
                          {b.location ? ` · ${b.location}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-fg-3">No class times found. Add them from the course page.</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={chosen.length === 0 || save.isPending}
          className="btn btn-primary"
        >
          {save.isPending
            ? "Creating…"
            : chosen.length === 1
              ? "Create 1 course"
              : `Create ${chosen.length} courses`}
        </button>
        <button type="button" onClick={onCancel} disabled={save.isPending} className="btn btn-ghost">
          Back
        </button>
      </div>
    </div>
  );
}
