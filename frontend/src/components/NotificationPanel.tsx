import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, ChevronRight, Inbox, Megaphone, UserPlus, X, type LucideIcon } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDateTimeFull, timeAgo } from "../lib/format";
import {
  markFeatureNoticesRead,
  useFeatureNotices,
  type FeatureNoticeState,
} from "../features/notifications/featureNotices";
import { CENTER_KEY, UNREAD_KEY } from "../features/notifications/useNotifications";
import type { AppNotification, NotificationKind, Page, UnreadCount } from "../types";

const PAGE_SIZE = 20;

const TYPE_STYLE: Partial<Record<NotificationKind, { icon: LucideIcon; color: string; fallback: string }>> = {
  ANNOUNCEMENT: { icon: Megaphone, color: "var(--accent)", fallback: "Announcement" },
  FRIEND_REQUEST: { icon: UserPlus, color: "var(--green)", fallback: "New friend request" },
  FEED_REVIEW: { icon: Inbox, color: "var(--orange)", fallback: "New items to review" },
  FEED_UPDATE: { icon: CalendarClock, color: "var(--blue-vivid)", fallback: "Deadlines changed" },
};

type Row =
  | { key: string; at: number; kind: "server"; item: AppNotification }
  | { key: string; at: number; kind: "feature"; item: FeatureNoticeState };

interface Props {
  variant: "flyout" | "dropdown";
  onClose: () => void;
}

export default function NotificationPanel({ variant, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState<Set<string>>(() => new Set());
  const markedServer = useRef(false);
  const notices = useFeatureNotices();

  const list = useInfiniteQuery({
    queryKey: CENTER_KEY,
    queryFn: ({ pageParam }) =>
      api.get<Page<AppNotification>>(`/notifications/center?page=${pageParam}&size=${PAGE_SIZE}`),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.length : undefined),
    enabled: !!user?.emailVerified,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onMutate: () => qc.setQueryData<UnreadCount>(UNREAD_KEY, { count: 0 }),
    onSettled: () => qc.invalidateQueries({ queryKey: UNREAD_KEY }),
  });

  const serverSettled = !user?.emailVerified || list.isFetchedAfterMount || list.isError;

  useEffect(() => {
    if (markedServer.current || !serverSettled) return;
    markedServer.current = true;
    const unread = (list.data?.pages ?? []).flatMap((p) => p.items).filter((n) => !n.read);
    if (unread.length > 0) {
      setHighlight((prev) => {
        const next = new Set(prev);
        unread.forEach((n) => next.add(`n:${n.id}`));
        return next;
      });
    }
    if (unread.length > 0 || (qc.getQueryData<UnreadCount>(UNREAD_KEY)?.count ?? 0) > 0) {
      readAll.mutate();
    }
  }, [serverSettled, list.data, qc, readAll]);

  useEffect(() => {
    const unread = notices.filter((n) => !n.read);
    if (unread.length === 0) return;
    setHighlight((prev) => {
      const next = new Set(prev);
      unread.forEach((n) => next.add(`f:${n.id}`));
      return next;
    });
    markFeatureNoticesRead(unread.map((n) => n.storageKey));
  }, [notices]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (variant !== "flyout") return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (panelRef.current?.contains(target) || target.closest("[data-notif-toggle]")) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [variant, onClose]);

  const rows = useMemo<Row[]>(() => {
    const server: Row[] = (list.data?.pages ?? [])
      .flatMap((p) => p.items)
      .map((item) => ({ key: `n:${item.id}`, at: new Date(item.createdAt).getTime(), kind: "server", item }));
    const feature: Row[] = notices
      .filter((n) => !n.stale || highlight.has(`f:${n.id}`))
      .map((item) => ({
        key: `f:${item.id}`,
        at: new Date(item.date).getTime(),
        kind: "feature",
        item,
      }));
    return [...server, ...feature].sort((a, b) => b.at - a.at);
  }, [list.data, notices, highlight]);

  function go(url: string | null) {
    onClose();
    if (!url) return;
    if (url.startsWith("/")) navigate(url);
    else window.location.assign(url);
  }

  function openFeature(notice: FeatureNoticeState) {
    onClose();
    notice.action.run?.();
    if (notice.action.to) navigate(notice.action.to);
  }

  const loading = !!user?.emailVerified && list.isLoading && rows.length === 0;

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5">
        <h2 className="text-[14px] font-semibold text-fg">Notifications</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notifications"
          className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
        >
          <X size={15} />
        </button>
      </div>
      <div className={variant === "flyout" ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : ""}>
        {loading ? (
          <div className="space-y-2 px-4 pb-4 pt-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl" style={{ background: "var(--surface-hi)" }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 pb-10 pt-8 text-center">
            <span
              className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: "var(--surface-hi)", color: "var(--fg-3)" }}
            >
              <Bell size={20} strokeWidth={1.6} />
            </span>
            <p className="text-[13px] font-semibold text-fg">You're all caught up</p>
            <p className="mt-1 text-[12px] leading-snug text-fg-3">
              Announcements, friend requests and new features show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line px-2 pb-3">
            {rows.map((row) => {
              const lit = highlight.has(row.key);
              if (row.kind === "feature") {
                const n = row.item;
                const Icon = n.icon;
                return (
                  <li key={row.key} className="py-1">
                    <NoticeRow
                      lit={lit}
                      icon={<Icon size={16} strokeWidth={1.9} />}
                      color="var(--accent)"
                      title={n.title}
                      body={n.body}
                      action={n.action.label}
                      iso={n.date}
                      onClick={() => openFeature(n)}
                    />
                  </li>
                );
              }
              const n = row.item;
              const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.ANNOUNCEMENT!;
              const Icon = style.icon;
              return (
                <li key={row.key} className="py-1">
                  <NoticeRow
                    lit={lit}
                    icon={<Icon size={16} strokeWidth={1.9} />}
                    color={style.color}
                    title={n.title ?? style.fallback}
                    body={n.message}
                    iso={n.createdAt}
                    onClick={() => go(n.type === "FRIEND_REQUEST" ? "/friends" : n.url)}
                    chevron={!!n.url || n.type === "FRIEND_REQUEST"}
                  />
                </li>
              );
            })}
            {list.hasNextPage && (
              <li className="px-1 pt-1">
                <button
                  type="button"
                  onClick={() => list.fetchNextPage()}
                  disabled={list.isFetchingNextPage}
                  className="btn btn-ghost w-full"
                >
                  {list.isFetchingNextPage ? "Loading..." : "Show older"}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </>
  );

  if (variant === "flyout") {
    return (
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notifications"
        className="glass animate-flyout fixed bottom-0 top-0 z-40 flex w-[360px] max-w-[calc(100vw-220px)] flex-col"
        style={{ left: 220, borderRadius: 0, borderWidth: "0 1px 0 0" }}
      >
        {body}
      </div>
    );
  }

  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10 bg-black/35 animate-fade" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notifications"
        className="animate-slide absolute inset-x-0 top-full overflow-y-auto overscroll-contain"
        style={{
          maxHeight: "calc(var(--app-height, 100dvh) - 150px)",
          background: "var(--surface)",
          borderBottom: "1px solid var(--line)",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        {body}
      </div>
    </>
  );
}

function NoticeRow({
  lit,
  icon,
  color,
  title,
  body,
  action,
  iso,
  chevron = false,
  onClick,
}: {
  lit: boolean;
  icon: React.ReactNode;
  color: string;
  title: string;
  body: string;
  action?: string;
  iso: string;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-surface-hi"
      style={lit ? { background: "color-mix(in srgb, var(--accent) 9%, transparent)" } : undefined}
    >
      <span
        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-fg">{title}</span>
          {lit && (
            <span aria-label="Unread" className="h-1.5 w-1.5 shrink-0 rounded-full bg-red" />
          )}
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-fg-2">{body}</span>
        {action && (
          <span className="mt-1 block text-[12px] font-medium" style={{ color: "var(--accent)" }}>
            {action}
          </span>
        )}
        <span className="mt-1 block text-[11px] text-fg-3">
          {timeAgo(iso)} · {formatDateTimeFull(iso)}
        </span>
      </span>
      {chevron && <ChevronRight size={14} className="mt-2 shrink-0 text-fg-3" />}
    </button>
  );
}
