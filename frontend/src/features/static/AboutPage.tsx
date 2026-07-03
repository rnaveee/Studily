import { Page, Section } from "./shell";

const FEATURES = [
  ["Dashboard", "a weekly schedule grid with time-proportional class blocks and a “due this week” list"],
  ["Courses", "courses with meeting times, professors, colors, and per-course notes"],
  ["Assignments & exams", "due dates, weights, and a TODO → IN PROGRESS → DONE workflow"],
  ["Calendar", "a monthly view of everything you have due"],
  ["Semesters", "scope your courses and dashboard to the current term"],
  ["Friends", "find schoolmates, send friend requests, and see profiles"],
  ["Reminders", "in-app notifications for items due within 48 hours"],
] as const;

export default function AboutPage() {
  return (
    <Page title="About" intro="What Studily is and who builds it.">
      <Section title="What is Studily?">
        <p>
          Studily is an academic planner for students. It puts your class schedule, assignments,
          exams, notes, and deadlines in one place, so you always know what's coming up and what
          to work on next.
        </p>
        <p>
          It's intended for personal academic organization — plan your semester, track your
          coursework, and connect with classmates at your school. It's not a replacement for your
          school's official systems; always double-check important dates against your syllabus.
        </p>
      </Section>

      <Section title="Features">
        <ul className="space-y-2">
          {FEATURES.map(([name, desc]) => (
            <li key={name} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
              <span>
                <span className="font-medium text-fg">{name}</span> — {desc}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="About the developer">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
          <img
            src="/me.jpg"
            alt="Ryan Nave"
            className="h-24 w-24 shrink-0 rounded-xl bg-surface-hi object-cover"
            style={{ border: "1px solid var(--line)" }}
          />
          <div className="space-y-2">
            <p className="text-[15px] font-semibold text-fg">Ryan Nave</p>
            <p>
              Hi, I'm Ryan — a student and developer building Studily to be the planner I always
              wished I had. I'm working on it solo, so every bug report and piece of feedback
              genuinely helps shape what gets built next.
            </p>
            <p>
              Want to say hi or report something?{" "}
              <a
                href="mailto:ryannave97@gmail.com"
                className="text-accent transition-colors hover:text-accent-2"
              >
                ryannave97@gmail.com
              </a>
            </p>
          </div>
        </div>
      </Section>
    </Page>
  );
}
