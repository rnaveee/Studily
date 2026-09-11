import { Repeat } from "lucide-react";
import type { SeriesScope } from "../../types";

export default function ScopeChoice({
  label,
  scope,
  onChange,
}: {
  label: string | null;
  scope: SeriesScope;
  onChange: (scope: SeriesScope) => void;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-accent">
        <Repeat size={12} strokeWidth={2} />
        {label ?? "Part of a repeating series"}
      </div>
      <div className="mt-2 flex flex-col gap-1 text-[13px] text-fg-2">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={scope === "OCCURRENCE"}
            onChange={() => onChange("OCCURRENCE")}
          />
          This occurrence only
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={scope === "SERIES"}
            onChange={() => onChange("SERIES")}
          />
          All occurrences
        </label>
      </div>
    </div>
  );
}
