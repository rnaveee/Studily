import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Plus, Users2 } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth, useRequireAuth } from "../../lib/auth";
import { queryClient } from "../../lib/queryClient";
import Avatar from "../../components/Avatar";
import SegmentedToggle from "../../components/SegmentedToggle";
import type { Conversation, FriendRequestItem } from "../../types";
import NewGroupModal from "./NewGroupModal";

type Tab = "messages" | "groups";

export default function MessagesPage() {
  const [tab, setTab] = useState<Tab>("messages");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();

  const friends = useQuery({
    queryKey: ["friends", "list"],
    queryFn: () => api.get<FriendRequestItem[]>("/friends"),
  });

  const directConvos = useQuery({
    queryKey: ["conversations", "direct"],
    queryFn: () => api.get<Conversation[]>("/conversations?type=DIRECT"),
  });

  const groups = useQuery({
    queryKey: ["conversations", "groups"],
    queryFn: () => api.get<Conversation[]>("/conversations?type=GROUP"),
  });

  const directByUserId = useMemo(() => {
    const map = new Map<number, Conversation>();
    for (const c of directConvos.data ?? []) {
      const other = c.members.find((m) => m.id !== user?.id);
      if (other) map.set(other.id, c);
    }
    return map;
  }, [directConvos.data, user?.id]);

  const openDirect = useMutation({
    mutationFn: (userId: number) =>
      api.post<Conversation>("/conversations/direct", { userId }),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/messages/${conv.id}`);
    },
  });

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-semibold text-fg">Messages</h1>
        <p className="mt-1 text-[13px] text-fg-3">
          Chat with your friends and study groups.
        </p>
      </div>

      <SegmentedToggle<Tab>
        options={[
          { value: "messages", label: "Messages" },
          { value: "groups", label: "Groups" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "messages" ? (
        friends.isLoading ? (
          <Loading />
        ) : friends.data && friends.data.length > 0 ? (
          <ul className="card divide-y divide-line">
            {friends.data.map((r) => {
              const convo = directByUserId.get(r.user.id);
              const unread = convo?.unread ?? false;
              const textClass = unread ? "font-semibold text-fg" : "font-normal text-fg-3";
              return (
                <li key={r.id}>
                  <button
                    onClick={() => openDirect.mutate(r.user.id)}
                    disabled={openDirect.isPending}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hi disabled:opacity-60"
                  >
                    <Avatar
                      name={r.user.name}
                      username={r.user.username}
                      avatarUrl={r.user.avatarUrl}
                      size={36}
                      className="text-[13px]"
                    />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`truncate ${textClass}`}>{r.user.name}</span>
                        <span className="text-[12px] text-fg-3 truncate">@{r.user.username}</span>
                      </div>
                      <div className={`truncate text-[12px] ${textClass}`}>
                        {convo?.lastMessage ?? "Tap to open chat"}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty
            icon={<MessageSquare className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />}
            text="No friends to message yet."
            hint="Add friends to start a conversation."
          />
        )
      ) : (
        <>
          {groups.isLoading ? (
            <Loading />
          ) : groups.data && groups.data.length > 0 ? (
            <ul className="card divide-y divide-line">
              {groups.data.map((g) => {
                const textClass = g.unread ? "font-semibold text-fg" : "font-normal text-fg-3";
                return (
                  <li key={g.id}>
                    <button
                      onClick={() => navigate(`/messages/${g.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hi"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
                      >
                        <Users2 size={16} className="text-accent" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`truncate ${textClass}`}>{g.name}</div>
                        <div className={`truncate text-[12px] ${textClass}`}>
                          {g.lastMessage ?? `${g.members.length} members`}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty
              icon={<Users2 className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />}
              text="No group chats yet."
              hint="Create one with the New group button."
            />
          )}

          <div className="flex justify-center">
            <button onClick={() => requireAuth(() => setShowNewGroup(true))} className="btn btn-primary">
              <Plus size={13} />
              New group
            </button>
          </div>
        </>
      )}

      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} />}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-fg-3">
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
      Loading…
    </div>
  );
}

function Empty({ icon, text, hint }: { icon: React.ReactNode; text: string; hint: string }) {
  return (
    <div className="card p-10 text-center">
      {icon}
      <p className="text-sm text-fg-3">{text}</p>
      <p className="mt-1 text-[12px] text-fg-3">{hint}</p>
    </div>
  );
}
