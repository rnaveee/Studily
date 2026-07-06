export function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonthDay(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

export function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins % 60}m`;
  return `in ${mins}m`;
}
