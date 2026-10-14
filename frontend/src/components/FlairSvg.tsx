import type { ArtItem, ArtLayer, FlairArt, FlairArtKind } from "../lib/flairArt";

function moves(values: string): boolean {
  return new Set(values.split(";")).size > 1;
}

function Item({ it, animate }: { it: ArtItem; animate: boolean }) {
  const scales = animate && moves(it.sv);
  const fades = animate && moves(it.ov);
  const path = (
    <path
      d={it.d}
      fill={it.fill}
      stroke={it.stroke}
      strokeWidth={it.sw}
      strokeDasharray={it.dash}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={it.op}
    >
      {fades && <animate attributeName="opacity" values={it.ov} dur={`${it.dur}s`} begin={`${it.begin}s`} repeatCount="indefinite" />}
    </path>
  );
  return (
    <g transform={it.tf || undefined}>
      {scales ? (
        <g>
          <animateTransform
            attributeName="transform"
            type="scale"
            values={it.sv}
            dur={`${it.dur}s`}
            begin={`${it.begin}s`}
            repeatCount="indefinite"
          />
          {path}
        </g>
      ) : (
        path
      )}
    </g>
  );
}

function Layer({ layer, animate }: { layer: ArtLayer; animate: boolean }) {
  return (
    <g>
      {animate && layer.to !== 0 && (
        <animateTransform attributeName="transform" type="rotate" from="0" to={layer.to} dur={`${layer.dur}s`} repeatCount="indefinite" />
      )}
      {layer.items.map((it, i) => (
        <Item key={i} it={it} animate={animate} />
      ))}
    </g>
  );
}

export default function FlairSvg({
  art,
  kind,
  unit,
  animate,
  part,
}: {
  art: FlairArt;
  kind: FlairArtKind;
  unit: number;
  animate: boolean;
  part: "back" | "front";
}) {
  const span = 260 * unit;
  const [c0, c1, c2, c3] = art.stops;
  const ringId = `rg-${kind}`;
  const glowId = `gl-${kind}`;

  return (
    <svg
      aria-hidden
      width={span}
      height={span}
      viewBox="-130 -130 260 260"
      overflow="visible"
      className="pointer-events-none absolute"
      style={{ left: "50%", top: "50%", marginLeft: -span / 2, marginTop: -span / 2 }}
    >
      {part === "back" ? (
        <>
          <defs>
            <linearGradient id={ringId} gradientUnits="userSpaceOnUse" x1="0" y1="-90" x2="0" y2="90">
              <stop offset="0" stopColor={c0} />
              <stop offset="0.38" stopColor={c1} />
              <stop offset="0.7" stopColor={c2} />
              <stop offset="1" stopColor={c3} />
            </linearGradient>
            <radialGradient id={glowId} cx="0" cy="0" r="1">
              <stop offset="0" stopColor={art.glow.color} stopOpacity={art.glow.op} />
              <stop offset="0.65" stopColor={art.glow.color} stopOpacity={art.glow.op * 0.55} />
              <stop offset="1" stopColor={art.glow.color} stopOpacity="0" />
            </radialGradient>
          </defs>
          {art.glow.r > 0 && (
            <circle r={art.glow.r} fill={`url(#${glowId})`}>
              {animate && <animate attributeName="opacity" values="1;0.55;1" dur={`${art.glow.dur}s`} repeatCount="indefinite" />}
            </circle>
          )}
          {art.back.map((l, i) => (
            <Layer key={i} layer={l} animate={animate} />
          ))}
          {art.ring.map((it, i) => (
            <Item key={i} it={it} animate={false} />
          ))}
        </>
      ) : (
        art.front.map((l, i) => <Layer key={i} layer={l} animate={animate} />)
      )}
    </svg>
  );
}
