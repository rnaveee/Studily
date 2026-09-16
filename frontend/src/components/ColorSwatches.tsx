import { useId } from "react";
import { Check, Dices } from "lucide-react";
import { COURSE_COLORS, readableOn } from "../lib/courseColors";

export default function ColorSwatches({
  value,
  onChange,
  allowAuto = false,
  autoLabel = "Auto",
  allowCustom = true,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
  allowAuto?: boolean;
  autoLabel?: string;
  allowCustom?: boolean;
}) {
  const inputId = useId();
  const isPreset = value != null && COURSE_COLORS.includes(value.toLowerCase());
  const custom = value != null && !isPreset ? value : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowAuto && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={autoLabel}
          title={autoLabel}
          className={[
            "flex h-6 w-6 items-center justify-center rounded-full transition-transform",
            value == null ? "ring-2 ring-offset-2 ring-fg" : "hover:scale-110",
          ].join(" ")}
          style={{ background: "var(--fg-3)" }}
        >
          <Dices size={13} strokeWidth={2.5} color="#fff" />
        </button>
      )}

      {COURSE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`color ${c}`}
          className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
          style={{ background: c }}
        >
          {value?.toLowerCase() === c && (
            <Check size={12} strokeWidth={3} color={readableOn(c)} />
          )}
        </button>
      ))}

      {allowCustom && (
        <>
          <label
            htmlFor={inputId}
            aria-label="custom color"
            title="Custom color"
            className={[
              "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-line transition-transform hover:scale-110",
              custom ? "ring-2 ring-offset-2 ring-fg" : "",
            ].join(" ")}
            style={{
              background: custom
                ? custom
                : "conic-gradient(#ef4444, #f59e0b, #10b981, #0ea5e9, #8b5cf6, #ec4899, #ef4444)",
            }}
          >
            {custom && <Check size={12} strokeWidth={3} color={readableOn(custom)} />}
          </label>
          <input
            id={inputId}
            type="color"
            className="sr-only"
            value={custom ?? value ?? COURSE_COLORS[0]}
            onChange={(e) => onChange(e.target.value)}
          />
        </>
      )}
    </div>
  );
}
