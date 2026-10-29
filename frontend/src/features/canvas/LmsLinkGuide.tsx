import { useState } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";

const GUIDES: { id: string; name: string; steps: string[] }[] = [
  {
    id: "canvas",
    name: "Canvas",
    steps: [
      "Sign in to Canvas and open Calendar from the left menu.",
      "Scroll to the bottom right and click Calendar Feed.",
      "Copy the link that appears and paste it above.",
    ],
  },
  {
    id: "brightspace",
    name: "Brightspace (D2L)",
    steps: [
      "Sign in to Brightspace and open Calendar.",
      "If you don't see Subscribe, open Settings in the calendar and turn on calendar feeds.",
      "Click Subscribe, choose All Courses, and copy the link.",
      "Paste the link above.",
    ],
  },
  {
    id: "moodle",
    name: "Moodle",
    steps: [
      "Sign in to Moodle and open Calendar.",
      "Click Import or export calendars, then Export calendar.",
      "Pick All events and a time range like Recent and next 60 days, then click Get calendar URL.",
      "Copy the link and paste it above.",
    ],
  },
];

export default function LmsLinkGuide() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 py-1 text-left text-[13px] font-medium text-accent"
      >
        <CircleHelp size={14} />
        How do I find my link?
        <ChevronDown size={14} className="ml-auto transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      <Collapse open={open}>
        <div className="mt-2 overflow-hidden rounded-xl border border-line">
          {GUIDES.map((g, i) => {
            const expanded = active === g.id;
            return (
              <div key={g.id} className={i > 0 ? "border-t border-line" : undefined}>
                <button
                  type="button"
                  onClick={() => setActive(expanded ? null : g.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-[13.5px] font-semibold text-fg transition-colors hover:bg-surface-hi"
                  style={{ minHeight: 44 }}
                >
                  {g.name}
                  <ChevronDown
                    size={14}
                    className="ml-auto text-fg-3 transition-transform"
                    style={{ transform: expanded ? "rotate(180deg)" : undefined }}
                  />
                </button>
                <Collapse open={expanded}>
                  <ol className="space-y-1.5 px-3.5 pb-3.5">
                    {g.steps.map((s, n) => (
                      <li key={n} className="flex gap-2.5 text-[12.5px] leading-relaxed text-fg-2">
                        <span
                          className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold"
                          style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}
                        >
                          {n + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </Collapse>
              </div>
            );
          })}
        </div>
      </Collapse>
    </div>
  );
}

function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
