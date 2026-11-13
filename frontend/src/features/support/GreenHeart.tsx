const OUTER =
  "M50 94 C40 86 4 64 4 34 C4 17 17 5 32 5 C40 5 46 9 50 16 C54 9 60 5 68 5 C83 5 96 17 96 34 C96 64 60 86 50 94 Z";
const MID =
  "M50 86 C41 79 12 60 12 36 C12 23 22 13 33 13 C41 13 46 18 50 25 C54 18 59 13 67 13 C78 13 88 23 88 36 C88 60 59 79 50 86 Z";
const DEPTH = "M50 25 C54 18 59 13 67 13 C78 13 88 23 88 36 C88 60 59 79 50 86 Z";
const CORE =
  "M50 67 C44 63 29 53 29 41 C29 35 34 30 39 30 C44 30 48 33 50 38 C52 33 56 30 61 30 C66 30 71 35 71 41 C71 53 56 63 50 67 Z";
const SHINE = "M17 44 C14 32 19 21 29 17 C24 24 21 33 22 45 Z";
const LOGO = [
  "M72 116 C46 100 36 64 38 30 C58 60 72 92 86 110 Z",
  "M80 118 C60 102 52 74 60 34 C72 64 82 92 94 112 Z",
  "M88 120 C74 104 72 78 82 42 C88 70 96 94 102 114 Z",
  "M74 132 C74 150 86 158 100 158 C114 158 126 150 126 132 L126 118 L100 130 L74 118 Z",
  "M100 90 L164 120 L100 150 L36 120 Z",
];

const green = (n: string) => `var(--heart-green-${n})`;
const LOGO_FILL = `color-mix(in srgb, ${green("4")} 88%, ${green("3")})`;

export default function GreenHeart({
  size = 24,
  glow = true,
  className,
}: {
  size?: number;
  glow?: boolean;
  className?: string;
}) {
  const halo = size * 1.6;
  const logo = size >= 40;
  const shadow = glow
    ? `drop-shadow(0 0 ${Math.max(1, size * 0.07)}px color-mix(in srgb, var(--heart-glow) 65%, transparent))`
    : undefined;

  return (
    <span
      aria-hidden
      className={`relative inline-block shrink-0${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span
          className="hh-glow pointer-events-none absolute rounded-full"
          style={{
            width: halo,
            height: halo,
            left: (size - halo) / 2,
            top: size * 0.5 - halo / 2,
            background: `radial-gradient(circle, color-mix(in srgb, ${green("3")} 45%, transparent) 0%, color-mix(in srgb, var(--heart-glow) 24%, transparent) 40%, transparent 70%)`,
          }}
        />
      )}
      <svg
        viewBox="0 0 100 100"
        overflow="visible"
        className="absolute inset-0 h-full w-full"
        style={shadow ? { filter: shadow } : undefined}
      >
        <g className={glow ? "hh-beat" : undefined}>
          <path d={OUTER} style={{ fill: green("1") }} />
          <path d={MID} style={{ fill: green("2") }} />
          <path d={DEPTH} style={{ fill: green("1"), opacity: 0.22 }} />
          {!logo && <path d={CORE} style={{ fill: green("3") }} />}
          <path d={SHINE} style={{ fill: "#fff", opacity: 0.55 }} />
          <ellipse cx="37" cy="18" rx="4" ry="2.6" transform="rotate(-18 37 18)" style={{ fill: green("4"), opacity: 0.85 }} />
          {logo && (
            <g transform="translate(22 23) scale(0.28)" style={{ fill: LOGO_FILL }}>
              {LOGO.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          )}
        </g>
      </svg>
    </span>
  );
}
