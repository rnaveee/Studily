import {
  DEMO_SEMESTER,
  demoCourses,
  demoFlashcardSets,
  demoExamPlan,
  demoItems,
  demoNotes,
  demoStats,
  demoTodoCategories,
  demoTodos,
  demoUpcomingExams,
  demoWeek,
  demoWeights,
} from "./demo";
import { SUSPENDED_EVENT } from "./moderation";

const TOKEN_KEY = "studily.token";
const GUEST_KEY = "studily.guest";
const ADMIN_TOKEN_KEY = "studily.admin";

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function tokenExpiresAt(): number | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json)?.exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string | null) {
  if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function isGuestMode(): boolean {
  if (typeof localStorage === "undefined") return false;
  return !getToken() && localStorage.getItem(GUEST_KEY) === "1";
}

export function setGuestMode(on: boolean) {
  if (on) localStorage.setItem(GUEST_KEY, "1");
  else localStorage.removeItem(GUEST_KEY);
}

const GUEST_EMPTY_LISTS = new Set([
  "/calendar/events",
  "/calendar/categories",
  "/courses/matches",
  "/friends",
  "/friends/incoming",
  "/friends/pending",
  "/conversations",
  "/flashcard-folders",
]);

const GUEST_EMPTY_PAGES = new Set(["/friends/schoolmates", "/friends/search"]);

function guestStub(path: string): unknown {
  const p = path.split("?")[0];
  if (GUEST_EMPTY_LISTS.has(p)) return [];
  if (GUEST_EMPTY_PAGES.has(p)) return { items: [], hasMore: false };

  if (p === "/semesters") return [DEMO_SEMESTER];
  if (p === "/semesters/current") return DEMO_SEMESTER;
  if (p === "/semesters/stats") return demoStats();
  if (p === "/exams/upcoming") return demoUpcomingExams();
  if (p === "/courses") return demoCourses();
  if (p === "/dashboard/week") return demoWeek();
  if (p === "/calendar") return demoItems();
  if (p === "/flashcard-sets") return demoFlashcardSets();
  if (p === "/todos") return demoTodos();
  if (p === "/todo-categories") return demoTodoCategories();
  if (p === "/calendar/feed-link") return { exists: false, createdAt: null, lastFetchedAt: null };
  if (p === "/school-feeds") return { available: false, feeds: [] };
  if (p === "/push/public-key") return { publicKey: null };
  if (p === "/settings/gpa-scale") return { scale: "FOUR_POINT", defaultScale: "FOUR_POINT", explicit: false };
  if (p === "/settings/privacy") return { readReceipts: true, scheduleVisibility: "FRIENDS" };
  if (p === "/settings/notifications")
    return { messages: true, classReminders: true, eventDayOf: true, itemWeekAhead: true, examDayOf: true, examCountdown: true };

  const course = p.match(/^\/courses\/(\d+)(\/\w+)?$/);
  if (course) {
    const id = Number(course[1]);
    switch (course[2]) {
      case undefined:      return demoCourses().find((c) => c.id === id) ?? null;
      case "/items":       return demoItems().filter((it) => it.courseId === id);
      case "/weights":     return demoWeights(id);
      case "/notes":       return demoNotes(id);
      case "/classmates":  return [];
    }
  }

  if (p === "/flashcard-study") {
    const q = new URLSearchParams(path.split("?")[1] ?? "");
    const courseId = Number(q.get("courseId"));
    if (!courseId) return undefined;
    const course = demoCourses().find((c) => c.id === courseId);
    const sets = demoFlashcardSets().filter((s) => s.courseId === courseId);
    return {
      kind: "course",
      id: courseId,
      title: course?.code ?? course?.name ?? "Course",
      setCount: sets.length,
      truncated: false,
      cards: sets.flatMap((s) => s.cards.map((c) => ({ ...c, setId: s.id }))),
    };
  }
  const plan = p.match(/^\/exams\/(\d+)\/plan$/);
  if (plan) return demoExamPlan(Number(plan[1]));

  const set = p.match(/^\/flashcard-sets\/(\d+)$/);
  if (set) return demoFlashcardSets().find((s) => s.id === Number(set[1])) ?? null;

  if (/^\/users\/\d+\/schedule$/.test(p)) return { semester: null, courses: [], visible: true };
  return undefined;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown, keepalive?: boolean): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  if (path.startsWith("/admin")) {
    const adminToken = getAdminToken();
    if (adminToken) headers["X-Admin-Token"] = adminToken;
  }

  if (!token && isGuestMode() && !path.startsWith("/auth") && path !== "/support" && !path.startsWith("/public/")) {
    if (method === "GET") {
      const stub = guestStub(path);
      if (stub !== undefined) return stub as T;
      throw new ApiError(401, "Sign in to view this");
    }
    throw new ApiError(401, "This is demo data. Sign up to add your own.");
  }

  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    keepalive,
  });

  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
      if (data?.code) code = data.code;
    } catch {
    }

    if (res.status === 401 && code === "ADMIN_LOCKED") {
      setAdminToken(null);
      throw new ApiError(res.status, message, code);
    }

    if (res.status === 403 && code === "ACCOUNT_SUSPENDED") {
      window.dispatchEvent(new Event(SUSPENDED_EVENT));
      throw new ApiError(res.status, message, code);
    }

    if (res.status === 401 && code === "SESSION_EXPIRED" && getToken()) {
      setToken(null);
      setAdminToken(null);
      setGuestMode(false);
      if (window.location.pathname !== "/login") window.location.replace("/login?expired=1");
      throw new ApiError(401, "Session expired");
    }

    throw new ApiError(res.status, message, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function requestBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (path.startsWith("/admin")) {
    const adminToken = getAdminToken();
    if (adminToken) headers["X-Admin-Token"] = adminToken;
  }
  const res = await fetch(`/api${path}`, { headers });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res.blob();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown, opts?: { keepalive?: boolean }) =>
    request<T>("POST", path, body, opts?.keepalive),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  getBlob: (path: string) => requestBlob(path),
};
