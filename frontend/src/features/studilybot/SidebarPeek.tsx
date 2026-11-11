import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import Mascot from "./Mascot";

const SIZE = 84;
const SLOT = 54;
const FIGURE = Math.round((SIZE * 312) / 240);
const FOOTER_HIDDEN_ON = ["/study/studilybot", "/messages"];
const TAP_HOLD_MS = 3000;

export default function SidebarPeek({
  variant = "sidebar",
  hidden = false,
}: {
  variant?: "sidebar" | "footer";
  hidden?: boolean;
}) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [out, setOut] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const first = user?.name?.trim().split(/\s+/)[0];
  const footer = variant === "footer";

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => setOut(false), [pathname]);

  if (footer && (hidden || FOOTER_HIDDEN_ON.some((p) => pathname.startsWith(p)))) return null;

  function tap(e: MouseEvent) {
    if (!footer || out) return;
    e.preventDefault();
    setOut(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOut(false), TAP_HOLD_MS);
  }

  return (
    <Link
      to="/study/studilybot"
      aria-label="Open StudilyBot"
      className={
        footer
          ? "peek-slot absolute bottom-0 right-3 z-30 block w-[200px] md:hidden"
          : "peek-slot relative mx-3 mb-3 mt-1 block rounded-lg"
      }
      style={{ height: SLOT }}
      onClick={tap}
      onMouseEnter={footer ? undefined : () => setOut(true)}
      onMouseLeave={footer ? undefined : () => setOut(false)}
      onFocus={footer ? undefined : () => setOut(true)}
      onBlur={footer ? undefined : () => setOut(false)}
    >
      {!footer && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: "var(--line)" }}
        />
      )}
      {out && (
        <span className="mascot-bubble pointer-events-none absolute bottom-4 right-[84px] z-[2] w-max max-w-[108px]">
          Hi{first ? ` ${first}` : ""}! Let's study!
        </span>
      )}
      <span
        className="peek-bot pointer-events-none absolute bottom-0 right-2 z-[1] block"
        style={{ transform: out ? "translateY(0)" : `translateY(${FIGURE - 62}px)` }}
      >
        <Mascot state={out ? "wave" : "idle"} size={SIZE} />
      </span>
    </Link>
  );
}
