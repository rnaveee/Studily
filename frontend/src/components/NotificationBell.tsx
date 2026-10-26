import { Bell } from "lucide-react";
import { useUnreadTotal } from "../features/notifications/useNotifications";

export default function NotificationBell({ open, onToggle, compact = false }: { open: boolean; onToggle: () => void; compact?: boolean }) {
  const unread = useUnreadTotal();

  return (
    <button
      type="button"
      data-notif-toggle
      onClick={onToggle}
      aria-expanded={open}
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      title="Notifications"
      className={`inline-flex ${compact ? "h-8 w-8" : "h-10 w-10"} shrink-0 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg`}
      style={open ? { background: "var(--surface-hi)", color: "var(--fg)" } : undefined}
    >
      <span className="relative inline-flex">
        <Bell size={16} strokeWidth={1.8} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red" />}
      </span>
    </button>
  );
}
