import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarSync, Copy } from "lucide-react";
import { api } from "../../lib/api";
import { useRequireAuth } from "../../lib/auth";
import { toast } from "../../lib/toast";
import type { CalendarFeedCreated, CalendarFeedStatus } from "../../types";

function ago(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CalendarFeedLink() {
  const qc = useQueryClient();
  const requireAuth = useRequireAuth();
  const [created, setCreated] = useState<CalendarFeedCreated | null>(null);
  const [confirmingNew, setConfirmingNew] = useState(false);

  const statusQ = useQuery({
    queryKey: ["calendar-feed"],
    queryFn: () => api.get<CalendarFeedStatus>("/calendar/feed-link"),
  });

  const create = useMutation({
    mutationFn: () => api.post<CalendarFeedCreated>("/calendar/feed-link"),
    onSuccess: (res) => {
      setCreated(res);
      setConfirmingNew(false);
      qc.invalidateQueries({ queryKey: ["calendar-feed"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create the link"),
  });

  const turnOff = useMutation({
    mutationFn: () => api.del<void>("/calendar/feed-link"),
    onSuccess: () => {
      setCreated(null);
      setConfirmingNew(false);
      qc.invalidateQueries({ queryKey: ["calendar-feed"] });
      toast.success("Calendar link turned off");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not turn off the link"),
  });

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to your clipboard");
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  }

  const status = statusQ.data;
  const busy = create.isPending || turnOff.isPending;

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
        <CalendarSync size={14} />
        Subscribe in your calendar app
      </div>
      <p className="mt-0.5 text-[12px] text-fg-3">
        Get your deadlines and events in Google or Apple Calendar. It stays up to date on its own.
      </p>

      {created ? (
        <div className="mt-3 space-y-2 animate-fade">
          <input
            className="input w-full"
            readOnly
            value={created.httpsUrl}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Calendar subscription link"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => copy(created.httpsUrl)} className="btn btn-primary">
              <Copy size={13} />
              Copy link
            </button>
            <a
              className="btn btn-soft"
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(created.webcalUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Add to Google Calendar
            </a>
            <a className="btn btn-soft" href={created.webcalUrl}>
              Add to Apple Calendar
            </a>
          </div>
          <p className="text-[11px] font-medium text-red">
            This link is shown once, so copy it now. Anyone who has it can see your deadlines and events.
            Keep it private.
          </p>
        </div>
      ) : !status?.exists ? (
        <div className="mt-3">
          <button
            onClick={() => requireAuth(() => create.mutate())}
            disabled={busy || statusQ.isLoading}
            className="btn btn-soft"
          >
            {create.isPending ? "Creating…" : "Create link"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-[12px] text-fg-2">
            Link active ·{" "}
            {status.lastFetchedAt ? `last used ${ago(status.lastFetchedAt)}` : "not used yet"}
          </p>
          {confirmingNew ? (
            <div className="rounded-lg p-3 animate-fade" style={{ background: "var(--surface-hi)" }}>
              <p className="text-[12px] text-fg-2">
                Your old link stops working right away, and you will need to subscribe again with the new one.
              </p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => create.mutate()} disabled={busy} className="btn btn-primary">
                  {create.isPending ? "Creating…" : "Get a new link"}
                </button>
                <button onClick={() => setConfirmingNew(false)} className="btn btn-ghost">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setConfirmingNew(true)} disabled={busy} className="btn btn-soft">
                Get a new link
              </button>
              <button onClick={() => turnOff.mutate()} disabled={busy} className="btn btn-danger">
                {turnOff.isPending ? "Turning off…" : "Turn off"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
