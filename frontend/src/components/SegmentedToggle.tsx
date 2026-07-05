interface SegmentedToggleProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedToggleProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      className={`relative grid rounded-lg bg-surface-hi p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-md bg-surface shadow-sm transition-transform duration-200 ease-out"
        style={{
          left: 4,
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
          border: "1px solid var(--line)",
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
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
