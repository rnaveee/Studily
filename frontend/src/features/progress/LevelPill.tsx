const SIZES = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-0.5 text-[12px]",
  lg: "px-3 py-1 text-[14px]",
} as const;

export default function LevelPill({ level, size = "md" }: { level: number; size?: keyof typeof SIZES }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-semibold tabular-nums ${SIZES[size]}`}
      style={{
        background: "color-mix(in srgb, var(--accent) 13%, transparent)",
        color: "var(--accent)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent)",
      }}
      aria-label={`Level ${level}`}
    >
      Lv {level}
    </span>
  );
}
