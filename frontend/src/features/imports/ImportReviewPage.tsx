import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Inbox } from "lucide-react";
import BackButton from "../../components/BackButton";
import QueryError from "../../components/QueryError";
import { api, ApiError } from "../../lib/api";
import { toast } from "../../lib/toast";
import type {
  ApplyRequest,
  ApplyResult,
  CourseDecision,
  FeedImportView,
  ImportConflict,
  ItemDecision,
} from "../../types";
import ConflictSolver from "./ConflictSolver";
import CourseConfirmModal from "./CourseConfirmModal";
import { providerLabel } from "./stagedSummary";

type Step = "courses" | "conflicts" | "done";

function addAllItems(view: FeedImportView, decisions: CourseDecision[]): ItemDecision[] {
  const skipped = new Set(decisions.filter((d) => d.decision === "SKIP").map((d) => d.key));
  return view.courses
    .filter((c) => !skipped.has(c.key))
    .flatMap((c) => c.items.map((item) => ({ key: item.key, decision: "ADD" as const })));
}

function resultText(result: ApplyResult): string {
  const parts: string[] = [];
  const courses = result.coursesCreated + result.coursesMerged;
  if (result.coursesCreated > 0) parts.push(`${result.coursesCreated} course${result.coursesCreated === 1 ? "" : "s"} added`);
  if (result.coursesMerged > 0) parts.push(`${result.coursesMerged} merged`);
  if (result.itemsAdded > 0) parts.push(`${result.itemsAdded} deadline${result.itemsAdded === 1 ? "" : "s"} added`);
  if (result.itemsReplaced > 0) parts.push(`${result.itemsReplaced} replaced`);
  if (parts.length === 0) return courses === 0 && result.itemsSkipped > 0 ? "Skipped. Nothing was added." : "Nothing new to add";
  return parts.join(" · ");
}

export default function ImportReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("courses");
  const [open, setOpen] = useState(true);
  const [courseDecisions, setCourseDecisions] = useState<CourseDecision[]>([]);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const autoApplied = useRef(false);

  const { data: view, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["feed-import", id],
    queryFn: () => api.get<FeedImportView>(`/imports/${id}`),
    retry: false,
  });

  const apply = useMutation({
    mutationFn: (req: ApplyRequest) => api.post<ApplyResult>(`/imports/${id}/apply`, req),
    onSuccess: (result) => {
      setStep("done");
      for (const key of ["courses", "calendar", "calendar-events", "dashboard", "feed-import", "notifications"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      toast.success(resultText(result));
      navigate(returnTo ?? "/calendar", { replace: true });
    },
    onError: (e) => {
      setStep("courses");
      setOpen(true);
      toast.error(e instanceof ApiError ? e.message : "Could not add that import");
    },
  });

  const dismiss = useMutation({
    mutationFn: () => api.post<void>(`/imports/${id}/dismiss`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["feed-import", id] });
      navigate(returnTo ?? "/dashboard", { replace: true });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not dismiss that import"),
  });

  function applyImport(decisions: CourseDecision[], itemDecisions: ItemDecision[]) {
    apply.mutate({ courses: decisions, items: itemDecisions });
  }

  const findConflicts = useMutation({
    mutationFn: (decisions: CourseDecision[]) =>
      api.post<ImportConflict[]>(`/imports/${id}/conflicts`, { courses: decisions }),
    onSuccess: (found, decisions) => {
      if (!view) return;
      if (found.length === 0) {
        applyImport(decisions, addAllItems(view, decisions));
        return;
      }
      setConflicts(found);
      setStep("conflicts");
    },
    onError: (e) => {
      setStep("courses");
      setOpen(true);
      toast.error(e instanceof ApiError ? e.message : "Could not check your deadlines");
    },
  });

  function coursesDecided(decisions: CourseDecision[]) {
    if (!view) return;
    setCourseDecisions(decisions);
    findConflicts.mutate(decisions);
  }

  function conflictsSolved(solved: ItemDecision[]) {
    if (!view) return;
    const byKey = new Map(solved.map((d) => [d.key, d]));
    const merged = addAllItems(view, courseDecisions).map((d) => byKey.get(d.key) ?? d);
    applyImport(courseDecisions, merged);
  }

  function cancelConflicts() {
    setStep("courses");
    setOpen(false);
  }

  const needsReview = view?.courses.some((c) => c.linkedCourseId == null) ?? false;

  useEffect(() => {
    if (!view || view.status !== "PENDING" || needsReview || autoApplied.current) return;
    if (view.courses.length === 0) return;
    autoApplied.current = true;
    coursesDecided([]);
  }, [view, needsReview]);

  if (isLoading) {
    return <div className="card p-6 text-center text-[13px] text-fg-3">Loading your import…</div>;
  }
  if (isError || !view) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="space-y-4">
          <BackButton fallback="/dashboard" />
          <div className="card p-6 text-center text-[13px] text-fg-3">That import could not be found.</div>
        </div>
      );
    }
    return <QueryError onRetry={() => refetch()} />;
  }

  if (step === "conflicts" && conflicts.length > 0) {
    return (
      <ConflictSolver
        conflicts={conflicts}
        providerName={providerLabel(view.provider)}
        courseCodes={Object.fromEntries(view.courses.map((c) => [c.key, c.code ?? c.name]))}
        busy={apply.isPending}
        onDone={conflictsSolved}
        onCancel={cancelConflicts}
      />
    );
  }

  const itemCount = view.courses.reduce((n, c) => n + c.items.length, 0);

  if (view.status !== "PENDING") {
    return (
      <div className="space-y-4">
        <BackButton fallback="/dashboard" />
        <div className="card space-y-3 p-8 text-center">
          <Inbox size={22} className="mx-auto text-fg-3" />
          <p className="text-[14px] font-medium text-fg">
            {view.status === "APPLIED" ? "This import was already added." : "This import was dismissed."}
          </p>
          <Link to="/calendar" className="btn btn-soft">
            Go to calendar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton fallback="/dashboard" />
        <h1 className="text-xl font-semibold text-fg">New from {providerLabel(view.provider)}</h1>
      </div>

      <div className="card space-y-3 p-6 text-center">
        <Inbox size={22} className="mx-auto text-accent" />
        <p className="text-[14px] font-medium text-fg">
          {view.courses.length} course{view.courses.length === 1 ? "" : "s"} and {itemCount} deadline
          {itemCount === 1 ? "" : "s"} are waiting for your review
        </p>
        <p className="mx-auto max-w-sm text-[12.5px] leading-relaxed text-fg-3">
          Nothing is added until you confirm. Your own courses and grades stay as they are.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {needsReview && !apply.isPending && !findConflicts.isPending && (
            <button type="button" className="btn btn-checkin" onClick={() => setOpen(true)}>
              {step === "courses" && courseDecisions.length === 0 ? "Review courses" : "Resume review"}
            </button>
          )}
          {!needsReview && !apply.isPending && !findConflicts.isPending && (
            <button type="button" className="btn btn-checkin" onClick={() => coursesDecided([])}>
              Review deadlines
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => navigate(returnTo ?? "/dashboard")}>
            Not now
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={dismiss.isPending || apply.isPending || findConflicts.isPending}
            onClick={() => dismiss.mutate()}
          >
            Dismiss import
          </button>
        </div>
      </div>

      {step === "courses" && needsReview && open && (
        <CourseConfirmModal
          view={view}
          busy={apply.isPending || findConflicts.isPending}
          onDone={coursesDecided}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
