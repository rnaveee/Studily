import { api, ApiError, getToken } from "../../lib/api";

export type BankFileKind = "LECTURE" | "ASSIGNMENT" | "PRACTICE_EXAM" | "NOTES" | "OTHER";
export type BankFileStatus = "QUEUED" | "PROCESSING" | "READY" | "FAILED";
export type BotMode = "CHAT" | "PRACTICE";
export type BotRole = "USER" | "BOT";
export type BotMessageKind = "TEXT" | "PROBLEM" | "GRADE";
export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "CLASS";
export type Verdict = "CORRECT" | "PARTIAL" | "INCORRECT";

export interface BankStatus {
  enabled: boolean;
  usedBytes: number;
  quotaBytes: number;
  fileCount: number;
  maxFiles: number;
  maxFileBytes: number;
  maxFilesPerRequest: number;
}

export interface BankFile {
  id: number;
  courseId: number | null;
  chatId: number | null;
  name: string;
  contentType: string;
  kind: BankFileKind;
  sizeBytes: number;
  status: BankFileStatus;
  statusDetail: string | null;
  pageCount: number | null;
  chunkCount: number;
  previewable: boolean;
  createdAt: string;
  indexedAt: string | null;
}

export interface Citation {
  index: number;
  fileId: number;
  fileName: string;
  page: number | null;
  pageTo: number | null;
  quote: string;
  previewable: boolean;
}

export interface Problem {
  number: number;
  statement: string;
  fromClass: boolean;
  sources: Citation[];
}

export interface Grade {
  verdict: Verdict;
  feedback: string;
  steps: string[];
  solution: string | null;
}

export interface BotMessage {
  id: number;
  role: BotRole;
  kind: BotMessageKind;
  content: string;
  citations: Citation[];
  problem: Problem | null;
  grade: Grade | null;
  createdAt: string;
}

export interface BotChatSummary {
  id: number;
  mode: BotMode;
  courseId: number | null;
  courseName: string | null;
  title: string;
  difficulty: Difficulty | null;
  updatedAt: string;
}

export interface BotChat extends BotChatSummary {
  topic: string | null;
  temporary: boolean;
  parentChatId: number | null;
  messages: BotMessage[];
  files: BankFile[];
}

export interface BotStatus {
  enabled: boolean;
  chatPaused: boolean;
  practicePaused: boolean;
  chatRemainingToday: number;
  practiceRemainingToday: number;
  readyFiles: number;
}

export interface AnswerResult {
  userMessage: BotMessage;
  grade: BotMessage | null;
  helpChatId: number | null;
  question: string | null;
}

export const bankApi = {
  status: () => api.get<BankStatus>("/bank/status"),
  courseFiles: (courseId: number) => api.get<BankFile[]>(`/bank/courses/${courseId}/files`),
  upload: (courseId: number, files: File[], kind?: BankFileKind) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    if (kind) form.append("kind", kind);
    return api.post<BankFile[]>(`/bank/courses/${courseId}/files`, form);
  },
  setKind: (id: number, kind: BankFileKind) => api.patch<BankFile>(`/bank/files/${id}`, { kind }),
  retry: (id: number) => api.post<BankFile>(`/bank/files/${id}/retry`),
  remove: (id: number) => api.del<void>(`/bank/files/${id}`),
  previewPath: (fileId: number, page: number) => `/bank/files/${fileId}/pages/${page}/preview`,
};

export const botApi = {
  status: () => api.get<BotStatus>("/bot/status"),
  chats: (mode: BotMode) => api.get<BotChatSummary[]>(`/bot/chats?mode=${mode}`),
  chat: (id: number) => api.get<BotChat>(`/bot/chats/${id}`),
  createChat: (courseId: number | null, parentChatId?: number | null) =>
    api.post<BotChat>("/bot/chats", { courseId, parentChatId: parentChatId ?? null }),
  rename: (id: number, title: string) => api.patch<BotChat>(`/bot/chats/${id}`, { title }),
  remove: (id: number) => api.del<void>(`/bot/chats/${id}`),
  uploadToChat: (id: number, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return api.post<BankFile[]>(`/bot/chats/${id}/files`, form);
  },
  startPractice: (courseId: number, difficulty: Difficulty, topic?: string) =>
    api.post<BotChat>("/bot/practice", { courseId, difficulty, topic: topic?.trim() || null }),
  nextProblem: (id: number) => api.post<BotMessage>(`/bot/practice/${id}/next`),
  reveal: (id: number) => api.post<BotMessage>(`/bot/practice/${id}/reveal`),
  answer: (id: number, text: string, photo?: Blob | null) => {
    const form = new FormData();
    if (text.trim()) form.append("text", text.trim());
    if (photo) form.append("photo", photo, "work.jpg");
    return api.post<AnswerResult>(`/bot/practice/${id}/answer`, form);
  },
};

export interface StreamHandlers {
  onMeta?: (meta: { chatId: number; searchQuery: string | null }) => void;
  onDelta: (text: string) => void;
  onDone: (message: BotMessage) => void;
  onError: (error: { code: string; message: string }) => void;
}

export async function streamAnswer(chatId: number, body: string, handlers: StreamHandlers, signal?: AbortSignal) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/event-stream" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`/api/bot/chats/${chatId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ body }),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = "StudilyBot couldn't answer that. Try again.";
    let code = "HTTP_" + res.status;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
      if (data?.code) code = data.code;
    } catch {
      void 0;
    }
    handlers.onError({ code, message });
    if (res.status === 401) throw new ApiError(401, message);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      dispatch(buffer.slice(0, boundary), handlers);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) dispatch(buffer, handlers);
}

function dispatch(frame: string, handlers: StreamHandlers) {
  let event = "message";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (!data.length) return;
  const payload = JSON.parse(data.join("\n"));
  if (event === "meta") handlers.onMeta?.(payload);
  else if (event === "delta") handlers.onDelta(payload.text);
  else if (event === "done") handlers.onDone(payload.message);
  else if (event === "error") handlers.onError(payload);
}
