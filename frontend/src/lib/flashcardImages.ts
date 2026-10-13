import { api } from "./api";

export const FLASHCARD_IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp";
export const MAX_FLASHCARD_IMAGE_BYTES = 10 * 1024 * 1024;

export interface UploadedFlashcardImage {
  key: string;
  width: number;
  height: number;
}

export function flashcardImageUrl(key: string): string {
  return `/api/public/flashcard-images/${encodeURIComponent(key)}`;
}

export function uploadFlashcardImage(file: File): Promise<UploadedFlashcardImage> {
  const fd = new FormData();
  fd.append("file", file);
  return api.post<UploadedFlashcardImage>("/flashcard-images", fd);
}
