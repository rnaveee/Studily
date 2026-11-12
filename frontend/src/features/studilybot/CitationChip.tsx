import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";
import { useIsDesktop } from "../../lib/useIsDesktop";
import { bankApi, type Citation } from "./api";

export function citationLocator(citation: Pick<Citation, "fileName" | "page" | "pageTo">): string | null {
  if (citation.page == null) return null;
  const unit = /\.pptx$/i.test(citation.fileName) ? "slide" : "page";
  const ranged = citation.pageTo != null && citation.pageTo !== citation.page;
  return ranged ? `${unit}s ${citation.page}–${citation.pageTo}` : `${unit} ${citation.page}`;
}

export function citationLabel(citation: Pick<Citation, "fileName" | "page" | "pageTo">): string {
  const locator = citationLocator(citation);
  return locator ? `${citation.fileName} · ${locator}` : citation.fileName;
}

const PREVIEW_CACHE_LIMIT = 60;
const previews = new Map<string, Promise<string>>();

function loadPreview(fileId: number, page: number): Promise<string> {
  const key = `${fileId}:${page}`;
  const cached = previews.get(key);
  if (cached) return cached;
  const pending = api.getBlob(bankApi.previewPath(fileId, page)).then((blob) => URL.createObjectURL(blob));
  pending.catch(() => previews.delete(key));
  previews.set(key, pending);
  if (previews.size > PREVIEW_CACHE_LIMIT) {
    const oldest = previews.keys().next().value as string;
    const evicted = previews.get(oldest);
    previews.delete(oldest);
    void evicted?.then((url) => URL.revokeObjectURL(url)).catch(() => undefined);
  }
  return pending;
}

function usePreview(fileId: number, page: number) {
  const [state, setState] = useState<{ src: string | null; failed: boolean }>({ src: null, failed: false });
  useEffect(() => {
    let cancelled = false;
    setState({ src: null, failed: false });
    loadPreview(fileId, page)
      .then((src) => !cancelled && setState({ src, failed: false }))
      .catch(() => !cancelled && setState({ src: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [fileId, page]);
  return state;
}

function PagePreview({ fileId, page, alt }: { fileId: number; page: number; alt: string }) {
  const { src, failed } = usePreview(fileId, page);
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

export interface SourceRef {
  fileId: number;
  fileName: string;
  page: number | null;
  pageTo?: number | null;
  quote?: string;
  previewable: boolean;
}

function SourceModal({ source, onClose }: { source: SourceRef; onClose: () => void }) {
  const desktop = useIsDesktop();
  const label = citationLabel({ fileName: source.fileName, page: source.page, pageTo: source.pageTo ?? null });
  return (
    <Modal onClose={onClose} title={label} size={source.previewable ? "lg" : "md"} variant={desktop ? "card" : "sheet"}>
      {source.quote && (
        <blockquote
          className="rounded-lg py-2 pl-3 pr-3 text-[13px] leading-relaxed text-fg-2"
          style={{ background: "var(--surface-hi)", borderLeft: "2px solid var(--accent)" }}
        >
          {source.quote}
        </blockquote>
      )}
      {source.previewable && source.page != null && (
        <PagePreview fileId={source.fileId} page={source.page} alt={`Preview of ${label}`} />
      )}
    </Modal>
  );
}

export function SlideFigure({ source, className = "" }: { source: SourceRef & { page: number }; className?: string }) {
  const [open, setOpen] = useState(false);
  const { src, failed } = usePreview(source.fileId, source.page);
  const label = citationLabel({ fileName: source.fileName, page: source.page, pageTo: source.pageTo ?? null });
  if (failed) return <CitationChip citation={{ ...source, quote: source.quote ?? "", index: 0, pageTo: source.pageTo ?? null, previewable: false }} />;
  return (
    <figure className={`min-w-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${label}`}
        className="block w-full overflow-hidden rounded-xl transition-opacity hover:opacity-90"
        style={{ border: "1px solid var(--line)", background: "var(--surface-hi)" }}
      >
        {src ? (
          <img src={src} alt={label} className="block max-h-72 w-full object-contain" />
        ) : (
          <span className="skeleton block w-full" style={{ aspectRatio: "16 / 9" }} />
        )}
      </button>
      <figcaption className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-fg-3">
        <FileText size={12} className="shrink-0 text-accent" />
        <span className="truncate">{label}</span>
      </figcaption>
      {open && <SourceModal source={source} onClose={() => setOpen(false)} />}
    </figure>
  );
}

export default function CitationChip({ citation }: { citation: Citation }) {
  const [open, setOpen] = useState(false);
  const label = citationLabel(citation);

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
      {open && <SourceModal source={citation} onClose={() => setOpen(false)} />}
    </>
  );
}
