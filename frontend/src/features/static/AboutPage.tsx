import { Link } from "react-router-dom";
import { Page, Section } from "./shell";

const FEATURES = [
  ["Dashboard", "a weekly schedule grid with time-proportional class blocks and a “due this week” list"],
  ["Courses", "courses with meeting times, professors, colors, and per-course notes"],
  ["Assignments & exams", "due dates, weights, and a TODO → IN PROGRESS → DONE workflow"],
  ["Calendar", "a monthly view of everything you have due"],
  ["Semesters", "scope your courses and dashboard to the current term"],
  ["Friends", "find schoolmates, send friend requests, and see profiles"],
  ["Notifications", "push notifications for messages, classes, events, and due dates"],
] as const;

export default function AboutPage() {
  return (
    <Page title="About" intro="What Studily is and who builds it.">
      <Section title="What is Studily?">
        <p>
          Studily is an academic planner for students. Enter your class schedule once, and Studily
          turns it into a weekly schedule for you. Add your assignments and exams too, and they'll
          show up on your dashboard as their due dates approach!
        </p>
        <p>
          You can also connect with others at your school — set up your{" "}
          <Link to="/profile" className="text-accent transition-colors hover:text-accent-2">
            profile
          </Link>{" "}
          to add friends and see who else from your school is using the app (see{" "}
          <Link to="/friends/schoolmates" className="text-accent transition-colors hover:text-accent-2">
            schoolmates
          </Link>{" "}
          for more).
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
        <div className="space-y-4">
          <img
            src="/me.png"
            alt="Ryan Nave"
            className="h-64 w-full rounded-xl bg-surface-hi object-cover sm:h-80"
            style={{ border: "1px solid var(--line)" }}
          />
          <div className="space-y-2">
            <p className="text-[15px] font-semibold text-fg">Ryan Nave</p>
            <p>
              Hello, I'm Ryan — a student and developer studying Computer Science at SFU. I currently
              am pursuing a career in software development, so any feedback helps a lot!
            </p>
            <p className="text-[15px] font-semibold text-fg">Why I made Studily</p>
            <p>
              Have you ever used Notion? or Google Calendar? I used to use them to manage my school,
              and it was kind of messy... (no hate to those apps!)
            </p>
            <p>Manually inputting classes, switching between those apps, creating my OWN dashboard, I was very
              demotivated to organize my classes because of those things. So as a student and app developer, I
              created my own!
            </p>
            <p>
              I aimed to bundle up those everyday apps people use for their classes and simplify
              the process! The best part, <strong>It's completely free!</strong>
            </p>

            <p>
              Want to say hi or report something?{" "}
              <a
                href="mailto:ryannave97@gmail.com"
                className="text-accent transition-colors hover:text-accent-2"
              >
                ryannave97@gmail.com
              </a>
              {" "}or try my instagram!{" "}
              <a href={"https://www.instagram.com/rnave9"}
                 className="text-accent transition-colors hover:text-accent-2">
                @rnave9
              </a>
            </p>
          </div>
        </div>
      </Section>
    </Page>
  );
}
