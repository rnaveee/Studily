import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FileText, Image as ImageIcon, Sparkles, Upload, X } from "lucide-react";
import BackButton from "../../components/BackButton";
import CourseDraftReview from "./CourseDraftReview";
import { api } from "../../lib/api";
import { formatBytes } from "../../lib/format";
import { staggerDelay } from "../../lib/motion";
import type { Course, CourseDraft, Semester } from "../../types";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export default function CourseAutoImportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CourseDraft | null>(null);

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

  function addFiles(incoming: File[]) {
    setError(null);
    const usable = incoming.filter((f) => ALLOWED.includes(f.type));
    if (usable.length < incoming.length) {
      setError("Only PDFs and images (PNG, JPEG, WebP) can be read.");
    }
    const next = [...files, ...usable].slice(0, MAX_FILES);
    const total = next.reduce((sum, f) => sum + f.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      setError("Those files add up to over 8 MB. Remove one and try again.");
      return;
    }
    setFiles(next);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles([...e.dataTransfer.files]);
  }

  function saved(course: Course) {
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    navigate(`/courses/${course.id}`);
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
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className="rounded-lg border border-dashed p-6 text-center transition-colors"
          style={{
            borderColor: dragging ? "var(--accent)" : "var(--line)",
            background: dragging ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
          }}
        >
          <Upload className="mx-auto mb-2 text-fg-3" size={24} strokeWidth={1.5} />
          <p className="text-[13px] text-fg-2">Drop your course outline here</p>
          <p className="mt-0.5 text-[11px] text-fg-3">
            PDF or image, up to {MAX_FILES} files and 8 MB total
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn btn-soft mt-3 text-xs"
          >
            Choose files
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              addFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="space-y-1.5">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                style={{ background: "var(--surface-hi)" }}
              >
                {file.type === "application/pdf" ? (
                  <FileText size={14} className="shrink-0 text-fg-3" />
                ) : (
                  <ImageIcon size={14} className="shrink-0 text-fg-3" />
                )}
                <span className="min-w-0 flex-1 truncate text-[12px] text-fg-2">{file.name}</span>
                <span className="shrink-0 text-[11px] text-fg-3">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((list) => list.filter((_, i) => i !== index))}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 rounded p-1 text-fg-3 transition-colors hover:text-red"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

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
