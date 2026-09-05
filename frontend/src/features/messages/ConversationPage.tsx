import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Check,
  Heart,
  ImagePlus,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Pencil,
  Send,
  Trash2,
  Users2,
  X,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { queryClient } from "../../lib/queryClient";
import { toast } from "../../lib/toast";
import { useDoubleTap } from "../../lib/useDoubleTap";
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
import BackButton from "../../components/BackButton";
import Avatar from "../../components/Avatar";
import Modal from "../../components/Modal";
import AttachmentBubble from "./AttachmentBubble";
import type { Conversation, Message, MessageLike, Page, PublicUser } from "../../types";

const DOC_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.md";
const INITIAL_PAGE_SIZE = 10;
const OLDER_PAGE_SIZE = 30;
const MAX_JUMBO_EMOJI = 3;
const MENU_GAP = 8;

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
  const confirm = useConfirm();

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
    mutationFn: (body: string) =>
      api.post<Message>(`/conversations/${convId}/messages`, { body }),
    onSuccess: (m) => {
      appendMessageToCache(m);
      invalidateConversationLists();
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

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [dragging, setDragging] = useState(false);

  function imagesFrom(data: DataTransfer | null): File[] {
    return [...(data?.items ?? [])]
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const images = imagesFrom(e.clipboardData);
    if (images.length === 0) return;
    e.preventDefault();
    uploadFiles(images);
  }

  function handleDrop(e: React.DragEvent) {
    setDragging(false);
    const images = imagesFrom(e.dataTransfer);
    if (images.length === 0) return;
    e.preventDefault();
    uploadFiles(images);
  }

  async function uploadFiles(list: FileList | File[] | null) {
    const files = [...(list ?? [])];
    if (files.length === 0 || uploading) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const m = await api.post<Message>(`/conversations/${convId}/attachments`, fd);
        appendMessageToCache(m);
      }
      invalidateConversationLists();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

  useEffect(() => {
    if (openMenu === null) return;
    const close = () => setOpenMenu(null);
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
      className="fixed inset-0 z-40 flex flex-col bg-bg h-[var(--app-height,auto)] md:relative md:z-auto md:h-full md:min-h-0 md:flex-1 animate-in"
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
          Drop to send
        </div>
      )}
      <header
        className="relative flex shrink-0 items-center gap-3 bg-surface px-3 pb-2.5 md:bg-transparent md:px-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <BackButton fallback="/messages" iconOnly />
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
              className="card absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden py-1 shadow-xl animate-slide"
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
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain px-4 py-3 md:px-6"
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
                      onStartEdit={() => setEditingId(m.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSubmitEdit={(body) => editMessage.mutate({ messageId: m.id, body })}
                      onDelete={() => handleDeleteMessage(m.id)}
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
        className="flex shrink-0 items-center gap-2 bg-surface px-3 pt-3 md:bg-surface-hi md:px-6"
        style={{
          borderTop: "1px solid var(--line)",
          paddingBottom: "var(--composer-pb, calc(env(safe-area-inset-bottom, 0px) + 12px))",
        }}
      >
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
        <input
          ref={docInputRef}
          type="file"
          accept={DOC_ACCEPT}
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
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
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={handlePaste}
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
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onDelete,
}: {
  message: Message;
  mine: boolean;
  editing: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onLike: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (body: string) => void;
  onDelete: () => void;
}) {
  const tap = useDoubleTap(onLike);
  const [menuSide, setMenuSide] = useState<"left" | "right">("left");
  const dotsRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [editDraft, setEditDraft] = useState(message.body);
  const liked = message.likedByMe;
  const jumbo = message.attachment ? null : jumboSize(message.body);

  useEffect(() => {
    if (editing) setEditDraft(message.body);
  }, [editing, message.body]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const dots = dotsRef.current;
    if (!menuOpen || !menu || !dots) return;
    const width = menu.offsetWidth;
    const rect = dots.getBoundingClientRect();
    const fitsLeft = rect.left - MENU_GAP - width >= MENU_GAP;
    const fitsRight = rect.right + MENU_GAP + width <= window.innerWidth - MENU_GAP;
    if (fitsLeft) setMenuSide("left");
    else if (fitsRight) setMenuSide("right");
    else setMenuSide(rect.left > window.innerWidth - rect.right ? "left" : "right");
  }, [menuOpen]);

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

  return (
    <div className={`group/msg flex items-center gap-0.5 ${mine ? "flex-row-reverse" : ""}`}>
      <div className="relative">
        <div
          {...tap}
          className={message.likeCount > 0 ? "pb-1.5" : undefined}
          role="button"
          tabIndex={-1}
          aria-label="Double tap to like"
        >
          {message.attachment ? (
            <AttachmentBubble message={message} mine={mine} />
          ) : jumbo ? (
            <div
              className="select-none py-0.5 leading-none"
              style={{ fontSize: jumbo, lineHeight: 1.15 }}
            >
              {message.body}
              {edited}
            </div>
          ) : (
            <div
              className={`select-none rounded-2xl px-3.5 py-2 text-[13px] ${mine ? "text-accent-fg" : "text-fg"}`}
              style={{ background: mine ? "var(--accent)" : "var(--surface-hi)" }}
            >
              {message.body}
              {edited}
            </div>
          )}
        </div>

        {message.likeCount > 0 && (
          <span
            className={`absolute -bottom-1 flex items-center gap-0.5 rounded-full px-1.5 py-[1px] text-[10px] font-medium animate-fade ${
              mine ? "left-0" : "right-0"
            }`}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              color: liked ? "var(--red)" : "var(--fg-3)",
            }}
          >
            <Heart size={9} strokeWidth={2.5} fill={liked ? "var(--red)" : "none"} />
            {message.likeCount > 1 && message.likeCount}
          </span>
        )}
      </div>

      {mine && (
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
          {menuOpen && (
            <div
              ref={menuRef}
              className={`card absolute top-1/2 z-50 w-40 -translate-y-1/2 overflow-hidden py-1 shadow-xl animate-fade ${
                menuSide === "left" ? "right-full mr-1" : "left-full ml-1"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {!message.attachment && (
                <button
                  type="button"
                  onClick={() => {
                    onCloseMenu();
                    onStartEdit();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-fg transition-colors hover:bg-surface-hi"
                >
                  <Pencil size={13} />
                  Edit message
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onCloseMenu();
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red transition-colors hover:bg-surface-hi"
              >
                <Trash2 size={13} />
                Delete message
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
