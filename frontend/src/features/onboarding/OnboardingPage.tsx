import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Brain, GraduationCap, User } from "lucide-react";
import { useAuth } from "../../lib/auth";

const STEPS = [
  {
    to: "/profile/edit",
    icon: User,
    title: "Profile",
    description: "Set your profile to connect with others.",
  },
  {
    to: "/semesters",
    icon: GraduationCap,
    title: "Semesters",
    description: "Set your courses for your semester to build your schedule.",
  },
  {
    to: "/learn",
    icon: Brain,
    title: "Learn",
    description: "Boost your learning with these learning tools!",
  },
];

export default function OnboardingPage() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/" replace />;

  const firstName = user.name?.split(" ")[0] || user.username;

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 py-4 animate-in">
      <div className="text-center">
        <img src="/studily-3a.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
        <h1 className="text-3xl font-bold text-fg">Welcome to Studily, {firstName}!</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-fg-2">
          Studily is your academic planner — keep your courses, weekly schedule, assignments, and
          exams in one place, connect with friends and classmates, and study smarter with built-in
          learning tools.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
          Get started
        </h2>
        <div className="space-y-3">
          {STEPS.map(({ to, icon: Icon, title, description }) => (
            <Link
              key={to}
              to={to}
              className="card flex items-center gap-3 p-4 transition-colors hover:bg-surface-hi"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
              >
                <Icon size={16} className="text-accent" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-fg">{title}</div>
                <div className="text-[12px] text-fg-3">{description}</div>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-accent">
                Let's go <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-center">
        <Link to="/" className="text-[12px] text-fg-3 transition-colors hover:text-fg">
          Skip for now — take me to my dashboard
        </Link>
      </p>
    </div>
  );
}
