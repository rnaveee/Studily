import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Check,
  CalendarDays,
  GraduationCap,
  Sparkles,
  User,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { toast } from "../../lib/toast";
import BackButton from "../../components/BackButton";
import CanvasImportForm from "../canvas/CanvasImportForm";
import type { OnboardingStatus, Semester, SemesterTerm } from "../../types";

export function currentTerm(date = new Date()): { term: SemesterTerm; year: number } {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month >= 7) return { term: "FALL", year };
  if (month >= 4) return { term: "SUMMER", year };
  return { term: "SPRING", year };
}

const TERM_LABELS: Record<SemesterTerm, string> = {
  FALL: "Fall",
  SPRING: "Spring",
  SUMMER: "Summer",
  WINTER: "Winter",
};

export function termLabel(term: SemesterTerm, year: number): string {
  return `${TERM_LABELS[term]} ${year}`;
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const statusQ = useQuery({
    queryKey: ["onboarding"],
    queryFn: () => api.get<OnboardingStatus>("/me/onboarding"),
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  const semestersQ = useQuery({
    queryKey: ["semesters"],
    queryFn: () => api.get<Semester[]>("/semesters"),
    enabled: !!user,
  });

  const status = statusQ.data;

  useEffect(() => {
    if (!status || expanded !== null) return;
    const first = !status.profile
      ? "profile"
      : !status.semester
        ? "semester"
        : !status.courses
          ? "courses"
          : !status.coursework
            ? "coursework"
            : null;
    setExpanded(first);
  }, [status, expanded]);

  if (!user) return <Navigate to="/" replace />;

  const firstName = user.name?.split(" ")[0] || user.username;
  const semesterLabel = semestersQ.data?.[0]
    ? semestersQ.data[0].label
    : undefined;

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 py-4 stagger-children">
      <BackButton />

      <div className="text-center">
        <img src="/studily-3a.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
        <h1 className="text-2xl font-bold text-fg">
          {status?.complete ? `You're all set, ${firstName}` : `Welcome to Studily, ${firstName}`}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-fg-2">
          {status?.complete
            ? "Your semester is set up. Head to your dashboard to see the week ahead."
            : "A few quick steps and your whole semester lives on one screen."}
        </p>
      </div>

      {status && <ProgressBar completed={status.completed} total={status.total} />}

      {status && (
        <div className="space-y-2.5">
          <Step
            id="profile"
            icon={User}
            title="Add your school"
            hint="So classmates and schoolmates can find you"
            done={status.profile}
            doneHint={user.school ?? undefined}
            expanded={expanded === "profile"}
            onToggle={setExpanded}
          >
            <p className="text-[12px] leading-relaxed text-fg-2">
              Your school powers classmate matching — the people in your courses show up
              automatically once it's set.
            </p>
            <Link to="/profile/edit" className="btn btn-primary mt-3">
              Edit profile
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </Step>

          <Step
            id="semester"
            icon={GraduationCap}
            title="Start your semester"
            hint="Everything hangs off a semester"
            done={status.semester}
            doneHint={semesterLabel}
            expanded={expanded === "semester"}
            onToggle={setExpanded}
          >
            <SemesterStep
              onCreated={() => {
                qc.invalidateQueries({ queryKey: ["onboarding"] });
                qc.invalidateQueries({ queryKey: ["semesters"] });
                setExpanded("courses");
              }}
            />
          </Step>

          <Step
            id="courses"
            icon={BookOpen}
            title="Add your courses"
            hint="Import them from Canvas, or add them by hand"
            done={status.courses}
            doneHint={
              status.courseCount > 0
                ? `${status.courseCount} course${status.courseCount === 1 ? "" : "s"}`
                : undefined
            }
            expanded={expanded === "courses"}
            onToggle={setExpanded}
          >
            <div
              className="rounded-lg p-3"
              style={{ background: "color-mix(in srgb, var(--accent) 7%, transparent)" }}
            >
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-accent">
                <Sparkles size={13} strokeWidth={2} />
                Fastest way
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-fg-2">
                One link from Canvas brings in your courses, assignments and exams at once.
              </p>
              <div className="mt-3">
                <CanvasImportForm submitLabel="Import my semester" />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span className="h-px flex-1" style={{ background: "var(--line)" }} />
              <span className="text-[11px] text-fg-3">or</span>
              <span className="h-px flex-1" style={{ background: "var(--line)" }} />
            </div>

            <Link to="/courses" className="btn btn-ghost mt-3">
              Add a course by hand
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </Step>

          <Step
            id="coursework"
            icon={CalendarDays}
            title="Track your first deadline"
            hint="An assignment, exam, or to-do"
            done={status.coursework}
            expanded={expanded === "coursework"}
            onToggle={setExpanded}
          >
            <p className="text-[12px] leading-relaxed text-fg-2">
              Add what's due and it lands on your dashboard and calendar, with reminders before it
              creeps up on you.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/courses" className="btn btn-primary">
                Add to a course
                <ArrowRight size={13} strokeWidth={2} />
              </Link>
              <Link to="/todos" className="btn btn-ghost">
                Add a to-do
              </Link>
            </div>
          </Step>
        </div>
      )}

      {statusQ.isLoading && <p className="text-center text-[13px] text-fg-3">Loading…</p>}

      <p className="text-center">
        <Link to="/dashboard" className="text-[12px] text-fg-3 transition-colors hover:text-fg">
          {status?.complete ? "Go to my dashboard" : "Skip for now, take me to my dashboard"}
        </Link>
      </p>
    </div>
  );
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
        <span className="text-fg-2">
          {completed === total ? "All done" : `Step ${Math.min(completed + 1, total)} of ${total}`}
        </span>
        <span className="text-fg-3">
          {completed}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-hi)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(completed / total) * 100}%`,
            background: completed === total ? "var(--green)" : "var(--accent)",
          }}
        />
      </div>
    </div>
  );
}

function Step({
  id,
  icon: Icon,
  title,
  hint,
  done,
  doneHint,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  icon: typeof User;
  title: string;
  hint: string;
  done: boolean;
  doneHint?: string;
  expanded: boolean;
  onToggle: (id: string | null) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => onToggle(expanded ? null : id)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-hi"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
          style={{
            background: done
              ? "color-mix(in srgb, var(--green) 14%, transparent)"
              : "color-mix(in srgb, var(--accent) 12%, transparent)",
          }}
        >
          {done ? (
            <Check size={15} strokeWidth={2.5} style={{ color: "var(--green)" }} />
          ) : (
            <Icon size={15} strokeWidth={1.8} className="text-accent" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div
            className="text-[14px] font-medium"
            style={{ color: done ? "var(--fg-2)" : "var(--fg)" }}
          >
            {title}
          </div>
          <div className="truncate text-[12px] text-fg-3">{done ? (doneHint ?? "Done") : hint}</div>
        </div>

        {!done && !expanded && (
          <span className="shrink-0 text-[12px] font-medium text-accent">Start</span>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 animate-slide" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

function SemesterStep({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const { term, year } = currentTerm();
  const label = termLabel(term, year);

  const create = useMutation({
    mutationFn: () => api.post<Semester>("/semesters", { term, year }),
    onSuccess: () => {
      toast.success(`${label} created`);
      onCreated();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't create that semester"),
  });

  return (
    <>
      <p className="text-[12px] leading-relaxed text-fg-2">
        Courses, assignments and grades all sit inside a semester. We'll set the usual start and end
        dates for {label} — you can change them any time.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="btn btn-primary"
        >
          {create.isPending ? "Creating…" : `Start ${label}`}
        </button>
        <button onClick={() => navigate("/semesters")} className="btn btn-ghost">
          Pick a different one
        </button>
      </div>
    </>
  );
}
