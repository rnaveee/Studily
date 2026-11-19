import type { ReactNode } from "react";
import { Check } from "lucide-react";

export function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
          >
            <Check size={12} className="text-accent" aria-hidden="true" />
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function SideBySide({
  media,
  reverse = false,
  children,
}: {
  media: ReactNode;
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid items-center gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10">
      <div className={`min-w-0 space-y-4 ${reverse ? "md:order-2" : ""}`}>{children}</div>
      <div className={`min-w-0 ${reverse ? "md:order-1" : ""}`}>{media}</div>
    </div>
  );
}

export function TextColumns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
      <div className="min-w-0 space-y-4">{left}</div>
      <div className="min-w-0">{right}</div>
    </div>
  );
}
