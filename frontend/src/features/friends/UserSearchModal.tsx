import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, Clock } from "lucide-react";
import { api } from "../../lib/api";
import Avatar from "../../components/Avatar";
import Modal from "../../components/Modal";
import type { Page, Relationship } from "../../types";
import { Spinner } from "../../components/Skeleton";

export default function UserSearchModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim().replace(/^@/, "")), 250);
    return () => clearTimeout(t);
  }, [q]);

  const results = useQuery({
    queryKey: ["userSearch", debounced],
    queryFn: () =>
      api.get<Page<Relationship>>(`/friends/search?username=${encodeURIComponent(debounced)}&size=20`),
    enabled: debounced.length > 0,
  });

  function open(userId: number) {
    onClose();
    navigate(`/users/${userId}`);
  }

  return (
    <Modal
      onClose={onClose}
      variant="sheet"
      bodyClassName="max-h-[min(50vh,100%)] sm:max-h-[70vh]"
      title={
        <div>
          <h2 className="text-[15px] font-semibold text-fg">Find people</h2>
          <p className="mt-1 text-[13px] text-fg-2">Search by username.</p>
        </div>
      }
    >

        <div className="relative shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
          <input
            className="input"
            style={{ paddingLeft: "2.1rem" }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. rnavee"
            autoFocus
          />
        </div>

        <div className="min-h-0 overflow-y-auto">
          {debounced.length === 0 ? (
            <p className="py-4 text-center text-sm text-fg-3">
              Type a username to find someone.
            </p>
          ) : results.isLoading ? (
            <div className="py-4"><Spinner label="Searching…" /></div>
          ) : results.data && results.data.items.length > 0 ? (
            <ul className="divide-y divide-line">
              {results.data.items.map((r) => (
                <li key={r.user.id}>
                  <button
                    onClick={() => open(r.user.id)}
                    className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-surface-hi"
                  >
                    <Avatar
                      name={r.user.name}
                      username={r.user.username}
                      avatarUrl={r.user.avatarUrl}
                      size={32}
                      className="text-[12px]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-fg truncate">{r.user.name}</div>
                      <div className="text-[12px] text-fg-3 truncate">@{r.user.username}</div>
                    </div>
                    {r.status === "FRIENDS" && <span className="badge badge-green shrink-0">Friends</span>}
                    {(r.status === "OUTGOING_PENDING" || r.status === "INCOMING_PENDING") && (
                      <span className="badge badge-muted shrink-0">
                        <Clock size={11} />
                        Pending
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-fg-3">
              No users found for “{debounced}”.
            </p>
          )}
        </div>
    </Modal>
  );
}
