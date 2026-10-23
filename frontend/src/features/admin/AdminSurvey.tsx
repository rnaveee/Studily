import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type {
  AdminPaged,
  AdminSurveyContact,
  AdminSurveyCount,
  AdminSurveyMatrixRow,
  AdminSurveyQuestion,
  AdminSurveySummary,
  AdminSurveyText,
} from "../../types";

const STEP_TITLES = ["About you", "Features", "Problems", "What's next", "Overall"];

const MATRIX_COLORS = [
  "var(--accent)",
  "color-mix(in srgb, var(--accent) 50%, var(--surface-hi))",
  "color-mix(in srgb, var(--fg-3) 70%, var(--surface-hi))",
  "color-mix(in srgb, var(--fg-3) 40%, var(--surface-hi))",
  "color-mix(in srgb, var(--fg-3) 18%, var(--surface-hi))",
];

export default function AdminSurvey() {
  const summaryQ = useQuery({
    queryKey: ["admin", "survey", "summary"],
    queryFn: () => api.get<AdminSurveySummary>("/admin/survey/summary"),
    refetchInterval: 60_000,
  });

  if (summaryQ.isLoading) return <p className="text-[13px] text-fg-3">Loading feedback…</p>;
  const s = summaryQ.data;
  if (!s) return <p className="text-[13px] text-red">Couldn't load feedback.</p>;

  const rate = s.eligible > 0 ? `${Math.round((s.responses / s.eligible) * 100)}% of ${s.eligible} eligible` : undefined;
  const choice = s.questions.filter((q) => q.type !== "TEXT" && q.type !== "MATRIX");
  const matrix = s.questions.find((q) => q.type === "MATRIX");
  const texts = s.questions.filter((q) => q.type === "TEXT");

  if (s.responses === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Responses" value="0" sub={s.eligible > 0 ? `${s.eligible} eligible` : undefined} />
        </div>
        <p className="text-[13px] text-fg-3">No responses yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Responses" value={s.responses.toLocaleString()} sub={rate} />
        <Stat
          label="Very disappointed"
          value={fmtPct(s.pmfAll)}
          sub={`${s.pmfAllBase} answered · 40% is product-market fit`}
        />
        <Stat label="Among weekly+ users" value={fmtPct(s.pmfWeekly)} sub={`${s.pmfWeeklyBase} answered`} />
        <Stat label="NPS" value={s.nps == null ? "–" : String(s.nps)} sub={`${s.npsBase} answered`} />
        <Stat label="Ease of use" value={s.avgEase == null ? "–" : `${s.avgEase} / 5`} />
      </section>

      {matrix?.matrix && <MatrixCard question={matrix} />}

      {[1, 2, 3, 4, 5].map((step) => {
        const list = choice.filter((q) => q.step === step);
        if (list.length === 0) return null;
        return (
          <section key={step}>
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
              {STEP_TITLES[step - 1]}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((q) => (
                <BarsCard key={q.id} question={q} />
              ))}
            </div>
          </section>
        );
      })}

      <TextAnswers questions={texts} />
      <Contacts />
    </div>
  );
}

function fmtPct(value: number | null): string {
  return value == null ? "–" : `${value}%`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-fg-3">{label}</div>
      <div className="mt-1">
        <span className="text-[22px] font-semibold leading-none text-fg">{value}</span>
      </div>
      {sub && <div className="mt-1 text-[11px] text-fg-3">{sub}</div>}
    </div>
  );
}

function BarsCard({ question }: { question: AdminSurveyQuestion }) {
  const total = question.counts.reduce((sum, c) => sum + c.count, 0);
  const max = Math.max(1, ...question.counts.map((c) => c.count));

  return (
    <div className="card p-4">
      <h3 className="text-[13px] font-medium text-fg">{question.prompt.replace("{names}", "these")}</h3>
      <p className="mt-0.5 text-[11px] text-fg-3">
        {question.respondents} {question.respondents === 1 ? "respondent" : "respondents"}
      </p>
      <div className="mt-3 space-y-2">
        {question.counts.map((c) => (
          <Bar key={c.label} count={c} total={total} max={max} />
        ))}
      </div>
    </div>
  );
}

function Bar({ count, total, max }: { count: AdminSurveyCount; total: number; max: number }) {
  const share = total > 0 ? Math.round((count.count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="min-w-0 text-fg-2">{count.label}</span>
        <span className="shrink-0 text-fg tabular-nums">
          {count.count}
          <span className="ml-1.5 text-fg-3">{share}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-hi)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${count.count > 0 ? Math.max((count.count / max) * 100, 1.5) : 0}%`, background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}

function MatrixCard({ question }: { question: AdminSurveyQuestion }) {
  const rows = question.matrix ?? [];
  const columns = rows[0]?.counts.map((c) => c.label) ?? [];

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Feature usage</h2>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {columns.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5 text-[11px] text-fg-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: MATRIX_COLORS[i] }} />
            {c}
          </span>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <MatrixLine key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

function MatrixLine({ row }: { row: AdminSurveyMatrixRow }) {
  const total = row.counts.reduce((sum, c) => sum + c.count, 0);
  const active = (row.counts[0]?.count ?? 0) + (row.counts[1]?.count ?? 0);
  const unaware = row.counts[4]?.count ?? 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12px]">
        <span className="text-fg-2">{row.label}</span>
        <span className="text-fg-3 tabular-nums">
          <span className="text-fg">{pct(active)}%</span> use · {pct(unaware)}% didn't know
        </span>
      </div>
      <div
        className="mt-1 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        style={{ background: "var(--surface-hi)" }}
      >
        {row.counts.map((c, i) =>
          c.count > 0 ? (
            <div
              key={c.label}
              title={`${c.label}: ${c.count} (${pct(c.count)}%)`}
              style={{ width: `${(c.count / total) * 100}%`, background: MATRIX_COLORS[i] }}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}

function TextAnswers({ questions }: { questions: AdminSurveyQuestion[] }) {
  const withAnswers = questions.filter((q) => q.respondents > 0);
  const [id, setId] = useState<string>(withAnswers[0]?.id ?? questions[0]?.id ?? "");
  const [page, setPage] = useState(0);

  const textQ = useQuery({
    queryKey: ["admin", "survey", "text", id, page],
    queryFn: () => api.get<AdminPaged<AdminSurveyText>>(`/admin/survey/text?question=${id}&page=${page}`),
    enabled: !!id,
  });

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">Written answers</h2>
        <select
          className="input w-auto max-w-full"
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setPage(0);
          }}
          aria-label="Question"
        >
          {questions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.prompt} ({q.respondents})
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 space-y-3">
        {textQ.isLoading && <p className="text-[12px] text-fg-3">Loading…</p>}
        {textQ.data?.items.length === 0 && <p className="text-[12px] text-fg-3">No answers yet.</p>}
        {textQ.data?.items.map((a, i) => (
          <div key={`${a.username}-${i}`} className="rounded-xl p-3" style={{ background: "var(--surface-hi)" }}>
            <p className="whitespace-pre-wrap break-words text-[13px] text-fg">{a.value}</p>
            <p className="mt-1.5 text-[11px] text-fg-3">
              {a.username} · {new Date(a.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
      {textQ.data && (page > 0 || textQ.data.hasMore) && (
        <div className="mt-3 flex items-center justify-between">
          <button type="button" className="btn btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Newer
          </button>
          <span className="text-[11px] text-fg-3">
            Page {page + 1} · {textQ.data.total} total
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!textQ.data.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Older
          </button>
        </div>
      )}
    </section>
  );
}

function Contacts() {
  const contactsQ = useQuery({
    queryKey: ["admin", "survey", "contacts"],
    queryFn: () => api.get<AdminSurveyContact[]>("/admin/survey/contacts"),
  });
  const contacts = contactsQ.data ?? [];

  return (
    <section className="card p-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg-3">
        Open to a follow-up ({contacts.length})
      </h2>
      <div className="mt-3 space-y-1.5">
        {contacts.length === 0 && <p className="text-[12px] text-fg-3">Nobody yet.</p>}
        {contacts.map((c) => (
          <div key={c.email} className="flex flex-wrap items-center justify-between gap-x-3 text-[12px]">
            <span className="text-fg-2">{c.username}</span>
            <span className="text-fg">
              {c.email}
              <span className="ml-1.5 text-fg-3">{new Date(c.createdAt).toLocaleDateString()}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
