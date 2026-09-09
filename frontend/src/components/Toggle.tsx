export default function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-150 disabled:opacity-40"
      style={{
        background: checked ? "var(--accent)" : "var(--surface-hi)",
        boxShadow: checked ? "inset 0 1px 3px rgb(0 0 0 / 0.24)" : "var(--control-inset)",
      }}
    >
      <span
        className="absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full transition-transform duration-200"
        style={{
          transform: checked ? "translateX(16px)" : "translateX(0)",
          background: checked ? "#ffffff" : "var(--surface)",
          boxShadow: "var(--knob-shadow)",
          transitionTimingFunction: "cubic-bezier(0.34, 1.4, 0.64, 1)",
        }}
      />
    </button>
  );
}
