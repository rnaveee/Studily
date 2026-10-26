import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import BackButton from "../../components/BackButton";
import ParseDropzone, { appendFiles, invalidPageRange } from "./ParseDropzone";
import ScheduleDraftReview from "./ScheduleDraftReview";
import { api } from "../../lib/api";
import { staggerDelay } from "../../lib/motion";
import {
  PARSE_AVAILABILITY_KEY,
  parseBlocked,
  parseQuotaText,
  useParseAvailability,
} from "./parseAvailability";
import type { ScheduleDraft, Semester } from "../../types";

export default function ScheduleImportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [files, setFiles] = useState<File[]>([]);
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);

  const { data: semesters } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => api.get<Semester[]>("/semesters"),
  });

  const parse = useMutation({
    mutationFn: () => {
      const form = new FormData();
      appendFiles(form, files);
      if (semesterId != null) form.append("semesterId", String(semesterId));
      form.append("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      return api.post<ScheduleDraft>("/courses/parse/schedule", form);
    },
    onSuccess: setDraft,
    onSettled: () => qc.invalidateQueries({ queryKey: PARSE_AVAILABILITY_KEY }),
  });
  const { data: availability } = useParseAvailability();
  const blocked = parseBlocked(availability);
  const quota = parseQuotaText(availability);

  function saved() {
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    navigate("/courses");
  }

  if (draft) {
    return (
      <div className="space-y-4">
        <div className="stagger-item flex items-center gap-3">
          <BackButton fallback="/courses" />
          <div>
            <h1 className="text-xl font-semibold text-fg">Check your courses</h1>
            <p className="text-[12px] text-fg-3">Untick anything you don't want, then create them all at once.</p>
          </div>
        </div>
        <div className="stagger-item" style={staggerDelay(1)}>
          <ScheduleDraftReview
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
            Upload schedule
            <span className="badge badge-accent text-[10px]">Beta</span>
          </h1>
          <p className="text-[12px] text-fg-3">
            Drop in a screenshot of your weekly timetable and we'll set up every course on it.
          </p>
        </div>
      </div>

      <div className="card stagger-item space-y-4 p-5" style={staggerDelay(1)}>
        <ParseDropzone
          files={files}
          onChange={setFiles}
          onError={setError}
          label="Drop a screenshot of your weekly schedule here"
        />

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
            The new courses go into this semester, and any you already have there are left unticked.
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
            disabled={files.length === 0 || invalidPageRange(files) || parse.isPending || blocked}
            className="btn btn-primary"
          >
            <Sparkles size={13} />
            {parse.isPending ? "Reading your schedule…" : "Find my courses"}
          </button>
          <button type="button" onClick={() => navigate("/courses")} className="btn btn-ghost">
            Cancel
          </button>
        </div>
        {quota && <p className={`text-[11px] ${blocked ? "text-red" : "text-fg-3"}`}>{quota}</p>}
        {parse.isPending && (
          <p className="text-[11px] text-fg-3 animate-fade">This usually takes a few seconds.</p>
        )}
      </div>
    </div>
  );
}
