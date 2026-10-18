import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { GenAvailability } from "../../types";
import type { DropRules } from "../courses/ParseDropzone";

export const GEN_AVAILABILITY_KEY = ["flashcard-gen-enabled"];

export const DOCUMENT_RULES: DropRules = {
  accept:
    ".pdf,.pptx,.docx,.png,.jpg,.jpeg,.webp,.txt,.md,application/pdf,image/png,image/jpeg,image/webp,text/plain,text/markdown," +
    "application/vnd.openxmlformats-officedocument.presentationml.presentation," +
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  types: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  extensions: ["pdf", "pptx", "docx", "png", "jpg", "jpeg", "webp", "txt", "md"],
  maxFiles: 3,
  maxTotalBytes: 50 * 1024 * 1024,
  maxFileBytes: 25 * 1024 * 1024,
  hint: "PDF, PowerPoint, Word, images or text. Up to 3 files, 25 MB each.",
  typeError: "Only PDF, PowerPoint (.pptx), Word (.docx), image and text files can be read.",
};

export function useGenAvailability(enabled = true) {
  return useQuery({
    queryKey: GEN_AVAILABILITY_KEY,
    queryFn: () => api.get<GenAvailability>("/flashcard-sets/generate/enabled"),
    staleTime: 60_000,
    enabled,
  });
}

export function genBlocked(a: GenAvailability | undefined): boolean {
  return !!a && (a.paused || a.remaining <= 0);
}

export function genQuotaText(a: GenAvailability | undefined): string | null {
  if (!a || !a.enabled) return null;
  if (a.paused) return "Making cards from documents is paused for now. Try again later.";
  if (a.remaining <= 0) return `You've used all ${a.monthlyLimit} documents this month. They reset on the 1st.`;
  return `${a.remaining} of ${a.monthlyLimit} documents left this month.`;
}
