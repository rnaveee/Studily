import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Camera, Check, ChevronDown, Globe, PencilLine } from "lucide-react";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { applyDelta } from "../../lib/progressDelta";
import { welcomeTour } from "../../lib/welcomeTour";
import CanvasImportForm from "../canvas/CanvasImportForm";
import LmsLinkGuide from "../canvas/LmsLinkGuide";
import CourseForm from "../courses/CourseForm";
import ParseDropzone from "../courses/ParseDropzone";
import ScheduleDraftReview from "../courses/ScheduleDraftReview";
import { currentTerm } from "../onboarding/OnboardingPage";
import ProfileForm from "../profile/ProfileForm";
import ChestIcon from "../progress/ChestIcon";
import ProgressHost from "../progress/ProgressHost";
import type { Course, CourseRequest, ProgressDelta, ScheduleDraft, Semester, SemesterTerm } from "../../types";

type Slide = "profile" | "semester" | "courses" | "finish";

const ORDER: Slide[] = ["profile", "semester", "courses", "finish"];
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
    : ORDER.includes(raw as Slide)
      ? (raw as Slide)
      : "profile";
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (welcomeTour.finishPending() && raw !== "finish") setParams({ step: "finish" }, { replace: true });
  }, [raw, setParams]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [slide]);

  if (!user) return <Navigate to="/login" replace />;

  const go = (next: Slide) => setParams({ step: next }, { replace: false });
  const startTour = () => {
    welcomeTour.start();
    navigate("/learn");
  };

  return (
    <div
      ref={scroller}
      className="fixed inset-0 overflow-y-auto"
      style={{ background: "var(--bg)", height: "var(--app-height)", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
    >
      <div
        className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4 sm:px-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)" }}
      >
        <div className="mb-5 flex items-center justify-center gap-2">
          <img src="/studily-3a.svg" alt="" className="h-7 w-7" />
          <span className="font-mono text-[15px] font-bold text-fg">Studily</span>
        </div>
        <Dots position={ORDER.indexOf(slide)} />
        <div key={slide} className="mt-6 flex flex-1 flex-col animate-in">
          {slide === "profile" && <ProfileSlide onNext={() => go("semester")} />}
          {slide === "semester" && <SemesterSlide onBack={() => go("profile")} onNext={() => go("courses")} />}
          {slide === "courses" && <CoursesSlide onBack={() => go("semester")} onNext={startTour} />}
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
      {ORDER.map((s, i) => (
        <span
          key={s}
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
      <h1 className="display text-[24px] font-bold leading-tight text-fg sm:text-[26px]">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-fg-2">{body}</p>
    </div>
  );
}

function SlideFooter({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky bottom-0 z-10 -mx-4 mt-auto flex items-center gap-2 bg-bg px-4 pt-3 sm:static sm:mx-0 sm:mt-6 sm:bg-transparent sm:px-0"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        boxShadow: "0 -12px 16px -4px var(--bg)",
      }}
    >
      {children}
    </div>
  );
}

function LaterButton({ onClick, label = "Set up later" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="ml-auto whitespace-nowrap px-2 py-2 text-[12.5px] font-medium text-fg-3 hover:text-fg">
      {label}
    </button>
  );
}

function ProfileSlide({ onNext }: { onNext: () => void }) {
  return (
    <>
      <SlideHeader
        title="Welcome to Studily! 👋"
        body="Set up your profile so classmates can find you. Adding your school connects you with other students there."
      />
      <div className="pb-6">
        <ProfileForm
          submitLabel="Save and continue"
          savingLabel="Saving…"
          onSaved={onNext}
          highlightSchool
          secondaryAction={
            <button type="button" onClick={onNext} className="btn btn-ghost">
              Set up later
            </button>
          }
        />
      </div>
      <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
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
  const initialTerm = currentTerm();
  const [term, setTerm] = useState<SemesterTerm>(initialTerm.term);
  const [year, setYear] = useState(initialTerm.year);
  const [startMonth, setStartMonth] = useState(TERMS.find((t) => t.value === initialTerm.term)!.months[0]);
  const [endMonth, setEndMonth] = useState(TERMS.find((t) => t.value === initialTerm.term)!.months[1]);

  const semester = semesters.data?.[0] ?? null;

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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["semesters"] });
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      onNext();
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
      <SlideHeader title="When does your semester run?" body="We use this to place your classes and deadlines on the right weeks." />

      {semesters.isLoading ? (
        <div className="card h-40 animate-pulse" />
      ) : semester ? (
        <ReadyRow title={`${semester.label} is ready`} body="You can change its dates any time from Courses." />
      ) : (
        <form
          id="semester-form"
          className="card space-y-3 p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="sem-term">Season</label>
              <select id="sem-term" className="input" value={term} onChange={(e) => pickTerm(e.target.value as SemesterTerm)}>
                {TERMS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="sem-year">Year</label>
              <input
                id="sem-year"
                className="input"
                type="number"
                inputMode="numeric"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || initialTerm.year)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="sem-start">Start month</label>
              <select id="sem-start" className="input" value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="sem-end">End month</label>
              <select id="sem-end" className="input" value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          {create.isError && (
            <p className="text-xs text-red">{create.error instanceof Error ? create.error.message : "Couldn't save that."}</p>
          )}
        </form>
      )}

      <SlideFooter>
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Back
        </button>
        {semester ? (
          <button type="button" onClick={onNext} className="btn btn-primary ml-auto">
            Next
            <ArrowRight size={14} />
          </button>
        ) : (
          <>
            <LaterButton onClick={onNext} />
            <button type="submit" form="semester-form" disabled={create.isPending || semesters.isLoading} className="btn btn-primary">
              <CalendarDays size={14} />
              {create.isPending ? "Saving…" : "Create semester"}
            </button>
          </>
        )}
      </SlideFooter>
    </>
  );
}

function ReadyRow({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{ background: "color-mix(in srgb, var(--green) 10%, var(--surface))" }}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--green)", color: "#fff" }}>
        <Check size={15} strokeWidth={3} />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-fg">{title}</p>
        <p className="text-[12px] text-fg-3">{body}</p>
      </div>
    </div>
  );
}

type CourseMode = "choose" | "photo" | "lms" | "manual";

function CoursesSlide({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const qc = useQueryClient();
  const semesters = useQuery({ queryKey: ["semesters"], queryFn: () => api.get<Semester[]>("/semesters") });
  const courses = useQuery({ queryKey: ["courses", null], queryFn: () => api.get<Course[]>("/courses") });
  const [mode, setMode] = useState<CourseMode>("choose");

  const semester = semesters.data?.[0] ?? null;
  const semesterCourses = (courses.data ?? []).filter((c) => semester && c.semesterId === semester.id);
  const added = semester ? semesterCourses : courses.data ?? [];

  const createCourse = useMutation({
    mutationFn: (req: CourseRequest) => api.post<Course>("/courses", req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setMode("choose");
    },
  });

  return (
    <>
      <SlideHeader title="Add your courses" body="Pick whichever is easiest. You can always add more later." />

      <div className="space-y-3 pb-4">
        {added.length > 0 && (
          <ReadyRow
            title={`${added.length} ${added.length === 1 ? "course" : "courses"} added`}
            body={added.map((c) => c.code || c.name).join(", ")}
          />
        )}

        {!semesters.isLoading && !semester && (
          <div className="rounded-xl border border-line px-4 py-3 text-[12.5px] leading-relaxed text-fg-2">
            Photo and manual setup need a semester first.{" "}
            <button type="button" onClick={onBack} className="font-semibold text-accent">
              Create semester
            </button>
          </div>
        )}

        {mode === "photo" && semester ? (
          <AutomaticSchedule semesterId={semester.id} onDone={() => setMode("choose")} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMode("photo")}
              disabled={!semester}
              className="card press block w-full p-4 text-left transition-colors hover:bg-surface-hi disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                <Camera size={15} className="text-accent" />
                Got a photo like this?
                <span className="badge badge-accent text-[10px]">Beta</span>
              </span>
              <span className="mt-1 block text-[12.5px] text-fg-2">
                Upload a screenshot of your class schedule and we'll build all your courses for you.
              </span>
              <span className="mt-3 block overflow-hidden rounded-xl border border-line bg-white p-1 shadow-sm">
                <img
                  src="/onboarding/schedule-example.png"
                  alt="Example of a weekly class schedule"
                  className="block h-28 w-full rounded-lg object-cover sm:h-44"
                  style={{ objectPosition: "50% 48%" }}
                />
              </span>
            </button>

            <div className="card p-4">
              <button
                type="button"
                onClick={() => setMode(mode === "lms" ? "choose" : "lms")}
                aria-expanded={mode === "lms"}
                className="flex w-full items-start gap-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                    <Globe size={15} className="text-accent" />
                    Use your school website
                  </span>
                  <span className="mt-1 block text-[12.5px] text-fg-2">Supported: Canvas, Brightspace, Moodle</span>
                </span>
                <ChevronDown
                  size={16}
                  className="mt-0.5 shrink-0 text-fg-3 transition-transform"
                  style={{ transform: mode === "lms" ? "rotate(180deg)" : undefined }}
                />
              </button>
              {mode === "lms" && (
                <div className="mt-4 space-y-3 animate-in">
                  <CanvasImportForm hideHints submitLabel="Import my courses" returnTo="/welcome?step=courses" />
                  <LmsLinkGuide />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMode("manual")}
              disabled={!semester}
              className="card press block w-full p-4 text-left transition-colors hover:bg-surface-hi disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                <PencilLine size={15} className="text-accent" />
                Manually
              </span>
              <span className="mt-1 block text-[12.5px] text-fg-2">Type in each course, its class times and room.</span>
            </button>
          </>
        )}
      </div>

      <SlideFooter>
        <button type="button" onClick={onBack} className="btn btn-ghost">
          Back
        </button>
        {added.length === 0 && <LaterButton onClick={onNext} />}
        <button type="button" onClick={onNext} className={`btn btn-primary ${added.length > 0 ? "ml-auto" : ""}`}>
          Next
          <ArrowRight size={14} />
        </button>
      </SlideFooter>

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
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => parse.mutate()} disabled={files.length === 0 || parse.isPending} className="btn btn-primary">
          <Camera size={13} />
          {parse.isPending ? "Reading your schedule…" : "Find my courses"}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost">
          Other options
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
    <div className="flex flex-col items-center text-center" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}>
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
