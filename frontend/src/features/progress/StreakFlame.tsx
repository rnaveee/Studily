export type FlameTier = "out" | "kindle" | "ember" | "blaze" | "inferno";

export function flameTier(streak: number): FlameTier {
  if (streak <= 0) return "out";
  if (streak < 7) return "kindle";
  if (streak < 30) return "ember";
  if (streak < 100) return "blaze";
  return "inferno";
}

const OUTER =
  "M50 98 C26 98 10 82 10 61 C10 47 16 34 24 22 C26 31 31 37 37 40 C36 26 42 12 56 2 C55 16 62 24 71 33 C81 43 90 52 90 64 C90 84 73 98 50 98 Z";
const MID =
  "M50 92 C31 92 18 80 18 63 C18 52 23 44 29 37 C31 43 35 47 40 49 C40 36 46 24 55 14 C56 26 62 32 69 40 C77 48 82 55 82 64 C82 80 68 92 50 92 Z";
const CORE =
  "M51 48 C46 48 42 45 42 40 C42 34 47 30 50 26 C52 23 54 21 55 17 C57 24 60 28 61 33 C62 37 62 41 60 44 C58 47 55 48 51 48 Z";
const SHINE = "M24 75 C20 67 21 58 26 51 C25 59 26 67 29 74 Z";
const LICK_L = "M20 60 C14 54 8 50 5 42 C2 54 6 66 13 72 Z";
const LICK_R = "M80 56 C86 50 92 45 95 36 C98 48 94 60 87 68 Z";
const LOGO = [
  "M72 116 C46 100 36 64 38 30 C58 60 72 92 86 110 Z",
  "M80 118 C60 102 52 74 60 34 C72 64 82 92 94 112 Z",
  "M88 120 C74 104 72 78 82 42 C88 70 96 94 102 114 Z",
  "M74 132 C74 150 86 158 100 158 C114 158 126 150 126 132 L126 118 L100 130 L74 118 Z",
  "M100 90 L164 120 L100 150 L36 120 Z",
];
const SPARKS = [
  { x: 27, y: 26, delay: 0 },
  { x: 73, y: 34, delay: 0.65 },
  { x: 58, y: 12, delay: 1.25 },
];

const fire = (n: string) => `var(--flair-fire-${n})`;
const blue = (n: string) => `var(--flame-blue-${n})`;
const deepen = (color: string, toward: string) => `color-mix(in srgb, ${color} 78%, ${toward})`;
const EMBER_DEEP = "#7a1d00";
const BLUE_DEEP = "#0a2a8a";
const KINDLE_MID = `color-mix(in srgb, ${fire("3")} 55%, ${fire("4")})`;

interface TierLook {
  outer: string;
  mid?: string;
  core?: string;
  logo: string;
  logoOpacity?: number;
  scale: number;
  speed: number;
  licks?: boolean;
  spark?: string;
  glow?: string;
}

const LOOKS: Record<FlameTier, TierLook> = {
  out: {
    outer: "color-mix(in srgb, var(--fg-3) 40%, transparent)",
    logo: "var(--fg-3)",
    logoOpacity: 0.5,
    scale: 0.84,
    speed: 1,
  },
  kindle: {
    outer: fire("3"),
    mid: KINDLE_MID,
    core: fire("4"),
    logo: deepen(KINDLE_MID, EMBER_DEEP),
    scale: 0.82,
    speed: 1.3,
  },
  ember: {
    outer: fire("2"),
    mid: fire("3"),
    core: fire("4"),
    logo: deepen(fire("3"), EMBER_DEEP),
    scale: 0.91,
    speed: 1,
    licks: true,
  },
  blaze: {
    outer: fire("2"),
    mid: fire("3"),
    core: blue("3"),
    logo: deepen(fire("3"), EMBER_DEEP),
    scale: 1,
    speed: 0.85,
    licks: true,
    spark: fire("4"),
    glow: fire("3"),
  },
  inferno: {
    outer: blue("1"),
    mid: blue("2"),
    core: blue("hot"),
    logo: deepen(blue("2"), BLUE_DEEP),
    scale: 1,
    speed: 0.7,
    licks: true,
    spark: blue("3"),
    glow: blue("2"),
  },
};

export default function StreakFlame({ streak, size = 40 }: { streak: number; size?: number }) {
  const tier = flameTier(streak);
  const look = LOOKS[tier];
  const lit = tier !== "out";
  const sparks = look.spark && size >= 32;

  return (
    <span
      aria-hidden
      className="relative inline-block shrink-0"
      style={{ width: size, height: size, "--sf-speed": look.speed } as React.CSSProperties}
    >
      <svg
        viewBox="0 0 100 100"
        overflow="visible"
        className="absolute inset-0 h-full w-full"
        style={
          look.glow
            ? {
                filter: `drop-shadow(0 0 ${Math.max(2, size * 0.09)}px color-mix(in srgb, ${look.glow} 55%, transparent))`,
              }
            : undefined
        }
      >
        <g transform={`translate(50 98) scale(${look.scale}) translate(-50 -98)`}>
          {look.licks && (
            <>
              <path d={LICK_L} className="sf-lick sf-lick-l" style={{ fill: look.outer }} />
              <path d={LICK_R} className="sf-lick sf-lick-r" style={{ fill: look.outer }} />
            </>
          )}
          <path d={OUTER} className={lit ? "sf-layer" : undefined} style={{ fill: look.outer }} />
          {look.mid && (
            <g className="sf-layer sf-mid">
              <path d={MID} style={{ fill: look.mid }} />
              <path d={SHINE} style={{ fill: "#fff", opacity: 0.45 }} />
            </g>
          )}
          {look.core && <path d={CORE} className="sf-layer sf-core" style={{ fill: look.core }} />}
        </g>
        {sparks &&
          SPARKS.map((s) => (
            <path
              key={s.x}
              d={`M${s.x} ${s.y - 4} l3 4 l-3 4 l-3 -4 Z`}
              className="sf-spark"
              style={{ fill: look.spark, animationDelay: `${-s.delay * look.speed}s` }}
            />
          ))}
        <g transform="translate(25 44.5) scale(0.25)" style={{ fill: look.logo, opacity: look.logoOpacity }}>
          {LOGO.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
    </span>
  );
}
