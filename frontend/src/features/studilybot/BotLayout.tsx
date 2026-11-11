import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Menu, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import SegmentedToggle from "../../components/SegmentedToggle";
import { Skeleton } from "../../components/Skeleton";
import { api, isGuestMode } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import type { FeynmanSummary } from "../feynman/feynmanApi";
import BotMascot from "./BotMascot";
import { botApi, type BotChatSummary, type Difficulty } from "./api";
import { useBotStatus } from "./useBotStatus";

export type BotSurface = "CHAT" | "RECALL" | "PRACTICE";

export interface BotSidebarItem {
  id: number;
  title: string;
  updatedAt: string;
  subtitle?: string | null;
}

export interface BotSource {
  key: BotSurface;
  list: () => Promise<BotSidebarItem[]>;
  rename?: (id: number, title: string) => Promise<unknown>;
  remove: (id: number) => Promise<unknown>;
  hrefFor: (id: number) => string;
}

export const BOT_PATHS: Record<BotSurface, string> = {
  CHAT: "/study/studilybot/chat",
  RECALL: "/study/studilybot/recall",
  PRACTICE: "/study/studilybot/practice",
};

const SURFACE_LABEL: Record<BotSurface, string> = { CHAT: "Chat", RECALL: "Recall", PRACTICE: "Practice" };
const SURFACE_NOUN: Record<BotSurface, string> = { CHAT: "chat", RECALL: "session", PRACTICE: "session" };
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  CLASS: "Class-accurate",
};

function botChatSource(mode: "CHAT" | "PRACTICE"): BotSource {
  return {
    key: mode,
    list: async () => {
      const chats: BotChatSummary[] = await botApi.chats(mode);
      return chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        updatedAt: chat.updatedAt,
        subtitle:
          mode === "PRACTICE"
            ? [chat.difficulty ? DIFFICULTY_LABEL[chat.difficulty] : null, chat.courseName]
                .filter(Boolean)
                .join(" · ") || null
            : chat.courseName ?? "No course",
      }));
    },
    rename: (id, title) => botApi.rename(id, title),
    remove: (id) => botApi.remove(id),
    hrefFor: (id) => `${BOT_PATHS[mode]}/${id}`,
  };
}

const recallSource: BotSource = {
  key: "RECALL",
  list: async () => {
    const sessions = await api.get<FeynmanSummary[]>("/feynman/sessions");
    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt,
      subtitle: s.status === "COMPLETE" ? `Complete · ${s.score ?? 0}%` : "In progress",
    }));
  },
  remove: (id) => api.del<void>(`/feynman/sessions/${id}`),
  hrefFor: (id) => `${BOT_PATHS.RECALL}/${id}`,
};

export const BOT_SOURCES: Record<BotSurface, BotSource> = {
  CHAT: botChatSource("CHAT"),
  RECALL: recallSource,
  PRACTICE: botChatSource("PRACTICE"),
};

export function GuestSignUpCard({ what }: { what: string }) {
  return (
    <div className="flex flex-1 items-start justify-center px-4 py-8">
      <div className="card w-full max-w-md p-8 text-center">
        <span
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <Sparkles size={20} className="text-accent" />
        </span>
        <h2 className="mt-4 text-[15px] font-semibold text-fg">Sign up to use StudilyBot</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-3">{what}</p>
        <Link to="/signup" className="btn btn-primary mt-5">
          Create a free account
        </Link>
      </div>
    </div>
  );
}

function RenameField({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const finished = useRef(false);

  function finish(save: boolean) {
    if (finished.current) return;
    finished.current = true;
    const next = value.trim();
    if (save && next && next !== initial) onSave(next);
    else onCancel();
  }

  return (
    <input
      autoFocus
      value={value}
      maxLength={80}
      aria-label="Rename"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
      className="input"
      style={{ padding: "6px 10px" }}
    />
  );
}

export default function BotLayout({
  mode,
  activeId = null,
  source,
  topBarEnd,
  children,
}: {
  mode: BotSurface;
  activeId?: number | null;
  source?: BotSource;
  topBarEnd?: ReactNode;
  children: ReactNode;
}) {
  const src = source ?? BOT_SOURCES[mode];
  const guest = isGuestMode();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const status = useBotStatus();
  const [drawer, setDrawer] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const list = useQuery({
    queryKey: ["bot", "chats", src.key],
    queryFn: src.list,
    enabled: !guest,
  });

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawer) return;
    drawerCloseRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !e.defaultPrevented) setDrawer(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [drawer]);

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => {
      if (!src.rename) throw new Error("Renaming isn't available here.");
      return src.rename(id, title);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot", "chats"] }),
    onError: () => toast.error("Couldn't rename that. Try again."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => src.remove(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["bot", "chats"] });
      if (id === activeId) navigate(BOT_PATHS[mode], { replace: true });
    },
    onError: () => toast.error("Couldn't delete that. Try again."),
  });

  async function confirmRemove(item: BotSidebarItem) {
    const ok = await confirm({
      title: `Delete "${item.title}"?`,
      message: "This removes the conversation for good.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) remove.mutate(item.id);
  }

  function newChat() {
    navigate(BOT_PATHS[mode]);
    setDrawer(false);
  }

  function sidebar(mobile: boolean) {
    const items = list.data ?? [];
    const noun = SURFACE_NOUN[mode];
    return (
      <>
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-4">
          <Link to="/study/studilybot" className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5">
            <BotMascot size={26} />
            <span className="truncate text-[13px] font-semibold text-fg">StudilyBot</span>
          </Link>
          {mobile && (
            <button
              ref={drawerCloseRef}
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Close chats"
              className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="px-3 pb-3">
          <button type="button" onClick={newChat} className="btn btn-primary w-full">
            <Plus size={14} />
            New {noun}
          </button>
        </div>
        <div className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">
          {SURFACE_LABEL[mode]}
        </div>
        <nav aria-label={`${SURFACE_LABEL[mode]} history`} className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {guest ? (
            <p className="px-2 py-3 text-[12px] text-fg-3">Sign up to save your {noun}s here.</p>
          ) : list.isError ? (
            <div className="px-2 py-3 text-[12px] text-fg-3">
              Couldn't load your {noun}s.{" "}
              <button type="button" onClick={() => list.refetch()} className="font-medium text-accent">
                Retry
              </button>
            </div>
          ) : list.isLoading ? (
            <div className="space-y-2 px-2 py-2">
              <Skeleton height={34} />
              <Skeleton height={34} />
              <Skeleton height={34} />
            </div>
          ) : items.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-fg-3">No {noun}s yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = item.id === activeId;
                return (
                  <li key={item.id} className="group relative">
                    {renamingId === item.id ? (
                      <RenameField
                        initial={item.title}
                        onCancel={() => setRenamingId(null)}
                        onSave={(title) => {
                          setRenamingId(null);
                          rename.mutate({ id: item.id, title });
                        }}
                      />
                    ) : (
                      <div
                        className={`flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                          active ? "bg-surface-hi" : "hover:bg-surface-hi"
                        }`}
                      >
                        <Link
                          to={src.hrefFor(item.id)}
                          aria-current={active ? "page" : undefined}
                          className="min-w-0 flex-1 px-3 py-2"
                        >
                          <div className={`truncate text-[13px] font-medium ${active ? "text-fg" : "text-fg-2"}`}>
                            {item.title}
                          </div>
                          {item.subtitle && <div className="truncate text-[11px] text-fg-3">{item.subtitle}</div>}
                        </Link>
                        {src.rename && (
                          <button
                            type="button"
                            onClick={() => setRenamingId(item.id)}
                            aria-label={`Rename ${item.title}`}
                            className="shrink-0 rounded-md p-1.5 text-fg-3 transition-opacity hover:text-fg max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => confirmRemove(item)}
                          aria-label={`Delete ${item.title}`}
                          className="shrink-0 rounded-md p-1.5 text-fg-3 transition-opacity hover:text-red max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </>
    );
  }

  return (
    <div
      data-chat-panel
      className="chat-in fixed inset-0 z-40 flex bg-bg h-[var(--app-height,auto)] md:relative md:z-auto md:h-full md:min-h-0 md:flex-1"
    >
      <aside
        className="hidden w-[256px] shrink-0 flex-col md:flex"
        style={{ background: "var(--surface)", borderRight: "1px solid var(--line)" }}
      >
        {sidebar(false)}
      </aside>

      <div className={`fixed inset-0 z-50 md:hidden ${drawer ? "" : "pointer-events-none"}`} inert={!drawer}>
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{ background: "var(--scrim)", opacity: drawer ? 1 : 0 }}
          onClick={() => setDrawer(false)}
          aria-hidden
        />
        <aside
          role={drawer ? "dialog" : undefined}
          aria-modal={drawer ? true : undefined}
          aria-label={drawer ? "StudilyBot chats" : undefined}
          className="absolute inset-y-0 left-0 flex w-[84%] max-w-[300px] flex-col transition-transform duration-200 ease-out"
          style={{
            background: "var(--surface)",
            borderRight: "1px solid var(--line)",
            transform: drawer ? "translateX(0)" : "translateX(-102%)",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
          {sidebar(true)}
        </aside>
      </div>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center gap-2 px-3 pb-2.5 md:px-5 md:py-3"
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--line)",
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)",
          }}
        >
          <Link to="/study/studilybot" aria-label="StudilyBot home" className="btn btn-ghost shrink-0 md:hidden">
            <ArrowLeft size={14} />
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Show chats"
            className="btn btn-ghost shrink-0 md:hidden"
          >
            <Menu size={15} />
          </button>
          <div className="min-w-0 flex-1 md:flex-none">
            <SegmentedToggle<BotSurface>
              options={(["CHAT", "RECALL", "PRACTICE"] as const).map((value) => ({
                value,
                label: SURFACE_LABEL[value],
              }))}
              value={mode}
              onChange={(value) => navigate(BOT_PATHS[value])}
              className="max-w-[300px]"
            />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">{topBarEnd}</div>
        </header>

        {status.data && !status.data.enabled && (
          <div
            role="status"
            className="shrink-0 px-4 py-2 text-[12px] text-fg-2"
            style={{
              background: "color-mix(in srgb, var(--yellow) 12%, var(--surface))",
              borderBottom: "1px solid var(--line)",
            }}
          >
            StudilyBot is taking a break right now. Try again later.
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          {guest ? (
            <GuestSignUpCard what="Sign up free to chat with StudilyBot about your own course files, save your conversations and practice with problems from your classes." />
          ) : (
            children
          )}
        </div>
      </section>
    </div>
  );
}
