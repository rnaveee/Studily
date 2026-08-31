import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Play, Table2, Trash2 } from "lucide-react";
import { api, ApiError, getAdminToken, getToken } from "../../lib/api";
import { toast } from "../../lib/toast";
import { useConfirm } from "../../lib/confirm";
import Toggle from "../../components/Toggle";
import type { AdminQueryResult, AdminTableInfo, AdminTableRows } from "../../types";

export default function AdminDatabase() {
  const [mode, setMode] = useState<"browse" | "query">("browse");

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <ModeButton active={mode === "browse"} onClick={() => setMode("browse")}>
          Tables
        </ModeButton>
        <ModeButton active={mode === "query"} onClick={() => setMode("query")}>
          SQL console
        </ModeButton>
      </div>
      {mode === "browse" ? <TableBrowser /> : <SqlConsole />}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
        active ? "text-accent" : "text-fg-2 hover:bg-surface-hi hover:text-fg",
      ].join(" ")}
      style={active ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)" } : {}}
    >
      {children}
    </button>
  );
}

function TableBrowser() {
  const [table, setTable] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  const tablesQ = useQuery({
    queryKey: ["admin", "db", "tables"],
    queryFn: () => api.get<AdminTableInfo[]>("/admin/db/tables"),
  });

  const rowsQ = useQuery({
    queryKey: ["admin", "db", "rows", table, page, query],
    queryFn: () =>
      api.get<AdminTableRows>(
        `/admin/db/tables/${table}?page=${page}&size=25&q=${encodeURIComponent(query)}`,
      ),
    enabled: !!table,
  });

  async function download(name: string) {
    try {
      const res = await fetch(`/api/admin/db/tables/${name}/export`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "X-Admin-Token": getAdminToken() ?? "",
        },
      });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't export that table");
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-[220px_1fr]">
      <div className="card max-h-[70vh] overflow-y-auto p-2">
        {tablesQ.data?.map((t) => (
          <button
            key={t.name}
            onClick={() => {
              setTable(t.name);
              setPage(0);
              setSearch("");
              setQuery("");
            }}
            className={[
              "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors",
              table === t.name ? "text-accent" : "text-fg-2 hover:bg-surface-hi hover:text-fg",
            ].join(" ")}
            style={table === t.name ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)" } : {}}
          >
            <span className="truncate font-mono">{t.name}</span>
            <span className="shrink-0 text-[10px] text-fg-3">{t.rows}</span>
          </button>
        ))}
        {tablesQ.isLoading && <p className="p-2 text-[12px] text-fg-3">Loading…</p>}
      </div>

      <div className="min-w-0">
        {!table ? (
          <div className="card flex h-40 items-center justify-center text-[13px] text-fg-3">
            <Table2 size={15} strokeWidth={1.8} className="mr-2" />
            Pick a table
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <form
                className="flex min-w-[180px] flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(0);
                  setQuery(search);
                }}
              >
                <input
                  className="input"
                  placeholder={`Search ${table}`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button type="submit" className="btn btn-ghost shrink-0">
                  Find
                </button>
              </form>
              <button onClick={() => download(table)} className="btn btn-ghost shrink-0">
                <Download size={13} strokeWidth={1.8} />
                CSV
              </button>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-fg-3">
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      {rowsQ.data?.columns
                        .filter((c) => !c.binary)
                        .map((c) => (
                          <th
                            key={c.name}
                            className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium"
                          >
                            <span className={c.primaryKey ? "text-accent" : ""}>{c.name}</span>
                            <span className="ml-1 font-normal text-fg-3">{c.type}</span>
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsQ.data?.rows.map((row, i) => (
                      <tr
                        key={i}
                        onClick={() => rowsQ.data?.primaryKey && setEditing(row)}
                        className={`transition-colors hover:bg-surface-hi ${
                          rowsQ.data?.primaryKey ? "cursor-pointer" : ""
                        }`}
                        style={{ borderBottom: "1px solid var(--line)" }}
                      >
                        {rowsQ.data.columns
                          .filter((c) => !c.binary)
                          .map((c) => (
                            <td key={c.name} className="max-w-[260px] truncate px-3 py-2 text-fg-2">
                              {display(row[c.name])}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rowsQ.isLoading && <p className="p-3 text-[12px] text-fg-3">Loading…</p>}
              {rowsQ.data?.rows.length === 0 && <p className="p-3 text-[12px] text-fg-3">No rows.</p>}
            </div>

            <div className="flex items-center gap-2 text-[12px]">
              <button className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button
                className="btn btn-ghost"
                disabled={!rowsQ.data || (page + 1) * rowsQ.data.size >= rowsQ.data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
              <span className="text-fg-3">{rowsQ.data?.total ?? 0} rows</span>
              {rowsQ.data && !rowsQ.data.primaryKey && (
                <span className="text-fg-3">· no single-column primary key, so rows are read-only</span>
              )}
            </div>
          </div>
        )}
      </div>

      {editing && table && rowsQ.data?.primaryKey && (
        <RowEditor
          table={table}
          primaryKey={rowsQ.data.primaryKey}
          columns={rowsQ.data.columns}
          row={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RowEditor({
  table,
  primaryKey,
  columns,
  row,
  onClose,
}: {
  table: string;
  primaryKey: string;
  columns: AdminTableRows["columns"];
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const column of columns) {
      if (column.binary) continue;
      const value = row[column.name];
      initial[column.name] = value == null ? "" : String(value);
    }
    return initial;
  });
  const [nulls, setNulls] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const column of columns) {
      if (!column.binary) initial[column.name] = row[column.name] == null;
    }
    return initial;
  });

  const id = String(row[primaryKey]);

  const save = useMutation({
    mutationFn: () => {
      const changes: Record<string, unknown> = {};
      for (const column of columns) {
        if (column.binary || column.primaryKey) continue;
        const next = nulls[column.name] ? null : draft[column.name];
        const before = row[column.name] == null ? null : String(row[column.name]);
        if (next !== before) changes[column.name] = next;
      }
      if (Object.keys(changes).length === 0) {
        return Promise.reject(new ApiError(400, "Nothing changed"));
      }
      return api.put<{ rowsAffected: number }>(
        `/admin/db/tables/${table}/rows/${encodeURIComponent(id)}`,
        changes,
      );
    },
    onSuccess: () => {
      toast.success("Row updated");
      qc.invalidateQueries({ queryKey: ["admin", "db"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't save that row"),
  });

  async function remove() {
    const ok = await confirm({
      title: `Delete row ${primaryKey}=${id}?`,
      message: `This deletes the row from ${table} and anything that cascades from it. There is no undo.`,
      confirmLabel: "Delete row",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/admin/db/tables/${table}/rows/${encodeURIComponent(id)}`);
      toast.success("Row deleted");
      qc.invalidateQueries({ queryKey: ["admin", "db"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't delete that row");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade"
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-5 animate-in">
        <h2 className="text-[15px] font-semibold text-fg">
          <span className="font-mono">{table}</span>
          <span className="ml-2 text-[12px] font-normal text-fg-3">
            {primaryKey} = {id}
          </span>
        </h2>

        <div className="mt-4 space-y-3">
          {columns.map((column) => (
            <div key={column.name}>
              <label
                className="field-label"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
              >
                <span>
                  {column.name}
                  <span className="ml-1.5 normal-case tracking-normal text-fg-3">{column.type}</span>
                  {column.primaryKey && <span className="ml-1.5 text-accent">pk</span>}
                </span>
                {!column.binary && !column.primaryKey && column.nullable && (
                  <button
                    type="button"
                    onClick={() => setNulls((n) => ({ ...n, [column.name]: !n[column.name] }))}
                    className="normal-case tracking-normal"
                    style={{ color: nulls[column.name] ? "var(--accent)" : "var(--fg-3)" }}
                  >
                    null
                  </button>
                )}
              </label>
              {column.binary ? (
                <div className="input text-fg-3">binary, not editable here</div>
              ) : (
                <input
                  className="input font-mono"
                  value={nulls[column.name] ? "" : draft[column.name] ?? ""}
                  disabled={column.primaryKey || nulls[column.name]}
                  placeholder={nulls[column.name] ? "NULL" : ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [column.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger ml-auto" onClick={remove}>
            <Trash2 size={13} strokeWidth={1.8} />
            Delete row
          </button>
        </div>
      </div>
    </div>
  );
}

function SqlConsole() {
  const [sql, setSql] = useState("SELECT id, username, email, created_at FROM users ORDER BY id DESC LIMIT 20;");
  const [write, setWrite] = useState(false);
  const [result, setResult] = useState<AdminQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  const run = useMutation({
    mutationFn: () => api.post<AdminQueryResult>("/admin/db/query", { sql, write }),
    onSuccess: (res) => {
      setResult(res);
      setError(null);
    },
    onError: (e) => {
      setResult(null);
      setError(e instanceof ApiError ? e.message : "Query failed");
    },
  });

  async function submit() {
    if (write) {
      const ok = await confirm({
        title: "Run this in write mode?",
        message: "It can modify or delete data permanently. Every write is recorded in the audit log.",
        confirmLabel: "Run it",
        danger: true,
      });
      if (!ok) return;
    }
    run.mutate();
  }

  return (
    <div className="space-y-3">
      <div className="card p-3">
        <textarea
          className="input font-mono"
          rows={6}
          spellCheck={false}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={run.isPending} onClick={submit}>
            <Play size={13} strokeWidth={1.8} />
            {run.isPending ? "Running…" : "Run"}
          </button>
          <span className="text-[11px] text-fg-3">⌘/Ctrl + Enter</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px]" style={{ color: write ? "var(--red)" : "var(--fg-2)" }}>
              Write mode
            </span>
            <Toggle checked={write} onChange={setWrite} />
          </div>
        </div>
        {write && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--red)" }}>
            INSERT, UPDATE, DELETE and DDL will execute. DROP DATABASE and DROP SCHEMA stay blocked.
          </p>
        )}
      </div>

      {error && (
        <div className="card p-3 text-[12px]" style={{ color: "var(--red)" }}>
          {error}
        </div>
      )}

      {result && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-3 text-[11px] text-fg-3">
            <span className="badge badge-muted">{result.statementType.toUpperCase()}</span>
            <span>{result.millis}ms</span>
            {result.rowsAffected != null && <span>{result.rowsAffected} rows affected</span>}
            {result.rows.length > 0 && <span>{result.rows.length} rows returned</span>}
            {result.truncated && <span style={{ color: "var(--orange)" }}>truncated at 500 rows</span>}
          </div>
          {result.columns.length > 0 && (
            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 text-fg-3" style={{ background: "var(--surface)" }}>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    {result.columns.map((c) => (
                      <th key={c} className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                      {row.map((cell, j) => (
                        <td key={j} className="max-w-[280px] truncate px-3 py-2 font-mono text-fg-2">
                          {display(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function display(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}
