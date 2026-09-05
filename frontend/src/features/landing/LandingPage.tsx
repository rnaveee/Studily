import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Brain,
  CalendarSync,
  Check,
  MessageSquare,
  Moon,
  Smartphone,
  Sun,
  Timer,
  Users2,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import Reveal from "./Reveal";
import {
  MockDueList,
  MockFlashcard,
  MockGradeCard,
  MockPush,
  MockSprawl,
  MockToday,
  MockWeekGrid,
} from "./mocks";

const SPRAWL_LINES = [
  ["Your calendar app", "knows when your classes are, but nothing about what's due."],
  ["Your notes doc", "has the assignments, but won't remind you about any of them."],
  ["Your group chat", "has the classmates, but isn't attached to a single course."],
];

const EXTRAS = [
  {
    icon: Brain,
    title: "Flashcards that space themselves",
    body: "Decks per course, graded Again / Hard / Good / Easy. SM-2 scheduling brings each card back right before you'd forget it.",
  },
  {
    icon: Users2,
    title: "Classmates, found automatically",
    body: "Type in PSYC 101 and Studily surfaces everyone else at your school taking it. No invite links, no adding people one at a time.",
  },
  {
    icon: MessageSquare,
    title: "Messages built in",
    body: "Real-time DMs and group chats with image and file attachments, so the course and the conversation live in the same place.",
  },
  {
    icon: CalendarSync,
    title: "Bring the calendar you already have",
    body: "Paste an .ics link from Google Calendar, Apple Calendar, Outlook, or your school's timetable. Export yours back out the same way.",
  },
  {
    icon: Timer,
    title: "Study tools when you need them",
    body: "A Pomodoro timer that keeps running across the app, and a searchable periodic table for all 118 elements.",
  },
  {
    icon: Smartphone,
    title: "On your phone, properly",
    body: "Install it to your home screen and get push notifications before class and ahead of every deadline. Dark mode included.",
  },
];

export default function LandingPage() {
  const { continueAsGuest } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  function browseDemo() {
    continueAsGuest();
    navigate("/dashboard");
  }

  return (
    <div
      className="h-full overflow-y-auto bg-bg"
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
    >
      <header
        className="sticky top-0 z-20 backdrop-blur"
        style={{
          background: "color-mix(in srgb, var(--bg) 82%, transparent)",
          borderBottom: `1px solid ${scrolled ? "var(--line)" : "transparent"}`,
          transition: "border-color 0.25s ease",
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <img src="/studily-3a.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="hidden font-mono text-[15px] font-bold tracking-tight text-fg min-[340px]:block">
            Studily
          </span>
          <nav className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Link to="/about" className="hidden px-2 text-[13px] text-fg-2 hover:text-fg sm:block">
              About
            </Link>
            <button
              type="button"
              onClick={toggle}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg sm:h-8 sm:w-8"
            >
              {dark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
            </button>
            <Link to="/login" className="btn btn-ghost btn-nav">
              Log in
            </Link>
            <Link to="/signup" className="btn btn-primary btn-nav">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="relative grid items-center gap-12 py-16 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:py-24">
          <div className="hero-glow" aria-hidden="true" />

          <div className="relative z-[1] min-w-0 animate-in">
            <span className="badge badge-accent">Free · In beta</span>
            <h1 className="display mt-5 text-[2.35rem] font-bold text-fg sm:text-[2.9rem] lg:text-[3.25rem]">
              Your whole semester on one screen.
            </h1>
            <p className="measure mt-5 text-[15.5px] leading-relaxed text-fg-2">
              Enter your classes once. Studily turns them into a weekly schedule, tracks every
              assignment and exam against it, tells you where your grade stands, and connects you
              with the people in your courses.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link to="/signup" className="btn btn-primary btn-lg">
                Create a free account
              </Link>
              <button type="button" onClick={browseDemo} className="btn btn-ghost btn-lg">
                Look around first
              </button>
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-fg-3">
              No card, no trial. "Look around first" opens the real app filled with a demo semester.
            </p>
          </div>

          <div className="relative z-[1] min-w-0 animate-in">
            <MockWeekGrid large />
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <h2 className="display text-[1.75rem] font-bold text-fg sm:text-[2rem]">
                Right now it's spread across four apps.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-fg-2">
                Studily aims to combine all those apps and tools that students regularly
                use into one app. It features stuff like a working calendar, reminders,
                flashcards, and more.
              </p>
            </Reveal>
          </div>

          <div className="mt-12">
            <MockSprawl />
          </div>

          <Reveal delay={120}>
            <ul className="mx-auto mt-12 max-w-xl space-y-3">
              {SPRAWL_LINES.map(([subject, rest]) => (
                <li key={subject} className="flex gap-3 text-[14px] leading-relaxed text-fg-2">
                  <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                  <span>
                    <span className="font-medium text-fg">{subject}</span> {rest}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        <hr className="hairline border-0" />

        <Feature
          num="01"
          eyebrow="Your schedule"
          title="Type your classes once, read your week at a glance."
          body="Add each course with its lecture, lab, and tutorial blocks. Studily lays them out on a real time axis, so a three-hour lab looks like three hours. Every class carries its room and its colour straight through to your calendar and your deadlines."
          mock={
            <div className="space-y-3">
              <MockWeekGrid />
              <MockToday />
            </div>
          }
        />

        <Feature
          reverse
          num="02"
          eyebrow="Your deadlines"
          title="Never get blindsided by a due date again."
          body="Assignments and exams sit under the course they belong to, with their weight attached. They surface on your dashboard as they approach, and your phone buzzes an hour before each class, a week before each deadline, and the morning of every exam."
          mock={
            <div className="space-y-3">
              <MockDueList />
              <MockPush />
            </div>
          }
        />

        <Feature
          num="03"
          eyebrow="Your grade"
          title="Know exactly where you stand, and what's left."
          body="Score an item and Studily weights it for you. Instead of guessing, you get the number, plus the number you'd need on everything still ungraded to land where you're aiming."
          mock={<MockGradeCard />}
        />

        <Feature
          reverse
          num="04"
          eyebrow="Your studying"
          title="Review it before you forget it."
          body="Build a deck against a course and study it flashcard style. Each card comes back on its own schedule, and every grade button shows you exactly when you'll see that card next."
          mock={<MockFlashcard />}
        />

        <section className="py-16">
          <Reveal>
            <div className="flex items-baseline gap-4">
              <h2 className="display text-[1.75rem] font-bold text-fg">And when you need it</h2>
              <span className="hairline hidden flex-1 sm:block" />
              <span className="font-mono text-[12px] tabular-nums text-fg-3">
                {String(EXTRAS.length).padStart(2, "0")}
              </span>
            </div>
          </Reveal>

          <div className="mt-2 grid sm:grid-cols-2 sm:gap-x-14">
            {EXTRAS.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={(i % 2) * 80 + Math.floor(i / 2) * 60}>
                <div className="flex gap-4 border-t border-line py-6">
                  <span className="w-5 shrink-0 pt-[3px] font-mono text-[11px] tabular-nums text-fg-3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-[14.5px] font-semibold text-fg">
                      <Icon size={15} strokeWidth={1.8} className="shrink-0 text-accent" />
                      {title}
                    </h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-fg-2">{body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="border-t border-line" />
        </section>

        <hr className="hairline border-0" />

        <section className="py-16">
          <Reveal>
            <div
              className="mx-auto max-w-2xl pl-5 sm:pl-7"
              style={{ borderLeft: "2px solid color-mix(in srgb, var(--accent) 45%, transparent)" }}
            >
              <p className="eyebrow">
                <span className="eyebrow-rule" />
                Why I built this
              </p>
              <div className="mt-4 space-y-4 text-[14.5px] leading-relaxed text-fg-2">
                <p>
                  I used to run my semesters out of a general-purpose notes app and a shared
                  calendar. Manually re-entering my classes, switching between apps, building my own
                  dashboard every term. It was messy enough that I stopped bothering to stay
                  organised at all.
                </p>
                <p>
                  So I built the thing I wanted instead: everything a student actually juggles,
                  bundled into one app, and free.
                </p>
              </div>
              <p className="mt-5 text-[13px] text-fg-3">
                Ryan, Computing Science at SFU.{" "}
                <Link to="/about" className="text-accent transition-colors hover:text-accent-2">
                  More about Studily
                </Link>
              </p>
            </div>
          </Reveal>
        </section>

        <section className="py-20 text-center">
          <Reveal>
            <h2 className="display text-[1.9rem] font-bold text-fg sm:text-[2.25rem]">
              It's free, and it's staying free.
            </h2>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-fg-2">
              {["No card required", "Browse the demo without an account", "Your data stays yours"].map(
                (line) => (
                  <li key={line} className="flex items-center gap-1.5">
                    <Check size={14} strokeWidth={2.2} className="text-green" />
                    {line}
                  </li>
                ),
              )}
            </ul>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              <Link to="/signup" className="btn btn-primary btn-lg">
                Create a free account
              </Link>
              <button type="button" onClick={browseDemo} className="btn btn-ghost btn-lg">
                Look around first
              </button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-[12px] text-fg-3">
          <span className="font-mono font-bold text-fg-2">Studily</span>
          {[
            ["About", "/about"],
            ["Install", "/install"],
            ["Changelog", "/changelog"],
            ["Support", "/support"],
            ["Privacy", "/privacy"],
            ["Terms", "/terms"],
          ].map(([label, to]) => (
            <Link key={to} to={to} className="transition-colors hover:text-fg">
              {label}
            </Link>
          ))}
          <a href="mailto:ryannave97@gmail.com" className="ml-auto transition-colors hover:text-fg">
            ryannave97@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  num,
  eyebrow,
  title,
  body,
  mock,
  reverse = false,
}: {
  num: string;
  eyebrow: string;
  title: string;
  body: string;
  mock: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section className="grid items-center gap-10 py-16 md:grid-cols-2 md:gap-14">
      <div className={`min-w-0 ${reverse ? "md:order-2" : ""}`}>
        <Reveal>
          <p className="eyebrow">
            <span className="eyebrow-num">{num}</span>
            <span className="eyebrow-rule" />
            {eyebrow}
          </p>
          <h2 className="display mt-4 text-[1.65rem] font-bold text-fg sm:text-[1.85rem]">
            {title}
          </h2>
          <p className="measure mt-4 text-[15px] leading-relaxed text-fg-2">{body}</p>
        </Reveal>
      </div>
      <div className={`min-w-0 ${reverse ? "md:order-1" : ""}`}>{mock}</div>
    </section>
  );
}
