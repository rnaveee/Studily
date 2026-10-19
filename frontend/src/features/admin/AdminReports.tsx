import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../../lib/api";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import Avatar from "../../components/Avatar";
import { reasonTitle } from "../../lib/moderation";
import type { AdminPaged, AdminReport, AdminReportCase, AdminReportGroup, ReportReason } from "../../types";
import { ago } from "./AdminOverview";
import AccountStatusPill from "./AccountStatusPill";
import ModerationActionPanel from "./ModerationActionPanel";
import { LiftButton, ModerationHistory } from "./ModerationHistory";

export default function AdminReports() {
  const [openOnly, setOpenOnly] = useState(true);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const groupsQ = useQuery({
    queryKey: ["admin", "reports", openOnly ? "OPEN" : "ALL", page],
    queryFn: () =>
      api.get<AdminPaged<AdminReportGroup>>(
        `/admin/reports?status=${openOnly ? "OPEN" : "ALL"}&page=${page}&size=25`,
      ),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2" role="radiogroup" aria-label="Report filter">
        {[
          { open: true, label: "Open" },
          { open: false, label: "All" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={openOnly === o.open}
            className={`btn ${openOnly === o.open ? "btn-primary" : "btn-ghost"}`}
            onClick={() => {
              setOpenOnly(o.open);
              setPage(0);
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="card divide-y divide-line overflow-hidden">
        {groupsQ.data?.items.map((g) => (
          <button
            key={g.userId}
            type="button"
            onClick={() => setSelected(g.userId)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hi"
          >
            <Avatar name={g.name} username={g.username} avatarUrl={g.avatarUrl} size={36} className="text-[13px]" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-medium text-fg">@{g.username}</span>
                <AccountStatusPill status={g.status} banned={g.banned} suspendedUntil={g.suspendedUntil} />
                <span className="text-[12px] text-fg-3">
                  {g.openCount} open · {g.totalCount} total
                </span>
                <span className="ml-auto text-[11px] text-fg-3">{ago(g.latestAt)}</span>
              </div>
              {Object.keys(g.openReasons).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(g.openReasons).map(([reason, count]) => (
                    <span key={reason} className="badge badge-muted">
                      {reasonTitle(reason)} · {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>
        ))}
        {groupsQ.isLoading && <p className="p-4 text-[12px] text-fg-3">Loading…</p>}
        {groupsQ.data?.items.length === 0 && (
          <p className="p-4 text-[12px] text-fg-3">{openOnly ? "No open reports." : "No reports yet."}</p>
        )}
      </div>

      <div className="flex items-center gap-2 text-[12px]">
        <button className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Previous
        </button>
        <button className="btn btn-ghost" disabled={!groupsQ.data?.hasMore} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
        <span className="text-fg-3">{groupsQ.data?.total ?? 0} users</span>
      </div>

      {selected != null && <ReportDrawer userId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ReportDrawer({ userId, onClose }: { userId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [selection, setSelection] = useState<Record<number, boolean>>({});

  const caseQ = useQuery({
    queryKey: ["admin", "report-case", userId],
    queryFn: () => api.get<AdminReportCase>(`/admin/reports/users/${userId}`),
  });

  const data = caseQ.data;
  const isChecked = (r: AdminReport) => selection[r.id] ?? r.status === "OPEN";
  const selectedReports = data?.reports.filter(isChecked) ?? [];
  const openIds = selectedReports.filter((r) => r.status === "OPEN").map((r) => r.id);
  const defaultReasons = [...new Set(selectedReports.map((r) => r.reason))] as ReportReason[];
  const deletableMessageIds = [
    ...new Set(
      selectedReports
        .filter((r) => r.kind === "MESSAGE" && r.messageExists && r.messageId != null)
        .map((r) => r.messageId as number),
    ),
  ];

  const dismiss = useMutation({
    mutationFn: () => api.post<void>(`/admin/users/${userId}/reports/dismiss`, { reportIds: openIds }),
    onSuccess: () => {
      toast.success("Dismissed");
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
      qc.invalidateQueries({ queryKey: ["admin", "report-case", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  async function dismissSelected() {
    const ok = await confirm({
      title: "Dismiss selected reports?",
      message: `${openIds.length} open report${openIds.length === 1 ? "" : "s"} will be closed with no action taken.`,
      confirmLabel: "Dismiss",
    });
    if (ok) dismiss.mutate();
  }

  const user = data?.user;
  const restricted = !!user && (user.banned || user.status === "SUSPENDED");

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end animate-fade"
      style={{ background: "var(--scrim)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
    >
      <div
        className="h-full w-full max-w-lg overflow-y-auto p-5 animate-slide"
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--line)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-fg">{user ? `@${user.username}` : "Loading…"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-fg-2 hover:bg-surface-hi" aria-label="Close">
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        {data && user && (
          <div className="space-y-5">
            <div className="mt-3 flex items-start gap-3">
              <Avatar name={user.name} username={user.username} avatarUrl={data.avatarUrl} size={48} className="text-lg" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-[14px] font-medium text-fg">{user.name ?? "—"}</p>
                <AccountStatusPill status={user.status} banned={user.banned} suspendedUntil={user.suspendedUntil} />
                {data.bio && (
                  <p className="whitespace-pre-wrap text-[12px] text-fg-2 [overflow-wrap:anywhere]">{data.bio}</p>
                )}
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">Reports</h3>
              {data.reports.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  checked={isChecked(r)}
                  onToggle={() => setSelection((s) => ({ ...s, [r.id]: !isChecked(r) }))}
                />
              ))}
              {data.reports.length === 0 && <p className="text-[12px] text-fg-3">No reports.</p>}
            </section>

            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">History</h3>
              <ModerationHistory actions={data.actions} />
            </section>

            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">Take action</h3>
              <ModerationActionPanel
                userId={userId}
                username={user.username}
                defaultReasons={defaultReasons}
                reportIds={openIds}
                deletableMessageIds={deletableMessageIds}
                hasAvatar={!!data.avatarUrl}
                hasBio={!!data.bio && data.bio.trim().length > 0}
                onDone={() => setSelection({})}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={openIds.length === 0 || dismiss.isPending}
                  onClick={dismissSelected}
                >
                  Dismiss selected
                </button>
                {restricted && <LiftButton userId={userId} username={user.username} banned={user.banned} />}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function ReportCard({ report: r, checked, onToggle }: { report: AdminReport; checked: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg p-3 text-[12px]" style={{ background: "var(--surface-hi)" }}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select report ${r.id}`}
          className="mt-0.5"
          style={{ accentColor: "var(--accent)" }}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="badge badge-muted">{r.kind === "USER" ? "Profile" : "Message"}</span>
            <span className="font-medium text-fg">{reasonTitle(r.reason)}</span>
            <span className={`badge ${r.status === "OPEN" ? "badge-orange" : "badge-muted"}`}>{r.status}</span>
          </div>
          <p className="text-fg-3">
            by @{r.reporterUsername} · {ago(r.createdAt)}
          </p>
          {r.details && <p className="whitespace-pre-wrap text-fg-2 [overflow-wrap:anywhere]">{r.details}</p>}

          {r.kind === "MESSAGE" && (
            <div className="space-y-1 rounded-md border border-line p-2">
              {r.messageBody ? (
                <p className="whitespace-pre-wrap text-fg [overflow-wrap:anywhere]">{r.messageBody}</p>
              ) : (
                <p className="text-fg-3">No text</p>
              )}
              {r.attachmentFilename && (
                <p className="text-fg-3 [overflow-wrap:anywhere]">Attachment: {r.attachmentFilename}</p>
              )}
              <p className={r.messageExists ? "text-orange" : "text-fg-3"}>
                {r.messageExists ? "Still in chat" : "Message deleted"}
              </p>
            </div>
          )}

          {r.kind === "USER" && (r.targetNameSnapshot || r.targetBioSnapshot) && (
            <div className="space-y-0.5 rounded-md border border-line p-2">
              <p className="text-fg-3">At the time of the report</p>
              {r.targetNameSnapshot && <p className="text-fg [overflow-wrap:anywhere]">{r.targetNameSnapshot}</p>}
              {r.targetBioSnapshot && (
                <p className="whitespace-pre-wrap text-fg-2 [overflow-wrap:anywhere]">{r.targetBioSnapshot}</p>
              )}
            </div>
          )}

          {r.hasEvidence && <EvidenceImage reportId={r.id} />}

          {r.resolvedAt && (
            <p className="text-fg-3">
              Resolved {ago(r.resolvedAt)}
              {r.resolvedBy ? ` by ${r.resolvedBy}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EvidenceImage({ reportId }: { reportId: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    api
      .getBlob(`/admin/reports/${reportId}/evidence`)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [reportId]);

  if (failed) return <p className="text-fg-3">Evidence unavailable.</p>;
  if (!src) return <p className="text-fg-3">Loading evidence…</p>;
  return <img src={src} alt="Evidence" className="max-h-64 max-w-full rounded-md border border-line object-contain" />;
}
