import type { QueryClient } from "@tanstack/react-query";
import { toast } from "./toast";
import type { ChestDto, ProgressDelta, ProgressDto } from "../types";

export type ProgressMoment =
  | { kind: "level-up"; levelBefore: number; levelAfter: number; coinsGained: number }
  | { kind: "chests"; chests: ChestDto[] };

type Listener = (moment: ProgressMoment) => void;

const listeners = new Set<Listener>();

export function onProgressMoment(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(moment: ProgressMoment) {
  listeners.forEach((l) => l(moment));
}

export function offerChests(chests: ChestDto[]) {
  const unopened = chests.filter((c) => !c.openedAt);
  if (unopened.length > 0) emit({ kind: "chests", chests: unopened });
}

export function invalidateProgress(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["progress"] });
  qc.invalidateQueries({ queryKey: ["badges"] });
  qc.invalidateQueries({ queryKey: ["chests"] });
  qc.invalidateQueries({ queryKey: ["flairs"] });
}

export function applyDelta(
  delta: ProgressDelta | null | undefined,
  qc: QueryClient,
  options: { toastXp?: boolean; shownBadges?: string[]; shownFlairs?: string[] } = {},
) {
  if (!delta) return;
  const { toastXp = true, shownBadges = [], shownFlairs = [] } = options;

  qc.setQueryData<ProgressDto>(["progress", "me"], (old) =>
    old
      ? {
          ...old,
          level: delta.levelAfter,
          xp: delta.xp,
          xpIntoLevel: delta.xpIntoLevel,
          xpForNext: delta.xpForNext,
          coins: delta.coins,
        }
      : old,
  );
  invalidateProgress(qc);

  if (toastXp && delta.xpGained > 0) toast.success(`+${delta.xpGained} XP`);

  if (delta.levelAfter > delta.levelBefore) {
    emit({
      kind: "level-up",
      levelBefore: delta.levelBefore,
      levelAfter: delta.levelAfter,
      coinsGained: delta.coinsGained,
    });
  }

  for (const badge of delta.newBadges) {
    if (!shownBadges.includes(badge.code)) toast.success(`New badge unlocked: ${badge.title}`);
  }

  for (const flair of delta.newFlairs ?? []) {
    if (!shownFlairs.includes(flair.code)) toast.success(`New flair unlocked: ${flair.title}`);
  }

  offerChests(delta.chests);
}
