export type RingtoneId = "none" | "bells" | "alarm" | "chime" | "digital" | "gentle";

export const RINGTONES: { id: RingtoneId; label: string; description: string }[] = [
  { id: "bells", label: "Bells", description: "Warm ringing church bells" },
  { id: "chime", label: "Chime", description: "Bright rising chime" },
  { id: "gentle", label: "Gentle", description: "Soft marimba melody" },
  { id: "digital", label: "Digital", description: "Classic watch beeps" },
  { id: "alarm", label: "Alarm", description: "Loud alarm clock buzz" },
  { id: "none", label: "None", description: "Silent" },
];

export function isRingtoneId(value: unknown): value is RingtoneId {
  return RINGTONES.some((r) => r.id === value);
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

export function unlockAudio() {
  const ac = context();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});
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
  if (ac.state === "suspended") ac.resume().then(run).catch(() => {});
  else run();
}
