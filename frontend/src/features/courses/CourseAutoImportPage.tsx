import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import BackButton from "../../components/BackButton";
import CourseDraftReview from "./CourseDraftReview";
import ParseDropzone from "./ParseDropzone";
import ParseFeedbackPrompt from "./ParseFeedbackPrompt";
import { api } from "../../lib/api";
import { staggerDelay } from "../../lib/motion";
import type { Course, CourseDraft, Semester } from "../../types";

export default function CourseAutoImportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [rating, setRating] = useState<{ parseId: number; courseId: number } | null>(null);

  const { data: semesters } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => api.get<Semester[]>("/semesters"),
  });

  const parse = useMutation({
    mutationFn: () => {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      if (text.trim()) form.append("text", text.trim());
      if (semesterId != null) form.append("semesterId", String(semesterId));
      form.append("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      return api.post<CourseDraft>("/courses/parse", form);
    },
    onSuccess: setDraft,
  });

  function saved(course: Course) {
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    if (draft?.parseId != null) {
      setRating({ parseId: draft.parseId, courseId: course.id });
      return;
    }
    navigate(`/courses/${course.id}`);
  }

  function ratingDone() {
    qc.invalidateQueries({ queryKey: ["course-parse-accuracy"] });
    navigate(`/courses/${rating!.courseId}`);
  }

  const hasInput = files.length > 0 || text.trim().length > 0;

  if (draft) {
    return (
      <div className="space-y-4">
        <div className="stagger-item flex items-center gap-3">
          <BackButton fallback="/courses" />
          <h1 className="text-xl font-semibold text-fg">Check the details</h1>
        </div>
        <div className="stagger-item" style={staggerDelay(1)}>
          <CourseDraftReview
            draft={draft}
            semesterId={semesterId}
            onSaved={saved}
            onCancel={() => setDraft(null)}
          />
        </div>
        {rating && <ParseFeedbackPrompt parseId={rating.parseId} onDone={ratingDone} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="stagger-item flex items-center gap-3">
        <BackButton fallback="/courses" />
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
            Automatic course
            <span className="badge badge-accent text-[10px]">Beta</span>
          </h1>
          <p className="text-[12px] text-fg-3">
            Upload your outline and we fill in the form for you to check.
          </p>
        </div>
      </div>

      <div className="card stagger-item space-y-4 p-5" style={staggerDelay(1)}>
        <ParseDropzone files={files} onChange={setFiles} onError={setError} />

        <div>
          <label className="field-label">Or paste the course details</label>
          <textarea
            className="input min-h-[110px]"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste anything from the course page — times, room, instructor, deadlines."
          />
        </div>

        <div>
          <label className="field-label">Semester</label>
          <select
            className="input"
            value={semesterId ?? ""}
            onChange={(e) => setSemesterId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">No semester</option>
            {(semesters ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-fg-3">
            Picking one helps us work out which year the due dates belong to.
          </p>
        </div>

        {error && <p className="text-xs text-red animate-fade">{error}</p>}
        {parse.isError && (
          <p className="text-xs text-red animate-fade">
            {parse.error instanceof Error ? parse.error.message : "Could not read that."}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => parse.mutate()}
            disabled={!hasInput || parse.isPending}
            className="btn btn-primary"
          >
            <Sparkles size={13} />
            {parse.isPending ? "Reading your outline…" : "Fill in the form"}
          </button>
          <button type="button" onClick={() => navigate("/courses")} className="btn btn-ghost">
            Cancel
          </button>
        </div>

        {parse.isPending && (
          <p className="text-[11px] text-fg-3 animate-fade">
            This usually takes a few seconds for a course outline.
          </p>
        )}
      </div>
    </div>
  );
}
