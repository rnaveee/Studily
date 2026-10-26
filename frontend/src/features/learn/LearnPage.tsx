import { Link } from "react-router-dom";
import { Atom, Calculator, Percent, Timer } from "lucide-react";
import { formatMs, pomodoroColor, usePomodoro } from "../../lib/pomodoro";
import TodoQuickView from "../todos/TodoQuickView";
import FlashcardsPanel from "./FlashcardsPanel";
import ProgressPanel from "./ProgressPanel";
import StudySessionsPanel from "./sessions/StudySessionsPanel";

const TOOLS = [
  {
    to: "/pomodoro",
    icon: Timer,
    title: "Pomodoro Timer",
    label: "Pomodoro",
    color: "var(--orange-vivid)",
    description: "Stay focused with timed study sprints and breaks.",
  },
  {
    to: "/periodic-table",
    icon: Atom,
    title: "Periodic Table",
    label: "Elements",
    color: "var(--green)",
    description: "Explore all 118 elements with detailed info.",
  },
  {
    to: "/grade-calculator",
    icon: Percent,
    title: "Grade Calculator",
    label: "Grade calc",
    color: "var(--blue-vivid)",
    description: "Work out your weighted grade and what you need on your final.",
  },
  {
    to: "/learn/calculator",
    icon: Calculator,
    title: "Calculator",
    label: "Calculator",
    color: "var(--accent)",
    description: "Scientific calculator with fractions, units and history.",
  },
];

type Tool = (typeof TOOLS)[number];

export default function LearnPage() {
  const p = usePomodoro();
  const liveColor = pomodoroColor(p.phase);
  const isLive = (to: string) => to === "/pomodoro" && p.running;

  return (
    <div className="space-y-6 stagger-children xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)_auto] xl:items-start xl:gap-x-8 xl:gap-y-5 xl:space-y-0">
      <ProgressPanel />

      <div className="space-y-6 xl:space-y-5">
        <StudySessionsPanel />
        <FlashcardsPanel />
      </div>

      <div className="relative xl:self-stretch">
        <TodoQuickView stacked limit={8} className="xl:absolute xl:inset-0" />
      </div>

      <div className="space-y-6 xl:hidden">
        <div className="pt-2">
          <h2 className="text-xl font-semibold text-fg">Learn</h2>
          <p className="mt-1 text-[13px] text-fg-3">
            Study tools to help you master your courses.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {TOOLS.map((tool) => (
            <Link
              key={tool.to}
              to={tool.to}
              className="card flex items-center gap-3 p-4 transition-colors hover:bg-surface-hi"
            >
              <ToolIcon tool={tool} live={isLive(tool.to)} liveColor={liveColor} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-fg">{tool.title}</div>
                <div className="text-[12px] text-fg-3">{tool.description}</div>
              </div>
              {isLive(tool.to) && (
                <span
                  className="shrink-0 font-mono text-[15px] font-semibold tabular-nums"
                  style={{ color: liveColor }}
                >
                  {formatMs(p.remainingMs)}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      <nav aria-label="Study tools" className="card hidden w-[88px] p-2 xl:flex xl:self-stretch">
        <ul className="flex w-full flex-col justify-evenly gap-2">
          {TOOLS.map((tool) => {
            const live = isLive(tool.to);
            return (
              <li key={tool.to}>
                <Link
                  to={tool.to}
                  aria-label={tool.title}
                  className="group/tool relative flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 outline-none"
                >
                  <ToolIcon tool={tool} live={live} liveColor={liveColor} large />
                  <span
                    className={`text-[11.5px] font-medium ${live ? "font-mono font-semibold tabular-nums" : "text-fg-2"}`}
                    style={live ? { color: liveColor } : undefined}
                  >
                    {live ? formatMs(p.remainingMs) : tool.label}
                  </span>

                  <span
                    aria-hidden="true"
                    className="card pointer-events-none absolute -right-px -top-px z-30 flex min-h-[calc(100%+2px)] w-[300px] origin-right scale-95 items-start gap-3 py-3 pl-4 pr-[11px] opacity-0 transition-[opacity,scale] duration-150 ease-out group-hover/tool:pointer-events-auto group-hover/tool:scale-100 group-hover/tool:opacity-100 group-focus-visible/tool:scale-100 group-focus-visible/tool:opacity-100"
                    style={{
                      borderRadius: "var(--radius-lg)",
                      borderColor: `color-mix(in srgb, ${live ? liveColor : tool.color} 35%, var(--line))`,
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    <span className="min-w-0 flex-1 self-center text-left">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[14px] font-semibold text-fg">{tool.title}</span>
                        {live && (
                          <span className="font-mono text-[13px] font-semibold tabular-nums" style={{ color: liveColor }}>
                            {formatMs(p.remainingMs)}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">{tool.description}</span>
                    </span>
                    <ToolIcon tool={tool} live={live} liveColor={liveColor} large />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function ToolIcon({
  tool,
  live,
  liveColor,
  large = false,
}: {
  tool: Tool;
  live: boolean;
  liveColor: string;
  large?: boolean;
}) {
  const Icon = tool.icon;
  const color = live ? liveColor : tool.color;
  return (
    <span
      className={`flex shrink-0 items-center justify-center transition-transform ${
        large ? "h-12 w-12 rounded-2xl group-hover/tool:scale-105" : "h-9 w-9 rounded-full"
      }`}
      style={{
        background: `color-mix(in srgb, ${color} ${large ? 16 : 12}%, transparent)`,
        boxShadow: large ? `inset 0 0 0 1px color-mix(in srgb, ${color} 26%, transparent)` : undefined,
        color,
      }}
    >
      <Icon size={large ? 22 : 16} />
    </span>
  );
}
