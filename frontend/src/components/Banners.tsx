  import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Eye, FileText, MailWarning, Megaphone, Smartphone, Sparkles, Timer, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { formatMs, pomodoroColor, usePomodoro } from "../lib/pomodoro";

const BETA_KEY = "studily.banner.beta";
const INSTALL_KEY = "studily.banner.install";
const MAKEOVER_KEY = "studily.banner.makeover";
const PARSER_KEY = "studily.banner.parser";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function Banners() {
  const { user, guest } = useAuth();
  const [betaDismissed, setBetaDismissed] = useState(
    () => localStorage.getItem(BETA_KEY) === "1",
  );
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem(INSTALL_KEY) === "1" || isStandalone(),
  );
  const [makeoverDismissed, setMakeoverDismissed] = useState(
    () => localStorage.getItem(MAKEOVER_KEY) === "1",
  );
  const [parserDismissed, setParserDismissed] = useState(
    () => localStorage.getItem(PARSER_KEY) === "1",
  );

  const { data: parseAvailability } = useQuery({
    queryKey: ["course-parse-enabled"],
    queryFn: () => api.get<{ enabled: boolean }>("/courses/parse/enabled"),
    staleTime: 5 * 60_000,
    enabled: !!user && !parserDismissed,
  });
  const showParser = !parserDismissed && !!user && (parseAvailability?.enabled ?? false);

  function dismiss(key: string, set: (v: boolean) => void) {
    localStorage.setItem(key, "1");
    set(true);
  }

  const unverified = !!user && !user.emailVerified;
  const pomo = usePomodoro();

  if (
    betaDismissed &&
    installDismissed &&
    makeoverDismissed &&
    !showParser &&
    !unverified &&
    !pomo.running &&
    !guest
  ) {
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
      {showParser && (
        <Banner
          icon={<FileText size={13} className="shrink-0" />}
          color="var(--orange)"
          onDismiss={() => dismiss(PARSER_KEY, setParserDismissed)}
          wrap
        >
          New: build a course straight from your outline.{" "}
          <Link to="/courses" className="font-medium underline underline-offset-2">
            Upload a syllabus
          </Link>{" "}
          and we'll fill in the times and deadlines. It's in beta and won't always get it right, so
          check everything before you save.
        </Banner>
      )}
      {!makeoverDismissed && (
        <Banner
          icon={<Sparkles size={13} className="shrink-0" />}
          onDismiss={() => dismiss(MAKEOVER_KEY, setMakeoverDismissed)}
          wrap
        >
          Notice anything? Studily got a makeover! Don't like it?{" "}
          <Link to="/settings" className="font-medium underline underline-offset-2">
            Revert back in settings
          </Link>
          .
        </Banner>
      )}
      {!betaDismissed && (
        <Banner
          icon={<Megaphone size={13} className="shrink-0" />}
          onDismiss={() => dismiss(BETA_KEY, setBetaDismissed)}
        >
          Studily is in beta! Found a bug?{" "}
          <Link to="/support" className="font-medium underline underline-offset-2">
            Send it our way
          </Link>
          .
        </Banner>
      )}
      {!installDismissed && (
        <Banner
          icon={<Smartphone size={13} className="shrink-0" />}
          onDismiss={() => dismiss(INSTALL_KEY, setInstallDismissed)}
        >
          Get Studily as an app!{" "}
          <Link to="/install" className="font-medium underline underline-offset-2">
            See how to install it
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
