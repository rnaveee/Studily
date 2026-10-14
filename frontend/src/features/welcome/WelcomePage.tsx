import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Check, PencilLine, Sparkles } from "lucide-react";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { applyDelta } from "../../lib/progressDelta";
import { welcomeTour } from "../../lib/welcomeTour";
import CourseForm from "../courses/CourseForm";
import ParseDropzone from "../courses/ParseDropzone";
import ScheduleDraftReview from "../courses/ScheduleDraftReview";
import { currentTerm } from "../onboarding/OnboardingPage";
import ProfileForm from "../profile/ProfileForm";
import ChestIcon from "../progress/ChestIcon";
import ProgressHost from "../progress/ProgressHost";
import type { Course, CourseRequest, ProgressDelta, ScheduleDraft, Semester, SemesterTerm } from "../../types";

type Slide = "profile" | "semester" | "finish";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TERMS: { value: SemesterTerm; label: string; months: [number, number] }[] = [
  { value: "FALL", label: "Fall", months: [8, 11] },
  { value: "WINTER", label: "Winter", months: [0, 3] },
  { value: "SPRING", label: "Spring", months: [0, 3] },
  { value: "SUMMER", label: "Summer", months: [4, 7] },
];

export default function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const raw = params.get("step");
  const slide: Slide = welcomeTour.finishPending()
    ? "finish"
    : raw === "semester" || raw === "finish"
      ? raw
      : "profile";

  useEffect(() => {
    if (welcomeTour.finishPending() && raw !== "finish") setParams({ step: "finish" }, { replace: true });
  }, [raw, setParams]);

  if (!user) return <Navigate to="/login" replace />;

  const go = (next: Slide) => setParams({ step: next }, { replace: false });
  const order: Slide[] = ["profile", "semester", "finish"];
  const position = slide === "finish" ? 6 : order.indexOf(slide);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div
        className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 sm:px-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
        }}
      >
        <div className="mb-6 flex items-center justify-center gap-2">
          <img src="/studily-3a.svg" alt="" className="h-7 w-7" />
          <span className="font-mono text-[15px] font-bold text-fg">Studily</span>
        </div>
        <Dots position={position} />
        <div key={slide} className="mt-6 flex-1 animate-in">
          {slide === "profile" && <ProfileSlide onNext={() => go("semester")} />}
          {slide === "semester" && (
            <SemesterSlide
              onBack={() => go("profile")}
              onNext={() => {
                welcomeTour.start();
                navigate("/learn");
              }}
            />
          )}
          {slide === "finish" && <FinishSlide />}
        </div>
      </div>
      <ProgressHost />
    </div>
  );
}

function Dots({ position }: { position: number }) {
  return (
    <div className="flex justify-center gap-1.5" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={i}
          className="h-1.5 rounded-full transition-all"
          style={{ width: i === position ? 20 : 6, background: i <= position ? "var(--accent)" : "var(--surface-hi)" }}
        />
      ))}
    </div>
  );
}

function SlideHeader({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-5 text-center">
      <h1 className="display text-[26px] font-bold leading-tight text-fg">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-fg-2">{body}</p>
    </div>
  );
}

function ProfileSlide({ onNext }: { onNext: () => void }) {
  return (
    <>
      <SlideHeader
        title="Welcome to Studily! 👋"
        body="Let's get to know you a little better. You can change any of this later from your profile."
      />
      <ProfileForm
        submitLabel="Save and continue"
        savingLabel="Saving…"
        onSaved={onNext}
        highlightSchool
        secondaryAction={
          <button type="button" onClick={onNext} className="btn btn-ghost">
            Skip for now
          </button>
        }
      />
    </>
  );
}

function lastDay(year: number, month: number): string {
  const d = new Date(year, month + 1, 0);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SemesterSlide({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const qc = useQueryClient();
  const semesters = useQuery({ queryKey: ["semesters"], queryFn: () => api.get<Semester[]>("/semesters") });
  const courses = useQuery({ queryKey: ["courses", null], queryFn: () => api.get<Course[]>("/courses") });
  const initialTerm = currentTerm();
  const [term, setTerm] = useState<SemesterTerm>(initialTerm.term);
  const [year, setYear] = useState(initialTerm.year);
  const [startMonth, setStartMonth] = useState(TERMS.find((t) => t.value === initialTerm.term)!.months[0]);
  const [endMonth, setEndMonth] = useState(TERMS.find((t) => t.value === initialTerm.term)!.months[1]);
  const [mode, setMode] = useState<"choose" | "manual" | "automatic">("choose");

  const semester = semesters.data?.[0] ?? null;
  const semesterCourses = (courses.data ?? []).filter((c) => semester && c.semesterId === semester.id);

  const create = useMutation({
    mutationFn: () => {
      const endYear = endMonth < startMonth ? year + 1 : year;
      return api.post<Semester>("/semesters", {
        term,
        year,
        startDate: `${year}-${String(startMonth + 1).padStart(2, "0")}-01`,
        endDate: lastDay(endYear, endMonth),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["semesters"] });
      qc.invalidateQueries({ queryKey: ["onboarding"] });
    },
  });

  const createCourse = useMutation({
    mutationFn: (req: CourseRequest) => api.post<Course>("/courses", req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setMode("choose");
    },
  });

  function pickTerm(next: SemesterTerm) {
    setTerm(next);
    const months = TERMS.find((t) => t.value === next)!.months;
    setStartMonth(months[0]);
    setEndMonth(months[1]);
  }

  return (
    <>
      <SlideHeader title="Let's get your semester set up!" body="Tell us when your term runs, then add the courses you're taking." />

      {semesters.isLoading ? (
        <div className="card h-40 animate-pulse" />
      ) : !semester ? (
        <div className="card space-y-3 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Term</label>
              <select className="input" value={term} onChange={(e) => pickTerm(e.target.value as SemesterTerm)}>
                {TERMS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Year</label>
              <input
                className="input"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || initialTerm.year)}
              />
            </div>
            <div>
              <label className="field-label">Start month</label>
              <select className="input" value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">End month</label>
              <select className="input" value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          {create.isError && (
            <p className="text-xs text-red">{create.error instanceof Error ? create.error.message : "Couldn't save that."}</p>
          )}
          <button type="button" onClick={() => create.mutate()} disabled={create.isPending} className="btn btn-primary w-full">
            <CalendarDays size={14} />
            {create.isPending ? "Saving…" : "Create my semester"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: "color-mix(in srgb, var(--green) 10%, var(--surface))" }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "var(--green)", color: "#fff" }}>
              <Check size={15} strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-fg">{semester.label} is ready</p>
              <p className="text-[12px] text-fg-3">
                {semesterCourses.length === 0
                  ? "Now add your courses."
                  : `${semesterCourses.length} ${semesterCourses.length === 1 ? "course" : "courses"} added: ${semesterCourses.map((c) => c.code || c.name).join(", ")}`}
              </p>
            </div>
          </div>

          {mode === "automatic" ? (
            <AutomaticSchedule semesterId={semester.id} onDone={() => setMode("choose")} />
          ) : (
            <div className="grid gap-3">
              <button type="button" onClick={() => setMode("automatic")} className="card press p-4 text-left transition-colors hover:bg-surface-hi">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                  <Sparkles size={15} className="text-accent" />
                  Automatic
                  <span className="badge badge-accent text-[10px]">Beta</span>
                </span>
                <span className="mt-1 block text-[12.5px] text-fg-2">
                  Have a schedule like this? Upload a screenshot and we'll build all your courses for you.
                </span>
                <span className="mt-3 block overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-sm">
                  <img
                    src="/onboarding/schedule-example.png"
                    alt="Example of a weekly class schedule"
                    className="block h-56 w-full rounded-lg object-cover"
                    style={{ objectPosition: "50% 48%" }}
                  />
                </span>
              </button>
              <button type="button" onClick={() => setMode("manual")} className="card press p-4 text-left transition-colors hover:bg-surface-hi">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                  <PencilLine size={15} className="text-accent" />
                  Manual
                </span>
                <span className="mt-1 block text-[12.5px] text-fg-2">Type in each course, its class times and room.</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2">
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Back
        </button>
        {semesterCourses.length === 0 && (
          <button type="button" onClick={onNext} className="ml-auto text-[12.5px] font-medium text-fg-3 hover:text-fg">
            I'll add my schedule later
          </button>
        )}
        <button type="button" onClick={onNext} className={`btn btn-primary ${semesterCourses.length > 0 ? "ml-auto" : ""}`}>
          Next
          <ArrowRight size={14} />
        </button>
      </div>

      {mode === "manual" && semester && (
        <Modal onClose={() => setMode("choose")} title="New course" size="xl" variant="sheet" padded={false}>
          <div className="p-5 pt-0">
            <CourseForm
              bare
              initial={{ name: "", semesterId: semester.id, meetingBlocks: [] }}
              submitLabel="Add course"
              onSubmit={(req) => createCourse.mutateAsync(req)}
              onCancel={() => setMode("choose")}
              onImported={() => {
                qc.invalidateQueries({ queryKey: ["courses"] });
                setMode("choose");
              }}
            />
          </div>
        </Modal>
      )}
    </>
  );
}

function AutomaticSchedule({ semesterId, onDone }: { semesterId: number; onDone: () => void }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);

  const parse = useMutation({
    mutationFn: () => {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("semesterId", String(semesterId));
      form.append("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      return api.post<ScheduleDraft>("/courses/parse/schedule", form);
    },
    onSuccess: setDraft,
  });

  if (draft) {
    return (
      <ScheduleDraftReview
        draft={draft}
        semesterId={semesterId}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["courses"] });
          onDone();
        }}
        onCancel={() => setDraft(null)}
      />
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <ParseDropzone files={files} onChange={setFiles} onError={setError} label="Drop a screenshot of your weekly schedule here" />
      {error && <p className="text-xs text-red">{error}</p>}
      {parse.isError && (
        <p className="text-xs text-red">{parse.error instanceof Error ? parse.error.message : "Could not read that."}</p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => parse.mutate()} disabled={files.length === 0 || parse.isPending} className="btn btn-primary">
          <Sparkles size={13} />
          {parse.isPending ? "Reading your schedule…" : "Find my courses"}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost">
          Back
        </button>
      </div>
    </div>
  );
}

function FinishSlide() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, setUser } = useAuth();
  const started = useRef(false);

  const finish = useMutation({
    mutationFn: () => api.post<ProgressDelta>("/me/welcome/finish"),
    onSuccess: (delta) => {
      welcomeTour.clearFinish();
      if (user) setUser({ ...user, welcomed: true });
      applyDelta(delta, qc, { toastXp: false });
    },
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    finish.mutate();
  }, [finish]);

  return (
    <div className="flex flex-col items-center text-center">
      <ChestIcon tier="DIAMOND" size={132} className="chest-drop" />
      <h1 className="display mt-6 text-[26px] font-bold leading-tight text-fg">Thank you for trying out Studily!</h1>
      <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-fg-2">
        Here's a free Diamond chest, on us. 💎 Open it now, or find it on your profile whenever you like.
      </p>
      <button
        type="button"
        onClick={() => navigate("/dashboard", { replace: true })}
        className="btn btn-primary btn-lg mt-8 w-full sm:w-auto"
        style={{ minHeight: 48 }}
      >
        Continue to Studily
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
