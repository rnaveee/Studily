import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import elements from "./elements.json";
import BackButton from "../../components/BackButton";

type ElementData = (typeof elements)[number];

const CATEGORY_COLORS: Record<string, string> = {
  alkali: "#e8663c",
  "alkaline-earth": "#e0913c",
  transition: "#4a90d9",
  "post-transition": "#5aab8a",
  metalloid: "#2aa198",
  nonmetal: "#2d9060",
  halogen: "#8a7de8",
  "noble-gas": "#b05ec7",
  lanthanide: "#d94f8a",
  actinide: "#c63636",
  unknown: "#8e8ea8",
};

const CATEGORY_LABELS: Record<string, string> = {
  alkali: "Alkali metal",
  "alkaline-earth": "Alkaline earth metal",
  transition: "Transition metal",
  "post-transition": "Post-transition metal",
  metalloid: "Metalloid",
  nonmetal: "Nonmetal",
  halogen: "Halogen",
  "noble-gas": "Noble gas",
  lanthanide: "Lanthanide",
  actinide: "Actinide",
  unknown: "Unknown properties",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function cellPosition(el: ElementData) {
  if (el.group !== null) return { row: el.period, column: el.group };
  const base = el.category === "lanthanide" ? 57 : 89;
  return { row: el.category === "lanthanide" ? 9 : 10, column: 3 + el.number - base };
}

function color(el: ElementData) {
  return CATEGORY_COLORS[el.category] ?? CATEGORY_COLORS.unknown;
}

function kelvin(k: number | null) {
  if (k === null) return "Unknown";
  return `${k} K (${Math.round(k - 273.15)} °C)`;
}

function density(el: ElementData) {
  if (el.density === null) return "Unknown";
  if (el.phase === "gas") return `${(el.density * 1000).toFixed(4)} g/L`;
  return `${el.density} g/cm³`;
}

function matches(el: ElementData, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    el.name.toLowerCase().includes(q) ||
    el.symbol.toLowerCase() === q ||
    el.symbol.toLowerCase().startsWith(q) ||
    String(el.number) === q
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
      <span className="shrink-0 text-[12px] text-fg-3">{label}</span>
      <span className="text-right text-[13px] font-medium text-fg">{value}</span>
    </div>
  );
}

function ElementDetail({ el, onClose }: { el: ElementData; onClose: () => void }) {
  const accent = color(el);
  return (
    <div
      className="card animate-in p-4"
      style={{ borderColor: `color-mix(in srgb, ${accent} 45%, var(--line))` }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl"
          style={{
            background: `color-mix(in srgb, ${accent} 16%, var(--surface))`,
            border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
          }}
        >
          <span className="text-[10px] font-medium text-fg-3">{el.number}</span>
          <span className="text-[22px] font-semibold leading-none" style={{ color: accent }}>
            {el.symbol}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold text-fg">{el.name}</h2>
          <p className="mt-0.5 text-[12px]" style={{ color: accent }}>
            {CATEGORY_LABELS[el.category] ?? el.category}
          </p>
          <p className="mt-1 text-[12px] text-fg-3">
            {el.mass} u · {el.phase} at room temperature
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close element details"
          className="btn btn-ghost shrink-0 !h-8 !w-8 !p-0"
        >
          <X size={15} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        <DetailRow label="Atomic number" value={String(el.number)} />
        <DetailRow label="Atomic mass" value={`${el.mass} u`} />
        <DetailRow label="Group" value={el.group === null ? "None" : String(el.group)} />
        <DetailRow label="Period" value={String(el.period)} />
        <DetailRow label="Block" value={`${el.block}-block`} />
        <DetailRow label="Phase at STP" value={el.phase} />
        <DetailRow label="Electron configuration" value={el.config} />
        <DetailRow
          label="Electronegativity"
          value={el.electronegativity === null ? "Unknown" : `${el.electronegativity} (Pauling)`}
        />
        <DetailRow label="Melting point" value={kelvin(el.melt)} />
        <DetailRow label="Boiling point" value={kelvin(el.boil)} />
        <DetailRow label="Density" value={density(el)} />
      </div>
    </div>
  );
}

export default function PeriodicTablePage() {
  const [selected, setSelected] = useState<ElementData | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(
    () => new Set(elements.filter((el) => matches(el, query)).map((el) => el.number)),
    [query],
  );

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center gap-3">
        <BackButton fallback="/learn" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-fg">Periodic Table</h1>
          <p className="mt-0.5 text-[13px] text-fg-3">
            Tap any element to see its properties.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3"
        />
        <input
          className="input !pl-9"
          placeholder="Search by name, symbol, or number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-fg-3 hover:bg-surface-hi"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {selected && <ElementDetail el={selected} onClose={() => setSelected(null)} />}

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: "repeat(18, minmax(0, 1fr))",
            gridTemplateRows: "repeat(10, minmax(0, 1fr))",
            minWidth: "660px",
          }}
        >
          {elements.map((el) => {
            const { row, column } = cellPosition(el);
            const accent = color(el);
            const dim = !visible.has(el.number);
            const active = selected?.number === el.number;
            return (
              <button
                key={el.number}
                type="button"
                onClick={() => setSelected(active ? null : el)}
                aria-label={`${el.name}, element ${el.number}`}
                aria-pressed={active}
                className="flex aspect-square flex-col items-center justify-center rounded-[5px] transition-opacity"
                style={{
                  gridRow: row,
                  gridColumn: column,
                  background: `color-mix(in srgb, ${accent} ${active ? 42 : 15}%, var(--surface))`,
                  border: `1px solid color-mix(in srgb, ${accent} ${active ? 90 : 35}%, transparent)`,
                  opacity: dim ? 0.2 : 1,
                }}
              >
                <span className="text-[7px] leading-none text-fg-3">{el.number}</span>
                <span
                  className="text-[12px] font-semibold leading-tight"
                  style={{ color: accent }}
                >
                  {el.symbol}
                </span>
              </button>
            );
          })}

          <div
            className="flex items-center justify-center text-[9px] text-fg-3"
            style={{ gridRow: 6, gridColumn: 3 }}
          >
            57–71
          </div>
          <div
            className="flex items-center justify-center text-[9px] text-fg-3"
            style={{ gridRow: 7, gridColumn: 3 }}
          >
            89–103
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {CATEGORY_ORDER.map((key) => (
          <span key={key} className="flex items-center gap-1.5 text-[11px] text-fg-2">
            <span
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{
                background: `color-mix(in srgb, ${CATEGORY_COLORS[key]} 55%, var(--surface))`,
                border: `1px solid ${CATEGORY_COLORS[key]}`,
              }}
            />
            {CATEGORY_LABELS[key]}
          </span>
        ))}
      </div>

      <p className="text-[11px] text-fg-3">
        Melting points, boiling points and densities for the heaviest synthetic elements
        (from rutherfordium onward) are predicted or provisional.
      </p>
    </div>
  );
}
