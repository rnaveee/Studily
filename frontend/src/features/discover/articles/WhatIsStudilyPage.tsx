import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  CalendarDays,
  GraduationCap,
  Layers,
  LayoutDashboard,
  RefreshCw,
  Timer,
  UserRound,
  Users,
} from "lucide-react";
import ArticlePage, { type ArticleSection } from "../ArticlePage";
import Screenshot from "../Screenshot";
import { Points, SideBySide, TextColumns } from "../layouts";

const LINK = "text-accent hover:text-accent-2";
const LEAD = "font-semibold text-fg";

const OVERVIEW: { id: string; title: string; blurb: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "dashboard", title: "Dashboard", blurb: "Your week in one place", icon: LayoutDashboard },
  { id: "calendar", title: "Calendar", blurb: "Assignments, exams and events", icon: CalendarDays },
  { id: "canvas-brightspace-moodle-and-google-calendar", title: "Imports", blurb: "Canvas, Brightspace, Moodle, Google", icon: RefreshCw },
  { id: "semesters-and-courses", title: "Courses", blurb: "Schedule, deadlines and grades", icon: GraduationCap },
  { id: "study-sessions", title: "Study sessions", blurb: "Timed focus with rewards", icon: Timer },
  { id: "flashcards", title: "Flashcards", blurb: "Make, generate and play", icon: Layers },
  { id: "studilybot", title: "StudilyBot", blurb: "AI help from your course files", icon: Bot },
  { id: "profile", title: "Profile", blurb: "Customize with cosmetics", icon: UserRound },
  { id: "friends", title: "Friends", blurb: "Find your schoolmates", icon: Users },
];

const SECTIONS: ArticleSection[] = [
  {
    id: "what-is-studily",
    title: "What is Studily",
    body: (
      <>
        <TextColumns
          left={
            <>
              <p className="text-base">
                Studily is an all-in-one student platform with the tools students use every day. It
                combines several apps into one place, so learning is easier and more accessible.
              </p>
              <p>
                <strong className={LEAD}>Accessibility.</strong> Studily believes that learning
                should be accessible. Studily accepts donations to keep it running, but we built the
                app to make student life easier, not to put it behind a paywall.{" "}
                <Link to="/support-studily" className={LINK}>
                  Learn how you can support Studily
                </Link>
                .
              </p>
            </>
          }
          right={
            <aside className="card flex gap-4 p-5">
              <img
                src="/me.png"
                alt="Ryan Nave"
                className="h-20 w-20 shrink-0 rounded-full bg-surface-hi object-cover"
                style={{ border: "1px solid var(--line)" }}
              />
              <div className="min-w-0 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Owner's note</p>
                <p className="text-[14px]">
                  I found it hard to use apps like Notion, Google Calendar and Quizlet. They were
                  either complicated, everywhere, or locked behind a paywall. As a software
                  development student, I wanted to learn how to build apps people use every day, and
                  solve my own problem (and other students') of juggling too many apps. That is why I
                  created Studily, and why I use it myself.{" "}
                  <Link to="/about" className={LINK}>
                    More about me
                  </Link>
                  .
                </p>
              </div>
            </aside>
          }
        />

        <div>
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
            What does Studily give
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {OVERVIEW.map(({ id, title, blurb, icon: Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="card press flex h-full items-center gap-3 p-3.5 transition-colors hover:bg-surface-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
                  >
                    <Icon size={18} className="text-accent" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium text-fg">{title}</span>
                    <span className="block truncate text-[12px] text-fg-3">{blurb}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard",
    eyebrow: "Plan",
    body: (
      <>
        <TextColumns
          left={
            <p className="text-base">
              The dashboard shows your schedule, calendar, to-dos and upcoming deadlines, all in one
              place.
            </p>
          }
          right={
            <Points
              items={[
                "Set everything up by hand, or",
                "Add your school schedule and course outlines and let Studily do it for you",
              ]}
            />
          }
        />
        <Screenshot
          name="dashboard"
          alt="The Studily dashboard showing the weekly schedule, today's classes, calendar, to-dos, exams and grades"
          width={1600}
          height={987}
        />
        <SideBySide
          reverse
          media={
            <Screenshot
              name="add-course"
              alt="The Add a course dialog with Automatic and Manual options"
              width={841}
              height={513}
            />
          }
        >
          <h3 className="text-base font-semibold text-fg">Adding a course</h3>
          <Points
            items={[
              <>
                <strong className={LEAD}>Automatic:</strong> upload your course outline, a
                screenshot, or paste the details, and Studily fills in the rest. You check everything
                before it saves.
              </>,
              <>
                <strong className={LEAD}>Manual:</strong> type in the course name, code, times and
                room yourself.
              </>,
            ]}
          />
        </SideBySide>
      </>
    ),
  },
  {
    id: "calendar",
    title: "Calendar",
    eyebrow: "Plan",
    body: (
      <>
        <TextColumns
          left={
            <p className="text-base">
              Keep track of assignments, exams, or general events, just like in a regular calendar.
            </p>
          }
          right={
            <Points
              items={[
                "Assignments and exams show up with their course colour",
                "When you upload your assignments, Studily puts them on the calendar automatically",
              ]}
            />
          }
        />
        <Screenshot
          name="calendar"
          alt="The monthly calendar with assignments and exams"
          width={1600}
          height={692}
        />
      </>
    ),
  },
  {
    id: "canvas-brightspace-moodle-and-google-calendar",
    title: "Canvas, Brightspace, Moodle and Google Calendar",
    eyebrow: "Plan",
    body: (
      <>
        <TextColumns
          left={
            <p className="text-base">
              Studily can keep your calendar up to date for you. Paste the calendar link from
              Canvas, Brightspace (D2L) or Moodle, and Studily imports your assignments and exam
              dates.
            </p>
          }
          right={
            <Points
              items={[
                <>
                  <strong className={LEAD}>You stay in control.</strong> Imports are reviewed before
                  anything is saved. Merge into a course you already have, add it as new, or skip it.
                  If a date clashes, choose to add it anyway, replace it, or skip it.
                </>,
                <>
                  <strong className={LEAD}>It keeps updating.</strong> Studily checks your link in
                  the background, sends a notification when something new shows up, and tells you
                  when a deadline is moved or renamed.
                </>,
                <>
                  <strong className={LEAD}>Google Calendar works too.</strong> Paste your calendar's
                  private iCal link the same way. Its events show up in Studily, and events you
                  delete in Google disappear from Studily as well.
                </>,
              ]}
            />
          }
        />
        <Screenshot
          name="import-link"
          alt="The import form where you paste a Canvas, Brightspace or Moodle calendar link"
          width={1576}
          height={531}
        />
      </>
    ),
  },
  {
    id: "semesters-and-courses",
    title: "Semesters and courses",
    eyebrow: "Plan",
    body: (
      <>
        <SideBySide
          media={
            <Screenshot
              name="semesters"
              alt="The semesters page with average, GPA and progress for each course"
              width={1600}
              height={1276}
            />
          }
        >
          <p className="text-base">
            Add your courses to track your schedule, deadlines and grades.
          </p>
          <Points
            items={[
              "See your average, GPA and progress for every course in a semester",
              "Set a target grade and see what you need on the rest of the course to reach it",
            ]}
          />
        </SideBySide>
        <SideBySide
          reverse
          media={
            <Screenshot
              name="course"
              alt="A course page with lecture times, grade, exams and assignments, and a study plan"
              width={1600}
              height={949}
            />
          }
        >
          <p className="text-base">
            Enter your scores in the assignments tab and Studily keeps your grade up to date.
          </p>
          <Points
            items={[
              "Upload a course outline to scan and import your assignments and grade weights",
              "Each course keeps its lecture, lab and tutorial times, exams, assignments and a study plan",
            ]}
          />
        </SideBySide>
      </>
    ),
  },
  {
    id: "study-sessions",
    title: "Study sessions",
    eyebrow: "Study",
    body: (
      <>
        <TextColumns
          left={
            <p className="text-base">
              Time your study sessions effectively and earn rewards for them.
            </p>
          }
          right={
            <Points
              items={[
                "Focus in blocks, check in to earn XP",
                "Keep your streak alive",
                "Pomodoro-style sprints and breaks",
              ]}
            />
          }
        />
        <Screenshot
          name="study-sessions"
          alt="The study sessions page with a streak and recent sessions"
          width={1600}
          height={716}
        />
      </>
    ),
  },
  {
    id: "flashcards",
    title: "Flashcards",
    eyebrow: "Study",
    body: (
      <>
        <TextColumns
          left={
            <p className="text-base">
              Set up flashcards manually, or generate them automatically from your lecture notes.
            </p>
          }
          right={
            <Points
              items={[
                "Study, Learn and Memory modes",
                "Match minigames to make reviewing fun",
                "Track your progress as you go",
              ]}
            />
          }
        />
        <Screenshot
          name="flashcards"
          alt="A flashcard set with Study, Learn, Memory and Match modes"
          width={1600}
          height={799}
        />
      </>
    ),
  },
  {
    id: "studilybot",
    title: "StudilyBot",
    eyebrow: "Study",
    body: (
      <>
        <SideBySide
          media={
            <Screenshot
              name="studilybot-hub"
              alt="StudilyBot with Chat, Practice and Recall modes"
              width={1600}
              height={1476}
            />
          }
        >
          <p className="text-base">
            Use AI to help your learning. StudilyBot reads the files you add to a course.
          </p>
          <Points
            items={[
              <>
                <strong className={LEAD}>Chat:</strong> ask questions about your courses
              </>,
              <>
                <strong className={LEAD}>Practice:</strong> generate practice questions
              </>,
              <>
                <strong className={LEAD}>Recall:</strong> explain concepts back to StudilyBot to
                check that you understand
              </>,
            ]}
          />
        </SideBySide>
        <SideBySide
          reverse
          media={
            <Screenshot
              name="studilybot-chat"
              alt="A StudilyBot answer that cites a slide from the student's course files"
              width={1600}
              height={1145}
            />
          }
        >
          <h3 className="text-base font-semibold text-fg">Answers with citations</h3>
          <p>
            StudilyBot answers with citations back to your slides and pages, so you can check where
            an answer came from.
          </p>
        </SideBySide>
      </>
    ),
  },
  {
    id: "profile",
    title: "Profile",
    eyebrow: "Connect",
    body: (
      <>
        <TextColumns
          left={
            <p className="text-base">
              Set up a profile that other users can see, and customize it with cosmetics you buy with
              the coins you earn.
            </p>
          }
          right={
            <Points
              items={[
                "Show off your level, streak and favourite badges",
                "Spend coins on flairs, badges and StudilyBot attire",
              ]}
            />
          }
        />
        <div className="grid items-start gap-6 sm:grid-cols-2">
          <Screenshot
            name="profile"
            alt="A Studily profile with level, streak and featured badges"
            width={798}
            height={1371}
          />
          <Screenshot
            name="shop"
            alt="The shop where coins buy flairs, badges and StudilyBot attire"
            width={1314}
            height={1376}
          />
        </div>
      </>
    ),
  },
  {
    id: "friends",
    title: "Friends",
    eyebrow: "Connect",
    body: (
      <>
        <TextColumns
          left={<p className="text-base">Add your friends, and find other Studily users at your school.</p>}
          right={
            <Points
              items={["Keep your friends in one list and chat with them", "Browse schoolmates to connect with"]}
            />
          }
        />
        <Screenshot
          name="friends"
          alt="The friends tab with a list of friends and a schoolmates button"
          width={1600}
          height={872}
        />
      </>
    ),
  },
  {
    id: "conclusion",
    title: "Conclusion",
    body: (
      <div className="card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <p className="max-w-xl text-base">
          We built Studily to make learning more accessible and keep it all in one place. If you
          haven't yet, create a free Studily account and try it all out.
        </p>
        <Link to="/signup" className="btn btn-primary btn-lg">
          Create a free account
        </Link>
      </div>
    ),
  },
];

export default function WhatIsStudilyPage() {
  return (
    <ArticlePage
      wide
      title="What is Studily"
      intro={<p>What Studily is, why it was built, and everything it gives you in one place.</p>}
      sections={SECTIONS}
    />
  );
}
