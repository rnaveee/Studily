import { AlertCircle, BookOpen, CheckCircle, XCircle, type LucideIcon } from "lucide-react";
import type { Grade, Problem, Verdict } from "./api";
import { Markdownish } from "./ChatThread";
import CitationChip from "./CitationChip";

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-fg-3";

const VERDICT_PILL: Record<Verdict, { label: string; className: string; Icon: LucideIcon }> = {
  CORRECT: { label: "Correct", className: "badge-green", Icon: CheckCircle },
  PARTIAL: { label: "Partly correct", className: "badge-yellow", Icon: AlertCircle },
  INCORRECT: { label: "Incorrect", className: "badge-red", Icon: XCircle },
};

const SOLUTION_PILL = { label: "Solution", className: "badge-accent", Icon: BookOpen };

const PILL_STYLE = { padding: "3px 10px", fontSize: 12 };

export default function ProblemCard({ problem }: { problem: Problem }) {
  return (
    <article aria-label={`Problem ${problem.number}`} className="chat-in card space-y-3 p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={LABEL}>Problem {problem.number}</span>
        {problem.fromClass && <span className="badge badge-accent">From your class</span>}
      </div>
      <div className="text-[14px] leading-relaxed text-fg">
        <Markdownish text={problem.statement} />
      </div>
      {problem.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {problem.sources.map((citation) => (
            <CitationChip
              key={`${citation.index}-${citation.fileId}-${citation.page ?? "x"}`}
              citation={citation}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export function GradeCard({ grade }: { grade: Grade }) {
  const revealed = grade.verdict === "INCORRECT" && grade.solution != null;
  const pill = revealed ? SOLUTION_PILL : VERDICT_PILL[grade.verdict];
  const { Icon } = pill;

  return (
    <section aria-label="Grade" className="chat-in card space-y-3 p-4 md:p-5">
      <span className={`badge ${pill.className}`} style={PILL_STYLE}>
        <Icon size={13} />
        {pill.label}
      </span>
      {grade.feedback && (
        <div className="text-[14px] leading-relaxed text-fg-2">
          <Markdownish text={grade.feedback} />
        </div>
      )}
      {grade.steps.length > 0 && (
        <div className="space-y-1.5">
          <div className={LABEL}>Steps</div>
          <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-fg-2 marker:text-fg-3">
            {grade.steps.map((step, index) => (
              <li key={index}>
                <Markdownish text={step} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {grade.solution && (
        <div className="rounded-xl p-3.5" style={{ background: "var(--surface-hi)" }}>
          <div className={`mb-1.5 ${LABEL}`}>Worked solution</div>
          <div className="text-[13.5px] leading-relaxed text-fg">
            <Markdownish text={grade.solution} />
          </div>
        </div>
      )}
    </section>
  );
}
