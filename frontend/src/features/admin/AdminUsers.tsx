import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Search, X } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { toast } from "../../lib/toast";
import { useConfirm } from "../../lib/confirm";
import type { AdminPaged, AdminResetLink, AdminUserDetail, AdminUserRow } from "../../types";
import { ago } from "./AdminOverview";

const SORTS = [
  { key: "recent", label: "Newest" },
  { key: "active", label: "Last seen" },
  { key: "courses", label: "Most courses" },
  { key: "username", label: "A–Z" },
];

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const usersQ = useQuery({
    queryKey: ["admin", "users", query, sort, page],
    queryFn: () =>
      api.get<AdminPaged<AdminUserRow>>(
        `/admin/users?q=${encodeURIComponent(query)}&sort=${sort}&page=${page}&size=25`,
      ),
  });

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setQuery(search);
        }}
      >
        <div className="relative min-w-[200px] flex-1">
          <Search size={13} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
          <input
            className="input pl-8"
            placeholder="Search by username, email, name, school, or id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ width: "auto" }}
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(0);
          }}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-fg-3">
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <Th>ID</Th>
                <Th>User</Th>
                <Th>Email</Th>
                <Th>School</Th>
                <Th>Courses</Th>
                <Th>Joined</Th>
                <Th>Last seen</Th>
              </tr>
            </thead>
            <tbody>
              {usersQ.data?.items.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelected(u.id)}
                  className="cursor-pointer transition-colors hover:bg-surface-hi"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <Td className="font-mono text-fg-3">{u.id}</Td>
                  <Td>
                    <span className="text-fg">@{u.username}</span>
                    {u.name && <span className="ml-1.5 text-fg-3">{u.name}</span>}
                    {!u.emailVerified && <span className="ml-1.5 text-[10px] text-orange">unverified</span>}
                  </Td>
                  <Td className="text-fg-2">{u.email}</Td>
                  <Td className="text-fg-2">{u.school ?? "—"}</Td>
                  <Td className="text-fg-2">
                    {u.courses}
                    <span className="text-fg-3"> / {u.items} items</span>
                  </Td>
                  <Td className="text-fg-3">{ago(u.createdAt)}</Td>
                  <Td className="text-fg-3">{u.lastActiveAt ? ago(u.lastActiveAt) : "never"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {usersQ.isLoading && <p className="p-4 text-[12px] text-fg-3">Loading…</p>}
        {usersQ.data?.items.length === 0 && <p className="p-4 text-[12px] text-fg-3">No users matched.</p>}
      </div>

      <div className="flex items-center gap-2 text-[12px]">
        <button
          className="btn btn-ghost"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Previous
        </button>
        <button
          className="btn btn-ghost"
          disabled={!usersQ.data?.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
        <span className="text-fg-3">{usersQ.data?.total ?? 0} users</span>
      </div>

      {selected != null && <UserDrawer id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function UserDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const detailQ = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => api.get<AdminUserDetail>(`/admin/users/${id}`),
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin", "user", id] });
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  const action = useMutation({
    mutationFn: async (kind: string) => {
      switch (kind) {
        case "verify":
          return api.post<void>(`/admin/users/${id}/verify-email?verified=true`);
        case "unverify":
          return api.post<void>(`/admin/users/${id}/verify-email?verified=false`);
        case "revoke":
          return api.post<void>(`/admin/users/${id}/revoke-sessions`);
        default:
          throw new Error("unknown");
      }
    },
    onSuccess: () => {
      toast.success("Done");
      refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "That didn't work"),
  });

  const link = useMutation({
    mutationFn: (kind: "reset-link" | "verify-link") =>
      api.post<AdminResetLink>(`/admin/users/${id}/${kind}`),
    onSuccess: async (res) => {
      try {
        await navigator.clipboard.writeText(res.url);
        toast.success("Link copied to your clipboard");
      } catch {
        toast.info(res.url);
      }
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't make a link"),
  });

  async function remove() {
    const user = detailQ.data?.user;
    const ok = await confirm({
      title: `Delete @${user?.username}?`,
      message: "This erases their courses, schedule, messages and everything else. There is no undo.",
      confirmLabel: "Delete forever",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/admin/users/${id}`);
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete that user");
    }
  }

  const detail = detailQ.data;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="h-full w-full max-w-md overflow-y-auto p-5 animate-slide"
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--line)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">
              {detail ? `@${detail.user.username}` : "Loading…"}
            </h2>
            {detail && <p className="text-[12px] text-fg-2">{detail.user.email}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-fg-2 hover:bg-surface-hi">
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        {detail && (
          <>
            <dl className="mt-4 space-y-1.5 text-[12px]">
              <Row label="ID" value={String(detail.user.id)} mono />
              <Row label="Name" value={detail.user.name ?? "—"} />
              <Row label="School" value={detail.user.school ?? "—"} />
              <Row label="Year" value={detail.year != null ? String(detail.year) : "—"} />
              <Row label="Major" value={detail.major ?? "—"} />
              <Row label="Verified" value={detail.user.emailVerified ? "yes" : "no"} />
              <Row label="Joined" value={new Date(detail.user.createdAt).toLocaleString()} />
              <Row
                label="Last seen"
                value={detail.user.lastActiveAt ? new Date(detail.user.lastActiveAt).toLocaleString() : "never"}
              />
              <Row label="Token version" value={String(detail.tokenVersion)} mono />
            </dl>

            <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Their data</h3>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
              {Object.entries(detail.counts).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2">
                  <span className="text-fg-2">{humanize(key)}</span>
                  <span className="text-fg">{value}</span>
                </div>
              ))}
            </div>

            <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">
              Support actions
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="btn btn-ghost"
                disabled={action.isPending}
                onClick={() => action.mutate(detail.user.emailVerified ? "unverify" : "verify")}
              >
                {detail.user.emailVerified ? "Mark unverified" : "Force verify email"}
              </button>
              <button className="btn btn-ghost" disabled={link.isPending} onClick={() => link.mutate("reset-link")}>
                <Copy size={13} strokeWidth={1.8} />
                Password reset link
              </button>
              <button className="btn btn-ghost" disabled={link.isPending} onClick={() => link.mutate("verify-link")}>
                <Copy size={13} strokeWidth={1.8} />
                Verify email link
              </button>
              <button className="btn btn-ghost" disabled={action.isPending} onClick={() => action.mutate("revoke")}>
                Sign out all devices
              </button>
              <button className="btn btn-danger" onClick={remove}>
                Delete account
              </button>
            </div>

            <p className="mt-3 text-[11px] text-fg-3">
              Links are single-use and copied straight to your clipboard, so you can paste one into a
              support reply without emailing the user.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-3">{label}</dt>
      <dd className={`truncate text-fg-2 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function humanize(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
