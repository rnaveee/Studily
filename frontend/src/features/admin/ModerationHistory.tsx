import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import { formatReasons } from "../../lib/moderation";
import type { AdminModerationAction } from "../../types";
import { ago } from "./AdminOverview";

const TYPE_LABEL = { WARNING: "Warning", SUSPENSION: "Suspension", BAN: "Ban" } as const;

export function ModerationHistory({ actions }: { actions: AdminModerationAction[] }) {
  if (actions.length === 0) return <p className="text-[12px] text-fg-3">No moderation history.</p>;
  return (
    <ul className="space-y-2">
      {actions.map((a) => {
        const removals = [
          a.removedAvatar ? "picture removed" : null,
          a.clearedBio ? "bio cleared" : null,
          a.deletedMessages > 0 ? `${a.deletedMessages} message${a.deletedMessages === 1 ? "" : "s"} deleted` : null,
        ].filter(Boolean);
        return (
          <li
            key={a.id}
            className="rounded-lg px-3 py-2 text-[12px]"
            style={{ background: "var(--surface-hi)" }}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-fg">{TYPE_LABEL[a.type]}</span>
              {a.active && <span className="badge badge-orange">Active</span>}
              <span className="text-fg-3">
                by {a.createdBy} · {ago(a.createdAt)}
              </span>
            </div>
            <p className="mt-1 text-fg-2">{formatReasons(a.reasons)}</p>
            {a.note && <p className="mt-1 whitespace-pre-wrap text-fg-2 [overflow-wrap:anywhere]">{a.note}</p>}
            <div className="mt-1 space-y-0.5 text-fg-3">
              {a.endsAt && <p>Ends {new Date(a.endsAt).toLocaleString()}</p>}
              {a.type === "WARNING" && (
                <p>{a.acknowledgedAt ? `Acknowledged ${ago(a.acknowledgedAt)}` : "Not yet acknowledged"}</p>
              )}
              {a.revokedAt && (
                <p>
                  Revoked {ago(a.revokedAt)}
                  {a.revokedBy ? ` by ${a.revokedBy}` : ""}
                </p>
              )}
              {removals.length > 0 && <p>{removals.join(", ")}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function LiftButton({ userId, username, banned }: { userId: number; username: string; banned: boolean }) {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const lift = useMutation({
    mutationFn: () => api.post<void>(`/admin/users/${userId}/moderation/lift`),
    onSuccess: () => {
      toast.success(banned ? "Unbanned" : "Suspension lifted");
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
      qc.invalidateQueries({ queryKey: ["admin", "report-case", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
    },
  });

  async function click() {
    const ok = await confirm({
      title: banned ? `Unban @${username}?` : `Lift @${username}'s suspension?`,
      message: banned
        ? "They will be able to sign in again and their email can sign up again."
        : "They will be able to use the app again right away.",
      confirmLabel: banned ? "Unban" : "Lift suspension",
    });
    if (ok) lift.mutate();
  }

  return (
    <button type="button" className="btn btn-ghost" disabled={lift.isPending} onClick={click}>
      {banned ? "Unban" : "Lift suspension"}
    </button>
  );
}
