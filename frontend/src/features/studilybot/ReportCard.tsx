import { AlertCircle, CheckCircle } from "lucide-react";
import { gradeColor } from "../../lib/grades";
import type { FeynmanReport } from "../feynman/feynmanApi";

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export default function ReportCard({ report }: { report: FeynmanReport }) {
  const score = clampPercent(report.score);
  const concepts = report.concepts ?? [];
  const strengths = report.strengths ?? [];
  const gaps = report.gaps ?? [];

  return (
    <section className="card space-y-5 p-5 md:p-6" aria-label="Session report">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">Your understanding</div>
          <div
            className="mt-1 font-mono text-[44px] font-bold leading-none tabular-nums"
            style={{ color: gradeColor(score) }}
          >
            {score}%
          </div>
        </div>
        {report.summary && <p className="max-w-md text-[13px] leading-relaxed text-fg-2">{report.summary}</p>}
      </div>

      {concepts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">By concept</h3>
          <ul className="space-y-3">
            {concepts.map((concept, i) => {
              const pct = clampPercent(concept.score);
              return (
                <li key={`${concept.concept}-${i}`}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 flex-wrap items-center gap-2 text-fg">
                      <span className="truncate">{concept.concept}</span>
                      {concept.didNotKnow && <span className="badge badge-yellow">Didn't know at first</span>}
                    </span>
                    <span className="shrink-0 font-mono text-[12px] text-fg-2 tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-hi)" }}>
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%`, background: gradeColor(pct) }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(strengths.length > 0 || gaps.length > 0) && (
        <div className="grid gap-5 md:grid-cols-2">
          {strengths.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">What you explained well</h3>
              <ul className="space-y-2">
                {strengths.map((item, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-fg-2">
                    <CheckCircle size={15} className="mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {gaps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">Gaps to work on</h3>
              <ul className="space-y-2.5">
                {gaps.map((gap, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-fg-2">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" style={{ color: "var(--orange)" }} />
                    <span>
                      <span className="font-semibold text-fg">{gap.concept}.</span> {gap.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
