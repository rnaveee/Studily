import { Link } from "react-router-dom";
import { ArrowRight, Calculator, Lightbulb, MessageSquare, type LucideIcon } from "lucide-react";
import BackButton from "../../components/BackButton";
import { isGuestMode } from "../../lib/api";
import BotMascot from "./BotMascot";
import { GuestSignUpCard } from "./BotLayout";
import { useBotStatus } from "./useBotStatus";

const MODES: { to: string; icon: LucideIcon; title: string; tagline: string; description: string; color: string }[] = [
  {
    to: "/study/studilybot/chat",
    icon: MessageSquare,
    title: "Chat",
    tagline: "Best for asking about coursework and answers",
    description: "Ask about your course files and get answers that point back to the slide or page they came from.",
    color: "var(--accent)",
  },
  {
    to: "/study/studilybot/recall",
    icon: Lightbulb,
    title: "Recall",
    tagline: "Best for practicing concepts like biology",
    description: "Explain a lecture back in your own words. StudilyBot finds the gaps and scores what you understood.",
    color: "var(--green)",
  },
  {
    to: "/study/studilybot/practice",
    icon: Calculator,
    title: "Practice",
    tagline: "Best for practicing calculations like physics or math",
    description: "Get problems written from your class materials, then check your working step by step.",
    color: "var(--orange-vivid)",
  },
];

export default function StudilyBotHome() {
  const guest = isGuestMode();
  const status = useBotStatus();
  const paused = !guest && status.data?.enabled === false;

  return (
    <div className="stagger-children mx-auto w-full max-w-4xl space-y-6">
      <div className="stagger-item">
        <BackButton fallback="/study" />
      </div>

      <section className="card stagger-item flex flex-col items-center gap-5 p-6 text-center md:flex-row md:p-8 md:text-left">
        <BotMascot size={112} label="StudilyBot" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-fg">StudilyBot</h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-2">
            Your study partner for the classes you're taking. It reads the files you add to a course, then helps you
            ask, explain and practise, with citations back to your slides and pages.
          </p>
        </div>
      </section>

      {paused && (
        <div
          role="status"
          className="stagger-item rounded-xl px-4 py-2.5 text-[13px] text-fg-2"
          style={{
            background: "color-mix(in srgb, var(--yellow) 12%, var(--surface))",
            border: "1px solid var(--line)",
          }}
        >
          StudilyBot is taking a break right now. Try again later.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          return (
            <Link
              key={mode.to}
              to={mode.to}
              className="card card-lift stagger-item group flex flex-col gap-3 p-5"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{
                  background: `color-mix(in srgb, ${mode.color} 14%, transparent)`,
                  color: mode.color,
                }}
              >
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <div>
                <div className="text-[16px] font-semibold text-fg">{mode.title}</div>
                <div className="mt-0.5 text-[12.5px] font-medium" style={{ color: mode.color }}>
                  {mode.tagline}
                </div>
              </div>
              <p className="text-[13px] leading-relaxed text-fg-3">{mode.description}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[12.5px] font-medium text-accent">
                Open
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>

      {guest && (
        <div className="stagger-item">
          <GuestSignUpCard what="Sign up free to upload your own course files and use all three modes with them." />
        </div>
      )}
    </div>
  );
}
