import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ChevronRight, Download, Upload } from "lucide-react";
import { api } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import { toast } from "../../lib/toast";
import type { IcsImportResult } from "../../types";

const FILE_STEPS = [
  "In Google Calendar, click the gear icon at the top right, then Settings.",
  "In the left sidebar, click Import & export, then find the Export section.",
  "Click Export. Google downloads a .zip file with your calendars inside.",
  "Come back here, click Import file, and pick that file. The .zip works as-is, no unzipping needed.",
];

const LINK_STEPS = [
  "In Google Calendar, open Settings, then under Settings for my calendars click the calendar you want.",
  "Click Integrate calendar, then scroll to Secret address in iCal format.",
  "Copy that address and paste it in the box above.",
];

export default function IcsPanel() {
  const qc = useQueryClient();
  const requireAuth = useRequireAuth();
  const [source, setSource] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

  function onImported(result: IcsImportResult) {
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
  }

  const runImport = useMutation({
    mutationFn: () =>
      api.post<IcsImportResult>("/calendar/import", {
        source: source.trim(),
        timeZone: timeZone(),
      }),
    onSuccess: (result) => {
      setSource("");
      onImported(result);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Import failed"),
  });

  const importFile = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      body.append("timeZone", timeZone());
      return api.post<IcsImportResult>("/calendar/import-file", body);
    },
    onSuccess: onImported,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Import failed"),
    onSettled: () => {
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
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

  const busy = runImport.isPending || importFile.isPending;

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
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            onClick={() => requireAuth(() => runImport.mutate())}
            disabled={!source.trim() || busy}
            className="btn btn-primary"
          >
            <CalendarPlus size={13} />
            {runImport.isPending ? "Importing…" : "Import"}
          </button>
          <button
            onClick={() => requireAuth(() => fileInputRef.current?.click())}
            disabled={busy}
            className="btn btn-soft"
          >
            <Upload size={13} />
            {importFile.isPending ? "Importing…" : "Import file"}
          </button>
          <button onClick={handleExport} disabled={exporting} className="btn btn-soft">
            <Download size={13} />
            {exporting ? "Exporting…" : "Export .ics"}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".ics,.zip,text/calendar,application/zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importFile.mutate(file);
        }}
      />

      <p className="mt-2 text-[11px] text-fg-3">
        Sync your calendars by pasting an .ics link, or import an .ics or .zip file.
      </p>

      <div className="mt-2">
        <button
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          className="flex items-center gap-1 text-[12px] font-medium text-accent transition-colors hover:text-accent-2"
        >
          <ChevronRight
            size={13}
            className="transition-transform"
            style={{ transform: showHelp ? "rotate(90deg)" : "none" }}
          />
          Using Google Calendar? Follow these steps
        </button>

        {showHelp && (
          <div className="mt-2 space-y-3 rounded-lg p-3 animate-fade" style={{ background: "var(--surface-hi)" }}>
            <div>
              <p className="text-[12px] font-semibold text-fg">Import a file</p>
              <ol className="mt-1 space-y-1">
                {FILE_STEPS.map((step, i) => (
                  <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-fg-2">
                    <span className="shrink-0 font-medium text-fg-3">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-fg">Or paste a link that stays in sync</p>
              <ol className="mt-1 space-y-1">
                {LINK_STEPS.map((step, i) => (
                  <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-fg-2">
                    <span className="shrink-0 font-medium text-fg-3">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-1.5 text-[11px] font-medium text-red">
                Keep that address private. Anyone who has it can see your whole calendar.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
