interface SegmentedToggleProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
}

export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  className = "",
  disabled = false,
}: SegmentedToggleProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      className={`relative grid rounded-lg bg-surface-hi p-1 ${
        disabled ? "pointer-events-none opacity-50" : ""
      } ${className}`}
      style={{
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        boxShadow: "inset 2px 2px 5px var(--neu-lo), inset -1px -1px 2px var(--neu-hi)",
      }}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-md bg-surface transition-transform duration-200"
        style={{
          left: 4,
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-sm), inset 0 1px 0 var(--edge-hi)",
          transitionTimingFunction: "cubic-bezier(0.34, 1.32, 0.64, 1)",
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`relative z-10 rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors ${
            o.value === value ? "text-accent" : "text-fg-3 hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
