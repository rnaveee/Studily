import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";
import { useIsDesktop } from "../../lib/useIsDesktop";
import { bankApi, type Citation } from "./api";

export function citationLocator(citation: Citation): string | null {
  if (citation.page == null) return null;
  const unit = /\.pptx$/i.test(citation.fileName) ? "slide" : "page";
  const ranged = citation.pageTo != null && citation.pageTo !== citation.page;
  return ranged ? `${unit}s ${citation.page}–${citation.pageTo}` : `${unit} ${citation.page}`;
}

function PagePreview({ fileId, page, alt }: { fileId: number; page: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    api
      .getBlob(bankApi.previewPath(fileId, page))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId, page]);

  if (failed) {
    return <p className="mt-3 text-[12px] text-fg-3">The preview for this page isn't available.</p>;
  }
  if (!src) {
    return <div className="skeleton mt-3 w-full" style={{ aspectRatio: "4 / 3" }} />;
  }
  return (
    <img
      src={src}
      alt={alt}
      className="mt-3 max-h-[60vh] w-full rounded-lg object-contain"
      style={{ border: "1px solid var(--line)", background: "var(--surface-hi)" }}
    />
  );
}

export default function CitationChip({ citation }: { citation: Citation }) {
  const [open, setOpen] = useState(false);
  const desktop = useIsDesktop();
  const locator = citationLocator(citation);
  const label = locator ? `${citation.fileName} · ${locator}` : citation.fileName;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-left text-[11.5px] text-fg-2 transition-colors hover:text-fg"
        style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
      >
        <FileText size={12} className="shrink-0 text-accent" />
        <span className="min-w-0 truncate">{label}</span>
      </button>
      {open && (
        <Modal
          onClose={() => setOpen(false)}
          title={label}
          size={citation.previewable ? "lg" : "md"}
          variant={desktop ? "card" : "sheet"}
        >
          {citation.quote && (
            <blockquote
              className="rounded-lg py-2 pl-3 pr-3 text-[13px] leading-relaxed text-fg-2"
              style={{ background: "var(--surface-hi)", borderLeft: "2px solid var(--accent)" }}
            >
              {citation.quote}
            </blockquote>
          )}
          {citation.previewable && citation.page != null && (
            <PagePreview fileId={citation.fileId} page={citation.page} alt={`Preview of ${label}`} />
          )}
        </Modal>
      )}
    </>
  );
}
