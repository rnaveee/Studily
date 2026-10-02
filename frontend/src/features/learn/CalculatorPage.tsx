import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Delete, History, Sigma, Trash2 } from "lucide-react";
import BackButton from "../../components/BackButton";
import Modal from "../../components/Modal";
import SegmentedToggle from "../../components/SegmentedToggle";
import { isTouch } from "../../lib/isTouch";
import {
  addTo,
  evaluate,
  formatValue,
  isRealNumber,
  preview,
  setAngleMode,
  setAns,
  variables,
  type AngleMode,
  type CalcError,
  type ErrorKind,
} from "./calculatorEngine";

const HISTORY_KEY = "studily.calc.history";
const MEMORY_KEY = "studily.calc.memory";
const ANGLE_KEY = "studily.calc.angle";
const HISTORY_MAX = 50;

const ERROR_LABEL: Record<ErrorKind, string> = {
  syntax: "Syntax error",
  math: "Math error",
  name: "Unknown name",
  input: "Input error",
};

interface Entry {
  expr: string;
  result: string;
}

type KeyKind = "num" | "op" | "fn" | "act" | "eq";

interface Key {
  label: ReactNode;
  insert?: string;
  action?: () => void;
  kind: KeyKind;
  aria?: string;
}

const OPERATOR_START = /^\s*([+*/^!%×÷]|mod\b|to\b|−(?!\d))/;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

const FUNCTION_GROUPS: { title: string; items: { insert: string; label: string; hint: string }[] }[] = [
  {
    title: "Statistics",
    items: [
      { insert: "mean([", label: "mean([1, 2, 3])", hint: "Average of a list" },
      { insert: "median([", label: "median([…])", hint: "Middle value" },
      { insert: "mode([", label: "mode([…])", hint: "Most common value" },
      { insert: "std([", label: "std([…])", hint: "Sample standard deviation" },
      { insert: "variance([", label: "variance([…])", hint: "Sample variance" },
      { insert: "sum([", label: "sum([…])", hint: "Total of a list" },
      { insert: "min(", label: "min(a, b, …)", hint: "Smallest value" },
      { insert: "max(", label: "max(a, b, …)", hint: "Largest value" },
    ],
  },
  {
    title: "Number theory and rounding",
    items: [
      { insert: "gcd(", label: "gcd(a, b)", hint: "Greatest common divisor" },
      { insert: "lcm(", label: "lcm(a, b)", hint: "Least common multiple" },
      { insert: "round(", label: "round(x, n)", hint: "Round to n decimals" },
      { insert: "floor(", label: "floor(x)", hint: "Round down" },
      { insert: "ceil(", label: "ceil(x)", hint: "Round up" },
      { insert: "isPrime(", label: "isPrime(n)", hint: "Is n prime?" },
      { insert: "log(", label: "log(x, base)", hint: "Logarithm in any base" },
      { insert: "sec(", label: "sec / csc / cot", hint: "Reciprocal trig" },
    ],
  },
  {
    title: "Units and conversions",
    items: [
      { insert: "5 km to mi", label: "5 km to mi", hint: "Distance" },
      { insert: "30 degC to degF", label: "30 degC to degF", hint: "Temperature" },
      { insert: "60 mph to m/s", label: "60 mph to m/s", hint: "Speed" },
      { insert: "2.5 kg to lb", label: "2.5 kg to lb", hint: "Mass" },
      { insert: "500 kJ to kcal", label: "500 kJ to kcal", hint: "Energy" },
      { insert: "sin(45 deg)", label: "sin(45 deg)", hint: "Angle with a unit" },
    ],
  },
  {
    title: "Variables, functions and complex numbers",
    items: [
      { insert: "x = 4", label: "x = 4", hint: "Store a variable" },
      { insert: "f(x) = x^2 + 1", label: "f(x) = x^2 + 1", hint: "Define a function" },
      { insert: "sqrt(-9)", label: "sqrt(-9)", hint: "Gives 3i" },
      { insert: "(2 + 3i) * (1 - i)", label: "(2 + 3i)(1 − i)", hint: "Complex arithmetic" },
      { insert: "[1, 2; 3, 4] * [5; 6]", label: "[1, 2; 3, 4] * [5; 6]", hint: "Matrices" },
      { insert: "det([1, 2; 3, 4])", label: "det([…])", hint: "Determinant" },
    ],
  },
];

export default function CalculatorPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [expr, setExpr] = useState("");
  const [committed, setCommitted] = useState<{ expr: string; text: string; value: unknown } | null>(null);
  const [error, setError] = useState<CalcError | null>(null);
  const [shake, setShake] = useState(0);
  const [angle, setAngle] = useState<AngleMode>(() => (load<string>(ANGLE_KEY, "deg") === "rad" ? "rad" : "deg"));
  const [second, setSecond] = useState(false);
  const [fraction, setFraction] = useState(false);
  const [pad, setPad] = useState<"basic" | "sci">("basic");
  const [history, setHistory] = useState<Entry[]>(() => {
    const saved = load<Entry[]>(HISTORY_KEY, []);
    return Array.isArray(saved) ? saved.slice(0, HISTORY_MAX) : [];
  });
  const [memory, setMemory] = useState<string>(() => {
    const saved = load<string>(MEMORY_KEY, "");
    return typeof saved === "string" ? saved : "";
  });
  const [showFunctions, setShowFunctions] = useState(false);

  setAngleMode(angle);

  useEffect(() => {
    if (history.length > 0) setAns(evaluateSilently(history[0].result));
  }, []);

  useEffect(() => {
    save(ANGLE_KEY, angle);
  }, [angle]);

  useEffect(() => {
    if (!isTouch) inputRef.current?.focus();
  }, []);

  const live = useMemo(() => (expr.trim() ? preview(expr) : null), [expr, angle]);

  const displayText = (() => {
    if (expr.trim()) {
      if (live?.ok) return formatValue(live.value, fraction);
      return "";
    }
    if (committed) return formatValue(committed.value, fraction);
    return "0";
  })();

  function focusAt(pos: number) {
    const el = inputRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (!isTouch) el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function insert(text: string) {
    setError(null);
    const el = inputRef.current;
    let base = expr;
    let start = el?.selectionStart ?? base.length;
    let end = el?.selectionEnd ?? base.length;
    if (!base && committed) {
      if (OPERATOR_START.test(text)) {
        base = "Ans";
        start = end = base.length;
      }
      setCommitted(null);
    }
    const next = base.slice(0, start) + text + base.slice(end);
    setExpr(next);
    focusAt(start + text.length);
    if (second) setSecond(false);
  }

  function backspace() {
    setError(null);
    const el = inputRef.current;
    const start = el?.selectionStart ?? expr.length;
    const end = el?.selectionEnd ?? expr.length;
    if (start !== end) {
      setExpr(expr.slice(0, start) + expr.slice(end));
      focusAt(start);
      return;
    }
    if (start === 0) return;
    const before = expr.slice(0, start);
    const fn = before.match(/(?:[A-Za-z]+\(|Ans|mod |to )$/);
    const cut = fn ? fn[0].length : 1;
    setExpr(expr.slice(0, start - cut) + expr.slice(start));
    focusAt(start - cut);
  }

  function clearAll() {
    setExpr("");
    setCommitted(null);
    setError(null);
    focusAt(0);
  }

  function negate() {
    if (!expr && committed) {
      setExpr("-(Ans)");
      setCommitted(null);
      focusAt(6);
      return;
    }
    const wrapped = /^-\((.*)\)$/.exec(expr);
    const next = wrapped ? wrapped[1] : expr ? `-(${expr})` : "-";
    setExpr(next);
    focusAt(next.length);
  }

  function equals() {
    if (!expr.trim()) return;
    const outcome = evaluate(expr);
    if (!outcome.ok) {
      const err = outcome.error ?? { kind: "syntax" as const, message: "Something's off with this expression" };
      setError(err);
      setShake((n) => n + 1);
      if (err.position !== undefined) {
        const el = inputRef.current;
        const at = Math.min(err.position, expr.length);
        const end = at < expr.length ? at + 1 : at;
        requestAnimationFrame(() => {
          if (!el) return;
          if (!isTouch) el.focus();
          el.setSelectionRange(at, end);
        });
      }
      return;
    }
    const text = formatValue(outcome.value);
    setCommitted({ expr, text, value: outcome.value });
    setError(null);
    setExpr("");
    const next = [{ expr, result: text }, ...history.filter((h) => h.expr !== expr)].slice(0, HISTORY_MAX);
    setHistory(next);
    save(HISTORY_KEY, next);
    focusAt(0);
  }

  function currentValue(): unknown {
    if (expr.trim()) {
      const outcome = preview(expr);
      return outcome.ok ? outcome.value : undefined;
    }
    return committed?.value;
  }

  function memoryAdd(sign: 1 | -1) {
    const value = currentValue();
    if (!isRealNumber(value)) return;
    const next = addTo(memory, value, sign);
    setMemory(next);
    save(MEMORY_KEY, next);
  }

  function memoryClear() {
    setMemory("");
    save(MEMORY_KEY, "");
  }

  const basic: Key[] = [
    { label: "AC", action: clearAll, kind: "act", aria: "Clear all" },
    { label: <Delete size={17} />, action: backspace, kind: "act", aria: "Backspace" },
    { label: "(", insert: "(", kind: "op" },
    { label: ")", insert: ")", kind: "op" },
    { label: "7", insert: "7", kind: "num" },
    { label: "8", insert: "8", kind: "num" },
    { label: "9", insert: "9", kind: "num" },
    { label: "÷", insert: "÷", kind: "op", aria: "Divide" },
    { label: "4", insert: "4", kind: "num" },
    { label: "5", insert: "5", kind: "num" },
    { label: "6", insert: "6", kind: "num" },
    { label: "×", insert: "×", kind: "op", aria: "Multiply" },
    { label: "1", insert: "1", kind: "num" },
    { label: "2", insert: "2", kind: "num" },
    { label: "3", insert: "3", kind: "num" },
    { label: "−", insert: "−", kind: "op", aria: "Minus" },
    { label: "0", insert: "0", kind: "num" },
    { label: ".", insert: ".", kind: "num", aria: "Decimal point" },
    { label: "%", insert: "%", kind: "op", aria: "Percent" },
    { label: "+", insert: "+", kind: "op", aria: "Plus" },
    { label: "±", action: negate, kind: "act", aria: "Negate" },
    { label: "Ans", insert: "Ans", kind: "fn", aria: "Previous answer" },
    { label: "EE", insert: "E", kind: "fn", aria: "Times ten to the power" },
    { label: "=", action: equals, kind: "eq", aria: "Equals" },
  ];

  const sci: Key[] = [
    { label: "2nd", action: () => setSecond((v) => !v), kind: second ? "eq" : "act", aria: "Second functions" },
    { label: "π", insert: "π", kind: "fn", aria: "Pi" },
    { label: "e", insert: "e", kind: "fn", aria: "Euler's number" },
    { label: "x!", insert: "!", kind: "fn", aria: "Factorial" },
    { label: "|x|", insert: "abs(", kind: "fn", aria: "Absolute value" },

    second
      ? { label: <>sin<sup>−1</sup></>, insert: "asin(", kind: "fn", aria: "Inverse sine" }
      : { label: "sin", insert: "sin(", kind: "fn" },
    second
      ? { label: <>cos<sup>−1</sup></>, insert: "acos(", kind: "fn", aria: "Inverse cosine" }
      : { label: "cos", insert: "cos(", kind: "fn" },
    second
      ? { label: <>tan<sup>−1</sup></>, insert: "atan(", kind: "fn", aria: "Inverse tangent" }
      : { label: "tan", insert: "tan(", kind: "fn" },
    second
      ? { label: <>e<sup>x</sup></>, insert: "e^(", kind: "fn", aria: "e to the power" }
      : { label: "ln", insert: "ln(", kind: "fn", aria: "Natural log" },
    second
      ? { label: <>10<sup>x</sup></>, insert: "10^(", kind: "fn", aria: "Ten to the power" }
      : { label: "log", insert: "log(", kind: "fn", aria: "Log base ten" },

    second
      ? { label: <>sinh<sup>−1</sup></>, insert: "asinh(", kind: "fn", aria: "Inverse hyperbolic sine" }
      : { label: "sinh", insert: "sinh(", kind: "fn" },
    second
      ? { label: <>cosh<sup>−1</sup></>, insert: "acosh(", kind: "fn", aria: "Inverse hyperbolic cosine" }
      : { label: "cosh", insert: "cosh(", kind: "fn" },
    second
      ? { label: <>tanh<sup>−1</sup></>, insert: "atanh(", kind: "fn", aria: "Inverse hyperbolic tangent" }
      : { label: "tanh", insert: "tanh(", kind: "fn" },
    { label: <>log<sub>b</sub></>, insert: "log(", kind: "fn", aria: "Log with base, as log(x, base)" },
    { label: "mod", insert: " mod ", kind: "fn", aria: "Modulo" },

    second
      ? { label: <>x<sup>3</sup></>, insert: "^3", kind: "fn", aria: "Cube" }
      : { label: <>x<sup>2</sup></>, insert: "^2", kind: "fn", aria: "Square" },
    { label: <>x<sup>y</sup></>, insert: "^", kind: "fn", aria: "Power" },
    second
      ? { label: "∛", insert: "∛(", kind: "fn", aria: "Cube root" }
      : { label: "√", insert: "√(", kind: "fn", aria: "Square root" },
    { label: <><sup>y</sup>√x</>, insert: "root(", kind: "fn", aria: "Nth root, as root(x, n)" },
    { label: <>x<sup>−1</sup></>, insert: "^(-1)", kind: "fn", aria: "Reciprocal" },

    { label: "nCr", insert: "nCr(", kind: "fn", aria: "Combinations" },
    { label: "nPr", insert: "nPr(", kind: "fn", aria: "Permutations" },
    { label: "gcd", insert: "gcd(", kind: "fn", aria: "Greatest common divisor" },
    { label: "lcm", insert: "lcm(", kind: "fn", aria: "Least common multiple" },
    { label: "Rand", insert: "random()", kind: "fn", aria: "Random number" },

    { label: "[", insert: "[", kind: "op", aria: "Open list" },
    { label: "]", insert: "]", kind: "op", aria: "Close list" },
    { label: ",", insert: ", ", kind: "op", aria: "Comma" },
    { label: "mean", insert: "mean([", kind: "fn", aria: "Mean of a list" },
    { label: "to", insert: " to ", kind: "fn", aria: "Convert units" },
  ];

  const vars = variables();

  return (
    <div className="space-y-6 stagger-children">
      <div className="flex items-center gap-3">
        <BackButton fallback="/learn" />
        <div>
          <h1 className="text-xl font-semibold text-fg">Calculator</h1>
          <p className="mt-1 text-[13px] text-fg-3">
            Scientific functions, exact fractions, unit conversions and more.
          </p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedToggle
              options={[
                { value: "deg", label: "DEG" },
                { value: "rad", label: "RAD" },
              ]}
              value={angle}
              onChange={setAngle}
            />
            <button
              onClick={() => setFraction((v) => !v)}
              aria-pressed={fraction}
              className={`btn ${fraction ? "btn-soft" : "btn-ghost"} px-3`}
              title="Show results as fractions"
            >
              a/b
            </button>
            <button onClick={() => setShowFunctions(true)} className="btn btn-ghost px-3">
              <Sigma size={14} />
              More
            </button>
            <div className="ml-auto flex items-center gap-1">
              {(
                [
                  ["MC", memoryClear, "Clear memory"],
                  ["MR", () => memory && insert(memory), "Recall memory"],
                  ["M+", () => memoryAdd(1), "Add to memory"],
                  ["M−", () => memoryAdd(-1), "Subtract from memory"],
                ] as const
              ).map(([label, fn, aria]) => (
                <button
                  key={label}
                  onClick={fn}
                  aria-label={aria}
                  disabled={(label === "MC" || label === "MR") && !memory}
                  className="rounded-md px-2 py-1 text-[12px] font-semibold text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            key={shake}
            className={`mt-3 rounded-xl px-5 py-4 transition-shadow sm:px-6 sm:py-5 ${error && shake ? "calc-shake" : ""}`}
            style={{
              background: "var(--surface-hi)",
              boxShadow: error
                ? "var(--control-inset), inset 0 0 0 1.5px color-mix(in srgb, var(--red) 55%, transparent)"
                : "var(--control-inset)",
            }}
          >
            <div className="flex h-5 items-center justify-between gap-3 text-[12px] text-fg-3">
              <span className="font-semibold tracking-wider">
                {angle.toUpperCase()}
                {memory && <span className="ml-2 text-accent">M = {memory}</span>}
              </span>
              <span className="min-w-0 truncate font-mono">
                {!expr && committed ? `${committed.expr} =` : ""}
              </span>
            </div>
            <input
              ref={inputRef}
              value={expr}
              inputMode={isTouch ? "none" : "text"}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={committed ? "" : "0"}
              aria-label="Expression"
              onChange={(e) => {
                setError(null);
                if (!expr && committed && OPERATOR_START.test(e.target.value)) {
                  const v = "Ans" + e.target.value;
                  setExpr(v);
                  setCommitted(null);
                  focusAt(v.length);
                  return;
                }
                if (committed) setCommitted(null);
                setExpr(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || (e.key === "=" && !e.shiftKey)) {
                  e.preventDefault();
                  equals();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  clearAll();
                }
              }}
              className="mt-1 w-full bg-transparent text-right font-mono text-[22px] text-fg outline-none placeholder:text-fg-3"
            />
            {error ? (
              <div className="mt-2 min-h-[44px] text-right" role="alert">
                <div className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--red)" }}>
                  {ERROR_LABEL[error.kind]}
                </div>
                <div className="mt-0.5 text-[15px] font-medium text-fg">{error.message}</div>
                {error.hint && <div className="mt-0.5 text-[12px] text-fg-3">{error.hint}</div>}
              </div>
            ) : (
              <div
                className="mt-2 min-h-[44px] truncate text-right font-mono text-[34px] font-semibold leading-tight tabular-nums"
                style={{ color: expr.trim() ? "var(--fg-3)" : "var(--fg)" }}
                aria-live="polite"
              >
                {displayText}
              </div>
            )}
          </div>

          <div className="mt-4 sm:hidden">
            <SegmentedToggle
              className="w-full"
              options={[
                { value: "basic", label: "Basic" },
                { value: "sci", label: "Scientific" },
              ]}
              value={pad}
              onChange={setPad}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
            <div className={`${pad === "sci" ? "grid" : "hidden"} grid-cols-5 gap-1.5 sm:grid`}>
              {sci.map((k, i) => (
                <PadKey key={i} k={k} onInsert={insert} small />
              ))}
            </div>
            <div className={`${pad === "basic" ? "grid" : "hidden"} grid-cols-4 gap-1.5 sm:grid`}>
              {basic.map((k, i) => (
                <PadKey key={i} k={k} onInsert={insert} />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card flex max-h-[520px] flex-col">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-fg-3">
                <History size={13} />
                History
              </h2>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    setHistory([]);
                    save(HISTORY_KEY, []);
                  }}
                  aria-label="Clear history"
                  className="rounded p-1 text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="px-4 pb-4 text-[13px] text-fg-3">Your calculations will show up here.</p>
            ) : (
              <ul className="flex-1 divide-y divide-line overflow-y-auto border-t border-line">
                {history.map((h, i) => (
                  <li key={i} className="px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        setCommitted(null);
                        setError(null);
                        setExpr(h.expr);
                        focusAt(h.expr.length);
                      }}
                      className="block w-full truncate text-right font-mono text-[12px] text-fg-3 transition-colors hover:text-fg"
                      title="Edit this calculation"
                    >
                      {h.expr}
                    </button>
                    <button
                      onClick={() => insert(h.result)}
                      className="block w-full truncate text-right font-mono text-[15px] font-semibold text-fg transition-colors hover:text-accent"
                      title="Insert this result"
                    >
                      = {h.result}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {vars.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-fg-3">Variables</h2>
              <div className="flex flex-wrap gap-1.5">
                {vars.map((v) => (
                  <button
                    key={v.name}
                    onClick={() => insert(v.name)}
                    className="badge badge-muted font-mono transition-colors hover:text-fg"
                  >
                    {v.name} = {v.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showFunctions && (
        <Modal onClose={() => setShowFunctions(false)} title="More functions" size="lg">
          <div className="space-y-5">
            {FUNCTION_GROUPS.map((g) => (
              <div key={g.title}>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-fg-3">{g.title}</h3>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {g.items.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        setShowFunctions(false);
                        insert(item.insert);
                      }}
                      className="rounded-lg border border-line px-3 py-2 text-left transition-colors hover:bg-surface-hi"
                    >
                      <span className="block font-mono text-[13px] text-fg">{item.label}</span>
                      <span className="block text-[11px] text-fg-3">{item.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function evaluateSilently(text: string): unknown {
  const outcome = preview(text.replace(/^−/, "-"));
  return outcome.ok ? outcome.value : 0;
}

function PadKey({ k, onInsert, small = false }: { k: Key; onInsert: (text: string) => void; small?: boolean }) {
  const styles: Record<KeyKind, string> = {
    num: "btn-ghost text-fg font-semibold",
    op: "btn-soft font-semibold",
    fn: "btn-ghost text-fg-2",
    act: "btn-ghost text-fg-2 font-semibold",
    eq: "btn-primary font-semibold",
  };

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => (k.action ? k.action() : k.insert && onInsert(k.insert))}
      aria-label={k.aria}
      className={`btn ${styles[k.kind]} ${small ? "h-11 px-0 text-[13px]" : "h-12 px-0 text-[17px]"}`}
    >
      {k.label}
    </button>
  );
}
