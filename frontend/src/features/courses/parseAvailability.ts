import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { ParseAvailability } from "../../types";

export const PARSE_AVAILABILITY_KEY = ["course-parse-enabled"];

export function useParseAvailability(enabled = true) {
  return useQuery({
    queryKey: PARSE_AVAILABILITY_KEY,
    queryFn: () => api.get<ParseAvailability>("/courses/parse/enabled"),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function parseBlocked(a: ParseAvailability | undefined): boolean {
  return !!a && (a.paused || a.remaining <= 0);
}

export function parseQuotaText(a: ParseAvailability | undefined): string | null {
  if (!a || !a.enabled) return null;
  if (a.paused) return "Automatic imports are paused for today. Try again tomorrow.";
  if (a.remaining <= 0) {
    return `You've used all ${a.monthlyLimit} automatic imports this month. They reset on the 1st.`;
  }
  return `${a.remaining} of ${a.monthlyLimit} automatic imports left this month.`;
}
