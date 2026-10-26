import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import BackButton from "../../components/BackButton";
import { useHydrated } from "../../components/ClientOnly";
import { useAuth } from "../../lib/auth";
import NotFoundPage from "../static/NotFoundPage";
import { schoolBySlug } from "./schools";

const TOOLS: [string, string, string][] = [
  ["Pomodoro timer", "/pomodoro", "Focus sprints and breaks with alarm sounds."],
  ["Grade calculator", "/grade-calculator", "See exactly what you need on your final."],
  ["Periodic table", "/periodic-table", "Every element, searchable, with full details."],
];

const IMPORTS = [
  "Your courses",
  "Assignments and their due dates",
  "Exams and quizzes",
  "Updates whenever you import again",
];

export default function SchoolPage({ slug }: { slug: string }) {
  const { user } = useAuth();
  const hydrated = useHydrated();
  const school = schoolBySlug(slug);
  if (!school) return <NotFoundPage />;

  return (
    <div className="space-y-5 stagger-children">
      <div className="flex items-center gap-3">
        <BackButton fallback={user ? "/learn" : "/"} />
        <div>
          <h1 className="text-xl font-semibold text-fg">Studily for {school.short} students</h1>
          <p className="mt-1 text-[13px] text-fg-3">
            A free planner for students at {school.theName} in {school.city}: your {school.lms}
            deadlines, flashcards and a study timer in one place.
          </p>
        </div>
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="text-base font-semibold text-fg">Works with {school.lms}</h2>
        <p className="text-[13px] leading-relaxed text-fg-2">
          {school.short} courses live on {school.lms} at {school.host}. Studily reads your{" "}
          {school.lms} calendar feed, so you don't retype a single deadline.
        </p>
        <ol className="space-y-2 text-[13px] leading-relaxed text-fg-2">
          {school.feedSteps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="font-mono font-bold text-fg-3">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
          <li className="flex gap-3">
            <span className="font-mono font-bold text-fg-3">{school.feedSteps.length + 1}.</span>
            <span>
              In Studily, open Settings, then Integrations (or paste it during onboarding), and
              import the link.
            </span>
          </li>
        </ol>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-base font-semibold text-fg">What gets imported</h2>
        <ul className="space-y-1.5 text-[13px] text-fg-2">
          {IMPORTS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-base font-semibold text-fg">Free tools, no account needed</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TOOLS.map(([label, to, blurb]) => (
            <Link key={to} to={to} className="block rounded-lg border border-line p-3 transition-colors hover:text-fg">
              <div className="text-[13px] font-semibold text-fg">{label}</div>
              <div className="mt-1 text-[12px] text-fg-3">{blurb}</div>
            </Link>
          ))}
        </div>
      </section>

      {hydrated && !user && (
        <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-relaxed text-fg-2">
            Create a free account, import your {school.lms} calendar and see your whole semester
            on one screen.
          </p>
          <Link to="/signup" className="btn btn-primary shrink-0 self-start sm:self-auto">
            <UserPlus size={14} />
            Create a free account
          </Link>
        </section>
      )}

      <p className="text-[12px] text-fg-3">Studily isn't affiliated with {school.theName}.</p>
    </div>
  );
}
