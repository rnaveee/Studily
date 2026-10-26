import { Bell } from "lucide-react";
import { useUnreadTotal } from "../features/notifications/useNotifications";

export default function NotificationBell({
  open,
  onToggle,
  variant = "icon",
}: {
  open: boolean;
  onToggle: () => void;
  variant?: "icon" | "nav";
}) {
  const unread = useUnreadTotal();
  const dot = unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red" />;

  if (variant === "nav") {
    return (
      <button
        type="button"
        data-notif-toggle
        onClick={onToggle}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className={[
          "relative flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 select-none",
          open ? "bg-surface-hi text-fg" : "text-fg-2 hover:bg-surface-hi hover:text-fg",
        ].join(" ")}
      >
        <span className="relative inline-flex">
          <Bell size={15} strokeWidth={1.8} />
          {dot}
        </span>
        Notifications
      </button>
    );
  }

  return (
    <button
      type="button"
      data-notif-toggle
      onClick={onToggle}
      aria-expanded={open}
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      title="Notifications"
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg`}
      style={open ? { background: "var(--surface-hi)", color: "var(--fg)" } : undefined}
    >
      <span className="relative inline-flex">
        <Bell size={16} strokeWidth={1.8} />
        {dot}
      </span>
    </button>
  );
}
