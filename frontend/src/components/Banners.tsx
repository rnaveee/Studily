import { Link } from "react-router-dom";
import { Eye, MailWarning, Timer, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatMs, pomodoroColor, usePomodoro } from "../lib/pomodoro";

export default function Banners() {
  const { user, guest } = useAuth();
  const unverified = !!user && !user.emailVerified;
  const pomo = usePomodoro();

  if (!unverified && !pomo.running && !guest) {
    return null;
  }

  return (
    <div className="shrink-0">
      {guest && (
        <Banner icon={<Eye size={13} className="shrink-0" />} wrap>
          You're viewing a demo semester.{" "}
          <Link to="/signup" className="font-medium underline underline-offset-2">
            Create a free account
          </Link>{" "}
          to build your own.
        </Banner>
      )}
      {pomo.running && (
        <Banner
          icon={<Timer size={13} className="shrink-0" />}
          color={pomodoroColor(pomo.phase)}
        >
          <Link to="/pomodoro" className="font-medium tabular-nums">
            {pomo.phase === "study" ? "Study" : "Break"}: {formatMs(pomo.remainingMs)}
          </Link>
        </Banner>
      )}
      {unverified && (
        <Banner icon={<MailWarning size={13} className="shrink-0" />} color="var(--orange)" wrap>
          Your account is unverified! Some features are unavailable.{" "}
          <Link to="/settings" className="font-medium underline underline-offset-2">
            Verify now
          </Link>
          .
        </Banner>
      )}
    </div>
  );
}

function Banner({
  icon,
  onDismiss,
  color = "var(--accent)",
  wrap = false,
  children,
}: {
  icon: React.ReactNode;
  onDismiss?: () => void;
  color?: string;
  wrap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 text-[12px] animate-slide"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 9%, var(--surface))`,
        borderBottom: "1px solid var(--line)",
      }}
    >
      {icon}
      <p className={wrap ? "flex-1 leading-snug" : "flex-1 truncate"}>{children}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded p-0.5 transition-colors hover:bg-surface-hi"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
