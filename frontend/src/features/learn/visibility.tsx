import { Globe, Users } from "lucide-react";
import type { FlashcardSetVisibility } from "../../types";

export const VISIBILITY_OPTIONS: { value: FlashcardSetVisibility; label: string }[] = [
  { value: "PRIVATE", label: "Private" },
  { value: "FRIENDS", label: "Friends" },
  { value: "PUBLIC", label: "Public" },
];

export const VISIBILITY_HINT: Record<FlashcardSetVisibility, string> = {
  PRIVATE: "Only you can see this set.",
  FRIENDS: "Your friends can open the link and study it, and it's listed on your profile for them.",
  PUBLIC: "Anyone with the link can view and study it, and it's listed on your profile.",
};

export function VisibilityBadge({ visibility }: { visibility: FlashcardSetVisibility }) {
  if (visibility === "PRIVATE") return null;
  const Icon = visibility === "PUBLIC" ? Globe : Users;
  return (
    <span className="badge badge-muted inline-flex shrink-0 items-center gap-1">
      <Icon size={10} />
      {visibility === "PUBLIC" ? "Public" : "Friends"}
    </span>
  );
}
