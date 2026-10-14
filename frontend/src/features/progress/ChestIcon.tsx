import { useId } from "react";
import { CHEST_TIER_LABEL } from "./badges";
import type { ChestTier } from "../../types";

const OUTLINE = "#1d1a33";
const BODY = "M84 250 L428 250 L428 428 Q428 448 408 448 L104 448 Q84 448 84 428 Z";
const LID = "M74 262 L74 196 C74 128 150 94 256 94 C362 94 438 128 438 196 L438 262 Z";
const OPEN_LID = "M102 218 L410 218 L446 112 C440 76 360 50 256 50 C152 50 72 76 66 112 Z";
const SPARKLE = "M0 -24 C2 -8 8 -2 24 0 C8 2 2 8 0 24 C-2 8 -8 2 -24 0 C-8 -2 -2 -8 0 -24 Z";
const RAYS =
  "M256 230 L219 -67 L292 -67 Z M256 230 L401 -32 L460 10 Z M256 230 L527 103 L550 172 Z M256 230 L550 287 L527 356 Z M256 230 L460 449 L401 492 Z M256 230 L292 527 L219 527 Z M256 230 L110 492 L51 449 Z M256 230 L-15 356 L-38 287 Z M256 230 L-38 172 L-15 103 Z M256 230 L51 10 L110 -32 Z";
const RAINBOW = ["#FF5A6E", "#FF9F43", "#FFE066", "#4CD964", "#4CB8F0", "#8E7CFF", "#E05CFF"];

type Palette = {
  L: string;
  B: string;
  D: string;
  X: string;
  H: string;
  tL: string;
  tB: string;
  tD: string;
  tH: string;
  inside: string;
  glow: string;
  gem: string | null;
  sparkles: number;
};

const PALETTE: Record<ChestTier, Palette> = {
  WOOD: {
    L: "#C99A66",
    B: "#A26F40",
    D: "#7A4F2A",
    X: "#573619",
    H: "#E2C29A",
    tL: "#A8A4BE",
    tB: "#77738F",
    tD: "#504C68",
    tH: "#D6D3E6",
    inside: "#2E1C0C",
    glow: "#FFD27A",
    gem: "#4CB8F0",
    sparkles: 0,
  },
  SILVER: {
    L: "#F4F7FB",
    B: "#CBD3DE",
    D: "#98A3B4",
    X: "#677285",
    H: "#FFFFFF",
    tL: "#8FB0D6",
    tB: "#5D7FA8",
    tD: "#3E5C82",
    tH: "#C7DAF0",
    inside: "#232A3A",
    glow: "#CDEBFF",
    gem: "#4CB8F0",
    sparkles: 1,
  },
  GOLD: {
    L: "#FFE57F",
    B: "#F7C531",
    D: "#D49A10",
    X: "#9C6A04",
    H: "#FFF7C9",
    tL: "#9C8CFF",
    tB: "#6F5CE0",
    tD: "#4E3DB8",
    tH: "#C9C0FF",
    inside: "#3A2600",
    glow: "#FFE27A",
    gem: "#E22B4C",
    sparkles: 3,
  },
  DIAMOND: {
    L: "#E6FBFF",
    B: "#A3E8FF",
    D: "#5EC6EC",
    X: "#2B8FC2",
    H: "#FFFFFF",
    tL: "#FFFFFF",
    tB: "#DCE6F2",
    tD: "#AFC0D6",
    tH: "#FFFFFF",
    inside: "#0F4F73",
    glow: "#9FF0FF",
    gem: null,
    sparkles: 4,
  },
};

const SPARKLES = [
  { x: 452, y: 128, s: 1, w: 4, delay: "" },
  { x: 58, y: 188, s: 0.75, w: 5, delay: "0.5s" },
  { x: 470, y: 336, s: 0.6, w: 6, delay: "1s" },
  { x: 44, y: 362, s: 0.55, w: 7, delay: "1.5s" },
];

const stroke = (width: number) => ({
  stroke: OUTLINE,
  strokeWidth: width,
  strokeLinejoin: "round" as const,
});

export default function ChestIcon({
  tier,
  size = 112,
  opened = false,
  animate = true,
  className = "",
}: {
  tier: ChestTier;
  size?: number;
  opened?: boolean;
  animate?: boolean;
  className?: string;
}) {
  const uid = "chest" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const p = PALETTE[tier];
  const ref = (name: string) => `url(#${name}${uid})`;
  const gemFill = p.gem ?? ref("rainbow");
  const isWood = tier === "WOOD";
  const isMetal = tier === "SILVER" || tier === "GOLD";
  const trim = ref("trim");
  const rivet = (cx: number, cy: number, r: number, w: number, fill = p.tH) => (
    <circle cx={cx} cy={cy} r={r} fill={fill} stroke={OUTLINE} strokeWidth={w} />
  );

  return (
    <span
      role="img"
      aria-label={`${CHEST_TIER_LABEL[tier]}${opened ? ", opened" : ""}`}
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 512 512"
        width={size}
        height={size}
        aria-hidden
        className={`chest-art${animate ? "" : " chest-art-still"}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`body${uid}`} x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0" stopColor={p.L} />
            <stop offset="0.5" stopColor={p.B} />
            <stop offset="1" stopColor={p.D} />
          </linearGradient>
          <linearGradient id={`lid${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={p.L} />
            <stop offset="0.5" stopColor={p.B} />
            <stop offset="1" stopColor={p.D} />
          </linearGradient>
          <linearGradient id={`under${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={p.B} />
            <stop offset="1" stopColor={p.X} />
          </linearGradient>
          <linearGradient id={`trim${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={p.tL} />
            <stop offset="0.5" stopColor={p.tB} />
            <stop offset="1" stopColor={p.tD} />
          </linearGradient>
          <linearGradient id={`rainbow${uid}`} x1="0" y1="0" x2="1" y2="1">
            {RAINBOW.map((c, i) => (
              <stop key={c} offset={i / (RAINBOW.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
          <radialGradient id={`glow${uid}`} gradientUnits="userSpaceOnUse" cx="256" cy="230" r="270">
            <stop offset="0" stopColor={p.glow} stopOpacity="0.95" />
            <stop offset="0.45" stopColor={p.glow} stopOpacity="0.45" />
            <stop offset="1" stopColor={p.glow} stopOpacity="0" />
          </radialGradient>
          <clipPath id={`clipBody${uid}`}>
            <path d={BODY} />
          </clipPath>
          <clipPath id={`clipLid${uid}`}>
            <path d={LID} />
          </clipPath>
          <clipPath id={`clipOpen${uid}`}>
            <path d={OPEN_LID} />
          </clipPath>
        </defs>

        <g key={opened ? "open" : "closed"} className={opened ? "chest-art-pop" : "chest-art-bob"}>
          <ellipse cx="256" cy="460" rx="178" ry="20" fill={OUTLINE} opacity="0.18" />

          {opened && (
            <g>
              <path className="chest-art-rays" fill={ref("glow")} d={RAYS} />
              <circle className="chest-art-pulse" cx="256" cy="200" r="190" fill={ref("glow")} />
              <circle className="chest-art-ring" cx="256" cy="230" r="150" fill="none" stroke={p.glow} strokeWidth="14" />

              <g className="chest-art-lid">
                <path d={OPEN_LID} fill={ref("under")} />
                <g clipPath={ref("clipOpen")}>
                  <path
                    d="M120 208 L392 208 L422 122 C412 98 340 80 256 80 C172 80 100 98 90 122 Z"
                    fill={p.inside}
                    opacity="0.35"
                  />
                  <path d="M136 40 L176 40 L176 218 L136 218 Z" fill={trim} {...stroke(8)} />
                  <path d="M336 40 L376 40 L376 218 L336 218 Z" fill={trim} {...stroke(8)} />
                </g>
                <path d={OPEN_LID} fill="none" {...stroke(10)} />
                <path d="M94 198 L418 198 L412 218 L100 218 Z" fill={trim} {...stroke(10)} />
              </g>

              <path d="M84 252 L428 252 L410 214 L102 214 Z" fill={p.inside} {...stroke(10)} />

              <g className="chest-art-float">
                <Coin x={196} y={214} r={24} />
              </g>
              <g className="chest-art-float" style={{ animationDelay: "0.6s" }}>
                <Coin x={306} y={206} r={22} />
              </g>
              <g className="chest-art-float" style={{ animationDelay: "1.2s" }}>
                <g transform="translate(252 200)">
                  <path d="M0 -24 L18 -4 L0 24 L-18 -4 Z" fill={gemFill} {...stroke(6)} />
                  <path
                    d="M-18 -4 L18 -4 M0 -24 L-6 -4 L0 24 M0 -24 L6 -4"
                    fill="none"
                    {...stroke(3)}
                    opacity="0.45"
                  />
                  <path d="M-8 -12 L-2 -18" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
                </g>
              </g>
              <g className="chest-art-float" style={{ animationDelay: "1.8s" }}>
                <Coin x={150} y={196} r={16} />
              </g>

              <ellipse className="chest-art-pulse" cx="256" cy="240" rx="128" ry="13" fill={p.glow} />
            </g>
          )}

          <path d={BODY} fill={ref("body")} />
          <g clipPath={ref("clipBody")}>
            {isWood && (
              <g>
                <path d="M84 316 L428 316 M84 382 L428 382" stroke={p.X} strokeWidth="6" opacity="0.6" />
                <path
                  d="M190 290 C220 280 250 298 290 286 M196 352 C236 340 268 360 318 346 M186 418 C222 406 262 424 302 412"
                  fill="none"
                  stroke={p.D}
                  strokeWidth="5"
                  strokeLinecap="round"
                  opacity="0.55"
                />
                <ellipse cx="226" cy="350" rx="11" ry="6" fill="none" stroke={p.X} strokeWidth="4" opacity="0.5" />
              </g>
            )}
            {isMetal && (
              <g>
                <path d="M190 448 L262 250 L300 250 L228 448 Z" fill={p.H} opacity="0.5" />
                <path d="M250 448 L322 250 L338 250 L266 448 Z" fill={p.H} opacity="0.35" />
              </g>
            )}
            {tier === "SILVER" && (
              <g>
                <path d="M84 338 L428 338 L428 362 L84 362 Z" fill={p.D} stroke={OUTLINE} strokeWidth="6" />
                {[112, 222, 290, 400].map((x) => (
                  <circle key={x} cx={x} cy="350" r="6" fill={p.H} stroke={OUTLINE} strokeWidth="3" />
                ))}
              </g>
            )}
            {tier === "GOLD" && (
              <g>
                <path
                  d="M256 404 C236 378 200 386 206 412 C210 430 234 428 232 412 M256 404 C276 378 312 386 306 412 C302 430 278 428 280 412"
                  fill="none"
                  stroke={p.X}
                  strokeWidth="6"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                {rivet(256, 404, 7, 4, p.H)}
              </g>
            )}
            {tier === "DIAMOND" && (
              <g>
                <path d="M84 250 L170 349 L256 250 Z" fill="#FFFFFF" opacity="0.4" />
                <path d="M342 349 L428 250 L428 448 Z" fill={p.D} opacity="0.45" />
                <path d="M256 448 L342 349 L428 448 Z" fill="#FFFFFF" opacity="0.25" />
                <path
                  d="M84 250 L170 349 L84 448 M170 349 L256 250 M170 349 L256 448 M256 250 L342 349 L256 448 M342 349 L428 250 M342 349 L428 448"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="4"
                  strokeLinejoin="round"
                  opacity="0.75"
                />
              </g>
            )}
            <path d="M84 420 L428 420 L428 448 L84 448 Z" fill={p.X} />
            <path d="M84 420 L428 420" stroke={OUTLINE} strokeWidth="6" />
          </g>
          <path d="M102 292 L102 400" stroke={p.H} strokeWidth="10" strokeLinecap="round" opacity="0.65" />
          <path d={BODY} fill="none" {...stroke(10)} />

          <path d="M136 250 L176 250 L176 448 L136 448 Z" fill={trim} {...stroke(8)} />
          <path d="M336 250 L376 250 L376 448 L336 448 Z" fill={trim} {...stroke(8)} />
          <path d="M146 290 L146 404 M346 290 L346 404" stroke={p.tH} strokeWidth="5" strokeLinecap="round" opacity="0.7" />
          {rivet(156, 420, 7, 4)}
          {rivet(356, 420, 7, 4)}
          <path d="M84 398 L122 398 L122 448 L104 448 Q84 448 84 428 Z" fill={trim} {...stroke(8)} />
          <path d="M428 398 L390 398 L390 448 L408 448 Q428 448 428 428 Z" fill={trim} {...stroke(8)} />
          {rivet(103, 422, 6, 4)}
          {rivet(409, 422, 6, 4)}

          {opened ? (
            <g>
              <path d="M84 250 L428 250 L428 272 L84 272 Z" fill={trim} {...stroke(9)} />
              <path
                d="M232 262 L280 262 L280 296 C280 308 268 316 256 318 C244 316 232 308 232 296 Z"
                fill={trim}
                {...stroke(8)}
              />
              <circle cx="256" cy="290" r="8" fill={gemFill} stroke={OUTLINE} strokeWidth="5" />
            </g>
          ) : (
            <g>
              <path d={LID} fill={ref("lid")} />
              <g clipPath={ref("clipLid")}>
                {isWood && (
                  <g>
                    <path
                      d="M74 206 C110 168 180 152 256 152 C332 152 402 168 438 206"
                      fill="none"
                      stroke={p.X}
                      strokeWidth="6"
                      opacity="0.6"
                    />
                    <path
                      d="M196 186 C226 176 260 194 298 182 M204 124 C232 116 262 128 292 120"
                      fill="none"
                      stroke={p.D}
                      strokeWidth="5"
                      strokeLinecap="round"
                      opacity="0.55"
                    />
                  </g>
                )}
                {isMetal && (
                  <g>
                    <path d="M196 262 L248 94 L284 94 L232 262 Z" fill={p.H} opacity="0.5" />
                    <path d="M250 262 L302 94 L316 94 L264 262 Z" fill={p.H} opacity="0.35" />
                  </g>
                )}
                {tier === "GOLD" && (
                  <path
                    d="M256 186 C240 164 210 170 214 192 C217 206 234 204 233 194 M256 186 C272 164 302 170 298 192 C295 206 278 204 279 194"
                    fill="none"
                    stroke={p.X}
                    strokeWidth="6"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                )}
                {tier === "DIAMOND" && (
                  <g>
                    <path d="M140 110 L206 262 L74 262 Z" fill="#FFFFFF" opacity="0.35" />
                    <path d="M338 262 L404 118 L438 200 L438 262 Z" fill={p.D} opacity="0.45" />
                    <path
                      d="M74 262 L140 110 L206 262 L272 96 L338 262 L404 118 M140 110 L272 96"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="4"
                      strokeLinejoin="round"
                      opacity="0.75"
                    />
                  </g>
                )}
                <path d="M136 80 L176 80 L176 262 L136 262 Z" fill={trim} {...stroke(8)} />
                <path d="M336 80 L376 80 L376 262 L336 262 Z" fill={trim} {...stroke(8)} />
                <path className="chest-art-glint" d="M60 70 L100 70 L56 280 L16 280 Z" fill="#FFFFFF" opacity="0.55" />
              </g>
              <path
                d="M96 216 C96 180 108 156 124 142"
                fill="none"
                stroke={p.H}
                strokeWidth="12"
                strokeLinecap="round"
                opacity="0.8"
              />
              <path
                d="M196 116 C212 110 226 107 240 106"
                fill="none"
                stroke={p.H}
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.7"
              />
              <path d={LID} fill="none" {...stroke(10)} />
              <path d="M70 232 L442 232 L442 264 L70 264 Z" fill={trim} {...stroke(10)} />
              <path d="M82 242 L230 242" stroke={p.tH} strokeWidth="5" strokeLinecap="round" opacity="0.7" />
              {rivet(96, 248, 6, 4)}
              {rivet(416, 248, 6, 4)}

              <path
                d="M220 214 L292 214 L292 280 C292 308 276 324 256 334 C236 324 220 308 220 280 Z"
                fill={trim}
                {...stroke(10)}
              />
              <path d="M232 228 L232 278" stroke={p.tH} strokeWidth="5" strokeLinecap="round" opacity="0.8" />
              {isWood ? (
                <g>
                  <circle cx="256" cy="262" r="12" fill={OUTLINE} />
                  <path d="M249 268 L263 268 L268 300 L244 300 Z" fill={OUTLINE} />
                </g>
              ) : (
                <g>
                  <path d="M256 236 L282 266 L256 310 L230 266 Z" fill={gemFill} {...stroke(7)} />
                  <path
                    d="M230 266 L282 266 M256 236 L248 266 L256 310 M256 236 L264 266"
                    fill="none"
                    {...stroke(3)}
                    opacity="0.4"
                  />
                  <path d="M244 258 L252 248" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
                </g>
              )}
            </g>
          )}

          {SPARKLES.slice(0, p.sparkles).map((s) => (
            <g key={s.x} transform={`translate(${s.x} ${s.y}) scale(${s.s})`}>
              <path
                className="chest-art-twinkle"
                d={SPARKLE}
                fill="#FFFFFF"
                {...stroke(s.w)}
                style={s.delay ? { animationDelay: s.delay } : undefined}
              />
            </g>
          ))}
        </g>
      </svg>
    </span>
  );
}

function Coin({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill="#F7C531" stroke={OUTLINE} strokeWidth={r > 20 ? 7 : 6} />
      <circle r={r / 2} fill="none" stroke="#D49A10" strokeWidth={r > 20 ? 5 : 4} />
      {r > 20 && (
        <path
          d={`M${-r * 0.54} ${-r * 0.32} C${-r * 0.37} ${-r * 0.58} ${-r * 0.12} ${-r * 0.7} ${r * 0.17} ${-r * 0.7}`}
          fill="none"
          stroke="#FFF7C9"
          strokeWidth="5"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}
