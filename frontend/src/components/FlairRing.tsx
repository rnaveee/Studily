import { FLAIR_STATIC_MAX, glowShadow, ringGap, ringWidth, type FlairRing as Ring } from "../lib/flairs";

export default function FlairRing({ ring, size, animate }: { ring: Ring; size: number; animate: boolean }) {
  const band = ringWidth(size) - ringGap(size);
  const mask = `radial-gradient(closest-side, transparent calc(100% - ${band + 0.6}px), #000 calc(100% - ${band}px), #000 calc(100% - 0.6px), transparent 100%)`;
  const soft = size > FLAIR_STATIC_MAX;

  return (
    <span aria-hidden className="flair-ring">
      {ring.glow && (
        <span
          className={`flair-glow ${animate && ring.glowAnim ? `flair-${ring.glowAnim}` : ""}`}
          style={{
            boxShadow: glowShadow(ring.glow, size),
            animationDuration: animate && ring.glowSeconds ? `${ring.glowSeconds}s` : undefined,
            opacity: animate ? undefined : 0.85,
          }}
        />
      )}
      <span className="flair-band" style={{ WebkitMaskImage: mask, maskImage: mask }}>
        {ring.layers.map((layer, i) => {
          if (layer.detail && !soft) return null;
          const motion = animate
            ? layer.spin
              ? layer.spin > 0
                ? "flair-spin"
                : "flair-spin-rev"
              : layer.twinkle
                ? "flair-twinkle"
                : ""
            : "";
          const seconds = layer.spin ? Math.abs(layer.spin) : layer.twinkle;
          const blur = soft && layer.blur ? layer.blur : 0;
          return (
            <span
              key={i}
              className={`flair-layer ${motion}`}
              style={{
                background: layer.background,
                opacity: layer.opacity,
                filter: blur ? `blur(${blur}px)` : undefined,
                inset: blur ? -blur * 2 : undefined,
                animationDuration: motion && seconds ? `${seconds}s` : undefined,
              }}
            />
          );
        })}
      </span>
    </span>
  );
}
