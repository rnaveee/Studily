import { api } from "./api";

export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export async function syncTimeZone() {
  const timezone = browserTimeZone();
  if (!timezone) return;
  await api.put<{ timezone: string }>("/settings/timezone", { timezone });
}
