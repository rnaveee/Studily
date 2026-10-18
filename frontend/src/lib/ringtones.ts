export type RingtoneId =
  | "none"
  | "bells"
  | "alarm"
  | "chime"
  | "digital"
  | "gentle"
  | "kalimba"
  | "harp"
  | "windchime"
  | "bowl"
  | "rise"
  | "pulse"
  | "siren"
  | "sunrise";

export const RINGTONES: { id: RingtoneId; label: string; description: string }[] = [
  { id: "bells", label: "Bells", description: "Warm ringing church bells" },
  { id: "chime", label: "Chime", description: "Bright rising chime" },
  { id: "gentle", label: "Gentle", description: "Soft marimba melody" },
  { id: "kalimba", label: "Kalimba", description: "Plucked thumb piano tune" },
  { id: "harp", label: "Harp", description: "Rippling harp glissando" },
  { id: "windchime", label: "Wind chimes", description: "Light, scattered chimes" },
  { id: "bowl", label: "Singing bowl", description: "Calm, ringing bowl" },
  { id: "sunrise", label: "Sunrise", description: "Warm swelling chords" },
  { id: "rise", label: "Rise", description: "Bright rising arpeggio" },
  { id: "pulse", label: "Pulse", description: "Rhythmic synth beeps" },
  { id: "digital", label: "Digital", description: "Classic watch beeps" },
  { id: "siren", label: "Siren", description: "Rising and falling siren" },
  { id: "alarm", label: "Alarm", description: "Loud alarm clock buzz" },
  { id: "none", label: "None", description: "Silent" },
];

export function isRingtoneId(value: unknown): value is RingtoneId {
  return RINGTONES.some((r) => r.id === value);
}

export function ringtoneLabel(id: RingtoneId): string {
  return RINGTONES.find((r) => r.id === id)?.label ?? id;
}

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let current: GainNode | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function audioUnlocked(): boolean {
  return ctx?.state === "running";
}

export function unlockAudio() {
  const ac = context();
  if (!ac) return;
  if (ac.state !== "running") ac.resume().catch(() => {});
  try {
    const buffer = ac.createBuffer(1, 1, 22050);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(ac.destination);
    src.start(0);
  } catch {
  }
}

interface Note {
  at: number;
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
}

function tone(ac: AudioContext, out: AudioNode, t0: number, n: Note) {
  const start = t0 + n.at;
  const end = start + n.dur;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = n.type ?? "sine";
  osc.frequency.setValueAtTime(n.freq, start);
  const peak = n.gain ?? 0.3;
  const attack = n.attack ?? 0.005;
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(env).connect(out);
  osc.start(start);
  osc.stop(end + 0.05);
}

function bell(ac: AudioContext, out: AudioNode, t0: number, at: number, freq: number, gain: number) {
  const partials: [number, number, number][] = [
    [0.5, 0.35, 2.6],
    [1, 1, 2.2],
    [2.4, 0.45, 1.3],
    [3.0, 0.3, 1.0],
    [4.5, 0.22, 0.7],
    [5.95, 0.12, 0.5],
  ];
  for (const [ratio, weight, dur] of partials) {
    tone(ac, out, t0, { at, freq: freq * ratio, dur, gain: gain * weight, attack: 0.003 });
  }
}

const PATTERNS: Record<Exclude<RingtoneId, "none">, (ac: AudioContext, out: AudioNode, t0: number) => void> = {
  bells(ac, out, t0) {
    const melody = [659.25, 523.25, 587.33, 392.0, 392.0, 587.33, 659.25, 523.25];
    melody.forEach((f, i) => bell(ac, out, t0, i * 0.42, f, 0.22));
  },
  chime(ac, out, t0) {
    const run = [1046.5, 1318.5, 1568.0, 2093.0];
    for (let rep = 0; rep < 3; rep++) {
      run.forEach((f, i) => {
        const at = rep * 1.25 + i * 0.12;
        tone(ac, out, t0, { at, freq: f, dur: 1.1, gain: 0.22 });
        tone(ac, out, t0, { at, freq: f * 2, dur: 0.5, gain: 0.05 });
      });
    }
  },
  gentle(ac, out, t0) {
    const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 783.99, 1046.5, 783.99, 523.25];
    melody.forEach((f, i) => {
      const at = i * 0.4;
      tone(ac, out, t0, { at, freq: f, dur: 0.7, type: "triangle", gain: 0.32, attack: 0.01 });
      tone(ac, out, t0, { at, freq: f * 4, dur: 0.12, gain: 0.04 });
    });
  },
  digital(ac, out, t0) {
    for (let group = 0; group < 4; group++) {
      for (let i = 0; i < 4; i++) {
        tone(ac, out, t0, {
          at: group * 1.0 + i * 0.11,
          freq: 2093,
          dur: 0.07,
          type: "square",
          gain: 0.09,
          attack: 0.002,
        });
      }
    }
  },
  alarm(ac, out, t0) {
    for (let pair = 0; pair < 7; pair++) {
      for (let i = 0; i < 2; i++) {
        const at = pair * 0.55 + i * 0.18;
        tone(ac, out, t0, { at, freq: 880, dur: 0.13, type: "square", gain: 0.12, attack: 0.002 });
        tone(ac, out, t0, { at, freq: 1320, dur: 0.13, type: "square", gain: 0.05, attack: 0.002 });
      }
    }
  },
  kalimba(ac, out, t0) {
    const melody = [783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 523.25, 392.0];
    const times = [0, 0.3, 0.6, 0.9, 1.5, 1.8, 2.1, 2.7];
    melody.forEach((f, i) => {
      tone(ac, out, t0, { at: times[i], freq: f, dur: 1.4, gain: 0.3, attack: 0.002 });
      tone(ac, out, t0, { at: times[i], freq: f * 5.4, dur: 0.15, gain: 0.05, attack: 0.001 });
    });
  },
  harp(ac, out, t0) {
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5, 1318.51];
    [notes, [...notes].reverse()].forEach((run, rep) => {
      run.forEach((f, i) => {
        const at = rep * 2.2 + i * 0.07;
        tone(ac, out, t0, { at, freq: f, dur: 1.8, type: "triangle", gain: 0.16, attack: 0.004 });
        tone(ac, out, t0, { at, freq: f * 2, dur: 0.9, gain: 0.04, attack: 0.004 });
      });
    });
  },
  windchime(ac, out, t0) {
    const notes = [1567.98, 2093.0, 1760.0, 2349.32, 1318.51, 2637.02, 1760.0, 1567.98, 2093.0, 1318.51, 2349.32, 1760.0];
    const times = [0, 0.18, 0.43, 0.55, 0.9, 1.05, 1.4, 1.62, 2.1, 2.3, 2.75, 3.05];
    notes.forEach((f, i) => bell(ac, out, t0, times[i], f, 0.07));
  },
  bowl(ac, out, t0) {
    [0, 1.8, 3.6].forEach((at) => {
      tone(ac, out, t0, { at, freq: 293.66, dur: 2.0, gain: 0.26, attack: 0.01 });
      tone(ac, out, t0, { at, freq: 295.2, dur: 2.0, gain: 0.18, attack: 0.01 });
      tone(ac, out, t0, { at, freq: 293.66 * 2.71, dur: 1.4, gain: 0.08, attack: 0.01 });
      tone(ac, out, t0, { at, freq: 293.66 * 5.15, dur: 0.8, gain: 0.03, attack: 0.01 });
    });
  },
  sunrise(ac, out, t0) {
    const chords = [
      [261.63, 329.63, 392.0],
      [349.23, 440.0, 523.25],
      [392.0, 493.88, 587.33],
      [523.25, 659.25, 783.99, 1046.5],
    ];
    chords.forEach((chord, i) => {
      const dur = i === chords.length - 1 ? 2.2 : 1.3;
      chord.forEach((f) => {
        tone(ac, out, t0, { at: i * 1.1, freq: f, dur, gain: 0.09 + i * 0.015, attack: 0.25 });
        tone(ac, out, t0, { at: i * 1.1, freq: f * 2, dur, gain: 0.02, attack: 0.25 });
      });
    });
  },
  rise(ac, out, t0) {
    const run = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    for (let rep = 0; rep < 3; rep++) {
      run.forEach((f, i) => {
        const at = rep * 1.2 + i * 0.09;
        tone(ac, out, t0, { at, freq: f, dur: 0.35, type: "triangle", gain: 0.12 + rep * 0.05, attack: 0.003 });
      });
      tone(ac, out, t0, { at: rep * 1.2 + 0.54, freq: 2093.0, dur: 0.6, gain: 0.1 + rep * 0.04, attack: 0.003 });
    }
  },
  pulse(ac, out, t0) {
    for (let bar = 0; bar < 4; bar++) {
      const base = bar * 1.1;
      [0, 0.15, 0.3].forEach((offset) => {
        tone(ac, out, t0, { at: base + offset, freq: 659.25, dur: 0.1, type: "square", gain: 0.08, attack: 0.002 });
        tone(ac, out, t0, { at: base + offset, freq: 329.63, dur: 0.1, gain: 0.12, attack: 0.002 });
      });
      tone(ac, out, t0, { at: base + 0.45, freq: 987.77, dur: 0.35, type: "square", gain: 0.09, attack: 0.002 });
      tone(ac, out, t0, { at: base + 0.45, freq: 493.88, dur: 0.35, gain: 0.12, attack: 0.002 });
    }
  },
  siren(ac, out, t0) {
    const osc = ac.createOscillator();
    const lp = ac.createBiquadFilter();
    const env = ac.createGain();
    osc.type = "square";
    lp.type = "lowpass";
    lp.frequency.value = 2500;
    osc.frequency.setValueAtTime(650, t0);
    for (let i = 0; i < 4; i++) {
      osc.frequency.exponentialRampToValueAtTime(1300, t0 + i * 1.1 + 0.55);
      osc.frequency.exponentialRampToValueAtTime(650, t0 + i * 1.1 + 1.1);
    }
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.12, t0 + 0.05);
    env.gain.setValueAtTime(0.12, t0 + 4.2);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.4);
    osc.connect(lp).connect(env).connect(out);
    osc.start(t0);
    osc.stop(t0 + 4.5);
  },
};

export function stopRingtone() {
  if (!current || !ctx) return;
  const node = current;
  current = null;
  try {
    node.gain.cancelScheduledValues(ctx.currentTime);
    node.gain.setValueAtTime(node.gain.value, ctx.currentTime);
    node.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
    setTimeout(() => node.disconnect(), 100);
  } catch {
    node.disconnect();
  }
}

export function playRingtone(id: RingtoneId, volume: number) {
  if (id === "none" || volume <= 0) return;
  const ac = context();
  if (!ac) return;
  stopRingtone();
  const run = () => {
    const master = ac.createGain();
    master.gain.value = Math.min(1, Math.max(0, volume));
    master.connect(ac.destination);
    current = master;
    PATTERNS[id](ac, master, ac.currentTime + 0.05);
    setTimeout(() => {
      if (current === master) {
        current = null;
        master.disconnect();
      }
    }, 6000);
  };
  if (ac.state !== "running") ac.resume().then(run).catch(() => {});
  else run();
}
