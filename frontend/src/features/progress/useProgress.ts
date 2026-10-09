import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isGuestMode } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { flairRef } from "../../lib/flairs";
import { applyDelta } from "../../lib/progressDelta";
import { toast } from "../../lib/toast";
import type {
  BadgeDto,
  ChestDto,
  FlairDto,
  FlairEquipResult,
  FlairPurchaseResult,
  Page,
  ProgressDto,
  PublicProgressDto,
  StreakRestoreResult,
  StreakWeekDto,
  StudySessionDto,
  StudySessionSummaryDto,
} from "../../types";

export const HISTORY_PAGE_SIZE = 20;

export const progressKeys = {
  me: ["progress", "me"] as const,
  user: (userId: number) => ["progress", userId] as const,
  badges: (who: number | "me") => ["badges", who] as const,
  chests: ["chests"] as const,
  flairs: ["flairs"] as const,
  activeSession: ["study-session", "active"] as const,
  streak: ["study-session", "streak"] as const,
  history: ["study-session", "history"] as const,
};

export function useProgressEnabled(): boolean {
  const { user } = useAuth();
  return !!user && !isGuestMode();
}

export function useMyProgress() {
  const enabled = useProgressEnabled();
  const qc = useQueryClient();
  return useQuery({
    queryKey: progressKeys.me,
    queryFn: async () => {
      const progress = await api.get<ProgressDto>("/progress/me");
      qc.invalidateQueries({ queryKey: progressKeys.flairs });
      return progress;
    },
    enabled,
  });
}

export function useUserProgress(userId: number) {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.user(userId),
    queryFn: () => api.get<PublicProgressDto>(`/users/${userId}/progress`),
    enabled: enabled && Number.isFinite(userId),
    retry: false,
  });
}

export function useBadges(who: number | "me") {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.badges(who),
    queryFn: () => api.get<BadgeDto[]>(who === "me" ? "/badges" : `/users/${who}/badges`),
    enabled: enabled && (who === "me" || Number.isFinite(who)),
    retry: false,
  });
}

export function useChests(active = true) {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.chests,
    queryFn: () => api.get<ChestDto[]>("/chests"),
    enabled: enabled && active,
  });
}

export function useActiveSession() {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.activeSession,
    queryFn: async () => (await api.get<StudySessionDto | undefined>("/study-sessions/active")) ?? null,
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data ? 30_000 : false),
  });
}

export function useStreakWeek() {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.streak,
    queryFn: () => api.get<StreakWeekDto>("/study-sessions/streak"),
    enabled,
  });
}

export function useRestoreStreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<StreakRestoreResult>("/study-sessions/streak/restore"),
    onSuccess: (res) => {
      qc.setQueryData(progressKeys.streak, res.streak);
      applyDelta(res.delta, qc, { toastXp: false });
    },
  });
}

export function useSessionHistory() {
  const enabled = useProgressEnabled();
  return useInfiniteQuery({
    queryKey: progressKeys.history,
    queryFn: ({ pageParam }) =>
      api.get<Page<StudySessionSummaryDto>>(
        `/study-sessions?page=${pageParam}&size=${HISTORY_PAGE_SIZE}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.length : undefined),
    enabled,
  });
}

export function useFlairs() {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.flairs,
    queryFn: () => api.get<FlairDto[]>("/flairs"),
    enabled,
    retry: false,
  });
}

export function useEquipFlair() {
  const qc = useQueryClient();
  const { user, setUser } = useAuth();
  return useMutation({
    mutationFn: (code: string | null) => api.put<FlairEquipResult>("/me/flair", { code }),
    onSuccess: (res) => {
      const equipped = res?.equipped ?? null;
      qc.setQueryData<FlairDto[]>(progressKeys.flairs, (old) =>
        old?.map((f) => ({ ...f, equipped: equipped ? f.code === equipped.code : false })),
      );
      if (user) setUser({ ...user, flair: equipped ? flairRef(equipped) : null });
      qc.invalidateQueries({ queryKey: progressKeys.flairs });
    },
  });
}

export function useBuyFlair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<FlairPurchaseResult>(`/flairs/${encodeURIComponent(code)}/purchase`),
    onSuccess: (res) => {
      qc.setQueryData<FlairDto[]>(progressKeys.flairs, (old) =>
        old?.map((f) => (f.code === res.flair.code ? res.flair : f)),
      );
      qc.setQueryData<ProgressDto>(progressKeys.me, (old) => (old ? { ...old, coins: res.coins } : old));
      qc.invalidateQueries({ queryKey: ["progress"] });
      toast.success(`${res.flair.title} is yours`);
    },
  });
}
