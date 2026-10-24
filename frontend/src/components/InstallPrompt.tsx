import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BellRing, Maximize2, Sparkles, Zap } from "lucide-react";
import Modal, { hasOpenModal, useModalClose } from "./Modal";
import { useAuth } from "../lib/auth";
import { isTouch } from "../lib/isTouch";
import { isStandalone } from "../lib/pwa";
import { useWelcomeTourStep } from "../lib/welcomeTour";

const PROMPTED_KEY = "studily.install.prompted";
const WHATS_NEW_KEY = "studily.whatsnew.progress.v2";
const QUIET_PATHS = ["/install", "/survey", "/onboarding", "/profile/setup", "/welcome"];
const CHECK_MS = 1500;

const BENEFITS: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <BellRing size={16} />, title: "Notifications", body: "Reminders for deadlines, classes and exams." },
  { icon: <Maximize2 size={16} />, title: "Full screen", body: "No address bar or tabs, just Studily." },
  { icon: <Zap size={16} />, title: "One tap away", body: "Opens straight to your dashboard." },
  { icon: <Sparkles size={16} />, title: "Better UI", body: "The layout is built for the app, so it feels native." },
];

function wasPrompted(): boolean {
  try {
    return sessionStorage.getItem(PROMPTED_KEY) === "1";
  } catch {
    return true;
  }
}

function markPrompted() {
  try {
    sessionStorage.setItem(PROMPTED_KEY, "1");
  } catch {
  }
}

function whatsNewSeen(): boolean {
  try {
    return localStorage.getItem(WHATS_NEW_KEY) === "1";
  } catch {
    return true;
  }
}

export default function InstallPrompt() {
  const { user, guest } = useAuth();
  const { pathname } = useLocation();
  const tourStep = useWelcomeTourStep();
  const [open, setOpen] = useState(false);

  const eligible =
    !!user &&
    !guest &&
    isTouch &&
    user.welcomed !== false &&
    tourStep === null &&
    !QUIET_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (open || !eligible || isStandalone() || wasPrompted()) return;
    const id = window.setInterval(() => {
      if (!whatsNewSeen() || hasOpenModal() || wasPrompted()) return;
      markPrompted();
      setOpen(true);
    }, CHECK_MS);
    return () => window.clearInterval(id);
  }, [open, eligible]);

  if (!open) return null;

  return (
    <Modal onClose={() => setOpen(false)} size="md" dismissOnBackdrop>
      <Body />
    </Modal>
  );
}

function Body() {
  const close = useModalClose();
  const navigate = useNavigate();

  return (
    <div className="text-center">
      <div
        className="mx-auto flex max-w-xs justify-center rounded-2xl px-4 py-4"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 75%)",
        }}
      >
        <img
          src="/studily-3a-192.png"
          alt="Studily app icon"
          width={64}
          height={64}
          className="rounded-2xl"
          style={{ boxShadow: "var(--card-shadow)" }}
        />
      </div>
      <h2 className="mt-1 text-lg font-semibold text-fg">Get Studily as an app!</h2>
      <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-fg-2">
        Add it to your home screen in a few taps.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-left">
        {BENEFITS.map((b) => (
          <div
            key={b.title}
            className="rounded-lg border border-line p-3"
            style={{ background: "var(--surface)", boxShadow: "var(--card-shadow)" }}
          >
            <span className="text-accent">{b.icon}</span>
            <p className="mt-1.5 text-[13px] font-semibold text-fg">{b.title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-fg-2">{b.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => {
            close();
            navigate("/install");
          }}
        >
          Let's go!
        </button>
        <button type="button" className="btn btn-ghost w-full text-xs" onClick={close}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
