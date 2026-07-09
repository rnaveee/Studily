import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users2, X } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { queryClient } from "../../lib/queryClient";
import { ws } from "../../lib/ws";
import Avatar from "../../components/Avatar";
import { useKeyboardBottomAnchor } from "../../lib/keyboardDock";
import type { Conversation, Message, Page, PublicUser } from "../../types";

function mergeThread(a: Message[], b: Message[]): Message[] {
  const byId = new Map<number, Message>();
  for (const m of a) byId.set(m.id, m);
  for (const m of b) byId.set(m.id, m);
  return [...byId.values()].sort((x, y) => x.id - y.id);
}

export default function ConversationPage() {
  const { id } = useParams();
  const convId = Number(id);
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState<Message[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const seededRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<{ height: number; top: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useKeyboardBottomAnchor(bottomRef);

  const [wsConnected, setWsConnected] = useState(ws.isConnected());
  useEffect(() => ws.onState(setWsConnected), []);

  useEffect(() => {
    setThread([]);
    setHasOlder(false);
    seededRef.current = false;
  }, [convId]);

  const conversation = useQuery({
    queryKey: ["conversations", convId],
    queryFn: () => api.get<Conversation>(`/conversations/${convId}`),
    enabled: Number.isFinite(convId),
    retry: false,
  });

  const messages = useQuery({
    queryKey: ["conversations", convId, "messages"],
    queryFn: () => api.get<Page<Message>>(`/conversations/${convId}/messages`),
    enabled: Number.isFinite(convId),
    refetchInterval: wsConnected ? false : 5000,
  });

  const latestPage = messages.data;
  useEffect(() => {
    if (!latestPage) return;
    if (latestPage.items[0] && latestPage.items[0].conversationId !== convId) return;
    setThread((prev) => mergeThread(prev, latestPage.items));
    if (!seededRef.current) {
      seededRef.current = true;
      setHasOlder(latestPage.hasMore);
    }
  }, [latestPage, convId]);

  const loadOlder = useMutation({
    mutationFn: (beforeId: number) =>
      api.get<Page<Message>>(`/conversations/${convId}/messages?before=${beforeId}`),
    onSuccess: (page) => {
      if (page.items[0] && page.items[0].conversationId !== convId) return;
      const el = listRef.current;
      if (el) anchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
      setThread((prev) => mergeThread(page.items, prev));
      setHasOlder(page.hasMore);
    },
  });

  useLayoutEffect(() => {
    const el = listRef.current;
    const anchor = anchorRef.current;
    if (el && anchor) {
      anchorRef.current = null;
      el.scrollTop = anchor.top + (el.scrollHeight - anchor.height);
    }
  }, [thread]);

  const send = useMutation({
    mutationFn: (body: string) =>
      api.post<Message>(`/conversations/${convId}/messages`, { body }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  useEffect(() => {
    return ws.onMessage((m) => {
      if (m.conversationId !== convId) return;
      if (m.sender.id !== user?.id && document.visibilityState === "visible") {
        ws.markRead(convId);
      }
    });
  }, [convId, user?.id]);

  const markedReadRef = useRef<number | null>(null);
  useEffect(() => {
    if (!Number.isFinite(convId) || !messages.data || markedReadRef.current === convId) return;
    markedReadRef.current = convId;
    queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "groups"] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "direct"] });
  }, [convId, messages.data]);

  const lastMessageId = thread.length > 0 ? thread[thread.length - 1].id : null;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId]);

  const conv = conversation.data;
  const others = conv?.members.filter((m) => m.id !== user?.id) ?? [];
  const isGroup = conv?.type === "GROUP";
  const title = conv ? (isGroup ? conv.name : others[0]?.name) : "…";
  const subtitle = conv
    ? isGroup
      ? others.map((m) => m.name).join(", ")
      : others[0]
        ? `@${others[0].username}`
        : ""
    : "";

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || send.isPending) return;
    if (ws.sendChat(convId, body)) {
      setDraft("");
      return;
    }
    send.mutate(body);
  }

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col animate-in">
      <div className="flex items-center gap-3 pb-4">
        <Link
          to="/messages"
          className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
          aria-label="Back to messages"
        >
          <ArrowLeft size={16} />
        </Link>
        {isGroup ? (
          <button
            onClick={() => setShowMembers(true)}
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
            >
              <Users2 size={16} className="text-accent" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-fg truncate">{title}</span>
              {subtitle && <span className="block text-[12px] text-fg-3 truncate">{subtitle}</span>}
            </span>
          </button>
        ) : (
          <Link
            to={others[0] ? `/users/${others[0].id}` : "#"}
            className="flex min-w-0 items-center gap-3"
          >
            <Avatar
              name={others[0]?.name}
              username={others[0]?.username}
              avatarUrl={others[0]?.avatarUrl}
              size={36}
              className="text-[13px]"
            />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-fg truncate">{title}</span>
              {subtitle && <span className="block text-[12px] text-fg-3 truncate">{subtitle}</span>}
            </span>
          </Link>
        )}
      </div>

      <div className="card flex min-h-0 flex-1 flex-col">
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          {hasOlder && thread.length > 0 && (
            <div className="flex justify-center pb-2">
              <button
                onClick={() => loadOlder.mutate(thread[0].id)}
                disabled={loadOlder.isPending}
                className="btn btn-ghost"
              >
                {loadOlder.isPending ? "Loading…" : "Load earlier messages"}
              </button>
            </div>
          )}
          {messages.isLoading && thread.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-fg-3">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
              Loading…
            </div>
          ) : thread.length > 0 ? (
            thread.map((m, i) => {
              const mine = m.sender.id === user?.id;
              const prev = thread[i - 1];
              const next = thread[i + 1];
              const isFirstInRun = !prev || prev.sender.id !== m.sender.id;
              const isLastInRun = !next || next.sender.id !== m.sender.id;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isFirstInRun ? "mt-3" : "mt-0.5"} ${mine ? "items-end" : "items-start"}`}
                >
                  {!mine && isGroup && isFirstInRun && (
                    <Link
                      to={`/users/${m.sender.id}`}
                      className="mb-0.5 ml-8 text-[11px] text-fg-3 transition-colors hover:text-accent"
                    >
                      {m.sender.name}
                    </Link>
                  )}
                  <div className={`flex max-w-[80%] items-center gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    {!mine && (
                      <Link to={`/users/${m.sender.id}`} className="shrink-0">
                        <Avatar
                          name={m.sender.name}
                          username={m.sender.username}
                          avatarUrl={m.sender.avatarUrl}
                          size={26}
                          className="text-[11px]"
                        />
                      </Link>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-[13px] ${
                        mine ? "text-accent-fg" : "text-fg"
                      }`}
                      style={{
                        background: mine ? "var(--accent)" : "var(--surface-hi)",
                      }}
                    >
                      {m.body}
                    </div>
                  </div>
                  {isLastInRun && (
                    <div className={`mt-0.5 text-[10px] text-fg-3 ${mine ? "mr-1" : "ml-8"}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="py-8 text-center text-sm text-fg-3">
              No messages yet. Say hi!
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 rounded-b-[11px] p-3"
          style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}
        >
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
          />
          <button
            type="submit"
            disabled={!draft.trim() || send.isPending}
            onPointerDown={(e) => e.preventDefault()}
            className="btn btn-primary shrink-0"
            aria-label="Send message"
          >
            <Send size={13} />
          </button>
        </form>
      </div>

      {showMembers && conv && (
        <MembersModal
          members={conv.members}
          meId={user?.id}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  );
}

function MembersModal({
  members,
  meId,
  onClose,
}: {
  members: PublicUser[];
  meId?: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="card flex max-h-[70vh] w-full max-w-sm flex-col gap-3 rounded-b-none p-5 shadow-xl animate-sheet sm:rounded-b-xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-[15px] font-semibold text-fg">Members</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {members.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => {
                  onClose();
                  navigate(m.id === meId ? "/profile" : `/users/${m.id}`);
                }}
                className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-surface-hi"
              >
                <Avatar
                  name={m.name}
                  username={m.username}
                  avatarUrl={m.avatarUrl}
                  size={32}
                  className="text-[12px]"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-fg truncate">
                    {m.name}
                    {m.id === meId && <span className="ml-1.5 text-[11px] text-fg-3">(you)</span>}
                  </div>
                  <div className="text-[12px] text-fg-3 truncate">@{m.username}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
