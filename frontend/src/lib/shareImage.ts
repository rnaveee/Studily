export const canCopyImages = typeof window !== "undefined" && "ClipboardItem" in window;

export function slugFilename(label?: string | null): string {
  const slug = (label ?? "schedule")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `studily-schedule-${slug || "schedule"}.png`;
}

export async function copyImage(blob: Blob | Promise<Blob>): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export function downloadImage(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
