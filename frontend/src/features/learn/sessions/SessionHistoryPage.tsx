import { Link } from "react-router-dom";
import { History } from "lucide-react";
import BackButton from "../../../components/BackButton";
import { SkeletonList } from "../../../components/Skeleton";
import { useProgressEnabled, useSessionHistory } from "../../progress/useProgress";
import SessionHistoryList from "./SessionHistoryList";

export default function SessionHistoryPage() {
  const enabled = useProgressEnabled();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 stagger-children">
      <div className="flex items-center gap-3">
        <BackButton fallback="/learn" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-fg">Study sessions</h1>
          <p className="mt-0.5 text-[13px] text-fg-3">Every session you've started, newest first.</p>
        </div>
      </div>
      {enabled ? (
        <HistoryBody />
      ) : (
        <div className="card p-8 text-center">
          <p className="text-[13px] leading-relaxed text-fg-3">Sign in to track your study sessions and streaks.</p>
          <Link to="/login" className="btn btn-primary mt-4">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}

function HistoryBody() {
  const history = useSessionHistory();
  const items = history.data?.pages.flatMap((p) => p.items) ?? [];

  if (history.isLoading) return <SkeletonList rows={6} />;

  if (history.isError && items.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-fg-3">Couldn't load your sessions.</p>
        <button onClick={() => history.refetch()} className="btn btn-soft mt-3 min-h-[40px]">
          Try again
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card p-10 text-center">
        <History className="mx-auto mb-2 text-fg-3" size={28} strokeWidth={1.5} />
        <p className="text-sm font-medium text-fg">No study sessions yet</p>
        <p className="mt-1 text-[12px] text-fg-3">Start one from Learn to build your streak and earn XP.</p>
        <Link to="/learn" className="btn btn-soft mt-4 min-h-[40px]">
          Go to Learn
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card px-4">
        <SessionHistoryList items={items} />
      </div>
      {history.hasNextPage && (
        <div className="flex justify-center">
          <button
            onClick={() => history.fetchNextPage()}
            disabled={history.isFetchingNextPage}
            className="btn btn-ghost min-h-[40px]"
          >
            {history.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
