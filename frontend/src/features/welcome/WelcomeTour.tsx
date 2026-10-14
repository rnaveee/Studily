import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { api } from "../../lib/api";
import { useWelcomeTourStep, welcomeTour } from "../../lib/welcomeTour";
import type { FlashcardSet } from "../../types";

const SAMPLE_SET_TITLE = "Studily flashcard set";
const PAD = 8;

type Route = "learn" | "sample-set" | "friends";

interface Step {
  route: Route;
  target: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: Step[] = [
  {
    route: "learn",
    target: "nav-study",
    title: "Your Study page",
    body: "Everything for studying lives here: study sessions, flashcards and tools like the Pomodoro timer and calculator.",
  },
  {
    route: "learn",
    target: "study-sessions",
    title: "Study sessions",
    body: "Study sessions keep you focused. Pick a Pomodoro timer or a straight timer, list what you want to get done, and check in as each block ends. Every session earns XP, coins and chests you can spend on flairs for your profile ✨",
  },
  {
    route: "sample-set",
    target: "flashcard-viewer",
    title: "Flashcards",
    body: "Studily has flashcards, with five ways to study every set. We made you a starter set to try them on.",
  },
  {
    route: "sample-set",
    target: "quizlet-import",
    title: "Coming from Quizlet?",
    body: "Bring your Quizlet sets over in seconds. Export from Quizlet, paste it here, and every card comes across.",
  },
  {
    route: "friends",
    target: "schoolmates",
    title: "Schoolmates",
    body: "Find other students on Studily who go to your school.",
  },
  {
    route: "friends",
    target: "friend-link",
    title: "Friends",
    body: "Add your friends on Studily to chat with them and start group chats.",
  },
];

async function resolveRoute(route: Route): Promise<string> {
  if (route === "learn") return "/learn";
  if (route === "friends") return "/friends";
  try {
    const sets = await api.get<FlashcardSet[]>("/flashcard-sets");
    const sample = sets.find((s) => s.title === SAMPLE_SET_TITLE) ?? sets[0];
    return sample ? `/learn/flashcards/${sample.id}` : "/learn/flashcards";
  } catch {
    return "/learn/flashcards";
  }
}

function visibleTarget(name: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return nodes.find((n) => {
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) ?? null;
}

export default function WelcomeTour() {
  const index = useWelcomeTourStep();
  if (index === null) return null;
  const step = TOUR_STEPS[Math.min(index, TOUR_STEPS.length - 1)];
  return <Spotlight key={index} index={index} step={step} />;
}

function Spotlight({ index, step }: { index: number; step: Step }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [path, setPath] = useState<string | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const last = index === TOUR_STEPS.length - 1;

  useEffect(() => {
    let cancelled = false;
    resolveRoute(step.route).then((p) => {
      if (!cancelled) setPath(p);
    });
    return () => {
      cancelled = true;
    };
  }, [step.route]);

  useEffect(() => {
    if (path && location.pathname !== path) navigate(path);
  }, [path, location.pathname, navigate]);

  useLayoutEffect(() => {
    if (!path || location.pathname !== path) return;
    let frame = 0;
    let scrolled = false;
    const measure = () => {
      const el = visibleTarget(step.target);
      if (el) {
        if (!scrolled) {
          el.scrollIntoView({ block: "center", behavior: "auto" });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height
            ? prev
            : r,
        );
      }
      setViewport((prev) =>
        prev.w === window.innerWidth && prev.h === window.innerHeight
          ? prev
          : { w: window.innerWidth, h: window.innerHeight },
      );
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    return () => window.cancelAnimationFrame(frame);
  }, [path, location.pathname, step.target]);

  function finish() {
    welcomeTour.complete();
    navigate("/welcome?step=finish");
  }

  const mobile = viewport.w < 640;
  const hole = rect
    ? {
        x: Math.max(4, rect.left - PAD),
        y: Math.max(4, rect.top - PAD),
        w: Math.min(viewport.w - 8, rect.width + PAD * 2),
        h: rect.height + PAD * 2,
      }
    : null;

  const cardWidth = Math.min(340, viewport.w - 32);
  let cardStyle: React.CSSProperties;
  if (mobile || !hole) {
    cardStyle = {
      left: 16,
      right: 16,
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
    };
    if (hole && hole.y + hole.h > viewport.h - 260) {
      cardStyle = { left: 16, right: 16, top: "calc(env(safe-area-inset-top, 0px) + 16px)" };
    }
  } else {
    const below = hole.y + hole.h + 14;
    const fitsBelow = below + 220 < viewport.h;
    const left = Math.min(Math.max(16, hole.x), viewport.w - cardWidth - 16);
    cardStyle = fitsBelow
      ? { top: below, left, width: cardWidth }
      : hole.x + hole.w + cardWidth + 32 < viewport.w
        ? { top: Math.max(16, Math.min(hole.y, viewport.h - 240)), left: hole.x + hole.w + 16, width: cardWidth }
        : { top: Math.max(16, hole.y - 230), left, width: cardWidth };
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120]"
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      onClick={(e) => e.stopPropagation()}
    >
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {hole && <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={14} fill="black" className="tour-hole" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(6 7 14 / 0.62)" mask="url(#tour-mask)" />
      </svg>
      {hole && (
        <span
          aria-hidden
          className="tour-ring pointer-events-none absolute rounded-[14px]"
          style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }}
        />
      )}
      <div className="glass tour-card absolute rounded-2xl p-4 shadow-xl" style={cardStyle}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          {index + 1} of {TOUR_STEPS.length}
        </p>
        <h2 className="mt-1 text-[16px] font-semibold text-fg">{step.title}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={finish} className="mr-auto text-[12px] font-medium text-fg-3 hover:text-fg">
            Skip tour
          </button>
          {index > 0 && (
            <button type="button" onClick={() => welcomeTour.go(index - 1)} className="btn btn-ghost" aria-label="Back">
              <ArrowLeft size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? finish() : welcomeTour.go(index + 1))}
            className="btn btn-primary"
            autoFocus
          >
            {last ? "Finish" : "Next"}
            {!last && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
