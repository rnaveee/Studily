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

  function browseDemo() {
    continueAsGuest();
    navigate("/dashboard");
  }

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <header
        className="sticky top-0 z-10 backdrop-blur"
        style={{
          background: "color-mix(in srgb, var(--bg) 85%, transparent)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img src="/studily-3a.svg" alt="" className="h-7 w-7" />
          <span className="font-mono text-[15px] font-bold tracking-tight text-fg">Studily</span>
          <nav className="ml-auto flex items-center gap-2">
            <Link to="/about" className="hidden px-2 text-[13px] text-fg-2 hover:text-fg sm:block">
              About
            </Link>
            <button
              type="button"
              onClick={toggle}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg"
            >
              {dark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
            </button>
            <Link to="/login" className="btn btn-ghost">
              Log in
            </Link>
            <Link to="/signup" className="btn btn-primary">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div className="animate-in">
            <span className="badge badge-accent">Free · In beta</span>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-fg sm:text-4xl">
              Your whole semester on one screen.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-fg-2">
              Enter your classes once. Studily turns them into a weekly schedule, tracks every
              assignment and exam against it, tells you where your grade stands, and connects you
              with the people in your courses.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/signup" className="btn btn-primary">
                Create a free account
              </Link>
              <button type="button" onClick={browseDemo} className="btn btn-ghost">
                Look around first
              </button>
            </div>
            <p className="mt-3 text-[12px] text-fg-3">
              No card, no trial. "Look around first" opens the real app filled with a demo semester.
            </p>
          </div>

          <div className="animate-in">
            <MockWeekGrid />
          </div>
        </section>

        <section className="border-t border-line py-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-fg">
              Right now it's spread across four apps.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-fg-2">
              Not one of them knows what the others hold. Studily is Notion's structure, Google
              Calendar's reminders, and a group chat, pre-built and pointed at the same set of
              courses.
            </p>
          </div>

          <div className="mt-10">
            <MockSprawl />
          </div>

          <ul className="mx-auto mt-10 max-w-xl space-y-2.5">
            {SPRAWL_LINES.map(([subject, rest]) => (
              <li key={subject} className="flex gap-2.5 text-[14px] leading-relaxed text-fg-2">
                <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                <span>
                  <span className="font-medium text-fg">{subject}</span> {rest}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <Feature
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
          eyebrow="Your grade"
          title="Know exactly where you stand, and what's left."
          body="Score an item and Studily weights it for you. Instead of guessing, you get the number, plus the number you'd need on everything still ungraded to land where you're aiming."
          mock={<MockGradeCard />}
        />

        <Feature
          reverse
          eyebrow="Your studying"
          title="Review it before you forget it."
          body="Build a deck against a course and study it flashcard style. Each card comes back on its own schedule, and every grade button shows you exactly when you'll see that card next."
          mock={<MockFlashcard />}
        />

        <section className="border-t border-line py-14">
          <h2 className="text-2xl font-bold tracking-tight text-fg">And when you need it</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {EXTRAS.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
                >
                  <Icon size={16} strokeWidth={1.8} className="text-accent" />
                </span>
                <h3 className="mt-3 text-[14px] font-semibold text-fg">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line py-14">
          <div className="card mx-auto max-w-2xl p-6">
            <h2 className="text-[15px] font-semibold text-fg">Why I built this</h2>
            <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-fg-2">
              <p>
                I used to run my semesters out of Notion and Google Calendar. Manually re-entering
                my classes, switching between apps, building my own dashboard every term. It was
                messy enough that I stopped bothering to stay organised at all.
              </p>
              <p>
                So I built the thing I wanted instead: everything a student actually juggles,
                bundled into one app, and free.
              </p>
              <p>
                Ryan, Computing Science at SFU.{" "}
                <Link to="/about" className="text-accent transition-colors hover:text-accent-2">
                  More about Studily
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-line py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-fg">It's free, and it's staying free.</h2>
          <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-fg-2">
            {["No card required", "Browse the demo without an account", "Your data stays yours"].map(
              (line) => (
                <li key={line} className="flex items-center gap-1.5">
                  <Check size={14} strokeWidth={2.2} className="text-green" />
                  {line}
                </li>
              ),
            )}
          </ul>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Link to="/signup" className="btn btn-primary">
              Create a free account
            </Link>
            <button type="button" onClick={browseDemo} className="btn btn-ghost">
              Look around first
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-[12px] text-fg-3">
          <span className="font-mono font-bold text-fg-2">Studily</span>
          {[
            ["About", "/about"],
            ["Install", "/install"],
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
  eyebrow,
  title,
  body,
  mock,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  mock: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section className="grid items-center gap-8 border-t border-line py-14 md:grid-cols-2 md:gap-12">
      <div className={reverse ? "md:order-2" : undefined}>
        <p className="field-label">{eyebrow}</p>
        <h2 className="text-2xl font-bold leading-tight tracking-tight text-fg">{title}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-fg-2">{body}</p>
      </div>
      <div className={reverse ? "md:order-1" : undefined}>{mock}</div>
    </section>
  );
}
