import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { api } from "../../lib/api";
import type { AdminGrowthPoint, AdminOverview as Overview } from "../../types";

const RANGES = [7, 30, 90] as const;

export default function AdminOverview() {
  const [days, setDays] = useState<number>(30);

  const overviewQ = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => api.get<Overview>("/admin/overview"),
    refetchInterval: 60_000,
  });

  const growthQ = useQuery({
    queryKey: ["admin", "growth", days],
    queryFn: () => api.get<AdminGrowthPoint[]>(`/admin/growth?days=${days}`),
  });

  if (overviewQ.isLoading) return <p className="text-[13px] text-fg-3">Loading metrics…</p>;
  if (!overviewQ.data) return <p className="text-[13px] text-red">Couldn't load metrics.</p>;

  const { users, activity, funnel, content, schools, recentSignups } = overviewQ.data;

  return (
    <div className="space-y-6">
      <section>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total users" value={users.total} sub={`${users.verified} verified`} />
          <Stat
            label="Weekly active"
            value={activity.wau}
            delta={delta(activity.wau, activity.wauPrev)}
            sub={`${pct(activity.wau, users.total)} of all users`}
          />
          <Stat label="Daily active" value={activity.dau} sub={`${pct(activity.dau, users.total)} of all users`} />
          <Stat label="Monthly active" value={activity.mau} sub={`Stickiness ${(activity.stickiness * 100).toFixed(0)}%`} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="New today" value={users.newToday} />
          <Stat label="New this week" value={users.new7d} delta={delta(users.new7d, users.prev7d)} />
          <Stat label="New this month" value={users.new30d} />
          <Stat
            label="Never opened"
            value={activity.neverActive}
            sub={`${pct(activity.neverActive, users.total)} of signups`}
          />
        </div>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Activity</h2>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={[
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  days === r ? "text-accent" : "text-fg-3 hover:text-fg",
                ].join(" ")}
                style={days === r ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)" } : {}}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        {growthQ.data ? (
          <GrowthChart points={growthQ.data} />
        ) : (
          <p className="mt-3 text-[12px] text-fg-3">Loading…</p>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Activation funnel</h2>
          <div className="mt-3 space-y-2.5">
            {funnel.map((step) => (
              <div key={step.label}>
                <div className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="text-fg-2">{step.label}</span>
                  <span className="text-fg">
                    {step.count}
                    <span className="ml-1.5 text-fg-3">{(step.rate * 100).toFixed(0)}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-hi)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(step.rate * 100, 1)}%`, background: "var(--accent)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Schools</h2>
          <div className="mt-3 space-y-1.5">
            {schools.map((s) => (
              <div key={s.school} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="truncate text-fg-2">{s.school}</span>
                <span className="shrink-0 text-fg">{s.users}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">What people are creating</h2>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
          {content.map((c) => (
            <div key={c.label} className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="truncate text-fg-2">{c.label}</span>
              <span className="shrink-0 text-fg">
                {c.total.toLocaleString()}
                {c.last7d > 0 && <span className="ml-1.5 text-green">+{c.last7d}</span>}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-fg-3">Green numbers are the last 7 days.</p>
      </section>

      <section className="card overflow-hidden">
        <h2 className="p-4 pb-2 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
          Newest signups
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-fg-3">
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <Th>User</Th>
                <Th>Email</Th>
                <Th>School</Th>
                <Th>Joined</Th>
                <Th>Last seen</Th>
              </tr>
            </thead>
            <tbody>
              {recentSignups.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <Td>
                    <span className="text-fg">@{u.username}</span>
                    {!u.emailVerified && <span className="ml-1.5 text-[10px] text-orange">unverified</span>}
                  </Td>
                  <Td className="text-fg-2">{u.email}</Td>
                  <Td className="text-fg-2">{u.school ?? "—"}</Td>
                  <Td className="text-fg-3">{ago(u.createdAt)}</Td>
                  <Td className="text-fg-3">{u.lastActiveAt ? ago(u.lastActiveAt) : "never"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function GrowthChart({ points }: { points: AdminGrowthPoint[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.signups, p.messages, p.items)));
  const totalSignups = points.reduce((sum, p) => sum + p.signups, 0);
  const totalMessages = points.reduce((sum, p) => sum + p.messages, 0);

  return (
    <div className="mt-3">
      <div className="flex gap-4 text-[11px]">
        <Legend color="var(--accent)" label={`Signups (${totalSignups})`} />
        <Legend color="var(--green)" label={`Messages (${totalMessages})`} />
      </div>
      <div className="mt-2 flex h-32 items-end gap-[2px]">
        {points.map((p) => (
          <div key={p.date} className="group relative flex flex-1 items-end gap-[1px]" style={{ height: "100%" }}>
            <div
              className="flex-1 rounded-t-[2px]"
              style={{
                height: `${(p.signups / max) * 100}%`,
                minHeight: p.signups > 0 ? 2 : 0,
                background: "var(--accent)",
              }}
            />
            <div
              className="flex-1 rounded-t-[2px]"
              style={{
                height: `${(p.messages / max) * 100}%`,
                minHeight: p.messages > 0 ? 2 : 0,
                background: "var(--green)",
              }}
            />
            <div
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[10px] group-hover:block"
              style={{ background: "var(--fg)", color: "var(--bg)" }}
            >
              {p.date}: {p.signups} signups, {p.messages} messages
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-fg-3">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-fg-2">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  delta: change,
}: {
  label: string;
  value: number;
  sub?: string;
  delta?: number | null;
}) {
  return (
    <div className="card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-fg-3">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[22px] font-semibold leading-none text-fg">{value.toLocaleString()}</span>
        {change != null && change !== 0 && (
          <span
            className="flex items-center gap-0.5 text-[11px] font-medium"
            style={{ color: change > 0 ? "var(--green)" : "var(--red)" }}
          >
            {change > 0 ? <ArrowUp size={10} strokeWidth={2.5} /> : <ArrowDown size={10} strokeWidth={2.5} />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-[11px] text-fg-3">{sub}</div>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>;
}

function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function pct(part: number, whole: number): string {
  if (whole === 0) return "0%";
  return `${((part / whole) * 100).toFixed(0)}%`;
}

export function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
