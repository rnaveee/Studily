import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatTime12, fromMinutes, parseTime } from "../lib/time";

const STEP_MINUTES = 15;

function buildPresets(firstHour: number, lastHour: number, extra: string[] = []): string[] {
  const out: string[] = [];
  for (let m = firstHour * 60; m <= lastHour * 60; m += STEP_MINUTES) {
    out.push(fromMinutes(m));
  }
  for (const t of extra) {
    if (!out.includes(t)) out.push(t);
  }
  return out.sort();
}

export const CLASS_PRESETS = buildPresets(7, 22);
export const DAY_PRESETS = buildPresets(0, 23, ["23:59"]);

function digitsOf(text: string): string {
  return text.replace(/\D/g, "");
}

export default function TimeSelect({
  value,
  onChange,
  label,
  className = "",
  presets = CLASS_PRESETS,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
  presets?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const display = formatTime12(value);
  const editing = open && text !== "";

  const options = useMemo(() => {
    const all = presets.includes(value) ? presets : [...presets, value].sort();
    const typed = digitsOf(text);
    const parsed = editing ? parseTime(text) : null;
    let list = all;
    if (typed) {
      const filtered = all.filter((p) => digitsOf(formatTime12(p)).startsWith(typed));
      if (filtered.length > 0) list = filtered;
    }
    if (parsed && !list.includes(parsed)) list = [parsed, ...list];
    return list;
  }, [text, editing, presets, value]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      if (text) commitTyped();
      else setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });

  useEffect(() => {
    if (!open) return;
    const target = editing ? 0 : Math.max(0, options.indexOf(value));
    setActive(target);
  }, [open, options, value, editing]);

  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function commit(next: string) {
    onChange(next);
    setText("");
    setOpen(false);
  }

  function commitTyped() {
    const parsed = parseTime(text);
    if (parsed) onChange(parsed);
    setText("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => Math.min(options.length - 1, Math.max(0, i + delta)));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && options[active]) commit(options[active]);
      else commitTyped();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setText("");
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-label={label}
        autoComplete="off"
        value={editing ? text : display}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onBlur={() => {
          if (text) commitTyped();
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg py-1 shadow-xl"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        >
          {options.map((opt, i) => (
            <li key={opt}>
              <button
                type="button"
                role="option"
                aria-selected={opt === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(opt)}
                onMouseEnter={() => setActive(i)}
                className="block w-full px-3 py-1.5 text-left text-[13px] transition-colors"
                style={{
                  background: i === active ? "var(--surface-hi)" : "transparent",
                  color: opt === value ? "var(--accent)" : "var(--fg-2)",
                  fontWeight: opt === value ? 600 : 400,
                }}
              >
                {formatTime12(opt)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
