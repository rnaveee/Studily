import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import { formatBytes } from "../../lib/format";

export const MAX_FILES = 5;
export const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  onError: (message: string | null) => void;
  compact?: boolean;
  label?: string;
}

export default function ParseDropzone({
  files,
  onChange,
  onError,
  compact,
  label = "Drop your course outline here",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState(false);
  const addRef = useRef<(incoming: File[]) => void>(() => {});

  function addFiles(incoming: File[]) {
    onError(null);
    const usable = incoming.filter((f) => ALLOWED.includes(f.type));
    if (usable.length < incoming.length) {
      onError("Only PDFs and images (PNG, JPEG, WebP) can be read.");
    }
    const next = [...files, ...usable].slice(0, MAX_FILES);
    const total = next.reduce((sum, f) => sum + f.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      onError("Those files add up to over 8 MB. Remove one and try again.");
      return;
    }
    onChange(next);
  }

  addRef.current = addFiles;

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const data = e.clipboardData;
      if (!data) return;
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const incoming = [...data.items]
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (incoming.length === 0) return;
      if (typing && data.getData("text/plain").trim()) return;
      e.preventDefault();
      const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, "");
      const named = incoming.map((file, i) => {
        const generic = !file.name || /^image\.(png|jpe?g|webp)$/i.test(file.name);
        if (!generic) return file;
        const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1] || "png";
        return new File([file], `Pasted image ${stamp}${incoming.length > 1 ? `-${i + 1}` : ""}.${ext}`, { type: file.type });
      });
      addRef.current(named);
      setPasted(true);
      window.setTimeout(() => setPasted(false), 900);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const pasteKey = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘V" : "Ctrl+V";

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles([...e.dataTransfer.files]);
        }}
        className={`rounded-lg border border-dashed text-center transition-colors ${compact ? "p-4" : "p-6"}`}
        style={{
          borderColor: dragging || pasted ? "var(--accent)" : "var(--line)",
          background: dragging || pasted ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
        }}
      >
        {!compact && <Upload className="mx-auto mb-2 text-fg-3" size={24} strokeWidth={1.5} />}
        <p className="text-[13px] text-fg-2">{label}</p>
        <p className="mt-0.5 text-[11px] text-fg-3">
          PDF or image, up to {MAX_FILES} files and 8 MB total
        </p>
        <p className="mt-0.5 text-[11px] text-fg-3">
          Copied a screenshot? Press <kbd className="rounded border border-line px-1 font-mono text-[10.5px]">{pasteKey}</kbd> to paste it.
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
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 rounded p-1 text-fg-3 transition-colors hover:text-red"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
