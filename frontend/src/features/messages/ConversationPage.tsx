import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users2, X } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { queryClient } from "../../lib/queryClient";
import { appendMessageToCache, ws } from "../../lib/ws";
import Avatar from "../../components/Avatar";
import type { Conversation, Message, Page, PublicUser } from "../../types";

export default function ConversationPage() {
  const { id } = useParams();
  const convId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [showMembers, setShowMembers] = useState(false);

  const [wsConnected, setWsConnected] = useState(ws.isConnected());
  useEffect(() => ws.onState(setWsConnected), []);

  const conversation = useQuery({
    queryKey: ["conversations", convId],
    queryFn: () => api.get<Conversation>(`/conversations/${convId}`),
    enabled: Number.isFinite(convId),
    retry: false,
  });

  useEffect(() => {
    if (conversation.isError) navigate("/messages", { replace: true });
  }, [conversation.isError, navigate]);

  const messages = useInfiniteQuery({
    queryKey: ["conversations", convId, "messages"],
    queryFn: ({ pageParam }) =>
      api.get<Page<Message>>(
        `/conversations/${convId}/messages${pageParam ? `?before=${pageParam}` : ""}`,
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => (last.hasMore && last.items[0] ? last.items[0].id : undefined),
    enabled: Number.isFinite(convId),
    refetchInterval: wsConnected ? false : 5000,
  });

  const thread = useMemo(() => {
    const byId = new Map<number, Message>();
    const pages = messages.data?.pages ?? [];
    for (let i = pages.length - 1; i >= 0; i--) {
      for (const m of pages[i].items) {
        if (m.conversationId === convId) byId.set(m.id, m);
      }
    }
    return [...byId.values()].sort((a, b) => a.id - b.id);
  }, [messages.data, convId]);

  useEffect(() => {
    if (!Number.isFinite(convId) || !messages.data) return;
    queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "groups"] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "direct"] });
  }, [convId, messages.isSuccess]);

  useEffect(() => {
    return ws.onMessage((m) => {
      if (m.conversationId !== convId) return;
      if (m.sender.id !== user?.id && document.visibilityState === "visible") {
        ws.markRead(convId);
      }
    });
  }, [convId, user?.id]);

  const send = useMutation({
    mutationFn: (body: string) =>
      api.post<Message>(`/conversations/${convId}/messages`, { body }),
    onSuccess: (m) => {
      appendMessageToCache(m);
      queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
      queryClient.invalidateQueries({ queryKey: ["conversations", "direct"] });
      queryClient.invalidateQueries({ queryKey: ["conversations", "groups"] });
    },
    onError: (_err, body) => {
      setDraft((current) => (current ? current : body));
    },
  });

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft("");
    if (!ws.sendChat(convId, body)) send.mutate(body);
  }

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

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg h-[var(--app-height,auto)] md:static md:z-auto md:h-auto md:min-h-0 md:flex-1 animate-in">
      <header
        className="flex shrink-0 items-center gap-3 px-3 pb-2.5 md:px-0"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
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
      </header>

      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain px-4 py-3">
        {messages.isLoading ? (
          <div className="my-auto flex items-center justify-center gap-2 py-8 text-sm text-fg-3">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
            Loading…
          </div>
        ) : thread.length === 0 ? (
          <p className="my-auto py-8 text-center text-sm text-fg-3">No messages yet. Say hi!</p>
        ) : (
          [...thread].reverse().map((m, ri) => {
            const i = thread.length - 1 - ri;
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
                    className={`rounded-2xl px-3.5 py-2 text-[13px] ${mine ? "text-accent-fg" : "text-fg"}`}
                    style={{ background: mine ? "var(--accent)" : "var(--surface-hi)" }}
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
        )}
        {messages.hasNextPage && (
          <div className="flex justify-center pb-2">
            <button
              onClick={() => messages.fetchNextPage()}
              disabled={messages.isFetchingNextPage}
              className="btn btn-ghost"
            >
              {messages.isFetchingNextPage ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="flex shrink-0 items-center gap-2 px-3 pt-3"
        style={{
          borderTop: "1px solid var(--line)",
          background: "var(--surface)",
          paddingBottom: "var(--composer-pb, calc(env(safe-area-inset-bottom, 0px) + 12px))",
        }}
      >
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          enterKeyHint="send"
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
