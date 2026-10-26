import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import { formatBytes } from "../../lib/format";
import { countPages } from "./pageCount";

export const MAX_FILES = 5;
export const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

export interface DropRules {
  accept: string;
  types: string[];
  extensions: string[];
  maxFiles: number;
  maxTotalBytes: number;
  maxFileBytes?: number;
  hint: string;
  typeError: string;
}

export const OUTLINE_RULES: DropRules = {
  accept: ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp",
  types: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  extensions: [],
  maxFiles: MAX_FILES,
  maxTotalBytes: MAX_TOTAL_BYTES,
  hint: `PDF or image, up to ${MAX_FILES} files and 8 MB total`,
  typeError: "Only PDFs and images (PNG, JPEG, WebP) can be read.",
};

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  onError: (message: string | null) => void;
  compact?: boolean;
  label?: string;
  rules?: DropRules;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

interface PageRange {
  start: string;
  end: string;
}

const pageRanges = new WeakMap<File, PageRange>();
const pageCounts = new WeakMap<File, number | null>();

export function pageUnit(file: File): "page" | "slide" | null {
  const ext = extensionOf(file.name);
  if (file.type === "application/pdf" || ext === "pdf") return "page";
  if (ext === "pptx") return "slide";
  return null;
}

function rangeOf(file: File): PageRange {
  return pageRanges.get(file) ?? { start: "", end: "" };
}

function resolveRange(file: File): { spec: string; error: string | null } {
  const unit = pageUnit(file);
  const { start, end } = rangeOf(file);
  const s = start.trim();
  const e = end.trim().toLowerCase();
  if (!unit || (!s && !e)) return { spec: "", error: null };
  if (s && !/^\d+$/.test(s)) return { spec: "", error: `The first box takes a ${unit} number.` };
  if (e && e !== "end" && !/^\d+$/.test(e)) {
    return { spec: "", error: `The second box takes a ${unit} number or "end".` };
  }
  const first = s ? Number(s) : 1;
  const last = !e || e === "end" ? null : Number(e);
  if (first < 1 || last === 0) return { spec: "", error: `${unit === "page" ? "Pages" : "Slides"} start at 1.` };
  if (last !== null && last < first) return { spec: "", error: `The range can't end before ${unit} ${first}.` };
  const count = pageCounts.get(file);
  if (count && (first > count || (last !== null && last > count))) {
    return { spec: "", error: `This file only has ${count} ${unit}${count === 1 ? "" : "s"}. Pick between 1 and ${count}.` };
  }
  return { spec: `${first}-${last ?? "end"}`, error: null };
}

export function appendFiles(form: FormData, files: File[]) {
  files.forEach((file) => {
    form.append("files", file);
    form.append("pages", resolveRange(file).spec);
  });
}

export function invalidPageRange(files: File[]): boolean {
  return files.some((file) => resolveRange(file).error !== null);
}

export default function ParseDropzone({
  files,
  onChange,
  onError,
  compact,
  label = "Drop your course outline here",
  rules = OUTLINE_RULES,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState(false);
  const addRef = useRef<(incoming: File[]) => void>(() => {});
  const latest = useRef({ files, onChange });
  latest.current = { files, onChange };

  useEffect(() => {
    for (const file of files) {
      const unit = pageUnit(file);
      if (!unit || pageCounts.has(file)) continue;
      pageCounts.set(file, null);
      countPages(file, unit).then((count) => {
        pageCounts.set(file, count);
        const { files: current, onChange: update } = latest.current;
        if (count !== null && current.includes(file)) update([...current]);
      });
    }
  }, [files]);

  function addFiles(incoming: File[]) {
    onError(null);
    const usable = incoming.filter(
      (f) => rules.types.includes(f.type) || rules.extensions.includes(extensionOf(f.name)),
    );
    if (usable.length < incoming.length) {
      onError(rules.typeError);
    }
    const tooBig = rules.maxFileBytes ? usable.find((f) => f.size > rules.maxFileBytes!) : undefined;
    if (tooBig) {
      onError(`${tooBig.name} is larger than ${formatBytes(rules.maxFileBytes!)}.`);
      return;
    }
    const combined = [...files, ...usable];
    if (combined.length > rules.maxFiles) {
      onError(`Add up to ${rules.maxFiles} ${rules.maxFiles === 1 ? "file" : "files"} at a time.`);
    }
    const next = combined.slice(0, rules.maxFiles);
    const total = next.reduce((sum, f) => sum + f.size, 0);
    if (total > rules.maxTotalBytes) {
      onError(`Those files add up to over ${formatBytes(rules.maxTotalBytes)}. Remove one and try again.`);
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
        <p className="mt-0.5 text-[11px] text-fg-3">{rules.hint}</p>
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
          accept={rules.accept}
          className="hidden"
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file, index) => {
            const unit = pageUnit(file);
            const range = rangeOf(file);
            const error = unit ? resolveRange(file).error : null;
            const count = pageCounts.get(file);
            const setRange = (next: Partial<PageRange>) => {
              pageRanges.set(file, { ...range, ...next });
              onChange([...files]);
            };
            const boxStyle = (bad: boolean) => ({
              width: 64,
              padding: "3px 8px",
              fontSize: 12,
              textAlign: "center" as const,
              borderColor: bad ? "var(--red)" : undefined,
            });
            return (
            <li
              key={`${file.name}-${index}`}
              className="rounded-lg px-2.5 py-2"
              style={{ background: "var(--surface-hi)" }}
            >
              <div className="flex items-center gap-2">
                {file.type.startsWith("image/") ? (
                  <ImageIcon size={14} className="shrink-0 text-fg-3" />
                ) : (
                  <FileText size={14} className="shrink-0 text-fg-3" />
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
              </div>
              {unit && (
                <div className="mt-1.5 pl-[22px]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span id={`pages-${index}`} className="text-[11px] text-fg-3">
                      {unit === "page" ? "Pages" : "Slides"}
                    </span>
                    <input
                      className="input"
                      value={range.start}
                      onChange={(e) => setRange({ start: e.target.value })}
                      placeholder="1"
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label={`First ${unit} of ${file.name}`}
                      aria-describedby={`pages-${index}`}
                      aria-invalid={!!error}
                      style={boxStyle(!!error)}
                    />
                    <span className="text-[12px] text-fg-3" aria-hidden>
                      –
                    </span>
                    <input
                      className="input"
                      value={range.end}
                      onChange={(e) => setRange({ end: e.target.value })}
                      placeholder="end"
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      aria-label={`Last ${unit} of ${file.name}, or end`}
                      aria-describedby={`pages-${index}`}
                      aria-invalid={!!error}
                      style={boxStyle(!!error)}
                    />
                    {count ? (
                      <span className="text-[11px] text-fg-3">
                        of {count}
                      </span>
                    ) : null}
                  </div>
                  {error ? (
                    <p className="mt-1 text-[11px] text-red" role="alert">
                      {error}
                    </p>
                  ) : (
                    !range.start.trim() && !range.end.trim() && (
                      <p className="mt-1 text-[11px] text-fg-3">Leave both empty to read every {unit}.</p>
                    )
                  )}
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
