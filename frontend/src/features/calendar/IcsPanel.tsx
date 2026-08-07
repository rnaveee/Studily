import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Download } from "lucide-react";
import { api } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import { toast } from "../../lib/toast";
import type { IcsImportResult } from "../../types";

export default function IcsPanel() {
  const qc = useQueryClient();
  const requireAuth = useRequireAuth();
  const [source, setSource] = useState("");
  const [exporting, setExporting] = useState(false);

  const runImport = useMutation({
    mutationFn: () =>
      api.post<IcsImportResult>("/calendar/import", {
        source: source.trim(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: (result) => {
      setSource("");
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });

      const from = result.calendarName ? ` from ${result.calendarName}` : "";
      const parts = [`Added ${result.imported} event${result.imported === 1 ? "" : "s"}${from}`];
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
      toast.success(parts.join(" · "));
      if (result.truncated) {
        toast.info("That calendar was large, so only the first 2000 events were imported.");
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Import failed"),
  });

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.getBlob("/calendar/export.ics");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "studily.ics";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          className="input flex-1"
          rows={1}
          style={{ resize: "none", whiteSpace: "nowrap", overflowX: "auto", overflowY: "hidden" }}
          placeholder="Paste an .ics link, or the contents of an .ics file"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (source.trim()) requireAuth(() => runImport.mutate());
            }
          }}
        />
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => requireAuth(() => runImport.mutate())}
            disabled={!source.trim() || runImport.isPending}
            className="btn btn-primary"
          >
            <CalendarPlus size={13} />
            {runImport.isPending ? "Importing…" : "Import"}
          </button>
          <button onClick={handleExport} disabled={exporting} className="btn btn-soft">
            <Download size={13} />
            {exporting ? "Exporting…" : "Export .ics"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-fg-3">Sync your calendars by pasting an .ics link.</p>
    </div>
  );
}
