import BadgeTile from "./BadgeTile";
import type { BadgeDto } from "../../types";

const PLACES = [1, 0, 2];

export default function BadgePodium({ badges }: { badges: BadgeDto[] }) {
  const featured = badges.slice(0, 3);
  const steps = PLACES.filter((i) => i < featured.length).map((i) => ({ badge: featured[i], first: i === 0 }));

  return (
    <div className="relative mt-5 flex justify-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 top-4"
        style={{
          background:
            "radial-gradient(55% 75% at 50% 90%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 72%)",
        }}
      />
      <div className="relative flex flex-col items-stretch">
        <div className="flex items-end">
          {steps.map(({ badge, first }, i) => {
            const corners =
              steps.length === 1 || first
                ? "rounded-t-xl"
                : i === 0
                  ? "rounded-tl-xl"
                  : "rounded-tr-xl";
            return (
              <div
                key={badge.code}
                className="flex flex-col items-center"
                style={{ width: first ? 104 : 92, marginLeft: i === 0 ? 0 : -1, zIndex: first ? 1 : 0 }}
              >
                <BadgeTile badge={badge} variant="podium" artSize={first ? 96 : 80} />
                <div
                  className={`mt-1 flex w-full items-center justify-center px-1.5 text-center ${corners}`}
                  style={{
                    height: first ? 48 : 32,
                    border: "1px solid var(--line)",
                    borderBottom: "none",
                    background: first
                      ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 24%, var(--surface-hi)), var(--surface-hi))"
                      : "linear-gradient(180deg, var(--surface-hi), var(--surface))",
                    boxShadow: "inset 0 1px 0 var(--edge-hi)",
                  }}
                >
                  <span
                    className={`line-clamp-2 text-[10.5px] font-semibold leading-tight ${first ? "text-fg" : "text-fg-2"}`}
                  >
                    {badge.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="-mx-3 h-1.5 rounded-full" style={{ background: "var(--line)" }} />
      </div>
    </div>
  );
}
