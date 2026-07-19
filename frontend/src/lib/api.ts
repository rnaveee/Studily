import { DAYS } from "../types";

const TOKEN_KEY = "studily.token";
const GUEST_KEY = "studily.guest";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function isGuestMode(): boolean {
  return !getToken() && localStorage.getItem(GUEST_KEY) === "1";
}

export function setGuestMode(on: boolean) {
  if (on) localStorage.setItem(GUEST_KEY, "1");
  else localStorage.removeItem(GUEST_KEY);
}

const GUEST_EMPTY_LISTS = new Set([
  "/semesters",
  "/courses",
  "/calendar",
  "/calendar/events",
  "/flashcard-sets",
  "/friends",
  "/friends/incoming",
  "/friends/pending",
  "/conversations",
]);

function guestWeek(): unknown {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const days = DAYS.map((dayOfWeek, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date: iso(d), dayOfWeek, meetings: [], items: [] };
  });
  return {
    weekStart: days[0].date,
    weekEnd: days[6].date,
    semester: null,
    days,
    dueThisWeek: [],
    nextExam: null,
  };
}

function guestStub(path: string): unknown {
  const p = path.split("?")[0];
  if (GUEST_EMPTY_LISTS.has(p)) return [];
  if (p === "/dashboard/week") return guestWeek();
  if (p === "/settings/notifications")
    return { messages: true, classReminders: true, eventDayOf: true, itemWeekAhead: true, examDayOf: true };
  if (/^\/users\/\d+\/schedule$/.test(p)) return { semester: null, courses: [] };
  return undefined;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  if (!token && isGuestMode() && !path.startsWith("/auth") && path !== "/support") {
    if (method === "GET") {
      const stub = guestStub(path);
      if (stub !== undefined) return stub as T;
      throw new ApiError(401, "Sign in to view this");
    }
    window.location.assign("/login");
    throw new ApiError(401, "Sign in to do that");
  }

  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  if (res.status === 401 && getToken()) {
    setToken(null);
    if (window.location.pathname !== "/login") window.location.assign("/login");
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function requestBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { headers });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res.blob();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  getBlob: (path: string) => requestBlob(path),
};
