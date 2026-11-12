import { useRef, useState, type DragEvent, type ReactNode } from "react";

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

export default function FileDropZone({
  onFiles,
  disabled = false,
  label,
  className,
  children,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  function enter(e: DragEvent) {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    setDragging(true);
  }

  function over(e: DragEvent) {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault();
  }

  function leave(e: DragEvent) {
    if (disabled || !hasFiles(e)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }

  function drop(e: DragEvent) {
    if (disabled || !hasFiles(e)) return;
    e.preventDefault();
    depth.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div
      onDragEnter={enter}
      onDragOver={over}
      onDragLeave={leave}
      onDrop={drop}
      className={`relative ${className ?? ""}`}
    >
      {children}
      {dragging && (
        <div
          className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-2xl px-4 text-center text-[13px] font-medium text-accent"
          style={{
            border: "2px dashed var(--accent)",
            background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
