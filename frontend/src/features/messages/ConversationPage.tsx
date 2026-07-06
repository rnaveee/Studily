import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users2 } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { queryClient } from "../../lib/queryClient";
import Avatar from "../../components/Avatar";
import type { Conversation, Message } from "../../types";

export default function ConversationPage() {
  const { id } = useParams();
  const convId = Number(id);
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = useQuery({
    queryKey: ["conversations", convId],
    queryFn: () => api.get<Conversation>(`/conversations/${convId}`),
    enabled: Number.isFinite(convId),
    retry: false,
  });

  const messages = useQuery({
    queryKey: ["conversations", convId, "messages"],
    queryFn: () => api.get<Message[]>(`/conversations/${convId}/messages`),
    enabled: Number.isFinite(convId),
    refetchInterval: 5000,
  });

  const send = useMutation({
    mutationFn: (body: string) =>
      api.post<Message>(`/conversations/${convId}/messages`, { body }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const markedReadRef = useRef<number | null>(null);
  useEffect(() => {
    if (!Number.isFinite(convId) || !messages.data || markedReadRef.current === convId) return;
    markedReadRef.current = convId;
    // The backend marks the conversation read as a side effect of fetching messages;
    // refresh the lists that show unread state so the nav dot and list styling catch up.
    queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "groups"] });
    queryClient.invalidateQueries({ queryKey: ["conversations", "direct"] });
  }, [convId, messages.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length]);

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
    send.mutate(body);
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col animate-in">
      <div className="flex items-center gap-3 pb-4">
        <Link
          to="/messages"
          className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
          aria-label="Back to messages"
        >
          <ArrowLeft size={16} />
        </Link>
        {isGroup ? (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
          >
            <Users2 size={16} className="text-accent" />
          </span>
        ) : (
          <Avatar
            name={others[0]?.name}
            username={others[0]?.username}
            avatarUrl={others[0]?.avatarUrl}
            size={36}
            className="text-[13px]"
          />
        )}
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-fg truncate">{title}</h1>
          {subtitle && <p className="text-[12px] text-fg-3 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="card flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {messages.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-fg-3">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
              Loading…
            </div>
          ) : messages.data && messages.data.length > 0 ? (
            messages.data.map((m, i) => {
              const mine = m.sender.id === user?.id;
              const prev = messages.data[i - 1];
              const next = messages.data[i + 1];
              const isFirstInRun = !prev || prev.sender.id !== m.sender.id;
              const isLastInRun = !next || next.sender.id !== m.sender.id;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isFirstInRun ? "mt-3" : "mt-0.5"} ${mine ? "items-end" : "items-start"}`}
                >
                  {!mine && isGroup && isFirstInRun && (
                    <div className="mb-0.5 ml-8 text-[11px] text-fg-3">{m.sender.name}</div>
                  )}
                  <div className={`flex max-w-[80%] items-center gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    {!mine && (
                      <Avatar
                        name={m.sender.name}
                        username={m.sender.username}
                        avatarUrl={m.sender.avatarUrl}
                        size={26}
                        className="text-[11px] shrink-0"
                      />
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
          className="flex items-center gap-2 p-3"
          style={{ borderTop: "1px solid var(--line)" }}
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
            className="btn btn-primary shrink-0"
            aria-label="Send message"
          >
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  );
}
