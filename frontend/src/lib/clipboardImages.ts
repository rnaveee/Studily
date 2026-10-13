export function imagesFrom(data: DataTransfer | null): File[] {
  return [...(data?.items ?? [])]
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((f): f is File => f !== null);
}

export function pastedImages(e: React.ClipboardEvent): File[] {
  const images = imagesFrom(e.clipboardData);
  if (images.length === 0 || e.clipboardData.getData("text/plain").trim()) return [];
  return images;
}
