import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { applyDelta } from "../../lib/progressDelta";
import { useProgressEnabled } from "../progress/useProgress";
import type {
  FlashcardRunCardResult,
  FlashcardRunMode,
  FlashcardRunResult,
  FlashcardRunStart,
} from "../../types";

export const MIN_RUN_CARDS = 5;

export type RunStatus = "idle" | "running" | "completing" | "done" | "failed";

export function cardIdOf(key: string): number | null {
  return /^\d+$/.test(key) ? Number(key) : null;
}

export function useFlashcardRun(setId: number, mode: FlashcardRunMode, cards: { id?: number }[]) {
  const qc = useQueryClient();
  const signedIn = useProgressEnabled();
  const eligible = signedIn && cards.filter((c) => c.id != null).length >= MIN_RUN_CARDS;
  const run = useRef<Promise<number | null> | null>(null);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [result, setResult] = useState<FlashcardRunResult | null>(null);

  const start = useCallback(() => {
    if (!eligible) return;
    setResult(null);
    run.current = api
      .post<FlashcardRunStart>(`/flashcard-sets/${setId}/runs`, { mode })
      .then((r) => r.runId)
      .catch(() => null);
    setStatus("running");
  }, [eligible, setId, mode]);

  const complete = useCallback(
    async (results: FlashcardRunCardResult[]) => {
      const pending = run.current;
      run.current = null;
      if (!pending) return null;
      setStatus("completing");
      const runId = await pending;
      const unique = [...new Map(results.map((r) => [r.cardId, r])).values()];
      if (runId == null || unique.length === 0) {
        setStatus("failed");
        return null;
      }
      try {
        const res = await api.post<FlashcardRunResult>(`/flashcard-runs/${runId}/complete`, { results: unique });
        setResult(res);
        setStatus("done");
        applyDelta(res.delta, qc);
        return res;
      } catch {
        setStatus("failed");
        return null;
      }
    },
    [qc],
  );

  const reset = useCallback(() => {
    run.current = null;
    setResult(null);
    setStatus("idle");
  }, []);

  const isActive = useCallback(() => run.current != null, []);

  return { eligible, status, result, start, complete, reset, isActive };
}
