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
        boxShadow: checked
          ? "inset 0 1px 3px rgb(0 0 0 / 0.28)"
          : "inset 2px 2px 5px var(--neu-lo), inset -1px -1px 2px var(--neu-hi)",
      }}
    >
      <span
        className="absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full transition-transform duration-200"
        style={{
          transform: checked ? "translateX(16px)" : "translateX(0)",
          background: checked ? "#ffffff" : "var(--surface)",
          boxShadow: "0 1px 3px var(--neu-lo), 0 1px 1px rgb(0 0 0 / 0.12), inset 0 1px 0 var(--edge-hi)",
          transitionTimingFunction: "cubic-bezier(0.34, 1.4, 0.64, 1)",
        }}
      />
    </button>
  );
}
