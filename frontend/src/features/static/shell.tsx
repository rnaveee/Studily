import type { ReactNode } from "react";

export function Page({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-in">
      <div>
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        {intro && <p className="mt-1 text-[13px] text-fg-3">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card p-6">
      {title && <h2 className="mb-3 text-[15px] font-semibold text-fg">{title}</h2>}
      <div className="space-y-3 text-[13px] leading-relaxed text-fg-2">{children}</div>
    </section>
  );
}
