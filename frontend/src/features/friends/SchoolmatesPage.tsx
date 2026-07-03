import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, School, UserPlus, Check, Clock } from "lucide-react";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/queryClient";
import Avatar from "../../components/Avatar";
import type { Relationship } from "../../types";

export default function SchoolmatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["schoolmates"],
    queryFn: () => api.get<Relationship[]>("/friends/schoolmates"),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["schoolmates"] });
    queryClient.invalidateQueries({ queryKey: ["friends"] });
  }

  const send = useMutation({
    mutationFn: (userId: number) => api.post("/friends/requests", { userId }),
    onSuccess: invalidateAll,
  });

  const accept = useMutation({
    mutationFn: (requestId: number) => api.post(`/friends/requests/${requestId}/accept`),
    onSuccess: invalidateAll,
  });

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center gap-3">
        <Link to="/friends" className="btn btn-ghost">
          <ArrowLeft size={13} />
          Back
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-fg">Schoolmates</h1>
          <p className="text-[13px] text-fg-3">Other users from your school</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-fg-3">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
          Loading…
        </div>
      ) : data && data.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.map((r) => (
            <li key={r.user.id} className="card p-4 animate-fade flex items-center gap-3">
              <Avatar name={r.user.name} username={r.user.username} avatarUrl={r.user.avatarUrl} size={40} className="text-sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-medium text-fg truncate">{r.user.name}</span>
                  <span className="text-[12px] text-fg-3 truncate">@{r.user.username}</span>
                </div>
                {r.user.year != null && (
                  <div className="text-[12px] text-fg-3">Year {r.user.year}</div>
                )}
              </div>
              <ActionButton
                relationship={r}
                onAdd={() => send.mutate(r.user.id)}
                onAccept={() => r.requestId && accept.mutate(r.requestId)}
                pending={send.isPending || accept.isPending}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="card p-10 text-center">
          <School className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
          <p className="text-sm text-fg-3">No schoolmates found yet.</p>
          <p className="mt-1 text-[12px] text-fg-3">
            Make sure your school is set in{" "}
            <Link to="/profile" className="text-accent hover:text-accent-2 transition-colors">
              Profile
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  relationship,
  onAdd,
  onAccept,
  pending,
}: {
  relationship: Relationship;
  onAdd: () => void;
  onAccept: () => void;
  pending: boolean;
}) {
  switch (relationship.status) {
    case "FRIENDS":
      return <span className="badge badge-green shrink-0">Friends</span>;
    case "OUTGOING_PENDING":
      return (
        <span className="badge badge-muted shrink-0">
          <Clock size={11} />
          Pending
        </span>
      );
    case "INCOMING_PENDING":
      return (
        <button onClick={onAccept} disabled={pending} className="btn btn-primary shrink-0">
          <Check size={13} />
          Accept
        </button>
      );
    default:
      return (
        <button onClick={onAdd} disabled={pending} className="btn btn-soft shrink-0">
          <UserPlus size={13} />
          Add friend
        </button>
      );
  }
}
