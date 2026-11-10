export type BotMood = "idle" | "thinking" | "happy";

const MASCOT_CSS = `
.studily-bot { display: inline-block; line-height: 0; animation: studily-bot-bob 3.2s ease-in-out infinite; }
.studily-bot[data-mood="thinking"] { animation-duration: 1.1s; }
.studily-bot[data-mood="happy"] { animation-name: studily-bot-hop; animation-duration: 1.6s; }
.studily-bot-eyes { transform-box: fill-box; transform-origin: center; animation: studily-bot-blink 4.8s infinite; }
.studily-bot-antenna { transform-box: fill-box; transform-origin: center; animation: studily-bot-pulse 2.4s ease-in-out infinite; }
.studily-bot[data-mood="thinking"] .studily-bot-antenna { animation-duration: 0.7s; }
@keyframes studily-bot-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes studily-bot-hop { 0%, 100% { transform: translateY(0); } 35% { transform: translateY(-7px); } 60% { transform: translateY(-2px); } }
@keyframes studily-bot-blink { 0%, 90%, 100% { transform: scaleY(1); } 94% { transform: scaleY(0.12); } }
@keyframes studily-bot-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.35); } }
@media (prefers-reduced-motion: reduce) {
  .studily-bot, .studily-bot * { animation: none !important; }
}
`;

export default function BotMascot({
  size = 96,
  mood = "idle",
  label,
  className = "",
}: {
  size?: number;
  mood?: BotMood;
  label?: string;
  className?: string;
}) {
  const happy = mood === "happy";
  const thinking = mood === "thinking";
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };

  return (
    <span
      className={`studily-bot ${className}`}
      data-mood={mood}
      style={{ width: size, height: size }}
      {...a11y}
    >
      <style>{MASCOT_CSS}</style>
      <svg viewBox="0 0 120 120" width={size} height={size} style={{ display: "block", overflow: "visible" }} focusable="false">
        <line x1="60" y1="26" x2="60" y2="16" strokeWidth={4} strokeLinecap="round" style={{ stroke: "var(--accent-2)" }} />
        <circle className="studily-bot-antenna" cx="60" cy="13" r="6" style={{ fill: "var(--accent)" }} />
        <rect x="13" y="46" width="12" height="30" rx="6" style={{ fill: "var(--accent-2)" }} />
        <rect x="95" y="46" width="12" height="30" rx="6" style={{ fill: "var(--accent-2)" }} />
        <rect
          x="22"
          y="26"
          width="76"
          height="74"
          rx="30"
          strokeWidth={4}
          style={{ fill: "var(--surface)", stroke: "var(--accent)" }}
        />
        <rect
          x="32"
          y="42"
          width="56"
          height="36"
          rx="16"
          style={{ fill: "color-mix(in srgb, var(--accent) 16%, var(--surface))" }}
        />
        <g className="studily-bot-eyes">
          {happy ? (
            <>
              <path d="M42 62 Q50 50 58 62" fill="none" strokeWidth={4} strokeLinecap="round" style={{ stroke: "var(--accent)" }} />
              <path d="M62 62 Q70 50 78 62" fill="none" strokeWidth={4} strokeLinecap="round" style={{ stroke: "var(--accent)" }} />
            </>
          ) : (
            <>
              <circle cx="50" cy="59" r="5.5" style={{ fill: "var(--accent)" }} />
              <circle cx="70" cy="59" r="5.5" style={{ fill: "var(--accent)" }} />
            </>
          )}
        </g>
        {thinking ? (
          <path d="M54 86 H66" fill="none" strokeWidth={3.5} strokeLinecap="round" style={{ stroke: "var(--accent)" }} />
        ) : (
          <path
            d={happy ? "M50 84 Q60 96 70 84" : "M52 85 Q60 90 68 85"}
            fill="none"
            strokeWidth={3.5}
            strokeLinecap="round"
            style={{ stroke: "var(--accent)" }}
          />
        )}
        <rect x="44" y="104" width="32" height="8" rx="4" style={{ fill: "var(--accent-2)" }} />
      </svg>
    </span>
  );
}
