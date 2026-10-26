import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import type { CanvasFeedResult, SchoolFeedList, SchoolFeedView } from "../../types";

const PROVIDER_LABELS: Record<string, string> = {
  CANVAS: "Canvas",
  D2L: "Brightspace",
  MOODLE: "Moodle",
};

function ago(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function FeedRow({ feed }: { feed: SchoolFeedView }) {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["school-feeds"] });
    qc.invalidateQueries({ queryKey: ["courses"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["calendar-events"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const sync = useMutation({
    mutationFn: () => api.post<CanvasFeedResult>(`/school-feeds/${feed.id}/sync`),
    onSuccess: (result) => {
      refreshAll();
      const changed = result.itemsImported + result.itemsUpdated + result.eventsImported;
      toast.success(changed > 0 ? `Synced · ${result.itemsImported} added` : "Already up to date");
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ["school-feeds"] });
      toast.error(e instanceof ApiError ? e.message : "Sync failed");
    },
  });

  const stop = useMutation({
    mutationFn: () => api.del(`/school-feeds/${feed.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-feeds"] });
      toast.success("Stopped syncing");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not stop syncing"),
  });

  const label = (feed.provider && PROVIDER_LABELS[feed.provider]) || "School calendar";

  return (
    <li className="rounded-lg p-3" style={{ border: "1px solid var(--line)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-fg">{label}</div>
          <div className="truncate text-[12px] text-fg-3">{feed.host}</div>
          {feed.enabled ? (
            <div className="mt-1 text-[12px] text-fg-3">
              {feed.lastSuccessAt ? `Last synced ${ago(feed.lastSuccessAt)}` : "Not synced yet"}
              {feed.lastError ? ` · Last try failed: ${feed.lastError}` : ""}
            </div>
          ) : (
            <div className="mt-1 text-[12px] text-fg-3">
              Sync stopped{feed.lastError ? `: ${feed.lastError.replace(/\.$/, "")}` : ""}. Paste your link again to restart.
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {feed.enabled && (
            <button
              className="btn btn-ghost"
              disabled={sync.isPending}
              onClick={() => sync.mutate()}
            >
              {sync.isPending ? "Syncing…" : "Sync now"}
            </button>
          )}
          <button
            className="btn btn-ghost"
            disabled={stop.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: "Stop syncing?",
                message: "Studily will forget this link. Items already imported stay in your planner.",
                confirmLabel: "Stop syncing",
                danger: true,
              });
              if (ok) stop.mutate();
            }}
          >
            Stop syncing
          </button>
        </div>
      </div>
    </li>
  );
}

export default function SchoolFeedsList() {
  const feedsQ = useQuery({
    queryKey: ["school-feeds"],
    queryFn: () => api.get<SchoolFeedList>("/school-feeds"),
  });

  const data = feedsQ.data;
  if (!data || !data.available || data.feeds.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="text-[12px] font-medium text-fg-2">Saved links</div>
      <ul className="mt-2 space-y-2">
        {data.feeds.map((feed) => (
          <FeedRow key={feed.id} feed={feed} />
        ))}
      </ul>
    </div>
  );
}
