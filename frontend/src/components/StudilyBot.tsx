import { useId } from "react";
import {
  BOT_COLORS as C,
  BOT_HEAD,
  BOT_HEAD_VIEW,
  BOT_LEGS,
  BOT_LOGO_MARK,
  BOT_LOGO_TF,
  BOT_PLUMES,
  BOT_POSE_EXPRESSION,
  BOT_POSES,
  BOT_TORSO,
  BOT_VIEW,
  botLettering,
  botOutfit,
  limbAt,
  limbPath,
  limbSegment,
  limbSub,
  type BotBottomStyle,
  type BotEmblem,
  type BotExpression,
  type BotLimb,
  type BotPaint,
  type BotPose,
  type BotTopStyle,
} from "../lib/botArt";

function PaintDef({ id, paint, animate, y0, y1 }: { id: string; paint: BotPaint; animate: boolean; y0: number; y1: number }) {
  if (paint.kind === "solid") return null;
  if (paint.kind === "plaid") {
    return (
      <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
        <rect width="14" height="14" fill={paint.base} />
        <rect y="5" width="14" height="4" fill={paint.band} opacity="0.75" />
        <rect x="5" width="4" height="14" fill={paint.band} opacity="0.55" />
        <rect y="11.5" width="14" height="1" fill={paint.line} opacity="0.6" />
        <rect x="11.5" width="1" height="14" fill={paint.line} opacity="0.6" />
      </pattern>
    );
  }
  const n = paint.stops.length - 1;
  const coords = paint.diagonal ? { x1: 60, y1: y0, x2: 180, y2: y1 } : { x1: 0, y1: y0, x2: 0, y2: y1 };
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" {...coords}>
      {paint.stops.map((c, i) => (
        <stop key={i} offset={i / n} stopColor={c} />
      ))}
      {animate && paint.shimmer && (
        <animateTransform
          attributeName="gradientTransform"
          type="rotate"
          values="0 120 200;40 120 200;0 120 200"
          dur="6s"
          repeatCount="indefinite"
        />
      )}
    </linearGradient>
  );
}

function paintRef(paint: BotPaint, id: string): string {
  return paint.kind === "solid" ? paint.color : `url(#${id})`;
}

function Face({ expression, animate }: { expression: BotExpression; animate: boolean }) {
  const blink = animate;
  if (expression === "sleepy") {
    return (
      <g>
        <path d="M93 112 Q100 117 107 112" fill="none" stroke={C.ink} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M135 114 Q142 119 149 114" fill="none" stroke={C.ink} strokeWidth="3.4" strokeLinecap="round" />
        <ellipse cx="122" cy="136" rx="5" ry="4" fill={C.ink} />
        <g fill="none" stroke={C.ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M168 72 L178 72 L168 82 L178 82">
            {animate && <animate attributeName="opacity" values="0;1;1;0" dur="3s" repeatCount="indefinite" />}
          </path>
          <path d="M184 56 L191 56 L184 63 L191 63" strokeWidth="2.2">
            {animate && <animate attributeName="opacity" values="0;0;1;0" dur="3s" repeatCount="indefinite" />}
          </path>
        </g>
      </g>
    );
  }
  if (expression === "love") {
    const heart = "M0 5 C-9 -2 -9 -10 -4.5 -10 C-2 -10 0 -8 0 -6 C0 -8 2 -10 4.5 -10 C9 -10 9 -2 0 5 Z";
    return (
      <g>
        <path d={heart} transform="translate(100 114)" fill={C.heart} />
        <path d={heart} transform="translate(142 116)" fill={C.heart} />
        <path d="M103 127 Q122 131 141 126 Q140 149 122 150 Q105 149 103 127 Z" fill={C.ink} />
        <path d="M111 144 Q122 136 133 143 Q123 151 111 144 Z" fill={C.tongue} />
      </g>
    );
  }
  if (expression === "proud") {
    return (
      <g>
        <path d="M93 113 Q100 104 107 113" fill="none" stroke={C.ink} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M135 115 Q142 106 149 115" fill="none" stroke={C.ink} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M98 126 Q122 132 146 125 Q143 151 122 152 Q101 151 98 126 Z" fill={C.ink} />
        <path d="M110 145 Q122 136 135 144 Q123 153 110 145 Z" fill={C.tongue} />
      </g>
    );
  }
  if (expression === "curious") {
    return (
      <g>
        <g transform="translate(100 110)">
          <ellipse rx="6.5" ry="9" fill={C.ink}>{blink && <animate attributeName="ry" values="9;9;1;9" keyTimes="0;0.93;0.96;1" dur="4.5s" repeatCount="indefinite" />}</ellipse>
          <circle cx="2.2" cy="-3.4" r="2.2" fill="#fff" />
        </g>
        <g transform="translate(142 113)">
          <ellipse rx="5" ry="6.5" fill={C.ink}>{blink && <animate attributeName="ry" values="6.5;6.5;0.8;6.5" keyTimes="0;0.93;0.96;1" dur="4.5s" repeatCount="indefinite" />}</ellipse>
          <circle cx="1.6" cy="-2.4" r="1.6" fill="#fff" />
        </g>
        <path d="M134 100 Q142 94 151 99" fill="none" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="124" cy="138" rx="6" ry="7" fill={C.ink} />
      </g>
    );
  }
  return (
    <g>
      <g transform="translate(100 110)">
        <ellipse rx="5.5" ry="7.5" fill={C.ink}>{blink && <animate attributeName="ry" values="7.5;7.5;0.8;7.5" keyTimes="0;0.93;0.96;1" dur="4.5s" repeatCount="indefinite" />}</ellipse>
        <circle cx="1.8" cy="-2.8" r="1.9" fill="#fff" />
      </g>
      <g transform="translate(142 112)">
        <ellipse rx="5.5" ry="7.5" fill={C.ink}>{blink && <animate attributeName="ry" values="7.5;7.5;0.8;7.5" keyTimes="0;0.93;0.96;1" dur="4.5s" repeatCount="indefinite" />}</ellipse>
        <circle cx="1.8" cy="-2.8" r="1.9" fill="#fff" />
      </g>
      <path d="M103 127 Q122 131 141 126 Q140 149 122 150 Q105 149 103 127 Z" fill={C.ink} />
      <path d="M111 144 Q122 136 133 143 Q123 151 111 144 Z" fill={C.tongue} />
    </g>
  );
}

function Arm({
  side,
  limb,
  top,
  sleeveFill,
  wave,
}: {
  side: "l" | "r";
  limb: BotLimb;
  top: BotTopStyle | null;
  sleeveFill: string;
  wave: boolean;
}) {
  const cuffStroke = top ? top.band : null;
  return (
    <g className={`sb-arm-${side}`}>
    <g>
      {wave && (
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`0 ${limb.s[0]} ${limb.s[1]};-9 ${limb.s[0]} ${limb.s[1]};0 ${limb.s[0]} ${limb.s[1]}`}
          dur="1.3s"
          repeatCount="indefinite"
        />
      )}
      <path d={limbPath(limb)} fill="none" stroke={C.limb} strokeWidth="9" strokeLinecap="round" />
      {top?.cut === "tee" ? (
        <>
          <path d={limbSub(limb, 0.38)} fill="none" stroke={sleeveFill} strokeWidth="17" />
          <path d={limbSegment(limb, 0.31, 0.38)} fill="none" stroke={top.band} strokeWidth="17.5" />
        </>
      ) : top && (
        <>
          <path d={limbPath({ ...limb, e: limbAt(limb, 0.86) })} fill="none" stroke={sleeveFill} strokeWidth="15" strokeLinecap="round" />
          {cuffStroke && <path d={limbSegment(limb, 0.8, 0.88)} fill="none" stroke={cuffStroke} strokeWidth="16" strokeLinecap="butt" />}
        </>
      )}
    </g>
    </g>
  );
}

function Emblem({ emblem, bg }: { emblem: BotEmblem; bg: string }) {
  const line = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (emblem.kind) {
    case "letters": {
      const { d, width } = botLettering(emblem.text);
      return <path d={d} stroke={emblem.ink} strokeWidth={width} {...line} />;
    }
    case "circuit":
      return (
        <g>
          <path d="M92 221 L92 206 L100 198 L100 187 M106 221 L106 211 L112 205 M134 221 L134 211 L126 203 L126 190 M148 221 L148 201 L140 193" stroke={emblem.ink} strokeWidth="1.8" {...line} />
          {[[100, 187], [112, 205], [126, 190], [140, 193]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" fill={emblem.ink} />
          ))}
          <rect x="113" y="207" width="14" height="10" rx="2" fill={emblem.ink} />
          <path d="M116.5 217 L116.5 221 M120 217 L120 221 M123.5 217 L123.5 221" stroke={emblem.ink} strokeWidth="1.4" {...line} />
          <circle cx="120" cy="212" r="1.6" fill={bg} />
        </g>
      );
    case "brain":
      return (
        <g>
          <path d="M120 203 C116 199 109 200 108 205 C104 206 104 212 108 214 C109 218 115 219 118 216 L122 216 C125 219 131 218 132 214 C136 212 136 206 132 205 C131 200 124 199 120 203 Z" fill={emblem.ink} />
          <path d="M120 204 L120 216 M110.5 208.5 Q113.5 206 116.5 208.5 M111 212.5 Q114 211 117 213 M123.5 208.5 Q126.5 206 129.5 208.5 M123 213 Q126 211 129 212.5" stroke={bg} strokeWidth="1.3" {...line} />
        </g>
      );
    case "dna":
      return (
        <g>
          <path d="M117 202.3 L123 202.3 M116 206.6 L124 206.6 M116 213.4 L124 213.4 M117 217.7 L123 217.7" stroke={emblem.accent} strokeWidth="1.7" {...line} />
          <path d="M114 199 Q130 204.5 120 210 Q110 215.5 126 221 M126 199 Q110 204.5 120 210 Q130 215.5 114 221" stroke={emblem.ink} strokeWidth="2.3" {...line} />
        </g>
      );
    case "code":
      return <path d="M111 204 L105 210 L111 216 M123 202 L117 218 M129 204 L135 210 L129 216" stroke={emblem.ink} strokeWidth="2.6" {...line} />;
    case "math":
      return <path d="M108.5 204 Q110 202 113 202.5 L131.5 202.5 M114.5 202.5 Q115 212 112 217.5 M125 202.5 Q124 214 129.5 217" stroke={emblem.ink} strokeWidth="2.6" {...line} />;
    case "studily": {
      const s = emblem.size / BOT_LOGO_MARK.width;
      const [cx, cy] = BOT_LOGO_MARK.center;
      const plumeOpacity = [0.62, 0.8, 1];
      return (
        <g transform={`translate(${emblem.x} ${emblem.y}) scale(${s.toFixed(3)}) translate(${-cx} ${-cy})`}>
          {BOT_PLUMES.map((p, i) => (
            <path key={i} d={p.d} fill={emblem.mono ?? p.fill} opacity={emblem.mono ? plumeOpacity[i] : 1} />
          ))}
          <path d={BOT_LOGO_MARK.board} fill={emblem.mono ?? C.board} />
          <path d={BOT_LOGO_MARK.shade} fill={emblem.mono ? emblem.shade ?? emblem.mono : C.boardShade} />
        </g>
      );
    }
  }
}

function Top({ top, bodyFill }: { top: BotTopStyle; bodyFill: string }) {
  if (top.cut === "tee") {
    return (
      <g>
        <path d="M84 182 Q84 158 108 158 L132 158 Q156 158 156 182 L157 224 L83 224 Z" fill={bodyFill} />
        <rect x="83" y="219" width="74" height="6" rx="3" fill={top.band} />
        {top.emblem && <Emblem emblem={top.emblem} bg={top.band} />}
        <path d="M103 160 Q120 176 137 160" fill="none" stroke={top.collar ?? top.band} strokeWidth="4.5" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <path d="M84 184 Q84 158 108 158 L132 158 Q156 158 156 184 L158 226 L82 226 Z" fill={bodyFill} />
      <rect x="82" y="222" width="76" height="13" rx="6.5" fill={top.band} />
      {top.bandStripe && <rect x="84" y="227.3" width="72" height="2.4" fill={top.bandStripe} />}
      {top.cut === "hoodie" ? (
        <path d="M98 198 L142 198 Q148 198 149 204 L151 222 L89 222 L91 204 Q92 198 98 198 Z" fill={top.pocket ?? top.band} />
      ) : (
        <>
          <path d="M94 202 L101 219" stroke={top.pocket ?? top.band} strokeWidth="3" strokeLinecap="round" />
          <path d="M146 202 L139 219" stroke={top.pocket ?? top.band} strokeWidth="3" strokeLinecap="round" />
          <path d="M120 166 L120 224" stroke="#e5e7eb" strokeWidth="3" />
          <path d="M120 168 L120 222" stroke="#9ca3af" strokeWidth="3" strokeDasharray="1.2 2.2" />
          <rect x="116.5" y="180" width="7" height="12" rx="2.5" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1" />
        </>
      )}
      {top.emblem && <Emblem emblem={top.emblem} bg={top.pocket ?? top.band} />}
      {top.patch && (
        <g>
          <circle cx="120" cy="210" r="9.5" fill={top.patch.fill} />
          <path d="M123.5 205.5 Q120 202.8 117 205.2 Q115 208.4 120 209.8 Q125 211.2 123 214.8 Q120 217.6 116.4 215" fill="none" stroke={top.patch.ink} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )}
      <path d="M84 180 Q80 150 120 147 Q160 150 156 180 Q140 168 120 168 Q100 168 84 180 Z" fill={top.hood ?? top.band} />
      {top.strings && (
        <g stroke={top.strings} strokeWidth="2.4" strokeLinecap="round">
          <path d="M112 170 L110 192" />
          <path d="M128 170 L130 192" />
          <circle cx="110" cy="194" r="1.6" fill={top.strings} />
          <circle cx="130" cy="194" r="1.6" fill={top.strings} />
        </g>
      )}
    </g>
  );
}

function Bottom({ bottom, fill }: { bottom: BotBottomStyle; fill: string }) {
  const end = bottom.cut === "shorts" ? 250 : 264;
  const lx = (y: number) => 105.5 - ((y - 230) / 38) * 2;
  const rx = (y: number) => 134.5 + ((y - 230) / 38) * 2;
  const cuffTop = end - 7;
  const legs = [
    { side: "l", x0: 105.5, x: lx, hx: 107, flapX: 87, seamDx: -6 },
    { side: "r", x0: 134.5, x: rx, hx: 137, flapX: 142, seamDx: 6 },
  ];
  return (
    <g>
      <path d="M92 216 L148 216 Q152 216 152 220 L154 250 L86 250 L88 220 Q88 216 92 216 Z" fill={fill} />
      <rect x="88" y="215" width="64" height="7" rx="3.5" fill={bottom.cuff} />
      {bottom.seam && <path d="M120 222 L120 246" stroke={bottom.seam} strokeWidth="1.3" strokeDasharray="2.6 2.4" fill="none" />}
      {legs.map((l) => (
        <g key={l.side} className={`sb-leg-${l.side}`}>
          <path d={`M${l.x0} 230 L${l.x(end)} ${end}`} stroke={fill} strokeWidth="18" />
          {bottom.highlight && (
            <path d={`M${l.hx} 247 L${l.x(258) + 2} 258`} stroke={bottom.highlight} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
          )}
          {bottom.seam && (
            <path
              d={`M${l.side === "l" ? 95 : 145} 232 L${l.x(cuffTop) + l.seamDx} ${cuffTop}`}
              stroke={bottom.seam}
              strokeWidth="1.3"
              strokeDasharray="2.6 2.4"
              fill="none"
            />
          )}
          {bottom.flap && (
            <g fill={bottom.flap}>
              <rect x={l.flapX} y="230" width="11" height="14" rx="2" />
              <rect x={l.flapX} y="230" width="11" height="4" rx="1.5" fill={bottom.cuff} />
            </g>
          )}
          <path d={`M${l.x(cuffTop)} ${cuffTop} L${l.x(end)} ${end}`} stroke={bottom.cuff} strokeWidth="20" />
        </g>
      ))}
      {bottom.stripe && (
        <path d="M90.5 223 L88.8 249 M149.5 223 L151.2 249" stroke={bottom.stripe} strokeWidth="3" strokeLinecap="round" />
      )}
    </g>
  );
}

export default function StudilyBot({
  pose = "idle",
  expression,
  top = null,
  bottom = null,
  size = 120,
  animate = false,
  crop = "full",
  title,
}: {
  pose?: BotPose;
  expression?: BotExpression;
  top?: string | null;
  bottom?: string | null;
  size?: number;
  animate?: boolean;
  crop?: "full" | "head";
  title?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const arms = BOT_POSES[pose];
  const face = expression ?? BOT_POSE_EXPRESSION[pose];
  const topItem = botOutfit(top, "top");
  const bottomItem = botOutfit(bottom, "bottom");
  const topStyle = topItem?.slot === "top" ? topItem.style : null;
  const bottomStyle = bottomItem?.slot === "bottom" ? bottomItem.style : null;
  const ids = { body: `sb-tb-${uid}`, sleeve: `sb-ts-${uid}`, pants: `sb-bp-${uid}` };
  const bodyFill = topStyle ? paintRef(topStyle.body, ids.body) : "";
  const sleeveFill = topStyle ? paintRef(topStyle.sleeve, ids.sleeve) : "";
  const pantsFill = bottomStyle ? paintRef(bottomStyle.body, ids.pants) : "";
  const view = crop === "head" ? BOT_HEAD_VIEW : BOT_VIEW;
  const height = (size * view.h) / view.w;

  return (
    <svg
      width={size}
      height={height}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      overflow={crop === "head" ? "hidden" : "visible"}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {topStyle && <PaintDef id={ids.body} paint={topStyle.body} animate={animate} y0={150} y1={250} />}
        {topStyle && <PaintDef id={ids.sleeve} paint={topStyle.sleeve} animate={animate} y0={120} y1={250} />}
        {bottomStyle && <PaintDef id={ids.pants} paint={bottomStyle.body} animate={animate} y0={216} y1={266} />}
      </defs>
      <g className="sb-body">
      <g>
        {animate && (
          <animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="2.6s" repeatCount="indefinite" />
        )}
        {[BOT_LEGS.left, BOT_LEGS.right].map(([a, b], i) => (
          <path key={i} className={i === 0 ? "sb-leg-l" : "sb-leg-r"} d={`M${a[0]} ${a[1]} L${b[0]} ${b[1]}`} stroke={C.limb} strokeWidth="11" strokeLinecap="round" />
        ))}
        <Arm side="l" limb={arms.left} top={topStyle} sleeveFill={sleeveFill} wave={false} />
        <Arm side="r" limb={arms.right} top={topStyle} sleeveFill={sleeveFill} wave={animate && pose === "wave"} />
        <rect x={BOT_TORSO.x} y={BOT_TORSO.y} width={BOT_TORSO.w} height={BOT_TORSO.h} rx={BOT_TORSO.r} fill={C.torso} />
        {bottomStyle && <Bottom bottom={bottomStyle} fill={pantsFill} />}
        {topStyle && <Top top={topStyle} bodyFill={bodyFill} />}
        <g className="sb-head">
        <g transform={BOT_HEAD.tilt}>
          <g transform={BOT_LOGO_TF}>
            {BOT_PLUMES.map((p, i) => (
              <path key={i} d={p.d} fill={p.fill} />
            ))}
          </g>
          <path d={BOT_HEAD.board} fill={C.board} />
          <path d={BOT_HEAD.shade} fill={C.boardShade} />
          <path d={BOT_HEAD.rim} fill="none" stroke={C.rim} strokeWidth="3" opacity="0.55" />
          <Face expression={face} animate={animate} />
        </g>
        </g>
      </g>
      </g>
    </svg>
  );
}
