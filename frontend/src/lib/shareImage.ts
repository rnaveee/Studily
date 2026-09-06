export const canCopyImages = typeof window !== "undefined" && "ClipboardItem" in window;

export function slugFilename(label?: string | null): string {
  const slug = (label ?? "schedule")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `studily-schedule-${slug || "schedule"}.png`;
}

export async function copyImage(blob: Promise<Blob>): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function saveImage(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
