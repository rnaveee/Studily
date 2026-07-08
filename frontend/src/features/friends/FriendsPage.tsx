import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users2, School, Link2, Check, X, UserMinus, Search } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import { queryClient } from "../../lib/queryClient";
import Avatar from "../../components/Avatar";
import UserSearchModal from "./UserSearchModal";
import type { FriendRequestItem } from "../../types";

export default function FriendsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const incoming = useQuery({
    queryKey: ["friends", "incoming"],
    queryFn: () => api.get<FriendRequestItem[]>("/friends/incoming"),
  });
  const pending = useQuery({
    queryKey: ["friends", "pending"],
    queryFn: () => api.get<FriendRequestItem[]>("/friends/pending"),
  });
  const friends = useQuery({
    queryKey: ["friends", "list"],
    queryFn: () => api.get<FriendRequestItem[]>("/friends"),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["schoolmates"] });
  }

  const accept = useMutation({
    mutationFn: (id: number) => api.post(`/friends/requests/${id}/accept`),
    onSuccess: () => {
      toast.success("Friend request accepted");
      invalidateAll();
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/friends/requests/${id}`),
    onSuccess: invalidateAll,
  });

  async function handleUnfriend(id: number, name: string) {
    const ok = await confirm({
      title: "Remove friend?",
      message: `${name} will be removed from your friends list.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) remove.mutate(id);
  }

  const inviteText = user
    ? `Join me on Studily! ${window.location.origin}/profile/${user.id}/add`
    : "";

  function copyInviteLink() {
    if (!user) return;
    navigator.clipboard.writeText(inviteText);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  const loading = incoming.isLoading || pending.isLoading || friends.isLoading;

  return (
    <div className="space-y-6 animate-in">
      {user && (
        <div className="card flex items-center gap-2.5 p-2.5">
          <button onClick={copyInviteLink} className="btn btn-soft shrink-0">
            {copied ? <Check size={13} /> : <Link2 size={13} />}
            {copied ? "Copied" : "Copy friend link"}
          </button>
          <span className="min-w-0 flex-1 truncate text-[12px] text-fg-3">{inviteText}</span>
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold text-fg">Friends</h1>
        <p className="mt-1 text-[13px] text-fg-3">
          Connect with people you know on Studily.
        </p>
      </div>

      <Link
        to="/friends/schoolmates"
        className="card flex items-center gap-3 p-4 transition-colors hover:bg-surface-hi"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <School size={16} className="text-accent" />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-fg">Schoolmates</div>
          <div className="text-[12px] text-fg-3">Other users from your school</div>
        </div>
      </Link>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-fg-3">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
          Loading…
        </div>
      ) : (
        <>
          {incoming.data && incoming.data.length > 0 && (
            <Section title="Incoming requests" count={incoming.data.length}>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {incoming.data.map((r) => (
                  <li key={r.id} className="card p-4 animate-fade">
                    <PersonRow item={r} />
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => accept.mutate(r.id)}
                        disabled={accept.isPending}
                        className="btn btn-primary flex-1"
                      >
                        <Check size={13} />
                        Accept
                      </button>
                      <button
                        onClick={() => remove.mutate(r.id)}
                        disabled={remove.isPending}
                        className="btn btn-ghost flex-1"
                      >
                        <X size={13} />
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {pending.data && pending.data.length > 0 && (
            <Section title="Pending" count={pending.data.length}>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pending.data.map((r) => (
                  <li key={r.id} className="card p-4 animate-fade">
                    <PersonRow item={r} />
                    <div className="mt-3 flex items-center justify-between">
                      <span className="badge badge-muted">Pending</span>
                      <button
                        onClick={() => remove.mutate(r.id)}
                        disabled={remove.isPending}
                        className="btn btn-ghost"
                      >
                        Withdraw
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <button
            onClick={() => setShowSearch(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface-hi px-4 py-2.5 text-[13px] font-medium text-fg-2 transition-colors hover:text-fg"
          >
            <Search size={14} className="shrink-0" />
            Add friend
          </button>

          <Section title="Your friends" count={friends.data?.length ?? 0}>
            {friends.data && friends.data.length > 0 ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {friends.data.map((r) => (
                  <li key={r.id} className="card p-4 animate-fade flex items-center justify-between gap-3">
                    <PersonRow item={r} />
                    <button
                      onClick={() => handleUnfriend(r.id, r.user.name)}
                      className="shrink-0 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
                      aria-label="Remove friend"
                    >
                      <UserMinus size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="card p-10 text-center">
                <Users2 className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
                <p className="text-sm text-fg-3">No friends yet.</p>
                <p className="mt-1 text-[12px] text-fg-3">
                  Check out{" "}
                  <Link to="/friends/schoolmates" className="text-accent hover:text-accent-2 transition-colors">
                    schoolmates
                  </Link>{" "}
                  or share your invite link.
                </p>
              </div>
            )}
          </Section>
        </>
      )}

      {showSearch && <UserSearchModal onClose={() => setShowSearch(false)} />}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-fg-3">
        {title}
        <span className="badge badge-muted">{count}</span>
      </h2>
      {children}
    </div>
  );
}

function PersonRow({ item }: { item: FriendRequestItem }) {
  const { user } = item;
  return (
    <Link to={`/users/${user.id}`} className="flex min-w-0 items-center gap-3 group">
      <Avatar name={user.name} username={user.username} avatarUrl={user.avatarUrl} size={36} className="text-[13px]" />
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="font-medium text-fg truncate group-hover:text-accent transition-colors">{user.name}</span>
          <span className="text-[12px] text-fg-3 truncate">@{user.username}</span>
        </div>
        {(user.major || user.year) && (
          <div className="text-[12px] text-fg-3">
            {[user.major, user.year ? `Year ${user.year}` : null].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    </Link>
  );
}
