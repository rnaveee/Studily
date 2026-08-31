import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Megaphone, ShieldPlus } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { toast } from "../../lib/toast";
import { useConfirm } from "../../lib/confirm";
import Toggle from "../../components/Toggle";
import type { AdminAuditRow, AdminHealth, AdminPaged, AdminTotpSetup } from "../../types";
import { ago } from "./AdminOverview";

export default function AdminOps() {
  return (
    <div className="space-y-4">
      <HealthPanel />
      <TwoFactorPanel />
      <BroadcastPanel />
      <AuditPanel />
    </div>
  );
}

function HealthPanel() {
  const healthQ = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => api.get<AdminHealth>("/admin/health"),
    refetchInterval: 30_000,
  });

  const h = healthQ.data;
  if (!h) return <div className="card p-4 text-[12px] text-fg-3">Loading health…</div>;

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">System</h2>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] md:grid-cols-3">
        <Item label="Database" value={`${h.dbLatencyMs}ms`} good={h.status === "ok"} />
        <Item label="DB size" value={h.dbSize} />
        <Item label="Schema" value={`V${h.schemaVersion}`} />
        <Item label="Heap" value={`${h.heapUsedMb} / ${h.heapMaxMb} MB`} />
        <Item label="Uptime" value={humanUptime(h.uptimeMs)} />
        <Item label="CPUs" value={String(h.availableProcessors)} />
        <Item label="Email" value={h.mailConfigured ? "configured" : "off"} good={h.mailConfigured} />
        <Item label="Web push" value={h.pushConfigured ? "configured" : "off"} good={h.pushConfigured} />
        <Item label="Sentry" value={h.sentryConfigured ? "configured" : "off"} good={h.sentryConfigured} />
        <Item label="Admin 2FA" value={h.totpEnabled ? "on" : "off"} good={h.totpEnabled} />
        <Item label="Timezone" value={h.timezone} />
        <Item label="Postgres" value={h.dbVersion.replace("PostgreSQL ", "")} />
      </div>
    </section>
  );
}

function Item({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-fg-3">{label}</span>
      <span
        className="truncate"
        style={{ color: good === undefined ? "var(--fg-2)" : good ? "var(--green)" : "var(--orange)" }}
      >
        {value}
      </span>
    </div>
  );
}

function TwoFactorPanel() {
  const [setup, setSetup] = useState<AdminTotpSetup | null>(null);

  const healthQ = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => api.get<AdminHealth>("/admin/health"),
  });

  const generate = useMutation({
    mutationFn: () => api.post<AdminTotpSetup>("/admin/totp/setup"),
    onSuccess: setSetup,
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't generate a secret"),
  });

  if (healthQ.data?.totpEnabled && !setup) {
    return (
      <section className="card p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Two-factor</h2>
        <p className="mt-2 text-[12px] text-fg-2">
          Enabled. Unlocking the dashboard needs your password and a code from your authenticator app.
        </p>
        <button className="btn btn-ghost mt-3" onClick={() => generate.mutate()}>
          <ShieldPlus size={13} strokeWidth={1.8} />
          Rotate secret
        </button>
        {setup && <SetupInstructions setup={setup} />}
      </section>
    );
  }

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Two-factor</h2>
      <p className="mt-2 text-[12px] text-fg-2">
        Right now this dashboard is protected by your password alone. Adding a TOTP code means a stolen
        password isn't enough to open it.
      </p>
      <button className="btn btn-primary mt-3" disabled={generate.isPending} onClick={() => generate.mutate()}>
        <ShieldPlus size={13} strokeWidth={1.8} />
        Generate a secret
      </button>
      {setup && <SetupInstructions setup={setup} />}
    </section>
  );
}

function SetupInstructions({ setup }: { setup: AdminTotpSetup }) {
  return (
    <div className="mt-4 space-y-3 text-[12px] animate-slide">
      <div>
        <label className="field-label">Secret</label>
        <div className="input select-all break-all font-mono">{setup.secret}</div>
      </div>
      <div>
        <label className="field-label">Or paste this into your authenticator app</label>
        <div className="input select-all break-all font-mono text-[11px]">{setup.provisioningUri}</div>
      </div>
      <ol className="list-decimal space-y-1 pl-4 text-fg-2">
        <li>Add the secret to 1Password, Authy, or Google Authenticator.</li>
        <li>
          Set <span className="font-mono text-fg">ADMIN_TOTP_SECRET</span> to it in your Railway variables.
        </li>
        <li>Redeploy. The next unlock will ask for a code.</li>
      </ol>
      <p style={{ color: "var(--orange)" }}>
        This secret is shown once and is not stored anywhere. Save it before you leave this page.
      </p>
    </div>
  );
}

function BroadcastPanel() {
  const confirm = useConfirm();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [onlyActive, setOnlyActive] = useState(true);

  const send = useMutation({
    mutationFn: () => api.post<{ recipients: number }>("/admin/broadcast", { title, body, url, onlyActive }),
    onSuccess: (res) => {
      toast.success(`Sent to ${res.recipients} ${res.recipients === 1 ? "person" : "people"}`);
      setTitle("");
      setBody("");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't send that"),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await confirm({
      title: "Send this to everyone?",
      message: `"${title}" goes out as an in-app notification and a push notification to ${
        onlyActive ? "everyone active in the last 30 days" : "every user"
      }. It can't be recalled.`,
      confirmLabel: "Send it",
      danger: true,
    });
    if (ok) send.mutate();
  }

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Announcement</h2>
      <form className="mt-3 space-y-3" onSubmit={submit}>
        <div>
          <label className="field-label">Title</label>
          <input
            className="input"
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Studily just got flashcard scheduling"
            required
          />
        </div>
        <div>
          <label className="field-label">Message</label>
          <textarea
            className="input"
            rows={2}
            maxLength={240}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Open Learn to try it out."
            required
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="field-label">Opens</label>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pb-1.5">
            <span className="text-[12px] text-fg-2">Active users only</span>
            <Toggle checked={onlyActive} onChange={setOnlyActive} />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={send.isPending}>
          <Megaphone size={13} strokeWidth={1.8} />
          {send.isPending ? "Sending…" : "Send announcement"}
        </button>
      </form>
    </section>
  );
}

function AuditPanel() {
  const [page, setPage] = useState(0);

  const auditQ = useQuery({
    queryKey: ["admin", "audit", page],
    queryFn: () => api.get<AdminPaged<AdminAuditRow>>(`/admin/audit?page=${page}&size=25`),
  });

  return (
    <section className="card overflow-hidden">
      <h2 className="p-4 pb-2 text-[13px] font-semibold uppercase tracking-wider text-fg-3">Audit log</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="text-fg-3">
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <Th>When</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>Detail</Th>
              <Th>IP</Th>
            </tr>
          </thead>
          <tbody>
            {auditQ.data?.items.map((row) => (
              <tr key={row.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <Td className="whitespace-nowrap text-fg-3">{ago(row.createdAt)}</Td>
                <Td>
                  <span className="font-mono text-fg">{row.action}</span>
                </Td>
                <Td className="text-fg-2">{row.target ?? "—"}</Td>
                <Td className="max-w-[320px] truncate font-mono text-fg-3">{row.detail ?? "—"}</Td>
                <Td className="font-mono text-fg-3">{row.ip ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {auditQ.data?.items.length === 0 && <p className="p-4 text-[12px] text-fg-3">Nothing logged yet.</p>}
      <div className="flex items-center gap-2 p-3 text-[12px]">
        <button className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <button className="btn btn-ghost" disabled={!auditQ.data?.hasMore} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
        <span className="text-fg-3">{auditQ.data?.total ?? 0} entries</span>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>;
}

function humanUptime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
