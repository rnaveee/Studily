import type { InfiniteData } from "@tanstack/react-query";
import { getToken } from "./api";
import { queryClient } from "./queryClient";
import { toast } from "./toast";
import { SUSPENDED_EVENT } from "./moderation";
import type { Conversation, Message, MessageLike, Page } from "../types";

type ServerEvent =
  | { type: "message"; message: Message }
  | { type: "messageEdited"; message: Message }
  | { type: "messageDeleted"; conversationId: number; messageId: number }
  | { type: "conversationCleared"; conversationId: number }
  | { type: "like"; like: MessageLike }
  | { type: "read"; conversationId: number; userId: number; at: string }
  | { type: "pong" }
  | { type: "error"; message: string };

type MessageListener = (message: Message) => void;
type StateListener = (connected: boolean) => void;

const HEARTBEAT_MS = 25_000;
const DEAD_AFTER_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;

let socket: WebSocket | null = null;
let shouldRun = false;
let attempts = 0;
let reconnectTimer: number | undefined;
let heartbeatTimer: number | undefined;
let lastActivity = 0;
type PendingSend = { conversationId: number; body: string; replyToId: number | null; at: number };
let pendingSend: PendingSend | null = null;
const sendFailureListeners = new Set<(p: PendingSend) => void>();
const SEND_ERROR_WINDOW_MS = 5000;
const STALE_SEND_MS = 50_000;
let currentUserId: number | null = null;

const messageListeners = new Set<MessageListener>();
const stateListeners = new Set<StateListener>();

const WS_PROTOCOL = "studily";

function url(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

function notifyState(connected: boolean) {
  stateListeners.forEach((fn) => fn(connected));
}

export function applyLikeToCache(like: MessageLike, meId?: number) {
  queryClient.setQueryData<InfiniteData<Page<Message>>>(
    ["conversations", like.conversationId, "messages"],
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          items: p.items.map((m) =>
            m.id === like.messageId
              ? {
                  ...m,
                  likeCount: like.likeCount,
                  likedByMe: meId != null ? like.likedBy.includes(meId) : m.likedByMe,
                }
              : m,
          ),
        })),
      };
    },
  );
}

export function optimisticToggleLike(conversationId: number, messageId: number) {
  queryClient.setQueryData<InfiniteData<Page<Message>>>(
    ["conversations", conversationId, "messages"],
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          items: p.items.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  likedByMe: !m.likedByMe,
                  likeCount: Math.max(0, m.likeCount + (m.likedByMe ? -1 : 1)),
                }
              : m,
          ),
        })),
      };
    },
  );
}

export function appendMessageToCache(message: Message) {
  queryClient.setQueryData<InfiniteData<Page<Message>>>(
    ["conversations", message.conversationId, "messages"],
    (old) => {
      if (!old || old.pages.length === 0) return old;
      if (old.pages.some((p) => p.items.some((m) => m.id === message.id))) return old;
      const pages = old.pages.slice();
      pages[0] = { ...pages[0], items: [...pages[0].items, message] };
      return { ...old, pages };
    },
  );
}

export function applyEditToCache(message: Message) {
  queryClient.setQueryData<InfiniteData<Page<Message>>>(
    ["conversations", message.conversationId, "messages"],
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          items: p.items.map((m) =>
            m.id === message.id
              ? { ...m, body: message.body, editedAt: message.editedAt }
              : m.replyTo?.id === message.id
                ? { ...m, replyTo: { ...m.replyTo, body: message.body.slice(0, 200) } }
                : m,
          ),
        })),
      };
    },
  );
  invalidateConversationLists();
}

export function removeMessageFromCache(conversationId: number, messageId: number) {
  queryClient.setQueryData<InfiniteData<Page<Message>>>(
    ["conversations", conversationId, "messages"],
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          items: p.items
            .filter((m) => m.id !== messageId)
            .map((m) =>
              m.replyTo?.id === messageId
                ? { ...m, replyTo: { ...m.replyTo, senderId: null, senderName: null, body: null, deleted: true } }
                : m,
            ),
        })),
      };
    },
  );
  invalidateConversationLists();
}

export function clearMessagesInCache(conversationId: number) {
  queryClient.setQueryData<InfiniteData<Page<Message>>>(
    ["conversations", conversationId, "messages"],
    (old) => (old ? { pages: [{ items: [], hasMore: false }], pageParams: [null] } : old),
  );
  invalidateConversationLists();
}

export function invalidateConversationLists() {
  queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
  queryClient.invalidateQueries({ queryKey: ["conversations", "direct"] });
  queryClient.invalidateQueries({ queryKey: ["conversations", "groups"] });
}

export function applyReadToCache(conversationId: number, at: string) {
  queryClient.setQueryData<Conversation>(["conversations", conversationId], (old) =>
    old ? { ...old, otherReadAt: at } : old,
  );
  for (const key of ["direct", "list"] as const) {
    queryClient.setQueryData<Conversation[]>(["conversations", key], (old) =>
      old?.map((c) => (c.id === conversationId ? { ...c, otherReadAt: at } : c)),
    );
  }
}

function handleIncoming(message: Message) {
  appendMessageToCache(message);
  invalidateConversationLists();
  messageListeners.forEach((fn) => fn(message));
}

function sendPresence() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(
    JSON.stringify({ type: "presence", foreground: document.visibilityState === "visible" }),
  );
}

function startHeartbeat() {
  lastActivity = Date.now();
  window.clearInterval(heartbeatTimer);
  heartbeatTimer = window.setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (Date.now() - lastActivity > DEAD_AFTER_MS) {
      socket.close();
      return;
    }
    socket.send(JSON.stringify({ type: "ping" }));
  }, HEARTBEAT_MS);
}

function scheduleReconnect() {
  if (!shouldRun) return;
  const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempts) + Math.random() * 500;
  attempts += 1;
  window.clearTimeout(reconnectTimer);
  reconnectTimer = window.setTimeout(open, delay);
}

function open() {
  const token = getToken();
  if (!shouldRun || !token || socket) return;

  const sock = new WebSocket(url(), [WS_PROTOCOL, token]);
  socket = sock;

  sock.onopen = () => {
    if (socket !== sock) return;
    attempts = 0;
    startHeartbeat();
    sendPresence();
    notifyState(true);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  sock.onmessage = (e) => {
    if (socket !== sock) return;
    lastActivity = Date.now();
    let event: ServerEvent;
    try {
      event = JSON.parse(e.data);
    } catch {
      return;
    }
    if (event.type === "message") {
      pendingSend = null;
      handleIncoming(event.message);
    }
    else if (event.type === "messageEdited") applyEditToCache(event.message);
    else if (event.type === "messageDeleted")
      removeMessageFromCache(event.conversationId, event.messageId);
    else if (event.type === "conversationCleared") clearMessagesInCache(event.conversationId);
    else if (event.type === "like") applyLikeToCache(event.like, currentUserId ?? undefined);
    else if (event.type === "read") applyReadToCache(event.conversationId, event.at);
    else if (event.type === "error") {
      const failed = pendingSend;
      pendingSend = null;
      if (failed && Date.now() - failed.at < SEND_ERROR_WINDOW_MS) {
        sendFailureListeners.forEach((l) => l(failed));
      }
      toast.error(event.message);
    }
  };

  sock.onclose = (e) => {
    if (socket !== sock) return;
    socket = null;
    window.clearInterval(heartbeatTimer);
    notifyState(false);
    if (e.code === 4403) {
      shouldRun = false;
      window.clearTimeout(reconnectTimer);
      window.dispatchEvent(new Event(SUSPENDED_EVENT));
      return;
    }
    scheduleReconnect();
  };

  sock.onerror = () => {
    sock.close();
  };
}

function reconnectNowIfDown() {
  if (shouldRun && !socket) {
    window.clearTimeout(reconnectTimer);
    attempts = 0;
    open();
  }
}

window.addEventListener("online", reconnectNowIfDown);
document.addEventListener("visibilitychange", () => {
  sendPresence();
  if (document.visibilityState === "visible") reconnectNowIfDown();
});
window.addEventListener("pagehide", () => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "presence", foreground: false }));
  }
});

export const ws = {
  setUserId(id: number | null) {
    currentUserId = id;
  },


  connect() {
    shouldRun = true;
    open();
  },

  disconnect() {
    shouldRun = false;
    window.clearTimeout(reconnectTimer);
    window.clearInterval(heartbeatTimer);
    socket?.close();
    socket = null;
  },

  isConnected(): boolean {
    return socket?.readyState === WebSocket.OPEN;
  },

  sendChat(conversationId: number, body: string, replyToId?: number | null): boolean {
    if (!this.isConnected() || Date.now() - lastActivity > STALE_SEND_MS) return false;
    pendingSend = { conversationId, body, replyToId: replyToId ?? null, at: Date.now() };
    socket!.send(JSON.stringify({ type: "send", conversationId, body, replyToId: replyToId ?? null }));
    return true;
  },

  onSendFailed(listener: (p: PendingSend) => void) {
    sendFailureListeners.add(listener);
    return () => {
      sendFailureListeners.delete(listener);
    };
  },

  markRead(conversationId: number) {
    if (!this.isConnected()) return;
    socket!.send(JSON.stringify({ type: "markRead", conversationId }));
  },

  onMessage(fn: MessageListener): () => void {
    messageListeners.add(fn);
    return () => messageListeners.delete(fn);
  },

  onState(fn: StateListener): () => void {
    stateListeners.add(fn);
    return () => stateListeners.delete(fn);
  },
};
