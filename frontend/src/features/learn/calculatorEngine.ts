import { all, create, type MathNode, type MathType } from "mathjs";

export type AngleMode = "deg" | "rad";

export type ErrorKind = "syntax" | "math" | "name" | "input";

export interface CalcError {
  kind: ErrorKind;
  message: string;
  hint?: string;
  position?: number;
}

export type Outcome = { ok: true; value: unknown; text: string } | { ok: false; error: CalcError | null };

const math = create(all, { number: "BigNumber", precision: 64 });

const BUILTINS = new Set<string>();

const TINY = math.bignumber("1e-40");
const HUGE = math.bignumber("1e25");

let angle: AngleMode = "deg";

class CalcFail extends Error {
  constructor(public readonly error: CalcError) {
    super(error.message);
  }
}

function fail(kind: ErrorKind, message: string, hint?: string): never {
  throw new CalcFail({ kind, message, hint });
}

function isPlainReal(x: unknown): boolean {
  return math.isBigNumber(x) || typeof x === "number" || math.isFraction(x);
}

function isZero(x: unknown): boolean {
  try {
    return isPlainReal(x) && (math.equal(x as MathType, 0) as boolean);
  } catch {
    return false;
  }
}

function absGreater(x: MathType, limit: MathType): boolean {
  return isPlainReal(x) && (math.larger(math.abs(x as never), limit) as boolean);
}

function snap(x: MathType): MathType {
  return isPlainReal(x) && !absGreater(x, TINY) ? math.bignumber(0) : x;
}

function degreesMod(x: MathType, m: number): MathType | null {
  if (angle !== "deg" || !isPlainReal(x)) return null;
  return math.mod(x as never, m) as MathType;
}

function toRadians(x: MathType): MathType {
  if (angle === "rad" || !isPlainReal(x)) return x;
  return math.multiply(x, math.divide(math.pi, 180) as MathType) as MathType;
}

function fromRadians(x: MathType): MathType {
  if (angle === "rad" || !isPlainReal(x)) return x;
  return math.multiply(x, math.divide(180, math.pi) as MathType) as MathType;
}

const USAGE: Record<string, string> = {
  nCr: "nCr(n, r)",
  nPr: "nPr(n, r)",
  root: "root(x, n)",
  log: "log(x) or log(x, base)",
};

function arity<A extends unknown[]>(name: string, min: number, max: number, impl: (...args: A) => unknown) {
  return (...args: unknown[]) => {
    const usage = USAGE[name] ?? `${name}(x)`;
    if (args.length < min) {
      fail("input", `${name} needs ${min === 1 ? "a value" : `${min} values`}`, `Use ${usage}`);
    }
    if (args.length > max) {
      fail("input", `${name} takes ${max === 1 ? "only one value" : `at most ${max} values`}`, `Use ${usage}`);
    }
    return impl(...(args as A));
  };
}

function trig(name: string, fn: (x: MathType) => MathType) {
  return arity(name, 1, 1, (x: MathType) => {
    const m180 = degreesMod(x, 180);
    if (m180 !== null) {
      const zeroAt = name === "sin" || name === "tan" ? 0 : name === "cos" ? 90 : null;
      if (zeroAt !== null && math.equal(m180, zeroAt)) return math.bignumber(0);
      const poleAt = name === "tan" || name === "sec" ? 90 : name === "csc" || name === "cot" ? 0 : null;
      if (poleAt !== null && math.equal(m180, poleAt)) {
        fail("math", `${name}(${math.format(x, { precision: 12 })}°) is undefined`);
      }
    }
    const out = fn(toRadians(x));
    if ((name === "tan" || name === "sec" || name === "csc" || name === "cot") && absGreater(out, HUGE)) {
      fail("math", `${name} is undefined at this angle`);
    }
    return snap(out);
  });
}

function inverseTrig(name: string, fn: (x: MathType) => MathType, bounded: boolean) {
  return arity(name, 1, 1, (x: MathType) => {
    if (bounded && absGreater(x, math.bignumber(1))) {
      fail("math", `${name} only takes values from −1 to 1`);
    }
    return fromRadians(fn(x));
  });
}

const FUNCTIONS: Record<string, (...args: unknown[]) => unknown> = {
  sin: trig("sin", math.sin as (x: MathType) => MathType),
  cos: trig("cos", math.cos as (x: MathType) => MathType),
  tan: trig("tan", math.tan as (x: MathType) => MathType),
  sec: trig("sec", math.sec as (x: MathType) => MathType),
  csc: trig("csc", math.csc as (x: MathType) => MathType),
  cot: trig("cot", math.cot as (x: MathType) => MathType),
  asin: inverseTrig("asin", math.asin as (x: MathType) => MathType, true),
  acos: inverseTrig("acos", math.acos as (x: MathType) => MathType, true),
  atan: inverseTrig("atan", math.atan as (x: MathType) => MathType, false),
  ln: arity("ln", 1, 1, (x: MathType) => {
    if (isZero(x)) fail("math", "ln(0) is undefined");
    return math.log(x as never);
  }),
  log: arity("log", 1, 2, (x: MathType, base?: MathType) => {
    if (isZero(x)) fail("math", "log(0) is undefined");
    if (base === undefined) return math.log10(x as never);
    if (isPlainReal(base) && (!math.larger(base, 0) || math.equal(base, 1))) {
      fail("math", "The log base must be positive and not 1");
    }
    return math.log(x as never, base as never);
  }),
  nCr: arity("nCr", 2, 2, (n: MathType, r: MathType) => {
    if (isPlainReal(n) && isPlainReal(r) && math.larger(r, n)) {
      fail("math", "nCr needs r to be no bigger than n", "Use nCr(n, r), like nCr(5, 2)");
    }
    return math.combinations(n as never, r as never);
  }),
  nPr: arity("nPr", 2, 2, (n: MathType, r: MathType) => {
    if (isPlainReal(n) && isPlainReal(r) && math.larger(r, n)) {
      fail("math", "nPr needs r to be no bigger than n", "Use nPr(n, r), like nPr(5, 2)");
    }
    return math.permutations(n as never, r as never);
  }),
  root: arity("root", 2, 2, (x: MathType, n: MathType) => {
    if (isZero(n)) fail("math", "The 0th root is undefined");
    return math.nthRoot(x as never, n as never);
  }),
};

for (const name of Object.keys(FUNCTIONS)) BUILTINS.add(name);
BUILTINS.add("Ans");

const scope = new Map<string, unknown>(Object.entries(FUNCTIONS));
scope.set("Ans", math.bignumber(0));

export function setAngleMode(mode: AngleMode) {
  angle = mode;
}

const GLYPHS: Record<string, string> = {
  "×": "*",
  "÷": "/",
  "−": "-",
  "π": "pi",
  "√": "sqrt",
  "∛": "cbrt",
};

export function normalise(expr: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  for (let i = 0; i < expr.length; i++) {
    const rep = GLYPHS[expr[i]] ?? expr[i];
    for (const c of rep) {
      text += c;
      map.push(i);
    }
  }
  map.push(expr.length);
  return { text, map };
}

function last(value: unknown): unknown {
  if (math.isResultSet(value)) {
    const entries = (value as unknown as { entries: unknown[] }).entries;
    return entries[entries.length - 1];
  }
  return value;
}

export function formatValue(value: unknown, fraction = false): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "function") {
    const syntax = (value as { syntax?: string }).syntax;
    return syntax ? `${syntax} defined` : "Function defined";
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (math.isBigNumber(value) || typeof value === "number") {
    const n = Number(value);
    if (Number.isNaN(n)) return "Undefined";
    if (!Number.isFinite(n) && !math.isBigNumber(value)) return n > 0 ? "∞" : "−∞";
    if (fraction) {
      const f = toFraction(n);
      if (f) return f;
    }
  }
  return math.format(value as MathType, { precision: 12, lowerExp: -9, upperExp: 15 });
}

export function toFraction(x: number): string | null {
  if (!Number.isFinite(x) || Number.isInteger(x)) return null;
  const sign = x < 0 ? "−" : "";
  const v = Math.abs(x);
  let h1 = 1;
  let h0 = 0;
  let k1 = 0;
  let k0 = 1;
  let b = v;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    h0 = h1;
    h1 = h2;
    k0 = k1;
    k1 = k2;
    if (k1 > 100_000) return null;
    if (Math.abs(v - h1 / k1) < 1e-12 * Math.max(1, v)) return `${sign}${h1}/${k1}`;
    const frac = b - a;
    if (frac < 1e-15) break;
    b = 1 / frac;
  }
  return null;
}

function badNumber(value: unknown): "nan" | "inf" | null {
  if (math.isBigNumber(value)) {
    if (value.isNaN()) return "nan";
    return value.isFinite() ? null : "inf";
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "nan";
    return Number.isFinite(value) ? null : "inf";
  }
  if (math.isComplex(value)) {
    return badNumber(value.re) ?? badNumber(value.im);
  }
  if (math.isMatrix(value) || Array.isArray(value)) {
    const items = (math.isMatrix(value) ? (value.toArray() as unknown[]) : (value as unknown[])).flat(Infinity);
    for (const item of items) {
      const bad = badNumber(item);
      if (bad) return bad;
    }
  }
  return null;
}

function dividesByZero(node: MathNode, target: Map<string, unknown>): boolean {
  let found = false;
  node.traverse((n) => {
    if (found || !math.isOperatorNode(n) || n.args.length !== 2) return;
    if (n.fn !== "divide" && n.fn !== "mod" && n.fn !== "dotDivide") return;
    try {
      if (isZero(n.args[1].evaluate(new Map(target)))) found = true;
    } catch {
    }
  });
  return found;
}

const FRIENDLY_NAMES: Record<string, string> = {
  combinations: "nCr",
  permutations: "nPr",
  nthRoot: "root",
  log10: "log",
  factorial: "Factorial",
  pow: "Powers",
};

function friendly(fn: string | undefined): string {
  if (!fn) return "This function";
  return FRIENDLY_NAMES[fn] ?? fn;
}

function syntaxError(e: Error & { char?: number }, map: number[], length: number): CalcError {
  const at = typeof e.char === "number" ? map[Math.min(Math.max(e.char - 1, 0), map.length - 1)] : undefined;
  const position = at === undefined ? undefined : Math.min(at, length);
  const msg = e.message;
  let m: RegExpMatchArray | null;

  if (/Parenthesis \) expected/.test(msg)) {
    return { kind: "syntax", message: "Missing a closing bracket )", position: length };
  }
  if (/\] expected/.test(msg)) {
    return { kind: "syntax", message: "Missing a closing bracket ]", position: length };
  }
  if ((m = msg.match(/Unexpected operator (\S+)/))) {
    const op = m[1];
    if (op === ")" || op === "]") return { kind: "syntax", message: `There's an extra ${op}`, position };
    return { kind: "syntax", message: `“${op}” is in the wrong place`, position };
  }
  if (/Unexpected end of expression/.test(msg)) {
    return { kind: "syntax", message: "The expression isn't finished", hint: "Add a number after the last operator", position: length };
  }
  if (/Value expected/.test(msg)) {
    return { kind: "syntax", message: "A number is missing here", position };
  }
  if ((m = msg.match(/Unexpected part "(.*)"/))) {
    const part = m[1];
    const hint = /^[\d.]/.test(part) ? "Add an operator between the numbers" : undefined;
    return { kind: "syntax", message: `Didn't expect “${part}” here`, hint, position };
  }
  if (/Unexpected end of string|String expected/.test(msg)) {
    return { kind: "syntax", message: "A quote mark isn't closed", position };
  }
  return { kind: "syntax", message: "Something's off with this expression", position };
}

function runtimeError(e: unknown, source: string): CalcError {
  if (e instanceof CalcFail) return e.error;
  const err = e as Error & { data?: { category?: string; fn?: string } };
  const msg = err?.message ?? "";
  const data = err?.data;
  let m: RegExpMatchArray | null;

  if ((m = msg.match(/Undefined function (\w+)/))) {
    return { kind: "name", message: `There's no function called “${m[1]}”`, hint: "Tap More to see every function" };
  }
  if ((m = msg.match(/Undefined symbol (\w+)/))) {
    return { kind: "name", message: `“${m[1]}” isn't defined`, hint: `Give it a value first, like ${m[1]} = 5` };
  }
  if (data?.category === "tooFewArgs") {
    return { kind: "input", message: `${friendly(data.fn)} needs more values` };
  }
  if (data?.category === "tooManyArgs") {
    return { kind: "input", message: `${friendly(data.fn)} has too many values` };
  }
  if (data?.category === "wrongType") {
    return { kind: "input", message: `${friendly(data.fn)} can't use that kind of value` };
  }
  if (/Units do not match/.test(msg)) {
    return { kind: "input", message: "Those units can't be converted into each other" };
  }
  if (/Unit ".*" not found|Unknown unit/i.test(msg)) {
    return { kind: "name", message: "That unit isn't recognised" };
  }
  if (/must be non-negative|Integer BigNumber expected|non-negative integer|integer value expected/i.test(msg)) {
    if (source.includes("!")) {
      return { kind: "math", message: "Factorial only works on whole numbers 0 and up" };
    }
    return { kind: "math", message: "This needs a whole number" };
  }
  if (/must be integer numbers/i.test(msg)) {
    return { kind: "math", message: `${(msg.match(/function (\w+)/) ?? [])[1] ?? "This"} needs whole numbers` };
  }
  if (/Root must be odd/.test(msg)) {
    return { kind: "math", message: "Even roots of negative numbers aren't real numbers", hint: "Try √ instead to get a complex answer" };
  }
  if (/shape mismatch|Dimension mismatch|dimensions/i.test(msg)) {
    return { kind: "input", message: "The lists or matrices are different sizes" };
  }
  if (/empty array|empty matrix/i.test(msg)) {
    return { kind: "input", message: "The list is empty" };
  }
  if (/Maximum call stack|too much recursion/i.test(msg)) {
    return { kind: "math", message: "This calculation is too large" };
  }
  const clean = msg.replace(/\s*\(char \d+\)/, "").trim();
  return { kind: "math", message: clean ? clean[0].toUpperCase() + clean.slice(1) : "Something went wrong" };
}

function run(expr: string, target: Map<string, unknown>): Outcome {
  const { text, map } = normalise(expr);
  if (!text.trim()) return { ok: false, error: null };

  let node: MathNode;
  try {
    node = math.parse(text);
  } catch (e) {
    return { ok: false, error: syntaxError(e as Error & { char?: number }, map, expr.length) };
  }

  let value: unknown;
  try {
    value = last(node.evaluate(target));
  } catch (e) {
    return { ok: false, error: runtimeError(e, text) };
  }

  if (dividesByZero(node, target)) {
    return { ok: false, error: { kind: "math", message: "Can't divide by zero" } };
  }
  const bad = badNumber(value);
  if (bad) {
    return {
      ok: false,
      error: {
        kind: "math",
        message: bad === "nan" ? "The result is undefined" : "The result is infinite",
      },
    };
  }
  return { ok: true, value, text: formatValue(value) };
}

export function evaluate(expr: string): Outcome {
  const outcome = run(expr, scope);
  if (outcome.ok && outcome.value !== undefined && typeof outcome.value !== "function") {
    scope.set("Ans", outcome.value);
  }
  return outcome;
}

export function preview(expr: string): Outcome {
  if (/random\s*\(/.test(normalise(expr).text)) return { ok: false, error: null };
  return run(expr, new Map(scope));
}

export function setAns(value: unknown) {
  scope.set("Ans", value);
}

export function variables(): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  scope.forEach((value, name) => {
    if (BUILTINS.has(name)) return;
    out.push({ name, text: formatValue(value) });
  });
  return out;
}

export function addTo(memory: string, value: unknown, sign: 1 | -1): string {
  try {
    const base = memory ? math.bignumber(memory) : math.bignumber(0);
    const next = sign === 1 ? math.add(base, value as MathType) : math.subtract(base, value as MathType);
    return math.format(next as MathType, { precision: 14 });
  } catch {
    return memory;
  }
}

export function isRealNumber(value: unknown): boolean {
  return math.isBigNumber(value) || typeof value === "number";
}
