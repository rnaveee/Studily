import {
  Atom,
  BookOpen,
  Calculator,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  Pencil,
  Sigma,
  type LucideIcon,
} from "lucide-react";

interface Doodle {
  Icon: LucideIcon;
  left: string;
  top: string;
  size: number;
  color: string;
  dur: number;
  delay: number;
  tilt: number;
  wide?: boolean;
}

interface Layout {
  center: string;
  glow: number;
  inner: number;
  outer: number;
  grid: number;
  fadeOrbits: boolean;
  doodles: Doodle[];
}

const LAYOUTS: Record<"hero" | "tile", Layout> = {
  hero: {
    center: "36%",
    glow: 340,
    inner: 250,
    outer: 360,
    grid: 22,
    fadeOrbits: true,
    doodles: [
      { Icon: BookOpen, left: "12%", top: "20%", size: 30, color: "var(--accent)", dur: 6.5, delay: 0, tilt: -12 },
      { Icon: Atom, left: "82%", top: "16%", size: 32, color: "var(--green)", dur: 7.5, delay: 1.2, tilt: 10 },
      { Icon: Pencil, left: "22%", top: "58%", size: 24, color: "var(--orange-vivid)", dur: 5.5, delay: 0.6, tilt: 18 },
      { Icon: Calculator, left: "74%", top: "54%", size: 26, color: "var(--orange-vivid)", dur: 6.8, delay: 2, tilt: -8 },
      { Icon: Lightbulb, left: "30%", top: "8%", size: 24, color: "var(--yellow)", dur: 5.8, delay: 1.6, tilt: 6, wide: true },
      { Icon: FlaskConical, left: "88%", top: "70%", size: 24, color: "var(--green)", dur: 7, delay: 0.3, tilt: 14, wide: true },
      { Icon: Sigma, left: "66%", top: "6%", size: 22, color: "var(--accent)", dur: 6.2, delay: 2.4, tilt: -14, wide: true },
      { Icon: GraduationCap, left: "6%", top: "70%", size: 28, color: "var(--accent)", dur: 7.8, delay: 1, tilt: -6, wide: true },
    ],
  },
  tile: {
    center: "52%",
    glow: 220,
    inner: 150,
    outer: 215,
    grid: 16,
    fadeOrbits: false,
    doodles: [
      { Icon: BookOpen, left: "14%", top: "30%", size: 14, color: "var(--accent)", dur: 6.5, delay: 0, tilt: -12 },
      { Icon: Atom, left: "86%", top: "34%", size: 14, color: "var(--green)", dur: 7.5, delay: 1.2, tilt: 10 },
      { Icon: Pencil, left: "16%", top: "70%", size: 13, color: "var(--orange-vivid)", dur: 5.5, delay: 0.6, tilt: 18 },
      { Icon: Lightbulb, left: "84%", top: "68%", size: 13, color: "var(--yellow)", dur: 5.8, delay: 1.6, tilt: 6 },
    ],
  },
};

export default function BotBackdrop({ variant = "hero" }: { variant?: "hero" | "tile" }) {
  const l = LAYOUTS[variant];
  const lift = l.fadeOrbits ? 90 : 0;
  const fade = l.fadeOrbits ? `linear-gradient(to bottom, #000 ${lift + 190}px, transparent ${lift + 290}px)` : "none";
  const ring = (size: number) => ({ top: l.center, width: size, height: size });

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 ${variant === "hero" ? "overflow-x-clip" : "overflow-hidden"}`}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(color-mix(in srgb, var(--fg-3) 32%, transparent) 1px, transparent 1.2px)",
          backgroundSize: `${l.grid}px ${l.grid}px`,
          maskImage: `radial-gradient(ellipse 60% 70% at 50% ${l.center}, #000 30%, transparent 75%)`,
          WebkitMaskImage: `radial-gradient(ellipse 60% 70% at 50% ${l.center}, #000 30%, transparent 75%)`,
        }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          top: l.center,
          width: l.glow,
          height: l.glow,
          background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 26%, transparent) 0%, transparent 68%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0" style={{ top: -lift, maskImage: fade, WebkitMaskImage: fade }}>
        <div className="absolute inset-x-0 bottom-0" style={{ top: lift }}>
        <div
          className="hero-orbit absolute left-1/2 rounded-full"
          style={{ ...ring(l.inner), border: "1.5px dashed color-mix(in srgb, var(--accent) 30%, transparent)" }}
        >
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 rounded-full" style={{ background: "var(--accent)" }} />
        </div>
        <div
          className="hero-orbit hero-orbit-rev absolute left-1/2 rounded-full"
          style={{ ...ring(l.outer), border: "1px solid color-mix(in srgb, var(--accent) 16%, transparent)" }}
        >
          <span className="absolute bottom-[14%] left-[4%] h-2.5 w-2.5 rounded-full" style={{ background: "var(--orange-vivid)" }} />
          <span className="absolute right-[6%] top-[18%] h-2 w-2 rounded-full" style={{ background: "var(--green)" }} />
        </div>
        </div>
      </div>
      {l.doodles.map(({ Icon, left, top, size, color, dur, delay, tilt, wide }, i) => (
        <span
          key={i}
          className={`hero-doodle absolute ${wide ? "hidden sm:block" : ""}`}
          style={{ left, top, color, ["--tilt" as string]: `${tilt}deg`, animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}
        >
          <span
            className="flex items-center justify-center rounded-2xl"
            style={{
              width: size + (variant === "tile" ? 14 : 22),
              height: size + (variant === "tile" ? 14 : 22),
              borderRadius: variant === "tile" ? 10 : undefined,
              background: `color-mix(in srgb, ${color} 12%, var(--surface))`,
              border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
              boxShadow: "0 6px 18px -10px rgb(14 14 26 / 0.35)",
            }}
          >
            <Icon size={size} strokeWidth={1.7} />
          </span>
        </span>
      ))}
    </div>
  );
}
