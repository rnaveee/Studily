import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import { api } from "../../lib/api";
import type { FlashcardSetSummary } from "../../types";

interface Props {
  userId: number;
  title: string;
  emptyHint?: string;
}

export default function PublicSetsSection({ userId, title, emptyHint }: Props) {
  const sets = useQuery({
    queryKey: ["flashcards", "public", userId],
    queryFn: () => api.get<FlashcardSetSummary[]>(`/users/${userId}/flashcard-sets`),
    enabled: Number.isFinite(userId),
  });

  const list = sets.data ?? [];
  if (list.length === 0 && !(emptyHint && sets.isSuccess)) return null;

  return (
    <div className="card">
      <div className="px-5 pb-1 pt-4">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
          <Layers size={14} className="text-fg-3" />
          {title}
        </h3>
      </div>
      {list.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-fg-3">{emptyHint}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
          {list.map((s) => (
            <li key={s.id}>
              <Link
                to={`/sets/${s.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hi"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
                >
                  <Layers size={14} style={{ color: "var(--accent)" }} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-fg">{s.title}</span>
                  <span className="block text-[11px] text-fg-3">
                    {s.cardCount} {s.cardCount === 1 ? "card" : "cards"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
