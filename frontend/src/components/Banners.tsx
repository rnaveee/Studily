  import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Eye, FileText, Layers, MailWarning, Smartphone, Timer, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import type { ParseAvailability } from "../types";
import { formatMs, pomodoroColor, usePomodoro } from "../lib/pomodoro";
import { openFlashcardsWhatsNew } from "../features/learn/FlashcardsWhatsNew";

const INSTALL_KEY = "studily.banner.install";
const PARSER_KEY = "studily.banner.parser";
const FLASHCARDS_KEY = "studily.banner.flashcards";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function Banners() {
  const { user, guest } = useAuth();
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem(INSTALL_KEY) === "1" || isStandalone(),
  );
  const [parserDismissed, setParserDismissed] = useState(
    () => localStorage.getItem(PARSER_KEY) === "1",
  );
  const [flashcardsDismissed, setFlashcardsDismissed] = useState(
    () => localStorage.getItem(FLASHCARDS_KEY) === "1",
  );

  const { data: parseAvailability } = useQuery({
    queryKey: ["course-parse-enabled"],
    queryFn: () => api.get<ParseAvailability>("/courses/parse/enabled"),
    staleTime: 5 * 60_000,
    enabled: !!user && !parserDismissed,
  });
  const showParser = !parserDismissed && !!user && (parseAvailability?.enabled ?? false);
  const showFlashcards = !flashcardsDismissed && !!user;

  function dismiss(key: string, set: (v: boolean) => void) {
    localStorage.setItem(key, "1");
    set(true);
  }

  const unverified = !!user && !user.emailVerified;
  const pomo = usePomodoro();

  if (
    installDismissed &&
    !showParser &&
    !showFlashcards &&
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
      {showFlashcards && (
        <Banner
          icon={<Layers size={13} className="shrink-0" />}
          onDismiss={() => dismiss(FLASHCARDS_KEY, setFlashcardsDismissed)}
          wrap
        >
          Flashcards got an update!{" "}
          <Link
            to="/learn/flashcards"
            onClick={() => openFlashcardsWhatsNew()}
            className="font-medium underline underline-offset-2"
          >
            See what's new
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
