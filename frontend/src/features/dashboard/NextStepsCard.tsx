import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, X } from "lucide-react";
import type { NextStep } from "./useNextSteps";

export default function NextStepsCard({
  steps,
  onDismiss,
}: {
  steps: NextStep[];
  onDismiss: (key: string) => void;
}) {
  if (steps.length === 0) return null;
  return (
    <div className="card p-3 animate-in">
      <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-fg-3">
        <Sparkles size={12} className="text-accent" />
        Try next
      </p>
      <div className="grid gap-x-4 md:grid-cols-2">
        {steps.map((s) => (
          <div key={s.key} className="flex items-center gap-1">
            <Link
              to={s.to}
              className="press flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-surface-hi"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-fg">{s.title}</span>
                <span className="block truncate text-[12px] text-fg-3">{s.detail}</span>
              </span>
              <ArrowRight size={14} className="shrink-0 text-accent" />
            </Link>
            <button
              onClick={() => onDismiss(s.key)}
              aria-label={`Dismiss suggestion: ${s.title}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg-3 transition-colors hover:text-fg"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
