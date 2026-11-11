import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import BackButton from "../../components/BackButton";
import { isGuestMode } from "../../lib/api";
import BotBackdrop from "./BotBackdrop";
import Mascot, { type MascotState } from "./Mascot";
import { GuestSignUpCard } from "./BotLayout";
import { useBotStatus } from "./useBotStatus";

const MODES: { to: string; title: string; description: string; color: string; state: MascotState; say: ReactNode }[] = [
  {
    to: "/study/studilybot/chat",
    title: "Chat",
    description: "Perfect for answering questions from your courses!",
    color: "var(--accent)",
    state: "explaining",
    say: "Lecture 8 says the powerhouse of the cell is the mitochondria!",
  },
  {
    to: "/study/studilybot/practice",
    title: "Practice",
    description: "Perfect for practicing word problems with calculations for physics, math and more!",
    color: "var(--orange-vivid)",
    state: "thinking",
    say: (
      <>
        Find the area under the curve of{" "}
        <span className="whitespace-nowrap font-serif italic">
          <span className="text-[1.25em] not-italic">∫</span>
          <sub>1</sub>
          <sup>3</sup> x<sup>3</sup> dx
        </span>
      </>
    ),
  },
  {
    to: "/study/studilybot/recall",
    title: "Recall",
    description: "Perfect for memorizing concepts and understanding!",
    color: "var(--green)",
    state: "confused",
    say: "Explain to me the functions of the human heart.",
  },
];

export default function StudilyBotHome() {
  const guest = isGuestMode();
  const status = useBotStatus();
  const paused = !guest && status.data?.enabled === false;

  return (
    <div className="stagger-children mx-auto w-full max-w-5xl space-y-6">
      <div className="stagger-item">
        <BackButton fallback="/study" />
      </div>

      <section className="stagger-item relative isolate flex flex-col items-center gap-1 overflow-x-clip rounded-3xl px-4 pb-8 pt-10 text-center">
        <BotBackdrop variant="hero" />
        <Mascot state="wave" size={128} shadow label="StudilyBot" say="Let's start studying! Pick a mode." />
        <h1 className="mt-3 text-2xl font-semibold text-fg">StudilyBot</h1>
        <p className="max-w-lg text-[13.5px] leading-relaxed text-fg-3">
          Your study buddy for the classes you're taking. It reads the files you add to a course and answers with
          citations back to your slides and pages.
        </p>
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
        {MODES.map((mode) => (
          <Link
            key={mode.to}
            to={mode.to}
            className="card card-lift stagger-item group flex flex-col items-center gap-4 p-5 text-center"
          >
            <div
              className="flex w-full flex-1 flex-col items-center justify-end rounded-2xl px-3 pb-3 pt-4"
              style={{
                background: `radial-gradient(circle at 50% 68%, color-mix(in srgb, ${mode.color} 26%, transparent) 0%, transparent 55%), linear-gradient(155deg, color-mix(in srgb, ${mode.color} 20%, transparent) 0%, color-mix(in srgb, ${mode.color} 6%, transparent) 55%, color-mix(in srgb, ${mode.color} 14%, transparent) 100%)`,
                border: `1px solid color-mix(in srgb, ${mode.color} 18%, transparent)`,
              }}
            >
              <Mascot state={mode.state} size={104} shadow say={mode.say} />
            </div>
            <div>
              <div
                className="text-[18px] font-semibold"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${mode.color}, color-mix(in srgb, ${mode.color} 55%, var(--fg)))`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {mode.title}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{mode.description}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">
              Start {mode.title.toLowerCase()}
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      {guest && (
        <div className="stagger-item">
          <GuestSignUpCard what="Sign up free to upload your own course files and use all three modes with them." />
        </div>
      )}
    </div>
  );
}
