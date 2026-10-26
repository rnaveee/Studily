import { useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Gift, Percent, Trophy, type LucideIcon } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { openProgressWhatsNew } from "../progress/ProgressWhatsNew";
import { openSurveyPrompt } from "../survey/SurveyPrompt";
import type { ParseAvailability, SurveyDto } from "../../types";

const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;
const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

export interface FeatureNotice {
  id: string;
  storageKey: string;
  date: string;
  title: string;
  body: string;
  icon: LucideIcon;
  action: { label: string; to?: string; run?: () => void };
}

export interface FeatureNoticeState extends FeatureNotice {
  read: boolean;
  stale: boolean;
}

const SURVEY: FeatureNotice = {
  id: "survey",
  storageKey: "studily.banner.survey.fall-2026",
  date: "2026-10-23T12:00:00",
  title: "Help shape Studily",
  body: "Answer a short survey and earn a diamond chest.",
  icon: Gift,
  action: { label: "Take the survey", run: openSurveyPrompt },
};

const PROGRESS: FeatureNotice = {
  id: "progress",
  storageKey: "studily.banner.progress",
  date: "2026-10-08T12:00:00",
  title: "XP, badges and chests",
  body: "Your studying now earns XP, badges and chests!",
  icon: Trophy,
  action: { label: "See what's new", to: "/learn", run: openProgressWhatsNew },
};

const GRADECALC: FeatureNotice = {
  id: "gradecalc",
  storageKey: "studily.banner.gradecalc",
  date: "2026-10-25T12:00:00",
  title: "Grade calculator",
  body: "New: a grade calculator. See what you need on your final.",
  icon: Percent,
  action: { label: "Try it", to: "/grade-calculator" },
};

const PARSER: FeatureNotice = {
  id: "parser",
  storageKey: "studily.banner.parser",
  date: "2026-09-08T12:00:00",
  title: "Build a course from your outline",
  body: "Upload a syllabus and we'll fill in the times and deadlines. It's in beta and won't always get it right, so check everything before you save.",
  icon: FileText,
  action: { label: "Upload a syllabus", to: "/courses" },
};

const listeners = new Set<() => void>();
const memoryRead = new Set<string>();
const memoryCleared = new Set<string>();
let version = 0;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function isRead(key: string): boolean {
  if (memoryRead.has(key)) return true;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function isCleared(key: string): boolean {
  if (memoryCleared.has(key)) return true;
  try {
    return localStorage.getItem(`${key}.cleared`) === "1";
  } catch {
    return false;
  }
}

export function clearFeatureNotices(keys: string[]) {
  for (const key of keys) {
    memoryCleared.add(key);
    memoryRead.add(key);
    try {
      localStorage.setItem(`${key}.cleared`, "1");
      localStorage.setItem(key, "1");
    } catch {
    }
  }
  version += 1;
  listeners.forEach((cb) => cb());
}

export function markFeatureNoticesRead(keys: string[]) {
  const fresh = keys.filter((k) => !isRead(k));
  if (fresh.length === 0) return;
  for (const key of fresh) {
    memoryRead.add(key);
    try {
      localStorage.setItem(key, "1");
    } catch {
    }
  }
  version += 1;
  listeners.forEach((cb) => cb());
}

export function useFeatureNotices(): FeatureNoticeState[] {
  const { user, guest } = useAuth();
  const readVersion = useSyncExternalStore(subscribe, () => version, () => 0);

  const { data: parseAvailability } = useQuery({
    queryKey: ["course-parse-enabled"],
    queryFn: () => api.get<ParseAvailability>("/courses/parse/enabled"),
    staleTime: 5 * 60_000,
    enabled: !!user && !guest,
  });

  const { data: survey } = useQuery({
    queryKey: ["survey"],
    queryFn: () => api.get<SurveyDto>("/survey"),
    enabled: !!user && !guest && !!user.emailVerified,
  });

  const createdAt = user?.createdAt;

  return useMemo(() => {
    if (!user || guest) return [];
    const visible: FeatureNotice[] = [];
    if (survey && survey.open && survey.eligible && !survey.completed) visible.push(SURVEY);
    visible.push(PROGRESS);
    if (createdAt && Date.now() - new Date(createdAt).getTime() >= NEW_ACCOUNT_MS) visible.push(GRADECALC);
    if (parseAvailability?.enabled) visible.push(PARSER);
    return visible.filter((n) => !isCleared(n.storageKey)).map((n) => {
      const read = isRead(n.storageKey);
      return { ...n, read, stale: read && Date.now() - new Date(n.date).getTime() > RECENT_MS };
    });
  }, [user, guest, survey, parseAvailability, createdAt, readVersion]);
}
