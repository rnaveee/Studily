import { formatRemaining } from "../../lib/moderation";

export default function AccountStatusPill({
  status,
  banned,
  suspendedUntil,
}: {
  status: string;
  banned: boolean;
  suspendedUntil: string | null;
}) {
  if (banned) return <span className="badge badge-red">Banned</span>;
  if (status !== "SUSPENDED") return <span className="badge badge-green">Good</span>;
  const until = suspendedUntil ? new Date(suspendedUntil) : null;
  return (
    <span className="badge badge-orange" title={until ? until.toLocaleString() : undefined}>
      {until ? `Suspended · ${formatRemaining(until.getTime() - Date.now())} left` : "Suspended"}
    </span>
  );
}
