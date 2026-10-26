import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { toast } from "../../lib/toast";
import type { FeedStageResult, SchoolFeedList } from "../../types";

export default function CanvasImportForm({
  onImported,
  autoFocus,
  submitLabel = "Import courses",
}: {
  onImported?: (result: FeedStageResult) => void;
  autoFocus?: boolean;
  submitLabel?: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [source, setSource] = useState("");

  const feedsQ = useQuery({
    queryKey: ["school-feeds"],
    queryFn: () => api.get<SchoolFeedList>("/school-feeds"),
  });
  const autoSync = feedsQ.data?.available === true;

  const runImport = useMutation({
    mutationFn: () =>
      api.post<FeedStageResult>("/canvas/feed", {
        source: source.trim(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: (result) => {
      setSource("");
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["semesters"] });
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      qc.invalidateQueries({ queryKey: ["school-feeds"] });

      if (result.truncated) {
        toast.info("That feed was large, so only the first 2000 entries were read.");
      }
      onImported?.(result);
      if (result.importId != null) {
        navigate(`/imports/${result.importId}`);
      } else {
        toast.success(
          result.itemsUpdated + result.eventsImported > 0
            ? "Everything is already up to date. Changed deadlines were refreshed."
            : "Everything is already up to date",
        );
      }
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Import failed"),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (source.trim()) runImport.mutate();
      }}
    >
      <div>
        <label className="field-label">Canvas / Brightspace / Moodle calendar link</label>
        <input
          className="input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Paste your school calendar link"
          autoFocus={autoFocus}
          required
        />
      </div>
      <ul className="space-y-1 text-[11px] leading-relaxed text-fg-3">
        <li>
          <span className="text-fg-2">Canvas:</span> Calendar, then Calendar Feed.
        </li>
        <li>
          <span className="text-fg-2">Brightspace:</span> Calendar, then Subscribe (turn on
          calendar feeds in Settings first).
        </li>
        <li>
          <span className="text-fg-2">Moodle:</span> Calendar, then Import or export calendars,
          then Export.
        </li>
      </ul>
      <p className="text-[11px] leading-relaxed text-fg-3">
        {autoSync
          ? "Copy the link and paste it here. Studily checks your link for new assignments every few hours. Your grades, weights and progress stay untouched."
          : "Copy the link and paste it here. Re-import any time to pick up new assignments. Your grades, weights and progress stay untouched."}
      </p>
      <button type="submit" disabled={runImport.isPending} className="btn btn-primary">
        {runImport.isPending ? "Importing…" : submitLabel}
      </button>
    </form>
  );
}
