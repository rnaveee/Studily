import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { prefersReducedMotion } from "../../lib/motion";
import { useWelcomeTourStep, welcomeTour } from "../../lib/welcomeTour";
import Mascot, { type MascotState } from "../studilybot/Mascot";
import type { FlashcardSet } from "../../types";

const SAMPLE_SET_TITLE = "Studily flashcard set";
const PAD = 8;
const EDGE = 20;
const TYPE_STEP_MS = 22;

type Route = "learn" | "sample-set" | "friends";

interface Step {
  route: Route;
  target: string | null;
  title: string;
  body: string;
  mood: MascotState;
}

export const TOUR_STEPS: Step[] = [
  {
    route: "learn",
    target: null,
    title: "Hi{name}!",
    body: "I'm StudilyBot, your study buddy. Let me show you around Studily. It only takes a minute!",
    mood: "wave",
  },
  {
    route: "learn",
    target: "nav-study",
    title: "Your Study page",
    body: "This is where studying happens: study sessions, flashcards, and tools like the Pomodoro timer and calculator.",
    mood: "happy",
  },
  {
    route: "learn",
    target: "study-sessions",
    title: "Study sessions",
    body: "Sessions keep you focused. Pick a Pomodoro or a timer, list what you want to get done, and check in as each block ends. Every session earns XP, coins and chests!",
    mood: "excited",
  },
  {
    route: "learn",
    target: "studilybot",
    title: "That's me!",
    body: "Add your course files and I'll answer questions about them, write practice problems from your class, or let you teach a lecture back to me. You can dress me up in the shop too.",
    mood: "love",
  },
  {
    route: "sample-set",
    target: "flashcard-viewer",
    title: "Flashcards",
    body: "I made you a starter flashcard set to try. Every set has five ways to study it.",
    mood: "happy",
  },
  {
    route: "sample-set",
    target: "quizlet-import",
    title: "Coming from Quizlet?",
    body: "Export your Quizlet set, paste it here, and every card comes across in seconds.",
    mood: "thinking",
  },
  {
    route: "friends",
    target: "schoolmates",
    title: "Schoolmates",
    body: "These are other students on Studily from your school. Say hi!",
    mood: "wave",
  },
  {
    route: "friends",
    target: "friend-link",
    title: "Friends",
    body: "Add your friends to chat, start group chats and study together. That's the tour. Let's go study!",
    mood: "excited",
  },
];

interface Hole {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Corner = "br" | "bl" | "tr" | "tl";

async function resolveRoute(route: Route): Promise<string> {
  if (route === "learn") return "/study";
  if (route === "friends") return "/friends";
  try {
    const sets = await api.get<FlashcardSet[]>("/flashcard-sets");
    const sample = sets.find((s) => s.title === SAMPLE_SET_TITLE) ?? sets[0];
    return sample ? `/study/flashcards/${sample.id}` : "/study/flashcards";
  } catch {
    return "/study/flashcards";
  }
}

function visibleTarget(name: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return (
    nodes.find((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) ?? null
  );
}

function overlap(a: Hole, b: Hole): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function pickCorner(hole: Hole | null, vw: number, vh: number, gw: number, gh: number): Corner {
  if (!hole) return "br";
  const boxes: Record<Corner, Hole> = {
    br: { x: vw - gw - EDGE, y: vh - gh - EDGE, w: gw, h: gh },
    bl: { x: EDGE, y: vh - gh - EDGE, w: gw, h: gh },
    tr: { x: vw - gw - EDGE, y: EDGE, w: gw, h: gh },
    tl: { x: EDGE, y: EDGE, w: gw, h: gh },
  };
  let best: Corner = "br";
  let least = Infinity;
  for (const corner of ["br", "bl", "tr", "tl"] as Corner[]) {
    const covered = overlap(boxes[corner], hole);
    if (covered === 0) return corner;
    if (covered < least) {
      least = covered;
      best = corner;
    }
  }
  return best;
}

function useViewport() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

function useTourTarget(index: number, step: Step): Hole | null {
  const navigate = useNavigate();
  const location = useLocation();
  const [path, setPath] = useState<string | null>(null);
  const [hole, setHole] = useState<Hole | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPath(null);
    setHole(null);
    resolveRoute(step.route).then((p) => {
      if (!cancelled) setPath(p);
    });
    return () => {
      cancelled = true;
    };
  }, [index, step.route]);

  useEffect(() => {
    if (path && location.pathname !== path) navigate(path);
  }, [path, location.pathname, navigate]);

  useLayoutEffect(() => {
    if (!path || location.pathname !== path || !step.target) return;
    const target = step.target;
    let frame = 0;
    let scrolled = false;
    const measure = () => {
      const el = visibleTarget(target);
      if (el) {
        if (!scrolled) {
          const tall = el.getBoundingClientRect().height > window.innerHeight * 0.5;
          el.scrollIntoView({ block: tall ? "start" : "center", behavior: "auto" });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const y = Math.max(4, r.top - PAD);
        const next = {
          x: Math.max(4, r.left - PAD),
          y,
          w: Math.min(vw - 8, r.width + PAD * 2),
          h: Math.max(0, Math.min(vh - 4, r.bottom + PAD) - y),
        };
        setHole((prev) =>
          prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next,
        );
      }
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    return () => window.cancelAnimationFrame(frame);
  }, [path, location.pathname, step.target, index]);

  return hole;
}

function useTyped(text: string) {
  const instant = prefersReducedMotion();
  const [count, setCount] = useState(instant ? text.length : 0);

  useEffect(() => {
    if (instant) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let n = 0;
    const id = window.setInterval(() => {
      n += 2;
      setCount(Math.min(n, text.length));
      if (n >= text.length) window.clearInterval(id);
    }, TYPE_STEP_MS);
    return () => window.clearInterval(id);
  }, [text, instant]);

  return { shown: text.slice(0, count), done: count >= text.length, skip: () => setCount(text.length) };
}

export default function WelcomeTour() {
  const index = useWelcomeTourStep();
  if (index === null) return null;
  return <TourGuide index={Math.min(index, TOUR_STEPS.length - 1)} />;
}

function TourGuide({ index }: { index: number }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const step = TOUR_STEPS[index];
  const hole = useTourTarget(index, step);
  const viewport = useViewport();
  const guideRef = useRef<HTMLDivElement>(null);
  const [guide, setGuide] = useState({ w: 480, h: 230 });
  const first = user?.name?.trim().split(/\s+/)[0];
  const title = step.title.replace("{name}", first ? ` ${first}` : "");
  const typed = useTyped(step.body);
  const last = index === TOUR_STEPS.length - 1;
  const mobile = viewport.w < 640;

  useLayoutEffect(() => {
    const el = guideRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setGuide({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobile]);

  function finish() {
    welcomeTour.complete();
    navigate("/welcome?step=finish");
  }

  function next() {
    if (!typed.done) {
      typed.skip();
      return;
    }
    if (last) finish();
    else welcomeTour.go(index + 1);
  }

  function back() {
    if (index > 0) welcomeTour.go(index - 1);
  }

  const nextRef = useRef(next);
  const backRef = useRef(back);
  nextRef.current = next;
  backRef.current = back;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextRef.current();
      if (e.key === "ArrowLeft") backRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  let placement: React.CSSProperties;
  let botRight = true;
  if (mobile) {
    const need = guide.h + 16;
    const above = hole ? hole.y : Infinity;
    const below = hole ? viewport.h - (hole.y + hole.h) : Infinity;
    const dockTop = hole !== null && below < need && (above >= need || above > below);
    placement = dockTop
      ? { left: 12, right: 12, top: "calc(env(safe-area-inset-top, 0px) + 12px)" }
      : { left: 12, right: 12, bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" };
    botRight = false;
  } else {
    const corner = pickCorner(hole, viewport.w, viewport.h, guide.w, guide.h);
    botRight = corner === "br" || corner === "tr";
    placement = {
      [corner.startsWith("b") ? "bottom" : "top"]: EDGE,
      [botRight ? "right" : "left"]: EDGE,
    };
  }

  const mood: MascotState = typed.done ? step.mood : "explaining";

  return createPortal(
    <div
      className="fixed inset-0 z-[120]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
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

      <div
        ref={guideRef}
        className={`absolute flex items-end ${mobile ? "gap-2" : "gap-3"}`}
        style={{ ...placement, flexDirection: botRight ? "row-reverse" : "row" }}
      >
        <div className="shrink-0">
          <Mascot state={mood} size={mobile ? 66 : 118} shadow label="StudilyBot" />
        </div>
        <div
          key={index}
          className={`tour-card tour-bubble flex flex-col rounded-2xl ${mobile ? "mb-4 min-w-0 flex-1 p-3" : "mb-12 w-[340px] p-4"}`}
          data-tail={botRight ? "right" : "left"}
          onClick={() => {
            if (!typed.done) typed.skip();
          }}
          style={mobile ? { maxHeight: Math.max(150, viewport.h * 0.42) } : undefined}
        >
          <div className="min-h-0 overflow-y-auto">
            <h2 id="tour-title" className="text-[15px] font-semibold text-fg sm:text-[16px]">
              {title}
            </h2>
            <p id="tour-body" className="sr-only">
              {step.body}
            </p>
            <p aria-hidden className="mt-1 grid text-[13px] leading-relaxed text-fg-2 sm:mt-1.5 sm:text-[13.5px]">
              <span className="invisible" style={{ gridArea: "1 / 1" }}>
                {step.body}
              </span>
              <span style={{ gridArea: "1 / 1" }}>
                {typed.shown}
                {!typed.done && <span className="tour-caret ml-px inline-block h-[1em] w-[2px] translate-y-[2px] bg-accent" />}
              </span>
            </p>
          </div>
          <div className="mt-3 flex shrink-0 items-center gap-2">
            <span className="text-[11px] font-semibold tabular-nums text-accent">
              {index + 1}/{TOUR_STEPS.length}
            </span>
            <button type="button" onClick={finish} className="mr-auto px-1.5 py-1 text-[12px] font-medium text-fg-3 hover:text-fg">
              Skip tour
            </button>
            {index > 0 && (
              <button type="button" onClick={back} className="btn btn-ghost" aria-label="Back">
                <ArrowLeft size={14} />
              </button>
            )}
            <button type="button" onClick={next} className="btn btn-primary" autoFocus>
              {index === 0 ? "Show me!" : last ? "Finish" : "Next"}
              {!last && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
