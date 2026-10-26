export interface TrackState {
  round: number;
  deck: string[];
  pos: number;
  results: Record<string, boolean>;
}

export const TRACK_PREF_KEY = "studily.flip.track";

export function trackStorageKey(viewerKey: string, scope: string): string {
  return `studily.flip.${viewerKey}.${scope}`;
}

export function freshTrack(keys: string[]): TrackState {
  return { round: 1, deck: keys, pos: 0, results: {} };
}

export function reconcileTrack(state: TrackState | null, keys: string[]): TrackState {
  if (!state || !Array.isArray(state.deck) || !Number.isInteger(state.pos) || !Number.isInteger(state.round)) {
    return freshTrack(keys);
  }
  const live = new Set(keys);
  const pos = Math.min(Math.max(state.pos, 0), state.deck.length);
  const answered = state.deck.slice(0, pos).filter((k) => live.has(k));
  let rest = state.deck.slice(pos).filter((k) => live.has(k));
  if (state.round <= 1) {
    const inDeck = new Set(state.deck);
    rest = [...rest, ...keys.filter((k) => !inDeck.has(k))];
  }
  const deck = [...answered, ...rest];
  if (deck.length === 0) return freshTrack(keys);
  const results: Record<string, boolean> = {};
  for (const k of answered) {
    const r = state.results?.[k];
    if (typeof r === "boolean") results[k] = r;
  }
  const same =
    deck.length === state.deck.length &&
    deck.every((k, i) => k === state.deck[i]) &&
    answered.length === state.pos &&
    Object.keys(results).length === Object.keys(state.results ?? {}).length;
  if (same && state.round >= 1) return state;
  return { round: Math.max(1, state.round), deck, pos: answered.length, results };
}

export function trackCounts(state: TrackState) {
  let right = 0;
  let wrong = 0;
  for (const k of state.deck.slice(0, state.pos)) {
    if (state.results[k] === true) right++;
    else if (state.results[k] === false) wrong++;
  }
  return { right, wrong };
}

export function markCard(state: TrackState, known: boolean): TrackState {
  const key = state.deck[state.pos];
  if (key == null) return state;
  return { ...state, pos: state.pos + 1, results: { ...state.results, [key]: known } };
}

export function undoMark(state: TrackState): TrackState {
  if (state.pos === 0) return state;
  const key = state.deck[state.pos - 1];
  const results = { ...state.results };
  delete results[key];
  return { ...state, pos: state.pos - 1, results };
}

export function focusWrong(state: TrackState): TrackState {
  const wrong = state.deck.slice(0, state.pos).filter((k) => state.results[k] === false);
  if (wrong.length === 0) return state;
  return { round: state.round + 1, deck: wrong, pos: 0, results: {} };
}
