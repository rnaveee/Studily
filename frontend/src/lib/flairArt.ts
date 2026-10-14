export type FlairArtKind =
  | "ember"
  | "blaze"
  | "inferno"
  | "sparkle"
  | "cherry"
  | "frost"
  | "autumn"
  | "storm"
  | "night"
  | "tide"
  | "hearts"
  | "laurel"
  | "arcs"
  | "rainbow"
  | "clover";

export interface ArtItem {
  d: string;
  fill: string;
  stroke: string;
  sw: number;
  dash: string;
  op: number;
  tf: string;
  sv: string;
  ov: string;
  dur: number;
  begin: number;
}

export interface ArtLayer {
  items: ArtItem[];
  to: number;
  dur: number;
}

export interface FlairArt {
  stops: [string, string, string, string];
  glow: { r: number; color: string; op: number; dur: number };
  back: ArtLayer[];
  ring: ArtItem[];
  front: ArtLayer[];
}

export const ART_KINDS: Record<string, FlairArtKind> = {
  ring_ember: "ember",
  ring_blaze: "blaze",
  ring_inferno: "inferno",
  ring_sparkle: "sparkle",
  ring_cherry: "cherry",
  ring_frost: "frost",
  ring_autumn: "autumn",
  ring_storm: "storm",
  ring_night: "night",
  ring_tide: "tide",
  ring_hearts: "hearts",
  ring_laurel: "laurel",
  ring_arcs: "arcs",
  ring_rainbow: "rainbow",
  ring_clover: "clover",
};

export function flairArtKind(code: string | null | undefined): FlairArtKind | null {
  if (!code) return null;
  return ART_KINDS[code] ?? null;
}

export const ART_ANIMATE_MIN = 44;
export const ART_SMALL_MAX = 32;

type Pt = [number, number];

const f = (n: number) => Math.round(n * 10) / 10;
const pol = (r: number, deg: number): Pt => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
};
const pt = (p: Pt) => `${f(p[0])} ${f(p[1])}`;
const circle = (r: number) => `M${f(r)} 0A${f(r)} ${f(r)} 0 1 1 ${f(-r)} 0A${f(r)} ${f(r)} 0 1 1 ${f(r)} 0Z`;
const rot = (x: number, y: number, a: number): Pt => {
  const r = (a * Math.PI) / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
};
const star = (s: number, k: number) => {
  const q = f(k * s);
  return `M0 ${-s}Q${q} ${-q} ${s} 0Q${q} ${q} 0 ${s}Q${-q} ${q} ${-s} 0Q${-q} ${-q} 0 ${-s}Z`;
};

const F2 = "#e3261d";
const F3 = "#ff7a18";
const F4 = "#ffc42e";
const FH = "#fff5d1";

const PETAL: Pt[] = [
  [0, 0],
  [-7, -3],
  [-8, -12],
  [-2.5, -14.5],
  [0, -12.5],
  [2.5, -14.5],
  [8, -12],
  [7, -3],
  [0, 0],
];

function petal(cx: number, cy: number, size: number, a: number): string {
  const p = PETAL.map(([x, y]) => {
    const q = rot((x * size) / 15, (y * size) / 15, a);
    return pt([q[0] + cx, q[1] + cy]);
  });
  return `M${p[0]}C${p[1]} ${p[2]} ${p[3]}L${p[4]}L${p[5]}C${p[6]} ${p[7]} ${p[8]}Z`;
}

export function buildFlairArt(kind: FlairArtKind, small: boolean, still: boolean): FlairArt {
  const quiet = still || small;

  const item = (o: Partial<ArtItem>): ArtItem => {
    const x: ArtItem = {
      d: "",
      fill: "none",
      stroke: "none",
      sw: 0,
      dash: "none",
      op: 1,
      tf: "",
      sv: "1;1",
      ov: "",
      dur: 2,
      begin: 0,
      ...o,
    };
    if (!o.ov || quiet) x.ov = `${x.op};${x.op}`;
    if (quiet) x.sv = "1;1";
    return x;
  };

  const layer = (items: ArtItem[], spin = 0): ArtLayer => ({
    items,
    to: quiet ? 0 : spin > 0 ? 360 : spin < 0 ? -360 : 0,
    dur: spin ? Math.abs(spin) : 10,
  });

  const tips = (n: number, rB: number, H: number, half: number, curl: number, off: number, fill: string, seed: number) => {
    const out: ArtItem[] = [];
    for (let i = 0; i < n; i++) {
      const deg = off + (i * 360) / n;
      const h = H * (0.7 + 0.3 * (0.5 + 0.5 * Math.sin(i * 2.4 + seed)));
      const b1 = pol(rB, deg - half);
      const b2 = pol(rB, deg + half);
      const tip = pol(rB + h, deg + curl);
      const c1 = pol(rB + h * 0.25, deg - half * 0.9);
      const c2 = pol(rB + h * 0.65, deg + curl * 0.3 - half * 0.2);
      const c3 = pol(rB + h * 0.6, deg + curl * 0.9 + half * 0.6);
      const c4 = pol(rB + h * 0.2, deg + half);
      out.push(
        item({
          d: `M${pt(b1)}C${pt(c1)} ${pt(c2)} ${pt(tip)}C${pt(c3)} ${pt(c4)} ${pt(b2)}Z`,
          fill,
          sv: "1;1.06;0.95;1.04;1",
          dur: f(0.8 + ((i * 7) % 5) * 0.17),
          begin: f(-i * 0.37),
        }),
      );
    }
    return out;
  };

  let stops: FlairArt["stops"] = [F2, F3, F4, F3];
  let glow = { r: 0, color: "#000000", op: 0, dur: 2 };
  let back: ArtLayer[] = [];
  let front: ArtLayer[] = [];

  if (kind === "ember") {
    back = [layer(tips(9, 87, 20, 12, 10, 0, F2, 0.5)), layer(tips(9, 87, 13, 9, 8, 20, F3, 1.7))];
  } else if (kind === "blaze") {
    glow = { r: 112, color: F3, op: 0.5, dur: 1.8 };
    back = [
      layer(tips(12, 87, 30, 10, 10, 0, F2, 0.3)),
      layer(tips(12, 87, 22, 8, 8, 15, F3, 1.1)),
      layer(tips(12, 87, 14, 6, 6, 0, F4, 2)),
    ];
  } else if (kind === "inferno") {
    stops = [F2, F3, F4, FH];
    glow = { r: 128, color: F3, op: 0.75, dur: 1.3 };
    back = [
      layer(tips(16, 87, 38, 8, 9, 0, F2, 0.2)),
      layer(tips(16, 87, 30, 7, 8, 11.25, F3, 1.4)),
      layer(tips(16, 87, 22, 6, 7, 0, F4, 2.6)),
      layer(tips(16, 87, 13, 4, 5, 11.25, FH, 3.3)),
    ];
    const embers: Pt[] = [
      [8, 118],
      [55, 122],
      [100, 120],
      [160, 123],
      [215, 119],
      [262, 122],
      [310, 120],
    ];
    const sizes = [4, 5, 3.5, 5, 4, 3.5, 5];
    front = [
      layer(
        embers.map((e, i) =>
          item({
            d: star(sizes[i], 0.45),
            fill: i % 2 ? F4 : FH,
            tf: `translate(${pt(pol(e[1], e[0]))})`,
            sv: "0.5;1.2;0.5",
            ov: "0.2;1;0.2",
            dur: f(1.1 + i * 0.2),
            begin: f(-i * 0.5),
          }),
        ),
      ),
    ];
  } else if (kind === "sparkle") {
    stops = ["#fff3b0", "#ffd23f", "#f5a623", "#ffd23f"];
    glow = { r: 108, color: "#ffd23f", op: 0.35, dur: 2.4 };
    const S = [
      [20, 92, 13, 0],
      [70, 97, 8, 0.7],
      [118, 91, 10, 1.3],
      [170, 99, 15, 0.3],
      [222, 93, 9, 1.1],
      [268, 97, 12, 1.8],
      [318, 91, 8, 0.5],
      [348, 104, 6, 1.5],
      [45, 110, 6, 0.9],
      [200, 112, 7, 1.6],
    ];
    front = [
      layer([item({ d: circle(86), stroke: "#ffffff", sw: 5, dash: "46 600", op: 0.85 })], 5),
      layer(
        S.map((s, i) =>
          item({
            d: star(s[2], 0.2),
            fill: i % 2 ? "#ffe066" : "#fff8d6",
            tf: `translate(${pt(pol(s[1], s[0]))})`,
            sv: "0.45;1.15;0.45",
            ov: "0.35;1;0.35",
            dur: f(1.6 + i * 0.23),
            begin: f(-s[3] * 1.3),
          }),
        ),
      ),
    ];
  } else if (kind === "cherry") {
    stops = ["#ffd1e0", "#ff9ebb", "#ffc2d4", "#ff9ebb"];
    glow = { r: 106, color: "#ffb3c8", op: 0.3, dur: 3 };
    const blossoms: ArtItem[] = [];
    for (let i = 0; i < 8; i++) {
      const a = i * 45 + 10;
      const size = i % 2 ? 9 : 12;
      const c = pol(89, a);
      let d = "";
      for (let j = 0; j < 5; j++) d += petal(c[0], c[1], size, a + j * 72);
      blossoms.push(item({ d, fill: "#ffc0d3", stroke: "#ff8fb1", sw: 0.8 }));
      blossoms.push(item({ d: circle(size * 0.2), fill: "#ffd86b", tf: `translate(${pt(c)})` }));
    }
    const loose: ArtItem[] = [];
    for (let i = 0; i < 6; i++) {
      const a = i * 60 + 25;
      const c = pol(112 + (i % 2) * 5, a);
      loose.push(
        item({
          d: petal(c[0], c[1], 7, a * 2),
          fill: "#ffd1e0",
          op: 0.9,
          ov: "0.35;0.95;0.35",
          dur: f(2.4 + i * 0.4),
          begin: f(-i * 0.6),
        }),
      );
    }
    front = [layer(blossoms, 90), layer(loose, -50)];
  } else if (kind === "frost") {
    stops = ["#e8f8ff", "#8fd3ff", "#4aa8f0", "#bfe9ff"];
    glow = { r: 110, color: "#8fd3ff", op: 0.4, dur: 3 };
    const shards: ArtItem[] = [];
    const facets: ArtItem[] = [];
    for (let i = 0; i < 14; i++) {
      const deg = (i * 360) / 14 + 4;
      const h = 12 + 8 * (0.5 + 0.5 * Math.sin(i * 2.1));
      shards.push(
        item({
          d: `M${pt(pol(87, deg - 5))}L${pt(pol(87 + h, deg))}L${pt(pol(87, deg + 5))}Z`,
          fill: "#bfe9ff",
          stroke: "#ffffff",
          sw: 0.6,
          ov: "0.75;1;0.75",
          dur: f(3 + (i % 4) * 0.5),
          begin: f(-i * 0.4),
        }),
      );
      facets.push(
        item({
          d: `M${pt(pol(87, deg - 2.5))}L${pt(pol(87 + h * 0.75, deg))}L${pt(pol(87, deg + 2.5))}Z`,
          fill: "#f2fbff",
          op: 0.9,
        }),
      );
    }
    back = [layer(shards), layer(facets)];
    const flakes: ArtItem[] = [];
    for (let i = 0; i < 6; i++) {
      const s = 6.5;
      let d = "";
      for (let k = 0; k < 3; k++) d += `M${pt(rot(0, -s, k * 60))}L${pt(rot(0, s, k * 60))}`;
      flakes.push(
        item({
          d,
          stroke: "#ffffff",
          sw: 1.6,
          tf: `translate(${pt(pol(118, i * 60 + 15))})`,
          sv: "0.7;1.1;0.7",
          ov: "0.4;1;0.4",
          dur: f(2 + i * 0.35),
          begin: f(-i * 0.5),
        }),
      );
    }
    front = [layer(flakes, 40)];
  } else if (kind === "autumn") {
    stops = ["#e8a33d", "#c8601a", "#8a3a10", "#c8601a"];
    glow = { r: 105, color: "#e8a33d", op: 0.25, dur: 3.5 };
    const cols = ["#d64a1c", "#f08a24", "#f2b134", "#b8321a", "#e8761f"];
    const LEAF = "M0 2C-9 -2 -9 -13 0 -19C9 -13 9 -2 0 2Z";
    const leaves: ArtItem[] = [];
    for (let i = 0; i < 9; i++) {
      const a = i * 40 + 8;
      const s = i % 2 ? 0.85 : 1.05;
      const tf = `translate(${pt(pol(90, a))}) rotate(${a + 20 + (i % 3) * 15}) scale(${s})`;
      leaves.push(item({ d: LEAF, fill: cols[i % 5], tf }));
      leaves.push(item({ d: "M0 3L0 -15", stroke: "#7a2a0c", sw: 1.2, op: 0.45, tf }));
    }
    const falling: ArtItem[] = [];
    for (let i = 0; i < 5; i++) {
      falling.push(
        item({
          d: LEAF,
          fill: cols[(i + 2) % 5],
          op: 0.85,
          tf: `translate(${pt(pol(113, i * 72 + 30))}) rotate(${i * 95}) scale(0.6)`,
          ov: "0.4;0.9;0.4",
          dur: f(2.6 + i * 0.5),
          begin: f(-i * 0.7),
        }),
      );
    }
    front = [layer(leaves, 80), layer(falling, -60)];
  } else if (kind === "storm") {
    stops = ["#8c9bff", "#4a52c9", "#262a7a", "#5b66e8"];
    glow = { r: 112, color: "#7c8cff", op: 0.5, dur: 1.6 };
    const BOLT = "M3 -13L-5 1L0 1L-3 13L6 -3L1 -3Z";
    const bolts: ArtItem[] = [];
    for (let i = 0; i < 7; i++) {
      const a = i * 51 + 10;
      bolts.push(
        item({
          d: BOLT,
          fill: "#fff4a8",
          stroke: "#ffd23f",
          sw: 0.8,
          tf: `translate(${pt(pol(96, a))}) rotate(${a})`,
          sv: "1;1;1.15;1;1.1;1;1",
          ov: "0.2;0.2;1;0.35;1;0.2;0.2",
          dur: f(2.2 + i * 0.31),
          begin: f(-i * 0.7),
        }),
      );
    }
    const arcs = layer([item({ d: circle(99), stroke: "#c9d2ff", sw: 1.5, dash: "8 30 3 60", ov: "0.2;1;0.2", dur: 0.9 })], 6);
    front = [arcs, layer(bolts)];
  } else if (kind === "night") {
    stops = ["#6a5be0", "#2a2a8a", "#161a5c", "#3b3fb0"];
    glow = { r: 108, color: "#6a5be0", op: 0.35, dur: 3 };
    const ST = [
      [10, 100, 6],
      [62, 108, 4.5],
      [100, 97, 5],
      [140, 106, 7],
      [185, 99, 4],
      [226, 110, 6],
      [268, 98, 4.5],
      [300, 107, 5],
      [335, 96, 6],
    ];
    const stars = ST.map((s, i) =>
      item({
        d: star(s[2], 0.22),
        fill: "#ffffff",
        tf: `translate(${pt(pol(s[1], s[0]))})`,
        sv: "0.5;1.15;0.5",
        ov: "0.3;1;0.3",
        dur: f(1.7 + i * 0.3),
        begin: f(-i * 0.6),
      }),
    );
    const moon = item({
      d: "M5 -13A14 14 0 1 0 5 13A11 11 0 1 1 5 -13Z",
      fill: "#ffe9a8",
      tf: `translate(${pt(pol(95, 40))}) rotate(40)`,
    });
    front = [layer([moon]), layer(stars, 150)];
  } else if (kind === "tide") {
    stops = ["#9fe9ff", "#2fb4e8", "#1479c4", "#2fb4e8"];
    glow = { r: 108, color: "#2fb4e8", op: 0.35, dur: 3 };
    const crests: ArtItem[] = [];
    for (let i = 0; i < 12; i++) {
      const a = i * 30 + 5;
      crests.push(
        item({
          d: "M-7 0Q-3.5 -8 0 -2Q3.5 -8 7 0",
          stroke: "#e8fbff",
          sw: 2,
          tf: `translate(${pt(pol(94, a))}) rotate(${a})`,
          ov: "0.55;1;0.55",
          dur: f(2 + (i % 4) * 0.4),
          begin: f(-i * 0.3),
        }),
      );
    }
    const bubbles = [
      [15, 110, 3.5],
      [70, 114, 2.5],
      [120, 108, 4],
      [175, 115, 3],
      [225, 110, 2.5],
      [275, 114, 4],
      [325, 109, 3],
    ];
    front = [
      layer(crests, 30),
      layer(
        bubbles.map((b, i) =>
          item({
            d: circle(b[2]),
            stroke: "#cdf3ff",
            sw: 1.2,
            tf: `translate(${pt(pol(b[1], b[0]))})`,
            sv: "0.7;1.2;0.7",
            ov: "0.3;1;0.3",
            dur: f(1.8 + i * 0.3),
            begin: f(-i * 0.5),
          }),
        ),
        -45,
      ),
    ];
  } else if (kind === "hearts") {
    stops = ["#ffb3c1", "#ff5d8f", "#d6336c", "#ff5d8f"];
    glow = { r: 108, color: "#ff5d8f", op: 0.35, dur: 1.2 };
    const HEART = "M0 5C-10 -2 -8 -10 -3 -9C-1 -8.5 0 -6 0 -5C0 -6 1 -8.5 3 -9C8 -10 10 -2 0 5Z";
    const hc = ["#ff8fa8", "#ff4d7d", "#ffc2d1"];
    const hearts: ArtItem[] = [];
    for (let i = 0; i < 8; i++) {
      hearts.push(
        item({
          d: HEART,
          fill: hc[i % 3],
          tf: `translate(${pt(pol(90, i * 45 + 10))}) scale(${i % 2 ? 1.05 : 1.45})`,
          sv: "1;1.22;1;1.15;1",
          dur: 1.2,
          begin: f(-i * 0.15),
        }),
      );
    }
    const little: ArtItem[] = [];
    for (let i = 0; i < 6; i++) {
      little.push(
        item({
          d: HEART,
          fill: "#ffc2d1",
          tf: `translate(${pt(pol(113, i * 60 + 35))}) scale(0.7)`,
          ov: "0.3;0.95;0.3",
          dur: f(2.2 + i * 0.35),
          begin: f(-i * 0.6),
        }),
      );
    }
    front = [layer(hearts), layer(little, -40)];
  } else if (kind === "laurel") {
    stops = ["#fff0b0", "#e8c04a", "#b8860b", "#e8c04a"];
    glow = { r: 106, color: "#e8c04a", op: 0.25, dur: 3 };
    const LEAFL = "M0 0C-5 -4 -5 -12 0 -18C5 -12 5 -4 0 0Z";
    const leaves: ArtItem[] = [];
    for (let i = 0; i < 7; i++) {
      const a = 25 + i * 21;
      const sc = 0.8 + 0.5 * (1 - i / 7);
      leaves.push(
        item({
          d: LEAFL,
          fill: i % 2 ? "#f5d878" : "#e8c04a",
          stroke: "#b8860b",
          sw: 0.6,
          tf: `translate(${pt(pol(91, a))}) rotate(${a - 90 + 40}) scale(${sc})`,
          ov: "0.8;1;0.8",
          dur: f(2.4 + i * 0.2),
          begin: f(-i * 0.4),
        }),
      );
      leaves.push(
        item({
          d: LEAFL,
          fill: i % 2 ? "#e8c04a" : "#f5d878",
          stroke: "#b8860b",
          sw: 0.6,
          tf: `translate(${pt(pol(91, 360 - a))}) rotate(${360 - a + 90 - 40}) scale(${sc})`,
          ov: "0.8;1;0.8",
          dur: f(2.4 + i * 0.2),
          begin: f(-i * 0.4 - 0.2),
        }),
      );
    }
    const berries = (
      [
        [8, 99],
        [352, 99],
        [180, 97],
      ] as Pt[]
    ).map((b) => item({ d: circle(3), fill: "#c0392b", tf: `translate(${pt(pol(b[1], b[0]))})`, op: 0.95 }));
    front = [layer(leaves), layer(berries)];
  } else if (kind === "arcs") {
    stops = ["#5ef2ff", "#b36bff", "#ff4fd8", "#5ef2ff"];
    glow = { r: 112, color: "#b36bff", op: 0.55, dur: 1.4 };
    front = [
      layer([item({ d: circle(98), stroke: "#5ef2ff", sw: 3, dash: "34 580" })], 4),
      layer([item({ d: circle(98), stroke: "#ff4fd8", sw: 3, dash: "34 580" })], -6),
      layer([item({ d: circle(106), stroke: "#b36bff", sw: 1, dash: "3 9", op: 0.8, ov: "0.4;1;0.4", dur: 1.2 })], -12),
    ];
  } else if (kind === "rainbow") {
    stops = ["#ff5a5a", "#ffd23f", "#4ade80", "#5aa8ff"];
    glow = { r: 106, color: "#ffffff", op: 0.2, dur: 3 };
    const CLOUD = "M-9 3A5 5 0 0 1 -6 -5A6 6 0 0 1 4 -6A5 5 0 0 1 9 3Z";
    const clouds = [30, 130, 230, 320].map((a, i) =>
      item({
        d: CLOUD,
        fill: "#ffffff",
        tf: `translate(${pt(pol(96, a))}) scale(${i % 2 ? 1.1 : 1.4})`,
        sv: "1;1.08;1",
        ov: "0.85;1;0.85",
        dur: f(3 + i * 0.5),
        begin: f(-i * 0.8),
      }),
    );
    const tw = (
      [
        [75, 106],
        [180, 108],
        [275, 106],
        [350, 108],
      ] as Pt[]
    ).map((s, i) =>
      item({
        d: star(5, 0.22),
        fill: "#fff8d6",
        tf: `translate(${pt(pol(s[1], s[0]))})`,
        sv: "0.5;1.15;0.5",
        ov: "0.3;1;0.3",
        dur: f(1.8 + i * 0.3),
        begin: f(-i * 0.5),
      }),
    );
    front = [layer(clouds), layer(tw)];
  } else if (kind === "clover") {
    stops = ["#a8f0a0", "#4ec36a", "#1f8a4a", "#4ec36a"];
    glow = { r: 106, color: "#4ec36a", op: 0.3, dur: 3 };
    const CL = "M0 0C-6 -3 -8 -9 -4 -10C-2 -10.5 0 -8.5 0 -7C0 -8.5 2 -10.5 4 -10C8 -9 6 -3 0 0Z";
    const clovers: ArtItem[] = [];
    for (let i = 0; i < 6; i++) {
      const a = i * 60 + 12;
      const c = pol(91, a);
      for (let j = 0; j < 4; j++) {
        clovers.push(
          item({
            d: CL,
            fill: (i + j) % 2 ? "#6fd987" : "#3fb560",
            stroke: "#1f8a4a",
            sw: 0.5,
            tf: `translate(${pt(c)}) rotate(${a + 45 + j * 90}) scale(0.95)`,
          }),
        );
      }
    }
    const dust = (
      [
        [20, 112],
        [85, 115],
        [145, 111],
        [205, 114],
        [265, 112],
        [325, 115],
      ] as Pt[]
    ).map((s, i) =>
      item({
        d: star(4.5, 0.22),
        fill: "#ffe066",
        tf: `translate(${pt(pol(s[1], s[0]))})`,
        sv: "0.5;1.15;0.5",
        ov: "0.3;1;0.3",
        dur: f(1.7 + i * 0.3),
        begin: f(-i * 0.5),
      }),
    );
    front = [layer(clovers, 70), layer(dust, -35)];
  }

  const ring = [item({ d: circle(86), stroke: `url(#rg-${kind})`, sw: 10 })];

  return {
    stops,
    glow: small ? { ...glow, r: 0 } : glow,
    back: small ? [] : back,
    ring,
    front,
  };
}
