import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Layers, Plus } from "lucide-react";
import { api } from "../../lib/api";
import { Skeleton } from "../../components/Skeleton";
import type { Course, FlashcardSet } from "../../types";

const SHOWN = 6;

const stackShadow = "4px 4px 0 -1px var(--surface), 4px 4px 0 0 var(--line)";

export default function FlashcardsPanel() {
  const sets = useQuery({
    queryKey: ["flashcards", "sets"],
    queryFn: () => api.get<FlashcardSet[]>("/flashcard-sets"),
  });
  const courses = useQuery({
    queryKey: ["courses", null],
    queryFn: () => api.get<Course[]>("/courses"),
  });

  const list = sets.data ?? [];
  const totalDue = list.reduce((n, s) => n + s.dueCount, 0);
  const totalCards = list.reduce((n, s) => n + s.cards.length, 0);
  const shown = [...list].sort((a, b) => b.dueCount - a.dueCount).slice(0, SHOWN);

  const headline = sets.isLoading
    ? "Loading your sets…"
    : sets.isError
      ? "Couldn't load your sets."
      : list.length === 0
        ? "Make your first set and start studying."
        : totalDue > 0
          ? `${totalDue} ${totalDue === 1 ? "card" : "cards"} due for review`
          : "All caught up. Nice work.";

  return (
    <Link
      to="/learn/flashcards"
      className="card card-raised card-lift group block p-5 xl:py-4"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 22%, var(--line))",
        backgroundImage:
          "radial-gradient(90% 120% at 0% 0%, color-mix(in srgb, var(--accent) 9%, transparent) 0%, transparent 60%), var(--card-grad)",
      }}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
        <div className="shrink-0 sm:w-52">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
            >
              <Layers size={18} className="text-accent" />
            </span>
            <h2 className="display text-[22px] font-bold text-fg">Flashcards</h2>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-fg-2">{headline}</p>
          {list.length > 0 && (
            <p className="mt-0.5 text-[12px] text-fg-3">
              {list.length} {list.length === 1 ? "set" : "sets"} · {totalCards}{" "}
              {totalCards === 1 ? "card" : "cards"}
            </p>
          )}
          <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent">
            {totalDue > 0 ? "Study now" : "Open flashcards"}
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </span>
        </div>

        <div className="@container min-w-0 flex-1">
          {sets.isLoading ? (
            <div className="grid grid-cols-2 gap-3 @md:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={64} className="rounded-xl" />
              ))}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 pb-1 pr-1 @md:grid-cols-3">
              {shown.map((s) => {
                const color = courses.data?.find((c) => c.id === s.courseId)?.color ?? "var(--accent)";
                return (
                  <li
                    key={s.id}
                    className="relative flex min-h-[64px] min-w-0 flex-col justify-between rounded-xl px-3 pb-2 pt-3"
                    style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: stackShadow }}
                  >
                    <span className="absolute inset-x-3 top-0 h-[3px] rounded-b-full" style={{ background: color }} />
                    <div className="line-clamp-2 text-[13px] font-medium leading-snug text-fg">{s.title}</div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="text-fg-3">
                        {s.cards.length} {s.cards.length === 1 ? "card" : "cards"}
                      </span>
                      {s.dueCount > 0 && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 font-semibold"
                          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
                        >
                          {s.dueCount} due
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
              {Array.from({ length: SHOWN - shown.length }, (_, i) => (
                <li
                  key={`empty-${i}`}
                  aria-hidden="true"
                  className="flex min-h-[64px] items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-medium text-fg-3"
                  style={{ border: "1.5px dashed var(--line)" }}
                >
                  <Plus size={14} />
                  New set
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Link>
  );
}
