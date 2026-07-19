import { Link } from "react-router-dom";
import { Atom, Calculator, Layers, LineChart, PersonStanding, Sparkles, Timer } from "lucide-react";
import { formatMs, pomodoroColor, usePomodoro } from "../../lib/pomodoro";

const TOOLS = [
  {
    to: "/pomodoro",
    icon: Timer,
    title: "Pomodoro Timer",
    description: "Stay focused with timed study sprints and breaks.",
    disabled: false,
  },
  {
    to: "/learn/flashcards",
    icon: Layers,
    title: "Flashcards",
    description: "Create sets and study with smart spaced repetition.",
    disabled: false,
  },
  {
    to: "/learn/ai",
    icon: Sparkles,
    title: "AI",
    description: "Ask questions about your course materials.",
    disabled: true,
  },
  {
    to: "/learn/periodic-table",
    icon: Atom,
    title: "Periodic Table",
    description: "Explore all 118 elements with detailed info.",
    disabled: true,
  },
  {
    to: "/learn/calculator",
    icon: Calculator,
    title: "Calculator",
    description: "Basic and scientific calculator, always at hand.",
    disabled: true,
  },
  {
    to: "/learn/graphing",
    icon: LineChart,
    title: "Graphing",
    description: "Type an equation and see it graphed instantly.",
    disabled: true,
  },
  {
    to: "/learn/body-diagram",
    icon: PersonStanding,
    title: "Body Diagram",
    description: "Interactive anatomy diagrams by body system.",
    disabled: true,
  },
];

export default function LearnPage() {
  const p = usePomodoro();

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-semibold text-fg">Learn</h1>
        <p className="mt-1 text-[13px] text-fg-3">
          Study tools to help you master your courses.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TOOLS.map(({ to, icon: Icon, title, description, disabled }) => {
          const live = to === "/pomodoro" && p.running;
          const liveColor = pomodoroColor(p.phase);
          const content = (
            <>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: disabled
                    ? "var(--surface-hi)"
                    : `color-mix(in srgb, ${live ? liveColor : "var(--accent)"} 12%, transparent)`,
                }}
              >
                <Icon
                  size={16}
                  className={disabled ? "text-fg-3" : live ? undefined : "text-accent"}
                  style={live ? { color: liveColor } : undefined}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-[14px] font-medium ${disabled ? "text-fg-3" : "text-fg"}`}>
                  {title}
                  {disabled && (
                    <span className="badge badge-muted ml-2 align-middle">Coming soon</span>
                  )}
                </div>
                <div className="text-[12px] text-fg-3">{description}</div>
              </div>
              {live && (
                <span
                  className="shrink-0 font-mono text-[15px] font-semibold tabular-nums"
                  style={{ color: liveColor }}
                >
                  {formatMs(p.remainingMs)}
                </span>
              )}
            </>
          );

          return disabled ? (
            <div
              key={to}
              className="card flex cursor-not-allowed items-center gap-3 p-4 opacity-60"
              aria-disabled="true"
            >
              {content}
            </div>
          ) : (
            <Link
              key={to}
              to={to}
              className="card flex items-center gap-3 p-4 transition-colors hover:bg-surface-hi"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
