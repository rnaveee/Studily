import type { MascotState } from "./Mascot";

export interface Interaction {
  id: string;
  state: MascotState;
  line: string;
  ms: number;
  author?: string;
}

type Rand = () => number;

const HOLD_MS = 1900;
const DANCE_MS = 3100;

export const BOT_LINES = [
  "I'm StudilyBot! Let's go study!",
  "Ready to start helping you!",
  "I got you!",
  "Got a quiz coming up? Let's practice.",
  "Ask me about your lecture slides!",
];

export const RUN_LANDING: Interaction = { id: "run:landing", state: "excited", line: "Made it back! Cardio: done.", ms: 1500 };

export const DANCES: Interaction[] = [
  { id: "dance:dab", state: "dab", line: "Hit the dab!", ms: DANCE_MS },
  { id: "dance:floss", state: "floss", line: "Flossing! The fun kind.", ms: DANCE_MS },
  { id: "dance:robot", state: "robot", line: "Beep boop. Doing the robot. Obviously.", ms: DANCE_MS },
  { id: "dance:disco", state: "disco", line: "Disco point! Stayin' focused!", ms: DANCE_MS },
  { id: "dance:twist", state: "twist", line: "Let's do the twist!", ms: DANCE_MS },
];

export const QUOTES: { text: string; author?: string }[] = [
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison" },
  { text: "Imagination is more important than knowledge.", author: "Albert Einstein" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Nothing in life is to be feared, it is only to be understood.", author: "Marie Curie" },
  { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { text: "Fall seven times, stand up eight.", author: "Japanese proverb" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Whether you think you can, or you think you can't, you're right.", author: "Henry Ford" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  { text: "I am always doing that which I cannot do, in order that I may learn how to do it.", author: "Pablo Picasso" },
  { text: "You're doing better than you think. Keep going!" },
  { text: "Small steps every day beat cramming every night." },
  { text: "Water, snacks, notes. Let's lock in." },
  { text: "I'd tell you a chemistry joke, but I know I wouldn't get a reaction." },
  { text: "Parallel lines have so much in common. Shame they'll never meet." },
  { text: "Your future self says thanks for studying today." },
  { text: "Big topics are just small topics in a trench coat. Break them up!" },
  { text: "Mistakes are just practice with feedback." },
  { text: "One more flashcard? One more flashcard." },
  { text: "I'm 90% plumes and 10% motivation. Let's go!" },
  { text: "Teaching something is the fastest way to learn it. Try Recall mode!" },
  { text: "Don't stop when you're tired. Stop when you've earned a break." },
  { text: "Hydrate! Even robots need coolant." },
  { text: "Why was the math book sad? It had too many problems." },
  { text: "Progress, not perfection." },
];

function pick<T>(list: T[], rand: Rand): T {
  return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
}

function quoteMs(text: string): number {
  return Math.max(3500, text.split(/\s+/).length * 320);
}

function simple(id: string, state: MascotState, line: string): Interaction {
  return { id, state, line, ms: HOLD_MS };
}

const POOL: { group: string; weight: number; motionOnly?: boolean; make: (rand: Rand) => Interaction }[] = [
  { group: "highfive", weight: 2, make: () => ({ id: "highfive", state: "highfive", line: "Up top! High five!", ms: 2300 }) },
  { group: "run", weight: 2, motionOnly: true, make: () => ({ id: "run", state: "run", line: "Gotta stretch my legs!", ms: 6000 }) },
  { group: "dance", weight: 2, make: (rand) => pick(DANCES, rand) },
  {
    group: "quote",
    weight: 2,
    make: (rand) => {
      const i = Math.min(QUOTES.length - 1, Math.floor(rand() * QUOTES.length));
      const q = QUOTES[i];
      return { id: `quote:${i}`, state: "explaining", line: q.text, author: q.author, ms: quoteMs(q.text) };
    },
  },
  { group: "excited", weight: 1, make: () => simple("excited", "excited", "Let's GO! Study time!") },
  { group: "wave", weight: 1, make: () => simple("wave", "wave", "Hey hey! Good to see you.") },
  { group: "pet", weight: 1, make: () => simple("pet", "love", "Aww, thanks for the pat!") },
  { group: "think", weight: 1, make: () => simple("think", "thinking", "Hmm... what should we study first?") },
  { group: "spin", weight: 1, make: () => simple("spin", "spin", "Wheee!") },
  { group: "nap", weight: 1, make: () => simple("nap", "sleepy", "Zzz... just kidding! I'm awake!") },
];

export function nextInteraction(
  prevId: string | null,
  rand: Rand = Math.random,
  { reducedMotion = false }: { reducedMotion?: boolean } = {},
): Interaction {
  const prevGroup = prevId?.split(":")[0] ?? null;
  const pool = POOL.filter((e) => e.group !== prevGroup && !(reducedMotion && e.motionOnly));
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let r = rand() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r < 0) return e.make(rand);
  }
  return pool[pool.length - 1].make(rand);
}

export function nextLine(prev: string, rand: Rand = Math.random): string {
  return pick(
    BOT_LINES.filter((l) => l !== prev),
    rand,
  );
}
