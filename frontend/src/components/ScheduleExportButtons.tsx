import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Download, X } from "lucide-react";
import { renderScheduleCard } from "../lib/scheduleImage";
import { canCopyImages, copyImage, downloadImage, slugFilename } from "../lib/shareImage";
import { toast } from "../lib/toast";
import type { Course } from "../types";

const isTouch =
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

const OVERLAY_BTN: React.CSSProperties = {
  color: "#ffffff",
  background: "rgba(255,255,255,0.12)",
  borderColor: "rgba(255,255,255,0.22)",
};

interface ExportProps {
  name: string;
  school?: string | null;
  semesterLabel?: string | null;
  courses: Course[];
  disabled?: boolean;
}

export default function ScheduleExportButtons(props: ExportProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={props.disabled}
        title="Save your schedule as an image"
        aria-label="Save your schedule as an image"
        className="btn btn-ghost"
        style={{ padding: 6 }}
      >
        <Download size={13} />
      </button>
      {open && <SchedulePreview {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function SchedulePreview({
  name,
  school,
  semesterLabel,
  courses,
  onClose,
}: ExportProps & { onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    renderScheduleCard({ name, school, semesterLabel, courses })
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [name, school, semesterLabel, courses]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function copy() {
    if (!blob) return;
    copyImage(blob)
      .then(() => toast.success("Schedule copied"))
      .catch(() => toast.error("Couldn't copy the image"));
  }

  function download() {
    if (!blob) return;
    downloadImage(blob, slugFilename(semesterLabel));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-4 px-4 animate-in"
      style={{
        background: "rgba(0,0,0,0.88)",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 52px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
      }}
      onClick={onClose}
    >
      <div
        className="flex min-h-0 flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {url ? (
          <img
            src={url}
            alt={`${name}'s schedule`}
            className="min-h-0 rounded-xl object-contain"
            style={{ maxHeight: "68vh", maxWidth: "100%", WebkitTouchCallout: "default" }}
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center">
            {failed ? (
              <span className="text-[13px] text-white/70">Couldn't build the image.</span>
            ) : (
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/25 border-t-white" />
            )}
          </div>
        )}

        {url && (
          <>
            {isTouch && (
              <p className="text-center text-[12px] text-white/60">
                Touch and hold the image to save it to your photos.
              </p>
            )}
            <div className="flex items-center gap-2">
              {canCopyImages && (
                <button type="button" onClick={copy} className="btn" style={OVERLAY_BTN}>
                  <Copy size={13} />
                  Copy image
                </button>
              )}
              <button type="button" onClick={download} className="btn" style={OVERLAY_BTN}>
                <Download size={13} />
                Download file
              </button>
            </div>
          </>
        )}
      </div>

      <button
        onClick={onClose}
        className="absolute right-3 rounded-full p-2 text-white transition-colors hover:bg-white/15"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        aria-label="Close"
      >
        <X size={18} />
      </button>
    </div>,
    document.body,
  );
}
