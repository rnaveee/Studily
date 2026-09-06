import { useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";
import { renderScheduleCard } from "../lib/scheduleImage";
import { canCopyImages, copyImage, saveImage, slugFilename } from "../lib/shareImage";
import { toast } from "../lib/toast";
import { Spinner } from "./Skeleton";
import type { Course } from "../types";

const canShareFiles =
  typeof navigator !== "undefined" && typeof navigator.canShare === "function";

export default function ScheduleExportButtons({
  name,
  school,
  semesterLabel,
  courses,
  disabled,
}: {
  name: string;
  school?: string | null;
  semesterLabel?: string | null;
  courses: Course[];
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<"copy" | "save" | null>(null);
  const off = disabled || busy !== null;

  const opts = { name, school, semesterLabel, courses };

  function copy() {
    setBusy("copy");
    copyImage(renderScheduleCard(opts))
      .then(() => toast.success("Schedule copied"))
      .catch(() => toast.error("Couldn't copy the image"))
      .finally(() => setBusy(null));
  }

  async function save() {
    setBusy("save");
    try {
      const blob = await renderScheduleCard(opts);
      await saveImage(blob, slugFilename(semesterLabel));
    } catch {
      toast.error("Couldn't save the image");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {canCopyImages && (
        <button
          type="button"
          onClick={copy}
          disabled={off}
          title="Copy schedule as an image"
          aria-label="Copy schedule as an image"
          className="btn btn-ghost h-7 w-7 p-0 disabled:opacity-50"
        >
          {busy === "copy" ? <Spinner size={13} /> : <Copy size={13} />}
        </button>
      )}
      <button
        type="button"
        onClick={save}
        disabled={off}
        title={canShareFiles ? "Share or save schedule image" : "Download schedule image"}
        aria-label={canShareFiles ? "Share or save schedule image" : "Download schedule image"}
        className="btn btn-ghost h-7 w-7 p-0 disabled:opacity-50"
      >
        {busy === "save" ? (
          <Spinner size={13} />
        ) : canShareFiles ? (
          <Share2 size={13} />
        ) : (
          <Download size={13} />
        )}
      </button>
    </div>
  );
}
