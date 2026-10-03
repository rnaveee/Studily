const KEY = "studily.next";

function isSafe(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

export function rememberNext(path: string) {
  if (!isSafe(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
  }
}

export function peekNext(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    return path && isSafe(path) ? path : null;
  } catch {
    return null;
  }
}

export function takeNext(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && isSafe(path) ? path : null;
  } catch {
    return null;
  }
}
