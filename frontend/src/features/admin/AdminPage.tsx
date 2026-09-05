import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Lock, RefreshCw } from "lucide-react";
import { api, ApiError, setAdminToken } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import BackButton from "../../components/BackButton";
import { toast } from "../../lib/toast";
import type { AdminStatus, AdminUnlockResponse } from "../../types";
import AdminOverview from "./AdminOverview";
import AdminUsers from "./AdminUsers";
import AdminDatabase from "./AdminDatabase";
import AdminOps from "./AdminOps";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "database", label: "Database" },
  { key: "ops", label: "Ops" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overview");

  const statusQ = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => api.get<AdminStatus>("/admin/status"),
    retry: false,
    refetchInterval: 60_000,
  });

  if (loading) return null;
  if (!user?.admin) return <Navigate to="/dashboard" replace />;

  const status = statusQ.data;

  function relock() {
    api.del("/admin/session").catch(() => {});
    setAdminToken(null);
    qc.removeQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["admin", "status"] });
  }

  return (
    <div className="stagger-children">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-semibold text-fg">Admin</h1>
        <span className="badge badge-accent">@{status?.username ?? user.username}</span>
        {status?.unlocked && (
          <button onClick={relock} className="btn btn-ghost ml-auto">
            <Lock size={13} strokeWidth={1.8} />
            Lock
          </button>
        )}
      </div>

      {!status ? (
        statusQ.isLoading ? (
          <p className="mt-6 text-[13px] text-fg-3">Checking…</p>
        ) : (
          <p className="mt-6 text-[13px] text-red">Couldn't reach the admin API.</p>
        )
      ) : !status.unlocked ? (
        <UnlockCard status={status} onUnlocked={() => qc.invalidateQueries({ queryKey: ["admin"] })} />
      ) : (
        <>
          <SessionBar expiresAt={status.expiresAt} totpEnabled={status.totpEnabled} />

          <div
            className="mt-4 flex gap-1 overflow-x-auto pb-1"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  "shrink-0 rounded-t-lg px-3 py-2 text-[13px] font-medium transition-colors",
                  tab === t.key ? "text-accent" : "text-fg-2 hover:text-fg",
                ].join(" ")}
                style={
                  tab === t.key
                    ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)" }
                    : {}
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === "overview" && <AdminOverview />}
            {tab === "users" && <AdminUsers />}
            {tab === "database" && <AdminDatabase />}
            {tab === "ops" && <AdminOps />}
          </div>
        </>
      )}
    </div>
  );
}

function SessionBar({ expiresAt, totpEnabled }: { expiresAt: string | null; totpEnabled: boolean }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = expiresAt ? new Date(expiresAt).getTime() - now : 0;
  const minutes = Math.max(0, Math.floor(left / 60000));
  const seconds = Math.max(0, Math.floor((left % 60000) / 1000));

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
      <span className="badge badge-green">
        <ShieldCheck size={11} strokeWidth={2} />
        Unlocked
      </span>
      <span className="text-fg-3">
        Session ends in {minutes}m {String(seconds).padStart(2, "0")}s
      </span>
      {!totpEnabled && (
        <span className="badge" style={{ background: "color-mix(in srgb, var(--orange) 12%, transparent)", color: "var(--orange)" }}>
          2FA off
        </span>
      )}
    </div>
  );
}

function UnlockCard({ status, onUnlocked }: { status: AdminStatus; onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const unlock = useMutation({
    mutationFn: () => api.post<AdminUnlockResponse>("/admin/session", { password, code }),
    onSuccess: (res) => {
      setAdminToken(res.token);
      setPassword("");
      setCode("");
      setError(null);
      onUnlocked();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't unlock"),
  });

  return (
    <div className="card mt-6 max-w-md p-5">
      <div className="flex items-center gap-2">
        <Lock size={15} strokeWidth={1.8} className="text-fg-2" />
        <h2 className="text-[15px] font-semibold text-fg">Locked</h2>
      </div>
      <p className="mt-1.5 text-[12px] text-fg-3">
        Re-enter your password{status.totpEnabled ? " and your authenticator code" : ""} to open the
        dashboard. The session lasts {Math.round(status.sessionMs / 60000)} minutes.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          unlock.mutate();
        }}
      >
        <div>
          <label className="field-label">Account password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
        </div>

        {status.totpEnabled && (
          <div>
            <label className="field-label">Authenticator code</label>
            <input
              className="input font-mono tracking-[0.3em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
        )}

        {error && <p className="text-xs text-red animate-fade">{error}</p>}

        <button type="submit" disabled={unlock.isPending} className="btn btn-primary w-full">
          {unlock.isPending ? "Unlocking…" : "Unlock"}
        </button>
      </form>

      {!status.totpEnabled && (
        <p className="mt-3 text-[11px] text-fg-3">
          Two-factor is off. Unlock, then open Ops to generate a secret and set{" "}
          <span className="font-mono text-fg-2">ADMIN_TOTP_SECRET</span>.
        </p>
      )}
    </div>
  );
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button onClick={onClick} className="btn btn-ghost" disabled={busy}>
      <RefreshCw size={13} strokeWidth={1.8} className={busy ? "animate-spin" : ""} />
      Refresh
    </button>
  );
}

export function useAdminError() {
  return (e: unknown, fallback: string) => {
    toast.error(e instanceof ApiError ? e.message : fallback);
  };
}
