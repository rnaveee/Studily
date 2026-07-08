import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, X, Clock } from "lucide-react";
import { api } from "../../lib/api";
import Avatar from "../../components/Avatar";
import type { Page, Relationship } from "../../types";

export default function UserSearchModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="card flex h-[70vh] w-full max-w-sm flex-col gap-3 rounded-b-none p-5 shadow-xl animate-sheet sm:h-auto sm:max-h-[70vh] sm:rounded-b-xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Find people</h2>
            <p className="mt-1 text-[13px] text-fg-2">Search by username.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
          <input
            className="input pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. rnavee"
            autoFocus
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {debounced.length === 0 ? (
            <p className="py-4 text-center text-sm text-fg-3">
              Type a username to find someone.
            </p>
          ) : results.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-fg-3">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
              Searching…
            </div>
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
      </div>
    </div>,
    document.body,
  );
}
