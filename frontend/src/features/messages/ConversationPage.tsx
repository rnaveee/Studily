import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Check,
  Copy,
  CornerUpLeft,
  FileText,
  Flag,
  Heart,
  ImagePlus,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Pencil,
  Reply,
  Send,
  Trash2,
  Users2,
  X,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { formatBytes } from "../../lib/format";
import { useAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { queryClient } from "../../lib/queryClient";
import { toast } from "../../lib/toast";
import { useDeferredClose } from "../../lib/motion";
import { useDoubleTap } from "../../lib/useDoubleTap";
import { useLongPress, longPressJustFired } from "../../lib/useLongPress";
import { isTouch } from "../../lib/isTouch";
import { imagesFrom, pastedImages } from "../../lib/clipboardImages";
import { firstLink, LinkPreview, Linkified } from "./linkify";
import {
  appendMessageToCache,
  applyEditToCache,
  applyLikeToCache,
  clearMessagesInCache,
  invalidateConversationLists,
  optimisticToggleLike,
  removeMessageFromCache,
  ws,
} from "../../lib/ws";
import BackButton, { useGoBack } from "../../components/BackButton";
import Avatar from "../../components/Avatar";
import Modal from "../../components/Modal";
import ReportModal from "../moderation/ReportModal";
import AttachmentBubble from "./AttachmentBubble";
import type { Conversation, Message, MessageLike, MessageReply, Page, PublicUser } from "../../types";

const DOC_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.md";
const INITIAL_PAGE_SIZE = 10;
const OLDER_PAGE_SIZE = 30;
const MAX_JUMBO_EMOJI = 3;
const MENU_GAP = 8;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type Staged = { id: string; file: File; url: string | null };

const EMOJI_ONLY =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[\u200D\uFE0F]|\s)+$/u;
const HAS_EMOJI = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})/u;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter() : null;

function emojiCount(body: string): number {
  const bare = body.replace(/\s/g, "");
  return segmenter ? [...segmenter.segment(bare)].length : [...bare].length;
}

function jumboSize(body: string): number | null {
  if (!EMOJI_ONLY.test(body) || !HAS_EMOJI.test(body)) return null;
  const count = emojiCount(body);
  if (count === 0 || count > MAX_JUMBO_EMOJI) return null;
  return count === 1 ? 44 : count === 2 ? 36 : 30;
}

function previewOf(m: Message): string {
  if (!m.attachment) return m.body;
  return m.attachment.image ? "📷 Photo" : `📄 ${m.attachment.filename}`;
}

function jumpToMessage(id: number) {
  const el = document.querySelector<HTMLElement>(`[data-message-id="${id}"]`);
  if (!el) {
    toast.info("That message is further up the chat.");
    return;
  }
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }],
    { duration: 600, delay: 350, easing: "ease-out" },
  );
}

function hourKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

function hourLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((dayStart(now) - dayStart(d)) / 86400000);
  if (dayDiff === 0) return time;
  if (dayDiff === 1) return `Yesterday ${time}`;
  if (dayDiff < 7) return `${d.toLocaleDateString([], { weekday: "long" })} ${time}`;
  return `${d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  })}, ${time}`;
}

export default function ConversationPage() {
  const { id } = useParams();
  const convId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<number | "header" | null>(null);
  const [reporting, setReporting] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const goBack = useGoBack("/messages");
  const { closing, close } = useDeferredClose(goBack, 220);

  const [wsConnected, setWsConnected] = useState(ws.isConnected());
  useEffect(() => ws.onState(setWsConnected), []);

  useEffect(
    () =>
      ws.onSendFailed((failed) => {
        if (failed.conversationId !== convId) return;
        setDraft((current) => (current ? current : failed.body));
      }),
    [convId],
  );

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
        pageParam
          ? `/conversations/${convId}/messages?before=${pageParam}&limit=${OLDER_PAGE_SIZE}`
          : `/conversations/${convId}/messages?limit=${INITIAL_PAGE_SIZE}`,
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
    setReplyTo(null);
  }, [convId]);

  useEffect(() => {
    if (replyTo && messages.data && !thread.some((m) => m.id === replyTo.id)) setReplyTo(null);
  }, [thread, replyTo, messages.data]);

  function startReply(m: Message) {
    setEditingId(null);
    setReplyTo(m);
    inputRef.current?.focus();
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = messages;

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { root, rootMargin: "300px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  const like = useMutation({
    mutationFn: (messageId: number) =>
      api.post<MessageLike>(`/conversations/${convId}/messages/${messageId}/like`),
    onMutate: (messageId) => optimisticToggleLike(convId, messageId),
    onSuccess: (res) => applyLikeToCache(res, user?.id),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", convId, "messages"] });
    },
  });

  const editMessage = useMutation({
    mutationFn: ({ messageId, body }: { messageId: number; body: string }) =>
      api.put<Message>(`/conversations/${convId}/messages/${messageId}`, { body }),
    onSuccess: (m) => {
      applyEditToCache(m);
      setEditingId(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Couldn't edit that message.");
    },
  });

  const deleteMessage = useMutation({
    mutationFn: (messageId: number) => api.del<void>(`/conversations/${convId}/messages/${messageId}`),
    onSuccess: (_res, messageId) => removeMessageFromCache(convId, messageId),
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete that message.");
    },
  });

  const clearChat = useMutation({
    mutationFn: () => api.del<void>(`/conversations/${convId}/messages`),
    onSuccess: () => clearMessagesInCache(convId),
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Couldn't clear this chat.");
    },
  });

  const send = useMutation({
    mutationFn: ({ body, reply }: { body: string; reply: Message | null }) =>
      api.post<Message>(`/conversations/${convId}/messages`, { body, replyToId: reply?.id ?? null }),
    onSuccess: (m) => {
      appendMessageToCache(m);
      invalidateConversationLists();
    },
    onError: (_err, { body, reply }) => {
      setDraft((current) => (current ? current : body));
      if (reply) setReplyTo((current) => current ?? reply);
    },
  });

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [staged, setStaged] = useState<Staged[]>([]);
  const stagedRef = useRef(staged);
  stagedRef.current = staged;

  useEffect(() => {
    return () => {
      for (const s of stagedRef.current) if (s.url) URL.revokeObjectURL(s.url);
    };
  }, []);

  function stageFiles(list: FileList | File[] | null) {
    const files = [...(list ?? [])];
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (docInputRef.current) docInputRef.current.value = "";
    if (files.length === 0) return;
    const fitting = files.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
    if (fitting.length < files.length) {
      toast.error(`Files must be ${formatBytes(MAX_ATTACHMENT_BYTES)} or smaller.`);
    }
    if (fitting.length === 0) return;
    setStaged((current) => [
      ...current,
      ...fitting.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    ]);
  }

  function unstage(id: string) {
    setStaged((current) => {
      const item = current.find((s) => s.id === id);
      if (item?.url) URL.revokeObjectURL(item.url);
      return current.filter((s) => s.id !== id);
    });
  }

  function clearStaged() {
    setStaged((current) => {
      for (const s of current) if (s.url) URL.revokeObjectURL(s.url);
      return [];
    });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if ((!body && staged.length === 0) || send.isPending || uploading) return;
    const items = staged;
    const reply = replyTo;
    setDraft("");
    setStaged([]);
    setReplyTo(null);
    if (items.length > 0) {
      const failed = await uploadStaged(items, body ? null : (reply?.id ?? null));
      if (failed.length > 0) {
        setStaged((current) => [...failed, ...current]);
        if (body) setDraft((current) => (current ? current : body));
        if (reply) setReplyTo((current) => current ?? reply);
        return;
      }
    }
    if (body && !ws.sendChat(convId, body, reply?.id)) send.mutate({ body, reply });
  }

  const [dragging, setDragging] = useState(false);

  function handlePaste(e: React.ClipboardEvent) {
    const images = pastedImages(e);
    if (images.length === 0) return;
    e.preventDefault();
    stageFiles(images);
  }

  function handleDrop(e: React.DragEvent) {
    setDragging(false);
    const images = imagesFrom(e.dataTransfer);
    if (images.length === 0) return;
    e.preventDefault();
    stageFiles(images);
  }

  async function uploadStaged(items: Staged[], replyToId: number | null): Promise<Staged[]> {
    setUploading(true);
    let sent = 0;
    try {
      for (const item of items) {
        const fd = new FormData();
        fd.append("file", item.file);
        if (replyToId && sent === 0) fd.append("replyToId", String(replyToId));
        const m = await api.post<Message>(`/conversations/${convId}/attachments`, fd);
        appendMessageToCache(m);
        if (item.url) URL.revokeObjectURL(item.url);
        sent++;
      }
      return [];
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
      return items.slice(sent);
    } finally {
      if (sent > 0) invalidateConversationLists();
      setUploading(false);
    }
  }

  useEffect(() => {
    if (openMenu === null) return;
    const close = () => {
      if (longPressJustFired()) return;
      setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  const conv = conversation.data;
  const others = conv?.members.filter((m) => m.id !== user?.id) ?? [];
  const isGroup = conv?.type === "GROUP";

  async function handleDeleteMessage(messageId: number) {
    const ok = await confirm({
      title: "Delete this message?",
      message: "It disappears for everyone in the chat.",
      confirmLabel: "Delete message",
      danger: true,
    });
    if (ok) deleteMessage.mutate(messageId);
  }

  async function handleClearChat() {
    setOpenMenu(null);
    const ok = await confirm({
      title: "Clear this chat?",
      message: isGroup
        ? "The messages disappear from your view. Other members keep their copy."
        : `The messages disappear from your view. ${others[0]?.name ?? "They"} keeps their copy.`,
      confirmLabel: "Clear chat",
      danger: true,
    });
    if (ok) clearChat.mutate();
  }

  const otherReadAt = conv?.otherReadAt;
  const seenMessageId = useMemo(() => {
    if (isGroup || !otherReadAt || !user) return null;
    const readAt = new Date(otherReadAt).getTime();
    for (let i = thread.length - 1; i >= 0; i--) {
      const m = thread[i];
      if (m.sender.id === user.id && new Date(m.createdAt).getTime() <= readAt) return m.id;
    }
    return null;
  }, [thread, otherReadAt, isGroup, user]);
  const title = conv ? (isGroup ? conv.name : others[0]?.name) : "…";
  const subtitle = conv
    ? isGroup
      ? others.map((m) => m.name).join(", ")
      : others[0]
        ? `@${others[0].username}`
        : ""
    : "";

  return (
    <div
      data-chat-panel
      className={`fixed inset-0 z-40 flex flex-col bg-bg h-[var(--app-height,auto)] md:relative md:z-auto md:h-full md:min-h-0 md:flex-1 ${
        closing ? "chat-out" : "chat-in"
      }`}
      onDragOver={(e) => {
        if (imagesFrom(e.dataTransfer).length > 0) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={handleDrop}
    >
      {dragging && (
        <div
          className="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-2xl text-[13px] font-medium text-accent"
          style={{
            border: "2px dashed var(--accent)",
            background: "color-mix(in srgb, var(--accent) 8%, transparent)",
          }}
        >
          Drop to attach
        </div>
      )}
      <header
        className="relative flex shrink-0 items-center gap-3 bg-surface px-3 pb-2.5 md:bg-transparent md:px-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <BackButton fallback="/messages" iconOnly onClick={close} />
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
              flair={others[0]?.flair}
              size={36}
              className="text-[13px]"
            />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-fg truncate">{title}</span>
              {subtitle && <span className="block text-[12px] text-fg-3 truncate">{subtitle}</span>}
            </span>
          </Link>
        )}

        <div className="relative ml-auto shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu((open) => (open === "header" ? null : "header"));
            }}
            className="rounded-lg p-2 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
            aria-label="Conversation options"
          >
            <MoreVertical size={16} />
          </button>
          {openMenu === "header" && (
            <div
              className="popover absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden py-1 animate-slide"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleClearChat}
                disabled={clearChat.isPending}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red transition-colors hover:bg-surface-hi disabled:opacity-50"
              >
                <Trash2 size={13} />
                Clear chat
              </button>
            </div>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 md:px-6"
      >
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
            const newHour = !prev || hourKey(prev.createdAt) !== hourKey(m.createdAt);
            const isFirstInRun = newHour || prev.sender.id !== m.sender.id;
            return (
              <Fragment key={m.id}>
                {m.id === seenMessageId && otherReadAt && (
                  <div className="mt-0.5 text-right text-[11px] text-fg-3 animate-fade">
                    Seen{" "}
                    {new Date(otherReadAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                )}
                <div
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
                  <div
                    className={`flex max-w-[80%] items-center gap-2 ${mine ? "flex-row-reverse" : ""}`}
                    title={new Date(m.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  >
                    {!mine && (
                      <Link to={`/users/${m.sender.id}`} className="shrink-0">
                        <Avatar
                          name={m.sender.name}
                          username={m.sender.username}
                          avatarUrl={m.sender.avatarUrl}
                          flair={m.sender.flair}
                          size={26}
                          className="text-[11px]"
                        />
                      </Link>
                    )}
                    <MessageBubble
                      message={m}
                      mine={mine}
                      editing={editingId === m.id}
                      menuOpen={openMenu === m.id}
                      onToggleMenu={() =>
                        setOpenMenu((open) => (open === m.id ? null : m.id))
                      }
                      onCloseMenu={() => setOpenMenu(null)}
                      onLike={() => like.mutate(m.id)}
                      onReply={() => startReply(m)}
                      onStartEdit={() => setEditingId(m.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSubmitEdit={(body) => editMessage.mutate({ messageId: m.id, body })}
                      onDelete={() => handleDeleteMessage(m.id)}
                      onReport={() => setReporting(m)}
                    />
                  </div>
                </div>
                {newHour && (
                  <div className="select-none pb-1 pt-4 text-center text-[11px] font-medium text-fg-3">
                    {hourLabel(m.createdAt)}
                  </div>
                )}
              </Fragment>
            );
          })
        )}
        {hasNextPage && (
          <div ref={loadMoreRef} className="flex h-8 items-center justify-center pb-2">
            {isFetchingNextPage && (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="flex shrink-0 flex-col gap-2 bg-surface px-3 pt-3 md:bg-surface-hi md:px-6"
        style={{
          borderTop: "1px solid var(--line)",
          paddingBottom: "var(--composer-pb, calc(env(safe-area-inset-bottom, 0px) + 12px))",
        }}
      >
        {replyTo && (
          <div
            className="flex items-center gap-2.5 rounded-xl py-2 pl-3 pr-1.5 animate-fade"
            style={{
              background: "color-mix(in srgb, var(--surface-hi) 86%, black)",
              boxShadow: "inset 0 1px 4px rgb(0 0 0 / 0.14)",
            }}
          >
            <CornerUpLeft size={15} className="shrink-0 text-fg-2" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-fg-2">
                Replying to {replyTo.sender.id === user?.id ? "yourself" : replyTo.sender.name}
              </div>
              <div className="truncate text-[12.5px] text-fg-3">{previewOf(replyTo)}</div>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              onPointerDown={(e) => e.preventDefault()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition-colors hover:bg-surface hover:text-fg"
              aria-label="Cancel reply"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {staged.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 pr-2 pt-1.5 animate-fade">
            {staged.map((s) => (
              <div key={s.id} className="relative shrink-0">
                {s.url ? (
                  <img
                    src={s.url}
                    alt={s.file.name}
                    className="block h-16 w-16 rounded-xl object-cover"
                    style={{ border: "1px solid var(--line)" }}
                  />
                ) : (
                  <div
                    className="flex h-16 max-w-[200px] items-center gap-2 rounded-xl px-3"
                    style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
                  >
                    <FileText size={15} className="shrink-0 text-accent" />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-medium text-fg">{s.file.name}</span>
                      <span className="block text-[11px] text-fg-3">{formatBytes(s.file.size)}</span>
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => unstage(s.id)}
                  disabled={uploading}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-fg transition-colors hover:text-red disabled:opacity-50"
                  style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
                  aria-label={`Remove ${s.file.name}`}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => stageFiles(e.target.files)}
          />
          <input
            ref={docInputRef}
            type="file"
            accept={DOC_ACCEPT}
            className="hidden"
            onChange={(e) => stageFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 rounded-lg p-2 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-50"
            aria-label="Send a photo"
          >
            {uploading ? (
              <span className="inline-block h-[15px] w-[15px] animate-spin rounded-full border-2 border-line border-t-accent" />
            ) : (
              <ImagePlus size={15} />
            )}
          </button>
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 rounded-lg p-2 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-50"
            aria-label="Send a document"
          >
            <Paperclip size={15} />
          </button>
          <input
            ref={inputRef}
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              if (replyTo) setReplyTo(null);
              else if (staged.length > 0) clearStaged();
            }}
            placeholder={replyTo ? "Replying to this message…" : "Type a message…"}
            enterKeyHint="send"
          />
          <button
            type="submit"
            disabled={(!draft.trim() && staged.length === 0) || send.isPending || uploading}
            onPointerDown={(e) => e.preventDefault()}
            className="btn btn-primary shrink-0"
            aria-label="Send message"
          >
            <Send size={13} />
          </button>
        </div>
      </form>

      {showMembers && conv && (
        <MembersModal
          members={conv.members}
          meId={user?.id}
          onClose={() => setShowMembers(false)}
        />
      )}

      {reporting && (
        <ReportModal
          target={{ kind: "MESSAGE", messageId: reporting.id, name: reporting.sender.username }}
          onClose={() => setReporting(null)}
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

  return (
    <Modal
      onClose={onClose}
      variant="sheet"
      title="Members"
      bodyClassName="max-h-[min(70vh,100%)]"
    >

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
                  flair={m.flair}
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
    </Modal>
  );
}

function MessageBubble({
  message,
  mine,
  editing,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onLike,
  onReply,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onDelete,
  onReport,
}: {
  message: Message;
  mine: boolean;
  editing: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onLike: () => void;
  onReply: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (body: string) => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const tap = useDoubleTap(onLike);
  const [sheetOpen, setSheetOpen] = useState(false);
  const hold = useLongPress(isTouch ? () => setSheetOpen(true) : null);
  const selectable = isTouch ? "select-none" : "select-text";
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const dotsRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [editDraft, setEditDraft] = useState(message.body);
  const liked = message.likedByMe;
  const jumbo = message.attachment ? null : jumboSize(message.body);
  const link = useMemo(() => (message.attachment ? null : firstLink(message.body)), [message.attachment, message.body]);

  useEffect(() => {
    if (editing) setEditDraft(message.body);
  }, [editing, message.body]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const dots = dotsRef.current;
    if (!menuOpen || !menu || !dots) return;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const rect = dots.getBoundingClientRect();
    const fits = {
      left: rect.left - MENU_GAP - width >= MENU_GAP,
      right: rect.right + MENU_GAP + width <= window.innerWidth - MENU_GAP,
    };
    const preferred = mine ? "left" : "right";
    const fallback = mine ? "right" : "left";
    let side: "left" | "right";
    if (fits[preferred]) side = preferred;
    else if (fits[fallback]) side = fallback;
    else side = rect.left > window.innerWidth - rect.right ? "left" : "right";
    const left = side === "left" ? rect.left - 4 - width : rect.right + 4;
    const centered = rect.top + rect.height / 2 - height / 2;
    const top = Math.max(MENU_GAP, Math.min(centered, window.innerHeight - height - MENU_GAP));
    setMenuPos({ top, left });
  }, [menuOpen, mine]);

  useEffect(() => {
    if (!menuOpen) {
      setMenuPos(null);
      return;
    }
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      onCloseMenu();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onCloseMenu);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onCloseMenu);
    };
  }, [menuOpen, onCloseMenu]);

  if (editing) {
    return (
      <form
        className="flex w-full items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const body = editDraft.trim();
          if (!body || body === message.body) onCancelEdit();
          else onSubmitEdit(body);
        }}
      >
        <input
          className="input"
          value={editDraft}
          autoFocus
          onChange={(e) => setEditDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancelEdit();
          }}
          aria-label="Edit message"
        />
        <button type="submit" className="btn btn-primary shrink-0" aria-label="Save changes">
          <Check size={13} />
        </button>
        <button type="button" onClick={onCancelEdit} className="btn btn-ghost shrink-0" aria-label="Cancel edit">
          <X size={13} />
        </button>
      </form>
    );
  }

  const edited = message.editedAt ? (
    <span className="ml-1.5 text-[10px] opacity-60">edited</span>
  ) : null;

  const content = message.attachment ? (
    <AttachmentBubble message={message} mine={mine} />
  ) : jumbo ? (
    <div
      className={`min-w-0 ${selectable} py-0.5 leading-none`}
      style={{ fontSize: jumbo, lineHeight: 1.15 }}
    >
      {message.body}
      {edited}
    </div>
  ) : (
    <div
      className={`${selectable} whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] [overflow-wrap:anywhere] ${mine ? "text-accent-fg" : "text-fg"}`}
      style={{ background: mine ? "var(--accent)" : "var(--surface-hi)" }}
    >
      <Linkified body={message.body} mine={mine} />
      {edited}
    </div>
  );

  const actions = { mine, onReply, onLike, onStartEdit, onDelete, onReport };

  return (
    <div className={`group/msg flex min-w-0 items-center gap-0.5 ${mine ? "flex-row-reverse" : ""}`}>
      <div className="relative min-w-0">
        <div
          {...tap}
          {...hold}
          data-message-id={message.id}
          style={{ ...tap.style, ...hold.style }}
          className={`flex min-w-0 flex-col ${mine ? "items-end" : "items-start"} ${
            message.likeCount > 0 ? "pb-3" : ""
          }`}
        >
          {message.replyTo ? (
            <>
              <ReplyQuote reply={message.replyTo} mine={mine} />
              <div className="relative min-w-0 max-w-full">{content}</div>
            </>
          ) : (
            content
          )}
          {!message.attachment && link && <LinkPreview url={link} mine={mine} />}
        </div>

        {message.likeCount > 0 && (
          <span
            className={`absolute -bottom-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold animate-fade ${
              mine ? "left-0" : "right-0"
            }`}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              color: liked ? "var(--red)" : "var(--fg-3)",
            }}
          >
            <Heart size={13} strokeWidth={2.4} fill={liked ? "var(--red)" : "none"} />
            {message.likeCount > 1 && message.likeCount}
          </span>
        )}
      </div>

      {!isTouch && (
        <div className="relative shrink-0">
          <button
            type="button"
            ref={dotsRef}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
            className={`rounded-full p-1 text-fg-3 transition-opacity hover:text-fg md:opacity-0 md:group-hover/msg:opacity-100 ${
              menuOpen ? "md:opacity-100" : ""
            }`}
            aria-label="Message options"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen &&
            createPortal(
              <div
                ref={menuRef}
                className="popover fixed z-[60] w-44 overflow-hidden py-1 animate-in"
                style={{ top: menuPos?.top ?? 0, left: menuPos?.left ?? 0, visibility: menuPos ? "visible" : "hidden" }}
                onClick={(e) => e.stopPropagation()}
              >
                <MessageActions message={message} {...actions} onPick={onCloseMenu} compact />
              </div>,
              document.body,
            )}
        </div>
      )}

      {sheetOpen && (
        <MessageActionsSheet message={message} {...actions} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  );
}

function ReplyQuote({ reply, mine }: { reply: MessageReply; mine: boolean }) {
  const { user } = useAuth();
  const who = reply.deleted ? null : reply.senderId === user?.id ? "You" : reply.senderName;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!reply.deleted) jumpToMessage(reply.id);
      }}
      className="relative -mb-2.5 flex min-w-0 max-w-full items-start gap-1.5 rounded-2xl px-3 pb-4 pt-1.5 text-left text-[12px] leading-snug"
      style={{
        background: mine
          ? "color-mix(in srgb, var(--accent) 55%, black)"
          : "color-mix(in srgb, var(--surface-hi) 80%, black)",
        color: mine ? "var(--accent-fg)" : "var(--fg-2)",
        opacity: 0.7,
        boxShadow: "inset 0 1px 8px rgb(0 0 0 / 0.28)",
      }}
      aria-label={reply.deleted ? "Original message was deleted" : `Go to the message from ${who ?? "them"}`}
    >
      <CornerUpLeft size={12} className="mt-[3px] shrink-0" />
      <span className="min-w-0">
        {who && <span className="block text-[11px] font-semibold">{who}</span>}
        <span className={`line-clamp-2 [overflow-wrap:anywhere] ${reply.deleted ? "italic" : ""}`}>
          {reply.deleted ? "Original message was deleted" : reply.body}
        </span>
      </span>
    </button>
  );
}

async function copyMessage(body: string) {
  try {
    await navigator.clipboard.writeText(body);
    toast.success("Copied");
  } catch {
    toast.error("Couldn't copy that message.");
  }
}

function MessageActions({
  message,
  mine,
  onReply,
  onLike,
  onStartEdit,
  onDelete,
  onReport,
  onPick,
  compact = false,
}: {
  message: Message;
  mine: boolean;
  onReply: () => void;
  onLike: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  onPick: () => void;
  compact?: boolean;
}) {
  const liked = message.likedByMe;
  const size = compact ? 13 : 15;
  const row = compact
    ? "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-hi"
    : "flex w-full items-center gap-3 px-5 py-3.5 text-left text-[14px] transition-colors hover:bg-surface-hi";
  const pick = (action: () => void) => () => {
    onPick();
    action();
  };

  return (
    <>
      <button type="button" onClick={pick(onReply)} className={`${row} text-fg`}>
        <Reply size={size} />
        Reply
      </button>
      <button type="button" onClick={pick(onLike)} className={`${row} text-fg`}>
        <Heart
          size={size}
          fill={liked ? "var(--red)" : "none"}
          style={liked ? { color: "var(--red)" } : undefined}
        />
        {liked ? "Unlike message" : "Like this message"}
      </button>
      {!message.attachment && (
        <button type="button" onClick={pick(() => copyMessage(message.body))} className={`${row} text-fg`}>
          <Copy size={size} />
          Copy text
        </button>
      )}
      {mine && !message.attachment && (
        <button type="button" onClick={pick(onStartEdit)} className={`${row} text-fg`}>
          <Pencil size={size} />
          Edit message
        </button>
      )}
      {mine && (
        <button type="button" onClick={pick(onDelete)} className={`${row} text-red`}>
          <Trash2 size={size} />
          Delete message
        </button>
      )}
      {!mine && (
        <button type="button" onClick={pick(onReport)} className={`${row} text-red`}>
          <Flag size={size} />
          Report message
        </button>
      )}
    </>
  );
}

function MessageActionsSheet({
  message,
  mine,
  onClose,
  onReply,
  onLike,
  onStartEdit,
  onDelete,
  onReport,
}: {
  message: Message;
  mine: boolean;
  onClose: () => void;
  onReply: () => void;
  onLike: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const closeRef = useRef<(() => void) | null>(null);
  const dismiss = () => (closeRef.current ?? onClose)();

  return (
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      variant="sheet"
      padded={false}
      showClose={false}
      dismissOnBackdrop
      above={<HeldMessage message={message} mine={mine} />}
    >
      <div className="flex flex-col py-1">
        <MessageActions
          message={message}
          mine={mine}
          onReply={onReply}
          onLike={onLike}
          onStartEdit={onStartEdit}
          onDelete={onDelete}
          onReport={onReport}
          onPick={dismiss}
        />
      </div>
    </Modal>
  );
}

function HeldMessage({ message, mine }: { message: Message; mine: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const jumbo = message.attachment ? null : jumboSize(message.body);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [
        { transform: "scale(0.94)", opacity: 0.4 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 240, easing: "cubic-bezier(0.34, 1.45, 0.64, 1)" },
    );
  }, []);

  return (
    <div ref={ref} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className="max-w-[85%] rounded-2xl"
        style={{ boxShadow: "0 16px 40px rgb(0 0 0 / 0.34), 0 3px 10px rgb(0 0 0 / 0.2)" }}
      >
        {message.attachment ? (
          <AttachmentBubble message={message} mine={mine} />
        ) : jumbo ? (
          <div className="px-2 leading-none" style={{ fontSize: jumbo * 1.25, lineHeight: 1.15 }}>
            {message.body}
          </div>
        ) : (
          <div
            className={`line-clamp-[8] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-snug [overflow-wrap:anywhere] ${
              mine ? "text-accent-fg" : "text-fg"
            }`}
            style={{ background: mine ? "var(--accent)" : "var(--surface-hi)" }}
          >
            {message.body}
          </div>
        )}
      </div>
      <div
        className="mt-2 px-1 text-[12px] font-medium tabular-nums"
        style={{ color: "rgb(214 217 224)", textShadow: "0 1px 3px rgb(0 0 0 / 0.5)" }}
      >
        @{message.sender.username} - {hourLabel(message.createdAt)}
      </div>
    </div>
  );
}
