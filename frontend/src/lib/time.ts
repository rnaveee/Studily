export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(time: string, delta: number): string {
  return fromMinutes(toMinutes(time) + delta);
}

export function formatTime12(time: string): string {
  const total = toMinutes(time);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function parseTime(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const meridiem = /p/.test(raw) ? "pm" : /a/.test(raw) ? "am" : null;
  const digits = raw.replace(/[^0-9:]/g, "");
  if (!digits) return null;

  let hour: number;
  let minute: number;

  if (digits.includes(":")) {
    const [h, m] = digits.split(":");
    if (h === "") return null;
    hour = Number(h);
    minute = m === "" || m === undefined ? 0 : Number(m.slice(0, 2).padEnd(2, "0"));
  } else if (digits.length <= 2) {
    hour = Number(digits);
    minute = 0;
  } else {
    const cut = digits.length - 2;
    hour = Number(digits.slice(0, cut));
    minute = Number(digits.slice(cut));
  }

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (minute > 59) return null;

  if (meridiem === "pm") {
    if (hour > 12) return null;
    if (hour !== 12) hour += 12;
  } else if (meridiem === "am") {
    if (hour > 12) return null;
    if (hour === 12) hour = 0;
  } else if (hour < 7) {
    hour += 12;
  }

  if (hour > 23) return null;
  return fromMinutes(hour * 60 + minute);
}
