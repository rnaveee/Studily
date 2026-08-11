import { DAYS, type DayOfWeek, type Recurrence } from "../types";

export const MAX_OCCURRENCES = 200;

function dayOf(d: Date): DayOfWeek {
  return DAYS[d.getDay()];
}

function weeksBetween(a: Date, b: Date): number {
  const startOfWeek = (d: Date) => {
    const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    copy.setDate(copy.getDate() - copy.getDay());
    return copy;
  };
  const days = Math.round(
    (startOfWeek(b).getTime() - startOfWeek(a).getTime()) / 86_400_000,
  );
  return Math.trunc(days / 7);
}

function matches(rule: Recurrence, start: Date, date: Date): boolean {
  switch (rule.freq) {
    case "DAILY": {
      const days = Math.round(
        (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
          new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) /
          86_400_000,
      );
      return days % rule.interval === 0;
    }
    case "WEEKLY": {
      const byDay = rule.byDay?.length ? rule.byDay : [dayOf(start)];
      return byDay.includes(dayOf(date)) && weeksBetween(start, date) % rule.interval === 0;
    }
    case "MONTHLY": {
      const months =
        (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
      return date.getDate() === start.getDate() && months % rule.interval === 0;
    }
  }
}

export function expand(startIso: string, rule: Recurrence, cap = MAX_OCCURRENCES + 1): Date[] {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return [];

  const until = rule.until ? new Date(rule.until) : null;
  const horizon = new Date(start.getTime());
  horizon.setFullYear(horizon.getFullYear() + 5);
  const end = until && until < horizon ? until : horizon;

  const out: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let produced = 0;
  let scanned = 0;

  while (out.length < cap && scanned < 366 * 6) {
    scanned++;
    const at = new Date(cursor);
    at.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
    if (at > end) break;
    if (matches(rule, start, cursor)) {
      produced++;
      if (rule.count && produced > rule.count) break;
      if (at >= start) out.push(at);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

const DAY_NAMES: Record<string, string> = {
  SU: "Sun", MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat",
};

export function describeRule(rrule: string | null | undefined): string | null {
  if (!rrule) return null;
  const parts = Object.fromEntries(
    rrule.split(";").map((p) => {
      const i = p.indexOf("=");
      return i > 0 ? [p.slice(0, i).toUpperCase(), p.slice(i + 1)] : [p.toUpperCase(), ""];
    }),
  );
  const every = Number(parts.INTERVAL ?? 1) || 1;
  const unit =
    parts.FREQ === "DAILY" ? "day" : parts.FREQ === "MONTHLY" ? "month" : "week";
  const base = every === 1 ? `Repeats every ${unit}` : `Repeats every ${every} ${unit}s`;
  if (parts.FREQ === "WEEKLY" && parts.BYDAY) {
    const days = parts.BYDAY.split(",")
      .map((d: string) => DAY_NAMES[d.trim().toUpperCase()] ?? d)
      .join(", ");
    return `${base} on ${days}`;
  }
  return base;
}

export function summarize(startIso: string, rule: Recurrence | null): string | null {
  if (!rule) return null;
  const dates = expand(startIso, rule);
  if (dates.length === 0) return "No dates match this repeat";
  if (dates.length > MAX_OCCURRENCES) {
    return `More than ${MAX_OCCURRENCES} occurrences. Shorten it or end it sooner.`;
  }
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const last = dates[dates.length - 1];
  if (dates.length === 1) return `1 occurrence on ${fmt(dates[0])}`;
  return `${dates.length} occurrences, ${fmt(dates[0])} to ${fmt(last)}`;
}
