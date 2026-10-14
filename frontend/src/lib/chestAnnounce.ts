const KEY = "studily.chest.announced";

function load(): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

export function wasAnnounced(id: number): boolean {
  return load().includes(id);
}

export function markAnnounced(ids: number[]) {
  try {
    const next = Array.from(new Set([...load(), ...ids])).slice(-200);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
  }
}
