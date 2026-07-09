import { getToken } from "./api";
import { queryClient } from "./queryClient";
import { toast } from "./toast";
import type { Message, Page } from "../types";

type ServerEvent =
  | { type: "message"; message: Message }
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

const messageListeners = new Set<MessageListener>();
const stateListeners = new Set<StateListener>();

function url(token: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}

function notifyState(connected: boolean) {
  stateListeners.forEach((fn) => fn(connected));
}

function handleIncoming(message: Message) {
  queryClient.setQueryData<Page<Message>>(
    ["conversations", message.conversationId, "messages"],
    (old) => {
      if (!old) return old;
      if (old.items.some((m) => m.id === message.id)) return old;
      return { ...old, items: [...old.items, message] };
    },
  );
  queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
  queryClient.invalidateQueries({ queryKey: ["conversations", "direct"] });
  queryClient.invalidateQueries({ queryKey: ["conversations", "groups"] });
  messageListeners.forEach((fn) => fn(message));
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

  socket = new WebSocket(url(token));

  socket.onopen = () => {
    attempts = 0;
    startHeartbeat();
    notifyState(true);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  socket.onmessage = (e) => {
    lastActivity = Date.now();
    let event: ServerEvent;
    try {
      event = JSON.parse(e.data);
    } catch {
      return;
    }
    if (event.type === "message") handleIncoming(event.message);
    else if (event.type === "error") toast.error(event.message);
  };

  socket.onclose = () => {
    socket = null;
    window.clearInterval(heartbeatTimer);
    notifyState(false);
    scheduleReconnect();
  };

  socket.onerror = () => {
    socket?.close();
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
  if (document.visibilityState === "visible") reconnectNowIfDown();
});

export const ws = {
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

  sendChat(conversationId: number, body: string): boolean {
    if (!this.isConnected()) return false;
    socket!.send(JSON.stringify({ type: "send", conversationId, body }));
    return true;
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
