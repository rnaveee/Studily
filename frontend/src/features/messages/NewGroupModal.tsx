import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import { toast } from "../../lib/toast";
import Avatar from "../../components/Avatar";
import type { Conversation, FriendRequestItem } from "../../types";

export default function NewGroupModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const friends = useQuery({
    queryKey: ["friends", "list"],
    queryFn: () => api.get<FriendRequestItem[]>("/friends"),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<Conversation>("/conversations", { name: name.trim(), memberIds: selected }),
    onSuccess: (conv) => {
      toast.success("Group created");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onClose();
      navigate(`/messages/${conv.id}`);
    },
    onError: () => toast.error("Couldn't create the group"),
  });

  function toggle(userId: number) {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  const canCreate = name.trim().length > 0 && selected.length > 0 && !create.isPending;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="card flex max-h-[80vh] w-full max-w-sm flex-col gap-4 p-5 shadow-xl animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">New group</h2>
            <p className="mt-1 text-[13px] text-fg-2">Pick friends to add to the group.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div>
          <label className="field-label">Group name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Study squad"
            autoFocus
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {friends.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-fg-3">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
              Loading…
            </div>
          ) : friends.data && friends.data.length > 0 ? (
            <ul className="divide-y divide-line">
              {friends.data.map((r) => {
                const isSelected = selected.includes(r.user.id);
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => toggle(r.user.id)}
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
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isSelected ? "border-accent bg-accent text-accent-fg" : "border-line text-transparent"
                        }`}
                      >
                        <Check size={12} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-4 text-sm text-fg-3">You need friends before you can make a group.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-fg-3">
            {selected.length} selected
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={() => create.mutate()} disabled={!canCreate} className="btn btn-primary">
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
