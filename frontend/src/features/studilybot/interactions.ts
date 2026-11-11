import type { MascotState } from "./Mascot";

export interface Interaction {
  id: string;
  state: MascotState;
  line: string;
}

export const BOT_LINES = [
  "I'm StudilyBot! Let's go study!",
  "Ready to start helping you!",
  "I got you!",
  "Got a quiz coming up? Let's practice.",
  "Ask me about your lecture slides!",
];

export const INTERACTIONS: Interaction[] = [
  { id: "highfive", state: "highfive", line: "Up top! High five!" },
  { id: "excited", state: "excited", line: "Let's GO! Study time!" },
  { id: "wave", state: "wave", line: "Hey hey! Good to see you." },
  { id: "pet", state: "love", line: "Aww, thanks for the pat!" },
  { id: "think", state: "thinking", line: "Hmm... what should we study first?" },
  { id: "spin", state: "spin", line: "Wheee!" },
  { id: "nap", state: "sleepy", line: "Zzz... just kidding! I'm awake!" },
];

export function nextInteraction(prevId: string | null, rand: () => number = Math.random): Interaction {
  const pool = INTERACTIONS.filter((i) => i.id !== prevId);
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

export function nextLine(prev: string, rand: () => number = Math.random): string {
  const pool = BOT_LINES.filter((l) => l !== prev);
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}
