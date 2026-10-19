import type { ReportKind, ReportReason } from "../types";

export const SUSPENDED_EVENT = "studily:suspended";

export const REPORT_REASONS: {
  value: ReportReason;
  label: string;
  messageLabel?: string;
  forUser: boolean;
  forMessage: boolean;
}[] = [
  { value: "SPAM", label: "Bot or spam account", messageLabel: "Spam", forUser: true, forMessage: true },
  { value: "INAPPROPRIATE_AVATAR", label: "Inappropriate profile picture", forUser: true, forMessage: false },
  { value: "INAPPROPRIATE_BIO", label: "Inappropriate name or bio", forUser: true, forMessage: false },
  { value: "HARASSMENT", label: "Harassment or bullying", forUser: true, forMessage: true },
  { value: "THREATS", label: "Threats or violence", forUser: true, forMessage: true },
  { value: "HATE_SPEECH", label: "Hate speech", forUser: true, forMessage: true },
  { value: "INAPPROPRIATE_CONTENT", label: "Sexual or inappropriate content", forUser: false, forMessage: true },
  { value: "OTHER", label: "Other", forUser: true, forMessage: true },
];

export function reasonsFor(kind: ReportKind) {
  return REPORT_REASONS.filter((r) => (kind === "USER" ? r.forUser : r.forMessage));
}

export function reasonLabel(code: string): string {
  const found = REPORT_REASONS.find((r) => r.value === code);
  return (found ? found.label : code.replace(/_/g, " ")).toLowerCase();
}

export function reasonTitle(code: string): string {
  return REPORT_REASONS.find((r) => r.value === code)?.label ?? code;
}

export function formatReasons(list: string[]): string {
  const labels = list.map(reasonLabel);
  if (labels.length === 0) return "violating our rules";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [d > 0 ? `${d}d` : "", d > 0 || h > 0 ? `${h}h` : "", `${m}m`, `${s}s`];
  return parts.filter(Boolean).join(" ");
}
