import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { toast } from "../../lib/toast";
import type { CanvasFeedResult } from "../../types";

export default function CanvasImportForm({
  onImported,
  autoFocus,
  submitLabel = "Import from Canvas",
}: {
  onImported?: (result: CanvasFeedResult) => void;
  autoFocus?: boolean;
  submitLabel?: string;
}) {
  const qc = useQueryClient();
  const [source, setSource] = useState("");

  const runImport = useMutation({
    mutationFn: () =>
      api.post<CanvasFeedResult>("/canvas/feed", {
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

      const courses = result.coursesCreated + result.coursesMatched;
      const parts = [`${courses} course${courses === 1 ? "" : "s"}`];
      if (result.itemsImported > 0) parts.push(`${result.itemsImported} added`);
      if (result.itemsUpdated > 0) parts.push(`${result.itemsUpdated} updated`);
      if (result.eventsImported > 0) parts.push(`${result.eventsImported} events`);
      toast.success(parts.join(" · "));
      if (result.truncated) {
        toast.info("That feed was large, so only the first 2000 entries were imported.");
      }
      onImported?.(result);
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
        <label className="field-label">Canvas calendar feed link</label>
        <input
          className="input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="https://yourschool.instructure.com/feeds/calendars/user_….ics"
          autoFocus={autoFocus}
          required
        />
      </div>
      <p className="text-[11px] leading-relaxed text-fg-3">
        In Canvas, open <span className="text-fg-2">Calendar</span> and click{" "}
        <span className="text-fg-2">Calendar Feed</span> at the bottom right, then paste the link
        here. Re-import any time to pick up new assignments — your grades, weights and progress stay
        untouched.
      </p>
      <button type="submit" disabled={runImport.isPending} className="btn btn-primary">
        {runImport.isPending ? "Importing…" : submitLabel}
      </button>
    </form>
  );
}
