import { BOT_COLORS } from "../../lib/botArt";

function GloveShapes() {
  return (
    <>
      <rect x="15" y="9" width="9" height="30" rx="4.5" />
      <rect x="24.5" y="3" width="9" height="34" rx="4.5" />
      <rect x="34" y="5" width="9" height="32" rx="4.5" />
      <rect x="43" y="12" width="8" height="26" rx="4" />
      <rect x="3" y="30" width="9" height="22" rx="4.5" transform="rotate(-32 7.5 48)" />
      <rect x="12" y="28" width="40" height="32" rx="13" />
      <rect x="17" y="56" width="30" height="12" rx="4" />
    </>
  );
}

export default function HighFiveHand() {
  const ink = BOT_COLORS.ink;
  return (
    <>
      <span className="hf-burst" aria-hidden="true">
        <svg viewBox="-50 -50 100 100" xmlns="http://www.w3.org/2000/svg">
          <g stroke={BOT_COLORS.heart} strokeWidth="5" strokeLinecap="round">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <path key={a} d="M0 -22 L0 -40" transform={`rotate(${a})`} />
            ))}
          </g>
          <g fill="#facc15">
            {[22, 112, 202, 292].map((a) => (
              <circle key={a} cx="0" cy="-30" r="4" transform={`rotate(${a})`} />
            ))}
          </g>
        </svg>
      </span>
      <span className="hf-wrap" aria-hidden="true">
        <svg className="hf-hand" viewBox="-2 -2 60 74" xmlns="http://www.w3.org/2000/svg">
          <g fill={ink} stroke={ink} strokeWidth="5" strokeLinejoin="round">
            <GloveShapes />
          </g>
          <g fill="#ffffff">
            <GloveShapes />
          </g>
          <g stroke="#c7cad8" strokeWidth="1.6" strokeLinecap="round" fill="none">
            <path d="M24.2 30 L24.2 37" />
            <path d="M33.8 30 L33.8 37" />
            <path d="M43 31 L43 38" />
            <path d="M17 60 L47 60" />
          </g>
          <path d="M22 50 Q32 55 42 50" stroke="#c7cad8" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      </span>
    </>
  );
}
